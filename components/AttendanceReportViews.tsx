"use client";

import { Fragment, useState } from "react";
import { auth } from "@/lib/firebase";
import { KIND_LABEL, type AttendanceRecord, type DayKind, type EmployeeReport, type ReportDay } from "@/lib/attendanceReport";
import {
  CORRECTION_STATUSES,
  diffChanges,
  validateCorrection,
  type CorrectionRequest,
  type RecordValues,
} from "@/lib/attendanceCorrection";
import { localDateString, zonedWallTimeToInstant } from "@/lib/attendancePolicy";

export const BRAND = "#3d6fa8";
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const KIND_COLORS: Record<DayKind, [string, string]> = {
  present: ["rgba(22,163,74,.14)", "#15803d"],
  late: ["rgba(234,179,8,.18)", "#a16207"],
  absent: ["rgba(220,38,38,.14)", "#dc2626"],
  incomplete: ["rgba(234,88,12,.15)", "#c2410c"],
  leave: ["rgba(61,111,168,.16)", BRAND],
  holiday: ["rgba(124,58,237,.14)", "#7c3aed"],
  "weekly-off": ["rgba(100,116,139,.18)", "#64748b"],
  "no-record": ["rgba(244,63,94,.12)", "#be123c"],
  upcoming: ["rgba(148,163,184,.18)", "#64748b"],
  other: ["rgba(100,116,139,.18)", "#475569"],
};

export const FLAG_TEXT: Record<string, string> = {
  "duplicate-records": "Duplicate records",
  "worked-on-off-day": "Worked on an off day",
  "absent-with-punch": "Absent although punched in",
  "absent-on-holiday": "Auto-Absent on a holiday",
  "absent-on-leave": "Auto-Absent on approved leave",
  "absent-on-weekly-off": "Auto-Absent on a weekly off",
  "auto-marked": "Auto-marked (not a real punch)",
  "present-without-punch": "Present with no punch times",
};

// =====================================================================
// Employee daily detail
// =====================================================================
export function EmployeeDetail({
  report,
  fmtTime,
  canEdit,
  onCorrect,
  onBack,
}: {
  report: EmployeeReport;
  tz: string;
  fmtTime: (d: Date | null) => string;
  canEdit: boolean;
  onCorrect: (d: ReportDay) => void;
  onBack: () => void;
}) {
  const c = report.summary.counts;
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const emp = report.employee;

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <button className="ar-btn ar-ghost ar-small" onClick={onBack}>← All employees</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            {emp.name}
            {emp.employeeId ? <span className="ar-sub"> · ID {emp.employeeId}</span> : null}
          </h2>
          <div className="ar-sub">{[emp.department, emp.designation].filter(Boolean).join(" · ") || "No department / designation on file"}</div>
        </div>
      </div>
      <div className="ar-stats">
        <Stat label="Attendance" value={report.summary.percentage === null ? "n/a" : `${report.summary.percentage}%`} tone={BRAND} />
        <Stat label="Present" value={c.present + c.late} tone="#15803d" />
        <Stat label="Absent" value={c.absent} tone="#dc2626" />
        <Stat label="Approved leave" value={c.leave} />
        <Stat label="Holidays" value={c.holiday} />
        <Stat label="Weekly offs" value={c["weekly-off"]} />
        <Stat label="No record" value={c["no-record"]} tone={c["no-record"] ? "#be123c" : undefined} />
      </div>

      <div className="ar-scroll" style={{ marginTop: 16 }}>
        <table className="ar-table">
          <thead>
            <tr><th>Date</th><th>Status</th><th>Shift</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th>Source</th><th /></tr>
          </thead>
          <tbody>
            {report.days.map((d) => {
              const r = d.record;
              const correctable = canEdit && d.kind !== "upcoming";
              const history = (Array.isArray(r?.raw.statusHistory) ? (r?.raw.statusHistory as HistoryEntry[]) : []).filter(
                (h) => h.type === "correction" || h.type === "revert"
              );
              return (
                <Fragment key={d.date}>
                  <tr>
                    <td style={{ whiteSpace: "nowrap" }}>{d.date} <span className="ar-sub">{WEEKDAYS[d.weekday]}</span></td>
                    <td>
                      <Badge kind={d.kind} label={d.label} />
                      {d.flags.map((f) => (
                        <div key={f} className="ar-flag">⚠ {FLAG_TEXT[f] || f}</div>
                      ))}
                      {r && r.correctionCount > 0 && (
                        <button className="ar-link ar-sub" onClick={() => setOpenHistory(openHistory === d.date ? null : d.date)}>
                          ✎ corrected {r.correctionCount}× {openHistory === d.date ? "▴" : "▾"}
                        </button>
                      )}
                    </td>
                    <td>{d.shiftName}<div className="ar-sub">{d.shiftTimes}</div></td>
                    <td>{fmtTime(r?.punchIn || null)}</td>
                    <td>{fmtTime(r?.punchOut || null)}</td>
                    <td>{r?.totalHours ? r.totalHours : "—"}</td>
                    <td className="ar-sub">{r ? (r.isDemo ? "DEMO" : r.source || "—") : "—"}</td>
                    <td>
                      {correctable && (
                        <button className="ar-btn ar-ghost ar-small" onClick={() => onCorrect(d)}>
                          {r ? "Correct" : "Add record"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {openHistory === d.date && history.length > 0 && (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--hover-bg)" }}>
                        {history.map((h, i) => (
                          <div key={i} className="ar-sub" style={{ padding: "3px 0" }}>
                            <b>{h.type === "revert" ? "Reverted" : "Corrected"}</b> {h.from ?? "—"} → <b>{h.to ?? "—"}</b> by {h.by || "—"}
                            {h.at ? ` on ${h.at.slice(0, 16).replace("T", " ")} UTC` : ""} — {h.reason}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

type HistoryEntry = { type?: string; from?: string | null; to?: string | null; by?: string; at?: string | null; reason?: string };

// =====================================================================
// Correction modal
// =====================================================================
export type ModalTarget =
  | { mode: "update"; record: AttendanceRecord; employeeName: string; date: string; proposedStatus: string | null }
  | { mode: "create"; userId: string; employeeName: string; date: string; proposedStatus: string | null };

function toLocalInput(d: Date | null, tz: string): string {
  if (!d) return "";
  const date = localDateString(d, tz);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${date}T${time}`;
}

function fromLocalInput(value: string, tz: string): string | null {
  if (!value) return null;
  const [date, time] = value.split("T");
  if (!date || !time) return null;
  return zonedWallTimeToInstant(date, time, tz).toISOString();
}

export async function postCorrection(body: CorrectionRequest): Promise<{ correctionId: string }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("You are signed out. Please sign in again.");
  const res = await fetch("/api/attendance/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let data: { error?: { message?: string } } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(data?.error?.message || "The correction could not be saved.");
  return data as unknown as { correctionId: string };
}

export function CorrectionModal({
  target,
  tz,
  onClose,
  onDone,
}: {
  target: ModalTarget;
  tz: string;
  onClose: () => void;
  onDone: (message: string) => void | Promise<void>;
}) {
  const rec = target.mode === "update" ? target.record : null;

  const before: RecordValues = {
    status: rec?.status || "",
    punchIn: rec?.punchIn || null,
    punchOut: rec?.punchOut || null,
    totalHours: rec?.totalHours || 0,
  };

  const [status, setStatus] = useState<string>(target.proposedStatus || rec?.status || "");
  const [punchIn, setPunchIn] = useState(toLocalInput(before.punchIn, tz));
  const [punchOut, setPunchOut] = useState(toLocalInput(before.punchOut, tz));
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const request: CorrectionRequest = {
    kind: target.mode,
    recordId: rec?.id,
    userId: target.mode === "create" ? target.userId : undefined,
    date: target.mode === "create" ? target.date : undefined,
    reason,
    confirmVerified: verified,
    changes: {
      status: status || undefined,
      punchIn: fromLocalInput(punchIn, tz),
      punchOut: fromLocalInput(punchOut, tz),
    },
  };

  const today = localDateString(new Date(), tz);
  const validation = validateCorrection(request, { today });
  const preview = target.mode === "update" ? diffChanges(before, request.changes || {}).list : [];

  const submit = async () => {
    if (!validation.ok) return;
    setSaving(true);
    setError("");
    try {
      await postCorrection(request);
      await onDone(`Correction saved for ${target.employeeName} (${target.date}). It is recorded in the corrections log.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "string" && v.includes("T") ? toLocalInput(new Date(v), tz).replace("T", " ") : String(v));

  return (
    <div className="ar-overlay" role="dialog" aria-modal="true" aria-label="Correct attendance">
      <div className="ar-modal">
        <h2 style={{ margin: "0 0 4px" }}>{target.mode === "create" ? "Add attendance record" : "Correct attendance"}</h2>
        <p className="ar-sub" style={{ marginTop: 0 }}>
          {target.employeeName} · {target.date} · times in {tz}. The original values are kept in the corrections log.
        </p>

        {target.mode === "update" && (
          <div className="ar-orig">
            <b>Original:</b> status <b>{before.status || "—"}</b> · in {before.punchIn ? toLocalInput(before.punchIn, tz).replace("T", " ") : "—"} · out{" "}
            {before.punchOut ? toLocalInput(before.punchOut, tz).replace("T", " ") : "—"}
          </div>
        )}

        <div className="ar-form">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{target.mode === "create" ? "Choose…" : "(unchanged)"}</option>
              {CORRECTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Punch in
            <input type="datetime-local" value={punchIn} onChange={(e) => setPunchIn(e.target.value)} />
          </label>
          <label>
            Punch out
            <input type="datetime-local" value={punchOut} onChange={(e) => setPunchOut(e.target.value)} />
          </label>
        </div>

        <label className="ar-block">
          Reason (required, at least 10 characters)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="What evidence confirms this? e.g. 'Door-access log shows entry 09:05; manager confirmed by email.'" />
        </label>

        <label className="ar-check">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          I have verified this attendance. (Required to mark someone Present.)
        </label>

        {preview.length > 0 && (
          <div className="ar-preview">
            <b>Changes</b>
            {preview.map((c) => (
              <div key={c.field}>{c.field}: <s>{fmt(c.from)}</s> → <b>{fmt(c.to)}</b></div>
            ))}
          </div>
        )}

        {!validation.ok && reason.length + (status ? 1 : 0) > 0 && (
          <ul className="ar-errors">{validation.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        {error && <div className="ar-errors" role="alert">{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="ar-btn ar-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="ar-btn ar-primary" onClick={submit} disabled={!validation.ok || saving}>
            {saving ? "Saving…" : "Save correction"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Small UI pieces
// =====================================================================
export function Badge({ kind, label }: { kind: DayKind; label: string }) {
  const [bg, fg] = KIND_COLORS[kind];
  return <span className="ar-badge" style={{ background: bg, color: fg }}>{label || KIND_LABEL[kind]}</span>;
}

export function SeverityPill({ s }: { s: "high" | "medium" | "low" }) {
  const map = { high: ["rgba(220,38,38,.14)", "#dc2626"], medium: ["rgba(234,88,12,.15)", "#c2410c"], low: ["rgba(100,116,139,.18)", "#475569"] }[s];
  return <span className="ar-badge" style={{ background: map[0], color: map[1], textTransform: "capitalize" }}>{s}</span>;
}

export function PercentBar({ value }: { value: number | null }) {
  if (value === null) return <span className="ar-sub">n/a</span>;
  const color = value >= 90 ? "#16a34a" : value >= 75 ? "#ca8a04" : "#dc2626";
  return (
    <div style={{ minWidth: 110 }}>
      <b>{value}%</b>
      <div style={{ height: 6, borderRadius: 4, background: "var(--border-color)", marginTop: 4 }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", borderRadius: 4, background: color }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="ar-stat">
      <div className="ar-stat-value" style={{ color: tone || "var(--text-color)" }}>{value}</div>
      <div className="ar-sub">{label}</div>
    </div>
  );
}

export function Banner({ tone, children }: { tone: "ok" | "err" | "info"; children: React.ReactNode }) {
  const c = { ok: ["rgba(22,163,74,.12)", "#15803d"], err: ["rgba(220,38,38,.12)", "#dc2626"], info: ["rgba(61,111,168,.12)", BRAND] }[tone];
  return (
    <div role={tone === "err" ? "alert" : "status"} style={{ padding: "12px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14, background: c[0], color: c[1], border: `1px solid ${c[1]}33` }}>
      {children}
    </div>
  );
}

export function ReportStyles() {
  return (
    <style>{`
      .ar-page { max-width: 1250px; margin: 0 auto; padding: 8px 4px 50px; color: var(--text-color); }
      .ar-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 20px; padding: clamp(14px,3vw,26px); box-shadow: 0 10px 30px rgba(0,0,0,.05); margin-bottom: 20px; }
      .ar-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
      .ar-tab, .ar-chip { padding: 9px 18px; border-radius: 999px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-color); font-weight: 700; font-size: 14px; cursor: pointer; }
      .ar-chip { padding: 6px 12px; font-size: 12.5px; }
      .ar-tab[data-active="true"], .ar-chip[data-active="true"] { background: ${BRAND}; color: #fff; border-color: ${BRAND}; }
      .ar-btn { display: inline-flex; align-items: center; justify-content: center; height: 42px; padding: 0 18px; border-radius: 12px; border: 1px solid transparent; font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: none; }
      .ar-btn:disabled { opacity: .5; cursor: not-allowed; }
      .ar-small { height: 32px; padding: 0 12px; font-size: 12.5px; }
      .ar-primary { background: ${BRAND}; color: #fff; }
      .ar-dark { background: #111827; color: #fff; }
      .ar-ghost { background: var(--card-bg); color: var(--text-color); border-color: var(--border-color); }
      .ar-link { background: none; border: none; text-decoration: underline; color: inherit; cursor: pointer; font: inherit; }
      .ar-filters { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 12px; }
      .ar-filters label, .ar-form label, .ar-block { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--text-muted); }
      .ar-filters select, .ar-filters input, .ar-form select, .ar-form input, .ar-block textarea, .ar-modal textarea { height: 42px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); font-size: 14px; font-weight: 500; box-sizing: border-box; }
      .ar-block textarea, .ar-modal textarea { height: auto; padding: 10px 12px; font-family: inherit; }
      .ar-note { color: var(--text-muted); font-size: 13.5px; margin: 6px 0 14px; }
      .ar-sub { color: var(--text-muted); font-size: 12.5px; }
      .ar-flag { color: #c2410c; font-size: 11.5px; margin-top: 3px; }
      .ar-scroll { overflow-x: auto; }
      .ar-table { width: 100%; border-collapse: collapse; font-size: 14px; }
      .ar-table th { text-align: left; font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase; color: var(--text-muted); padding: 10px 12px; background: var(--table-row-alt); white-space: nowrap; }
      .ar-table td { padding: 10px 12px; border-top: 1px solid var(--border-color); vertical-align: top; }
      .ar-click { cursor: pointer; }
      .ar-click:hover { background: var(--hover-bg); }
      .ar-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
      .ar-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
      .ar-stat { border: 1px solid var(--border-color); border-radius: 14px; padding: 12px 14px; background: var(--bg-color); }
      .ar-stat-value { font-size: 26px; font-weight: 800; }
      .ar-months { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
      .ar-month { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--bg-color); }
      .ar-month[data-active="true"] { border-color: ${BRAND}; box-shadow: 0 0 0 2px rgba(61,111,168,.25); }
      .ar-month-main { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; background: none; border: none; padding: 0; cursor: pointer; color: var(--text-color); text-align: left; font-size: 15px; }
      .ar-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 2000; }
      .ar-modal { width: 100%; max-width: 620px; max-height: 92vh; overflow-y: auto; background: var(--card-bg); color: var(--text-color); border-radius: 20px; padding: 24px; box-shadow: 0 30px 80px rgba(0,0,0,.35); }
      .ar-form { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 14px 0; }
      .ar-orig { padding: 10px 12px; border-radius: 12px; background: var(--hover-bg); font-size: 13px; }
      .ar-check { display: flex; gap: 10px; align-items: flex-start; margin-top: 12px; font-size: 13.5px; }
      .ar-preview { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(61,111,168,.1); font-size: 13px; }
      .ar-errors { color: #dc2626; font-size: 13px; margin: 12px 0 0; padding-left: 18px; }
      .ar-gate { padding: 14px 16px; border-radius: 14px; margin-bottom: 20px; }
      .ar-gate.ok { background: rgba(22,163,74,.12); color: #15803d; }
      .ar-gate.no { background: rgba(234,88,12,.12); color: #c2410c; }
      .ar-verify { margin-top: 14px; padding: 14px; border-radius: 14px; background: var(--hover-bg); display: grid; gap: 6px; font-size: 14px; }
      @media (max-width: 700px) { .ar-form { grid-template-columns: 1fr; } .ar-table { font-size: 13px; } }
    `}</style>
  );
}
