// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_EXEMPT_ROLES, exemptRolesOf, isAttendanceExempt } from "../lib/attendanceExempt";
import { computeEmployee } from "../lib/payroll/engine";
import { resolvePolicy } from "../lib/payroll/policy";
import { monthDates, weekday } from "../lib/payroll/calendar";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};
const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("default: IT Support (Super Admin) and Admin are exempt; Head, HR, Manager, Team Lead and Employee are not", () => {
  assert.deepEqual(DEFAULT_EXEMPT_ROLES, ["admin", "super_admin"]);
  for (const r of ["admin", "super_admin", "Super Admin", "Admin"]) assert.equal(isAttendanceExempt(r, null), true, r);
  for (const r of ["head", "hr", "HR Admin", "manager", "team_lead", "employee"]) assert.equal(isAttendanceExempt(r, null), false, r);
});
test("someone with NO role assigned (a regular employee) or an unknown label is never exempt", () => {
  for (const r of ["", null, undefined, "intern", "super", "administrator"]) assert.equal(isAttendanceExempt(r as string, null), false, String(r));
});
test("configurable: the saved list replaces the default; junk values are ignored", () => {
  const rules = { attendanceExemptRoles: ["super_admin", "head", "nonsense", "head"] };
  assert.deepEqual(exemptRolesOf(rules), ["super_admin", "head"]);
  assert.equal(isAttendanceExempt("admin", rules), false, "no longer exempt once unticked");
  assert.equal(isAttendanceExempt("head", rules), true);
  assert.deepEqual(exemptRolesOf({ attendanceExemptRoles: [] }), [], "an empty list means nobody is exempt");
  assert.deepEqual(exemptRolesOf({}), DEFAULT_EXEMPT_ROLES);
});

test("payroll: an exempt person with no attendance records is paid for every working day and is NOT held for review", () => {
  const pol = resolvePolicy({ confirmed: true });
  const base = { uid: "u", employeeId: "E1", name: "Admin", weeklyOffDays: [0], joiningDate: "2024-01-01", salary: { basicSalary: 30000 }, attendance: [], leaveRequests: [] };
  const normal = computeEmployee("2026-08", pol, [], base);
  assert.equal(normal.status, "review", "a normal employee with no records is held for a decision");
  const exempt = computeEmployee("2026-08", pol, [], { ...base, attendanceExempt: true });
  assert.equal(exempt.status, "ready");
  assert.equal(exempt.lopDeduction, 0);
  assert.equal(exempt.counts.present, monthDates("2026-08").filter((d) => weekday(d) !== 0).length);
  assert.equal(exempt.netPay, 30000);
});
test("payroll: exemption never overrides weekly offs / holidays / not-yet-joined days", () => {
  const pol = resolvePolicy({ confirmed: true });
  const r = computeEmployee("2026-08", pol, [{ date: "2026-08-15", category: "Company" }], {
    uid: "u", employeeId: "E1", name: "A", weeklyOffDays: [0], joiningDate: "2026-08-20", salary: { basicSalary: 31000 }, attendance: [], leaveRequests: [], attendanceExempt: true,
  });
  assert.equal(r.counts["not-employed"], 19);
  assert.equal(r.counts.holiday, 0, "15 Aug is before joining");
});

test("wiring: reports and audits leave exempt people out; the employee page never auto-marks them Absent; the admin list hides them", () => {
  const rep = read("lib/server/reportsServer.ts");
  assert.ok(rep.includes("exemptUids()") && rep.includes(".filter((d) => !exempt.has(d.id))") && rep.includes('!exempt.has(String(d.data().userId || ""))'));
  const emp = read("app/attendance/page.js");
  assert.ok(emp.includes("/api/attendance/exempt") && emp.includes("if (!exempt) {") && emp.includes("Attendance is not required for your role"));
  const adm = read("app/admin/attendance/page.js");
  assert.ok(adm.includes("/api/attendance/exempt") && adm.includes("!exempt.has(r.userId)"));
  const set = read("app/admin/attendance-settings/page.js");
  assert.ok(set.includes("attendanceExemptRoles") && set.includes("No attendance needed for these roles"));
  assert.ok(read("lib/server/payrollData.ts").includes("attendanceExempt: exempt.has(u.uid)"));
});
test("API: roles come from adminAccess on the server; only admin tier gets the list of exempt people", () => {
  const api = read("app/api/attendance/exempt/route.ts");
  assert.ok(api.includes("verifyRequest(req)") && api.includes("isAdminTierRole(role)") && api.includes("body.uids"));
  const srv = read("lib/server/attendanceExempt.ts");
  assert.ok(srv.includes('collection("adminAccess")') && srv.includes("isAttendanceExempt("));
});

console.log(`\n${passed} passed (attendance exemption)${process.exitCode ? " - with FAILURES" : ""}`);
