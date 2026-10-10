"use client";

import { useState } from "react";
import { ApiClientError, postJson } from "@/lib/reportsClient";
import { readSheetFile, SheetFileError } from "@/lib/payroll/readSheetFile";
import { templateHeaders, type RowResult, type SheetRow } from "@/lib/payroll/salarySheet";
import type { SalaryPreviewResponse } from "@/lib/payroll/apiTypes";

const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof SheetFileError || e instanceof Error ? e.message : "Something went wrong.");
const money = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-IN"));

const BADGE: Record<RowResult["status"], string> = {
  ok: "bg-green-100 text-green-700", warning: "bg-amber-100 text-amber-800", error: "bg-red-100 text-red-700", unchanged: "bg-gray-100 text-gray-500",
};

export default function SalaryUploadTab({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<SalaryPreviewResponse | null>(null);
  const [why, setWhy] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [show, setShow] = useState<"changes" | "all">("changes");

  const onFile = async (file: File | undefined) => {
    setResult(null); setRows(null); setError(""); setDone(""); setTyped("");
    if (!file) return;
    setBusy(true);
    try {
      const parsed = readSheetFile(await file.arrayBuffer(), file.name);
      setRows(parsed);
      setFileName(file.name);
      setResult(await postJson<SalaryPreviewResponse>("/api/payroll/salary-preview", { rows: parsed }));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!result || !rows) return;
    setBusy(true); setError("");
    try {
      const r = await postJson<{ applied: number; conflicts: string[]; backupId: string | null }>("/api/payroll/salary-apply", {
        rows, previewHash: result.previewHash, confirm: typed, reason: why, fileName,
      });
      setDone(`${r.applied} salary structure(s) updated${r.conflicts.length ? `; ${r.conflicts.length} skipped because they changed meanwhile (${r.conflicts.join(", ")})` : ""}. ${r.backupId ? "A backup of the old values was saved." : ""}`);
      setResult(null); setRows(null); setTyped(""); setWhy("");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const comps = result?.components;
    const header = comps ? templateHeaders(comps) : ["Employee_ID", "Employee_Name", "Basic Salary", "HRA", "Special Allowance"];
    const blob = new Blob([header.join(",") + "\n"], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "salary-sheet-template.csv"; a.click();
  };

  const p = result?.preview;
  const visible = (p?.rows || []).filter((r) => show === "all" || r.status !== "unchanged");

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold">Upload salary sheet (.xlsx or .csv)</h3>
        <p className="text-sm text-gray-600">
          One row per employee. Employees are matched by <b>Employee ID</b> only. Nothing is saved until you review the old and new values below and confirm.
          Columns left out of the file are not touched; a blank cell keeps the existing value.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <input type="file" accept=".xlsx,.csv" disabled={!canEdit || busy} onChange={(e) => onFile(e.target.files?.[0])} className="border rounded-lg p-2" />
          <button onClick={downloadTemplate} className="text-sm text-blue-700 underline">Download blank template</button>
          {!canEdit && <span className="text-xs text-gray-500">You have view-only access to Salary Structure.</span>}
        </div>
        {busy && <p className="text-sm text-gray-500">Working…</p>}
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}
        {done && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm" role="status">{done}</div>}
      </div>

      {p && result && (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h3 className="font-semibold">Preview — {fileName}</h3>
          {p.columns.problems.map((x, i) => <div key={i} className="p-2 rounded bg-red-50 text-red-700 text-sm">{x}</div>)}
          <div className="text-sm text-gray-700 space-y-1">
            <div>Recognised columns: {p.columns.recognized.map((c) => c.header).join(", ") || "none"}</div>
            {p.columns.informational.length > 0 && <div>Read for checking only (never written): {p.columns.informational.join(", ")}</div>}
            {p.columns.unexpected.length > 0 && <div className="text-amber-700">Unexpected columns — ignored: {p.columns.unexpected.join(", ")}</div>}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-2 py-1 rounded bg-green-100">{p.summary.ok} ready</span>
            <span className="px-2 py-1 rounded bg-amber-100">{p.summary.warning} with warnings</span>
            <span className="px-2 py-1 rounded bg-red-100">{p.summary.error} with errors (not applied)</span>
            <span className="px-2 py-1 rounded bg-gray-100">{p.summary.unchanged} unchanged</span>
            <label className="ml-auto"><input type="checkbox" checked={show === "all"} onChange={(e) => setShow(e.target.checked ? "all" : "changes")} /> show unchanged rows</label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left"><tr><th className="p-2">Row</th><th className="p-2">Employee ID</th><th className="p-2">Employee</th><th className="p-2">Status</th><th className="p-2">Old → proposed</th></tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.rowNumber} className="border-t align-top">
                    <td className="p-2">{r.rowNumber}</td><td className="p-2">{r.employeeId || "—"}</td><td className="p-2">{r.employeeName || "—"}{r.isNew ? <span className="ml-1 text-xs text-blue-700">(new structure)</span> : null}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE[r.status]}`}>{r.status}</span></td>
                    <td className="p-2">
                      {r.changes.map((c) => <div key={c.key}>{c.label}: <span className="text-gray-500">{money(c.old)}</span> → <b>{money(c.new)}</b></div>)}
                      {r.messages.map((m, i) => <div key={i} className={m.severity === "error" ? "text-red-700" : m.severity === "warning" ? "text-amber-700" : "text-blue-700"}>• {m.text}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.summary.applicable > 0 && canEdit && (
            <div className="border-t pt-3 space-y-2">
              <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason for this change (required, 10+ characters) — e.g. Annual increment Oct 2026" className="border rounded px-3 py-2 w-full" />
              <div className="flex flex-wrap gap-2 items-center">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type APPLY ${p.summary.applicable} SALARY CHANGES`} className="border rounded px-3 py-2 w-72" />
                <button disabled={busy || why.trim().length < 10 || typed !== `APPLY ${p.summary.applicable} SALARY CHANGES`} onClick={apply} className="px-5 py-2 rounded-lg bg-blue-700 text-white disabled:opacity-40">Apply {p.summary.applicable} change(s)</button>
              </div>
              <p className="text-xs text-gray-500">A backup of the current values and a salary-change history entry are saved first. Rows with errors are skipped.</p>
            </div>
          )}
          {p.summary.applicable === 0 && <p className="text-sm text-gray-600">Nothing to apply from this file.</p>}
        </div>
      )}
    </div>
  );
}
