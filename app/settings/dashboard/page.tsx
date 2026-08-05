"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LayoutDashboard, CheckCircle } from "lucide-react";

const SETTINGS_REF = () => doc(db, "settings", "dashboardLayout");

const DEFAULTS = {
  showAttendance: true,
  showLeave: true,
  showHoliday: true,
  showEmployee: true,
};

export default function DashboardSettingsPage() {
  const [attendance, setAttendance] = useState(DEFAULTS.showAttendance);
  const [leave, setLeave] = useState(DEFAULTS.showLeave);
  const [holiday, setHoliday] = useState(DEFAULTS.showHoliday);
  const [employee, setEmployee] = useState(DEFAULTS.showEmployee);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Same live-sync pattern as Branding/Appearance — so a change here
  // is reflected everywhere (e.g. the employee Dashboard home page,
  // once it's wired to read this same doc) without a refresh.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      SETTINGS_REF(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAttendance(data.showAttendance ?? DEFAULTS.showAttendance);
          setLeave(data.showLeave ?? DEFAULTS.showLeave);
          setHoliday(data.showHoliday ?? DEFAULTS.showHoliday);
          setEmployee(data.showEmployee ?? DEFAULTS.showEmployee);
        }
        setLoading(false);
      },
      (error) => {
        console.error("LOAD DASHBOARD LAYOUT ERROR:", error);
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
          showAttendance: attendance,
          showLeave: leave,
          showHoliday: holiday,
          showEmployee: employee,
        },
        { merge: true }
      );
      alert("Dashboard Layout Updated");
    } catch (error) {
      console.error("SAVE DASHBOARD LAYOUT ERROR:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
        <h2>Loading dashboard layout...</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "30px",
        background: "var(--bg-color)",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: "30px", fontWeight: 700, color: "var(--text-color)" }}>
        🏠 Dashboard Layout
        {saving && (
          <span style={{ fontSize: 14, color: "#3d6fa8", marginLeft: 12, fontWeight: 500 }}>
            Saving...
          </span>
        )}
      </h1>

      <p style={{ color: "var(--text-muted)", marginBottom: 30 }}>
        Control which widgets appear on dashboard
      </p>

      <div
        style={{
          background: "var(--card-bg)",
          padding: 25,
          borderRadius: 18,
          maxWidth: 600,
          boxShadow: "0 8px 25px rgba(0,0,0,.05)",
        }}
      >
        <Widget title="Attendance Card" value={attendance} setValue={setAttendance} />
        <Widget title="Leave Card" value={leave} setValue={setLeave} />
        <Widget title="Holiday Card" value={holiday} setValue={setHoliday} />
        <Widget title="Employee Card" value={employee} setValue={setEmployee} />

        <button
          onClick={save}
          disabled={saving}
          style={{
            marginTop: 25,
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
          {saving ? "Saving..." : "Save Layout"}
        </button>
      </div>
    </div>
  );
}

function Widget({ title, value, setValue }: any) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 0",
        borderBottom: "1px solid var(--border-color)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-color)" }}>
        <CheckCircle size={20} color={value ? "#3d6fa8" : "#94A3B8"} />
        {title}
      </div>

      <input type="checkbox" checked={value} onChange={(e) => setValue(e.target.checked)} />
    </div>
  );
}