"use client";

import { useState } from "react";
import { useAccess } from "@/lib/useAccess";
import { usePermission } from "@/lib/usePermission";
import RunTab from "@/components/payroll/RunTab";
import SalaryUploadTab from "@/components/payroll/SalaryUploadTab";
import PolicyTab from "@/components/payroll/PolicyTab";
import HistoryTab from "@/components/payroll/HistoryTab";

const TABS = [
  ["run", "Run payroll"],
  ["upload", "Upload salary sheet"],
  ["policy", "Policy & leave rules"],
  ["history", "History"],
] as const;

export default function PayrollPage() {
  const { isAdminTier, isSuperAdmin, authReady, roleReady } = useAccess();
  const salary = usePermission("salaryStructure");
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("run");

  if (!authReady || !roleReady) return <div className="p-10 text-gray-500">Loading…</div>;
  if (!isAdminTier) return <div className="p-10 text-red-700">You do not have access to Payroll.</div>;

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-8">
      <div className="flex items-center gap-4 mb-1">
        <button onClick={() => (window.location.href = "/admin")} className="px-4 py-2 rounded-lg bg-[#3d6fa8] text-white text-sm font-semibold">← Dashboard</button>
        <h1 className="text-2xl sm:text-3xl font-bold">💰 Payroll</h1>
      </div>
      <p className="text-gray-500 mb-5">Calculate salaries from attendance and leave, review, approve, then issue payslips. Every step is audited.</p>

      <div className="flex gap-2 mb-5 overflow-x-auto" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${tab === k ? "bg-slate-800 text-white" : "bg-white border"}`}>{label}</button>
        ))}
      </div>

      {tab === "run" && <RunTab isSuperAdmin={isSuperAdmin} />}
      {tab === "upload" && <SalaryUploadTab canEdit={salary.canEdit} />}
      {tab === "policy" && <PolicyTab isSuperAdmin={isSuperAdmin} />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
