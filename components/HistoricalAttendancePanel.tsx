"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccess } from "@/lib/useAccess";
import { isSuperAdminAccess } from "@/lib/superAdmin";
import { ApiClientError, getJson, postJson } from "@/lib/reportsClient";
import { bulkChangeGate, type BackupMetaRecord } from "@/lib/attendanceBackup";
import type { publicPlan } from "@/lib/historicalPlan";

type Plan = ReturnType<typeof publicPlan>;
type StoredBackup = BackupMetaRecord & { id: string; createdAtIso: string };
type InitResult = {
  projectId: string;
  perMonth: { month: string; created: number; skipped: number; corrected: number }[];
  totals: { created: number; skipped: number; corrected: number };
  usersCreated: number;
  leavesCreated: number;
};

const BRAND = "#3d6fa8";
const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

const ENV_STYLE = {
  production: { bg: "rgba(220,38,38,.12)", fg: "#dc2626", label: "PRODUCTION — real data, read-only here" },
  demo: { bg: "rgba(22,163,74,.12)", fg: "#15803d", label: "DEMO / TEST project" },
  unverified: { bg: "rgba(234,88,12,.14)", fg: "#c2410c", label: "UNVERIFIED project — treated as read-only" },
} as const;

// Super Admin only. Shows, for every employee and for July, August and
// September 2026: existing records, missing dates and the attendance
// percentage from REAL records. In a verified demo/test project it can also
// initialise synthetic history — after a preview, a verified backup and a
// typed confirmation. In production it never creates attendance.
export default function HistoricalAttendancePanel() {
  const { authReady, roleReady, role } = useAccess();
  const isSuperAdmin = isSuperAdminAccess(role);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(120);
  const [dialog, setDialog] = useState(false);
  const [result, setResult] = useState<InitResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await getJson<Plan>("/api/attendance/reports/historical-preview"));
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError && e.status === 403 ? "" : errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady || !roleReady || !isSuperAdmin) return;
    let cancelled = false;
    getJson<Plan>("/api/attendance/reports/historical-preview")
      .then((p) => !cancelled && setPlan(p))
      .catch((e) => !cancelled && setError(errText(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authReady, roleReady, isSuperAdmin]);

  const rows = useMemo(() => {
    if (!plan) return [];
    const needle = search.trim().toLowerCase();
    return plan.rows.filter(
      (r) =>
        (month === "all" || r.month === month) &&
        (!needle || `${r.name} ${r.employeeId} ${r.department}`.toLowerCase().includes(needle))
    );
  }, [plan, month, search]);

  if (!authReady || !roleReady || !isSuperAdmin) return null;

  const env = plan ? ENV_STYLE[plan.environment] : null;
  const demo = plan?.environment === "demo";

  const card: React.CSSProperties = {
    background: "var(--card-bg, #fff)",
    color: "var(--text-color, #111)",
    border: "1px solid var(--border-color, #eaf3ff)",
    borderRadius: 20,
    padding: "clamp(14px,2.5vw,24px)",
    marginBottom: 28,
    boxShadow: "0 8px 24px rgba(0,0,0,.05)",
  };
  const btn = (primary = false): React.CSSProperties => ({
    height: 40,
    padding: "0 16px",
    borderRadius: 12,
    border: primary ? "none" : "1px solid var(--border-color, #dbeafe)",
    background: primary ? BRAND : "var(--card-bg, #fff)",
    color: primary ? "#fff" : "var(--text-color, #111)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  });
  const th: React.CSSProperties = { textAlign: "left", padding: "9px 10px", fontSize: 11.5, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-muted,#64748b)", background: "var(--table-row-alt,#f8fafc)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 10px", borderTop: "1px solid var(--border-color,#eaf3ff)", verticalAlign: "top", fontSize: 14 };

  return (
    <section style={card} aria-label="Historical attendance">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🗓 Historical Attendance — Jul · Aug · Sep 2026</h2>
          <p style={{ margin: "6px 0 0", color: "var(--text-muted,#64748b)", fontSize: 14 }}>
            Super Admin only. Percentages use real records and eligible working days (weekly offs, holidays and approved leave excluded).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <button style={btn()} onClick={load} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>
          <a href="/admin/attendance-reports" style={{ ...btn(), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            Fix records (single or bulk) →
          </a>
          <button style={btn(true)} onClick={() => { setResult(null); setDialog(true); }} disabled={!plan}>
            Initialize Historical Attendance
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}

      {plan && env && (
        <div style={{ background: env.bg, color: env.fg, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 14 }}>
          <b>{env.label}</b> · Firebase project: <code>{plan.projectId}</code>
          {!demo && <div style={{ marginTop: 6 }}>{plan.blockedReason}</div>}
        </div>
      )}

      {plan && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 14 }}>
          {plan.months.map((m) => (
            <div key={m.month} style={{ border: "1px solid var(--border-color,#eaf3ff)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ fontWeight: 800 }}>{m.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted,#64748b)", marginTop: 4 }}>
                {m.employees} employees · {m.existingRecords} existing records
              </div>
              <div style={{ fontSize: 13, marginTop: 2, color: m.missingDates ? "#be123c" : "var(--text-muted,#64748b)" }}>
                {m.missingDates} missing dates
              </div>
              {demo && <div style={{ fontSize: 13, marginTop: 2, color: "#15803d" }}>{m.proposedNewRecords} would be created</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {[["all", "All months"], ...(plan?.months.map((m) => [m.month, m.label]) || [])].map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setMonth(k); setShown(120); }}
            aria-pressed={month === k}
            style={{ ...btn(month === k), height: 34, fontSize: 13 }}
          >
            {label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShown(120); }}
          placeholder="Search employee, ID or department"
          style={{ ...btn(), cursor: "text", fontWeight: 500, flex: 1, minWidth: 200 }}
          aria-label="Search employees"
        />
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted,#64748b)" }}>Loading from Firestore…</p>
      ) : !plan || rows.length === 0 ? (
        <p style={{ color: "var(--text-muted,#64748b)" }}>No employees match.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr>
                <th style={th}>Employee</th><th style={th}>Month</th><th style={th}>Records</th><th style={th}>Present</th><th style={th}>Absent</th>
                <th style={th}>Leave</th><th style={th}>Weekly offs / holidays</th><th style={th}>Eligible days</th><th style={th}>Attendance %</th>
                <th style={th}>Missing dates</th>{demo && <th style={th}>After initialization</th>}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((r) => {
                const key = `${r.uid}|${r.month}`;
                return (
                  <tr key={key}>
                    <td style={td}><b>{r.name}</b>{r.inactive ? <em style={{ color: "#dc2626", marginLeft: 6, fontSize: 11 }}>inactive</em> : null}<div style={{ fontSize: 12, color: "var(--text-muted,#64748b)" }}>{[r.employeeId && `ID ${r.employeeId}`, r.department].filter(Boolean).join(" · ")}</div></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{r.monthLabel}</td>
                    <td style={td}>{r.existingRecords}</td>
                    <td style={td}>{r.presentDays}</td>
                    <td style={td}>{r.absentDays}{r.incompleteDays ? <div style={{ fontSize: 11.5, color: "#c2410c" }}>+{r.incompleteDays} incomplete</div> : null}</td>
                    <td style={td}>{r.leaveDays}</td>
                    <td style={td}>{r.offDays}</td>
                    <td style={td}>{r.eligibleDays}</td>
                    <td style={td}><b>{r.percentage === null ? "n/a" : `${r.percentage}%`}</b></td>
                    <td style={td}>
                      {r.missingDates.length === 0 ? (
                        <span style={{ color: "var(--text-muted,#64748b)" }}>none</span>
                      ) : (
                        <>
                          <button onClick={() => setOpen(open === key ? null : key)} style={{ background: "none", border: "none", color: "#be123c", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                            {r.missingDates.length} {open === key ? "▴" : "▾"}
                          </button>
                          {open === key && <div style={{ fontSize: 12, marginTop: 4, maxWidth: 220, overflowWrap: "anywhere" }}>{r.missingDates.join(", ")}</div>}
                        </>
                      )}
                    </td>
                    {demo && (
                      <td style={td}>
                        {r.proposed ? (
                          <>
                            <b style={{ color: "#15803d" }}>{r.proposed.percentage === null ? "n/a" : `${r.proposed.percentage}%`}</b>
                            <div style={{ fontSize: 12, color: "var(--text-muted,#64748b)" }}>+{r.proposed.newRecords} records</div>
                          </>
                        ) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > shown && (
            <button style={{ ...btn(), marginTop: 12 }} onClick={() => setShown((n) => n + 200)}>Show more ({rows.length - shown} remaining)</button>
          )}
        </div>
      )}

      {!demo && plan && (
        <p style={{ marginTop: 14, fontSize: 14 }}>
          Missing dates are shown separately and are <b>not</b> counted as present. To fix a real record with evidence, use{" "}
          <a href="/admin/attendance-reports" style={{ color: BRAND, fontWeight: 700 }}>Attendance Reports → Audit</a>: correct one record, or tick many and
          correct them together (reason, original values, verified backup and an audit trail for every record).
        </p>
      )}

      {dialog && plan && (
        <InitializeDialog
          plan={plan}
          result={result}
          onClose={() => setDialog(false)}
          onDone={async (r) => {
            setResult(r);
            await load();
          }}
        />
      )}
    </section>
  );
}

function InitializeDialog({
  plan,
  result,
  onClose,
  onDone,
}: {
  plan: Plan;
  result: InitResult | null;
  onClose: () => void;
  onDone: (r: InitResult) => void | Promise<void>;
}) {
  const [backups, setBackups] = useState<StoredBackup[] | null>(null);
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJson<{ backups: StoredBackup[] }>("/api/attendance/reports/backups")
      .then((r) => !cancelled && setBackups(r.backups))
      .catch(() => !cancelled && setBackups([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const demo = plan.environment === "demo";
  const required = `INITIALIZE ${plan.projectId}`;
  const gate = backups
    ? bulkChangeGate(
        backups.map((b) => ({ backupId: b.backupId || b.id, createdAt: b.createdAtIso, verifiedAt: b.verifiedAt, range: b.range, count: b.count, sha256: b.sha256 })),
        plan.range
      )
    : { allowed: false, reason: "Checking backups…" };
  const ready = demo && gate.allowed && typed === required && ack && !busy && !result;

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await onDone(await postJson<InitResult>("/api/attendance/reports/historical-initialize", { confirm: typed }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 2000 };
  const modal: React.CSSProperties = { width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", background: "var(--card-bg,#fff)", color: "var(--text-color,#111)", borderRadius: 20, padding: 24, boxShadow: "0 30px 80px rgba(0,0,0,.35)" };

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Initialize historical attendance">
      <div style={modal}>
        <h2 style={{ marginTop: 0 }}>Initialize Historical Attendance</h2>

        {!demo ? (
          <>
            <p style={{ color: "#dc2626", fontWeight: 700 }}>This project is not a verified demo/test environment.</p>
            <p>{plan.blockedReason}</p>
            <p>
              Right now there {plan.months.reduce((n, m) => n + m.missingDates, 0) === 1 ? "is" : "are"}{" "}
              <b>{plan.months.reduce((n, m) => n + m.missingDates, 0)}</b> missing employee-days in the range. They are listed on the dashboard and are
              not counted as present.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={onClose} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #dbeafe", background: "transparent", fontWeight: 700, cursor: "pointer", color: "inherit" }}>Close</button>
              <a href="/admin/attendance-reports" style={{ height: 40, display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: 12, background: BRAND, color: "#fff", fontWeight: 700, textDecoration: "none" }}>
                Open Attendance Reports
              </a>
            </div>
          </>
        ) : result ? (
          <>
            <p style={{ color: "#15803d", fontWeight: 700 }}>✓ Done. The dashboard has refreshed from Firestore.</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr><th style={{ textAlign: "left" }}>Month</th><th>Created</th><th>Skipped (already existed)</th><th>Corrected</th></tr></thead>
              <tbody>
                {result.perMonth.map((m) => (
                  <tr key={m.month}><td>{m.month}</td><td style={{ textAlign: "center" }}>{m.created}</td><td style={{ textAlign: "center" }}>{m.skipped}</td><td style={{ textAlign: "center" }}>{m.corrected}</td></tr>
                ))}
                <tr style={{ fontWeight: 800 }}><td>Total</td><td style={{ textAlign: "center" }}>{result.totals.created}</td><td style={{ textAlign: "center" }}>{result.totals.skipped}</td><td style={{ textAlign: "center" }}>{result.totals.corrected}</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: 13, color: "var(--text-muted,#64748b)" }}>
              Also created: {result.leavesCreated} approved-leave records{result.usersCreated ? ` and ${result.usersCreated} demo employees` : ""}. Existing records were never changed. Running it again creates nothing.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #dbeafe", background: "transparent", fontWeight: 700, cursor: "pointer", color: "inherit" }}>Close</button>
              <button onClick={() => window.location.reload()} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Reload whole dashboard</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              Project <code>{plan.projectId}</code> is a verified demo/test environment. This will create <b>synthetic</b> attendance (flagged{" "}
              <code>isDemo</code>) for the days that have no record. Existing records are never touched.
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 12 }}>
              <thead><tr><th style={{ textAlign: "left" }}>Month</th><th>Employees</th><th>Existing (kept)</th><th>Missing now</th><th>Will create</th></tr></thead>
              <tbody>
                {plan.months.map((m) => (
                  <tr key={m.month}><td>{m.label}</td><td style={{ textAlign: "center" }}>{m.employees}</td><td style={{ textAlign: "center" }}>{m.existingRecords}</td><td style={{ textAlign: "center" }}>{m.missingDates}</td><td style={{ textAlign: "center" }}>{m.proposedNewRecords}</td></tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 13, color: "var(--text-muted,#64748b)" }}>
              Targets: August ≈ 80%, September ≈ 70%, July varied — every employee stays below 95%. Plus {plan.willCreateLeaves} approved-leave records
              {plan.willCreateUsers ? ` and ${plan.willCreateUsers} demo employees (this project has none yet)` : ""}.
            </p>

            <div style={{ padding: "10px 12px", borderRadius: 12, marginBottom: 12, background: gate.allowed ? "rgba(22,163,74,.12)" : "rgba(234,88,12,.12)", color: gate.allowed ? "#15803d" : "#c2410c", fontSize: 14 }}>
              <b>Backup:</b> {gate.allowed ? "a fresh, verified backup covers this range ✓" : gate.reason}{" "}
              {!gate.allowed && <a href="/admin/attendance-reports" style={{ color: "inherit", fontWeight: 700 }}>Create &amp; verify one →</a>}
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, marginBottom: 12 }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              I understand this writes synthetic records to <code>{plan.projectId}</code>, never overwrites existing records, and can be removed later.
            </label>

            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Type <code>{required}</code> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid var(--border-color,#dbeafe)", background: "var(--bg-color,#fff)", color: "inherit", boxSizing: "border-box" }}
              aria-label="Confirmation text"
            />

            {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={onClose} disabled={busy} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #dbeafe", background: "transparent", fontWeight: 700, cursor: "pointer", color: "inherit" }}>Cancel</button>
              <button onClick={run} disabled={!ready} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "none", background: ready ? BRAND : "#94a3b8", color: "#fff", fontWeight: 700, cursor: ready ? "pointer" : "not-allowed" }}>
                {busy ? "Writing…" : "Create records"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
