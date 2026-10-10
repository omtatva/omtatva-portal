// Payroll summary exports (CSV / XLSX). They are built ONLY from the approved,
// immutable payroll entries — never from live data — and the totals are
// checked against the approved run summary before anything is returned.

import * as XLSX from "xlsx";
import type { EmployeeResult, PayrollSummary } from "./engine";
import type { SalaryComponent } from "./policy";

export type ExportMeta = {
  companyName: string;
  period: string;
  revision: number;
  approvedAt: string | null;
  approvedBy: string | null;
  digest: string;
  components: SalaryComponent[];
};

export type Cell = string | number;
export type PayrollTable = { headers: string[]; rows: Cell[][]; totals: Cell[]; numericFrom: number };

const cents = (n: number) => Math.round(n * 100);
const money = (c: number) => c / 100;
const INT_COLUMNS = new Set([4, 5]); // Days in Month, Payable Days

// Spreadsheet formula injection: a cell that starts with = + - @ (or a control
// character) would be run as a formula by Excel. Neutralise it.
export function safeCell(v: Cell): Cell {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

export function buildPayrollTable(results: EmployeeResult[], components: SalaryComponent[]): PayrollTable {
  const earnings = components.filter((c) => c.type === "earning");
  const deductions = components.filter((c) => c.type === "deduction");
  const headers = [
    "Employee ID", "Employee Name", "Department", "Designation", "Days in Month", "Payable Days",
    ...earnings.map((c) => c.label),
    "Gross Salary", "Allowances (excl. Basic)",
    "Absence Deduction", "Unpaid Leave Deduction", "Pro-rata Deduction",
    ...deductions.map((c) => c.label),
    "Total Deductions", "Net Pay",
  ];
  const numericFrom = 4; // first numeric column
  const sorted = [...results].sort((a, b) => a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true }));
  const sums = new Array(headers.length).fill(0) as number[];
  const rows: Cell[][] = sorted.map((r) => {
    const get = (key: string) => r.earnings.find((l) => l.key === key)?.amount ?? r.deductions.find((l) => l.key === key)?.amount ?? 0;
    const row: Cell[] = [
      r.employeeId, r.name, r.department, r.designation, r.daysInMonth, r.payableDays,
      ...earnings.map((c) => get(c.key)),
      r.grossEarnings, r.allowances,
      r.attendanceDeduction, r.leaveDeduction, r.notEmployedDeduction,
      ...deductions.map((c) => get(c.key)),
      r.totalDeductions, r.netPay,
    ];
    row.forEach((v, i) => {
      if (i >= numericFrom && typeof v === "number") sums[i] += INT_COLUMNS.has(i) ? 0 : cents(v);
    });
    return row;
  });
  const totals: Cell[] = headers.map((_, i) => (i === 0 ? "TOTAL" : i < numericFrom || INT_COLUMNS.has(i) ? "" : money(sums[i])));
  return { headers, rows, totals, numericFrom };
}

// Exported totals must equal the approved run summary. Returns the problems found.
export function verifyAgainstSummary(table: PayrollTable, summary: PayrollSummary): string[] {
  const idx = (h: string) => table.headers.indexOf(h);
  const total = (h: string) => cents(Number(table.totals[idx(h)] ?? 0));
  const problems: string[] = [];
  const check = (label: string, header: string, expected: number) => {
    if (total(header) !== cents(expected)) problems.push(`${label}: export ${money(total(header))} differs from approved ${expected}`);
  };
  check("Gross", "Gross Salary", summary.gross);
  check("Net pay", "Net Pay", summary.netPay);
  check("Total deductions", "Total Deductions", summary.totalDeductions);
  check("Absence deductions", "Absence Deduction", summary.attendanceDeduction);
  check("Leave deductions", "Unpaid Leave Deduction", summary.leaveDeduction);
  if (table.rows.length !== summary.ready) problems.push(`Employees: export ${table.rows.length} differs from approved ${summary.ready}`);
  return problems;
}

const csvEscape = (v: Cell, i: number) => {
  const s = typeof v === "number" ? (INT_COLUMNS.has(i) ? String(v) : v.toFixed(2)) : String(safeCell(v));
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCsv(table: PayrollTable, meta: ExportMeta): string {
  const lines: string[] = [];
  lines.push(`# ${meta.companyName} payroll ${meta.period} (revision ${meta.revision}) approved by ${meta.approvedBy || "-"} ${meta.approvedAt || ""}`.replace(/,/g, " "));
  lines.push(table.headers.map((h, i) => csvEscape(h, i)).join(","));
  for (const row of table.rows) lines.push(row.map((v, i) => csvEscape(v, i)).join(","));
  lines.push(table.totals.map((v, i) => csvEscape(v, i)).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function toXlsx(table: PayrollTable, meta: ExportMeta, summary: PayrollSummary): Uint8Array {
  const wb = XLSX.utils.book_new();
  const body = [table.headers, ...table.rows, table.totals].map((row) => row.map(safeCell));
  const ws = XLSX.utils.aoa_to_sheet(body);
  ws["!cols"] = table.headers.map((h, i) => ({ wch: i < 4 ? 20 : Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, "Payroll");

  const info: Cell[][] = [
    ["Company", meta.companyName],
    ["Payroll period", meta.period],
    ["Revision", meta.revision],
    ["Approved by", meta.approvedBy || ""],
    ["Approved at", meta.approvedAt || ""],
    ["Employees paid", summary.ready],
    ["Gross salary", summary.gross],
    ["Basic salary", summary.basic],
    ["Allowances", summary.allowances],
    ["Absence deductions", summary.attendanceDeduction],
    ["Unpaid leave deductions", summary.leaveDeduction],
    ["Other deductions (PF, ESI, PT, TDS, pro-rata)", summary.otherDeductions],
    ["  of which TDS", summary.tds],
    ["Total deductions", summary.totalDeductions],
    ["Net payable", summary.netPay],
    ["Snapshot fingerprint (SHA-256)", meta.digest],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info.map((r) => r.map(safeCell))), "Summary");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
