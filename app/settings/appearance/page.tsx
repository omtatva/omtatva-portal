"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import {
  Palette,
  Moon,
  Sun,
  LayoutDashboard,
} from "lucide-react";

const SETTINGS_REF = () => doc(db, "settings", "appearance");

const DEFAULTS = {
  theme: "light",
  primary: "#3d6fa8",
  sidebar: "#FFFFFF",
  background: "#F8FBFF",
};

export default function AppearancePage() {
  const [theme, setTheme] = useState(DEFAULTS.theme);
  const [primary, setPrimary] = useState(DEFAULTS.primary);
  const [sidebar, setSidebar] = useState(DEFAULTS.sidebar);
  const [background, setBackground] = useState(DEFAULTS.background);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Live-load from Firestore and stay in sync, same pattern as
  // BrandingPage.tsx — so this reflects changes made from any tab/admin
  // immediately, and DashboardNavbar (which reads the same doc) picks
  // up saved changes in real time too.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      SETTINGS_REF(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setTheme(data.theme || DEFAULTS.theme);
          setPrimary(data.colors?.primary || DEFAULTS.primary);
          setSidebar(data.colors?.sidebar || DEFAULTS.sidebar);
          setBackground(data.colors?.background || DEFAULTS.background);
        }
        setLoading(false);
      },
      (error) => {
        console.error("LOAD APPEARANCE ERROR:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      await setDoc(
        SETTINGS_REF(),
        {
          theme,
          colors: { primary, sidebar, background },
        },
        { merge: true }
      );
      alert("Appearance Saved");
    } catch (error) {
      console.error("SAVE APPEARANCE ERROR:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
        <h2>Loading appearance settings...</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        background: "var(--bg-color)",
        minHeight: "100vh",
      }}
    >
      <style jsx global>{`
        @media (max-width: 600px) {
          .appearance-title {
            font-size: 24px !important;
          }
          .appearance-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .appearance-card {
            padding: 18px !important;
          }
        }
      `}</style>

      <h1
        className="appearance-title"
        style={{ fontSize: "30px", fontWeight: 700, marginBottom: "8px", color: "var(--text-color)" }}
      >
        🎨 Appearance
        {saving && (
          <span style={{ fontSize: 14, color: "#3d6fa8", marginLeft: 12, fontWeight: 500 }}>
            Saving...
          </span>
        )}
      </h1>

      <p style={{ color: "var(--text-muted)", marginBottom: "26px" }}>
        Customize your dashboard look and feel. Changes apply platform-wide
        once saved.
      </p>

      <div
        className="appearance-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: "25px",
        }}
      >
        {/* Theme Card */}
        <Card icon={<Palette />} title="Theme Mode">
          <div style={{ display: "flex", gap: 15 }}>
            <button onClick={() => setTheme("light")} style={themeBtn(theme === "light")}>
              <Sun size={20} />
              Light
            </button>

            <button onClick={() => setTheme("dark")} style={themeBtn(theme === "dark")}>
              <Moon size={20} />
              Dark
            </button>
          </div>
        </Card>

        {/* Colors */}
        <Card icon={<Palette />} title="Brand Colors">
          <ColorPicker title="Primary Color" value={primary} setValue={setPrimary} />
          <ColorPicker title="Sidebar Color" value={sidebar} setValue={setSidebar} />
          <ColorPicker title="Background Color" value={background} setValue={setBackground} />
        </Card>

        {/* Preview */}
        <Card icon={<LayoutDashboard />} title="Live Preview">
          <div
            style={{
              height: 180,
              borderRadius: 15,
              overflow: "hidden",
              border: "1px solid #ddd",
              background,
            }}
          >
            <div
              style={{
                height: 45,
                background: sidebar,
                display: "flex",
                alignItems: "center",
                padding: "0 15px",
                fontWeight: 700,
                color: primary,
              }}
            >
              OMTATVA DIGITALS
            </div>

            <div style={{ padding: 20 }}>
              <div
                style={{
                  background: primary,
                  height: 35,
                  borderRadius: 8,
                  width: "60%",
                }}
              />
            </div>
          </div>
        </Card>
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        style={{
          marginTop: 30,
          background: primary,
          color: "#fff",
          padding: "14px 35px",
          borderRadius: 12,
          border: "none",
          fontSize: 16,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

function Card({ icon, title, children }: any) {
  return (
    <div
      className="appearance-card"
      style={{
        background: "var(--card-bg)",
        borderRadius: 18,
        padding: 25,
        boxShadow: "0 8px 25px rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 20,
          color: "var(--text-color)",
        }}
      >
        {icon}
        {title}
      </div>

      {children}
    </div>
  );
}

function ColorPicker({ title, value, setValue }: any) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
        gap: 15,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontWeight: 500, color: "var(--text-color)" }}>{title}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: 45, height: 35, border: "none", cursor: "pointer" }}
        />

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#3d6fa8"
          style={{
            width: 100,
            padding: "8px",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 14,
            textTransform: "uppercase",
            background: "var(--card-bg)",
            color: "var(--text-color)",
          }}
        />
      </div>
    </div>
  );
}

function themeBtn(active: boolean) {
  return {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px",
    borderRadius: 12,
    border: active ? "2px solid #3d6fa8" : "1px solid var(--border-color)",
    background: "var(--card-bg)",
    color: "var(--text-color)",
    cursor: "pointer",
    fontWeight: 600,
  };
}