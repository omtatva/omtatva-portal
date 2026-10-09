// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import {
  addDays,
  computeExtraHours,
  computeTotalHours,
  evaluatePunchIn,
  findShiftInstanceForPunch,
  isSessionStillOpen,
  listShifts,
  localDateString,
  resolveShift,
  shiftInstance,
  validatePunchOut,
  weekdayOf,
  zonedWallTimeToInstant,
  type PolicyRules,
} from "../lib/attendancePolicy";

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

const iso = (d: Date) => d.toISOString();
const rules: PolicyRules = {
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  graceMinutes: 15,
  extraBufferMinutes: 60,
  timezone: "Asia/Kolkata",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shifts: [
    { id: "day", name: "Day 9-6", startTime: "09:00", endTime: "18:00" },
    { id: "night", name: "Night 10pm-6am", startTime: "22:00", endTime: "06:00", graceMinutes: 10 },
    { id: "ny", name: "NY", startTime: "09:00", endTime: "17:00", timezone: "America/New_York", graceMinutes: 0 },
  ],
};
const day = resolveShift(rules, "day");
const night = resolveShift(rules, "night");

// ---- timezone maths ------------------------------------------------
test("09:00 IST is 03:30Z", () => {
  assert.equal(iso(zonedWallTimeToInstant("2026-10-12", "09:00", "Asia/Kolkata")), "2026-10-12T03:30:00.000Z");
});
test("company-local date: 01:30 IST on the 10th is still the 10th (UTC says the 9th)", () => {
  assert.equal(localDateString(new Date("2026-10-09T20:00:00Z"), "Asia/Kolkata"), "2026-10-10");
});
test("DST: New York 09:00 is 13:00Z on 8 Mar 2026 and 14:00Z on 1 Nov 2026", () => {
  assert.equal(iso(zonedWallTimeToInstant("2026-03-08", "09:00", "America/New_York")), "2026-03-08T13:00:00.000Z");
  assert.equal(iso(zonedWallTimeToInstant("2026-11-01", "09:00", "America/New_York")), "2026-11-01T14:00:00.000Z");
});
test("date helpers", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(weekdayOf("2026-10-11"), 0); // Sunday
  assert.equal(weekdayOf("2026-10-10"), 6); // Saturday
});

// ---- grace boundary (policy active: from 2026-10-10) ----------------
const MON = "2026-10-12"; // Monday
const at = (hhmmss: string) => new Date(`${MON}T${hhmmss}Z`); // UTC clock; 09:15 IST = 03:45Z
const evalDay = (punch: Date, extra: object = {}) => evaluatePunchIn({ punch, shift: day, rules, ...extra });

test("deadline is 09:15 for a 09:00 shift with 15 min grace", () => {
  assert.equal(iso(shiftInstance(day, MON).graceDeadline), "2026-10-12T03:45:00.000Z");
});
test("on time (09:00) -> Present", () => {
  const r = evalDay(at("03:30:00"));
  assert.equal(r.status, "Present");
  assert.equal(r.policyApplied, true);
});
test("early (08:30) -> Present", () => assert.equal(evalDay(at("03:00:00")).status, "Present"));
test("09:14:59 -> Present", () => assert.equal(evalDay(at("03:44:59")).status, "Present"));
test("BOUNDARY exactly 09:15:00.000 -> Present", () =>
  assert.equal(evalDay(new Date("2026-10-12T03:45:00.000Z")).status, "Present"));
test("BOUNDARY 09:15:00.001 -> Absent", () =>
  assert.equal(evalDay(new Date("2026-10-12T03:45:00.001Z")).status, "Absent"));
test("09:15:30 -> Absent (seconds are not rounded)", () => assert.equal(evalDay(at("03:45:30")).status, "Absent"));
test("09:16 -> Absent, with reason and minutes late", () => {
  const r = evalDay(at("03:46:00"));
  assert.equal(r.status, "Absent");
  assert.equal(r.minutesAfterDeadline, 1);
  assert.match(r.reason, /after the grace deadline/);
});
test("very late (14:00 IST) -> Absent", () => assert.equal(evalDay(at("08:30:00")).status, "Absent"));
test("custom grace of 0: NY shift deadline is exactly 09:00 local", () => {
  const ny = resolveShift(rules, "ny");
  const nine = zonedWallTimeToInstant("2026-10-12", "09:00", "America/New_York");
  assert.equal(evaluatePunchIn({ punch: nine, shift: ny, rules }).status, "Present");
  assert.equal(evaluatePunchIn({ punch: new Date(nine.getTime() + 1000), shift: ny, rules }).status, "Absent");
});

// ---- effective date / exemptions ------------------------------------
test("before 2026-10-10 the old behaviour holds: late punch stays Present", () => {
  const punch = new Date("2026-10-09T05:30:00Z"); // 11:00 IST on Fri 9 Oct
  const r = evaluatePunchIn({ punch, shift: day, rules });
  assert.equal(r.status, "Present");
  assert.equal(r.skipReason, "policy-not-yet-effective");
});
test("Jul-Sep history is never touched by the policy", () => {
  const r = evaluatePunchIn({ punch: new Date("2026-09-30T08:00:00Z"), shift: day, rules });
  assert.equal(r.status, "Present");
});
test("policy applies on the effective date itself (Sat 10 Oct, a working day)", () => {
  const r = evaluatePunchIn({ punch: new Date("2026-10-10T05:00:00Z"), shift: day, rules });
  assert.equal(r.status, "Absent");
});
test("Sunday (weekly off): late punch is NOT Absent", () => {
  const r = evaluatePunchIn({ punch: new Date("2026-10-11T08:00:00Z"), shift: day, rules });
  assert.equal(r.status, "Present");
  assert.equal(r.skipReason, "weekly-off");
});
test("holiday: late punch is NOT Absent", () => {
  const r = evalDay(at("08:00:00"), { isHoliday: true });
  assert.equal(r.status, "Present");
  assert.equal(r.skipReason, "holiday");
});
test("approved leave: late punch is NOT Absent", () => {
  const r = evalDay(at("08:00:00"), { onApprovedLeave: true });
  assert.equal(r.status, "Present");
  assert.equal(r.skipReason, "approved-leave");
});
test("policy disabled in settings", () => {
  const r = evaluatePunchIn({
    punch: at("08:00:00"),
    shift: day,
    rules: { ...rules, absentPolicy: { enabled: false } },
  });
  assert.equal(r.status, "Present");
  assert.equal(r.skipReason, "policy-disabled");
});
test("effectiveFrom is configurable", () => {
  const later = { ...rules, absentPolicy: { enabled: true, effectiveFrom: "2026-11-01" } };
  assert.equal(evaluatePunchIn({ punch: at("08:00:00"), shift: day, rules: later }).status, "Present");
});

// ---- overnight shifts -----------------------------------------------
test("overnight instance ends the next morning", () => {
  const inst = shiftInstance(night, MON);
  assert.equal(iso(inst.start), "2026-10-12T16:30:00.000Z"); // 22:00 IST
  assert.equal(iso(inst.end), "2026-10-13T00:30:00.000Z"); // 06:00 IST next day
});
test("overnight on time (22:10 IST) -> Present", () => {
  assert.equal(evaluatePunchIn({ punch: new Date("2026-10-12T16:40:00Z"), shift: night, rules }).status, "Present");
});
test("overnight 22:10:00.001 -> Absent (10 min grace)", () => {
  assert.equal(evaluatePunchIn({ punch: new Date("2026-10-12T16:40:00.001Z"), shift: night, rules }).status, "Absent");
});
test("01:00 IST punch belongs to the PREVIOUS day overnight shift", () => {
  const punch = new Date("2026-10-12T19:30:00Z"); // 01:00 IST on 13th
  assert.equal(findShiftInstanceForPunch(night, punch).date, "2026-10-12");
});
test("21:00 IST punch (1h early) belongs to that evening shift", () => {
  const punch = new Date("2026-10-12T15:30:00Z");
  assert.equal(findShiftInstanceForPunch(night, punch).date, "2026-10-12");
});
test("overnight extra hours measured from shift end, not midnight", () => {
  const inst = shiftInstance(night, MON);
  assert.equal(computeExtraHours(new Date("2026-10-13T02:30:00Z"), inst.end, 60), 1); // out 08:00 IST, cutoff 07:00 IST
  assert.equal(computeExtraHours(new Date("2026-10-13T00:30:00Z"), inst.end, 60), 0); // out at 06:00 IST
});
test("day-shift extra hours respect the buffer", () => {
  const inst = shiftInstance(day, MON); // ends 18:00 IST = 12:30Z, buffer to 19:00 IST = 13:30Z
  assert.equal(computeExtraHours(new Date("2026-10-12T13:30:00Z"), inst.end, 60), 0); // exactly at cutoff
  assert.equal(computeExtraHours(new Date("2026-10-12T15:00:00Z"), inst.end, 60), 1.5); // 20:30 IST
});

// ---- punch-out validation / hours -----------------------------------
const pin = new Date("2026-10-12T03:30:00Z");
test("punch-out: no session", () => assert.equal(validatePunchOut(null, null, new Date()).ok, false));
test("punch-out: already punched out", () => {
  const r = validatePunchOut(pin, new Date(), new Date("2026-10-12T12:00:00Z"));
  assert.equal(r.ok === false && r.code, "already-punched-out");
});
test("punch-out: before punch-in is invalid", () => {
  const r = validatePunchOut(pin, null, new Date("2026-10-12T03:00:00Z"));
  assert.equal(r.ok === false && r.code, "invalid-sequence");
});
test("punch-out: normal", () => assert.equal(validatePunchOut(pin, null, new Date("2026-10-12T12:30:00Z")).ok, true));
test("punch-out: missing punch-out > 24h is expired", () => {
  const r = validatePunchOut(pin, null, new Date("2026-10-13T04:00:00Z"));
  assert.equal(r.ok === false && r.code, "session-expired");
});
test("total hours", () => assert.equal(computeTotalHours(pin, new Date("2026-10-12T12:30:00Z")), 9));
test("session still open until shift end (overnight morning is not Incomplete)", () => {
  const inst = shiftInstance(night, MON);
  assert.equal(isSessionStillOpen(inst.end, new Date("2026-10-12T23:00:00Z")), true);
  assert.equal(isSessionStillOpen(inst.end, new Date("2026-10-13T02:00:00Z")), false);
});

// ---- shift resolution -----------------------------------------------
test("no shifts configured -> one default shift from office timing", () => {
  const list = listShifts({ officeStartTime: "10:30", officeEndTime: "19:30", graceMinutes: 5 });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, "default");
  assert.equal(list[0].startTime, "10:30");
  assert.equal(list[0].graceMinutes, 5);
});
test("unknown shift id falls back to default instead of throwing", () => {
  assert.equal(resolveShift(rules, "does-not-exist").id, "default");
});
test("legacy shift (no grace/tz/workdays) inherits company values", () => {
  const s = resolveShift(rules, "day");
  assert.equal(s.graceMinutes, 15);
  assert.equal(s.timezone, "Asia/Kolkata");
  assert.deepEqual(s.workdays, [1, 2, 3, 4, 5, 6]);
});
test("invalid timezone falls back to Asia/Kolkata", () => {
  assert.equal(resolveShift({ ...rules, timezone: "Not/AZone" }, "day").timezone, "Asia/Kolkata");
});

console.log(`\n${passed} passed${process.exitCode ? " - with FAILURES" : ""}`);
