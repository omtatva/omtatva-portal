"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiClientError, getJson, postJson } from "@/lib/reportsClient";
import { bulkChangeGate, type BackupMetaRecord } from "@/lib/attendanceBackup";
import { MAX_BULK_ITEMS, chunk, confirmPhrase, emptyResult, mergeResults, type BulkResult } from "@/lib/bulkCorrection";
import { computePunchOut, validateParams, type PunchOutMode } from "@/lib/bulkPunchOut";
import { MIN_REASON_LENGTH } from "@/lib/attendanceCorrection";
import type { ResolvedShift } from "@/lib/attendancePolicy";

export type PunchOutRow = {
  recordId: string;
  name: string;
  date: string;
  punchIn: Date | null;
  shiftEndAt: Date | null;
  shift: ResolvedShift;
};

type StoredBackup = BackupMetaRecord & { id: string; createdAtIso: string };

// Fill in MANY missing punch-outs with one rule. The preview shows the exact
// time every record would get; the server recalculates them itself, and each
// record is still corrected and audited individually.
export default function BulkPunchOutDialog({
  rows,
  tz,
  dateRange,
  onClose,
  onFinished,
}: {
  rows: PunchOutRow[];
  tz: string;
  dateRange: { from: string; to: string };
  onClose: () => void;
  onFinished: (r: BulkResult) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<PunchOutMode>("shift-end");
  const [time, setTime] = useState("18:00");
  const [hours, setHours] = useState(9);
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const [typed, setTyped] = useState("");
  const [backups, setBackups] = useState<StoredBackup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    getJson<{ backups: StoredBackup[] }>("/api/attendance/reports/backups")
      .then((r) => !cancelled && setBackups(r.backups))
      .catch(() => !cancelled && setBackups([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const params = useMemo(() => ({ mode, time, hours }), [mode, time, hours]);
  const paramError = validateParams(params);

  const computed = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        out: paramError
          ? ({ ok: false, reason: paramError } as const)
          : computePunchOut({ params, date: r.date, punchIn: r.punchIn, shiftEndAt: r.shiftEndAt, shift: r.shift, now }),
      })),
    [rows, params, paramError, now]
  );
  const valid = computed.filter((c) => c.out.ok);
  const invalid = computed.length - valid.length;
  const total = valid.length;
  const required = confirmPhrase(total);

  const fmt = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d) : "—";

  const gate = backups
    ? bulkChangeGate(
        backups.map((b) => ({ backupId: b.backupId || b.id, createdAt: b.createdAtIso, verifiedAt: b.verifiedAt, range: b.range, count: b.count, sha256: b.sha256 })),
        dateRange
      )
    : { allowed: false, reason: "Checking backups…" };

  const ready = !busy && !result && total > 0 && !paramError && reason.trim().length >= MIN_REASON_LENGTH && verified && typed === required;

  const run = async () => {
    setBusy(true);
    setError("");
    setProgress(0);
    let merged = emptyResult();
    const batchId = `bulk_${Date.now()}`;
    try {
      for (const part of chunk(valid.map((v) => ({ recordId: v.row.recordId })), MAX_BULK_ITEMS)) {
        const r = await postJson<BulkResult>("/api/attendance/reports/bulk-punchout", {
          items: part,
          mode,
          time,
          hours,
          reason,
          confirmVerified: verified,
          confirm: typed,
          batchTotal: total,
          batchId,
        });
        merged = mergeResults(merged, r);
        setProgress((p) => p + part.length);
      }
      setResult(merged);
      await onFinished(merged);
    } catch (e) {
      setResult(merged.updated + merged.skipped + merged.failed > 0 ? merged : null);
      setError(e instanceof ApiClientError || e instanceof Error ? e.message : "The bulk run failed.");
    } finally {
      setBusy(false);
    }
  };

  const optionStyle = { display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border-color)", marginBottom: 8, cursor: "pointer" } as const;

  return (
    <div className="ar-overlay" role="dialog" aria-modal="true" aria-label="Set missing punch-outs in bulk">
      <div className="ar-modal" style={{ maxWidth: 700 }}>
        <h2 style={{ margin: "0 0 6px" }}>Set punch-out for {rows.length} record{rows.length === 1 ? "" : "s"}</h2>
        <p className="ar-sub" style={{ marginTop: 0 }}>
          These days have a punch-in but no punch-out. Choose one rule; total hours are recalculated. Each record is corrected and logged on its own.
        </p>

        <fieldset disabled={busy || !!result} style={{ border: "none", padding: 0, margin: "0 0 10px" }}>
          <label style={optionStyle}>
            <input type="radio" name="po-mode" checked={mode === "shift-end"} onChange={() => setMode("shift-end")} />
            <span><b>Each person’s shift end time</b> <span className="ar-sub">(recommended — overnight shifts handled)</span></span>
          </label>
          <label style={optionStyle}>
            <input type="radio" name="po-mode" checked={mode === "fixed-time"} onChange={() => setMode("fixed-time")} />
            <span>The same time for everyone:</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} onFocus={() => setMode("fixed-time")} style={{ marginLeft: 6 }} />
          </label>
          <label style={optionStyle}>
            <input type="radio" name="po-mode" checked={mode === "hours-after-in"} onChange={() => setMode("hours-after-in")} />
            <span>Punch-in plus</span>
            <input type="number" min={1} max={24} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} onFocus={() => setMode("hours-after-in")} style={{ width: 80 }} />
            <span>hours</span>
          </label>
        </fieldset>

        {paramError && <div className="ar-errors" role="alert">{paramError}</div>}

        <div className="ar-sub" style={{ margin: "6px 0" }}>
          Preview ({total} will be updated{invalid ? `, ${invalid} cannot be and will be skipped` : ""}) — times in {tz}:
        </div>
        <div className="ar-scroll" style={{ maxHeight: 220, overflowY: "auto" }}>
          <table className="ar-table" style={{ fontSize: 13 }}>
            <thead><tr><th>Employee</th><th>Date</th><th>Punch-in</th><th>New punch-out</th><th>Hours</th></tr></thead>
            <tbody>
              {computed.slice(0, 60).map(({ row, out }) => (
                <tr key={row.recordId}>
                  <td>{row.name}</td>
                  <td>{row.date}</td>
                  <td>{fmt(row.punchIn)}</td>
                  <td>{out.ok ? <b>{fmt(out.at)}</b> : <span style={{ color: "#dc2626" }}>skipped — {out.reason}</span>}</td>
                  <td>{out.ok && row.punchIn ? Math.round(((out.at.getTime() - row.punchIn.getTime()) / 3600000) * 100) / 100 : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {computed.length > 60 && <div className="ar-sub" style={{ padding: 8 }}>…and {computed.length - 60} more with the same rule.</div>}
        </div>

        <div className={`ar-gate ${gate.allowed ? "ok" : "no"}`} role="status" style={{ marginTop: 12 }}>
          <b>Backup:</b> {gate.allowed ? "a fresh, verified backup covers these dates ✓" : gate.reason}
          {!gate.allowed && <div className="ar-sub">Create and verify one in the “Backup &amp; rollback” tab first — the server refuses the run without it.</div>}
        </div>

        <label className="ar-block" style={{ marginTop: 12 }}>
          Reason (required, at least {MIN_REASON_LENGTH} characters)
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Staff confirmed they left at shift end; door-access log checked." disabled={busy || !!result} />
        </label>

        <label className="ar-check">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} disabled={busy || !!result} />
          I have verified that these people worked until these times.
        </label>

        {!result && (
          <label className="ar-block" style={{ marginTop: 12 }}>
            Type <code>{required}</code> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} aria-label="Confirmation text" />
          </label>
        )}

        {busy && <p className="ar-sub">Saving… {progress} of {total}</p>}
        {error && <div className="ar-errors" role="alert">{error}</div>}
        {result && (
          <div className="ar-verify" role="status">
            <b>Finished.</b>
            <div>{result.updated} updated · {result.skipped} skipped · {result.failed} failed</div>
            {result.errors.slice(0, 6).map((e, i) => (
              <div key={i} className="ar-sub" style={{ color: "#dc2626" }}>{e.item.recordId}: {e.message}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="ar-btn ar-ghost" onClick={onClose} disabled={busy}>{result ? "Close" : "Cancel"}</button>
          {!result && (
            <button className="ar-btn ar-primary" onClick={run} disabled={!ready}>{busy ? "Working…" : `Set punch-out for ${total}`}</button>
          )}
        </div>
      </div>
    </div>
  );
}
