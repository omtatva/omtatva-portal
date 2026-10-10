// Run with:  npm run test:payroll
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { computeEmployee, summarize, type AttendanceRec, type EmployeeInput } from "../lib/payroll/engine";
import { resolvePolicy } from "../lib/payroll/policy";
import { monthDates, weekday } from "../lib/payroll/calendar";
import { buildPayrollTable, safeCell, toCsv, toXlsx, verifyAgainstSummary, type ExportMeta } from "../lib/payroll/export";
import { buildZip, crc32, safeZipName } from "../lib/payroll/zip";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

const policy = resolvePolicy({ confirmed: true });
const P = "2026-08";
const HOL = [{ date: "2026-08-15", category: "Company" }, { date: "2026-08-26", category: "Company" }];
const work = monthDates(P).filter((d) => weekday(d) !== 0 && !HOL.some((h) => h.date === d));
const att = (absent: string[], skip: string[] = []): AttendanceRec[] => work.filter((d) => !skip.includes(d)).map((date) => ({ date, status: absent.includes(date) ? "Absent" : "Present" }));
const emp = (over: Partial<EmployeeInput>): EmployeeInput => ({
  uid: "u", employeeId: "E1", name: "A", department: "Ops", designation: "Exec", weeklyOffDays: [0], joiningDate: "2025-01-01",
  salary: { basicSalary: 30000, hra: 10000, specialAllowance: 10000, pf: 1800 }, attendance: att([]), leaveRequests: [], overrides: {}, ...over,
});

const results = [
  computeEmployee(P, policy, HOL, emp({ uid: "u1", employeeId: "E010", name: "Asha Rao" })),
  computeEmployee(P, policy, HOL, emp({ uid: "u2", employeeId: "E002", name: "Ravi, Kumar", attendance: att([work[0], work[1], work[2]]) })), // 3 absences
  computeEmployee(P, policy, HOL, emp({
    uid: "u3", employeeId: "E003", name: "=HYPERLINK(\"http://evil\",\"x\")", salary: { basicSalary: 20000, bonus: 2000, pf: 500, tds: 300 },
    attendance: att([work[3]], [work[4], work[5]]), leaveRequests: [{ id: "L", leaveType: "LOP", fromDate: work[4], toDate: work[5] }],
  })),
  computeEmployee(P, policy, HOL, emp({ uid: "u4", employeeId: "E004", name: "No Salary", salary: null })),
];
const ready = results.filter((r) => r.status === "ready");
const summary = summarize(results);
const meta: ExportMeta = { companyName: "Omtatva Digitals", period: P, revision: 1, approvedAt: "2026-09-02T10:00:00.000Z", approvedBy: "hr@x.com", digest: "abc123", components: policy.components };

test("review breakdown: basic + allowances = gross; absence + leave = loss of pay; everything adds up to net", () => {
  for (const r of ready) {
    assert.equal(Math.round((r.basicSalary + r.allowances) * 100), Math.round(r.grossEarnings * 100));
    assert.equal(Math.round((r.attendanceDeduction + r.leaveDeduction) * 100), Math.round(r.lopDeduction * 100));
    assert.equal(Math.round((r.lopDeduction + r.otherDeductions) * 100), Math.round(r.totalDeductions * 100));
    assert.equal(Math.round((r.grossEarnings - r.totalDeductions) * 100), Math.round(r.netPay * 100));
  }
  const r3 = results[2];
  assert.equal(r3.counts.absent, 1);
  assert.equal(r3.counts["unpaid-leave"], 2);
  assert.equal(r3.attendanceDeduction, Math.round(20000 / 31));
  assert.equal(r3.leaveDeduction, Math.round((20000 / 31) * 3) - Math.round(20000 / 31));
  assert.equal(r3.allowances, 2000);
  assert.equal(r3.otherDeductions, 800);
});
test("company summary has every review column and they add up", () => {
  assert.equal(summary.ready, 3);
  assert.equal(summary.excluded, 1);
  assert.equal(Math.round((summary.basic + summary.allowances) * 100), Math.round(summary.gross * 100));
  assert.equal(Math.round((summary.attendanceDeduction + summary.leaveDeduction + summary.otherDeductions) * 100), Math.round(summary.totalDeductions * 100));
  assert.equal(Math.round((summary.gross - summary.totalDeductions) * 100), Math.round(summary.netPay * 100));
});

test("export table: only paid employees, sorted by ID, with salary components, deductions and net pay", () => {
  const t = buildPayrollTable(ready, policy.components);
  assert.deepEqual(t.rows.map((r) => r[0]), ["E002", "E003", "E010"]);
  for (const h of ["Employee ID", "Employee Name", "Basic Salary", "HRA", "Bonus", "Gross Salary", "Absence Deduction", "Unpaid Leave Deduction", "Provident Fund (PF)", "TDS", "Total Deductions", "Net Pay"]) {
    assert.ok(t.headers.includes(h), h);
  }
  assert.ok(!t.rows.some((r) => r[0] === "E004"), "an excluded employee is not in the payroll export");
});
test("exported totals match the approved payroll records exactly", () => {
  const t = buildPayrollTable(ready, policy.components);
  assert.deepEqual(verifyAgainstSummary(t, summary), []);
  const net = t.headers.indexOf("Net Pay");
  assert.equal(Math.round(Number(t.totals[net]) * 100), Math.round(summary.netPay * 100));
  assert.equal(t.totals[0], "TOTAL");
});
test("a tampered or incomplete export is detected before it is returned", () => {
  const t = buildPayrollTable(ready.slice(0, 2), policy.components);
  const problems = verifyAgainstSummary(t, summary);
  assert.ok(problems.some((p) => p.startsWith("Net pay")) && problems.some((p) => p.startsWith("Employees")));
  const t2 = buildPayrollTable(ready, policy.components);
  t2.totals[t2.headers.indexOf("Net Pay")] = 1;
  assert.ok(verifyAgainstSummary(t2, summary).length > 0);
});

test("CSV: header, rows, totals; quoting; two decimals; formulas neutralised; opens in Excel (BOM)", () => {
  const csv = toCsv(buildPayrollTable(ready, policy.components), meta);
  assert.ok(csv.startsWith("﻿# Omtatva Digitals payroll 2026-08"));
  assert.ok(csv.includes('"Ravi, Kumar"'));
  assert.ok(csv.includes("\r\nE010,Asha Rao,Ops,Exec,31,"));
  assert.ok(csv.includes("48200.00"));
  assert.ok(!/(^|,)=HYPERLINK/.test(csv) && csv.includes("\"'=HYPERLINK"));
  assert.ok(csv.trimEnd().split("\r\n").pop()!.startsWith("TOTAL,"));
  assert.ok(csv.includes(summary.netPay.toFixed(2)));
});
test("XLSX: real workbook with Payroll + Summary sheets; numbers are numbers; totals equal the approved summary", () => {
  const bytes = toXlsx(buildPayrollTable(ready, policy.components), meta, summary);
  assert.equal(bytes[0], 0x50);
  const wb = XLSX.read(bytes, { type: "array" });
  assert.deepEqual(wb.SheetNames, ["Payroll", "Summary"]);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Payroll);
  assert.equal(rows.length, 4, "3 employees + total row");
  assert.equal(typeof rows[0]["Net Pay"], "number");
  assert.equal(rows[3]["Employee ID"], "TOTAL");
  assert.equal(Math.round(Number(rows[3]["Net Pay"]) * 100), Math.round(summary.netPay * 100));
  assert.ok(String(rows.find((r) => String(r["Employee Name"]).includes("HYPERLINK"))?.["Employee Name"]).startsWith("'="), "formula neutralised");
  const info = Object.fromEntries(XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Summary, { header: 1 }).map((r) => [r[0], r[1]]));
  assert.equal(Math.round(Number(info["Net payable"]) * 100), Math.round(summary.netPay * 100));
  assert.equal(info["Snapshot fingerprint (SHA-256)"], "abc123");
});
test("safeCell neutralises formula triggers but leaves normal text and numbers", () => {
  for (const bad of ["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd"]) assert.ok(String(safeCell(bad)).startsWith("'"), bad);
  assert.equal(safeCell("Asha"), "Asha");
  assert.equal(safeCell(-5), -5);
});

// -------------------------------------------------------------------- zip
function readZip(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files: { name: string; data: Uint8Array; crc: number }[] = [];
  const end = bytes.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50, "end of central directory");
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nlen = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    assert.equal(dv.getUint32(off, true), 0x04034b50);
    const lnlen = dv.getUint16(off + 26, true);
    files.push({ name, crc, data: bytes.subarray(off + 30 + lnlen, off + 30 + lnlen + size) });
    p += 46 + nlen;
  }
  return files;
}
test("ZIP: a valid archive — names, contents and CRC-32 round-trip; deterministic", () => {
  const a = new TextEncoder().encode("%PDF-1.3 one"), b = new TextEncoder().encode("%PDF-1.3 two");
  const zip = buildZip([{ name: "Payslip_E001_2026-08.pdf", data: a }, { name: "Payslip_E002_2026-08.pdf", data: b }]);
  const files = readZip(zip);
  assert.deepEqual(files.map((f) => f.name), ["Payslip_E001_2026-08.pdf", "Payslip_E002_2026-08.pdf"]);
  assert.equal(new TextDecoder().decode(files[1].data), "%PDF-1.3 two");
  assert.equal(files[0].crc, crc32(a));
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926, "standard CRC-32 check value");
  assert.deepEqual(buildZip([{ name: "a.pdf", data: a }]), buildZip([{ name: "a.pdf", data: a }]));
});
test("ZIP: path traversal and odd names cannot escape; duplicate names are kept apart", () => {
  assert.equal(safeZipName("../../etc/passwd"), "_.._etc_passwd");
  assert.equal(safeZipName("..\\evil.pdf"), "_evil.pdf");
  assert.equal(safeZipName(""), "file");
  const files = readZip(buildZip([{ name: "x.pdf", data: new Uint8Array([1]) }, { name: "x.pdf", data: new Uint8Array([2]) }]));
  assert.equal(new Set(files.map((f) => f.name)).size, 2);
  for (const f of files) assert.ok(!f.name.includes("/") && !f.name.includes("\\"));
});

console.log(`\n${passed} passed (payroll export + zip)${process.exitCode ? " - with FAILURES" : ""}`);
