// Leave entitlement ledger. The balance is ALWAYS recomputed from the source
// records (approved leave requests + policy), never stored as a running
// number — so re-running payroll can never deduct the same leave twice.

import { addDay, daysInMonth, isValidDate, leaveYearOf, monthOf } from "./calendar";
import type { LeavePolicy } from "./policy";

export type LeaveRequest = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
};

export type LeaveDayKind = "paid" | "unpaid-type" | "unpaid-no-balance";

export type LeaveDay = {
  date: string;
  requestId: string;
  leaveType: string;
  kind: LeaveDayKind;
};

export type LeaveSummary = {
  leaveYear: number; // calendar year the leave year starts in
  opening: number; // carried forward
  accruedToDate: number;
  usedYearToDate: number; // paid leave days consumed
  usedThisMonth: number;
  unpaidThisMonth: number;
  available: number; // balance after this month's leave (can be negative if allowed)
  encashableDays: number; // reported only — never paid automatically
};

export type LedgerInput = {
  policy: LeavePolicy;
  requests: LeaveRequest[]; // APPROVED requests only
  joiningDate?: string | null;
  // true for weekly offs and company holidays: those are never leave days
  isOffDay: (date: string) => boolean;
  // dates the person actually worked: a leave day on a worked day is dropped
  attendedDates: ReadonlySet<string>;
  period: string; // payroll month "YYYY-MM"
};

export type LedgerResult = {
  days: Map<string, LeaveDay>;
  summary: LeaveSummary;
  flags: string[];
};

const MAX_RANGE_DAYS = 400;
const MAX_YEARS_BACK = 6;

function roundBalance(v: number, mode: LeavePolicy["accrualRounding"]): number {
  if (mode === "down") return Math.floor(v + 1e-9);
  if (mode === "up") return Math.ceil(v - 1e-9);
  if (mode === "half-day") return Math.floor(v * 2 + 1e-9) / 2;
  return Math.round(v * 1000) / 1000;
}

// What one calendar month adds to the balance, given the joining date.
function monthAccrual(policy: LeavePolicy, period: string, joiningDate: string | null | undefined): number {
  const full = policy.accrualPerMonth;
  if (!joiningDate || !isValidDate(joiningDate)) return full;
  const joinMonth = monthOf(joiningDate);
  if (period < joinMonth) return 0;
  if (period > joinMonth) return full;
  const day = Number(joiningDate.slice(8, 10));
  if (day <= policy.joiningCutoffDay) return full;
  if (policy.lateJoinerAccrual === "none") return 0;
  const n = daysInMonth(period);
  return full * ((n - day + 1) / n);
}

// Cumulative accrual available to a leave taken in `period` (rounding is
// applied to the running total, and the total never exceeds the entitlement).
function accruedBy(policy: LeavePolicy, year: number, period: string, joiningDate: string | null | undefined): number {
  const startMonth = policy.leaveYearStartMonth;
  let total = 0;
  for (let i = 0; i < 12; i++) {
    const mm = ((startMonth - 1 + i) % 12) + 1;
    const yy = year + Math.floor((startMonth - 1 + i) / 12);
    const p = `${yy}-${String(mm).padStart(2, "0")}`;
    const counted = policy.accrualTiming === "start-of-month" ? p <= period : p < period;
    if (counted) total += monthAccrual(policy, p, joiningDate);
  }
  return Math.min(roundBalance(total, policy.accrualRounding), policy.annualEntitlement);
}

// Balance accrued once `period` has fully passed (end-of-month accrual only
// becomes usable the month AFTER it is earned).
function accruedAtEnd(policy: LeavePolicy, year: number, period: string, joiningDate: string | null | undefined): number {
  return accruedBy(policy, year, policy.accrualTiming === "end-of-month" ? nextPeriod(period) : period, joiningDate);
}

function yearEndPeriod(policy: LeavePolicy, year: number): string {
  const startMonth = policy.leaveYearStartMonth;
  const mm = ((startMonth - 1 + 11) % 12) + 1;
  const yy = year + Math.floor((startMonth - 1 + 11) / 12);
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

type Candidate = LeaveDay & { paidType: boolean };

export function buildLeaveLedger(input: LedgerInput): LedgerResult {
  const { policy, requests, joiningDate, isOffDay, attendedDates, period } = input;
  const flags: string[] = [];
  const periodEnd = `${period}-${String(daysInMonth(period)).padStart(2, "0")}`;
  const unpaidTypes = new Set(policy.unpaidLeaveTypes.map((t) => t.toLowerCase()));
  const paidTypes = new Set(policy.paidLeaveTypes.map((t) => t.toLowerCase()));
  const joined = joiningDate && isValidDate(joiningDate) ? joiningDate : null;

  // ---- 1. expand every request into single days; a day is claimed once -----
  const claimed = new Map<string, Candidate>();
  const reqs = [...requests]
    .filter((r) => isValidDate(r.fromDate) && isValidDate(r.toDate) && r.fromDate <= r.toDate)
    .sort((a, b) => (a.fromDate === b.fromDate ? a.id.localeCompare(b.id) : a.fromDate.localeCompare(b.fromDate)));

  for (const r of reqs) {
    const typeKey = r.leaveType.trim().toLowerCase();
    const isUnpaidType = unpaidTypes.has(typeKey);
    if (!isUnpaidType && !paidTypes.has(typeKey)) {
      flags.push(`Unknown leave type "${r.leaveType}" (request ${r.id}) was treated as paid leave — add it to the leave policy.`);
    }
    let d = r.fromDate;
    for (let i = 0; i < MAX_RANGE_DAYS && d <= r.toDate && d <= periodEnd; i++, d = addDay(d, 1)) {
      if (joined && d < joined) continue;
      if (isOffDay(d)) continue; // weekly offs / company holidays are never leave
      if (attendedDates.has(d)) {
        if (monthOf(d) === period) flags.push(`${d}: approved leave overlaps a day the employee worked — leave not used.`);
        continue;
      }
      if (claimed.has(d)) {
        if (monthOf(d) === period) flags.push(`${d}: overlapping leave requests — counted once.`);
        continue;
      }
      claimed.set(d, { date: d, requestId: r.id, leaveType: r.leaveType, kind: "paid", paidType: !isUnpaidType });
    }
  }

  // ---- 2. walk the days in order, year by year, with carry-forward --------
  const days = Array.from(claimed.values()).sort((a, b) => a.date.localeCompare(b.date));
  const currentYear = leaveYearOf(`${period}-01`, policy.leaveYearStartMonth);
  const firstYear = Math.max(
    currentYear - MAX_YEARS_BACK,
    Math.min(days.length ? leaveYearOf(days[0].date, policy.leaveYearStartMonth) : currentYear, joined ? leaveYearOf(joined, policy.leaveYearStartMonth) : currentYear)
  );

  const negMax = policy.negativeBalanceAllowed ? policy.negativeBalanceMaxDays : 0;
  const result = new Map<string, LeaveDay>();
  let carry = 0;
  let summary: LeaveSummary = {
    leaveYear: currentYear,
    opening: 0,
    accruedToDate: 0,
    usedYearToDate: 0,
    usedThisMonth: 0,
    unpaidThisMonth: 0,
    available: 0,
    encashableDays: 0,
  };

  for (let year = firstYear; year <= currentYear; year++) {
    const opening = carry;
    let used = 0;
    let usedThisMonth = 0;
    let unpaidThisMonth = 0;
    const yearDays = days.filter((x) => leaveYearOf(x.date, policy.leaveYearStartMonth) === year);

    for (const x of yearDays) {
      const available = opening + accruedBy(policy, year, monthOf(x.date), joined) - used;
      let kind: LeaveDayKind;
      if (!x.paidType) kind = "unpaid-type";
      else if (available >= 1 - 1e-9 || available + negMax >= 1 - 1e-9) kind = "paid";
      else kind = "unpaid-no-balance";
      if (kind === "paid") used += 1;
      result.set(x.date, { date: x.date, requestId: x.requestId, leaveType: x.leaveType, kind });
      if (monthOf(x.date) === period) {
        if (kind === "paid") usedThisMonth += 1;
        else unpaidThisMonth += 1;
      }
    }

    const upTo = year === currentYear ? period : yearEndPeriod(policy, year);
    const accrued = accruedAtEnd(policy, year, upTo, joined);
    const available = opening + accrued - used;

    if (year === currentYear) {
      const isYearEnd = period === yearEndPeriod(policy, year);
      summary = {
        leaveYear: year,
        opening,
        accruedToDate: accrued,
        usedYearToDate: used,
        usedThisMonth,
        unpaidThisMonth,
        available,
        encashableDays:
          policy.encashmentEnabled && isYearEnd ? Math.min(Math.max(available, 0), policy.encashmentMaxDays) : 0,
      };
    } else {
      // closing balance of a finished year -> next year's opening
      const closing = opening + accruedAtEnd(policy, year, yearEndPeriod(policy, year), joined) - used;
      carry = policy.carryForwardEnabled ? Math.min(Math.max(closing, 0), policy.carryForwardMaxDays) : 0;
    }
  }

  if (summary.available < 0) flags.push(`Leave balance is negative (${summary.available}).`);
  return { days: result, summary, flags };
}

function nextPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
