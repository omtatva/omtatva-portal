// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildEmployeeReport, normalizeRecord, type AttendanceRecord } from "../lib/attendanceReport";
import { explainEmployee, summarizeWhy } from "../lib/attendanceWhy";
import { addDays, weekdayOf, type PolicyRules } from "../lib/attendancePolicy";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

const rules: PolicyRules = { timezone: "Asia/Kolkata", officeStartTime: "09:00", officeEndTime: "18:00", graceMinutes: 15, workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] };
const from = "2026-08-01";
const to = "2026-08-31";
const NOW = new Date("2026-09-05T06:00:00Z");
const working: string[] = [];
for (let d = from; d <= to; d = addDays(d, 1)) if (weekdayOf(d) !== 0) working.push(d);

const emp = (uid: string) => ({ uid, name: uid.toUpperCase(), employeeId: `E-${uid}`, department: "Ops", designation: "x", shiftId: null, joiningDate: "2024-01-01", inactive: false });
const rec = (uid: string, date: string, over: Record<string, unknown>): AttendanceRecord =>
  normalizeRecord({ id: `${uid}_${date}`, userId: uid, date, status: "Present", ...over });
const punched = (uid: string, date: string) => rec(uid, date, { PunchIn: new Date(`${date}T04:00:00Z`), PunchOut: new Date(`${date}T12:30:00Z`), attendanceSource: "Web" });
const report = (uid: string, records: AttendanceRecord[]) =>
  buildEmployeeReport({ employee: emp(uid), records, holidays: new Set(), leaveDates: new Set(), rules, from, to, now: NOW });

test("100% with NO punch times is flagged as unverified — not proof of attendance", () => {
  const w = explainEmployee(report("a", working.map((d) => rec("a", d, { status: "Present", attendanceSource: "" }))));
  assert.equal(w.percentage, 100);
  assert.equal(w.verdict, "no-punch-evidence");
  assert.equal(w.presentWithoutPunch, working.length);
  assert.equal(w.presentWithPunch, 0);
  assert.ok(w.reasons[0].includes("NONE of them has a punch") && w.reasons[0].includes("unverified"));
  assert.deepEqual(w.sources.map((s) => s.source), ["no source recorded (not a normal punch)"]);
});
test("100% with real punches is explained as genuine", () => {
  const w = explainEmployee(report("b", working.map((d) => punched("b", d))));
  assert.equal(w.percentage, 100);
  assert.equal(w.verdict, "all-punched");
  assert.ok(w.reasons[0].includes("every working day has a real punch"));
});
test("0% from auto-created Absent placeholders is explained as such", () => {
  const w = explainEmployee(report("c", working.map((d) => rec("c", d, { status: "Absent", attendanceSource: "Auto-marked (no punch-in)" }))));
  assert.equal(w.percentage, 0);
  assert.equal(w.verdict, "mostly-absent");
  assert.equal(w.absentAuto, working.length);
  assert.ok(w.reasons.some((r) => r.includes("placeholders created automatically")));
});
test("not marked Present because there is NO record at all", () => {
  const w = explainEmployee(report("d", []));
  assert.equal(w.percentage, 0);
  assert.equal(w.verdict, "mostly-no-record");
  assert.equal(w.noRecord, working.length);
  assert.ok(w.reasons.some((r) => r.includes("a missing record is never assumed Present")));
});
test("punched in without a punch-out is called out (not counted as Present)", () => {
  const recs = working.map((d, i) => (i < 3 ? rec("e", d, { PunchIn: new Date(`${d}T04:00:00Z`), PunchOut: null, attendanceSource: "Web" }) : punched("e", d)));
  const w = explainEmployee(report("e", recs));
  assert.equal(w.incomplete, 3);
  assert.ok(w.reasons.some((r) => r.includes("no punch-out")));
  assert.ok(w.percentage! < 100);
});
test("mixed evidence: some real punches, some Present-without-punch", () => {
  const recs = working.map((d, i) => (i % 2 ? punched("f", d) : rec("f", d, { status: "Present", attendanceSource: "" })));
  const w = explainEmployee(report("f", recs));
  assert.equal(w.verdict, "mixed-evidence");
  assert.equal(w.presentWithPunch + w.presentWithoutPunch, working.length);
});
test("summary counts how many 100% results have no punch evidence", () => {
  const list = [
    explainEmployee(report("a", working.map((d) => rec("a", d, { attendanceSource: "" })))),
    explainEmployee(report("b", working.map((d) => punched("b", d)))),
    explainEmployee(report("c", working.map((d) => rec("c", d, { status: "Absent", attendanceSource: "Auto-marked (x)" })))),
    explainEmployee(report("d", [])),
  ];
  assert.deepEqual(summarizeWhy(list), { hundredWithoutPunch: 1, hundredPunched: 1, mostlyAbsent: 1, mostlyNoRecord: 1, total: 4 });
});
test("the report tab shows the explainer (read-only)", () => {
  const page = fs.readFileSync(path.join(__dirname, "../app/admin/attendance-reports/page.tsx"), "utf8");
  assert.ok(page.includes("explainAll(") && page.includes("Why do percentages differ?"));
});

test("the header 'Your Shift' chip follows the shift locked on today's record, then the one selected below", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/attendance/page.js"), "utf8").split(String.fromCharCode(13)).join("");
  const i = src.indexOf("const punchedShift = todayData");
  assert.ok(i > 0);
  const block = src.slice(i, src.indexOf('"Select a shift before punching in"', i));
  assert.ok(block.includes("todayData.shiftSnapshot?.startTime") && block.includes("punchedShift\n    ? punchedShift"));
  assert.ok(block.indexOf("punchedShift") < block.indexOf("effectiveShift"), "today's locked shift is checked first, then the selector's shift");
  assert.ok(src.includes("🕒 Your Shift: {myShiftLabel}"));
});

console.log(`\n${passed} passed (attendance explainer)${process.exitCode ? " - with FAILURES" : ""}`);
