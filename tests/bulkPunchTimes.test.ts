// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computePunchTimes, validateBulkPunchTimes, validateTimesParams, type BulkPunchTimesRequest, type PunchTimesParams } from "../lib/bulkPunchTimes";
import { confirmPhrase } from "../lib/bulkCorrection";
import { resolveShift, type PolicyRules } from "../lib/attendancePolicy";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};
const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const rules: PolicyRules = {
  officeStartTime: "09:00", officeEndTime: "18:00", graceMinutes: 15, timezone: "Asia/Kolkata",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shifts: [{ id: "day", name: "Day", startTime: "09:00", endTime: "18:00" }, { id: "night", name: "Night", startTime: "22:00", endTime: "06:00" }],
};
const day = resolveShift(rules, "day");
const night = resolveShift(rules, "night");
const NOW = new Date("2026-10-09T06:00:00Z");
const ist = (d: string, t: string) => new Date(`${d}T${t}:00+05:30`);
const P: PunchTimesParams = { inMode: "shift-start", mode: "shift-end" };
const base = { date: "2026-08-03", status: "Present", punchIn: null, punchOut: null, shiftEndAt: null, shift: day, now: NOW };

test("Present with no punch times: punch-in = shift start, punch-out = shift end", () => {
  const r = computePunchTimes({ ...base, params: P });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.punchIn.toISOString(), ist("2026-08-03", "09:00").toISOString());
    assert.equal(r.punchOut.toISOString(), ist("2026-08-03", "18:00").toISOString());
    assert.deepEqual([r.setIn, r.setOut], [true, true]);
  }
});
test("fixed punch-in time and fixed punch-out time (company timezone)", () => {
  const r = computePunchTimes({ ...base, params: { inMode: "fixed-time", inTime: "09:30", mode: "fixed-time", time: "18:30" } });
  assert.ok(r.ok && r.punchIn.toISOString() === ist("2026-08-03", "09:30").toISOString() && r.punchOut.toISOString() === ist("2026-08-03", "18:30").toISOString());
});
test("punch-out = punch-in + N hours", () => {
  const r = computePunchTimes({ ...base, params: { inMode: "fixed-time", inTime: "10:00", mode: "hours-after-in", hours: 8.5 } });
  assert.ok(r.ok && r.punchOut.toISOString() === ist("2026-08-03", "18:30").toISOString());
});
test("night shift: starts at 22:00 and ends the NEXT morning", () => {
  const r = computePunchTimes({ ...base, shift: night, params: P });
  assert.ok(r.ok && r.punchIn.toISOString() === ist("2026-08-03", "22:00").toISOString() && r.punchOut.toISOString() === ist("2026-08-04", "06:00").toISOString());
});
test("an existing punch-in is KEPT and only the punch-out is filled", () => {
  const r = computePunchTimes({ ...base, punchIn: ist("2026-08-03", "09:12"), params: P });
  assert.ok(r.ok && r.punchIn.toISOString() === ist("2026-08-03", "09:12").toISOString() && !r.setIn && r.setOut);
});
test("an existing punch-out is KEPT and only the punch-in is filled (and must be before it)", () => {
  const ok = computePunchTimes({ ...base, punchOut: ist("2026-08-03", "17:40"), params: P });
  assert.ok(ok.ok && ok.setIn && !ok.setOut && ok.punchOut.toISOString() === ist("2026-08-03", "17:40").toISOString());
  const bad = computePunchTimes({ ...base, punchOut: ist("2026-08-03", "08:00"), params: P });
  assert.equal(bad.ok, false);
});
test("a record that already has both times is skipped, never overwritten", () => {
  const r = computePunchTimes({ ...base, punchIn: ist("2026-08-03", "09:12"), punchOut: ist("2026-08-03", "18:05"), params: P });
  assert.ok(!r.ok && r.reason.startsWith("Already has both"));
});
test("only Present-type records get times: Absent / Leave / Holiday / Weekly Off are skipped with an explanation", () => {
  for (const status of ["Absent", "Leave", "Holiday", "Weekly Off"]) {
    const r = computePunchTimes({ ...base, status, params: P });
    assert.ok(!r.ok && r.reason.includes("set the status to Present first"), status);
  }
  for (const status of ["Present", "Late", "Incomplete", ""]) assert.ok(computePunchTimes({ ...base, status, params: P }).ok, status);
});
test("never in the future; punch-out must follow punch-in; never more than a session", () => {
  const future = computePunchTimes({ ...base, date: "2026-10-09", params: P });
  assert.equal(future.ok, false);
  const backwards = computePunchTimes({ ...base, params: { inMode: "fixed-time", inTime: "19:00", mode: "shift-end" } }); // shift ends 18:00, before the 19:00 punch-in
  assert.equal(backwards.ok, false);
  const long = computePunchTimes({ ...base, punchOut: ist("2026-08-05", "10:00"), params: P });
  assert.equal(long.ok, false);
});
test("parameters are validated", () => {
  assert.equal(validateTimesParams(P), null);
  assert.ok(validateTimesParams({ inMode: "fixed-time", mode: "shift-end" }));
  assert.ok(validateTimesParams({ inMode: "fixed-time", inTime: "25:00", mode: "shift-end" }));
  assert.ok(validateTimesParams({ inMode: "nope" as never, mode: "shift-end" }));
  assert.ok(validateTimesParams({ inMode: "shift-start", mode: "fixed-time" }));
});
test("results are always consistent: punch-out after punch-in, within 24 h, for 200 random records", () => {
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 200; i++) {
    const d = `2026-0${7 + Math.floor(rnd() * 3)}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`;
    const r = computePunchTimes({
      ...base, date: d, shift: rnd() < 0.5 ? day : night,
      punchIn: rnd() < 0.3 ? ist(d, "09:20") : null,
      params: { inMode: rnd() < 0.5 ? "shift-start" : "fixed-time", inTime: "09:15", mode: (["shift-end", "fixed-time", "hours-after-in"] as const)[Math.floor(rnd() * 3)], time: "19:00", hours: 9 },
    });
    if (r.ok) {
      assert.ok(r.punchOut.getTime() > r.punchIn.getTime());
      assert.ok((r.punchOut.getTime() - r.punchIn.getTime()) / 3600000 <= 24);
      assert.ok(r.punchOut.getTime() <= NOW.getTime());
    }
  }
});

const req = (o: Partial<BulkPunchTimesRequest> = {}): BulkPunchTimesRequest => ({
  ...P, items: [{ recordId: "a" }, { recordId: "b" }], reason: "HR confirmed from the muster register", confirmVerified: true, batchTotal: 2, confirm: confirmPhrase(2), ...o,
});
test("request: reason, verification tick and the typed confirmation are all required", () => {
  assert.deepEqual(validateBulkPunchTimes(req()), []);
  assert.ok(validateBulkPunchTimes(req({ reason: "short" })).some((e) => e.includes("reason")));
  assert.ok(validateBulkPunchTimes(req({ confirmVerified: false })).some((e) => e.includes("verified")));
  assert.ok(validateBulkPunchTimes(req({ confirm: "yes" })).some((e) => e.includes("Type exactly")));
  assert.ok(validateBulkPunchTimes(req({ items: [] })).length > 0);
  assert.ok(validateBulkPunchTimes(req({ items: [{ recordId: "a" }, { recordId: "a" }] })).some((e) => e.includes("twice")));
  assert.ok(validateBulkPunchTimes(req({ inMode: "fixed-time" })).length > 0);
});

test("server: Super Admin first, validation, ONE backup check, each record corrected through the audited single-record path", () => {
  const src = read("lib/server/bulkCorrectionServer.ts");
  const fn = src.slice(src.indexOf("export async function applyBulkPunchTimes("));
  assert.ok(fn.indexOf('admin.role !== "super_admin"') < fn.indexOf("validateBulkPunchTimes(body)"));
  assert.ok(fn.indexOf("validateBulkPunchTimes(body)") < fn.indexOf("assertVerifiedBackupCoversRange("));
  assert.ok(fn.indexOf("assertVerifiedBackupCoversRange(") < fn.indexOf("applyCorrection("));
  assert.ok(fn.includes("computePunchTimes(") && fn.includes("times.setIn ? { punchIn") && fn.includes("times.setOut ? { punchOut"), "only missing times are written");
  assert.ok(fn.includes("confirmVerified: body.confirmVerified") && fn.includes("skipActivityLog: true") && fn.includes('"Bulk Punch Times Set"'));
  assert.ok(read("app/api/attendance/reports/[action]/route.ts").includes('case "bulk-punchtimes"'));
});
test("ui: the button appears for ticked records; the dialog previews every time and needs reason, verification and typed confirmation", () => {
  const page = read("app/admin/attendance-reports/page.tsx");
  assert.ok(page.includes("Set punch in / out…") && page.includes("BulkPunchTimesDialog") && page.includes("punchTimeRows.length > 0"));
  const dlg = read("components/BulkPunchTimesDialog.tsx");
  assert.ok(dlg.includes("computePunchTimes(") && dlg.includes("(kept)") && dlg.includes("/api/attendance/reports/bulk-punchtimes"));
  assert.ok(dlg.includes("confirmVerified: verified") && dlg.includes("confirmPhrase(total)") && dlg.includes("bulkChangeGate("));
  assert.ok(dlg.includes("These times are an administrator&apos;s record, not a machine punch"));
});

console.log(`\n${passed} passed (bulk punch times)${process.exitCode ? " - with FAILURES" : ""}`);
