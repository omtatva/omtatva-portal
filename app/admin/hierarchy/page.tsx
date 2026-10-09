"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AccessRestricted from "@/components/AccessRestricted";
import PersonAvatar from "@/components/PersonAvatar";
import PersonPicker from "@/components/PersonPicker";
import { OrgFlowChart, ancestorsOf, useTreeExpansion } from "@/components/OrgFlowChart";
import { ChainBar } from "@/components/OrgHierarchySection";
import { useAccess } from "@/lib/useAccess";
import { usePermission } from "@/lib/usePermission";
import { useOrgChart } from "@/lib/useOrgChart";
import { AssignmentError, assignManager } from "@/lib/reportingStructure";
import {
  getDescendantIds,
  getDirectReports,
  matchesQuery,
  validateAssignment,
  type OrgPerson,
} from "@/lib/orgHierarchy";

const BRAND = "#3d6fa8";

type Message = { type: "success" | "error"; text: string } | null;
type View = "employees" | "teams" | "chart";

export default function AdminHierarchyPage() {
  const { authUser, authReady, roleReady, isAdminTier } = useAccess();
  const { canEdit } = usePermission("users");
  const { index, ready, relationsError } = useOrgChart();

  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  // undefined = nothing chosen yet, "" = explicitly "no manager".
  const [rawManagerChoice, setManagerChoice] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const [view, setView] = useState<View>("employees");
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authReady && !authUser) window.location.href = "/admin/login";
  }, [authReady, authUser]);

  const sorted = useMemo(
    () => [...index.people].sort((a, b) => a.name.localeCompare(b.name)),
    [index.people]
  );

  // A chosen manager whose record vanished live (deleted) counts as unchosen.
  const managerChoice =
    rawManagerChoice && !index.byId.has(rawManagerChoice) ? undefined : rawManagerChoice;

  const selectedPeople = employeeIds
    .map((id) => index.byId.get(id))
    .filter((p): p is OrgPerson => !!p);

  // Manager rows that must be disabled for the current employee selection:
  // the employees themselves and anyone beneath them (assigning those
  // would close a loop), plus inactive people.
  const managerBlocked = useMemo(() => {
    const blocked = new Map<string, string>();
    for (const emp of selectedPeople) {
      blocked.set(emp.uid, "Cannot be their own manager");
      getDescendantIds(index, emp.uid).forEach((id) => {
        if (!blocked.has(id)) blocked.set(id, `Reports to ${emp.name} — would create a loop`);
      });
    }
    return blocked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, employeeIds]);

  const managerReason = (p: OrgPerson) =>
    managerBlocked.get(p.uid) || (p.active ? undefined : "Inactive — cannot manage a team");

  const targetManager = managerChoice ? index.byId.get(managerChoice) : undefined;

  const changes = selectedPeople.filter((p) => (p.managerId || "") !== (managerChoice ?? p.managerId));
  const canSave =
    canEdit && !saving && selectedPeople.length > 0 && managerChoice !== undefined && changes.length > 0;

  const selectEmployee = (uid: string, additive = false) => {
    setMessage(null);
    setEmployeeIds((prev) =>
      additive ? (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]) : [uid]
    );
    if (!additive) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = async () => {
    if (!canSave || managerChoice === undefined) return;
    setSaving(true);
    setMessage(null);

    const failures: string[] = [];
    let done = 0;

    for (const emp of changes) {
      const check = validateAssignment(index, emp.uid, managerChoice);
      if (!check.ok) {
        failures.push(`${emp.name}: ${check.reason}`);
        continue;
      }
      try {
        await assignManager(emp.uid, managerChoice, {
          employee: emp.name,
          employeeEmail: emp.email,
          manager: targetManager?.name,
        });
        done++;
      } catch (error) {
        console.error("ASSIGN MANAGER ERROR:", error);
        const code = (error as { code?: string })?.code;
        failures.push(
          `${emp.name}: ${
            error instanceof AssignmentError
              ? error.message
              : code === "permission-denied"
              ? "You do not have permission to change reporting managers."
              : "Could not save — please try again."
          }`
        );
      }
    }

    setSaving(false);

    if (failures.length === 0) {
      setMessage({
        type: "success",
        text: targetManager
          ? `${done} employee${done === 1 ? "" : "s"} now report${done === 1 ? "s" : ""} to ${targetManager.name}.`
          : `Reporting manager removed for ${done} employee${done === 1 ? "" : "s"}.`,
      });
      setManagerChoice(undefined);
    } else {
      setMessage({
        type: "error",
        text: `${done ? `${done} saved. ` : ""}${failures.join(" ")}`,
      });
    }
  };

  const rows = useMemo(() => {
    return sorted.filter((p) => {
      if (unassignedOnly && p.managerId && index.byId.has(p.managerId)) return false;
      return !search.trim() || matchesQuery(p, search);
    });
  }, [sorted, search, unassignedOnly, index]);

  const { expanded, toggle, expandMany, collapseAll } = useTreeExpansion();
  const [chartQuery, setChartQuery] = useState("");

  const chartMatch = useMemo(() => {
    if (!chartQuery.trim()) return null;
    const matches = new Set<string>();
    const visible = new Set<string>();
    const open = new Set<string>();
    for (const p of index.people) {
      if (matchesQuery(p, chartQuery)) {
        matches.add(p.uid);
        visible.add(p.uid);
        ancestorsOf(index, p.uid).forEach((a) => {
          visible.add(a);
          open.add(a);
        });
      }
    }
    return { matches, visible, open };
  }, [index, chartQuery]);

  if (!authReady || !roleReady) {
    return <div style={{ padding: 30, color: "var(--text-muted)" }}>Loading…</div>;
  }
  if (!authUser) return null;
  if (!isAdminTier) {
    return <AccessRestricted message="Only administrators can manage the organization hierarchy." />;
  }

  const managers = index.people.filter((p) => (index.children.get(p.uid) || []).length > 0);
  const assigned = index.people.filter((p) => p.managerId && index.byId.has(p.managerId) && p.managerId !== p.uid);
  const problems = index.people.filter(
    (p) => index.danglingManager.has(p.uid) || index.cyclic.has(p.uid) || p.managerId === p.uid
  );

  return (
    <div className="hier-page">
      <HierarchyStyles />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, color: "var(--text-color)" }}>
            🧭 Organization Hierarchy
          </h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 15.5 }}>
            Decide who reports to whom. Changes appear instantly on every employee and manager dashboard.
          </p>
        </div>
        <a href="/admin" className="hier-btn hier-btn-dark">
          ← Dashboard
        </a>
      </div>

      {relationsError && <Banner tone="error">{relationsError}</Banner>}
      {!canEdit && (
        <Banner tone="info">
          View only — your role does not have edit access to Employee Management, so reporting managers can’t be changed.
        </Banner>
      )}

      {/* ---------- Stats ---------- */}
      <div className="hier-stats">
        <Stat label="People" value={index.people.length} />
        <Stat label="Have a manager" value={assigned.length} />
        <Stat label="No manager" value={index.people.length - assigned.length} />
        <Stat label="Managers" value={managers.length} />
      </div>

      {problems.length > 0 && (
        <Banner tone="warn">
          <strong>Needs attention:</strong>{" "}
          {problems.map((p, i) => (
            <span key={p.uid}>
              {i > 0 && ", "}
              <button type="button" className="hier-link" onClick={() => selectEmployee(p.uid)}>
                {p.name}
              </button>{" "}
              (
              {index.cyclic.has(p.uid)
                ? "circular reporting"
                : p.managerId === p.uid
                ? "reports to themself"
                : "manager record missing"}
              )
            </span>
          ))}
          . Pick a new manager for them below.
        </Banner>
      )}

      {/* ---------- Assignment form ---------- */}
      <div ref={formRef} className="hier-card" style={{ scrollMarginTop: 16 }}>
        <h2 className="hier-h2">Assign reporting manager</h2>

        <div className="hier-form-grid">
          <div>
            <label className="hier-label">
              Employee{employeeIds.length > 1 ? `s (${employeeIds.length})` : ""}
            </label>
            <PersonPicker
              multiple
              options={sorted}
              selected={employeeIds}
              onChange={(ids) => {
                setMessage(null);
                setEmployeeIds(ids);
              }}
              placeholder="Search and select one or more employees…"
              ariaLabel="Select employees"
              disabled={!ready}
            />
            <p className="hier-hint">Select several to put them all under the same manager.</p>
          </div>

          <div>
            <label className="hier-label">Reporting manager</label>
            <PersonPicker
              options={sorted}
              selected={managerChoice ? [managerChoice] : []}
              onChange={(ids) => {
                setMessage(null);
                setManagerChoice(ids[0] ?? "");
              }}
              placeholder={
                managerChoice === "" ? "No manager (top level)" : "Search and choose a manager…"
              }
              clearLabel="No manager (top level)"
              disabledReason={managerReason}
              disabled={!ready || !canEdit || selectedPeople.length === 0}
              ariaLabel="Select reporting manager"
            />
            <p className="hier-hint">
              {selectedPeople.length === 0
                ? "Choose at least one employee first."
                : "People who would create a reporting loop are greyed out."}
            </p>
          </div>
        </div>

        {selectedPeople.length > 0 && (
          <div className="hier-current">
            <div className="hier-label" style={{ marginBottom: 8 }}>
              Current setup
            </div>
            {selectedPeople.map((p) => {
              const mgr = p.managerId ? index.byId.get(p.managerId) : undefined;
              const reports = getDirectReports(index, p.uid);
              return (
                <div key={p.uid} className="hier-current-row">
                  <PersonAvatar name={p.name} photo={p.photo} gender={p.gender} size={34} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{p.name}</div>
                    <div className="hier-sub">
                      Reports to:{" "}
                      {mgr ? (
                        <strong>{mgr.name}</strong>
                      ) : p.managerId ? (
                        <span style={{ color: "#c2410c" }}>manager record missing</span>
                      ) : (
                        "— nobody"
                      )}
                      {" · "}
                      {reports.length} direct report{reports.length === 1 ? "" : "s"}
                      {reports.length > 0 && <>: {reports.map((r) => r.name).join(", ")}</>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 18 }}>
          <button
            type="button"
            className="hier-btn hier-btn-primary"
            onClick={save}
            disabled={!canSave}
            title={canEdit ? undefined : "View only — no edit access for Employee Management"}
          >
            {saving
              ? "Saving…"
              : managerChoice === ""
              ? "Remove reporting manager"
              : "Save reporting manager"}
          </button>
          {selectedPeople.length > 0 && managerChoice !== undefined && changes.length === 0 && (
            <span className="hier-hint" style={{ margin: 0 }}>
              Already set this way — nothing to change.
            </span>
          )}
        </div>

        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 12,
              fontSize: 14.5,
              fontWeight: 600,
              background: message.type === "success" ? "rgba(22,163,74,.12)" : "rgba(220,38,38,.12)",
              color: message.type === "success" ? "#15803d" : "#dc2626",
              border: `1px solid ${message.type === "success" ? "rgba(22,163,74,.35)" : "rgba(220,38,38,.35)"}`,
            }}
          >
            {message.type === "success" ? "✓ " : "⚠ "}
            {message.text}
          </div>
        )}
      </div>

      {/* ---------- Views ---------- */}
      <div className="hier-card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {(
            [
              ["employees", "All employees"],
              ["teams", "Teams"],
              ["chart", "Org chart"],
            ] as [View, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className="hier-tab"
              data-active={view === key}
            >
              {label}
            </button>
          ))}
        </div>

        {!ready ? (
          <p style={{ color: "var(--text-muted)" }}>Loading employees…</p>
        ) : view === "employees" ? (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <input
                type="search"
                className="hier-input"
                placeholder="Search by name, email, ID, designation, department…"
                aria-label="Search employees"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-color)" }}>
                <input
                  type="checkbox"
                  checked={unassignedOnly}
                  onChange={(e) => setUnassignedOnly(e.target.checked)}
                />
                Without a manager only
              </label>
            </div>

            <div className="hier-table" role="table" aria-label="Employees and their reporting managers">
              <div className="hier-row hier-row-head" role="row">
                <span role="columnheader" />
                <span role="columnheader">Employee</span>
                <span role="columnheader">Reports to</span>
                <span role="columnheader">Team</span>
              </div>
              {rows.length === 0 && (
                <div style={{ padding: 18, color: "var(--text-muted)" }}>No employees match.</div>
              )}
              {rows.map((p) => {
                const mgr = p.managerId ? index.byId.get(p.managerId) : undefined;
                const reports = getDirectReports(index, p.uid);
                const checked = employeeIds.includes(p.uid);
                return (
                  <div
                    key={p.uid}
                    role="row"
                    className="hier-row"
                    data-checked={checked}
                    onClick={() => selectEmployee(p.uid)}
                  >
                    <span role="cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.name}`}
                        checked={checked}
                        onChange={() => selectEmployee(p.uid, true)}
                      />
                    </span>
                    <span role="cell" className="hier-cell-person">
                      <PersonAvatar name={p.name} photo={p.photo} gender={p.gender} size={40} />
                      <span style={{ minWidth: 0 }}>
                        <span className="hier-name">
                          {p.name}
                          {!p.active && <em className="hier-off">Inactive</em>}
                        </span>
                        <span className="hier-sub">
                          {[p.designation || "No designation", p.department, p.role].filter(Boolean).join(" • ")}
                        </span>
                      </span>
                    </span>
                    <span role="cell" className="hier-cell-person">
                      {mgr ? (
                        <>
                          <PersonAvatar name={mgr.name} photo={mgr.photo} gender={mgr.gender} size={30} />
                          <span style={{ minWidth: 0 }}>
                            <span className="hier-name">{mgr.name}</span>
                            <span className="hier-sub">{mgr.designation}</span>
                          </span>
                        </>
                      ) : p.managerId ? (
                        <span style={{ color: "#c2410c", fontSize: 13.5 }}>Manager record missing</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 13.5 }}>— Not assigned</span>
                      )}
                    </span>
                    <span role="cell" className="hier-sub" title={reports.map((r) => r.name).join(", ")}>
                      {reports.length ? `${reports.length} report${reports.length === 1 ? "" : "s"}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : view === "teams" ? (
          <TeamsView
            people={sorted}
            childrenOf={(uid) => getDirectReports(index, uid)}
            onPick={(uid) => selectEmployee(uid)}
            unassigned={sorted.filter((p) => !p.managerId || !index.byId.has(p.managerId))}
          />
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input
                type="search"
                className="hier-input"
                placeholder="Search the org chart…"
                aria-label="Search the org chart"
                value={chartQuery}
                onChange={(e) => setChartQuery(e.target.value)}
              />
              <button
                type="button"
                className="hier-btn hier-btn-ghost"
                onClick={() =>
                  expandMany(index.people.filter((p) => (index.children.get(p.uid) || []).length).map((p) => p.uid))
                }
              >
                Expand all
              </button>
              <button type="button" className="hier-btn hier-btn-ghost" onClick={collapseAll}>
                Collapse all
              </button>
            </div>
            <p className="hier-hint" style={{ marginTop: 0 }}>
              Click a person to load them into the form above.
            </p>
            {employeeIds.length === 1 && <ChainBar index={index} uid={employeeIds[0]} />}
            <OrgFlowChart
              index={index}
              rootIds={index.roots}
              expanded={expanded}
              onToggle={toggle}
              selectedId={employeeIds.length === 1 ? employeeIds[0] : undefined}
              onSelect={(uid) => selectEmployee(uid)}
              matchIds={chartMatch?.matches}
              visibleIds={chartMatch?.visible}
              forceOpen={chartMatch?.open}
            />
          </>
        )}
      </div>
    </div>
  );
}

function TeamsView({
  people,
  childrenOf,
  onPick,
  unassigned,
}: {
  people: OrgPerson[];
  childrenOf: (uid: string) => OrgPerson[];
  onPick: (uid: string) => void;
  unassigned: OrgPerson[];
}) {
  const managers = people
    .map((p) => ({ p, reports: childrenOf(p.uid) }))
    .filter((m) => m.reports.length > 0)
    .sort((a, b) => b.reports.length - a.reports.length || a.p.name.localeCompare(b.p.name));

  return (
    <div className="hier-teams">
      {managers.length === 0 && (
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          No reporting relationships yet. Assign a manager above to create the first team.
        </p>
      )}
      {managers.map(({ p, reports }) => (
        <div key={p.uid} className="hier-team">
          <button type="button" className="hier-team-head" onClick={() => onPick(p.uid)}>
            <PersonAvatar name={p.name} photo={p.photo} gender={p.gender} size={46} />
            <span style={{ minWidth: 0, textAlign: "left" }}>
              <span className="hier-name">{p.name}</span>
              <span className="hier-sub">
                {[p.designation || "No designation", p.department].filter(Boolean).join(" • ")}
              </span>
            </span>
            <span className="hier-count">{reports.length}</span>
          </button>
          <div className="hier-team-members">
            {reports.map((r) => (
              <button key={r.uid} type="button" className="hier-chip" onClick={() => onPick(r.uid)}>
                <PersonAvatar name={r.name} photo={r.photo} gender={r.gender} size={26} />
                <span>
                  {r.name}
                  <small>{r.designation}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {unassigned.length > 0 && (
        <div className="hier-team" style={{ borderStyle: "dashed" }}>
          <div className="hier-team-head" style={{ cursor: "default" }}>
            <span className="hier-name">No reporting manager ({unassigned.length})</span>
          </div>
          <div className="hier-team-members">
            {unassigned.map((r) => (
              <button key={r.uid} type="button" className="hier-chip" onClick={() => onPick(r.uid)}>
                <PersonAvatar name={r.name} photo={r.photo} gender={r.gender} size={26} />
                <span>
                  {r.name}
                  <small>{r.designation}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="hier-stat">
      <div className="hier-stat-value">{value}</div>
      <div className="hier-stat-label">{label}</div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "info" | "warn" | "error"; children: React.ReactNode }) {
  const colors = {
    info: ["rgba(61,111,168,.12)", BRAND, "rgba(61,111,168,.3)"],
    warn: ["rgba(234,88,12,.12)", "#c2410c", "rgba(234,88,12,.35)"],
    error: ["rgba(220,38,38,.12)", "#dc2626", "rgba(220,38,38,.35)"],
  }[tone];
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        marginBottom: 18,
        fontSize: 14,
        background: colors[0],
        color: colors[1],
        border: `1px solid ${colors[2]}`,
      }}
    >
      {children}
    </div>
  );
}

function HierarchyStyles() {
  return (
    <style>{`
      .hier-page { max-width: 1100px; margin: 0 auto; padding: 8px 4px 40px; color: var(--text-color); }
      .hier-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 20px; padding: clamp(16px, 3vw, 28px); margin-bottom: 22px; box-shadow: 0 10px 30px rgba(0,0,0,.05); }
      .hier-h2 { margin: 0 0 18px; font-size: 20px; font-weight: 800; }
      .hier-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .hier-label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: var(--text-color); }
      .hier-hint { margin: 8px 0 0; font-size: 12.5px; color: var(--text-muted); }
      .hier-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
      .hier-stat { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 16px 18px; }
      .hier-stat-value { font-size: 28px; font-weight: 800; color: ${BRAND}; }
      .hier-stat-label { font-size: 13px; color: var(--text-muted); font-weight: 600; }
      .hier-btn { display: inline-flex; align-items: center; justify-content: center; height: 44px; padding: 0 22px; border-radius: 12px; border: 1px solid transparent; font-weight: 700; font-size: 14.5px; cursor: pointer; text-decoration: none; }
      .hier-btn:disabled { opacity: .5; cursor: not-allowed; }
      .hier-btn-primary { background: ${BRAND}; color: #fff; }
      .hier-btn-dark { background: #111827; color: #fff; }
      .hier-btn-ghost { background: var(--card-bg); color: var(--text-color); border-color: var(--border-color); height: 42px; }
      .hier-input { flex: 1 1 260px; min-width: 0; height: 42px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); font-size: 14px; box-sizing: border-box; }
      .hier-link { background: none; border: none; padding: 0; color: inherit; font: inherit; font-weight: 800; text-decoration: underline; cursor: pointer; }
      .hier-tab { padding: 9px 18px; border-radius: 999px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-color); font-weight: 700; font-size: 14px; cursor: pointer; }
      .hier-tab[data-active="true"] { background: ${BRAND}; color: #fff; border-color: ${BRAND}; }

      .hier-current { margin-top: 18px; padding: 14px 16px; border-radius: 14px; background: var(--hover-bg); border: 1px solid var(--border-color); }
      .hier-current-row { display: flex; gap: 12px; align-items: center; padding: 6px 0; }
      .hier-name { display: block; font-weight: 700; font-size: 14.5px; overflow-wrap: anywhere; }
      .hier-sub { display: block; font-size: 12.5px; color: var(--text-muted); overflow-wrap: anywhere; }
      .hier-off { margin-left: 8px; font-style: normal; font-size: 11px; font-weight: 800; color: #dc2626; }

      .hier-table { border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; }
      .hier-row { display: grid; grid-template-columns: 34px 1.5fr 1.2fr 90px; gap: 12px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--border-color); cursor: pointer; }
      .hier-row:first-child { border-top: none; }
      .hier-row:hover { background: var(--hover-bg); }
      .hier-row[data-checked="true"] { background: rgba(61,111,168,.1); }
      .hier-row-head { cursor: default; font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text-muted); background: var(--table-row-alt); }
      .hier-row-head:hover { background: var(--table-row-alt); }
      .hier-cell-person { display: flex; align-items: center; gap: 10px; min-width: 0; }

      .hier-teams { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
      .hier-team { border: 1px solid var(--border-color); border-radius: 16px; padding: 14px; background: var(--bg-color); }
      .hier-team-head { display: flex; align-items: center; gap: 12px; width: 100%; border: none; background: transparent; padding: 0 0 12px; color: var(--text-color); cursor: pointer; }
      .hier-count { margin-left: auto; min-width: 28px; height: 28px; border-radius: 999px; background: ${BRAND}; color: #fff; font-weight: 800; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; }
      .hier-team-members { display: flex; flex-wrap: wrap; gap: 8px; }
      .hier-chip { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 5px; border-radius: 999px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-color); font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; }
      .hier-chip small { display: block; font-weight: 500; font-size: 11.5px; color: var(--text-muted); }
      .hier-chip:hover { border-color: ${BRAND}; }

      @media (max-width: 800px) {
        .hier-form-grid { grid-template-columns: 1fr; }
        .hier-stats { grid-template-columns: 1fr 1fr; }
        .hier-row { grid-template-columns: 28px 1fr; row-gap: 8px; }
        .hier-row > :nth-child(3) { grid-column: 2; }
        .hier-row > :nth-child(4) { grid-column: 2; }
        .hier-row-head { display: none; }
      }
    `}</style>
  );
}
