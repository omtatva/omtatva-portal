"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useOrgChart } from "@/lib/useOrgChart";
import {
  getDescendantIds,
  getManagerChain,
  matchesQuery,
  type OrgIndex,
  type OrgPerson,
} from "@/lib/orgHierarchy";
import PersonAvatar from "./PersonAvatar";
import { OrgTree, ancestorsOf, useTreeExpansion } from "./OrgTree";

const BRAND = "#3d6fa8";

type Tab = "mine" | "company";

// Employee/manager dashboard section: replaces the old "Trends" block.
// Everything here is derived live from Firestore (see useOrgChart) — there
// are no hardcoded names, photos, managers or levels.
export default function OrgHierarchySection() {
  const { index, ready, relationsError } = useOrgChart();
  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u ? u.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  return (
    <OrgHierarchyPanel
      index={index}
      currentUid={uid || ""}
      loading={!ready || !authChecked}
      relationsError={relationsError}
    />
  );
}

export function OrgHierarchyPanel({
  index,
  currentUid,
  loading,
  relationsError,
}: {
  index: OrgIndex;
  currentUid: string;
  loading?: boolean;
  relationsError?: string;
}) {
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const me = currentUid ? index.byId.get(currentUid) : undefined;
  const uid = currentUid;

  return (
    <section style={{ marginBottom: 35 }} aria-label="Organization hierarchy">
      <h2 style={{ marginBottom: 20, color: "var(--text-color)", fontWeight: 700 }}>
        🏢 Organization Hierarchy
      </h2>

      <div
        style={{
          background: "var(--card-bg)",
          borderRadius: 22,
          padding: "clamp(16px, 3vw, 30px)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
        }}
      >
        {relationsError && (
          <Notice tone="warn">{relationsError}</Notice>
        )}

        {loading ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Loading organization…</p>
        ) : !me ? (
          <>
            <Notice tone="info">
              Your employee record could not be found in the organization directory yet.
              {" "}Complete your profile or contact HR if this persists.
            </Notice>
            <CompanyView
              index={index}
              currentUid={uid || ""}
              query={query}
              setQuery={setQuery}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
                My Hierarchy
              </TabButton>
              <TabButton active={tab === "company"} onClick={() => setTab("company")}>
                Full Organization
              </TabButton>
            </div>

            {tab === "mine" ? (
              <MyView index={index} me={me} />
            ) : (
              <CompanyView
                index={index}
                currentUid={me.uid}
                query={query}
                setQuery={setQuery}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function MyView({ index, me }: { index: OrgIndex; me: OrgPerson }) {
  const chain = useMemo(() => getManagerChain(index, me.uid), [index, me.uid]);
  const directReports = index.children.get(me.uid) || [];
  const manager = chain[0];
  const danglingId = index.danglingManager.get(me.uid);
  const selfLoop = !!me.managerId && me.managerId === me.uid;

  // Top of the chain is the root of what we draw; everything beneath it
  // is trimmed to: the chain itself, me, my peers, and my whole team.
  const rootId = chain.length ? chain[chain.length - 1].uid : me.uid;
  const peers = useMemo(
    () => (manager ? index.children.get(manager.uid) || [] : []),
    [index, manager]
  );

  const visibleIds = useMemo(() => {
    const ids = new Set<string>([me.uid, ...chain.map((p) => p.uid), ...peers]);
    getDescendantIds(index, me.uid).forEach((id) => ids.add(id));
    return ids;
  }, [index, me.uid, chain, peers]);

  const { expanded, toggle } = useTreeExpansion([
    ...chain.map((p) => p.uid),
    me.uid,
  ]);

  // Chain/me are always held open; the user can still fold any team that
  // is not on the path to them.
  const forceOpen = useMemo(
    () => new Set<string>([...chain.map((p) => p.uid)]),
    [chain]
  );

  const level = chain.length + 1;

  return (
    <>
      <OrgSummaryStyles />
      <div className="org-summary">
        <SummaryTile label="Reports to">
          {manager ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <PersonAvatar name={manager.name} photo={manager.photo} gender={manager.gender} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{manager.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                  {manager.designation || "Designation not set"}
                </div>
              </div>
            </div>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>
              {danglingId
                ? "Manager record not found"
                : selfLoop
                ? "Invalid assignment"
                : "Top of the organization"}
            </span>
          )}
        </SummaryTile>
        <SummaryTile label="Direct reports">
          <strong style={{ fontSize: 22 }}>{directReports.length}</strong>
        </SummaryTile>
        <SummaryTile label="Teammates">
          <strong style={{ fontSize: 22 }}>{Math.max(peers.length - 1, 0)}</strong>
        </SummaryTile>
        <SummaryTile label="Your level">
          <strong style={{ fontSize: 22 }}>L{level}</strong>
          <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
            {" "}
            from the top
          </span>
        </SummaryTile>
      </div>

      {(danglingId || selfLoop) && (
        <Notice tone="warn">
          {selfLoop
            ? "Your reporting manager is set incorrectly. Please ask HR to fix it."
            : "Your assigned reporting manager’s record no longer exists. Please ask HR to assign a new manager."}
        </Notice>
      )}
      {!manager && !danglingId && !selfLoop && directReports.length === 0 && (
        <Notice tone="info">
          No reporting manager has been assigned to you yet. HR can assign one from the admin portal.
        </Notice>
      )}

      <ChainBar index={index} uid={me.uid} />

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <OrgTree
          index={index}
          rootIds={[rootId]}
          expanded={expanded}
          onToggle={toggle}
          currentUid={me.uid}
          visibleIds={visibleIds}
          forceOpen={forceOpen}
        />
      </div>
    </>
  );
}

function CompanyView({
  index,
  currentUid,
  query,
  setQuery,
  selectedId,
  setSelectedId,
}: {
  index: OrgIndex;
  currentUid: string;
  query: string;
  setQuery: (v: string) => void;
  selectedId: string;
  setSelectedId: (v: string) => void;
}) {
  const { expanded, toggle, expandMany, collapseAll } = useTreeExpansion();

  // Open the path down to me once, on first render of this tab.
  useEffect(() => {
    if (currentUid && index.byId.has(currentUid)) {
      expandMany(ancestorsOf(index, currentUid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUid]);

  const searching = query.trim().length > 0;

  const { matchIds, visibleIds, forceOpen } = useMemo(() => {
    if (!searching) {
      return { matchIds: undefined, visibleIds: undefined, forceOpen: undefined };
    }
    const matches = new Set<string>();
    const visible = new Set<string>();
    const open = new Set<string>();
    for (const p of index.people) {
      if (matchesQuery(p, query)) {
        matches.add(p.uid);
        visible.add(p.uid);
        for (const a of ancestorsOf(index, p.uid)) {
          visible.add(a);
          open.add(a);
        }
      }
    }
    return { matchIds: matches, visibleIds: visible, forceOpen: open };
  }, [index, query, searching]);

  const expandAll = () =>
    expandMany(index.people.filter((p) => (index.children.get(p.uid) || []).length).map((p) => p.uid));

  const showMe = () => {
    if (!currentUid) return;
    setQuery("");
    expandMany(ancestorsOf(index, currentUid));
    setSelectedId(currentUid);
  };

  if (!index.people.length) {
    return <p style={{ color: "var(--text-muted)", margin: 0 }}>No employees found.</p>;
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, designation, department…"
          aria-label="Search the organization"
          style={{
            flex: "1 1 220px",
            minWidth: 0,
            height: 42,
            padding: "0 14px",
            borderRadius: 12,
            border: "1px solid var(--border-color)",
            background: "var(--bg-color)",
            color: "var(--text-color)",
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
        <button type="button" onClick={showMe} style={ghostButton} disabled={!currentUid}>
          Show me
        </button>
        <button type="button" onClick={expandAll} style={ghostButton}>
          Expand all
        </button>
        <button type="button" onClick={collapseAll} style={ghostButton}>
          Collapse all
        </button>
      </div>

      {searching && matchIds && (
        <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13.5 }}>
          {matchIds.size === 0
            ? "No one matches your search."
            : `${matchIds.size} match${matchIds.size === 1 ? "" : "es"} — highlighted below.`}
        </p>
      )}

      {selectedId && index.byId.has(selectedId) && <ChainBar index={index} uid={selectedId} />}

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <OrgTree
          index={index}
          rootIds={index.roots}
          expanded={expanded}
          onToggle={toggle}
          currentUid={currentUid}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id === selectedId ? "" : id)}
          matchIds={matchIds}
          visibleIds={visibleIds}
          forceOpen={forceOpen}
        />
      </div>
    </>
  );
}

// Reporting chain for one person, top of the organization first:
// "CEO › Dept Manager › Employee".
export function ChainBar({ index, uid }: { index: OrgIndex; uid: string }) {
  const person = index.byId.get(uid);
  const chain = useMemo(() => getManagerChain(index, uid), [index, uid]);
  if (!person) return null;

  const ordered = [...chain].reverse();

  return (
    <div
      className="org-chain"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 14px",
        marginBottom: 16,
        borderRadius: 14,
        background: "var(--hover-bg)",
        border: "1px solid var(--border-color)",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".05em", color: "var(--text-muted)" }}>
        REPORTING CHAIN
      </span>
      {ordered.length === 0 && (
        <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          {person.name} is at the top of their reporting line
        </span>
      )}
      {[...ordered, person].map((p, i, all) => (
        <span key={p.uid} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px 3px 4px",
              borderRadius: 999,
              background: p.uid === uid ? BRAND : "var(--card-bg)",
              color: p.uid === uid ? "#fff" : "var(--text-color)",
              border: "1px solid var(--border-color)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <PersonAvatar name={p.name} photo={p.photo} gender={p.gender} size={24} />
            {p.name}
          </span>
          {i < all.length - 1 && <span style={{ color: "var(--text-muted)" }}>›</span>}
        </span>
      ))}
    </div>
  );
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        background: "var(--hover-bg)",
        border: "1px solid var(--border-color)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 800,
          letterSpacing: ".05em",
          color: "var(--text-muted)",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ color: "var(--text-color)" }}>{children}</div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  const warn = tone === "warn";
  return (
    <div
      role={warn ? "alert" : "status"}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        marginBottom: 16,
        fontSize: 13.5,
        background: warn ? "rgba(234,88,12,.12)" : "rgba(61,111,168,.12)",
        color: warn ? "#c2410c" : BRAND,
        border: `1px solid ${warn ? "rgba(234,88,12,.35)" : "rgba(61,111,168,.3)"}`,
      }}
    >
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "9px 18px",
        borderRadius: 999,
        border: `1px solid ${active ? BRAND : "var(--border-color)"}`,
        background: active ? BRAND : "var(--card-bg)",
        color: active ? "#fff" : "var(--text-color)",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const ghostButton: React.CSSProperties = {
  height: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid var(--border-color)",
  background: "var(--card-bg)",
  color: "var(--text-color)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

// Summary grid is plain CSS (media queries can't live in inline styles).
// Rendered once next to the component via a tiny style tag.
export function OrgSummaryStyles() {
  return (
    <style>{`
      .org-summary { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px; }
      @media (max-width: 900px) { .org-summary { grid-template-columns: 1fr 1fr; } .org-summary > :first-child { grid-column: 1 / -1; } }
    `}</style>
  );
}
