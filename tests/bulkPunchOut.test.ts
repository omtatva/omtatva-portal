// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computePunchOut, validateBulkPunchOut, validateParams, type BulkPunchOutRequest } from "../lib/bulkPunchOut";
import { confirmPhrase } from "../lib/bulkCorrection";
import { diffChanges } from "../lib/attendanceCorrection";
import { resolveShift, type PolicyRules } from "../lib/attendancePolicy";
import { computeDisplayStatus } from "../lib/attendanceRules";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    console.error("FAIL", name, "\n  ", (e as Error).message);
    process.exitCode = 1;
  }
};

const rules: PolicyRules = {
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  graceMinutes: 15,
  timezone: "Asia/Kolkata",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shifts: [
    { id: "day", name: "Day", startTime: "09:00", endTime: "18:00" },
    { id: "night", name: "Night", startTime: "22:00", endTime: "06:00" },
  ],
};
const day = resolveShift(rules, "day");
const night = resolveShift(rules, "night");
const NOW = new Date("2026-10-09T06:00:00Z");
const ist = (d: string, t: string) => new Date(`${d}T${t}:00+05:30`);
const iso = (d: Date) => d.toISOString();

// ----------------------------------------------------------- shift end
test("shift end: a day-shift record gets that day's 18:00", () => {
  const r = computePunchOut({ params: { mode: "shift-end" }, date: "2026-08-03", punchIn: ist("2026-08-03", "09:02"), shiftEndAt: ist("2026-08-03", "18:00"), shift: day, now: NOW });
  assert.ok(r.ok && iso(r.at) === iso(ist("2026-08-03", "18:00")));
});
test("shift end: older records without a saved shift end fall back to the employee's shift", () => {
  const r = computePunchOut({ params: { mode: "shift-end" }, date: "2026-08-03", punchIn: ist("2026-08-03", "09:02"), shiftEndAt: null, shift: day, now: NOW });
  assert.ok(r.ok && iso(r.at) === iso(ist("2026-08-03", "18:00")));
});
test("shift end: overnight shift ends the NEXT morning", () => {
  const r = computePunchOut({ params: { mode: "shift-end" }, date: "2026-08-03", punchIn: ist("2026-08-03", "22:05"), shiftEndAt: null, shift: night, now: NOW });
  assert.ok(r.ok && iso(r.at) === iso(ist("2026-08-04", "06:00")));
});
test("shift end: a person who punched in after their shift ended is skipped, not given a negative day", () => {
  const r = computePunchOut({ params: { mode: "shift-end" }, date: "2026-08-03", punchIn: ist("2026-08-03", "19:00"), shiftEndAt: ist("2026-08-03", "18:00"), shift: day, now: NOW });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : "", /not after/);
});

// ----------------------------------------------------------- fixed time
test("fixed time: the same clock time on each record's day (company timezone)", () => {
  const r = computePunchOut({ params: { mode: "fixed-time", time: "18:30" }, date: "2026-08-05", punchIn: ist("2026-08-05", "09:00"), shiftEndAt: null, shift: day, now: NOW });
  assert.ok(r.ok && iso(r.at) === iso(ist("2026-08-05", "18:30")));
});
test("fixed time: for a night shift, a morning time means the next day", () => {
  const r = computePunchOut({ params: { mode: "fixed-time", time: "06:00" }, date: "2026-08-05", punchIn: ist("2026-08-05", "22:00"), shiftEndAt: null, shift: night, now: NOW });
  assert.ok(r.ok && iso(r.at) === iso(ist("2026-08-06", "06:00")));
});
test("fixed time: must be a valid HH:MM", () => {
  for (const t of ["", "25:00", "9:00", "18:60", "abc"]) assert.ok(validateParams({ mode: "fixed-time", time: t }), t);
  assert.equal(validateParams({ mode: "fixed-time", time: "18:00" }), null);
});

// ------------------------------------------------------------ hours after
test("hours after punch-in: exact, with a sensible range", () => {
  const r = computePunchOut({ params: { mode: "hours-after-in", hours: 9 }, date: "2026-08-03", punchIn: ist("2026-08-03", "09:30"), shiftEndAt: null, shift: day, now: NOW });
  assert.ok(r.ok && iso(r.at) === iso(ist("2026-08-03", "18:30")));
  for (const h of [0, -1, 25, Number.NaN]) assert.ok(validateParams({ mode: "hours-after-in", hours: h }), String(h));
  assert.equal(validateParams({ mode: "hours-after-in", hours: 24 }), null);
});

// ------------------------------------------------------------- safety
test("never in the future, never more than one session long, never without a punch-in", () => {
  const future = computePunchOut({ params: { mode: "shift-end" }, date: "2026-10-09", punchIn: ist("2026-10-09", "09:00"), shiftEndAt: ist("2026-10-09", "18:00"), shift: day, now: NOW });
  assert.equal(future.ok, false);
  assert.match(!future.ok ? future.reason : "", /future/);
  const long = computePunchOut({ params: { mode: "shift-end" }, date: "2026-08-03", punchIn: ist("2026-08-03", "09:00"), shiftEndAt: ist("2026-08-05", "09:00"), shift: day, now: NOW });
  assert.equal(long.ok, false);
  const none = computePunchOut({ params: { mode: "shift-end" }, date: "2026-08-03", punchIn: null, shiftEndAt: null, shift: day, now: NOW });
  assert.equal(none.ok, false);
});
test("the stored result recalculates total hours and leaves the status alone", () => {
  const before = { status: "Present", punchIn: ist("2026-08-03", "09:00"), punchOut: null, totalHours: 0 };
  const { after, list } = diffChanges(before, { punchOut: iso(ist("2026-08-03", "18:00")) });
  assert.deepEqual(list.map((c) => c.field), ["PunchOut", "totalHours"]);
  assert.equal(after.totalHours, 9);
  assert.equal(after.status, "Present");
  assert.equal(list.find((c) => c.field === "PunchOut")!.from, null, "original (empty) value is recorded");
});

// ------------------------------------------------------------ request rules
const good = (over: Partial<BulkPunchOutRequest> = {}): BulkPunchOutRequest => ({
  mode: "shift-end",
  items: [{ recordId: "r1" }, { recordId: "r2" }],
  reason: "Door-access log checked",
  confirmVerified: true,
  batchTotal: 2,
  confirm: confirmPhrase(2),
  ...over,
});
test("a complete request is valid; verification, reason and typed confirmation are all required", () => {
  assert.deepEqual(validateBulkPunchOut(good()), []);
  assert.ok(validateBulkPunchOut(good({ confirmVerified: false })).some((e) => /verified/.test(e)));
  assert.ok(validateBulkPunchOut(good({ reason: "short" })).some((e) => /reason/.test(e)));
  assert.ok(validateBulkPunchOut(good({ confirm: "APPLY 1 CORRECTIONS" })).some((e) => /Type exactly/.test(e)));
  assert.ok(validateBulkPunchOut(good({ items: [], batchTotal: 0, confirm: confirmPhrase(0) })).length > 0);
  assert.ok(validateBulkPunchOut(good({ items: [{ recordId: "r1" }, { recordId: "r1" }] })).some((e) => /twice/.test(e)));
  assert.ok(validateBulkPunchOut(good({ mode: "fixed-time", time: "99:99" })).length > 0);
});

// ------------------------------------------------------- source contracts
const read = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");
const server = read("../lib/server/bulkCorrectionServer.ts");
const bulkPart = server.slice(server.indexOf("applyBulkPunchOut"));
const route = read("../app/api/attendance/reports/[action]/route.ts");
const page = read("../app/admin/attendance-reports/page.tsx");
const dialog = read("../components/BulkPunchOutDialog.tsx");
const corr = read("../lib/server/correctionServer.ts");

test("server: Super Admin, validation and the backup check come first; every time is computed on the SERVER", () => {
  const role = bulkPart.indexOf('admin.role !== "super_admin"');
  const valid = bulkPart.indexOf("validateBulkPunchOut(body)");
  const backup = bulkPart.indexOf("assertVerifiedBackupCoversRange(");
  const compute = bulkPart.indexOf("computePunchOut({");
  const write = bulkPart.indexOf("await applyCorrection(");
  assert.ok(role > 0 && role < valid && valid < backup && backup < compute && compute < write);
  assert.ok(bulkPart.includes("params: body"), "uses the stored record + saved rules, not times sent by the browser");
});
test("server: records that already have a punch-out (or never punched in) are skipped, never overwritten", () => {
  assert.ok(bulkPart.includes("!punchIn || d.PunchOut") && bulkPart.includes("result.skipped++"));
});
test("server: each record is corrected through the audited single-record path, and a stored punch-out must follow the punch-in", () => {
  assert.ok(bulkPart.includes("applyCorrection(") && !/\.(set|update|delete)\(/.test(bulkPart.replace(/\/\/.*$/gm, "")));
  assert.ok(corr.includes("Punch-out must be after punch-in."));
  assert.ok(bulkPart.includes("Bulk Punch-out Set"));
});
test("route: bulk-punchout is behind the Super Admin check", () => {
  const post = route.slice(route.indexOf("export async function POST"));
  assert.ok(post.indexOf("requireSuperAdmin(user)") < post.indexOf('case "bulk-punchout"'));
});
test("ui: 'Set punch-out…' appears only when ticked findings include missing punch-outs; the dialog previews every new time", () => {
  assert.ok(page.includes("missingPunchOutCount > 0") && page.includes("Set punch-out…"));
  assert.ok(page.includes('f.type === "missing-punch-out"'));
  for (const must of ["New punch-out", "computePunchOut(", "typed === required", "verified &&", "bulkChangeGate(", "shift end time"]) assert.ok(dialog.includes(must), must);
});

test("why 'Incomplete' stays: changing the STATUS never clears it — only adding a punch-out does", () => {
  const rec = { status: "Present", PunchIn: ist("2026-08-03", "09:00"), PunchOut: null, date: "2026-08-03" };
  assert.equal(computeDisplayStatus(rec, null, null, "2026-10-09"), "Incomplete");
  assert.equal(computeDisplayStatus({ ...rec, status: "Present" }, null, null, "2026-10-09"), "Incomplete", "status set to Present: still Incomplete");
  assert.equal(computeDisplayStatus({ ...rec, PunchOut: ist("2026-08-03", "18:00") }, null, null, "2026-10-09"), "Present", "with a punch-out it is Present");
});
test("the correction screens warn when a status change alone will not clear Incomplete", () => {
  assert.ok(read("../components/AttendanceReportViews.tsx").includes("will keep showing <b>Incomplete</b>"));
  const bd = read("../components/BulkCorrectionDialog.tsx");
  assert.ok(bd.includes("stillIncomplete") && bd.includes("Set punch-out…"));
  assert.ok(page.includes("countStillIncomplete(") && page.includes("stillIncomplete={bulk.stillIncomplete}"));
});

console.log(`\n${passed} passed (bulk punch-out)${process.exitCode ? " - with FAILURES" : ""}`);
