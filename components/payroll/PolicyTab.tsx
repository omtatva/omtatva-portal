"use client";

import { useEffect, useState } from "react";
import { ApiClientError, getJson, postJson } from "@/lib/reportsClient";
import { DEFAULT_COMPONENTS, resolvePolicy, type PayrollPolicy, type SalaryComponent } from "@/lib/payroll/policy";

const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm"><span className="font-medium">{label}</span><div className="mt-1">{children}</div>{hint && <span className="text-xs text-gray-500">{hint}</span>}</label>
  );
}

export default function PolicyTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [policy, setPolicy] = useState<PayrollPolicy | null>(null);
  const [explain, setExplain] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<string[]>([]); // component keys as last saved on the server
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [newComp, setNewComp] = useState<{ key: string; label: string; type: "earning" | "deduction" }>({ key: "", label: "", type: "earning" });

  useEffect(() => {
    getJson<{ policy: PayrollPolicy; explanation: string[] }>("/api/payroll/policy")
      .then((r) => { setPolicy(r.policy); setExplain(r.explanation); setLoaded(r.policy.components.map((c) => c.key)); })
      .catch((e) => setError(msg(e)));
  }, []);

  if (!policy) return <p className="text-gray-500">{error || "Loading policy…"}</p>;
  const set = (patch: Partial<PayrollPolicy>) => setPolicy({ ...policy, ...patch });
  const setLeave = (patch: Partial<PayrollPolicy["leave"]>) => setPolicy({ ...policy, leave: { ...policy.leave, ...patch } });
  const edit = isSuperAdmin;

  const save = async () => {
    setError(""); setSaved("");
    const removedKeys = loaded.filter((k) => !policy.components.some((c) => c.key === k));
    const send = (acknowledgeRemoved: string[]) =>
      postJson<{ policy: PayrollPolicy; explanation: string[] }>("/api/payroll/policy-save", { policy, confirm, acknowledgeRemoved });
    try {
      let r;
      try {
        r = await send([]);
      } catch (e) {
        // a removed component still has amounts on employees: ask, then send again with the acknowledgement
        if (e instanceof ApiClientError && e.code === "component-in-use" && window.confirm(`${e.message}\n\nRemove it anyway?`)) r = await send(removedKeys);
        else throw e;
      }
      setPolicy(r.policy); setExplain(r.explanation); setLoaded(r.policy.components.map((c) => c.key));
      setSaved(r.policy.confirmed ? "Policy saved and confirmed. Payroll can now be approved." : "Saved as a draft (not confirmed — payroll cannot be approved yet).");
    } catch (e) { setError(msg(e)); }
  };

  const inp = "border rounded px-2 py-1.5 w-full disabled:bg-gray-100";
  const num = (v: number, on: (n: number) => void) => <input type="number" step="any" min={0} value={v} disabled={!edit} onChange={(e) => on(Number(e.target.value))} className={inp} />;

  return (
    <div className="space-y-5">
      <div className={`p-3 rounded-lg text-sm ${policy.confirmed ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
        {policy.confirmed ? "This policy is confirmed." : "This policy has NOT been confirmed yet — these are suggested defaults. Payroll can be previewed but not approved until a Super Admin confirms it."}
        {!edit && " (Only a Super Admin can change it.)"}
      </div>
      <div className="bg-white rounded-xl shadow p-4"><b>How salary is calculated today</b><ul className="list-disc ml-5 text-sm text-gray-700 mt-1">{explain.map((x, i) => <li key={i}>{x}</li>)}</ul></div>

      <div className="bg-white rounded-xl shadow p-4 grid md:grid-cols-3 gap-4">
        <h3 className="md:col-span-3 font-semibold">Loss of pay</h3>
        <Field label="Per-day rate divisor" hint="What a day's pay is divided by">
          <select className={inp} disabled={!edit} value={policy.dayDivisor} onChange={(e) => set({ dayDivisor: e.target.value as PayrollPolicy["dayDivisor"] })}>
            <option value="calendar">Calendar days of the month (28–31)</option><option value="fixed">Fixed number of days</option><option value="working">Working days (excl. weekly offs &amp; holidays)</option>
          </select>
        </Field>
        {policy.dayDivisor === "fixed" && <Field label="Fixed divisor">{num(policy.fixedDivisor, (n) => set({ fixedDivisor: n }))}</Field>}
        <Field label="Loss of pay is calculated on">
          <select className={inp} disabled={!edit} value={policy.lopBase} onChange={(e) => set({ lopBase: e.target.value as PayrollPolicy["lopBase"] })}>
            <option value="basic">Basic Salary</option><option value="gross">Gross Salary</option>
          </select>
        </Field>
        <Field label="Rounding"><select className={inp} disabled={!edit} value={policy.rounding} onChange={(e) => set({ rounding: e.target.value as PayrollPolicy["rounding"] })}><option value="rupee">Nearest rupee</option><option value="paisa">Two decimals</option></select></Field>
        <Field label="Punched in, never punched out" hint="Such a day is always shown with a warning">
          <select className={inp} disabled={!edit} value={policy.incompleteDay} onChange={(e) => set({ incompleteDay: e.target.value as PayrollPolicy["incompleteDay"] })}>
            <option value="paid-flag">Pay it, flag for verification</option><option value="review">Needs an HR decision</option>
          </select>
        </Field>
      </div>

      <div className="bg-white rounded-xl shadow p-4 grid md:grid-cols-3 gap-4">
        <h3 className="md:col-span-3 font-semibold">Leave &amp; holidays</h3>
        <Field label="Annual leave (days/year)">{num(policy.leave.annualEntitlement, (n) => setLeave({ annualEntitlement: n }))}</Field>
        <Field label="Accrual per month (days)">{num(policy.leave.accrualPerMonth, (n) => setLeave({ accrualPerMonth: n }))}</Field>
        <Field label="Leave year starts in month (1–12)">{num(policy.leave.leaveYearStartMonth, (n) => setLeave({ leaveYearStartMonth: n }))}</Field>
        <Field label="Accrual becomes usable"><select className={inp} disabled={!edit} value={policy.leave.accrualTiming} onChange={(e) => setLeave({ accrualTiming: e.target.value as never })}><option value="start-of-month">From the 1st of the month</option><option value="end-of-month">After the month ends</option></select></Field>
        <Field label="Joined after day… gets no/partial accrual that month">{num(policy.leave.joiningCutoffDay, (n) => setLeave({ joiningCutoffDay: n }))}</Field>
        <Field label="Late joiner accrual"><select className={inp} disabled={!edit} value={policy.leave.lateJoinerAccrual} onChange={(e) => setLeave({ lateJoinerAccrual: e.target.value as never })}><option value="none">None for that month</option><option value="prorate">Pro-rata by days</option></select></Field>
        <Field label="Rounding of balance"><select className={inp} disabled={!edit} value={policy.leave.accrualRounding} onChange={(e) => setLeave({ accrualRounding: e.target.value as never })}><option value="none">None</option><option value="half-day">Down to half day</option><option value="down">Down to whole day</option><option value="up">Up to whole day</option></select></Field>
        <Field label="Carry forward unused leave"><label><input type="checkbox" disabled={!edit} checked={policy.leave.carryForwardEnabled} onChange={(e) => setLeave({ carryForwardEnabled: e.target.checked })} /> enabled</label></Field>
        <Field label="Carry-forward cap (days)">{num(policy.leave.carryForwardMaxDays, (n) => setLeave({ carryForwardMaxDays: n }))}</Field>
        <Field label="Encashment (reported, never auto-paid)"><label><input type="checkbox" disabled={!edit} checked={policy.leave.encashmentEnabled} onChange={(e) => setLeave({ encashmentEnabled: e.target.checked })} /> enabled</label></Field>
        <Field label="Encashment cap (days)">{num(policy.leave.encashmentMaxDays, (n) => setLeave({ encashmentMaxDays: n }))}</Field>
        <Field label="Negative leave balance"><label><input type="checkbox" disabled={!edit} checked={policy.leave.negativeBalanceAllowed} onChange={(e) => setLeave({ negativeBalanceAllowed: e.target.checked })} /> allowed</label></Field>
        <Field label="Negative balance limit (days)">{num(policy.leave.negativeBalanceMaxDays, (n) => setLeave({ negativeBalanceMaxDays: n }))}</Field>
        <Field label="Paid leave types (use balance)" hint="comma separated, as named on the Leave form"><input className={inp} disabled={!edit} value={policy.leave.paidLeaveTypes.join(", ")} onChange={(e) => setLeave({ paidLeaveTypes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Field>
        <Field label="Unpaid leave types (always loss of pay)"><input className={inp} disabled={!edit} value={policy.leave.unpaidLeaveTypes.join(", ")} onChange={(e) => setLeave({ unpaidLeaveTypes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Field>
        <Field label="Company holidays per month (expected)" hint="A different number in a month raises a warning">{num(policy.holidays.expectedPerMonth, (n) => set({ holidays: { ...policy.holidays, expectedPerMonth: n } }))}</Field>
        <Field label="Holiday categories that are NOT company holidays" hint="comma separated"><input className={inp} disabled={!edit} value={policy.holidays.nonCompanyCategories.join(", ")} onChange={(e) => set({ holidays: { ...policy.holidays, nonCompanyCategories: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} /></Field>
        <Field label="Substitute holidays"><label><input type="checkbox" disabled={!edit} checked={policy.holidays.substituteHolidays} onChange={(e) => set({ holidays: { ...policy.holidays, substituteHolidays: e.target.checked } })} /> flag holidays on a weekly off</label></Field>
      </div>

      <div className="bg-white rounded-xl shadow p-4 grid md:grid-cols-3 gap-4">
        <h3 className="md:col-span-3 font-semibold">TDS (tax deducted at source)</h3>
        <Field label="How TDS is deducted">
          <select className={inp} disabled={!edit} value={policy.tds.mode} onChange={(e) => set({ tds: { ...policy.tds, mode: e.target.value as PayrollPolicy["tds"]["mode"] } })}>
            <option value="fixed">Fixed amount per employee (from the salary structure)</option>
            <option value="percent">Percentage — same % for every employee</option>
          </select>
        </Field>
        <Field label="TDS percentage (%)" hint="e.g. 10 for contractual / professional-fee payees">
          <input type="number" min={0} max={50} step="0.01" disabled={!edit || policy.tds.mode !== "percent"} value={policy.tds.percent}
            onChange={(e) => set({ tds: { ...policy.tds, percent: Number(e.target.value) } })} className={inp} />
        </Field>
        <Field label="Applied on" hint="Earned = gross less loss of pay and pro-rata (what is actually payable)">
          <select className={inp} disabled={!edit || policy.tds.mode !== "percent"} value={policy.tds.base} onChange={(e) => set({ tds: { ...policy.tds, base: e.target.value as PayrollPolicy["tds"]["base"] } })}>
            <option value="earned">Earned salary (after loss of pay)</option>
            <option value="gross">Full monthly gross</option>
          </select>
        </Field>
        <p className="md:col-span-3 text-xs text-gray-600">
          {policy.tds.mode === "percent"
            ? `Every employee's TDS = ${policy.tds.percent}% of ${policy.tds.base === "gross" ? "gross salary" : "earned salary"}, calculated each month. Any fixed TDS amount saved on a salary structure is ignored while this is on. `
            : "TDS is the fixed monthly amount saved on each salary structure. "}
          This is a flat-rate deduction, not an individual income-tax slab calculation — please confirm the rate and the basis with your tax advisor. Months already approved are never changed.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <h3 className="font-semibold">Salary components</h3>
        <p className="text-xs text-gray-500">
          Rename a component by editing its label. Remove one you do not use with the trash button — it then stops being paid or deducted from the next
          payroll run (months already approved are never changed). Basic Salary is always required. Changes apply when you press Save policy.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left bg-slate-50"><tr><th className="p-2">Label</th><th className="p-2">Type</th><th className="p-2">Key</th><th className="p-2 w-24"></th></tr></thead>
            <tbody>
              {policy.components.map((c, i) => {
                const standard = DEFAULT_COMPONENTS.some((d) => d.key === c.key);
                return (
                  <tr key={c.key} className="border-t">
                    <td className="p-2">
                      <input value={c.label} disabled={!edit} maxLength={60} aria-label={`Label for ${c.key}`}
                        onChange={(e) => set({ components: policy.components.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                        className="border rounded px-2 py-1 w-full disabled:bg-gray-100" />
                    </td>
                    <td className="p-2">
                      {edit && !standard ? (
                        <select value={c.type} onChange={(e) => set({ components: policy.components.map((x, j) => (j === i ? { ...x, type: e.target.value as SalaryComponent["type"] } : x)) })} className="border rounded px-2 py-1">
                          <option value="earning">Earning</option><option value="deduction">Deduction</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${c.type === "earning" ? "bg-green-100 text-green-800" : "bg-rose-100 text-rose-800"}`}>{c.type}</span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs text-gray-500">{c.key}</td>
                    <td className="p-2 text-right">
                      {edit && (
                        <button
                          disabled={c.key === "basicSalary"}
                          title={c.key === "basicSalary" ? "Basic Salary is required" : `Remove ${c.label}`}
                          aria-label={`Remove ${c.label}`}
                          onClick={() => set({ components: policy.components.filter((x) => x.key !== c.key) })}
                          className="px-2 py-1 rounded text-red-700 border border-red-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        >🗑 Remove</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {edit && DEFAULT_COMPONENTS.some((d) => !policy.components.some((c) => c.key === d.key)) && (
          <div className="text-sm">
            Removed standard components — add back:{" "}
            {DEFAULT_COMPONENTS.filter((d) => !policy.components.some((c) => c.key === d.key)).map((d) => (
              <button key={d.key} className="mr-2 px-2 py-0.5 rounded-full border text-xs" onClick={() => set({ components: [...policy.components, d] })}>+ {d.label}</button>
            ))}
          </div>
        )}
        {edit && (
          <div className="flex flex-wrap gap-2 items-end">
            <input placeholder="key (e.g. shiftAllowance)" value={newComp.key} onChange={(e) => setNewComp({ ...newComp, key: e.target.value })} className="border rounded px-2 py-1.5" />
            <input placeholder="Label (e.g. Shift Allowance)" value={newComp.label} onChange={(e) => setNewComp({ ...newComp, label: e.target.value })} className="border rounded px-2 py-1.5" />
            <select value={newComp.type} onChange={(e) => setNewComp({ ...newComp, type: e.target.value as never })} className="border rounded px-2 py-1.5"><option value="earning">Earning</option><option value="deduction">Deduction</option></select>
            <button className="px-3 py-1.5 rounded bg-slate-700 text-white" onClick={() => {
              const next = resolvePolicy({ ...policy, components: [...policy.components, newComp as SalaryComponent] });
              if (next.components.length === policy.components.length) { setError("Use a short camelCase key (letters/digits, starting with a letter) that is not already used."); return; }
              setError(""); set({ components: next.components }); setNewComp({ key: "", label: "", type: "earning" });
            }}>Add component</button>
          </div>
        )}
      </div>

      {edit && (
        <div className="bg-white rounded-xl shadow p-4 space-y-2">
          <label className="text-sm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I have reviewed this policy and confirm it is the company&apos;s payroll policy (needed before payroll can be approved).</label>
          <div><button onClick={save} className="px-5 py-2 rounded-lg bg-blue-700 text-white">Save policy</button></div>
          <p className="text-xs text-gray-500">Changing the policy never alters a payroll period that has already been approved.</p>
        </div>
      )}
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}
      {saved && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm" role="status">{saved}</div>}
    </div>
  );
}
