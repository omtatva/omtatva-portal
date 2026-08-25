"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldAlert, Globe2 } from "lucide-react";

const SETTINGS_REF = () => doc(db, "settings", "security");

const DEFAULTS = {
  maintenanceMode: false,
  allowedLoginDomain: "",
};

export default function SecurityPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(DEFAULTS.maintenanceMode);
  const [allowedLoginDomain, setAllowedLoginDomain] = useState(DEFAULTS.allowedLoginDomain);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      SETTINGS_REF(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMaintenanceMode(!!data.maintenanceMode);
          setAllowedLoginDomain(data.allowedLoginDomain || "");
        }
        setLoading(false);
      },
      (error) => {
        console.error("LOAD SECURITY SETTINGS ERROR:", error);
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
          maintenanceMode,
          allowedLoginDomain: allowedLoginDomain.trim().toLowerCase(),
        },
        { merge: true }
      );
      alert("Security Settings Updated");
    } catch (error) {
      console.error("SAVE SECURITY SETTINGS ERROR:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
        <h2>Loading security settings...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "30px", background: "var(--bg-color)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--text-color)" }}>
        🔐 Security
        {saving && (
          <span style={{ fontSize: 14, color: "#3d6fa8", marginLeft: 12, fontWeight: 500 }}>
            Saving...
          </span>
        )}
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 30 }}>
        Login controls that apply portal-wide, on both the employee and admin login pages.
      </p>

      <div
        style={{
          background: "var(--card-bg)",
          padding: 25,
          borderRadius: 18,
          maxWidth: 560,
          boxShadow: "0 8px 25px rgba(0,0,0,.05)",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <ShieldAlert size={22} color={maintenanceMode ? "#dc2626" : "#94a3b8"} style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <b style={{ color: "var(--text-color)" }}>Maintenance Mode</b>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
              />
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 6 }}>
              When on, only Super Admin accounts can sign in — everyone else is blocked at
              login until this is turned off again. Use this while making changes you don't
              want anyone else logged in for.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--card-bg)",
          padding: 25,
          borderRadius: 18,
          maxWidth: 560,
          boxShadow: "0 8px 25px rgba(0,0,0,.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <Globe2 size={22} color="#3d6fa8" style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <b style={{ color: "var(--text-color)" }}>Restrict Login to a Domain</b>
            <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 6, marginBottom: 12 }}>
              Only Google accounts on this domain can sign in. Leave blank to allow any
              Google account (still subject to Access Management for admin pages).
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--text-muted)" }}>@</span>
              <input
                value={allowedLoginDomain}
                onChange={(e) => setAllowedLoginDomain(e.target.value)}
                placeholder="omtatvadigitals.com"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--card-bg)",
                  color: "var(--text-color)",
                  fontSize: 14,
                }}
              />
            </div>
          </div>
        </div>
      </div>

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
        {saving ? "Saving..." : "Save Security Settings"}
      </button>
    </div>
  );
}
