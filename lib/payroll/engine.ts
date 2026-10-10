// Payroll calculation — pure functions only (no Firebase, no clock), so the
// exact same code runs on the server and in the tests.
//
// FORMULAS (all amounts per payroll month; D = divisor, see policy):
//   Gross              = Σ earnings components
//   Per-day rate       = Base ÷ D            Base = Basic or Gross (policy.lopBase)
//   D                  = calendar days of the month | fixed N | working days
//   LOP days           = unpaid absences + unpaid leave days + HR-decided unpaid days
//   LOP deduction      = min(Base, rate × LOP days)               (rounded per policy)
//   Not-employed days  = days before joining / after the last working day
//   Proration          = Gross × not-employed days ÷ calendar days (rounded per policy)
//   Fixed deductions   = Σ deduction components (PF, ESI, PT, TDS, other)
//   NET PAY            = Gross − LOP deduction − Proration − Fixed deductions
//
// Every calendar day gets EXACTLY ONE class, in this order of precedence:
//   not-employed > weekly-off > company holiday > worked > HR decision >
//   approved leave > Absent record > (leave/holiday/off status) > missing.

import { isAttendedStatus, statusCategory } from "../attendanceRules";
import { daysInMonth, isValidDate, monthDates, weekday } from "./calendar";
import { buildLeaveLedger, type LeaveRequest, type LeaveSummary } from "./leave";
import type { PayrollPolicy } from "./policy";

export type DayClass =
  | "not-employed"
  | "weekly-off"
  | "holiday"
  | "present"
  | "incomplete"
  | "paid-leave"
  | "unpaid-leave"
  | "absent"
  | "decided-paid"
  | "decided-unpaid"
  | "review";

export type Severity = "block" | "warn" | "info";
export type Flag = { severity: Severity; code: string; message: string; date?: string };

export type AttendanceRec = { date: string; status: string; isDemo?: boolean };
export type HolidayRec = { date: string; name?: string; category?: string; substituteFor?: string };
export type Override = { treatment: "paid" | "unpaid"; reason: string };

export type EmployeeInput = {
  uid: string;
  employeeId: string;
  name: string;
  department?: string;
  designation?: string;
  joiningDate?: string | null;
  lastWorkingDate?: string | null;
  weeklyOffDays: number[]; // weekdays 0-6 that are off (Sunday = 0)
  salary: Record<string, number> | null; // by component key; null = no structure
  attendance: AttendanceRec[];
  leaveRequests: LeaveRequest[]; // APPROVED only
  overrides?: Record<string, Override>; // by date
};

export type Line = { key: string; label: string; amount: number };

export type EmployeeResult = {
  uid: string;
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  status: "ready" | "review" | "excluded";
  daysInMonth: number;
  divisor: number;
  counts: Record<DayClass, number>;
  dayClasses: Record<string, DayClass>;
  payableDays: number;
  leave: LeaveSummary | null;
  leaveDays: { date: string; leaveType: string; kind: string; requestId: string }[]; // this month's leave, from the leave records
  earnings: Line[];
  grossEarnings: number;
  base: number;
  perDayRate: number;
  lopDays: number;
  lopDeduction: number;
  // lopDeduction split by cause (always adds up to lopDeduction exactly)
  attendanceLopDays: number; // absent + HR-decided-unpaid days
  attendanceDeduction: number;
  leaveLopDays: number; // unpaid leave from the Leave records
  leaveDeduction: number;
  basicSalary: number;
  allowances: number; // every earning except Basic
  otherDeductions: number; // fixed deductions (PF, ESI, PT, TDS, other) + pro-rata
  notEmployedDays: number;
  notEmployedDeduction: number;
  deductions: Line[];
  fixedDeductions: number;
  totalDeductions: number;
  netPay: number;
  flags: Flag[];
};

const ALL_CLASSES: DayClass[] = [
  "not-employed", "weekly-off", "holiday", "present", "incomplete", "paid-leave",
  "unpaid-leave", "absent", "decided-paid", "decided-unpaid", "review",
];
const emptyCounts = (): Record<DayClass, number> =>
  Object.fromEntries(ALL_CLASSES.map((c) => [c, 0])) as Record<DayClass, number>;

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);
const fromCents = (c: number) => c / 100;

function roundMoney(amount: number, mode: PayrollPolicy["rounding"]): number {
  return mode === "rupee" ? Math.round(amount + 1e-9) : Math.round(amount * 100 + 1e-9) / 100;
}

export function companyHolidayDates(holidays: HolidayRec[], policy: PayrollPolicy): Set<string> {
  const skip = new Set(policy.holidays.nonCompanyCategories.map((c) => c.toLowerCase()));
  const out = new Set<string>();
  for (const h of holidays) {
    if (!isValidDate(h.date)) continue;
    if (h.category && skip.has(h.category.trim().toLowerCase())) continue;
    out.add(h.date);
  }
  return out;
}

// Company-level checks shown once above the employee table.
export function companyFlags(period: string, policy: PayrollPolicy, holidays: HolidayRec[], defaultWeeklyOffs: number[]): Flag[] {
  const flags: Flag[] = [];
  const dates = [...companyHolidayDates(holidays, policy)].filter((d) => d.startsWith(period)).sort();
  if (dates.length !== policy.holidays.expectedPerMonth) {
    flags.push({
      severity: "warn",
      code: "holiday-count",
      message: `${dates.length} company holiday(s) are declared for ${period}; the policy expects ${policy.holidays.expectedPerMonth}.`,
    });
  }
  if (policy.holidays.substituteHolidays) {
    const substitutes = new Set(holidays.map((h) => h.substituteFor).filter(Boolean));
    for (const d of dates) {
      if (defaultWeeklyOffs.includes(weekday(d)) && !substitutes.has(d)) {
        flags.push({ severity: "info", code: "holiday-on-weekly-off", date: d, message: `${d} is a company holiday on a weekly off; no substitute holiday is declared.` });
      }
    }
  }
  if (!policy.confirmed) {
    flags.push({ severity: "block", code: "policy-unconfirmed", message: "The payroll policy has not been confirmed by a Super Admin yet. Review it in the Policy tab and save it." });
  }
  return flags;
}

export function computeEmployee(period: string, policy: PayrollPolicy, holidays: HolidayRec[], emp: EmployeeInput): EmployeeResult {
  const dates = monthDates(period);
  const dim = dates.length;
  const flags: Flag[] = [];
  const counts = emptyCounts();
  const dayClasses: Record<string, DayClass> = {};

  const base: EmployeeResult = {
    uid: emp.uid, employeeId: emp.employeeId, name: emp.name,
    department: emp.department || "", designation: emp.designation || "",
    status: "ready", daysInMonth: dim, divisor: dim, counts, dayClasses, payableDays: 0,
    leave: null, leaveDays: [], earnings: [], grossEarnings: 0, base: 0, perDayRate: 0, lopDays: 0, lopDeduction: 0,
    attendanceLopDays: 0, attendanceDeduction: 0, leaveLopDays: 0, leaveDeduction: 0, basicSalary: 0, allowances: 0, otherDeductions: 0,
    notEmployedDays: 0, notEmployedDeduction: 0, deductions: [], fixedDeductions: 0, totalDeductions: 0,
    netPay: 0, flags,
  };

  if (!emp.salary) {
    flags.push({ severity: "block", code: "no-salary", message: "No salary structure for this employee ID — excluded from payroll." });
    return { ...base, status: "excluded" };
  }

  const holidaySet = companyHolidayDates(holidays, policy);
  const offDays = new Set(emp.weeklyOffDays);
  const joined = emp.joiningDate && isValidDate(emp.joiningDate) ? emp.joiningDate : null;
  const left = emp.lastWorkingDate && isValidDate(emp.lastWorkingDate) ? emp.lastWorkingDate : null;
  if (!joined) flags.push({ severity: "warn", code: "no-joining-date", message: "No joining date on record — paid for the full month." });

  const isWeeklyOff = (d: string) => offDays.has(weekday(d));
  const notEmployed = (d: string) => (joined !== null && d < joined) || (left !== null && d > left);

  // ---- one attendance verdict per date (duplicates collapsed) -------------
  const byDate = new Map<string, AttendanceRec[]>();
  for (const a of emp.attendance) {
    if (a.isDemo === true || !a.date.startsWith(period)) continue;
    const list = byDate.get(a.date) || [];
    list.push(a);
    byDate.set(a.date, list);
  }
  const attendedDates = new Set<string>();
  for (const [d, list] of byDate) if (list.some((a) => isAttendedStatus(a.status))) attendedDates.add(d);
  // The leave balance is built from the whole leave year, so a leave day on a
  // day worked in an EARLIER month is dropped there too (the same rule the
  // employee's Leave page uses).
  const attendedAll = new Set<string>(attendedDates);
  for (const a of emp.attendance) if (a.isDemo !== true && isAttendedStatus(a.status)) attendedAll.add(a.date);

  // ---- leave ledger (balance, paid / unpaid days) --------------------------
  const ledger = buildLeaveLedger({
    policy: policy.leave,
    requests: emp.leaveRequests,
    joiningDate: joined,
    isOffDay: (d) => isWeeklyOff(d) || holidaySet.has(d),
    attendedDates: attendedAll,
    period,
  });
  base.leave = ledger.summary;
  base.leaveDays = [...ledger.days.values()].filter((x) => x.date.startsWith(period)).map((x) => ({ date: x.date, leaveType: x.leaveType, kind: x.kind, requestId: x.requestId }));
  for (const f of ledger.flags) flags.push({ severity: "warn", code: "leave", message: f });

  // ---- classify each calendar day exactly once -----------------------------
  for (const d of dates) {
    let cls: DayClass;
    const records = byDate.get(d) || [];
    const kinds = new Set(records.map((r) => statusCategory(r.status)));

    if (notEmployed(d)) cls = "not-employed";
    else if (isWeeklyOff(d)) cls = "weekly-off";
    else if (holidaySet.has(d)) cls = "holiday";
    else if (attendedDates.has(d)) {
      const onlyIncomplete = records.filter((r) => isAttendedStatus(r.status)).every((r) => statusCategory(r.status) === "incomplete");
      if (onlyIncomplete) {
        cls = policy.incompleteDay === "review" ? "review" : "incomplete";
        flags.push({ severity: policy.incompleteDay === "review" ? "block" : "warn", code: "incomplete", date: d, message: `${d}: punched in but no punch-out — ${policy.incompleteDay === "review" ? "needs a decision" : "paid as a worked day, please verify"}.` });
      } else cls = "present";
    } else {
      const ov = emp.overrides?.[d];
      const led = ledger.days.get(d);
      if (ov && (ov.treatment === "paid" || ov.treatment === "unpaid") && ov.reason?.trim()) {
        cls = ov.treatment === "paid" ? "decided-paid" : "decided-unpaid";
      } else if (led) {
        cls = led.kind === "paid" ? "paid-leave" : "unpaid-leave";
        if (led.kind === "unpaid-no-balance") flags.push({ severity: "warn", code: "leave-no-balance", date: d, message: `${d}: ${led.leaveType} approved but no leave balance — treated as unpaid.` });
        if (kinds.has("absent")) flags.push({ severity: "info", code: "absent-superseded", date: d, message: `${d}: an Absent record exists but approved leave covers the day — counted once, as leave.` });
      } else if (kinds.has("absent") && (kinds.size === 1)) {
        cls = "absent";
      } else if (kinds.has("absent")) {
        cls = "review";
        flags.push({ severity: "block", code: "conflict", date: d, message: `${d}: conflicting attendance records for the same day.` });
      } else if (kinds.has("leave")) {
        cls = "review";
        flags.push({ severity: "block", code: "leave-no-request", date: d, message: `${d}: attendance says Leave but there is no approved leave request.` });
      } else if (kinds.has("holiday") || kinds.has("weekly-off")) {
        cls = "decided-paid";
        flags.push({ severity: "info", code: "corrected-off", date: d, message: `${d}: marked ${records[0].status} by an attendance correction — paid.` });
      } else {
        cls = "review";
        flags.push({ severity: "block", code: "missing-attendance", date: d, message: `${d}: no attendance record, no leave and no holiday — needs a decision (paid or unpaid).` });
      }
    }
    dayClasses[d] = cls;
    counts[cls] += 1;
  }

  // ---- money --------------------------------------------------------------
  const earnings: Line[] = [];
  const deductions: Line[] = [];
  let grossC = 0;
  let fixedC = 0;
  for (const c of policy.components) {
    const amount = emp.salary[c.key];
    if (!amount) continue;
    const line = { key: c.key, label: c.label, amount: fromCents(cents(amount)) };
    if (c.type === "earning") { earnings.push(line); grossC += cents(amount); }
    else { deductions.push(line); fixedC += cents(amount); }
  }
  const gross = fromCents(grossC);
  const basic = emp.salary.basicSalary || 0;
  if (!(basic > 0)) flags.push({ severity: "block", code: "no-basic", message: "Basic Salary is missing or zero." });

  const weeklyOffsInMonth = dates.filter((d) => isWeeklyOff(d)).length;
  const holidaysInMonth = dates.filter((d) => holidaySet.has(d) && !isWeeklyOff(d)).length;
  const divisor =
    policy.dayDivisor === "fixed" ? policy.fixedDivisor
    : policy.dayDivisor === "working" ? Math.max(1, dim - weeklyOffsInMonth - holidaysInMonth)
    : dim;

  const lopBase = policy.lopBase === "basic" ? basic : gross;
  const perDay = lopBase / divisor;
  const lopDays = counts.absent + counts["unpaid-leave"] + counts["decided-unpaid"];
  let lop = roundMoney(perDay * lopDays, policy.rounding);
  if (lop > lopBase) {
    lop = roundMoney(lopBase, policy.rounding);
    flags.push({ severity: "warn", code: "lop-capped", message: "Loss of pay was capped at the amount it is calculated from." });
  }
  const notEmp = counts["not-employed"];
  const proration = roundMoney((gross * notEmp) / dim, policy.rounding);

  const totalDedC = cents(lop) + cents(proration) + fixedC;
  const netC = grossC - totalDedC;
  if (netC < 0) flags.push({ severity: "block", code: "negative-net", message: "Net pay is negative — check the salary structure and deductions." });

  // split the (possibly capped) loss of pay by cause: attendance first, the remainder is leave
  const attendanceLopDays = counts.absent + counts["decided-unpaid"];
  const leaveLopDays = counts["unpaid-leave"];
  const attendanceDeduction = Math.min(roundMoney(perDay * attendanceLopDays, policy.rounding), lop);
  const leaveDeduction = fromCents(cents(lop) - cents(attendanceDeduction));

  const hasBlock = flags.some((f) => f.severity === "block");
  return {
    ...base,
    status: hasBlock ? "review" : "ready",
    divisor,
    payableDays: dim - counts["not-employed"] - lopDays,
    earnings, grossEarnings: gross,
    base: lopBase,
    perDayRate: Math.round(perDay * 10000) / 10000,
    lopDays, lopDeduction: lop,
    attendanceLopDays, attendanceDeduction, leaveLopDays, leaveDeduction,
    basicSalary: fromCents(cents(basic)), allowances: fromCents(grossC - cents(basic)),
    otherDeductions: fromCents(fixedC + cents(proration)),
    notEmployedDays: notEmp, notEmployedDeduction: proration,
    deductions, fixedDeductions: fromCents(fixedC),
    totalDeductions: fromCents(totalDedC),
    netPay: fromCents(netC),
  };
}

export type PayrollSummary = {
  employees: number;
  ready: number;
  needsReview: number;
  excluded: number;
  gross: number;
  basic: number;
  allowances: number;
  attendanceDeduction: number;
  leaveDeduction: number;
  otherDeductions: number;
  lopDeduction: number;
  proration: number;
  fixedDeductions: number;
  totalDeductions: number;
  netPay: number;
  flagCounts: Record<Severity, number>;
};

export function summarize(results: EmployeeResult[]): PayrollSummary {
  let gross = 0, lop = 0, pro = 0, fixed = 0, ded = 0, net = 0, basic = 0, allow = 0, attD = 0, leaveD = 0, other = 0;
  const flagCounts: Record<Severity, number> = { block: 0, warn: 0, info: 0 };
  for (const r of results) {
    for (const f of r.flags) flagCounts[f.severity] += 1;
    if (r.status === "excluded") continue;
    gross += cents(r.grossEarnings);
    basic += cents(r.basicSalary);
    allow += cents(r.allowances);
    attD += cents(r.attendanceDeduction);
    leaveD += cents(r.leaveDeduction);
    other += cents(r.otherDeductions);
    lop += cents(r.lopDeduction);
    pro += cents(r.notEmployedDeduction);
    fixed += cents(r.fixedDeductions);
    ded += cents(r.totalDeductions);
    net += cents(r.netPay);
  }
  return {
    employees: results.length,
    ready: results.filter((r) => r.status === "ready").length,
    needsReview: results.filter((r) => r.status === "review").length,
    excluded: results.filter((r) => r.status === "excluded").length,
    gross: fromCents(gross), basic: fromCents(basic), allowances: fromCents(allow),
    attendanceDeduction: fromCents(attD), leaveDeduction: fromCents(leaveD), otherDeductions: fromCents(other), lopDeduction: fromCents(lop), proration: fromCents(pro),
    fixedDeductions: fromCents(fixed), totalDeductions: fromCents(ded), netPay: fromCents(net),
    flagCounts,
  };
}

// Approval is allowed only when nothing is waiting for a decision.
export function approvalBlockers(results: EmployeeResult[], company: Flag[]): string[] {
  const out: string[] = [];
  for (const f of company) if (f.severity === "block") out.push(f.message);
  const review = results.filter((r) => r.status === "review");
  if (review.length) out.push(`${review.length} employee(s) still have items that need a decision.`);
  if (!results.some((r) => r.status === "ready")) out.push("There is nobody to pay: no employee is ready.");
  return out;
}

export { daysInMonth };
