"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useReportingLine } from "@/lib/useReportingLine";
import { getManagerChain, type OrgIndex } from "@/lib/orgHierarchy";
import PersonAvatar from "./PersonAvatar";
import { OrgFlowChart } from "./OrgFlowChart";

const BRAND = "#3d6fa8";

// Employee/manager dashboard section. By design it shows ONLY the signed-in
// person and the management ABOVE them, as a top-down flow chart. No
// teammates, no subordinates and no company-wide chart — and the data layer
// (useReportingLine) never even loads those people into this browser. The
// full organisation chart lives in Admin -> Organization Hierarchy.
export default function OrgHierarchySection() {
  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u ? u.uid : null);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const { index, ready } = useReportingLine(uid);

  return <OrgHierarchyPanel index={index} currentUid={uid || ""} loading={!authChecked || !ready} />;
}

export function OrgHierarchyPanel({
  index,
  currentUid,
  loading,
}: {
  index: OrgIndex | null;
  currentUid: string;
  loading?: boolean;
}) {
  const me = index && currentUid ? index.byId.get(currentUid) : undefined;

  return (
    <section style={{ marginBottom: 35 }} aria-label="Reporting line">
      <h2 style={{ marginBottom: 20, color: "var(--text-color)", fontWeight: 700 }}>🏢 Organization Hierarchy</h2>

      <div
        style={{
          background: "var(--card-bg)",
          borderRadius: 22,
          padding: "clamp(16px, 3vw, 30px)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
        }}
      >
        {loading || !index ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Loading your reporting line…</p>
        ) : !me ? (
          <Notice tone="info">
            Your employee record could not be found yet. Complete your profile or contact HR if this persists.
          </Notice>
        ) : (
          <MyLine index={index} meUid={me.uid} />
        )}
      </div>
    </section>
  );
}

function MyLine({ index, meUid }: { index: OrgIndex; meUid: string }) {
  const me = index.byId.get(meUid)!;
  const chain = useMemo(() => getManagerChain(index, meUid), [index, meUid]);
  const manager = chain[0];
  const danglingId = index.danglingManager.get(meUid);
  const selfLoop = !!me.managerId && me.managerId === meUid;

  const rootId = chain.length ? chain[chain.length - 1].uid : meUid;
  const visibleIds = useMemo(() => new Set<string>([meUid, ...chain.map((p) => p.uid)]), [meUid, chain]);
  const forceOpen = visibleIds;

  return (
    <>
      <style>{`
        .org-summary { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 18px; }
        @media (max-width: 700px) { .org-summary { grid-template-columns: 1fr; } }
      `}</style>

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
              {danglingId ? "Manager record not found" : selfLoop ? "Invalid assignment" : "No manager assigned yet"}
            </span>
          )}
        </SummaryTile>
        <SummaryTile label="Your level">
          <strong style={{ fontSize: 22 }}>L{chain.length + 1}</strong>
          <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}> from the top</span>
        </SummaryTile>
      </div>

      {(danglingId || selfLoop) && (
        <Notice tone="warn">
          {selfLoop
            ? "Your reporting manager is set incorrectly. Please ask HR to fix it."
            : "Your assigned reporting manager’s record no longer exists. Please ask HR to assign a new manager."}
        </Notice>
      )}
      {!manager && !danglingId && !selfLoop && (
        <Notice tone="info">No reporting manager has been assigned to you yet. HR can assign one from the admin portal.</Notice>
      )}

      <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 800, letterSpacing: ".05em", color: "var(--text-muted)" }}>
        YOUR REPORTING LINE
      </p>
      <OrgFlowChart
        index={index}
        rootIds={[rootId]}
        expanded={forceOpen}
        onToggle={() => {}}
        currentUid={meUid}
        visibleIds={visibleIds}
        forceOpen={forceOpen}
        showToggle={false}
      />
    </>
  );
}

// Reporting chain for one person, top of the organization first:
// "CEO › Dept Manager › Employee". (Used by the admin Hierarchy page.)
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
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".05em", color: "var(--text-muted)" }}>REPORTING CHAIN</span>
      {ordered.length === 0 && (
        <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{person.name} is at the top of their reporting line</span>
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
    <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--hover-bg)", border: "1px solid var(--border-color)", minWidth: 0 }}>
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
