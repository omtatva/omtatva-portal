"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ApiClientError, getBlob, getJson, postJson } from "@/lib/reportsClient";
import type { PayslipRow, PreviewResponse } from "@/lib/payroll/apiTypes";
import type { DayClass, EmployeeResult, Flag } from "@/lib/payroll/engine";

const rs = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");

function defaultPeriod() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DAY_STYLE: Record<DayClass, string> = {
  "not-employed": "bg-gray-100 text-gray-400",
  "weekly-off": "bg-gray-200 text-gray-600",
  holiday: "bg-purple-100 text-purple-700",
  present: "bg-green-100 text-green-700",
  incomplete: "bg-orange-100 text-orange-700",
  "paid-leave": "bg-blue-100 text-blue-700",
  "unpaid-leave": "bg-red-100 text-red-700",
  absent: "bg-red-100 text-red-700",
  "decided-paid": "bg-teal-100 text-teal-700",
  "decided-unpaid": "bg-rose-100 text-rose-700",
  review: "bg-yellow-200 text-yellow-900 ring-1 ring-yellow-500",
};
const DAY_LABEL: Record<DayClass, string> = {
  "not-employed": "not employed", "weekly-off": "weekly off", holiday: "holiday", present: "worked", incomplete: "no punch-out (paid)",
  "paid-leave": "paid leave", "unpaid-leave": "unpaid leave", absent: "absent", "decided-paid": "HR: paid", "decided-unpaid": "HR: unpaid", review: "NEEDS DECISION",
};
const DECIDABLE = new Set(["missing-attendance", "leave-no-request", "conflict", "incomplete"]);

export default function RunTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [period, setPeriod] = useState(defaultPeriod());
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [slips, setSlips] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "review" | "ready" | "excluded">("all");
  const [why, setWhy] = useState("");
  const [typed, setTyped] = useState("");
  const [bulkTreatment, setBulkTreatment] = useState<"paid" | "unpaid">("unpaid");
  const [bulkWhy, setBulkWhy] = useState("");
  const [bulkTyped, setBulkTyped] = useState("");
  const [revWhy, setRevWhy] = useState("");
  const [revTyped, setRevTyped] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await getJson<PreviewResponse>(`/api/payroll/preview?period=${period}`);
      setData(r);
      if (r.run && (r.run.status === "approved" || r.run.status === "payslips_generated")) {
        setSlips((await getJson<{ payslips: PayslipRow[] }>(`/api/payroll/payslips?period=${period}`)).payslips);
      } else setSlips([]);
    } catch (e) {
      setData(null);
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const t = setTimeout(load, 0); // load once on mount and whenever the month changes
    return () => clearTimeout(t);
  }, [load]);

  const reload = () => { setLoading(true); setError(""); load(); };
  const changePeriod = (value: string) => {
    setPeriod(value); setLoading(true); setError(""); setOpen(null); setNotice(""); setTyped(""); setRevTyped("");
  };

  const act = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      setNotice(await fn());
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  };

  const missingDays = useMemo(() => (data ? data.results.reduce((n, r) => n + r.flags.filter((f) => f.code === "missing-attendance").length, 0) : 0), [data]);
  const approved = data?.run && (data.run.status === "approved" || data.run.status === "payslips_generated");
  const rows = (data?.results || []).filter((r) => filter === "all" || r.status === filter);
  const canEdit = !!data?.canEdit;

  const decide = (r: EmployeeResult, flag: Flag, treatment: "paid" | "unpaid") =>
    act("decision", async () => {
      await postJson("/api/payroll/decisions", { period, items: [{ uid: r.uid, date: flag.date, treatment, reason: why }] });
      return `${flag.date}: marked ${treatment} for ${r.name}.`;
    });
  const clearDecision = (r: EmployeeResult, date: string) =>
    act("decision", async () => {
      await postJson("/api/payroll/decisions", { period, clear: [{ uid: r.uid, date }] });
      return `Decision removed for ${date}.`;
    });

  const openPdf = async (id: string) => {
    try {
      const blob = await getBlob(`/api/payroll/payslip-pdf?id=${encodeURIComponent(id)}`);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) { setError(msg(e)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Payroll month
          <input type="month" value={period} onChange={(e) => changePeriod(e.target.value)} className="block border rounded-lg px-3 py-2 mt-1" />
        </label>
        <button onClick={reload} disabled={loading} className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm">{loading ? "Calculating…" : "Recalculate preview"}</button>
        {data?.run && (
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${approved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
            {data.run.status === "payslips_generated" ? `Approved · payslips issued (rev ${data.run.revision})`
              : data.run.status === "approved" ? `Approved (rev ${data.run.revision}) · payslips not generated`
              : data.run.status === "reversed" ? `Reversed — recalculate and approve again`
              : "Approval in progress"}
          </span>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}
      {notice && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm" role="status">{notice}</div>}
      {loading && !data && <p className="text-gray-500">Calculating payroll…</p>}

      {data && (
        <>
          {data.companyFlags.length > 0 && (
            <div className="space-y-1">
              {data.companyFlags.map((f, i) => (
                <div key={i} className={`p-2.5 rounded-lg text-sm ${f.severity === "block" ? "bg-red-50 text-red-700" : f.severity === "warn" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>{f.message}</div>
              ))}
            </div>
          )}

          {approved && data.run?.driftNetPay !== null && data.run?.driftNetPay !== 0 && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
              Attendance, leave or salary data changed after approval: recalculating today would give a net total {data.run!.driftNetPay! > 0 ? "higher" : "lower"} by {rs(Math.abs(data.run!.driftNetPay!))}.
              The approved payroll was <b>not</b> changed. A Super Admin can reverse the period to recalculate.
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              ["Employees", String(data.summary.employees)],
              ["Ready", String(data.summary.ready)],
              ["Need a decision", String(data.summary.needsReview)],
              ["Gross", rs(data.summary.gross)],
              ["Deductions", rs(data.summary.totalDeductions)],
              ["Net payable", rs(data.summary.netPay)],
            ].map(([k, v]) => (
              <div key={k} className="bg-white rounded-xl shadow p-4"><div className="text-xs text-gray-500">{k}</div><div className="text-lg font-bold">{v}</div></div>
            ))}
          </div>
          {data.skipped.length > 0 && (
            <p className="text-xs text-gray-500">Not in this payroll: {data.skipped.map((s) => `${s.name} (${s.employeeId}: ${s.reason})`).join("; ")}</p>
          )}

          {!approved && missingDays > 0 && canEdit && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 space-y-2">
              <b>{missingDays} day(s) have no attendance record</b> (and no leave or holiday). They are <u>not</u> assumed Present or Absent — decide below,
              per day inside an employee row, or for all of them at once:
              <div className="flex flex-wrap gap-2 items-center">
                <select value={bulkTreatment} onChange={(e) => setBulkTreatment(e.target.value as "paid" | "unpaid")} className="border rounded px-2 py-1.5">
                  <option value="unpaid">Unpaid (loss of pay)</option><option value="paid">Paid</option>
                </select>
                <input value={bulkWhy} onChange={(e) => setBulkWhy(e.target.value)} placeholder="Reason (required, 10+ characters)" className="border rounded px-2 py-1.5 flex-1 min-w-[220px]" />
                <input value={bulkTyped} onChange={(e) => setBulkTyped(e.target.value)} placeholder={`Type RESOLVE ${missingDays} DAYS`} className="border rounded px-2 py-1.5 w-56" />
                <button disabled={!!busy || bulkWhy.trim().length < 10 || bulkTyped !== `RESOLVE ${missingDays} DAYS`}
                  onClick={() => act("bulk", async () => { const r = await postJson<{ saved: number }>("/api/payroll/resolve-missing", { period, treatment: bulkTreatment, reason: bulkWhy, confirm: bulkTyped }); setBulkTyped(""); return `${r.saved} day(s) set to ${bulkTreatment}.`; })}
                  className="px-4 py-1.5 rounded bg-yellow-700 text-white disabled:opacity-40">Apply to all {missingDays}</button>
              </div>
            </div>
          )}

          <div className="flex gap-2 text-sm">
            {(["all", "review", "ready", "excluded"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full border ${filter === f ? "bg-slate-700 text-white" : "bg-white"}`}>{f === "review" ? "needs decision" : f}</button>
            ))}
          </div>

          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>{["Employee", "ID", "Payable days", "Unpaid days", "Gross", "Deductions", "Net pay", "Status"].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.uid}>
                    <tr className="border-t cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === r.uid ? null : r.uid)}>
                      <td className="p-3 font-medium">{r.name}</td><td className="p-3">{r.employeeId}</td>
                      <td className="p-3">{r.status === "excluded" ? "—" : `${r.payableDays} / ${r.daysInMonth}`}</td>
                      <td className="p-3">{r.lopDays}</td>
                      <td className="p-3">{rs(r.grossEarnings)}</td><td className="p-3">{rs(r.totalDeductions)}</td>
                      <td className="p-3 font-bold">{r.status === "excluded" ? "—" : rs(r.netPay)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === "ready" ? "bg-green-100 text-green-700" : r.status === "review" ? "bg-yellow-200 text-yellow-900" : "bg-gray-200 text-gray-600"}`}>
                          {r.status === "review" ? "needs decision" : r.status}
                        </span>
                      </td>
                    </tr>
                    {open === r.uid && (
                      <tr className="bg-slate-50"><td colSpan={8} className="p-4">
                        <Detail r={r} canEdit={canEdit && !approved} why={why} setWhy={setWhy} decide={decide} clear={clearDecision} decisions={data.decisions} busy={!!busy} />
                      </td></tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-500">No employees to show.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* ---------------- approval ---------------- */}
          {!approved && (
            <div className="bg-white rounded-xl shadow p-4 space-y-2">
              <h3 className="font-semibold">Approve payroll for {period}</h3>
              {data.blockers.length > 0 && <ul className="list-disc ml-5 text-sm text-red-700">{data.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
              <p className="text-sm text-gray-600">Approving saves a permanent snapshot of these figures. Later attendance corrections will not change it.</p>
              <div className="flex flex-wrap gap-2 items-center">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type APPROVE ${period}`} className="border rounded px-3 py-2 w-56" />
                <button disabled={!canEdit || !!busy || data.blockers.length > 0 || typed !== `APPROVE ${period}`}
                  onClick={() => act("approve", async () => { const r = await postJson<{ employees: number; netPay: number }>("/api/payroll/approve", { period, confirm: typed, previewDigest: data.digest }); setTyped(""); return `Approved: ${r.employees} employees, net ${rs(r.netPay)}.`; })}
                  className="px-5 py-2 rounded-lg bg-green-700 text-white disabled:opacity-40">{busy === "approve" ? "Approving…" : "Approve payroll"}</button>
                {!canEdit && <span className="text-xs text-gray-500">You have view-only access to Payroll.</span>}
              </div>
            </div>
          )}

          {/* ---------------- payslips ---------------- */}
          {approved && (
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold">Payslips · {period}</h3>
                <button disabled={!canEdit || !!busy} onClick={() => act("gen", async () => { const r = await postJson<{ created: number; skipped: number; failed: number }>("/api/payroll/generate-payslips", { period }); return `${r.created} payslip(s) created, ${r.skipped} already existed${r.failed ? `, ${r.failed} FAILED` : ""}. Running this again never duplicates anything.`; })}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white disabled:opacity-40">{busy === "gen" ? "Generating…" : "Generate Payslips"}</button>
                <span className="text-sm text-gray-500">{slips.filter((s) => s.status === "issued").length} issued</span>
              </div>
              {slips.length > 0 && (
                <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>
                  {slips.map((s) => (
                    <tr key={s.id} className="border-t"><td className="p-2">{s.employeeName}</td><td className="p-2">{s.employeeId}</td><td className="p-2">{rs(s.netPay)}</td>
                      <td className="p-2">{s.status === "issued" ? "issued" : <span className="text-red-600">voided</span>}</td>
                      <td className="p-2 text-right"><button className="text-blue-700 underline" onClick={() => openPdf(s.id)}>Open PDF</button></td></tr>
                  ))}
                </tbody></table></div>
              )}
              {isSuperAdmin && (
                <details className="border-t pt-3">
                  <summary className="cursor-pointer text-red-700 font-medium">Reverse this approval (Super Admin)</summary>
                  <p className="text-sm text-gray-600 my-2">Voids this period&apos;s payslips, keeps a backup and an audit record, and lets you recalculate. Employees stop seeing the voided payslips.</p>
                  <div className="flex flex-wrap gap-2">
                    <input value={revWhy} onChange={(e) => setRevWhy(e.target.value)} placeholder="Reason (10+ characters)" className="border rounded px-3 py-2 flex-1 min-w-[240px]" />
                    <input value={revTyped} onChange={(e) => setRevTyped(e.target.value)} placeholder={`Type REVERSE ${period}`} className="border rounded px-3 py-2 w-52" />
                    <button disabled={!!busy || revWhy.trim().length < 10 || revTyped !== `REVERSE ${period}`}
                      onClick={() => act("rev", async () => { const r = await postJson<{ payslipsVoided: number }>("/api/payroll/reverse", { period, reason: revWhy, confirm: revTyped }); setRevTyped(""); setRevWhy(""); return `Reversed. ${r.payslipsVoided} payslip(s) voided; a backup was saved.`; })}
                      className="px-4 py-2 rounded-lg bg-red-700 text-white disabled:opacity-40">Reverse</button>
                  </div>
                </details>
              )}
            </div>
          )}
          {data.run && data.run.history.length > 0 && (
            <div className="text-xs text-gray-500">Earlier revisions: {data.run.history.map((h) => `rev ${h.revision} reversed ${h.reversedAt.slice(0, 10)} by ${h.reversedBy} (${h.reason})`).join(" · ")}</div>
          )}
        </>
      )}
    </div>
  );
}

function Detail({ r, canEdit, why, setWhy, decide, clear, decisions, busy }: {
  r: EmployeeResult; canEdit: boolean; why: string; setWhy: (s: string) => void;
  decide: (r: EmployeeResult, f: Flag, t: "paid" | "unpaid") => void; clear: (r: EmployeeResult, d: string) => void;
  decisions: PreviewResponse["decisions"]; busy: boolean;
}) {
  const decidable = r.flags.filter((f) => f.date && DECIDABLE.has(f.code) && r.dayClasses[f.date] === "review");
  const decided = Object.entries(r.dayClasses).filter(([, c]) => c === "decided-paid" || c === "decided-unpaid").map(([d]) => d);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1">
        {Object.entries(r.dayClasses).map(([d, c]) => (
          <span key={d} title={`${d}: ${DAY_LABEL[c]}`} className={`w-7 h-7 flex items-center justify-center rounded text-[11px] ${DAY_STYLE[c]}`}>{d.slice(8)}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {(Object.keys(DAY_LABEL) as DayClass[]).filter((c) => r.counts[c] > 0).map((c) => <span key={c}><span className={`inline-block w-2.5 h-2.5 rounded ${DAY_STYLE[c].split(" ")[0]}`} /> {r.counts[c]} {DAY_LABEL[c]}</span>)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><b>Earnings</b>{r.earnings.map((l) => <div key={l.key} className="flex justify-between"><span>{l.label}</span><span>{rs(l.amount)}</span></div>)}
          <div className="flex justify-between font-semibold border-t mt-1"><span>Gross</span><span>{rs(r.grossEarnings)}</span></div></div>
        <div><b>Deductions</b>
          {r.lopDeduction > 0 && <div className="flex justify-between"><span>Loss of pay ({r.lopDays} d × {rs(r.perDayRate)})</span><span>{rs(r.lopDeduction)}</span></div>}
          {r.notEmployedDeduction > 0 && <div className="flex justify-between"><span>Pro-rata ({r.notEmployedDays} d not employed)</span><span>{rs(r.notEmployedDeduction)}</span></div>}
          {r.deductions.map((l) => <div key={l.key} className="flex justify-between"><span>{l.label}</span><span>{rs(l.amount)}</span></div>)}
          <div className="flex justify-between font-semibold border-t mt-1"><span>Net pay</span><span>{rs(r.netPay)}</span></div></div>
      </div>
      {r.leave && <p className="text-xs text-gray-600">Leave balance {r.leave.leaveYear}: opening {r.leave.opening}, accrued {r.leave.accruedToDate}, used {r.leave.usedYearToDate}, available <b>{r.leave.available}</b>{r.leave.encashableDays ? `, encashable ${r.leave.encashableDays} (not paid automatically)` : ""}</p>}
      {r.flags.filter((f) => !(f.date && DECIDABLE.has(f.code) && r.dayClasses[f.date] === "review")).map((f, i) => (
        <div key={i} className={f.severity === "block" ? "text-red-700" : f.severity === "warn" ? "text-amber-700" : "text-blue-700"}>• {f.message}</div>
      ))}
      {decidable.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 space-y-2">
          <b>Needs a decision ({decidable.length})</b>
          {canEdit && <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason for the decision (required, 5+ characters)" className="border rounded px-2 py-1.5 w-full" />}
          {decidable.map((f) => (
            <div key={f.date} className="flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-[260px]">{f.message}</span>
              {canEdit && <>
                <button disabled={busy || why.trim().length < 5} onClick={() => decide(r, f, "paid")} className="px-2.5 py-1 rounded bg-teal-700 text-white disabled:opacity-40">Paid</button>
                <button disabled={busy || why.trim().length < 5} onClick={() => decide(r, f, "unpaid")} className="px-2.5 py-1 rounded bg-rose-700 text-white disabled:opacity-40">Unpaid</button>
              </>}
            </div>
          ))}
        </div>
      )}
      {decided.length > 0 && (
        <div className="text-xs text-gray-600">HR decisions: {decided.map((d) => {
          const k = `${r.uid}|${d}`;
          return <span key={d} className="mr-3">{d} → {decisions[k]?.treatment} <i>({decisions[k]?.reason})</i>{canEdit && <button className="ml-1 text-red-600 underline" onClick={() => clear(r, d)}>undo</button>}</span>;
        })}</div>
      )}
    </div>
  );
}
