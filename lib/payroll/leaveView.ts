// What the Leave screens show. Built on the SAME ledger payroll uses, from the
// SAME leave records (leaveRequests), so the balance an employee sees and the
// leave deducted in their salary can never disagree.

import { addDay, isValidDate, monthOf } from "./calendar";
import { buildLeaveLedger, type LeaveRequest, type LeaveSummary } from "./leave";
import type { LeavePolicy } from "./policy";

export type LeaveRecord = LeaveRequest & { status: string };

export type RequestImpact = {
  id: string;
  workingDays: number; // days that really count (weekly offs & company holidays removed)
  paidDays: number; // use the leave balance (no salary deduction)
  unpaidDays: number; // loss of pay
};

export type LeaveView = {
  summary: LeaveSummary; // balance as of the current month (approved leave only)
  impacts: Record<string, RequestImpact>; // per request id (approved, and pending "if approved")
  pendingWorkingDays: number;
  flags: string[];
};

export function workingDaysInRange(from: string, to: string, isOff: (d: string) => boolean): string[] {
  if (!isValidDate(from) || !isValidDate(to) || from > to) return [];
  const out: string[] = [];
  let d = from;
  for (let i = 0; i < 400 && d <= to; i++, d = addDay(d, 1)) if (!isOff(d)) out.push(d);
  return out;
}

// A new request must not cover a day that another live (pending/approved)
// request already covers — that is how a day would get deducted twice.
export function findOverlap(from: string, to: string, existing: { id?: string; fromDate: string; toDate: string; status: string }[]) {
  return existing.find((r) => (r.status === "Pending" || r.status === "Approved") && r.fromDate <= to && from <= r.toDate) || null;
}

export function computeLeaveView(input: {
  policy: LeavePolicy;
  requests: LeaveRecord[];
  joiningDate?: string | null;
  isOffDay: (d: string) => boolean;
  attendedDates: ReadonlySet<string>;
  today: string; // company-local YYYY-MM-DD
}): LeaveView {
  const { policy, requests, joiningDate, isOffDay, attendedDates, today } = input;
  const period = monthOf(today);
  const live = requests.filter((r) => r.status === "Approved" || r.status === "Pending");
  const approved = live.filter((r) => r.status === "Approved");

  const current = buildLeaveLedger({ policy, requests: approved, joiningDate, isOffDay, attendedDates, period });

  // Project forward to the last month any live request touches.
  let horizon = period;
  for (const r of live) if (isValidDate(r.toDate) && monthOf(r.toDate) > horizon) horizon = monthOf(r.toDate);
  const all = buildLeaveLedger({ policy, requests: live, joiningDate, isOffDay, attendedDates, period: horizon });

  const impacts: Record<string, RequestImpact> = {};
  for (const r of live) impacts[r.id] = { id: r.id, workingDays: 0, paidDays: 0, unpaidDays: 0 };
  for (const day of all.days.values()) {
    const imp = impacts[day.requestId];
    if (!imp) continue;
    imp.workingDays += 1;
    if (day.kind === "paid") imp.paidDays += 1;
    else imp.unpaidDays += 1;
  }
  let pendingWorkingDays = 0;
  for (const r of live) if (r.status === "Pending") pendingWorkingDays += impacts[r.id].workingDays;

  return { summary: current.summary, impacts, pendingWorkingDays, flags: [...new Set([...current.flags])] };
}
