// Run with:  npm run test:payroll
// Known-answer tests. August 2026: 31 days, starts on a Saturday, Sundays are
// the 2, 9, 16, 23, 30 (5 weekly offs), company holidays 15 and 26 -> 24
// working days. Example salary: Basic 30,000 + HRA 10,000 + Special 10,000 =
// Gross 50,000; PF 1,800.
import assert from "node:assert/strict";
import { addDay, daysInMonth, monthDates, weekday } from "../lib/payroll/calendar";
import { computeEmployee, companyFlags, summarize, approvalBlockers, type AttendanceRec, type EmployeeInput, type HolidayRec } from "../lib/payroll/engine";
import { resolvePolicy, DEFAULT_POLICY, type PayrollPolicy } from "../lib/payroll/policy";
import { buildLeaveLedger } from "../lib/payroll/leave";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

const policy = (over: Record<string, unknown> = {}): PayrollPolicy => resolvePolicy({ confirmed: true, ...over });
const P = "2026-08";
const HOL: HolidayRec[] = [
  { date: "2026-08-15", name: "Independence Day", category: "National" },
  { date: "2026-08-26", name: "Company day", category: "Company" },
];
const SALARY = { basicSalary: 30000, hra: 10000, specialAllowance: 10000, pf: 1800 };

const isOff = (d: string) => weekday(d) === 0 || HOL.some((h) => h.date === d);
const workingDates = monthDates(P).filter((d) => !isOff(d));
const present = (dates: string[]): AttendanceRec[] => dates.map((date) => ({ date, status: "Present" }));

const emp = (over: Partial<EmployeeInput> = {}): EmployeeInput => ({
  uid: "u1", employeeId: "E001", name: "Asha", joiningDate: "2025-01-01",
  weeklyOffDays: [0], salary: SALARY, attendance: present(workingDates), leaveRequests: [], overrides: {}, ...over,
});
const run = (e: EmployeeInput, pol = policy(), hol = HOL) => computeEmployee(P, pol, hol, e);

// ---------------------------------------------------------------- calendar
test("calendar: month lengths incl. leap years, weekday, month boundaries", () => {
  assert.equal(daysInMonth("2026-08"), 31);
  assert.equal(daysInMonth("2027-02"), 28);
  assert.equal(daysInMonth("2028-02"), 29);
  assert.equal(weekday("2026-08-01"), 6);
  assert.equal(addDay("2026-08-31", 1), "2026-09-01");
  assert.equal(addDay("2026-01-01", -1), "2025-12-31");
});
test("calendar: results do not depend on the machine timezone", () => {
  const before = JSON.stringify(run(emp()));
  const old = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati"; // UTC+14
  const a = JSON.stringify(run(emp()));
  process.env.TZ = "America/Los_Angeles";
  const b = JSON.stringify(run(emp()));
  process.env.TZ = old;
  assert.equal(a, before);
  assert.equal(b, before);
});

// -------------------------------------------------------------- full month
test("full attendance: gross 50,000 − PF 1,800 = 48,200; nothing deducted", () => {
  const r = run(emp());
  assert.equal(r.grossEarnings, 50000);
  assert.equal(r.lopDeduction, 0);
  assert.equal(r.fixedDeductions, 1800);
  assert.equal(r.netPay, 48200);
  assert.equal(r.status, "ready");
  assert.equal(r.counts["weekly-off"], 5);
  assert.equal(r.counts.holiday, 2);
  assert.equal(r.counts.present, 24);
});

// ------------------------------------------------------- the divisor options
const absent3 = () => emp({ attendance: [...present(workingDates.slice(3)), ...workingDates.slice(0, 3).map((date) => ({ date, status: "Absent" }))] });
test("3 absences, calendar divisor (31), loss of pay on Basic: round(30000/31×3)=2903 → net 45,297", () => {
  const r = run(absent3());
  assert.equal(r.divisor, 31);
  assert.equal(r.lopDays, 3);
  assert.equal(r.lopDeduction, 2903);
  assert.equal(r.netPay, 45297);
});
test("3 absences, fixed divisor 30 → 3,000 (the old behaviour is now a choice, not an assumption)", () => {
  const r = run(absent3(), policy({ dayDivisor: "fixed", fixedDivisor: 30 }));
  assert.equal(r.lopDeduction, 3000);
  assert.equal(r.netPay, 45200);
});
test("3 absences, working-days divisor (24) → 30000/24×3 = 3,750", () => {
  const r = run(absent3(), policy({ dayDivisor: "working" }));
  assert.equal(r.divisor, 24);
  assert.equal(r.lopDeduction, 3750);
});
test("3 absences, loss of pay on Gross → round(50000/31×3)=4839", () => {
  assert.equal(run(absent3(), policy({ lopBase: "gross" })).lopDeduction, 4839);
});
test("paisa rounding keeps two decimals", () => {
  assert.equal(run(absent3(), policy({ rounding: "paisa" })).lopDeduction, 2903.23);
});
test("February (28 days) uses 28 as the divisor", () => {
  const p = "2027-02";
  const dates = monthDates(p).filter((d) => weekday(d) !== 0);
  const att: AttendanceRec[] = dates.map((date, i) => ({ date, status: i < 2 ? "Absent" : "Present" }));
  const r = computeEmployee(p, policy(), [], emp({ attendance: att }));
  assert.equal(r.divisor, 28);
  assert.equal(r.lopDeduction, Math.round((30000 / 28) * 2));
});

// ---------------------------------------------- weekly offs / holidays / dups
test("an Absent record on a weekly off or a company holiday is NOT deducted", () => {
  const att = [...present(workingDates), { date: "2026-08-09", status: "Absent" }, { date: "2026-08-15", status: "Absent" }];
  const r = run(emp({ attendance: att }));
  assert.equal(r.lopDeduction, 0);
  assert.equal(r.dayClasses["2026-08-09"], "weekly-off");
  assert.equal(r.dayClasses["2026-08-15"], "holiday");
});
test("a day with both an Absent record and approved UNPAID leave is charged once", () => {
  const att = [...present(workingDates.filter((d) => d !== "2026-08-05")), { date: "2026-08-05", status: "Absent" }];
  const r = run(emp({ attendance: att, leaveRequests: [{ id: "L1", leaveType: "LOP", fromDate: "2026-08-05", toDate: "2026-08-05" }] }));
  assert.equal(r.lopDays, 1);
  assert.equal(r.lopDeduction, Math.round(30000 / 31));
  assert.equal(r.counts["unpaid-leave"], 1);
  assert.equal(r.counts.absent, 0);
});
test("two attendance documents for one day count as one day", () => {
  const r = run(emp({ attendance: [...present(workingDates), { date: "2026-08-04", status: "Present" }] }));
  assert.equal(r.counts.present, 24);
  assert.equal(r.netPay, 48200);
});
test("conflicting records (Present-less Absent + Leave status) need a decision", () => {
  const att = [...present(workingDates.slice(1)), { date: workingDates[0], status: "Absent" }, { date: workingDates[0], status: "Leave" }];
  const r = run(emp({ attendance: att }));
  assert.equal(r.dayClasses[workingDates[0]], "review");
  assert.equal(r.status, "review");
});

// ---------------------------------------------------------------- leave
test("approved PAID leave creates no deduction", () => {
  const r = run(emp({
    attendance: present(workingDates.filter((d) => d !== "2026-08-05" && d !== "2026-08-06")),
    leaveRequests: [{ id: "L1", leaveType: "Casual Leave", fromDate: "2026-08-05", toDate: "2026-08-06" }],
  }));
  assert.equal(r.counts["paid-leave"], 2);
  assert.equal(r.lopDeduction, 0);
  assert.equal(r.netPay, 48200);
  assert.equal(r.leave!.usedThisMonth, 2);
});
test("approved LOP leave is deducted per day (2 days → round(30000/31×2)=1935)", () => {
  const r = run(emp({
    attendance: present(workingDates.filter((d) => d !== "2026-08-05" && d !== "2026-08-06")),
    leaveRequests: [{ id: "L1", leaveType: "LOP", fromDate: "2026-08-05", toDate: "2026-08-06" }],
  }));
  assert.equal(r.counts["unpaid-leave"], 2);
  assert.equal(r.lopDeduction, 1935);
});
test("a leave range spanning a Sunday and a company holiday uses only the working days", () => {
  // Fri 14 – Mon 17: 14 and 17 are working days; 15 is a holiday and 16 a Sunday
  const l = buildLeaveLedger({
    policy: DEFAULT_POLICY.leave,
    requests: [{ id: "L", leaveType: "Casual Leave", fromDate: "2026-08-14", toDate: "2026-08-17" }],
    joiningDate: "2025-01-01", isOffDay: isOff, attendedDates: new Set(), period: P,
  });
  assert.deepEqual([...l.days.keys()], ["2026-08-14", "2026-08-17"]);
});
test("overlapping leave requests count a day once", () => {
  const l = buildLeaveLedger({
    policy: DEFAULT_POLICY.leave,
    requests: [
      { id: "A", leaveType: "Casual Leave", fromDate: "2026-08-04", toDate: "2026-08-05" },
      { id: "B", leaveType: "Sick Leave", fromDate: "2026-08-05", toDate: "2026-08-06" },
    ],
    joiningDate: "2025-01-01", isOffDay: isOff, attendedDates: new Set(), period: P,
  });
  assert.equal(l.days.size, 3);
  assert.ok(l.flags.some((f) => f.includes("overlapping")));
});
test("leave on a day the employee actually worked is not used", () => {
  const r = run(emp({ leaveRequests: [{ id: "L", leaveType: "Casual Leave", fromDate: "2026-08-04", toDate: "2026-08-04" }] }));
  assert.equal(r.counts["paid-leave"], 0);
  assert.equal(r.leave!.usedYearToDate, 0);
  assert.ok(r.flags.some((f) => f.message.includes("worked")));
});
test("leave beyond the balance becomes unpaid; a negative balance can be allowed", () => {
  // joined 1 Aug 2026: 2 days accrued in August
  const e = { joiningDate: "2026-08-01", leaveRequests: [{ id: "L", leaveType: "Casual Leave", fromDate: "2026-08-17", toDate: "2026-08-20" }] };
  const att = present(workingDates.filter((d) => !["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"].includes(d)));
  const strict = run(emp({ ...e, attendance: att }));
  assert.equal(strict.counts["paid-leave"], 2);
  assert.equal(strict.counts["unpaid-leave"], 2);
  assert.equal(strict.lopDeduction, Math.round((30000 / 31) * 2));
  const loose = run(emp({ ...e, attendance: att }), policy({ leave: { negativeBalanceAllowed: true, negativeBalanceMaxDays: 2 } }));
  assert.equal(loose.counts["paid-leave"], 4);
  assert.equal(loose.lopDeduction, 0);
  assert.equal(loose.leave!.available, -2);
});
test("entitlement: 2 days/month, 24/year; carry-forward and encashment are policy-driven", () => {
  const request = [{ id: "L", leaveType: "Casual Leave", fromDate: "2026-12-01", toDate: "2026-12-01" }];
  const args = { requests: request, joiningDate: "2024-01-01", isOffDay: (d: string) => weekday(d) === 0, attendedDates: new Set<string>() };
  const dec = buildLeaveLedger({ ...args, policy: DEFAULT_POLICY.leave, period: "2026-12" });
  assert.equal(dec.summary.accruedToDate, 24);
  assert.equal(dec.summary.available, 23);
  assert.equal(dec.summary.opening, 0); // carry-forward off by default
  const cf = buildLeaveLedger({ ...args, policy: { ...DEFAULT_POLICY.leave, carryForwardEnabled: true, carryForwardMaxDays: 5, encashmentEnabled: true, encashmentMaxDays: 10 }, period: "2026-12" });
  assert.equal(cf.summary.opening, 5); // capped at 5 of the unused 24
  assert.equal(cf.summary.available, 28);
  assert.equal(cf.summary.encashableDays, 10);
  const jan = buildLeaveLedger({ ...args, requests: [], policy: DEFAULT_POLICY.leave, period: "2026-01" });
  assert.equal(jan.summary.accruedToDate, 2);
});
test("joining month accrual: before/after the cutoff day, prorate option, rounding", () => {
  const base = { requests: [], isOffDay: () => false, attendedDates: new Set<string>(), period: "2026-03" };
  const early = buildLeaveLedger({ ...base, policy: DEFAULT_POLICY.leave, joiningDate: "2026-03-10" });
  assert.equal(early.summary.accruedToDate, 2);
  const late = buildLeaveLedger({ ...base, policy: DEFAULT_POLICY.leave, joiningDate: "2026-03-20" });
  assert.equal(late.summary.accruedToDate, 0);
  const pro = buildLeaveLedger({ ...base, policy: { ...DEFAULT_POLICY.leave, lateJoinerAccrual: "prorate", accrualRounding: "half-day" }, joiningDate: "2026-03-20" });
  assert.equal(pro.summary.accruedToDate, 0.5); // 2 × 12/31 = 0.77 → 0.5
});
test("end-of-month accrual: this month's days are not usable until the month ends", () => {
  const l = buildLeaveLedger({
    requests: [{ id: "L", leaveType: "Casual Leave", fromDate: "2026-01-12", toDate: "2026-01-12" }],
    isOffDay: () => false, attendedDates: new Set(), period: "2026-01", joiningDate: "2025-01-01",
    policy: { ...DEFAULT_POLICY.leave, accrualTiming: "end-of-month" },
  });
  assert.equal(l.days.get("2026-01-12")!.kind, "unpaid-no-balance");
});
test("recomputing the same month twice never deducts leave twice (balance is derived, not stored)", () => {
  const e = emp({ attendance: present(workingDates.filter((d) => d !== "2026-08-05")), leaveRequests: [{ id: "L1", leaveType: "Casual Leave", fromDate: "2026-08-05", toDate: "2026-08-05" }] });
  const a = run(e);
  const b = run(e);
  assert.deepEqual(a, b);
  assert.equal(a.leave!.usedYearToDate, 1);
});

// ------------------------------------------------------ missing attendance
test("no attendance records at all: flagged for review, NOT silently paid or deducted", () => {
  const r = run(emp({ attendance: [] }));
  assert.equal(r.counts.review, 24);
  assert.equal(r.status, "review");
  assert.ok(r.flags.filter((f) => f.code === "missing-attendance").length === 24);
  const blockers = approvalBlockers([r], []);
  assert.ok(blockers.length >= 1);
});
test("HR decisions (with a reason) resolve missing days; without a reason they do not", () => {
  const overrides = Object.fromEntries(workingDates.map((d) => [d, { treatment: "unpaid" as const, reason: "Absent without leave per HR register" }]));
  const r = run(emp({ attendance: [], overrides }));
  assert.equal(r.status, "ready");
  assert.equal(r.counts["decided-unpaid"], 24);
  assert.equal(r.lopDeduction, 23226); // round(30000/31 × 24)
  const noReason = run(emp({ attendance: [], overrides: { [workingDates[0]]: { treatment: "paid", reason: "  " } } }));
  assert.equal(noReason.dayClasses[workingDates[0]], "review");
  const paid = run(emp({ attendance: [], overrides: Object.fromEntries(workingDates.map((d) => [d, { treatment: "paid" as const, reason: "Verified by manager" }])) }));
  assert.equal(paid.netPay, 48200);
});
test("an attendance status of Leave without an approved request needs a decision", () => {
  const r = run(emp({ attendance: [...present(workingDates.slice(1)), { date: workingDates[0], status: "Leave" }] }));
  assert.equal(r.dayClasses[workingDates[0]], "review");
});
test("Incomplete (no punch-out): paid with a warning by default, a decision if the policy says so", () => {
  const att = [...present(workingDates.slice(1)), { date: workingDates[0], status: "Incomplete" }];
  const lenient = run(emp({ attendance: att }));
  assert.equal(lenient.dayClasses[workingDates[0]], "incomplete");
  assert.equal(lenient.status, "ready");
  const strict = run(emp({ attendance: att }), policy({ incompleteDay: "review" }));
  assert.equal(strict.status, "review");
});
test("Late counts as a worked day; demo attendance is ignored", () => {
  const att = [...present(workingDates.slice(1)), { date: workingDates[0], status: "Late" }];
  assert.equal(run(emp({ attendance: att })).lopDeduction, 0);
  const withDemo = [...present(workingDates.slice(1)), { date: workingDates[0], status: "Present", isDemo: true }];
  assert.equal(run(emp({ attendance: withDemo })).dayClasses[workingDates[0]], "review");
});

// ------------------------------------------------- joining / partial month
test("joined mid-month: earlier days are 'not employed' and prorated on gross", () => {
  const dates = workingDates.filter((d) => d >= "2026-08-20");
  const r = run(emp({ joiningDate: "2026-08-20", attendance: present(dates) }));
  assert.equal(r.counts["not-employed"], 19);
  assert.equal(r.notEmployedDeduction, Math.round((50000 * 19) / 31)); // 30,645
  assert.equal(r.lopDeduction, 0);
  assert.equal(r.netPay, 50000 - 30645 - 1800);
  assert.equal(r.status, "ready");
});
test("last working day: later days are not employed", () => {
  const r = run(emp({ lastWorkingDate: "2026-08-20", attendance: present(workingDates.filter((d) => d <= "2026-08-20")) }));
  assert.equal(r.counts["not-employed"], 11);
});

// -------------------------------------------------------- structure & totals
test("no salary structure: excluded, never paid 0 silently", () => {
  const r = run(emp({ salary: null }));
  assert.equal(r.status, "excluded");
  assert.equal(r.netPay, 0);
});
test("custom components (bonus, other deduction) flow through gross and deductions", () => {
  const r = run(emp({ salary: { ...SALARY, bonus: 2000, otherDeduction: 500 } }));
  assert.equal(r.grossEarnings, 52000);
  assert.equal(r.fixedDeductions, 2300);
  assert.equal(r.netPay, 49700);
});
test("net = gross − every deduction line, for 300 random months/employees", () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 300; i++) {
    const month = `2026-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}`;
    const dates = monthDates(month);
    const att: AttendanceRec[] = dates.filter(() => rnd() < 0.8).map((date) => ({ date, status: rnd() < 0.2 ? "Absent" : "Present" }));
    const overrides = Object.fromEntries(dates.map((d) => [d, { treatment: rnd() < 0.5 ? ("paid" as const) : ("unpaid" as const), reason: "x" }]));
    const e = emp({ attendance: att, overrides, salary: { basicSalary: 1000 + Math.floor(rnd() * 90000), hra: Math.floor(rnd() * 20000), pf: Math.floor(rnd() * 3000) }, joiningDate: rnd() < 0.3 ? `${month}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}` : "2020-01-01" });
    const r = computeEmployee(month, policy({ rounding: rnd() < 0.5 ? "rupee" : "paisa" }), [], e);
    const lines = r.deductions.reduce((s, l) => s + l.amount, 0);
    assert.ok(Math.abs(r.netPay - (r.grossEarnings - r.lopDeduction - r.notEmployedDeduction - lines)) < 0.005, `${month} #${i}`);
    assert.equal(Object.values(r.counts).reduce((a, b) => a + b, 0), daysInMonth(month), "every day has exactly one class");
    assert.ok(r.lopDeduction <= r.base + 0.005);
  }
});
test("company summary adds up the employees", () => {
  const a = run(emp());
  const b = run(absent3());
  const c = run(emp({ salary: null }));
  const s = summarize([a, b, c]);
  assert.equal(s.employees, 3);
  assert.equal(s.excluded, 1);
  assert.equal(s.netPay, 48200 + 45297);
  assert.equal(s.lopDeduction, 2903);
  assert.equal(s.gross, 100000);
});

// ---------------------------------------------------------- company checks
test("holidays: Optional holidays are not company holidays; count mismatch and unconfirmed policy are flagged", () => {
  const hol: HolidayRec[] = [...HOL, { date: "2026-08-20", name: "Optional day", category: "Optional" }];
  const r = run(emp(), policy(), hol);
  assert.equal(r.counts.holiday, 2);
  const none = companyFlags(P, policy(), [], [0]);
  assert.ok(none.some((f) => f.code === "holiday-count"));
  const flags = companyFlags(P, DEFAULT_POLICY, HOL, [0]);
  assert.ok(flags.some((f) => f.code === "policy-unconfirmed" && f.severity === "block"));
  assert.ok(approvalBlockers([run(emp())], flags).length > 0);
  const sunHoliday = companyFlags("2026-08", policy(), [{ date: "2026-08-09", category: "Company" }, { date: "2026-08-26", category: "Company" }], [0]);
  assert.ok(sunHoliday.some((f) => f.code === "holiday-on-weekly-off"));
});
test("policy: invalid saved values fall back to safe defaults", () => {
  const p = resolvePolicy({ dayDivisor: "banana", fixedDivisor: -4, leave: { annualEntitlement: "abc", accrualRounding: 7 }, components: [{ key: "bad key" }] });
  assert.equal(p.dayDivisor, "calendar");
  assert.equal(p.fixedDivisor, 30);
  assert.equal(p.leave.annualEntitlement, 24);
  assert.equal(p.confirmed, false);
  assert.equal(p.components[0].key, "basicSalary");
});

console.log(`\n${passed} passed (payroll engine)${process.exitCode ? " - with FAILURES" : ""}`);
