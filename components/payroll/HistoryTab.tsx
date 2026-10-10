"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ApiClientError, getJson } from "@/lib/reportsClient";
import type { RunListItem, SalaryHistoryItem } from "@/lib/payroll/apiTypes";

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");

export default function HistoryTab() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [hist, setHist] = useState<SalaryHistoryItem[]>([]);
  const [legacy, setLegacy] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getJson<{ runs: RunListItem[] }>("/api/payroll/runs").then((r) => setRuns(r.runs)).catch((e) => setError(msg(e)));
    getJson<{ history: SalaryHistoryItem[] }>("/api/payroll/salary-history").then((r) => setHist(r.history)).catch(() => undefined);
    // Records created by the OLD payroll screens: shown read-only, never recalculated.
    getDocs(collection(db, "payroll")).then((s) => setLegacy(s.docs.map((d) => ({ id: d.id, ...d.data() })))).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      <section className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold mb-2">Payroll periods</h3>
        <table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Month</th><th className="p-2">Status</th><th className="p-2">Rev</th><th className="p-2">Employees</th><th className="p-2">Net payable</th><th className="p-2">Approved by</th><th className="p-2">Payslips</th></tr></thead>
          <tbody>{runs.map((r) => (
            <tr key={r.period} className="border-t"><td className="p-2">{r.period}</td><td className="p-2">{r.status}</td><td className="p-2">{r.revision}</td>
              <td className="p-2">{r.summary?.ready ?? "—"}</td><td className="p-2">{r.summary ? rs(r.summary.netPay) : "—"}</td><td className="p-2">{r.approvedBy || "—"}</td><td className="p-2">{r.payslipCount}</td></tr>
          ))}{runs.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-gray-500">No payroll has been approved yet.</td></tr>}</tbody></table>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold mb-2">Salary change history</h3>
        <table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-2">When</th><th className="p-2">Employee</th><th className="p-2">Change</th><th className="p-2">Reason</th><th className="p-2">By</th></tr></thead>
          <tbody>{hist.map((h) => (
            <tr key={h.id} className="border-t align-top"><td className="p-2 whitespace-nowrap">{h.at?.slice(0, 16).replace("T", " ")}</td><td className="p-2">{h.employeeName} ({h.employeeId})</td>
              <td className="p-2">{h.source === "delete" ? "salary structure deleted" : h.changes.map((c) => <div key={c.key}>{c.label}: {c.old ?? "—"} → <b>{c.new}</b></div>)}</td><td className="p-2">{h.reason}</td><td className="p-2">{h.by}</td></tr>
          ))}{hist.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No salary changes recorded yet.</td></tr>}</tbody></table>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold mb-1">Older payroll records (read-only)</h3>
        <p className="text-xs text-gray-500 mb-2">Created by the previous payroll screens before this workflow. They are kept for reference and are never recalculated or changed.</p>
        <table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Employee</th><th className="p-2">Month</th><th className="p-2">Gross</th><th className="p-2">Net</th></tr></thead>
          <tbody>{legacy.slice(0, 200).map((l) => (
            <tr key={String(l.id)} className="border-t"><td className="p-2">{String(l.employeeName || "")} ({String(l.employeeId || "")})</td><td className="p-2">{String(l.salaryMonth || l.month || "")}</td>
              <td className="p-2">{rs(Number(l.grossSalary || 0))}</td><td className="p-2">{rs(Number(l.netSalary || 0))}</td></tr>
          ))}{legacy.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">None.</td></tr>}</tbody></table>
      </section>
    </div>
  );
}
