"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CalendarRange } from "lucide-react";

const SETTINGS_REF = () => doc(db, "settings", "leavePolicy");

const DEFAULTS = {
  casualLeave: 12,
  sickLeave: 10,
  paidLeave: 18,
};

export default function LeavePolicyPage() {
  const [casualLeave, setCasualLeave] = useState(DEFAULTS.casualLeave);
  const [sickLeave, setSickLeave] = useState(DEFAULTS.sickLeave);
  const [paidLeave, setPaidLeave] = useState(DEFAULTS.paidLeave);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      SETTINGS_REF(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCasualLeave(data.casualLeave ?? DEFAULTS.casualLeave);
          setSickLeave(data.sickLeave ?? DEFAULTS.sickLeave);
          setPaidLeave(data.paidLeave ?? DEFAULTS.paidLeave);
        }
        setLoading(false);
      },
      (error) => {
        console.error("LOAD LEAVE POLICY ERROR:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await setDoc(
        SETTINGS_REF(),
        {
          casualLeave: Number(casualLeave) || 0,
          sickLeave: Number(sickLeave) || 0,
          paidLeave: Number(paidLeave) || 0,
        },
        { merge: true }
      );
      alert("Leave Policy Updated");
    } catch (error) {
      console.error("SAVE LEAVE POLICY ERROR:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
        <h2>Loading leave policy...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "30px", background: "var(--bg-color)", minHeight: "100vh" }}>
      <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", padding: "14px 18px", borderRadius: 12, marginBottom: 20, maxWidth: 760 }}>
        <b>These per-type quotas are no longer used.</b> Leave balances and salary deductions now follow the company leave policy
        (annual entitlement, monthly accrual, paid / unpaid leave types, carry-forward…), which is set by a Super Admin under{" "}
        <a href="/admin/payroll" style={{ textDecoration: "underline" }}>Payroll → Policy &amp; leave rules</a>.
      </div>
      <h1
        style={{
          fontSize: "30px",
          fontWeight: 700,
          color: "var(--text-color)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <CalendarRange size={28} /> Leave Policy
        {saving && (
          <span style={{ fontSize: 14, color: "#3d6fa8", marginLeft: 12, fontWeight: 500 }}>
            Saving...
          </span>
        )}
      </h1>

      <p style={{ color: "var(--text-muted)", marginBottom: 30 }}>
        Company-wide annual leave quotas. Changes apply to every employee's leave balance
        immediately.
      </p>

      <div
        style={{
          background: "var(--card-bg)",
          padding: 25,
          borderRadius: 18,
          maxWidth: 500,
          boxShadow: "0 8px 25px rgba(0,0,0,.05)",
        }}
      >
        <QuotaField label="Casual Leave (days/year)" value={casualLeave} setValue={setCasualLeave} />
        <QuotaField label="Sick Leave (days/year)" value={sickLeave} setValue={setSickLeave} />
        <QuotaField label="Paid Leave (days/year)" value={paidLeave} setValue={setPaidLeave} />

        <button
          onClick={save}
          disabled={saving}
          style={{
            marginTop: 10,
            background: "#3d6fa8",
            color: "#fff",
            padding: "14px 35px",
            borderRadius: 12,
            border: "none",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
            fontWeight: 600,
          }}
        >
          {saving ? "Saving..." : "Save Policy"}
        </button>
      </div>
    </div>
  );
}

function QuotaField({ label, value, setValue }: any) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 0",
        borderBottom: "1px solid var(--border-color)",
        gap: 15,
      }}
    >
      <span style={{ fontWeight: 500, color: "var(--text-color)" }}>{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: 90,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-color)",
          background: "var(--card-bg)",
          color: "var(--text-color)",
          fontSize: 14,
        }}
      />
    </div>
  );
}
