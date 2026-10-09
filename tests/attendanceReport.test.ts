// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import {
  REPORT_MONTHS,
  buildEmployeeReport,
  expandLeaveDates,
  normalizeRecord,
  toCsv,
  type AttendanceRecord,
} from "../lib/attendanceReport";
import { runAudit } from "../lib/attendanceAudit";
import type { PolicyRules } from "../lib/attendancePolicy";

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

const NOW = new Date("2026-10-09T06:00:00Z");
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

const ist = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);
const emp = { uid: "a", name: "Asha", shiftId: "day" };

let seq = 0;
const rec = (date: string, extra: Record<string, unknown> = {}, userId = "a"): AttendanceRecord =>
  normalizeRecord({
    id: `r${++seq}`,
    userId,
    date,
    status: "Present",
    PunchIn: ist(date, "09:00"),
    PunchOut: ist(date, "18:00"),
    totalHours: 9,
    ...extra,
  });

const holidays = new Set(["2026-07-14"]);
const leave = expandLeaveDates([{ fromDate: "2026-07-13", toDate: "2026-07-13", status: "Approved" }, { fromDate: "2026-07-15", toDate: "2026-07-15", status: "Pending" }]);

const records: AttendanceRecord[] = [
  rec("2026-07-01"), // Wed present
  rec("2026-07-05", { status: "Absent", PunchIn: null, PunchOut: null, totalHours: 0, attendanceSource: "Auto-marked (no punch-in)" }), // Sun placeholder
  rec("2026-07-06", { status: "Absent" }), // Mon absent despite punch (pre-policy)
  rec("2026-07-07", { PunchOut: null, totalHours: 0 }), // Tue no punch-out
  rec("2026-07-08"),
  rec("2026-07-09"),
  rec("2026-07-10"),
  rec("2026-07-11"),
  rec("2026-07-12"), // Sunday worked
  rec("2026-07-13", { status: "Absent", PunchIn: null, PunchOut: null, totalHours: 0, attendanceSource: "Auto-marked (no punch-in)" }), // leave day
];

const report = buildEmployeeReport({ employee: emp, records, holidays, leaveDates: leave, rules, from: "2026-07-01", to: "2026-07-14", now: NOW });
const day = (d: string) => report.days.find((x) => x.date === d)!;

test("report covers every day of the range", () => assert.equal(report.days.length, 14));
test("punch day is Present", () => assert.equal(day("2026-07-01").kind, "present"));
test("missing record is NOT assumed Present: 'No record'", () => {
  assert.equal(day("2026-07-02").kind, "no-record");
  assert.equal(day("2026-07-03").kind, "no-record");
  assert.equal(day("2026-07-04").kind, "no-record"); // Saturday is a working day
});
test("Sunday placeholder Absent is shown as Weekly off and flagged", () => {
  assert.equal(day("2026-07-05").kind, "weekly-off");
  assert.ok(day("2026-07-05").flags.includes("absent-on-weekly-off"));
});
test("stored Absent with a punch stays Absent (not silently changed) and is flagged", () => {
  assert.equal(day("2026-07-06").kind, "absent");
  assert.ok(day("2026-07-06").flags.includes("absent-with-punch"));
});
test("missing punch-out on a past day is Incomplete", () => assert.equal(day("2026-07-07").kind, "incomplete"));
test("work on a weekly off is Present but flagged as off-day work", () => {
  assert.equal(day("2026-07-12").kind, "present");
  assert.ok(day("2026-07-12").flags.includes("worked-on-off-day"));
});
test("approved leave beats an auto Absent placeholder", () => {
  assert.equal(day("2026-07-13").kind, "leave");
  assert.ok(day("2026-07-13").flags.includes("absent-on-leave"));
});
test("holiday with no record is Holiday", () => assert.equal(day("2026-07-14").kind, "holiday"));
test("pending (not approved) leave is ignored", () => assert.equal(leave.has("2026-07-15"), false));

test("percentage: 5 present / 10 expected = 50.0, off-day work excluded", () => {
  const s = report.summary;
  assert.equal(s.attendedDays, 5);
  assert.equal(s.expectedDays, 10); // 5 present + 1 absent + 1 incomplete + 3 no-record
  assert.equal(s.percentage, 50);
  assert.equal(s.workedOffDays, 1);
  assert.equal(s.counts.leave, 1);
  assert.equal(s.counts.holiday, 1);
  assert.equal(s.counts["weekly-off"], 1);
});

test("future days are Upcoming and excluded", () => {
  const r = buildEmployeeReport({ employee: emp, records: [], holidays: new Set(), leaveDates: new Set(), rules, from: "2026-10-08", to: "2026-10-12", now: NOW });
  assert.equal(r.days.find((d) => d.date === "2026-10-12")!.kind, "upcoming");
  assert.equal(r.days.find((d) => d.date === "2026-10-09")!.label, "Pending today");
  assert.equal(r.days.find((d) => d.date === "2026-10-08")!.kind, "no-record");
});
test("no expected days -> percentage is null, not 0 or 100", () => {
  const r = buildEmployeeReport({ employee: emp, records: [], holidays: new Set(["2026-07-01"]), leaveDates: new Set(), rules, from: "2026-07-01", to: "2026-07-01", now: NOW });
  assert.equal(r.summary.percentage, null);
});
test("'today' uses the company timezone: 01:00 IST on the 10th is still the 10th", () => {
  const justAfterMidnightIst = new Date("2026-10-09T20:00:00Z");
  const r = buildEmployeeReport({ employee: emp, records: [], holidays: new Set(), leaveDates: new Set(), rules, from: "2026-10-10", to: "2026-10-10", now: justAfterMidnightIst });
  assert.equal(r.days[0].label, "Pending today");
});
test("overnight shift: session starting Monday 22:00 and ending Tuesday 06:05 is Monday's Present", () => {
  const n = { uid: "n", name: "Nikhil", shiftId: "night" };
  const record = rec("2026-07-06", {
    PunchIn: ist("2026-07-06", "22:00"),
    PunchOut: ist("2026-07-07", "06:05"),
    totalHours: 8.08,
    shiftId: "night",
    shiftName: "Night",
    shiftSnapshot: { startTime: "22:00", endTime: "06:00", graceMinutes: 10, timezone: "Asia/Kolkata", workdays: [1, 2, 3, 4, 5, 6] },
  }, "n");
  const r = buildEmployeeReport({ employee: n, records: [record], holidays: new Set(), leaveDates: new Set(), rules, from: "2026-07-06", to: "2026-07-07", now: NOW });
  assert.equal(r.days[0].kind, "present");
  assert.equal(r.days[0].shiftName, "Night");
  assert.equal(r.days[1].kind, "no-record");
});
test("shift weekly-off comes from the shift (Mon-Fri shift: Saturday is off)", () => {
  const e = { uid: "f", name: "Fiona", shiftId: "day" };
  const r = buildEmployeeReport({
    employee: e,
    records: [],
    holidays: new Set(),
    leaveDates: new Set(),
    rules: { ...rules, shifts: [{ id: "day", name: "Day", startTime: "09:00", endTime: "18:00", workdays: [1, 2, 3, 4, 5] }] },
    from: "2026-07-04",
    to: "2026-07-04",
    now: NOW,
  });
  assert.equal(r.days[0].kind, "weekly-off");
});
test("month filters cover exactly Jul-Sep 2026", () => {
  assert.deepEqual(REPORT_MONTHS.map((m) => m.key), ["2026-07", "2026-08", "2026-09", "all"]);
  assert.equal(REPORT_MONTHS[1].to, "2026-08-31");
  assert.equal(REPORT_MONTHS[3].from, "2026-07-01");
  assert.equal(REPORT_MONTHS[3].to, "2026-09-30");
});
test("CSV escaping", () => assert.equal(toCsv([["a,b", 'say "hi"', 1]]), '"a,b","say ""hi""",1'));

// ---------------------------------------------------------------------
// AUDIT
// ---------------------------------------------------------------------
const deepFreeze = <T,>(o: T): T => {
  if (o && typeof o === "object" && !(o instanceof Date)) {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

const auditRecords: AttendanceRecord[] = [
  rec("2026-07-05", { status: "Absent", PunchIn: null, PunchOut: null, totalHours: 0, attendanceSource: "Auto-marked (no punch-in)" }), // weekly off
  rec("2026-07-14", { status: "Absent", PunchIn: null, PunchOut: null, totalHours: 0, attendanceSource: "Auto-marked (no punch-in)" }), // holiday
  rec("2026-07-13", { status: "Absent", PunchIn: null, PunchOut: null, totalHours: 0, attendanceSource: "Auto-marked (no punch-in)" }), // leave
  rec("2026-07-06", { status: "Absent" }), // absent with punch, pre-policy
  rec("2026-07-02", { PunchIn: new Date("2026-07-02T20:00:00Z"), PunchOut: new Date("2026-07-03T03:30:00Z") }), // legacy date mismatch (01:30 IST on 3rd)
  rec("2026-07-08"),
  rec("2026-07-08"), // duplicate
  rec("2026-07-09", { PunchOut: ist("2026-07-09", "08:00") }), // out before in
  rec("2026-07-10", { PunchOut: null, totalHours: 0 }), // missing punch-out
  rec("2026-07-11", { totalHours: 3 }), // hours mismatch
  rec("2026-07-15", {}, "ghost"), // orphan
  rec("2026-07-16", { status: "Present", PunchIn: null, PunchOut: null, totalHours: 0 }), // present without punch
  rec("2026-10-12", { status: "Absent", policy: { applied: true } }), // legit policy absent (outside range, must be ignored)
];
const frozenRecords = deepFreeze(auditRecords.map((r) => r));
const audit = runAudit({
  employees: [{ uid: "a", name: "Asha", shiftId: "day" }],
  records: frozenRecords,
  holidays,
  leaveDatesByUser: new Map([["a", leave]]),
  rules,
  from: "2026-07-01",
  to: "2026-07-17",
  now: NOW,
});
const has = (type: string, date?: string) => audit.findings.some((f) => f.type === type && (!date || f.date === date));

test("audit flags Absent on weekly off / holiday / approved leave", () => {
  assert.ok(has("absent-on-weekly-off", "2026-07-05"));
  assert.ok(has("absent-on-holiday", "2026-07-14"));
  assert.ok(has("absent-on-leave", "2026-07-13"));
});
test("audit proposes (never applies) a status for those", () => {
  assert.equal(audit.findings.find((f) => f.type === "absent-on-holiday")!.proposedStatus, "Holiday");
  assert.equal(audit.findings.find((f) => f.type === "absent-on-weekly-off")!.proposedStatus, "Weekly Off");
  assert.equal(audit.findings.find((f) => f.type === "absent-on-leave")!.proposedStatus, "Leave");
});
test("audit flags Absent-with-punch before the policy date", () => assert.ok(has("absent-with-punch", "2026-07-06")));
test("audit flags a legacy record dated differently from the punch-in day (company timezone)", () => assert.ok(has("date-mismatch", "2026-07-02")));
test("audit flags missing working days but never marks them Present", () => {
  assert.ok(has("missing-record", "2026-07-03"));
  const f = audit.findings.find((x) => x.type === "missing-record")!;
  assert.equal(f.proposedStatus, null);
  assert.match(f.suggestion, /Do not assume Present/);
});
test("audit does not report missing records on weekly offs, holidays or leave", () => {
  assert.ok(!has("missing-record", "2026-07-12")); // Sunday
  assert.ok(!has("missing-record", "2026-07-14")); // holiday
});
test("audit flags duplicates, punch order, missing punch-out, hours mismatch, orphans, unverified Present", () => {
  assert.ok(has("duplicate-records", "2026-07-08"));
  assert.ok(has("punch-out-before-punch-in", "2026-07-09"));
  assert.ok(has("missing-punch-out", "2026-07-10"));
  assert.ok(has("hours-mismatch", "2026-07-11"));
  assert.ok(has("orphan-record", "2026-07-15"));
  assert.ok(has("present-without-punch", "2026-07-16"));
});
test("a policy-applied Absent (after 10 Oct) is never flagged as wrong", () => {
  assert.ok(!audit.findings.some((f) => f.date === "2026-10-12"));
});
test("audit is read-only: inputs were frozen and nothing threw", () => assert.ok(Object.isFrozen(frozenRecords[0])));
test("audit summary adds up", () => {
  const total = Object.values(audit.byType).reduce((a, b) => a + b, 0);
  assert.equal(total, audit.findings.length);
  assert.equal(audit.bySeverity.high + audit.bySeverity.medium + audit.bySeverity.low, audit.findings.length);
  assert.equal(audit.recordsScanned, auditRecords.length);
});
test("findings have stable unique ids", () => {
  const ids = audit.findings.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

console.log(`\n${passed} passed (report + audit)${process.exitCode ? " - with FAILURES" : ""}`);
