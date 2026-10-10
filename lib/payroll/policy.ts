// Payroll policy: every company rule that changes a salary lives here as
// configuration (stored in settings/payrollPolicy, written only by the
// server), never as a number buried in a calculation.

import { DEFAULT_TDS, MAX_TDS_PERCENT, describeTds, type TdsPolicy } from "./tds";

export type ComponentType = "earning" | "deduction";

export type SalaryComponent = {
  key: string; // camelCase, stored on the salary structure
  label: string;
  type: ComponentType;
  legacy?: boolean; // stored as a flat field on salaryStructure (older screens read these)
};

// The fields the existing salary screens already use, plus two generic ones.
export const DEFAULT_COMPONENTS: SalaryComponent[] = [
  { key: "basicSalary", label: "Basic Salary", type: "earning", legacy: true },
  { key: "hra", label: "HRA", type: "earning", legacy: true },
  { key: "specialAllowance", label: "Special Allowance", type: "earning", legacy: true },
  { key: "medical", label: "Medical Allowance", type: "earning", legacy: true },
  { key: "conveyance", label: "Conveyance", type: "earning", legacy: true },
  { key: "foodAllowance", label: "Food Allowance", type: "earning", legacy: true },
  { key: "internetAllowance", label: "Internet Allowance", type: "earning", legacy: true },
  { key: "bonus", label: "Bonus", type: "earning" },
  { key: "otherAllowance", label: "Other Allowance", type: "earning" },
  { key: "pf", label: "Provident Fund (PF)", type: "deduction", legacy: true },
  { key: "esi", label: "ESI", type: "deduction", legacy: true },
  { key: "professionalTax", label: "Professional Tax", type: "deduction", legacy: true },
  { key: "tds", label: "TDS", type: "deduction", legacy: true },
  { key: "otherDeduction", label: "Other Deduction", type: "deduction" },
];

export type LeavePolicy = {
  annualEntitlement: number; // days per leave year
  accrualPerMonth: number;
  leaveYearStartMonth: number; // 1 = January
  accrualTiming: "start-of-month" | "end-of-month";
  // Joining month: joined on/before the cutoff day -> full month's accrual;
  // after it -> per this rule.
  joiningCutoffDay: number;
  lateJoinerAccrual: "none" | "prorate";
  accrualRounding: "none" | "half-day" | "down" | "up";
  carryForwardEnabled: boolean;
  carryForwardMaxDays: number;
  encashmentEnabled: boolean; // reported only — never paid automatically
  encashmentMaxDays: number;
  negativeBalanceAllowed: boolean;
  negativeBalanceMaxDays: number;
  paidLeaveTypes: string[]; // consume the balance
  unpaidLeaveTypes: string[]; // always loss of pay
};

export type PayrollPolicy = {
  // false until a Super Admin saves the policy once: payroll can be previewed
  // but not approved on defaults nobody has confirmed.
  confirmed: boolean;
  dayDivisor: "calendar" | "fixed" | "working";
  fixedDivisor: number;
  lopBase: "basic" | "gross";
  rounding: "rupee" | "paisa";
  incompleteDay: "paid-flag" | "review"; // punched in, never punched out
  components: SalaryComponent[];
  tds: TdsPolicy;
  leave: LeavePolicy;
  holidays: {
    expectedPerMonth: number; // company-declared holidays per month (warn when different)
    // holidays.category values that are NOT company holidays
    nonCompanyCategories: string[];
    substituteHolidays: boolean; // flag a holiday that lands on a weekly off
  };
};

export const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  annualEntitlement: 24,
  accrualPerMonth: 2,
  leaveYearStartMonth: 1,
  accrualTiming: "start-of-month",
  joiningCutoffDay: 15,
  lateJoinerAccrual: "none",
  accrualRounding: "none",
  carryForwardEnabled: false,
  carryForwardMaxDays: 0,
  encashmentEnabled: false,
  encashmentMaxDays: 0,
  negativeBalanceAllowed: false,
  negativeBalanceMaxDays: 0,
  paidLeaveTypes: ["Casual Leave", "Sick Leave", "Paid Leave", "Emergency Leave"],
  unpaidLeaveTypes: ["LOP", "Unpaid Leave"],
};

export const DEFAULT_POLICY: PayrollPolicy = {
  confirmed: false,
  dayDivisor: "calendar",
  fixedDivisor: 30,
  lopBase: "basic", // what the old payroll deducted from; changeable
  rounding: "rupee",
  incompleteDay: "paid-flag",
  components: DEFAULT_COMPONENTS,
  tds: DEFAULT_TDS,
  leave: DEFAULT_LEAVE_POLICY,
  holidays: { expectedPerMonth: 2, nonCompanyCategories: ["Optional"], substituteHolidays: true },
};

const num = (v: unknown, fallback: number, min = 0, max = 1e9): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const strList = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 50) : fallback;

const KEY_RE = /^[a-z][A-Za-z0-9]{0,31}$/;

export function normalizeComponents(raw: unknown): SalaryComponent[] {
  if (!Array.isArray(raw)) return DEFAULT_COMPONENTS;
  const out: SalaryComponent[] = [];
  const seen = new Set<string>();
  for (const c of raw as Array<Partial<SalaryComponent>>) {
    const key = String(c?.key || "").trim();
    if (!KEY_RE.test(key) || seen.has(key)) continue;
    const type: ComponentType = c?.type === "deduction" ? "deduction" : "earning";
    const label = String(c?.label || key).trim().slice(0, 60) || key;
    const legacy = DEFAULT_COMPONENTS.find((d) => d.key === key);
    seen.add(key);
    // Never put `legacy: undefined` on the object: Firestore rejects undefined values.
    out.push({ key, label, type: legacy ? legacy.type : type, ...(legacy?.legacy ? { legacy: true } : {}) });
  }
  // basicSalary is the anchor of every structure; it can never be removed.
  if (!seen.has("basicSalary")) out.unshift(DEFAULT_COMPONENTS[0]);
  return out.slice(0, 40);
}

// Always returns a complete, valid policy; unknown/invalid saved values fall
// back to the defaults rather than breaking payroll.
export function resolvePolicy(raw: unknown): PayrollPolicy {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const l = (r.leave && typeof r.leave === "object" ? r.leave : {}) as Record<string, unknown>;
  const h = (r.holidays && typeof r.holidays === "object" ? r.holidays : {}) as Record<string, unknown>;
  const t = (r.tds && typeof r.tds === "object" ? r.tds : {}) as Record<string, unknown>;
  const D = DEFAULT_LEAVE_POLICY;
  return {
    confirmed: r.confirmed === true,
    dayDivisor: oneOf(r.dayDivisor, ["calendar", "fixed", "working"] as const, DEFAULT_POLICY.dayDivisor),
    fixedDivisor: num(r.fixedDivisor, DEFAULT_POLICY.fixedDivisor, 1, 31),
    lopBase: oneOf(r.lopBase, ["basic", "gross"] as const, DEFAULT_POLICY.lopBase),
    rounding: oneOf(r.rounding, ["rupee", "paisa"] as const, DEFAULT_POLICY.rounding),
    incompleteDay: oneOf(r.incompleteDay, ["paid-flag", "review"] as const, DEFAULT_POLICY.incompleteDay),
    components: normalizeComponents(r.components),
    tds: {
      mode: oneOf(t.mode, ["fixed", "percent"] as const, DEFAULT_TDS.mode),
      percent: Math.round(num(t.percent, DEFAULT_TDS.percent, 0, MAX_TDS_PERCENT) * 100) / 100,
      base: oneOf(t.base, ["earned", "gross"] as const, DEFAULT_TDS.base),
    },
    leave: {
      annualEntitlement: num(l.annualEntitlement, D.annualEntitlement, 0, 366),
      accrualPerMonth: num(l.accrualPerMonth, D.accrualPerMonth, 0, 31),
      leaveYearStartMonth: Math.round(num(l.leaveYearStartMonth, D.leaveYearStartMonth, 1, 12)),
      accrualTiming: oneOf(l.accrualTiming, ["start-of-month", "end-of-month"] as const, D.accrualTiming),
      joiningCutoffDay: Math.round(num(l.joiningCutoffDay, D.joiningCutoffDay, 1, 31)),
      lateJoinerAccrual: oneOf(l.lateJoinerAccrual, ["none", "prorate"] as const, D.lateJoinerAccrual),
      accrualRounding: oneOf(l.accrualRounding, ["none", "half-day", "down", "up"] as const, D.accrualRounding),
      carryForwardEnabled: l.carryForwardEnabled === true,
      carryForwardMaxDays: num(l.carryForwardMaxDays, D.carryForwardMaxDays, 0, 366),
      encashmentEnabled: l.encashmentEnabled === true,
      encashmentMaxDays: num(l.encashmentMaxDays, D.encashmentMaxDays, 0, 366),
      negativeBalanceAllowed: l.negativeBalanceAllowed === true,
      negativeBalanceMaxDays: num(l.negativeBalanceMaxDays, D.negativeBalanceMaxDays, 0, 366),
      paidLeaveTypes: strList(l.paidLeaveTypes, D.paidLeaveTypes),
      unpaidLeaveTypes: strList(l.unpaidLeaveTypes, D.unpaidLeaveTypes),
    },
    holidays: {
      expectedPerMonth: Math.round(num(h.expectedPerMonth, 2, 0, 31)),
      nonCompanyCategories: strList(h.nonCompanyCategories, DEFAULT_POLICY.holidays.nonCompanyCategories),
      substituteHolidays: h.substituteHolidays !== false,
    },
  };
}

// Plain-language summary printed on every payroll run / payslip so any figure
// can be explained.
export function describePolicy(p: PayrollPolicy): string[] {
  return [
    p.dayDivisor === "calendar"
      ? "Per-day rate = monthly amount ÷ calendar days of the month"
      : p.dayDivisor === "fixed"
        ? `Per-day rate = monthly amount ÷ ${p.fixedDivisor} (fixed)`
        : "Per-day rate = monthly amount ÷ working days (calendar days − weekly offs − company holidays)",
    p.lopBase === "basic" ? "Loss of pay is deducted from Basic Salary" : "Loss of pay is deducted from Gross Salary",
    describeTds(p.tds),
    "Weekly offs and company holidays are paid and are not deducted from leave",
    "Missing attendance is flagged for review — never assumed Present or Absent",
  ];
}
