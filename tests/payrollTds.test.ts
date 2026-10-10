// Run with:  npm run test:payroll
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeEmployee, summarize, type AttendanceRec, type EmployeeInput } from "../lib/payroll/engine";
import { DEFAULT_POLICY, describePolicy, resolvePolicy } from "../lib/payroll/policy";
import { calculateTds } from "../lib/payroll/tds";
import { monthDates, weekday } from "../lib/payroll/calendar";
import { buildPayrollTable, verifyAgainstSummary } from "../lib/payroll/export";
import { renderPayslip } from "../lib/payroll/payslipPdf";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

const P = "2026-08";
const work = monthDates(P).filter((d) => weekday(d) !== 0);
const att = (absent: number): AttendanceRec[] => work.map((date, i) => ({ date, status: i < absent ? "Absent" : "Present" }));
const emp = (over: Partial<EmployeeInput> = {}): EmployeeInput => ({
  uid: "u", employeeId: "E1", name: "Asha", weeklyOffDays: [0], joiningDate: "2025-01-01",
  salary: { basicSalary: 30000, hra: 10000, specialAllowance: 10000, pf: 1800 }, attendance: att(0), leaveRequests: [], overrides: {}, ...over,
});
const pct = (percent = 10, base: "earned" | "gross" = "earned", extra: Record<string, unknown> = {}) =>
  resolvePolicy({ confirmed: true, tds: { mode: "percent", percent, base }, ...extra });

test("10% of earned salary: full month gross 50,000 → TDS 5,000; PF 1,800; net 43,200", () => {
  const r = computeEmployee(P, pct(), [], emp());
  assert.equal(r.tdsAmount, 5000);
  assert.equal(r.tdsBase, 50000);
  assert.equal(r.tdsPercent, 10);
  assert.deepEqual(r.deductions.map((d) => [d.key, d.label, d.amount]), [["pf", "Provident Fund (PF)", 1800], ["tds", "TDS @ 10%", 5000]]);
  assert.equal(r.totalDeductions, 6800);
  assert.equal(r.netPay, 43200);
});
test("TDS follows what is actually payable: 3 absences (loss of pay 2,903) → 10% of 47,097 = 4,710", () => {
  const r = computeEmployee(P, pct(), [], emp({ attendance: att(3) }));
  assert.equal(r.lopDeduction, 2903);
  assert.equal(r.tdsBase, 47097);
  assert.equal(r.tdsAmount, 4710);
  assert.equal(r.netPay, 50000 - 2903 - 1800 - 4710);
});
test("base = full gross ignores loss of pay", () => {
  const r = computeEmployee(P, pct(10, "gross"), [], emp({ attendance: att(3) }));
  assert.equal(r.tdsAmount, 5000);
});
test("a mid-month joiner is taxed only on what they earn (pro-rata applied first)", () => {
  const dates = work.filter((d) => d >= "2026-08-20");
  const r = computeEmployee(P, pct(), [], emp({ joiningDate: "2026-08-20", attendance: dates.map((date) => ({ date, status: "Present" })) }));
  assert.equal(r.notEmployedDeduction, 30645);
  assert.equal(r.tdsBase, 50000 - 30645);
  assert.equal(r.tdsAmount, Math.round((50000 - 30645) * 0.1));
});
test("percentage mode replaces a fixed TDS saved on the structure (never both); fixed mode keeps the old behaviour", () => {
  const withFixed = emp({ salary: { basicSalary: 30000, hra: 10000, specialAllowance: 10000, pf: 1800, tds: 2500 } });
  const p = computeEmployee(P, pct(), [], withFixed);
  assert.equal(p.tdsAmount, 5000);
  assert.equal(p.deductions.filter((d) => d.key === "tds").length, 1);
  assert.ok(p.flags.some((f) => f.code === "tds-fixed-ignored"));
  const f = computeEmployee(P, resolvePolicy({ confirmed: true }), [], withFixed);
  assert.equal(f.tdsAmount, 2500);
  assert.equal(f.netPay, 50000 - 1800 - 2500);
});
test("0% or fixed mode with no TDS: nothing is deducted and no TDS line appears", () => {
  const zero = computeEmployee(P, pct(0), [], emp());
  assert.ok(!zero.deductions.some((d) => d.key === "tds"));
  assert.equal(zero.netPay, 48200);
});
test("rounding: whole rupees by default, two decimals if the policy says so", () => {
  assert.deepEqual(calculateTds({ mode: "percent", percent: 10, base: "gross" }, { gross: 47097, lopDeduction: 0, proration: 0 }, "rupee"), { amount: 4710, base: 47097 });
  assert.equal(calculateTds({ mode: "percent", percent: 10, base: "gross" }, { gross: 47097, lopDeduction: 0, proration: 0 }, "paisa").amount, 4709.7);
  assert.equal(calculateTds({ mode: "percent", percent: 7.5, base: "earned" }, { gross: 1000, lopDeduction: 1500, proration: 0 }, "rupee").amount, 0, "never negative");
});
test("policy: percentage is validated (0–50), unknown values fall back to safe defaults", () => {
  assert.equal(resolvePolicy({ tds: { mode: "percent", percent: 10 } }).tds.percent, 10);
  assert.equal(resolvePolicy({ tds: { mode: "percent", percent: 150 } }).tds.percent, DEFAULT_POLICY.tds.percent);
  assert.equal(resolvePolicy({ tds: { mode: "percent", percent: -5 } }).tds.percent, DEFAULT_POLICY.tds.percent);
  assert.equal(resolvePolicy({ tds: { mode: "banana", base: "x" } }).tds.mode, "fixed");
  assert.equal(resolvePolicy({ tds: { mode: "percent", percent: "abc" } }).tds.percent, 10);
  assert.equal(resolvePolicy({}).tds.mode, "fixed", "fixed amounts stay the default until a Super Admin switches it");
  assert.ok(describePolicy(pct()).some((l) => l.includes("TDS is 10% of earned salary")));
});
test("every employee gets the same rate; summary, export and payslip all show TDS and still add up", () => {
  const results = [
    computeEmployee(P, pct(), [], emp({ uid: "a", employeeId: "E1" })),
    computeEmployee(P, pct(), [], emp({ uid: "b", employeeId: "E2", salary: { basicSalary: 20000, bonus: 5000 }, attendance: att(2) })),
  ];
  for (const r of results) assert.equal(r.tdsPercent, 10);
  const s = summarize(results);
  assert.equal(Math.round(s.tds * 100), Math.round((results[0].tdsAmount + results[1].tdsAmount) * 100));
  const table = buildPayrollTable(results, pct().components);
  assert.ok(table.headers.includes("TDS"));
  assert.equal(Number(table.rows[0][table.headers.indexOf("TDS")]), 5000);
  assert.deepEqual(verifyAgainstSummary(table, s), []);
  const text = Buffer.from(renderPayslip(results[0], { companyName: "X", period: P, revision: 1, payslipId: "p", approvedAtIso: "2026-09-01T00:00:00Z", policyLines: [] })).toString("latin1");
  assert.ok(text.includes("TDS @ 10%") && text.includes("5,000.00"));
});
test("net = gross − loss of pay − pro-rata − every deduction line, with TDS on, for 200 random months", () => {
  let seed = 3;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 200; i++) {
    const month = `2026-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}`;
    const dates = monthDates(month);
    const attendance: AttendanceRec[] = dates.filter(() => rnd() < 0.85).map((date) => ({ date, status: rnd() < 0.2 ? "Absent" : "Present" }));
    const overrides = Object.fromEntries(dates.map((d) => [d, { treatment: rnd() < 0.5 ? ("paid" as const) : ("unpaid" as const), reason: "x" }]));
    const pol = pct(Math.round(rnd() * 30 * 100) / 100, rnd() < 0.5 ? "earned" : "gross", { rounding: rnd() < 0.5 ? "rupee" : "paisa" });
    const r = computeEmployee(month, pol, [], emp({ attendance, overrides, salary: { basicSalary: 1000 + Math.floor(rnd() * 90000), hra: Math.floor(rnd() * 20000), pf: Math.floor(rnd() * 2000) } }));
    const lines = r.deductions.reduce((x, l) => x + l.amount, 0);
    assert.ok(Math.abs(r.netPay - (r.grossEarnings - r.lopDeduction - r.notEmployedDeduction - lines)) < 0.005, `${month} #${i}`);
    assert.ok(r.tdsAmount >= 0 && r.tdsAmount <= r.grossEarnings + 0.01);
  }
});
test("UI: the policy screen has the TDS % setting and the review screen shows TDS", () => {
  const root = path.join(__dirname, "..");
  const ui = fs.readFileSync(path.join(root, "components/payroll/PolicyTab.tsx"), "utf8");
  assert.ok(ui.includes("TDS percentage (%)") && ui.includes("Percentage — same % for every employee") && ui.includes("not an individual income-tax slab calculation"));
  assert.ok(fs.readFileSync(path.join(root, "components/payroll/RunTab.tsx"), "utf8").includes("of which TDS"));
});

console.log(`\n${passed} passed (TDS percentage)${process.exitCode ? " - with FAILURES" : ""}`);
