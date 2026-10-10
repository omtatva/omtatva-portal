// Run with:  npm run test:payroll
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { computeEmployee, type EmployeeInput } from "../lib/payroll/engine";
import { resolvePolicy } from "../lib/payroll/policy";
import { monthDates, weekday } from "../lib/payroll/calendar";
import { formatRs, renderPayslip, rupeesInWords } from "../lib/payroll/payslipPdf";
import { assertCan, assertSuperAdmin, can, canOpenPayslip, payrollLevel, PayrollForbidden } from "../lib/payroll/access";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

// jsPDF escapes ( ) inside text strings; undo that so we can search the content
const pdfText = (b: Uint8Array) => Buffer.from(b).toString("latin1").split(String.fromCharCode(92) + "(").join("(").split(String.fromCharCode(92) + ")").join(")");
const policy = resolvePolicy({ confirmed: true });
const dates = monthDates("2026-08").filter((d) => weekday(d) !== 0 && d !== "2026-08-15" && d !== "2026-08-26");
const input: EmployeeInput = {
  uid: "u1", employeeId: "E001", name: "Asha Rao", department: "Design", designation: "Designer", joiningDate: "2025-01-01",
  weeklyOffDays: [0], salary: { basicSalary: 30000, hra: 10000, specialAllowance: 10000, pf: 1800 },
  attendance: dates.map((date, i) => ({ date, status: i < 3 ? "Absent" : "Present" })), leaveRequests: [],
};
const hol = [{ date: "2026-08-15", category: "National" }, { date: "2026-08-26", category: "Company" }];
const result = computeEmployee("2026-08", policy, hol, input);
const meta = { companyName: "Omtatva Digitals", period: "2026-08", revision: 1, payslipId: "2026-08_u1_r1", approvedAtIso: "2026-09-02T10:00:00.000Z", joiningDate: "2025-01-01", policyLines: ["Per-day rate = monthly amount ÷ calendar days", "Loss of pay is deducted from Basic Salary"] };

test("money formatting uses Indian grouping; amounts in words", () => {
  assert.equal(formatRs(1234567.5), "12,34,567.50");
  assert.equal(formatRs(45297), "45,297.00");
  assert.equal(formatRs(0), "0.00");
  assert.equal(rupeesInWords(45297), "Forty Five Thousand Two Hundred Ninety Seven Rupees Only");
  assert.equal(rupeesInWords(123456.5), "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Fifty Paise Only");
  assert.equal(rupeesInWords(0), "Zero Rupees Only");
});

test("PDF: a valid PDF is produced and contains the employee, components, attendance and net pay", () => {
  const bytes = renderPayslip(result, meta);
  const text = pdfText(bytes);
  assert.equal(text.slice(0, 5), "%PDF-");
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.ok(bytes.length > 2000);
  for (const needle of ["Asha Rao", "E001", "Payslip for August 2026", "Basic Salary", "HRA", "Special Allowance", "Provident Fund (PF)", "Absence (3 days @ Rs.", "Payable days", "28", "Rs. 45,297.00", "45,297.00", "50,000.00", "4,703.00", "Forty Five Thousand Two Hundred Ninety Seven Rupees Only"]) {
    assert.ok(text.includes(needle), `missing in PDF: ${needle}`);
  }
  assert.ok(!text.includes("₹"), "no rupee glyph (Helvetica cannot draw it)");
});
test("PDF is deterministic: the same snapshot gives identical bytes (safe to regenerate / verify by hash)", () => {
  const a = crypto.createHash("sha256").update(renderPayslip(result, meta)).digest("hex");
  const b = crypto.createHash("sha256").update(renderPayslip(result, meta)).digest("hex");
  assert.equal(a, b);
  const c = crypto.createHash("sha256").update(renderPayslip({ ...result, netPay: result.netPay + 1 }, meta)).digest("hex");
  assert.notEqual(a, c);
});
test("PDF: renders a joiner with pro-rata, and an employee with no deductions", () => {
  const joiner = computeEmployee("2026-08", policy, hol, { ...input, joiningDate: "2026-08-20", attendance: dates.filter((d) => d >= "2026-08-20").map((date) => ({ date, status: "Present" })) });
  const text = pdfText(renderPayslip(joiner, meta));
  assert.ok(text.includes("Pro-rata (19 days not employed)"));
  const plain = computeEmployee("2026-08", policy, hol, { ...input, salary: { basicSalary: 20000 }, attendance: dates.map((date) => ({ date, status: "Present" })) });
  assert.ok(Buffer.from(renderPayslip(plain, meta)).toString("latin1").includes("20,000.00"));
});

// ------------------------------------------------------------------ access
const matrix = { hr: { payroll: "view", salaryStructure: "view" }, admin: { payroll: "edit", salaryStructure: "edit" }, head: { payroll: "view" } } as never;
test("access: employees, managers and team leads have no payroll access at all", () => {
  for (const role of ["employee", "manager", "team_lead", "", null, undefined, "intern", "super"]) {
    assert.equal(payrollLevel(role as string, matrix, "payroll"), "none", String(role));
    assert.equal(can(role as string, matrix, "payroll", "view"), false);
  }
});
test("access: the Module Permissions matrix is honoured (HR view-only cannot edit); Super Admin always can", () => {
  assert.equal(can("hr", matrix, "payroll", "view"), true);
  assert.equal(can("hr", matrix, "payroll", "edit"), false);
  assert.equal(can("admin", matrix, "salaryStructure", "edit"), true);
  assert.equal(can("super_admin", matrix, "payroll", "edit"), true);
  assert.equal(can("HR Admin", matrix, "payroll", "edit"), false, "mixed-case role labels normalise");
  assert.throws(() => assertCan("hr", matrix, "payroll", "edit"), PayrollForbidden);
  assert.doesNotThrow(() => assertCan("hr", matrix, "payroll", "view"));
});
test("access: with no saved matrix the defaults apply (HR view-only, others edit)", () => {
  assert.equal(can("hr", null, "payroll", "edit"), false);
  assert.equal(can("admin", null, "payroll", "edit"), true);
});
test("access: policy changes and reversals are Super Admin only", () => {
  assert.doesNotThrow(() => assertSuperAdmin("super_admin"));
  for (const r of ["admin", "hr", "head", "employee"]) assert.throws(() => assertSuperAdmin(r), PayrollForbidden);
});
test("payslips: an employee opens only their own (and not a voided one); authorized HR can open any", () => {
  const base = { ownerUid: "u1", matrix, voided: false };
  assert.equal(canOpenPayslip({ ...base, callerUid: "u1", role: "employee" }), true);
  assert.equal(canOpenPayslip({ ...base, callerUid: "u2", role: "employee" }), false);
  assert.equal(canOpenPayslip({ ...base, callerUid: "u2", role: "manager" }), false);
  assert.equal(canOpenPayslip({ ...base, callerUid: "u1", role: "employee", voided: true }), false);
  assert.equal(canOpenPayslip({ ...base, callerUid: "h1", role: "hr" }), true);
  assert.equal(canOpenPayslip({ ...base, callerUid: "h1", role: "hr", voided: true }), true);
});

console.log(`\n${passed} passed (payslip + access)${process.exitCode ? " - with FAILURES" : ""}`);
