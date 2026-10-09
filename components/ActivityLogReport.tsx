"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { availableMonths } from "@/lib/attendanceMonths";
import { addDays, companyTimezone, zonedWallTimeToInstant } from "@/lib/attendancePolicy";
import { csvFromRows } from "@/lib/attendanceExport";

type Row = {
  id: string;
  employeeName: string;
  employeeEmail: string;
  activity: string;
  module: string;
  description: string;
  updatedBy: string;
  at: Date | null;
};

const PAGE = 50;
const FIRST_MONTH = "2026-01";

// Month-wise Activity Log (moved here from the Admin dashboard's "Recent
// Activity" box). Months follow company time and appear automatically.
export default function ActivityLogReport() {
  const [tzRules, setTzRules] = useState<{ timezone?: string } | null>(null);
  const [now] = useState(() => new Date());
  const [monthKey, setMonthKey] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(PAGE);

  const tz = companyTimezone(tzRules);
  const months = useMemo(() => availableMonths(now, tzRules, FIRST_MONTH), [now, tzRules]);
  const selected = months.find((m) => m.key === monthKey) || months[months.length - 1];

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "settings", "attendanceRules"))
      .then((s) => !cancelled && setTzRules(s.exists() ? (s.data() as { timezone?: string }) : null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const from = selected?.from;
  const to = selected?.to;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;

    // [start of first day, start of the day after the last day) in company time
    const start = Timestamp.fromDate(zonedWallTimeToInstant(from, "00:00", tz));
    const end = Timestamp.fromDate(zonedWallTimeToInstant(addDays(to, 1), "00:00", tz));

    getDocs(query(collection(db, "activityLogs"), where("createdAt", ">=", start), where("createdAt", "<", end), orderBy("createdAt", "desc")))
      .then((snap) => {
        if (cancelled) return;
        setRows(
          snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              employeeName: String(x.employeeName || ""),
              employeeEmail: String(x.employeeEmail || ""),
              activity: String(x.activity || ""),
              module: String(x.module || x.type || ""),
              description: String(x.description || ""),
              updatedBy: String(x.updatedBy || ""),
              at: x.createdAt?.toDate ? x.createdAt.toDate() : null,
            };
          })
        );
        setError("");
      })
      .catch((e) => {
        console.error("ACTIVITY LOG LOAD ERROR:", e);
        if (!cancelled) setError("Could not load the activity log for this month.");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [from, to, tz]);

  const modules = useMemo(() => Array.from(new Set(rows.map((r) => r.module).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (moduleFilter === "all" || r.module === moduleFilter) &&
        (!needle || `${r.employeeName} ${r.employeeEmail} ${r.activity} ${r.description} ${r.updatedBy}`.toLowerCase().includes(needle))
    );
  }, [rows, moduleFilter, search]);

  const fmt = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(d) : "—";

  const download = () => {
    if (!selected) return;
    const table: unknown[][] = [["Time", "Employee", "Email", "Activity", "Module", "Details", "Updated by"]];
    filtered.forEach((r) => table.push([fmt(r.at), r.employeeName, r.employeeEmail, r.activity, r.module, r.description, r.updatedBy || "Self"]));
    const url = URL.createObjectURL(new Blob(["﻿" + csvFromRows(table)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${selected.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const field: React.CSSProperties = {
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "var(--bg-color)",
    color: "var(--text-color)",
    fontSize: 14,
  };
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", background: "var(--table-row-alt)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", borderTop: "1px solid var(--border-color)", verticalAlign: "top", fontSize: 14 };

  return (
    <section
      aria-label="Activity log"
      style={{ background: "var(--card-bg)", color: "var(--text-color)", borderRadius: 24, padding: "clamp(16px,3vw,28px)", border: "1px solid var(--border-color)", boxShadow: "0 1px 3px rgba(0,0,0,.05)", marginTop: 24 }}
    >
      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>📢 Activity Log</h2>
      <p style={{ margin: "0 0 16px", color: "var(--text-muted)", fontSize: 14 }}>
        Everything that was changed or requested, month by month (company time: {tz}).
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
          Month
          <select
            style={field}
            value={selected?.key || ""}
            onChange={(e) => {
              setLoading(true);
              setMonthKey(e.target.value);
              setShown(PAGE);
            }}
          >
            {[...months].reverse().map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
                {m.status === "in-progress" ? " (this month)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
          Module
          <select style={field} value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setShown(PAGE); }}>
            <option value="all">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", flex: 1, minWidth: 180 }}>
          Search
          <input style={field} value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} placeholder="Employee, activity, updated by…" />
        </label>

        <button
          type="button"
          onClick={download}
          disabled={!filtered.length}
          style={{ ...field, cursor: "pointer", fontWeight: 700, background: "var(--card-bg)", opacity: filtered.length ? 1 : 0.5 }}
        >
          ⬇ Download CSV
        </button>
      </div>

      {error && <p style={{ color: "#dc2626" }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No activity found for this month and filter.</p>
      ) : (
        <>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 8px" }}>
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr><th style={th}>Time</th><th style={th}>Employee</th><th style={th}>Activity</th><th style={th}>Module</th><th style={th}>Details</th><th style={th}>Updated by</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(r.at)}</td>
                    <td style={td}>
                      <b>{r.employeeName || "—"}</b>
                      {r.employeeEmail && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{r.employeeEmail}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ background: "var(--accent-bg)", color: BRAND, padding: "5px 12px", borderRadius: 999, fontWeight: 600, fontSize: 13 }}>{r.activity}</span>
                    </td>
                    <td style={{ ...td, color: "var(--text-muted)" }}>{r.module || "—"}</td>
                    <td style={{ ...td, color: "var(--text-muted)", maxWidth: 320 }}>{r.description || "—"}</td>
                    <td style={td}>{r.updatedBy || "Self"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + 100)} style={{ ...field, marginTop: 12, cursor: "pointer", fontWeight: 700 }}>
              Show more ({filtered.length - shown} remaining)
            </button>
          )}
        </>
      )}
    </section>
  );
}

const BRAND = "#3d6fa8";
