"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiClientError, getJson, postJson } from "@/lib/reportsClient";
import { bulkChangeGate, type BackupMetaRecord } from "@/lib/attendanceBackup";
import {
  MAX_BULK_ITEMS,
  chunk,
  confirmPhrase,
  emptyResult,
  mergeResults,
  type BulkItem,
  type BulkResult,
} from "@/lib/bulkCorrection";
import { MIN_REASON_LENGTH } from "@/lib/attendanceCorrection";

export type BulkGroup = { status: string; items: BulkItem[] };

type StoredBackup = BackupMetaRecord & { id: string; createdAtIso: string };

// Confirmation step for correcting MANY records at once. Each record is still
// corrected and audited individually by the server; this dialog collects the
// reason, the "I verified this" tick, shows the backup status and asks for a
// typed confirmation before anything is written.
export default function BulkCorrectionDialog({
  groups,
  dateRange,
  stillIncomplete = 0,
  onClose,
  onFinished,
}: {
  groups: BulkGroup[];
  dateRange: { from: string; to: string };
  // how many of these records have a punch-in but no punch-out
  stillIncomplete?: number;
  onClose: () => void;
  onFinished: (result: BulkResult) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const [typed, setTyped] = useState("");
  const [backups, setBackups] = useState<StoredBackup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);

  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  const needsVerified = groups.some((g) => g.status === "Present");
  const required = confirmPhrase(total);

  useEffect(() => {
    let cancelled = false;
    getJson<{ backups: StoredBackup[] }>("/api/attendance/reports/backups")
      .then((r) => !cancelled && setBackups(r.backups))
      .catch(() => !cancelled && setBackups([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const gate = backups
    ? bulkChangeGate(
        backups.map((b) => ({ backupId: b.backupId || b.id, createdAt: b.createdAtIso, verifiedAt: b.verifiedAt, range: b.range, count: b.count, sha256: b.sha256 })),
        dateRange
      )
    : { allowed: false, reason: "Checking backups…" };

  const ready =
    !busy &&
    !result &&
    total > 0 &&
    reason.trim().length >= MIN_REASON_LENGTH &&
    (!needsVerified || verified) &&
    typed === required;

  const run = async () => {
    setBusy(true);
    setError("");
    setProgress(0);
    let merged = emptyResult();
    const batchId = `bulk_${Date.now()}`;

    try {
      for (const g of groups) {
        for (const part of chunk(g.items, MAX_BULK_ITEMS)) {
          const r = await postJson<BulkResult>("/api/attendance/reports/bulk-correct", {
            items: part,
            status: g.status,
            reason,
            confirmVerified: verified,
            confirm: typed,
            batchTotal: total,
            batchId,
          });
          merged = mergeResults(merged, r);
          setProgress((p) => p + part.length);
        }
      }
      setResult(merged);
      await onFinished(merged);
    } catch (e) {
      // Whatever finished before the failure stays saved (and audited).
      setResult(merged.updated + merged.created + merged.skipped + merged.failed > 0 ? merged : null);
      setError(e instanceof ApiClientError || e instanceof Error ? e.message : "The bulk run failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ar-overlay" role="dialog" aria-modal="true" aria-label="Bulk attendance correction">
      <div className="ar-modal">
        <h2 style={{ margin: "0 0 6px" }}>Correct {total} record{total === 1 ? "" : "s"} at once</h2>
        <p className="ar-sub" style={{ marginTop: 0 }}>
          Each record is corrected and logged on its own — original values, new values, your name, the time and your reason —
          and can be reverted one by one from the Corrections log.
        </p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, margin: "10px 0" }}>
          <thead><tr><th style={{ textAlign: "left" }}>Will be set to</th><th style={{ textAlign: "right" }}>Records</th></tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.status}><td><b>{g.status}</b></td><td style={{ textAlign: "right" }}>{g.items.length}</td></tr>
            ))}
          </tbody>
        </table>

        {stillIncomplete > 0 && (
          <div className="ar-hint" role="note" style={{ marginBottom: 10 }}>
            ℹ <b>{stillIncomplete}</b> of these records have a punch-in but <b>no punch-out</b>. Changing their status will <b>not</b> remove
            “Incomplete” — close this and use <b>Set punch-out…</b> for those instead.
          </div>
        )}

        <div className={`ar-gate ${gate.allowed ? "ok" : "no"}`} role="status">
          <b>Backup:</b> {gate.allowed ? "a fresh, verified backup covers these dates ✓" : gate.reason}
          {!gate.allowed && <div className="ar-sub">Create and verify one in the “Backup &amp; rollback” tab first — the server will refuse the run without it.</div>}
        </div>

        <label className="ar-block" style={{ marginTop: 12 }}>
          Reason for all of these (required, at least {MIN_REASON_LENGTH} characters)
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Verified against the leave register: these days were company holidays / weekly offs." disabled={busy || !!result} />
        </label>

        {needsVerified && (
          <label className="ar-check">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} disabled={busy || !!result} />
            I have verified that these people were present on these days (evidence on file).
          </label>
        )}

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
            <div>{result.updated} updated · {result.created} created · {result.skipped} skipped (already that value / record exists) · {result.failed} failed</div>
            {result.errors.slice(0, 8).map((e, i) => (
              <div key={i} className="ar-sub" style={{ color: "#dc2626" }}>{e.item.recordId || `${e.item.userId} ${e.item.date}`}: {e.message}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="ar-btn ar-ghost" onClick={onClose} disabled={busy}>{result ? "Close" : "Cancel"}</button>
          {!result && (
            <button className="ar-btn ar-primary" onClick={run} disabled={!ready}>
              {busy ? "Working…" : `Apply to ${total}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
