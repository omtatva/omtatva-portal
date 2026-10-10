"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AccessRestricted from "@/components/AccessRestricted";
import {
  Banner,
  CorrectionModal,
  EmployeeDetail,
  PercentBar,
  ReportStyles,
  SeverityPill,
  Stat,
  postCorrection,
  type ModalTarget,
} from "@/components/AttendanceReportViews";
import { useAccess } from "@/lib/useAccess";
import { isSuperAdminAccess } from "@/lib/superAdmin";
import { usePermission } from "@/lib/usePermission";
import { ApiClientError, downloadServerCsv, getJson, postJson, triggerDownload } from "@/lib/reportsClient";
import {
  buildReports,
  csvFromRows,
  hydrateDataset,
  type HydratedDataset,
  type ReportDataset,
} from "@/lib/attendanceExport";
import { availableMonths, ARCHIVE_START_MONTH } from "@/lib/attendanceMonths";
import type { EmployeeReport, ReportDay } from "@/lib/attendanceReport";
import { FINDING_META, runAudit, type AuditResult, type Finding } from "@/lib/attendanceAudit";
import {
  bulkChangeGate,
  compareWithLive,
  verifyBackupFile,
  type BackupFile,
  type BackupMetaRecord,
  type LiveComparison,
} from "@/lib/attendanceBackup";
import { companyTimezone, resolveShift, type PolicyRules } from "@/lib/attendancePolicy";
import BulkCorrectionDialog, { type BulkGroup } from "@/components/BulkCorrectionDialog";
import BulkPunchOutDialog, { type PunchOutRow } from "@/components/BulkPunchOutDialog";
import { groupBySuggestion, toBulkItem, type BulkResult } from "@/lib/bulkCorrection";
import { CORRECTION_STATUSES } from "@/lib/attendanceCorrection";

type Tab = "report" | "audit" | "corrections" | "backup";

type CorrectionDoc = {
  id: string;
  kind: string;
  employeeName: string;
  date: string;
  reason: string;
  changes: { field: string; from: unknown; to: unknown }[];
  by: { email?: string };
  at: string | null;
  revertedBy?: string;
};

type StoredBackup = BackupMetaRecord & { id: string; createdBy?: string; createdAtIso: string };

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export default function AttendanceReportsPage() {
  const { authUser, authReady, roleReady, role } = useAccess();
  const isSuperAdmin = isSuperAdminAccess(role);
  const { canEdit } = usePermission("attendance");

  const [tab, setTab] = useState<Tab>("report");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [data, setData] = useState<HydratedDataset | null>(null);
  const [meta, setMeta] = useState<{ timezone: string; includesDemo: boolean; generatedAt: string } | null>(null);

  // Re-evaluated every few minutes so a finished month joins the archive on
  // its own, without a reload or a deploy.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const [monthKey, setMonthKey] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditType, setAuditType] = useState<string>("all");
  const [auditShown, setAuditShown] = useState(100);

  const [modal, setModal] = useState<ModalTarget | null>(null);

  // Bulk correction: ticked audit findings -> one confirmation -> each record
  // is still corrected and audited individually by the server.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ groups: BulkGroup[]; dateRange: { from: string; to: string }; stillIncomplete: number } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string>("Leave");
  const [punchOutBulk, setPunchOutBulk] = useState<{ rows: PunchOutRow[]; dateRange: { from: string; to: string } } | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [downloading, setDownloading] = useState<string>("");

  const tz = meta?.timezone || companyTimezone(null);

  // ------------------------------------------------------------ loading
  const applyData = useCallback((ds: ReportDataset) => {
    if (ds.records.length !== ds.recordCount) {
      throw new Error("The server returned an incomplete record set. Nothing is shown — please refresh.");
    }
    setData(hydrateDataset(ds));
    setMeta({ timezone: ds.timezone, includesDemo: ds.includesDemo, generatedAt: ds.generatedAt });
    setAudit(null);
    setLoadError("");
  }, []);

  const failLoad = useCallback((error: unknown) => {
    console.error("ATTENDANCE REPORT LOAD ERROR:", error);
    setLoadError(
      error instanceof ApiClientError && error.status === 403
        ? "Only a Super Admin can view attendance reports."
        : errText(error)
    );
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      applyData(await getJson<ReportDataset>("/api/attendance/reports/dataset"));
    } catch (error) {
      failLoad(error);
    } finally {
      setLoading(false);
    }
  }, [applyData, failLoad]);

  useEffect(() => {
    if (!authReady) return;
    if (!authUser) {
      window.location.replace("/admin/login");
      return;
    }
    if (!roleReady) return;
    if (!isSuperAdmin) {
      // Safe redirect for everyone who is not a Super Admin. (The API would
      // refuse them anyway — this just avoids leaving them on an empty page.)
      const t = setTimeout(() => window.location.replace("/admin"), 2500);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    getJson<ReportDataset>("/api/attendance/reports/dataset")
      .then((ds) => !cancelled && applyData(ds))
      .catch((e) => !cancelled && failLoad(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authReady, authUser, roleReady, isSuperAdmin, applyData, failLoad]);

  // ------------------------------------------------------------ archive
  const archive = useMemo(
    () => availableMonths(now, (data?.rules as PolicyRules | null) ?? null, ARCHIVE_START_MONTH),
    [now, data]
  );
  const completed = archive.filter((m) => m.status === "completed");
  const latestCompleted = completed[completed.length - 1];

  // Default to the most recent completed month (or the first available).
  const selectedMonth =
    archive.find((m) => m.key === monthKey) || latestCompleted || archive[archive.length - 1] || null;

  const reports: EmployeeReport[] = useMemo(() => {
    if (!data || !selectedMonth) return [];
    const needle = search.trim().toLowerCase();
    return buildReports(data, { from: selectedMonth.from, to: selectedMonth.to, employeeUid: employeeFilter, now }).filter(
      (r) =>
        employeeFilter !== "all" ||
        !needle ||
        `${r.employee.name} ${r.employee.employeeId} ${r.employee.department}`.toLowerCase().includes(needle)
    );
  }, [data, selectedMonth, employeeFilter, search, now]);

  const selectedReport = employeeFilter !== "all" ? reports[0] : undefined;

  const fmtTime = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d) : "—";

  const downloadMonth = async (monthKeyToGet: string) => {
    setDownloading(monthKeyToGet);
    try {
      const { rows, filename } = await downloadServerCsv(
        `/api/attendance/reports/export?month=${encodeURIComponent(monthKeyToGet)}&employee=${encodeURIComponent(employeeFilter)}`,
        `attendance-${monthKeyToGet}.csv`
      );

      // Cross-check against the same month + employee filter on screen.
      const month = archive.find((m) => m.key === monthKeyToGet);
      let note = "";
      if (month && data) {
        const onScreen = buildReports(data, { from: month.from, to: month.to, employeeUid: employeeFilter, now }).reduce(
          (n, r) => n + r.days.length,
          0
        );
        if (rows >= 0 && rows !== onScreen) note = ` (note: ${rows} rows downloaded vs ${onScreen} on screen — refresh to re-sync)`;
      }
      setToast({ type: "ok", text: `Downloaded ${filename}${rows >= 0 ? ` — ${rows} rows` : ""}${note}.` });
    } catch (e) {
      setToast({ type: "err", text: errText(e) });
    } finally {
      setDownloading("");
    }
  };

  // ------------------------------------------------------------ audit
  const auditRange = latestCompleted ? { from: "2026-07-01", to: latestCompleted.to } : null;

  const runTheAudit = () => {
    if (!data || !auditRange) return;
    setAudit(
      runAudit({
        employees: data.employees,
        records: data.records,
        holidays: data.holidays,
        leaveDatesByUser: data.leaveDatesByUser,
        rules: data.rules,
        from: auditRange.from,
        to: auditRange.to,
        now,
      })
    );
    setAuditType("all");
    setAuditShown(100);
  };

  const auditRows = useMemo(
    () => (audit ? audit.findings.filter((f) => auditType === "all" || f.type === auditType) : []),
    [audit, auditType]
  );

  // Findings that can be bulk-corrected (not duplicates / bad ids / orphans).
  const selectableRows = useMemo(() => auditRows.filter((f) => toBulkItem(f) !== null), [auditRows]);
  const selectedFindings = useMemo(
    () => (audit ? audit.findings.filter((f) => selected.has(f.id) && toBulkItem(f) !== null) : []),
    [audit, selected]
  );
  const allTicked = selectableRows.length > 0 && selectableRows.every((f) => selected.has(f.id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (selectableRows.every((f) => next.has(f.id))) selectableRows.forEach((f) => next.delete(f.id));
      else selectableRows.forEach((f) => next.add(f.id));
      return next;
    });

  const rangeOf = (list: Finding[]) => {
    const dates = list.map((f) => f.date).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  };

  // how many of the ticked records have a punch-in but no punch-out
  const countStillIncomplete = (list: Finding[]) =>
    list.filter((f) => {
      const rec = data?.records.find((r) => r.id === f.recordId);
      return !!rec && !!rec.punchIn && !rec.punchOut;
    }).length;

  const openSuggested = () => {
    const groups = groupBySuggestion(selectedFindings).map((g) => ({ status: g.status, items: g.items }));
    if (groups.length === 0) return;
    const suggested = selectedFindings.filter((f) => f.proposedStatus);
    setBulk({ groups, dateRange: rangeOf(suggested), stillIncomplete: countStillIncomplete(suggested) });
  };

  // Records with a punch-in but no punch-out among the ticked findings.
  const missingPunchOutCount = selectedFindings.filter((f) => f.type === "missing-punch-out").length;

  const openPunchOut = () => {
    if (!data) return;
    const picked = selectedFindings.filter((f) => f.type === "missing-punch-out");
    const rows: PunchOutRow[] = [];
    for (const f of picked) {
      const rec = data.records.find((r) => r.id === f.recordId);
      if (!rec) continue;
      const emp = data.employees.find((e) => e.uid === f.userId);
      const snap = rec.shiftSnapshot;
      const base = resolveShift(data.rules, rec.shiftId || emp?.shiftId);
      rows.push({
        recordId: rec.id,
        name: emp?.name || f.employeeName,
        date: rec.date,
        punchIn: rec.punchIn,
        shiftEndAt: rec.shiftEndAt,
        shift: snap?.startTime ? { ...base, ...snap } as typeof base : base,
      });
    }
    if (rows.length) setPunchOutBulk({ rows, dateRange: rangeOf(picked) });
  };

  const openSetStatus = () => {
    const items = selectedFindings.map((f) => toBulkItem(f)!).filter(Boolean);
    if (items.length === 0) return;
    setBulk({ groups: [{ status: bulkStatus, items }], dateRange: rangeOf(selectedFindings), stillIncomplete: countStillIncomplete(selectedFindings) });
  };

  const onBulkFinished = async (r: BulkResult) => {
    setSelected(new Set());
    setToast({
      type: r.failed ? "err" : "ok",
      text: `Bulk correction finished: ${r.updated} updated, ${r.created} created, ${r.skipped} skipped, ${r.failed} failed. Press “Run audit” again to see what is left.`,
    });
    await loadAll();
  };

  const exportAudit = (format: "csv" | "json") => {
    if (!audit) return;
    if (format === "json") {
      triggerDownload(
        new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" }),
        `attendance-audit_${audit.range.from}_${audit.range.to}.json`
      );
    } else {
      const rows: unknown[][] = [["Severity", "Type", "Employee", "Date", "Record id", "Problem", "Suggested review", "Proposed status"]];
      audit.findings.forEach((f) =>
        rows.push([f.severity, FINDING_META[f.type].label, f.employeeName, f.date, f.recordId, f.message, f.suggestion, f.proposedStatus || ""])
      );
      triggerDownload(new Blob(["﻿" + csvFromRows(rows)], { type: "text/csv" }), `attendance-audit_${audit.range.from}_${audit.range.to}.csv`);
    }
  };

  const openCorrectionForFinding = (f: Finding) => {
    if (!data) return;
    const rec = data.records.find((r) => r.id === f.recordId);
    const emp = data.employees.find((e) => e.uid === f.userId);
    if (rec) setModal({ mode: "update", record: rec, employeeName: emp?.name || f.employeeName, date: rec.date, proposedStatus: f.proposedStatus });
    else if (f.type === "missing-record" && emp) setModal({ mode: "create", userId: emp.uid, employeeName: emp.name, date: f.date, proposedStatus: null });
  };

  const openCorrectionForDay = (employeeUid: string, employeeName: string, day: ReportDay) => {
    if (day.record) setModal({ mode: "update", record: day.record, employeeName, date: day.date, proposedStatus: null });
    else setModal({ mode: "create", userId: employeeUid, employeeName, date: day.date, proposedStatus: null });
  };

  // ------------------------------------------------------------ gate
  if (!authReady || !roleReady) return <div style={{ padding: 30, color: "var(--text-muted)" }}>Loading…</div>;
  if (!authUser) return null;
  if (!isSuperAdmin) {
    return <AccessRestricted message="Attendance Reports are available to the Super Admin only. Taking you back to the dashboard…" />;
  }

  return (
    <div className="ar-page">
      <ReportStyles />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(26px,4vw,38px)", fontWeight: 800 }}>📈 Attendance Reports &amp; Audit</h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-muted)" }}>
            Super Admin only · monthly archive · company time ({tz}) · reports and the audit never change data.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <button className="ar-btn ar-ghost" onClick={loadAll} disabled={loading}>
            {loading ? "Loading…" : "↻ Refresh data"}
          </button>
          <a href="/admin/attendance" className="ar-btn ar-dark">← Attendance</a>
        </div>
      </div>

      {loadError && <Banner tone="err">{loadError}</Banner>}
      {meta?.includesDemo && (
        <Banner tone="info">
          <b>Test project:</b> flagged demo records are included and shown as DEMO. Production never includes them.
        </Banner>
      )}
      {toast && (
        <Banner tone={toast.type === "ok" ? "ok" : "err"}>
          {toast.text} <button className="ar-link" onClick={() => setToast(null)}>dismiss</button>
        </Banner>
      )}

      <div className="ar-tabs">
        {(
          [
            ["report", "Monthly report"],
            ["audit", "Audit"],
            ["corrections", "Corrections log"],
            ["backup", "Backup & rollback"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} className="ar-tab" data-active={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {/* ======================= MONTHLY REPORT ======================= */}
      {tab === "report" && (
        <>
          <div className="ar-card">
            <h3 style={{ margin: "0 0 4px" }}>Monthly archive</h3>
            <p className="ar-note" style={{ marginTop: 0 }}>
              A month joins the archive automatically when it ends. Downloads use the employee filter below (
              {employeeFilter === "all" ? "all employees" : data?.employees.find((e) => e.uid === employeeFilter)?.name}).
            </p>
            {archive.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No months available yet.</p>
            ) : (
              <div className="ar-months">
                {[...archive].reverse().map((m) => (
                  <div key={m.key} className="ar-month" data-active={selectedMonth?.key === m.key}>
                    <button className="ar-month-main" onClick={() => setMonthKey(m.key)}>
                      <b>{m.label}</b>
                      <span className="ar-sub">{m.status === "completed" ? "Completed" : "In progress — not final"}</span>
                    </button>
                    <button className="ar-btn ar-ghost ar-small" onClick={() => downloadMonth(m.key)} disabled={!!downloading || loading}>
                      {downloading === m.key ? "…" : "⬇ Download CSV"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ar-card">
            <div className="ar-filters">
              <label>
                Month
                <select value={selectedMonth?.key || ""} onChange={(e) => setMonthKey(e.target.value)}>
                  {[...archive].reverse().map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                      {m.status === "in-progress" ? " (in progress)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Employee
                <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                  <option value="all">All employees</option>
                  {data?.employees.map((e) => (
                    <option key={e.uid} value={e.uid}>
                      {e.name}
                      {e.employeeId ? ` (${e.employeeId})` : ""}
                      {e.inactive ? " — inactive" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {employeeFilter === "all" && (
                <label style={{ flex: 1, minWidth: 180 }}>
                  Search
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, employee ID or department" />
                </label>
              )}
              {selectedMonth && (
                <button className="ar-btn ar-primary" onClick={() => downloadMonth(selectedMonth.key)} disabled={!!downloading || loading}>
                  ⬇ Download CSV
                </button>
              )}
            </div>

            <p className="ar-note">
              Attendance % = (Present + Late) ÷ eligible scheduled working days. Weekly offs, holidays, approved leave and days not
              yet happened are excluded. A missing record is <b>never</b> counted as Present — it shows as “No record”.
              {selectedMonth?.status === "in-progress" && <b> This month is still in progress; figures are not final.</b>}
            </p>

            {loading ? (
              <p style={{ color: "var(--text-muted)" }}>Loading attendance…</p>
            ) : !selectedMonth ? (
              <p style={{ color: "var(--text-muted)" }}>No month selected.</p>
            ) : !selectedReport ? (
              <div className="ar-scroll">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Employee</th><th>Department / designation</th><th>Present</th><th>Absent</th><th>Incomplete</th><th>Leave</th><th>Holiday</th><th>Weekly off</th><th>No record</th><th>Eligible</th><th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => {
                      const c = r.summary.counts;
                      return (
                        <tr key={r.employee.uid} className="ar-click" onClick={() => setEmployeeFilter(r.employee.uid)}>
                          <td><b>{r.employee.name}</b><div className="ar-sub">ID {r.employee.employeeId || "—"}</div></td>
                          <td className="ar-sub">{[r.employee.department, r.employee.designation].filter(Boolean).join(" · ") || "—"}</td>
                          <td>{c.present + c.late}</td>
                          <td>{c.absent}</td>
                          <td>{c.incomplete}</td>
                          <td>{c.leave}</td>
                          <td>{c.holiday}</td>
                          <td>{c["weekly-off"]}</td>
                          <td style={{ color: c["no-record"] ? "#be123c" : undefined, fontWeight: c["no-record"] ? 700 : 400 }}>{c["no-record"]}</td>
                          <td>{r.summary.expectedDays}</td>
                          <td><PercentBar value={r.summary.percentage} /></td>
                        </tr>
                      );
                    })}
                    {reports.length === 0 && (
                      <tr><td colSpan={11} style={{ padding: 18, color: "var(--text-muted)" }}>No employees match.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmployeeDetail
                report={selectedReport}
                tz={tz}
                fmtTime={fmtTime}
                canEdit={canEdit}
                onCorrect={(day) => openCorrectionForDay(selectedReport.employee.uid, selectedReport.employee.name, day)}
                onBack={() => setEmployeeFilter("all")}
              />
            )}
          </div>
        </>
      )}

      {/* ============================= AUDIT ============================ */}
      {tab === "audit" && (
        <div className="ar-card">
          <Banner tone="info">
            <b>Read-only.</b> The audit scans every attendance record in the completed months and lists problems for a person to
            review. Nothing is changed, moved or deleted by running it, and nothing is fixed automatically.
          </Banner>

          <p className="ar-note">
            <b>One record:</b> press “Review &amp; correct” on a row. <b>Many records:</b> tick the boxes (or the top box to tick
            everything matching the filter), then use the bar that appears — “Apply suggested fix”, “Set status…”, or, for
            days with a punch-in but no punch-out, “Set punch-out…”.
            Both need a reason; completed months also need a verified backup, and every record is logged separately.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <button className="ar-btn ar-primary" onClick={runTheAudit} disabled={loading || !auditRange}>
              ▶ Run audit{auditRange ? ` (${auditRange.from} → ${auditRange.to})` : ""}
            </button>
            {audit && (
              <>
                <button className="ar-btn ar-ghost" onClick={() => exportAudit("csv")}>⬇ CSV</button>
                <button className="ar-btn ar-ghost" onClick={() => exportAudit("json")}>⬇ JSON</button>
              </>
            )}
          </div>

          {!audit ? (
            <p style={{ color: "var(--text-muted)" }}>Press “Run audit” to generate the report.</p>
          ) : (
            <>
              <div className="ar-stats">
                <Stat label="Records scanned" value={audit.recordsScanned} />
                <Stat label="Employees" value={audit.employeesScanned} />
                <Stat label="High severity" value={audit.bySeverity.high} tone="#dc2626" />
                <Stat label="Medium" value={audit.bySeverity.medium} tone="#c2410c" />
                <Stat label="Low" value={audit.bySeverity.low} tone="#64748b" />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
                <button className="ar-chip" data-active={auditType === "all"} onClick={() => { setAuditType("all"); setAuditShown(100); }}>
                  All ({audit.findings.length})
                </button>
                {Object.entries(audit.byType).map(([type, n]) => (
                  <button key={type} className="ar-chip" data-active={auditType === type} onClick={() => { setAuditType(type); setAuditShown(100); }}>
                    {FINDING_META[type as keyof typeof FINDING_META].label} ({n})
                  </button>
                ))}
              </div>

              {canEdit && selected.size > 0 && (
                <div className="ar-bulkbar" role="region" aria-label="Bulk actions">
                  <b>{selectedFindings.length} selected</b>
                  <button className="ar-btn ar-primary ar-small" onClick={openSuggested} disabled={!selectedFindings.some((f) => f.proposedStatus)}>
                    Apply suggested fix ({selectedFindings.filter((f) => f.proposedStatus).length})
                  </button>
                  <span className="ar-sub">or set all to</span>
                  <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} aria-label="Status for all selected">
                    {CORRECTION_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <button className="ar-btn ar-ghost ar-small" onClick={openSetStatus}>Set status…</button>
                  {missingPunchOutCount > 0 && (
                    <button className="ar-btn ar-primary ar-small" onClick={openPunchOut}>
                      Set punch-out… ({missingPunchOutCount})
                    </button>
                  )}
                  <button className="ar-link ar-sub" onClick={() => setSelected(new Set())}>Clear selection</button>
                </div>
              )}

              {audit.findings.length === 0 ? (
                <p style={{ color: "#15803d", fontWeight: 700 }}>✓ No problems found in the scanned range.</p>
              ) : (
                <div className="ar-scroll">
                  <table className="ar-table">
                    <thead>
                      <tr>
                        <th style={{ width: 34 }}>
                          {canEdit && selectableRows.length > 0 && (
                            <input type="checkbox" checked={allTicked} onChange={toggleAll} aria-label={`Select all ${selectableRows.length} matching records`} title={`Select all ${selectableRows.length} matching`} />
                          )}
                        </th>
                        <th>Severity</th><th>Employee</th><th>Date</th><th>Problem</th><th>Suggested review</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.slice(0, auditShown).map((f) => (
                        <tr key={f.id} style={selected.has(f.id) ? { background: "rgba(61,111,168,.08)" } : undefined}>
                          <td>
                            {canEdit && toBulkItem(f) !== null && (
                              <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleOne(f.id)} aria-label={`Select ${f.employeeName} ${f.date}`} />
                            )}
                          </td>
                          <td><SeverityPill s={f.severity} /></td>
                          <td><b>{f.employeeName}</b></td>
                          <td style={{ whiteSpace: "nowrap" }}>{f.date}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{FINDING_META[f.type].label}</div>
                            <div className="ar-sub">{f.message}</div>
                          </td>
                          <td className="ar-sub">{f.suggestion}</td>
                          <td>
                            {canEdit && (f.recordId || f.type === "missing-record") && f.type !== "duplicate-records" && (
                              <button className="ar-btn ar-ghost ar-small" onClick={() => openCorrectionForFinding(f)}>Review &amp; correct</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditRows.length > auditShown && (
                    <button className="ar-btn ar-ghost" style={{ marginTop: 12 }} onClick={() => setAuditShown((n) => n + 200)}>
                      Show more ({auditRows.length - auditShown} remaining)
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "corrections" && <CorrectionsLog canEdit={canEdit} tz={tz} onChanged={loadAll} onToast={setToast} />}

      {tab === "backup" && auditRange && <BackupPanel range={auditRange} onToast={setToast} tz={tz} onChanged={loadAll} />}
      {tab === "backup" && !auditRange && (
        <div className="ar-card">
          <p style={{ color: "var(--text-muted)" }}>No completed month yet — there is nothing to back up.</p>
        </div>
      )}

      {punchOutBulk && (
        <BulkPunchOutDialog
          rows={punchOutBulk.rows}
          tz={tz}
          dateRange={punchOutBulk.dateRange}
          onClose={() => setPunchOutBulk(null)}
          onFinished={onBulkFinished}
        />
      )}

      {bulk && (
        <BulkCorrectionDialog
          groups={bulk.groups}
          dateRange={bulk.dateRange}
          stillIncomplete={bulk.stillIncomplete}
          onClose={() => setBulk(null)}
          onFinished={onBulkFinished}
        />
      )}

      {modal && (
        <CorrectionModal
          target={modal}
          tz={tz}
          onClose={() => setModal(null)}
          onDone={async (text) => {
            setModal(null);
            setToast({ type: "ok", text });
            await loadAll();
          }}
        />
      )}
    </div>
  );
}

// =====================================================================
// Corrections log
// =====================================================================
function CorrectionsLog({
  canEdit,
  tz,
  onChanged,
  onToast,
}: {
  canEdit: boolean;
  tz: string;
  onChanged: () => void | Promise<void>;
  onToast: (t: { type: "ok" | "err"; text: string }) => void;
}) {
  const [rows, setRows] = useState<CorrectionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revert, setRevert] = useState<CorrectionDoc | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await getJson<{ corrections: CorrectionDoc[] }>("/api/attendance/reports/corrections")).corrections);
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getJson<{ corrections: CorrectionDoc[] }>("/api/attendance/reports/corrections")
      .then((r) => !cancelled && setRows(r.corrections))
      .catch((e) => !cancelled && setError(errText(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const fmtAt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

  const doRevert = async () => {
    if (!revert) return;
    setBusy(true);
    try {
      await postCorrection({ kind: "revert", correctionId: revert.id, reason });
      onToast({ type: "ok", text: `Correction for ${revert.employeeName} (${revert.date}) was reverted.` });
      setRevert(null);
      setReason("");
      await load();
      await onChanged();
    } catch (e) {
      onToast({ type: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ar-card">
      <p className="ar-note">
        Every correction is permanent history: who, when, why, and the original and corrected values. Reverting adds a new entry;
        nothing is deleted. Corrections to a completed month need a verified backup first.
      </p>
      {error && <Banner tone="err">{error}</Banner>}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No corrections have been made yet.</p>
      ) : (
        <div className="ar-scroll">
          <table className="ar-table">
            <thead><tr><th>When</th><th>By</th><th>Employee · date</th><th>Type</th><th>Changes (original → corrected)</th><th>Reason</th><th /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtAt(c.at)}</td>
                  <td className="ar-sub">{c.by?.email}</td>
                  <td><b>{c.employeeName}</b><div className="ar-sub">{c.date}</div></td>
                  <td>{c.kind}{c.revertedBy ? " (reverted)" : ""}</td>
                  <td className="ar-sub">
                    {c.kind === "revert"
                      ? "Restored earlier values"
                      : c.changes?.map((ch) => (
                          <div key={ch.field}>{ch.field}: {String(ch.from ?? "—")} → <b>{String(ch.to ?? "—")}</b></div>
                        ))}
                  </td>
                  <td className="ar-sub" style={{ maxWidth: 260 }}>{c.reason}</td>
                  <td>
                    {canEdit && c.kind === "update" && !c.revertedBy && (
                      <button className="ar-btn ar-ghost ar-small" onClick={() => { setRevert(c); setReason(""); }}>Revert</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {revert && (
        <div className="ar-overlay" role="dialog" aria-modal="true">
          <div className="ar-modal">
            <h2 style={{ marginTop: 0 }}>Revert correction</h2>
            <p className="ar-sub">{revert.employeeName} · {revert.date}. Only possible if the record hasn’t been changed since.</p>
            <label className="ar-block">
              Reason (required)
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button className="ar-btn ar-ghost" onClick={() => setRevert(null)} disabled={busy}>Cancel</button>
              <button className="ar-btn ar-primary" onClick={doRevert} disabled={busy || reason.trim().length < 10}>
                {busy ? "Reverting…" : "Revert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Backup & rollback (all server-mediated, Super Admin only)
// =====================================================================
function BackupPanel({
  range,
  onToast,
  tz,
  onChanged,
}: {
  range: { from: string; to: string };
  onToast: (t: { type: "ok" | "err"; text: string }) => void;
  tz: string;
  onChanged: () => void | Promise<void>;
}) {
  const [backups, setBackups] = useState<StoredBackup[]>([]);
  const [busy, setBusy] = useState(false);
  const [verifyInfo, setVerifyInfo] = useState<{
    fileOk: boolean;
    problems: string[];
    backupId: string | null;
    sha256: string | null;
    matchesStored: boolean | null;
    comparison: LiveComparison | null;
  } | null>(null);

  const loadBackups = useCallback(async () => {
    try {
      setBackups((await getJson<{ backups: StoredBackup[] }>("/api/attendance/reports/backups")).backups);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getJson<{ backups: StoredBackup[] }>("/api/attendance/reports/backups")
      .then((r) => !cancelled && setBackups(r.backups))
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const file = await postJson<BackupFile>("/api/attendance/reports/backup-create", range);
      triggerDownload(
        new Blob([JSON.stringify(file)], { type: "application/json" }),
        `attendance-backup_${range.from}_${range.to}_${file.meta.backupId}.json`
      );
      onToast({ type: "ok", text: `Backup created: ${file.meta.count} records. Keep the downloaded file safe, then verify it below.` });
      await loadBackups();
    } catch (e) {
      onToast({ type: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setVerifyInfo(null);
    try {
      const parsed = JSON.parse(await f.text()) as BackupFile;
      const check = await verifyBackupFile(parsed);
      const stored = backups.find((b) => b.backupId === parsed?.meta?.backupId);
      let comparison: LiveComparison | null = null;
      if (check.ok) {
        const live = await getJson<{ records: { id: string; data: Record<string, unknown> }[] }>(
          `/api/attendance/reports/live-snapshot?from=${parsed.meta.range.from}&to=${parsed.meta.range.to}`
        );
        comparison = compareWithLive(parsed, live.records);
      }
      setVerifyInfo({
        fileOk: check.ok,
        problems: check.problems,
        backupId: check.ok ? parsed.meta.backupId : null,
        sha256: check.ok ? parsed.meta.sha256 : null,
        matchesStored: stored ? stored.sha256 === parsed.meta.sha256 : null,
        comparison,
      });
    } catch (e) {
      setVerifyInfo({
        fileOk: false,
        problems: [e instanceof ApiClientError ? e.message : "That file could not be read as an attendance backup."],
        backupId: null,
        sha256: null,
        matchesStored: null,
        comparison: null,
      });
    } finally {
      setBusy(false);
    }
  };

  const markVerified = async () => {
    if (!verifyInfo?.backupId || !verifyInfo.sha256) return;
    setBusy(true);
    try {
      await postJson("/api/attendance/reports/backup-verify", { backupId: verifyInfo.backupId, sha256: verifyInfo.sha256 });
      onToast({ type: "ok", text: "Backup marked as verified." });
      setVerifyInfo(null);
      await loadBackups();
      await onChanged();
    } catch (e) {
      onToast({ type: "err", text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  const gate = bulkChangeGate(
    backups.map((b) => ({ backupId: b.backupId || b.id, createdAt: b.createdAtIso, verifiedAt: b.verifiedAt, range: b.range, count: b.count, sha256: b.sha256 })),
    range
  );

  const fmt = (iso?: string | null) =>
    iso ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

  return (
    <div className="ar-card">
      <div className={`ar-gate ${gate.allowed ? "ok" : "no"}`} role="status">
        <b>Corrections to completed months: {gate.allowed ? "allowed" : "locked"}</b> — {gate.reason}
        <div className="ar-sub">
          The server enforces this: a correction to a completed month is refused without a verified backup under 24 hours old and a Super Admin.
        </div>
      </div>

      <h3 style={{ marginBottom: 6 }}>1 · Create a backup</h3>
      <p className="ar-note">
        Saves every attendance record dated {range.from} to {range.to} to a file on your computer and records its checksum. Read-only: no attendance data changes.
      </p>
      <button className="ar-btn ar-primary" onClick={create} disabled={busy}>⬇ Create &amp; download backup</button>

      <h3 style={{ margin: "26px 0 6px" }}>2 · Verify a backup file</h3>
      <p className="ar-note">Choose the downloaded file. It is checked for corruption, matched with the checksum stored when it was created, and compared with the live data.</p>
      <input type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0] || null)} disabled={busy} />

      {verifyInfo && (
        <div className="ar-verify">
          <div>{verifyInfo.fileOk ? "✓ File is intact (count and checksum match)." : "✗ File problem:"}</div>
          {verifyInfo.problems.map((p) => <div key={p} style={{ color: "#dc2626" }}>{p}</div>)}
          {verifyInfo.fileOk && (
            <div>
              {verifyInfo.matchesStored === true && "✓ Matches the checksum recorded when it was created."}
              {verifyInfo.matchesStored === false && <span style={{ color: "#dc2626" }}>✗ Does not match the checksum recorded for this backup id.</span>}
              {verifyInfo.matchesStored === null && <span style={{ color: "#c2410c" }}>No stored checksum found for this backup id — it can’t be marked verified.</span>}
            </div>
          )}
          {verifyInfo.comparison && (
            <div className="ar-sub">
              Compared with live data: {verifyInfo.comparison.identical} identical · {verifyInfo.comparison.changedSinceBackup.length} changed since the backup ·{" "}
              {verifyInfo.comparison.missingNow.length} missing now · {verifyInfo.comparison.newSinceBackup.length} newer than the backup.
            </div>
          )}
          {verifyInfo.fileOk && verifyInfo.matchesStored === true && (
            <button className="ar-btn ar-primary" style={{ marginTop: 10 }} onClick={markVerified} disabled={busy}>Mark this backup as verified</button>
          )}
        </div>
      )}

      <h3 style={{ margin: "26px 0 6px" }}>Backups</h3>
      {backups.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No backups yet.</p>
      ) : (
        <div className="ar-scroll">
          <table className="ar-table">
            <thead><tr><th>Created</th><th>By</th><th>Range</th><th>Records</th><th>Checksum</th><th>Verified</th></tr></thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{fmt(b.createdAtIso)}</td>
                  <td className="ar-sub">{b.createdBy}</td>
                  <td>{b.range.from} → {b.range.to}</td>
                  <td>{b.count}</td>
                  <td className="ar-sub" title={b.sha256}>{b.sha256.slice(0, 12)}…</td>
                  <td>{b.verifiedAt ? `✓ ${fmt(b.verifiedAt)}` : "not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ margin: "26px 0 6px" }}>Rollback</h3>
      <ul className="ar-note" style={{ paddingLeft: 18 }}>
        <li><b>One correction:</b> Corrections log → Revert (restores the original values if nothing changed since).</li>
        <li><b>Many records:</b> restore from a verified backup with <code>scripts/attendance-restore.ts</code> (dry-run by default).</li>
        <li>Full plan: <code>docs/attendance-migration-plan.md</code>.</li>
      </ul>
    </div>
  );
}
