// The report dataset (what the Super Admin report API returns) and the
// monthly CSV built from it. The on-screen report and the CSV both start from
// buildReports(), so a download always matches what the filters show.
//
// Privacy: the dataset deliberately carries NO email, phone, address,
// salary, bank or document data — only what the report displays.

import {
  KIND_LABEL,
  buildEmployeeReport,
  expandLeaveDates,
  normalizeRecord,
  type AttendanceRecord,
  type EmployeeReport,
  type ReportEmployee,
} from "./attendanceReport";
import { companyTimezone, type PolicyRules } from "./attendancePolicy";
import type { AttendanceRules } from "./attendanceRules";
import type { ArchiveMonth } from "./attendanceMonths";

export type DatasetEmployee = {
  uid: string;
  name: string;
  employeeId: string;
  department: string;
  designation: string;
  shiftId: string | null;
  joiningDate: string;
  inactive: boolean;
};

export type ReportDataset = {
  generatedAt: string;
  timezone: string;
  // true only in the separate test project, where flagged demo records may
  // be shown. Production reports never include isDemo records.
  includesDemo: boolean;
  recordCount: number;
  employees: DatasetEmployee[];
  rules: Record<string, unknown> | null;
  holidays: string[];
  leaves: { uid: string; fromDate: string; toDate: string }[];
  records: Record<string, unknown>[];
};

export type HydratedDataset = {
  employees: (ReportEmployee & DatasetEmployee)[];
  rules: (PolicyRules & AttendanceRules) | null;
  holidays: Set<string>;
  leaveDatesByUser: Map<string, Set<string>>;
  records: AttendanceRecord[];
};

export function hydrateDataset(ds: ReportDataset): HydratedDataset {
  const byUser = new Map<string, { fromDate: string; toDate: string; status: string }[]>();
  for (const l of ds.leaves) {
    byUser.set(l.uid, [...(byUser.get(l.uid) || []), { fromDate: l.fromDate, toDate: l.toDate, status: "Approved" }]);
  }

  return {
    employees: ds.employees,
    rules: ds.rules as (PolicyRules & AttendanceRules) | null,
    holidays: new Set(ds.holidays),
    leaveDatesByUser: new Map([...byUser].map(([uid, list]) => [uid, expandLeaveDates(list)])),
    // Records without a valid id/user are impossible to attribute; the
    // server already guarantees these fields, nothing is dropped here.
    records: ds.records.map((r) => normalizeRecord(r as never)),
  };
}

export function buildReports(
  h: HydratedDataset,
  opts: { from: string; to: string; employeeUid?: string; now?: Date }
): EmployeeReport[] {
  return h.employees
    .filter((e) => !opts.employeeUid || opts.employeeUid === "all" || e.uid === opts.employeeUid)
    .map((employee) =>
      buildEmployeeReport({
        employee,
        records: h.records,
        holidays: h.holidays,
        leaveDates: h.leaveDatesByUser.get(employee.uid) || new Set(),
        rules: h.rules,
        from: opts.from,
        to: opts.to,
        now: opts.now,
      })
    );
}

// ---------------------------------------------------------------- CSV

// Spreadsheet formula injection: a text cell starting with = + - @ (or a
// tab/CR) would be executed by Excel/Sheets. Prefix such cells with ' .
export function csvSafeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvFromRows(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvSafeCell).join(",")).join("\r\n");
}

export const EXPORT_HEADER = [
  "Month",
  "Employee",
  "Employee ID",
  "Department",
  "Designation",
  "Date",
  "Weekday",
  "Status",
  "Approved leave",
  "Holiday",
  "Weekly off",
  "Shift",
  "Shift time",
  "Punch in",
  "Punch out",
  "Hours",
  "Source",
  "Demo record",
  "Flags",
  "Corrections",
  "Last corrected by",
  "Last corrected at",
  "Employee attendance % (month)",
  "Eligible days (month)",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDateTime(d: Date | null, timeZone: string): string {
  if (!d) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

export function exportRows(reports: EmployeeReport[], monthKey: string, timeZone: string): unknown[][] {
  const rows: unknown[][] = [EXPORT_HEADER];

  for (const r of reports) {
    for (const d of r.days) {
      const rec = d.record;
      const lastAt = rec?.raw.lastCorrectedAt;
      rows.push([
        monthKey,
        r.employee.name,
        r.employee.employeeId || "",
        r.employee.department || "",
        r.employee.designation || "",
        d.date,
        WEEKDAYS[d.weekday],
        d.label,
        d.kind === "leave" ? "Yes" : "",
        d.kind === "holiday" ? "Yes" : "",
        d.kind === "weekly-off" ? "Yes" : "",
        d.shiftName,
        d.shiftTimes,
        formatDateTime(rec?.punchIn || null, timeZone),
        formatDateTime(rec?.punchOut || null, timeZone),
        rec?.totalHours ? rec.totalHours : "",
        rec?.source || "",
        rec?.isDemo ? "DEMO" : "",
        d.flags.join("; "),
        rec?.correctionCount ?? 0,
        rec?.raw.lastCorrectedBy ? String(rec.raw.lastCorrectedBy) : "",
        typeof lastAt === "string" ? formatDateTime(new Date(lastAt), timeZone) : "",
        r.summary.percentage === null ? "n/a" : r.summary.percentage,
        r.summary.expectedDays,
      ]);
    }
  }
  return rows;
}

// Only [A-Za-z0-9_-] survives, so a filename can never contain a path,
// quote, newline or extension trick.
export function safeFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function exportFilename(monthKey: string, employee?: { employeeId: string; uid: string } | null): string {
  const base = `attendance-${safeFilenamePart(monthKey)}`;
  if (!employee) return `${base}.csv`;
  const part = safeFilenamePart(employee.employeeId || employee.uid);
  return part ? `${base}-${part}.csv` : `${base}.csv`;
}

export function buildMonthlyCsv(
  h: HydratedDataset,
  month: ArchiveMonth,
  employeeUid: string | "all",
  now?: Date
): { csv: string; filename: string; rowCount: number; reports: EmployeeReport[] } {
  const reports = buildReports(h, { from: month.from, to: month.to, employeeUid, now });
  const tz = companyTimezone(h.rules as PolicyRules);
  const rows = exportRows(reports, month.key, tz);
  const emp = employeeUid === "all" ? null : h.employees.find((e) => e.uid === employeeUid) || null;

  return {
    csv: "﻿" + csvFromRows(rows),
    filename: exportFilename(month.key, emp),
    rowCount: rows.length - 1,
    reports,
  };
}

export { KIND_LABEL };
