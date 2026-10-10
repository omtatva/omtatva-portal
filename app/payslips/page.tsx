"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ApiClientError, getBlob, getJson } from "@/lib/reportsClient";
import type { PayslipRow } from "@/lib/payroll/apiTypes";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const label = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

// An employee sees ONLY their own payslips — the server picks the person from
// the sign-in token, never from anything in this page.
export default function MyPayslipsPage() {
  const [slips, setSlips] = useState<PayslipRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) { window.location.href = "/login"; return; }
      getJson<{ payslips: PayslipRow[] }>("/api/payroll/my-payslips")
        .then((r) => setSlips(r.payslips))
        .catch((e) => setError(e instanceof ApiClientError ? e.message : "Could not load your payslips."));
    });
    return () => off();
  }, []);

  const open = async (id: string) => {
    try {
      window.open(URL.createObjectURL(await getBlob(`/api/payroll/payslip-pdf?id=${encodeURIComponent(id)}`)), "_blank");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not open the payslip.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <h1 className="text-2xl font-bold mb-1">💰 My Payslips</h1>
      <p className="text-gray-500 mb-5">Payslips are available here after HR approves and issues the month&apos;s payroll.</p>
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4" role="alert">{error}</div>}
      {slips === null && !error && <p className="text-gray-500">Loading…</p>}
      {slips && slips.length === 0 && <div className="bg-white rounded-xl shadow p-6 text-gray-600">No payslips have been issued to you yet.</div>}
      <div className="space-y-3">
        {slips?.map((s) => (
          <div key={s.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3">
            <div><div className="font-semibold">{label(s.period)}</div><div className="text-sm text-gray-500">Net pay ₹{s.netPay.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
            <button onClick={() => open(s.id)} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm">Open PDF</button>
          </div>
        ))}
      </div>
    </div>
  );
}
