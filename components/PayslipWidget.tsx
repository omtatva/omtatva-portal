"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ApiClientError, getBlob, triggerDownload } from "@/lib/reportsClient";

type Item = {
  id: string; period: string; revision: number; employeeId: string; employeeName: string;
  netPay: number; publishedAt: string | null; status: "Published" | "Reissued";
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const label = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const rs = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// The employee's own Payslip widget. It listens to payslipIndex/{uid} — a
// document only the server writes and only THIS employee can read — so a
// payslip appears (or is withdrawn) the moment HR publishes, with no refresh and
// no manual editing of the dashboard. Opening/downloading goes through the
// server, which checks again that the payslip belongs to the caller.
export default function PayslipWidget() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let off = () => {};
    const stop = onAuthStateChanged(auth, (u) => {
      off();
      if (!u) return;
      off = onSnapshot(
        doc(db, "payslipIndex", u.uid),
        (snap) => setItems(snap.exists() ? ((snap.data().items as Item[]) || []) : []),
        () => { setItems([]); setError("Could not load your payslips right now."); }
      );
    });
    return () => { off(); stop(); };
  }, []);

  const open = async (id: string, download: boolean, period: string, employeeId: string) => {
    setError("");
    try {
      const blob = await getBlob(`/api/payroll/payslip-pdf?id=${encodeURIComponent(id)}`);
      if (download) triggerDownload(blob, `Payslip_${employeeId}_${period}.pdf`);
      else window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not open the payslip.");
    }
  };

  const latest = items && items.length ? items[0] : null;
  const history = items ? items.slice(1) : [];

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: 22, padding: 24, boxShadow: "0 12px 35px rgba(0,0,0,.08)", gridColumn: "span 1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>💰 My Payslips</h2>
        <a href="/documents" style={{ fontSize: 13, color: "#2563eb", textDecoration: "underline" }}>All in My Documents →</a>
      </div>

      {items === null && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {items !== null && !latest && (
        <div style={{ color: "var(--text-muted)" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>No payslip has been published yet.</p>
          <p style={{ margin: 0, fontSize: 14 }}>Your payslip will appear here automatically as soon as HR publishes the month&apos;s payroll.</p>
        </div>
      )}

      {latest && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <b style={{ fontSize: 18 }}>{label(latest.period)}</b>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: latest.status === "Reissued" ? "#fef3c7" : "#dcfce7", color: latest.status === "Reissued" ? "#92400e" : "#166534" }}>
              {latest.status}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{latest.employeeName} · {latest.employeeId}</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: "10px 0 2px" }}>{rs(latest.netPay)}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Net salary · published {day(latest.publishedAt)}{latest.status === "Reissued" ? " (corrected and reissued)" : ""}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={() => open(latest.id, false, latest.period, latest.employeeId)} style={btn("#2563eb")}>Open PDF</button>
            <button onClick={() => open(latest.id, true, latest.period, latest.employeeId)} style={btn("#475569")}>⬇ Download</button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Previous payslips</div>
          {(showAll ? history : history.slice(0, 4)).map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 14 }}>
              <span>{label(h.period)}{h.status === "Reissued" && <i style={{ color: "#92400e" }}> · reissued</i>}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)" }}>{rs(h.netPay)}</span>
                <button onClick={() => open(h.id, false, h.period, h.employeeId)} style={link}>Open</button>
                <button onClick={() => open(h.id, true, h.period, h.employeeId)} style={link}>Download</button>
              </span>
            </div>
          ))}
          {history.length > 4 && <button onClick={() => setShowAll((v) => !v)} style={{ ...link, marginTop: 6 }}>{showAll ? "Show fewer" : `Show all (${history.length})`}</button>}
        </div>
      )}

      {error && <p role="alert" style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}

const btn = (bg: string) => ({ background: bg, color: "#fff", border: "none", padding: "9px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }) as const;
const link = { background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0, fontSize: 13, textDecoration: "underline" } as const;

