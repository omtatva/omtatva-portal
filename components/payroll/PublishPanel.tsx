"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, getJson, postJson } from "@/lib/reportsClient";

const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");

type Preview = {
  period: string; periodLabel: string; revision: number; stage: "draft" | "approved" | "generated" | "published";
  employees: number; toPublish: number; alreadyPublished: number; publishedAt: string | null; publishedBy: string | null; blockers: string[];
};
type Result = { published: number; alreadyPublished: number; failed: { employeeId: string; message: string }[]; indexFailed: number; message: string };

const STEPS: [Preview["stage"], string][] = [["draft", "Draft"], ["approved", "Approved"], ["generated", "Payslips generated"], ["published", "Published to employees"]];

export default function PublishPanel({ period, canEdit, onChanged }: { period: string; canEdit: boolean; onChanged?: () => void }) {
  const [p, setP] = useState<Preview | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(async () => {
    try {
      setP(await getJson<Preview>(`/api/payroll/publish-preview?period=${period}`));
    } catch (e) {
      setError(msg(e));
    }
  }, [period]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const send = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await postJson<Result>("/api/payroll/publish-payslips", { period, confirm: typed });
      setResult(r); setTyped("");
      await load();
      onChanged?.();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!p) return <p className="text-sm text-gray-500">{error || "Loading…"}</p>;
  const reached = STEPS.findIndex(([k]) => k === p.stage);
  const nothingLeft = p.toPublish === 0 && p.alreadyPublished > 0;

  return (
    <div className="border-t pt-4 space-y-3">
      <h3 className="font-semibold">📤 Send to Employees</h3>
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map(([k, label], i) => (
          <li key={k} className={`px-2.5 py-1 rounded-full ${i <= reached ? "bg-green-100 text-green-800 font-semibold" : "bg-gray-100 text-gray-500"}`}>{i < reached ? "✓ " : ""}{label}</li>
        ))}
      </ol>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}
      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.failed.length ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-800"}`} role="status">
          <b>{result.message}</b>
          <div>{result.published} newly published · {result.alreadyPublished} were already published · {result.failed.length} failed</div>
          {result.failed.map((f) => <div key={f.employeeId}>✗ {f.employeeId}: {f.message}</div>)}
          {result.indexFailed > 0 && <div>The dashboard list could not be refreshed for {result.indexFailed} employee(s) — press the button again to retry.</div>}
        </div>
      )}

      {p.blockers.length > 0 ? (
        <ul className="list-disc ml-5 text-sm text-red-700">{p.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
      ) : (
        <div className="rounded-lg border p-3 text-sm space-y-2">
          <div className="grid sm:grid-cols-4 gap-2">
            <div><div className="text-xs text-gray-500">Payroll month</div><b>{p.periodLabel}</b></div>
            <div><div className="text-xs text-gray-500">Employees</div><b>{p.employees}</b></div>
            <div><div className="text-xs text-gray-500">Payslips to publish now</div><b>{p.toPublish}</b></div>
            <div><div className="text-xs text-gray-500">Already published</div><b>{p.alreadyPublished}</b></div>
          </div>
          {p.publishedAt && <div className="text-xs text-gray-600">First published {p.publishedAt.slice(0, 16).replace("T", " ")} by {p.publishedBy}. Revision {p.revision}{p.revision > 1 ? " (reissued after a correction)" : ""}.</div>}

          {nothingLeft ? (
            <p className="text-green-800">✓ All {p.alreadyPublished} payslips for this month are already visible to their employees. Nothing more to send.</p>
          ) : (
            <>
              <p className="text-gray-700">
                This makes <b>{p.toPublish}</b> approved payslip(s) for <b>{p.periodLabel}</b> appear in each employee&apos;s dashboard, where they can open and
                download <u>only their own</u>. Each payslip is published once — pressing the button again never duplicates anything.
              </p>
              {canEdit ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type PUBLISH ${p.toPublish} PAYSLIPS`} className="border rounded px-3 py-2 w-64" />
                  <button disabled={busy || p.toPublish === 0 || typed !== `PUBLISH ${p.toPublish} PAYSLIPS`} onClick={send}
                    className="px-5 py-2 rounded-lg bg-blue-700 text-white disabled:opacity-40">{busy ? "Sending…" : "Send to Employees"}</button>
                </div>
              ) : (
                <p className="text-xs text-gray-500">You have view-only access to Payroll.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
