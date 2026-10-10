// Run with:  npm run test:payroll
// The Leave screens and payroll must agree: same records, same ledger.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeEmployee, type AttendanceRec } from "../lib/payroll/engine";
import { computeLeaveView, findOverlap, workingDaysInRange, type LeaveRecord } from "../lib/payroll/leaveView";
import { DEFAULT_POLICY, resolvePolicy } from "../lib/payroll/policy";
import { monthDates, weekday } from "../lib/payroll/calendar";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

const HOL = ["2026-08-15", "2026-08-26"];
const isOff = (d: string) => weekday(d) === 0 || HOL.includes(d);
const policy = resolvePolicy({ confirmed: true });
const rec = (id: string, leaveType: string, fromDate: string, toDate: string, status = "Approved"): LeaveRecord => ({ id, leaveType, fromDate, toDate, status });

test("working days: weekly offs and company holidays are not leave days", () => {
  assert.deepEqual(workingDaysInRange("2026-08-14", "2026-08-17", isOff), ["2026-08-14", "2026-08-17"]);
  assert.deepEqual(workingDaysInRange("2026-08-09", "2026-08-09", isOff), []);
  assert.deepEqual(workingDaysInRange("2026-08-10", "2026-08-09", isOff), [], "reversed range");
  assert.equal(workingDaysInRange("2026-08-03", "2026-08-08", isOff).length, 6);
});
test("overlap: a day already covered by a pending or approved request cannot be applied for again", () => {
  const existing = [rec("a", "Casual Leave", "2026-08-05", "2026-08-07", "Approved"), rec("b", "Sick Leave", "2026-08-20", "2026-08-21", "Pending"), rec("c", "Casual Leave", "2026-08-10", "2026-08-11", "Rejected")];
  assert.equal(findOverlap("2026-08-07", "2026-08-08", existing)?.id, "a");
  assert.equal(findOverlap("2026-08-21", "2026-08-25", existing)?.id, "b");
  assert.equal(findOverlap("2026-08-10", "2026-08-11", existing), null, "a rejected request does not block");
  assert.equal(findOverlap("2026-08-08", "2026-08-09", existing), null);
});

const requests: LeaveRecord[] = [rec("L1", "Casual Leave", "2026-08-05", "2026-08-06"), rec("L2", "LOP", "2026-08-12", "2026-08-12"), rec("L3", "Sick Leave", "2026-08-27", "2026-08-28", "Pending")];
const view = () => computeLeaveView({ policy: policy.leave, requests, joiningDate: "2025-01-01", isOffDay: isOff, attendedDates: new Set(), today: "2026-08-20" });
const payroll = () => {
  const dates = monthDates("2026-08").filter((d) => !isOff(d) && !["2026-08-05", "2026-08-06", "2026-08-12"].includes(d));
  const attendance: AttendanceRec[] = dates.map((date) => ({ date, status: "Present" }));
  return computeEmployee("2026-08", policy, HOL.map((date) => ({ date, category: "Company" })), {
    uid: "u", employeeId: "E1", name: "A", weeklyOffDays: [0], salary: { basicSalary: 31000 }, joiningDate: "2025-01-01",
    attendance, leaveRequests: requests.filter((r) => r.status === "Approved"),
  });
};

test("Leave dashboard and payroll agree on the same leave records (paid, unpaid and balance)", () => {
  const v = view();
  const p = payroll();
  assert.equal(v.impacts.L1.paidDays, p.counts["paid-leave"], "paid days");
  assert.equal(v.impacts.L2.unpaidDays, p.counts["unpaid-leave"], "unpaid days");
  assert.equal(p.counts["paid-leave"], 2);
  assert.equal(p.counts["unpaid-leave"], 1);
  assert.equal(v.summary.usedYearToDate, p.leave!.usedYearToDate);
  assert.equal(v.summary.available, p.leave!.available);
  assert.equal(v.summary.accruedToDate, 16, "8 months × 2 days");
  assert.equal(p.lopDeduction, 1000, "31,000 ÷ 31 × 1 unpaid day");
  assert.deepEqual(p.leaveDays.map((d) => [d.date, d.kind]), [["2026-08-05", "paid"], ["2026-08-06", "paid"], ["2026-08-12", "unpaid-type"]]);
});
test("a pending request does not change the balance, but shows what it WOULD do", () => {
  const v = view();
  assert.equal(v.summary.usedYearToDate, 2);
  assert.equal(v.pendingWorkingDays, 2);
  assert.equal(v.impacts.L3.paidDays, 2);
  const none = computeLeaveView({ policy: policy.leave, requests: [], joiningDate: "2025-01-01", isOffDay: isOff, attendedDates: new Set(), today: "2026-08-20" });
  assert.equal(none.summary.available, 16);
});
test("a request beyond the balance is shown as unpaid before it is approved", () => {
  const v = computeLeaveView({
    policy: policy.leave, joiningDate: "2026-08-01", isOffDay: isOff, attendedDates: new Set(), today: "2026-08-20",
    requests: [rec("P", "Casual Leave", "2026-08-17", "2026-08-21", "Pending")], // 2 days accrued, 5 requested
  });
  assert.equal(v.impacts.P.workingDays, 5);
  assert.equal(v.impacts.P.paidDays, 2);
  assert.equal(v.impacts.P.unpaidDays, 3);
});
test("a rejected request has no effect anywhere", () => {
  const v = computeLeaveView({ policy: policy.leave, requests: [rec("R", "Casual Leave", "2026-08-05", "2026-08-06", "Rejected")], joiningDate: "2025-01-01", isOffDay: isOff, attendedDates: new Set(), today: "2026-08-20" });
  assert.equal(v.summary.usedYearToDate, 0);
  assert.equal(v.impacts.R, undefined);
});
test("leave on a day worked in an EARLIER month is dropped in both places (the whole year is considered)", () => {
  const l = [rec("E", "Casual Leave", "2026-07-08", "2026-07-08")];
  const v = computeLeaveView({ policy: policy.leave, requests: l, joiningDate: "2025-01-01", isOffDay: isOff, attendedDates: new Set(["2026-07-08"]), today: "2026-08-20" });
  assert.equal(v.summary.usedYearToDate, 0);
  const p = computeEmployee("2026-08", policy, [], {
    uid: "u", employeeId: "E1", name: "A", weeklyOffDays: [0], salary: { basicSalary: 31000 }, joiningDate: "2025-01-01",
    attendance: [{ date: "2026-07-08", status: "Present" }], leaveRequests: l,
  });
  assert.equal(p.leave!.usedYearToDate, 0);
});
test("the default policy is 24 days a year at 2 a month", () => {
  assert.equal(DEFAULT_POLICY.leave.annualEntitlement, 24);
  assert.equal(DEFAULT_POLICY.leave.accrualPerMonth, 2);
});

// ------------------------------------------------------------- contracts
const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
test("leave server: the caller is identified from the token; admin overview needs Leave-module access", () => {
  const src = read("lib/server/leaveServer.ts");
  assert.ok(/export async function myLeave\(user: VerifiedUser\) \{\s*const actor = await memberFor\(user\)/.test(src));
  assert.ok(src.includes('where("uid", "==", actor.uid)') && src.includes('where("userId", "==", actor.uid)'));
  assert.ok(/export async function leaveOverview[^{]*\{\s*await actorWith\(user, "leave", "view"\)/.test(src));
  assert.ok(src.includes('collection("leaveRequests")'), "the leave records are the source");
  assert.ok(read("app/api/payroll/[action]/route.ts").includes('"my-leave"') && read("app/api/payroll/[action]/route.ts").includes('"leave-overview"'));
});
test("rules: leave records can be created only as Pending by their owner; only admins approve, edit or delete", () => {
  const rules = read("firestore.rules");
  const block = rules.slice(rules.indexOf("match /leaveRequests/{id}"), rules.indexOf("match /wfhRequests"));
  assert.ok(block.includes("resource.data.uid == request.auth.uid"));
  assert.ok(block.includes("request.resource.data.uid == request.auth.uid") && block.includes("request.resource.data.status == 'Pending'"));
  assert.ok(block.includes("allow update, delete: if isAdminTier();"));
  assert.ok(!/allow read, write: if isMember\(\)/.test(block));
});
test("screens: employee Leave, dashboard and admin Leave all use the shared balance; the old quota model is gone", () => {
  const emp = read("app/leave/page.js");
  assert.ok(emp.includes("useMyLeave(") && emp.includes("workingDaysInRange") && emp.includes("findOverlap("));
  assert.ok(!emp.includes('"leavePolicy"') && !emp.includes("approvedCasual"));
  assert.ok(emp.includes("calendarDays") && emp.includes("totalDays, // working days only"));
  const dash = read("app/dashboard/page.js");
  assert.ok(dash.includes("useMyLeave()") && !/collection\(db, "leaves"\)/.test(dash.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
  const adm = read("app/admin/leave/page.js");
  assert.ok(adm.includes("/api/payroll/leave-overview") && adm.includes("requestedLeaveType"));
  assert.ok(read("components/payroll/RunTab.tsx").includes("Leave taken (from the Leave records)"));
});

test("Settings → Leave & Payroll Policy hosts the real policy editor (Super Admin only, the settings layout guards it)", () => {
  const page = read("app/settings/leave-policy/page.tsx");
  assert.ok(page.includes("<PolicyTab isSuperAdmin={isSuperAdmin} />") && page.includes("Leave &amp; Payroll Policy"));
  assert.ok(page.includes("no longer used"), "the old quotas are kept but marked unused");
  assert.ok(read("app/settings/page.tsx").includes('title: "Leave & Payroll Policy"'));
  assert.ok(read("app/settings/layout.tsx").includes("!isSuperAdmin"));
});

console.log(`\n${passed} passed (leave ↔ payroll)${process.exitCode ? " - with FAILURES" : ""}`);
