// Leave balance for the Leave screens — computed by the SAME ledger and from
// the SAME leave records (leaveRequests) that payroll uses.

import { localDateString, resolveShift, companyTimezone } from "../attendancePolicy";
import { isAttendedStatus } from "../attendanceRules";
import { companyHolidayDates } from "../payroll/engine";
import { computeLeaveView, type LeaveRecord } from "../payroll/leaveView";
import type { PayrollPolicy } from "../payroll/policy";
import { adminDb, type VerifiedUser } from "./firebaseAdmin";
import { actorWith, leaveYearStart, loadPolicy, loadRules, loadUsers, memberFor, iso, type UserRow } from "./payrollData";

type Ctx = Awaited<ReturnType<typeof context>>;

async function context() {
  const policy = await loadPolicy();
  const rules = await loadRules();
  const today = localDateString(new Date(), companyTimezone(rules));
  const holSnap = await adminDb().collection("holidays").get();
  const holidays = holSnap.docs.map((d) => ({ date: String(d.data().date || ""), category: d.data().category ? String(d.data().category) : undefined }));
  const holidaySet = companyHolidayDates(holidays, policy);
  const since = leaveYearStart(today.slice(0, 7), policy.leave.leaveYearStartMonth);
  // look one leave year further back so carry-forward has its history
  const [py] = since.split("-").map(Number);
  const attSince = `${py - 1}${since.slice(4)}`;
  return { policy, rules, today, holidaySet, holidays: [...holidaySet].sort(), attSince };
}

function viewFor(ctx: Ctx, u: Pick<UserRow, "shiftId" | "joiningDate">, requests: LeaveRecord[], attended: Set<string>) {
  const off = new Set([0, 1, 2, 3, 4, 5, 6].filter((d) => !resolveShift(ctx.rules, u.shiftId).workdays.includes(d)));
  const isOffDay = (d: string) => off.has(new Date(`${d}T00:00:00Z`).getUTCDay()) || ctx.holidaySet.has(d);
  return {
    off: [...off],
    view: computeLeaveView({ policy: ctx.policy.leave, requests, joiningDate: u.joiningDate, isOffDay, attendedDates: attended, today: ctx.today }),
  };
}

const leavePolicyPublic = (p: PayrollPolicy) => ({
  annualEntitlement: p.leave.annualEntitlement,
  accrualPerMonth: p.leave.accrualPerMonth,
  paidLeaveTypes: p.leave.paidLeaveTypes,
  unpaidLeaveTypes: p.leave.unpaidLeaveTypes,
  carryForwardEnabled: p.leave.carryForwardEnabled,
  negativeBalanceAllowed: p.leave.negativeBalanceAllowed,
});

// The signed-in person's OWN leave position (uid always from the verified token).
export async function myLeave(user: VerifiedUser) {
  const actor = await memberFor(user);
  const ctx = await context();
  const [users, reqSnap, attSnap] = await Promise.all([
    loadUsers(),
    adminDb().collection("leaveRequests").where("uid", "==", actor.uid).get(),
    adminDb().collection("attendance").where("userId", "==", actor.uid).get(),
  ]);
  const me = users.find((u) => u.uid === actor.uid) || { shiftId: null, joiningDate: null };
  const raw = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string });
  const records: LeaveRecord[] = raw.map((r) => ({
    id: r.id, leaveType: String(r.leaveType || ""), fromDate: String(r.fromDate || ""), toDate: String(r.toDate || ""), status: String(r.status || ""),
  }));
  const attended = new Set(attSnap.docs.filter((d) => d.data().isDemo !== true && d.data().date >= ctx.attSince && isAttendedStatus(String(d.data().status))).map((d) => String(d.data().date)));
  const { off, view } = viewFor(ctx, me, records, attended);
  return {
    today: ctx.today,
    policy: leavePolicyPublic(ctx.policy),
    policyConfirmed: ctx.policy.confirmed,
    summary: view.summary,
    pendingWorkingDays: view.pendingWorkingDays,
    flags: view.flags,
    offWeekdays: off,
    holidays: ctx.holidays,
    requests: raw
      .map((r) => ({
        id: r.id, leaveType: String(r.leaveType || ""), fromDate: String(r.fromDate || ""), toDate: String(r.toDate || ""), reason: String(r.reason || ""),
        status: String(r.status || ""), remarks: String(r.remarks || ""), approvedBy: String(r.approvedBy || ""), appliedOn: iso(r.appliedOn),
        impact: view.impacts[r.id] || null,
      }))
      .sort((a, b) => b.fromDate.localeCompare(a.fromDate)),
  };
}

// HR / admins (Leave module view): every employee's balance and the pay
// impact of each request.
export async function leaveOverview(user: VerifiedUser) {
  await actorWith(user, "leave", "view");
  const ctx = await context();
  const [users, reqSnap, attSnap] = await Promise.all([
    loadUsers(),
    adminDb().collection("leaveRequests").get(),
    adminDb().collection("attendance").where("date", ">=", ctx.attSince).get(),
  ]);
  const reqByUid = new Map<string, LeaveRecord[]>();
  for (const d of reqSnap.docs) {
    const x = d.data();
    if (x.isDemo === true || !x.uid) continue;
    reqByUid.set(String(x.uid), [...(reqByUid.get(String(x.uid)) || []), { id: d.id, leaveType: String(x.leaveType || ""), fromDate: String(x.fromDate || ""), toDate: String(x.toDate || ""), status: String(x.status || "") }]);
  }
  const attByUid = new Map<string, Set<string>>();
  for (const d of attSnap.docs) {
    const x = d.data();
    if (x.isDemo === true || !x.userId || !isAttendedStatus(String(x.status))) continue;
    const s = attByUid.get(String(x.userId)) || new Set<string>();
    s.add(String(x.date));
    attByUid.set(String(x.userId), s);
  }
  const impacts: Record<string, unknown> = {};
  const employees = [] as { uid: string; employeeId: string; name: string; available: number; used: number; accrued: number; opening: number; pendingWorkingDays: number }[];
  for (const u of users.filter((x) => x.employeeId && x.status === "active")) {
    const { view } = viewFor(ctx, u, reqByUid.get(u.uid) || [], attByUid.get(u.uid) || new Set());
    Object.assign(impacts, view.impacts);
    employees.push({ uid: u.uid, employeeId: u.employeeId, name: u.name, available: view.summary.available, used: view.summary.usedYearToDate, accrued: view.summary.accruedToDate, opening: view.summary.opening, pendingWorkingDays: view.pendingWorkingDays });
  }
  return { today: ctx.today, policy: leavePolicyPublic(ctx.policy), policyConfirmed: ctx.policy.confirmed, employees: employees.sort((a, b) => a.name.localeCompare(b.name)), impacts };
}
