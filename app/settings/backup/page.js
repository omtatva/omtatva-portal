"use client";

import { useRef, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Download, Upload, Database } from "lucide-react";

async function exportSettings() {
  const [settingsSnap, adminAccessSnap] = await Promise.all([
    getDocs(collection(db, "settings")),
    getDocs(collection(db, "adminAccess")),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    settings: Object.fromEntries(settingsSnap.docs.map((d) => [d.id, d.data()])),
    adminAccess: Object.fromEntries(adminAccessSnap.docs.map((d) => [d.id, d.data()])),
  };
}

async function restoreSettings(backup) {
  const writes = [];

  for (const [id, data] of Object.entries(backup.settings || {})) {
    writes.push(setDoc(doc(db, "settings", id), data, { merge: true }));
  }

  for (const [id, data] of Object.entries(backup.adminAccess || {})) {
    writes.push(setDoc(doc(db, "adminAccess", id), data, { merge: true }));
  }

  await Promise.all(writes);
}

export default function BackupPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState("");
  const fileInputRef = useRef(null);

  async function handleExport() {
    setExporting(true);
    setLastResult("");
    try {
      const backup = await exportSettings();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omtatva-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastResult("Backup downloaded.");
    } catch (error) {
      console.error("EXPORT SETTINGS ERROR:", error);
      setLastResult("Export failed — check console for details.");
    } finally {
      setExporting(false);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (
      !confirm(
        "This will overwrite current settings and admin access with the values in this backup file. Continue?"
      )
    ) {
      return;
    }

    setImporting(true);
    setLastResult("");
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await restoreSettings(backup);
      setLastResult("Backup restored successfully.");
    } catch (error) {
      console.error("IMPORT SETTINGS ERROR:", error);
      setLastResult("Restore failed — make sure this is a valid backup file exported from here.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ padding: "30px", background: "var(--bg-color)", minHeight: "100vh" }}>
      <h1
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: "var(--text-color)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Database size={28} /> Backup
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 30 }}>
        Export every Settings document (Appearance, Branding, Dashboard Layout, Leave
        Policy, Media, Security) and the Access Management list as a single JSON file, or
        restore from a previously exported file.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 20,
          maxWidth: 700,
        }}
      >
        <div
          style={{
            background: "var(--card-bg)",
            padding: 25,
            borderRadius: 18,
            boxShadow: "0 8px 25px rgba(0,0,0,.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, color: "var(--text-color)", marginBottom: 10 }}>
            <Download size={20} /> Export Settings
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 18 }}>
            Downloads a JSON snapshot of everything Settings currently controls.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              background: "#3d6fa8",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 10,
              border: "none",
              cursor: exporting ? "default" : "pointer",
              opacity: exporting ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {exporting ? "Exporting..." : "Export & Download"}
          </button>
        </div>

        <div
          style={{
            background: "var(--card-bg)",
            padding: 25,
            borderRadius: 18,
            boxShadow: "0 8px 25px rgba(0,0,0,.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, color: "var(--text-color)", marginBottom: 10 }}>
            <Upload size={20} /> Restore from Backup
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 18 }}>
            Upload a previously exported JSON file to overwrite current settings with it.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileSelected}
            style={{ display: "none" }}
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            style={{
              background: "var(--card-bg)",
              color: "#3d6fa8",
              padding: "12px 24px",
              borderRadius: 10,
              border: "2px solid #3d6fa8",
              cursor: importing ? "default" : "pointer",
              opacity: importing ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {importing ? "Restoring..." : "Choose File & Restore"}
          </button>
        </div>
      </div>

      {lastResult && (
        <p style={{ marginTop: 20, color: "var(--text-color)", fontWeight: 600 }}>{lastResult}</p>
      )}
    </div>
  );
}
