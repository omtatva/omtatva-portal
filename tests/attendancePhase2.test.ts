// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import {
  CORRECTION_STATUSES,
  canEditAttendance,
  canRevert,
  diffChanges,
  validateCorrection,
  type CorrectionRequest,
  type RecordValues,
} from "../lib/attendanceCorrection";
import {
  bulkChangeGate,
  canonicalJson,
  compareWithLive,
  createBackupFile,
  deserializeValue,
  serializeValue,
  verifyBackupFile,
} from "../lib/attendanceBackup";
import {
  DEMO_ID_PREFIX,
  assertSafeDemoTarget,
  generateDemoAttendance,
  makeDemoEmployees,
} from "../lib/demoAttendance";
import { buildEmployeeReport, expandLeaveDates, normalizeRecord, REPORT_END, REPORT_START } from "../lib/attendanceReport";
import { runAudit } from "../lib/attendanceAudit";
import type { PolicyRules } from "../lib/attendancePolicy";

let passed = 0;
const test = (name: string, fn: () => void | Promise<void>) => {
  const run = async () => {
    try {
      await fn();
      passed++;
      console.log("PASS", name);
    } catch (e) {
      console.error("FAIL", name, "\n  ", (e as Error).message);
      process.exitCode = 1;
    }
  };
  return run();
};

(async () => {
  // ---------------- corrections -----------------------------------------
  const ctx = { today: "2026-10-09" };
  const good: CorrectionRequest = {
    kind: "update",
    recordId: "r1",
    reason: "Verified from door-access log",
    changes: { status: "Leave" },
  };

  await test("correction needs a written reason (>=10 chars)", () => {
    const r = validateCorrection({ ...good, reason: "short" }, ctx);
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.errors.some((e) => /reason/i.test(e)));
    assert.equal(validateCorrection({ ...good, reason: "          " }, ctx).ok, false);
    assert.equal(validateCorrection(good, ctx).ok, true);
  });
  await test("status must be one of the allowed values", () => {
    assert.equal(validateCorrection({ ...good, changes: { status: "Banana" } }, ctx).ok, false);
    CORRECTION_STATUSES.forEach((s) =>
      assert.equal(validateCorrection({ ...good, changes: { status: s }, confirmVerified: true }, ctx).ok, true)
    );
  });
  await test("marking Present requires the administrator to confirm verification", () => {
    assert.equal(validateCorrection({ ...good, changes: { status: "Present" } }, ctx).ok, false);
    assert.equal(validateCorrection({ ...good, changes: { status: "Present" }, confirmVerified: true }, ctx).ok, true);
  });
  await test("creating a record for a missing day: needs user, date, status; not in the future", () => {
    const base: CorrectionRequest = { kind: "create", userId: "u1", date: "2026-08-03", reason: "Confirmed by manager email", changes: { status: "Leave" } };
    assert.equal(validateCorrection(base, ctx).ok, true);
    assert.equal(validateCorrection({ ...base, date: "2026-12-01" }, ctx).ok, false);
    assert.equal(validateCorrection({ ...base, userId: undefined }, ctx).ok, false);
    assert.equal(validateCorrection({ ...base, changes: {} }, ctx).ok, false);
    assert.equal(validateCorrection({ ...base, changes: { status: "Present" } }, ctx).ok, false); // not confirmed
  });
  await test("punch-out must be after punch-in; invalid dates rejected", () => {
    const c = { ...good, changes: { punchIn: "2026-07-01T04:00:00Z", punchOut: "2026-07-01T03:00:00Z" } };
    assert.equal(validateCorrection(c, ctx).ok, false);
    assert.equal(validateCorrection({ ...good, changes: { punchIn: "not a date" } }, ctx).ok, false);
  });
  await test("an update with no changes is rejected", () => assert.equal(validateCorrection({ ...good, changes: {} }, ctx).ok, false));
  await test("revert only needs a correction id and a reason", () => {
    assert.equal(validateCorrection({ kind: "revert", correctionId: "c1", reason: "Corrected by mistake" }, ctx).ok, true);
    assert.equal(validateCorrection({ kind: "revert", reason: "Corrected by mistake" }, ctx).ok, false);
  });

  const before: RecordValues = {
    status: "Absent",
    punchIn: new Date("2026-07-06T03:30:00Z"),
    punchOut: new Date("2026-07-06T12:30:00Z"),
    totalHours: 9,
  };
  await test("diff records original and corrected values, only for real changes", () => {
    const { list, after } = diffChanges(before, { status: "Present", punchIn: before.punchIn!.toISOString() });
    assert.deepEqual(list.map((c) => c.field), ["status"]);
    assert.equal(list[0].from, "Absent");
    assert.equal(list[0].to, "Present");
    assert.equal(after.status, "Present");
  });
  await test("changing punch times recalculates total hours and keeps the original in the diff", () => {
    const { list, after } = diffChanges(before, { punchOut: "2026-07-06T13:30:00.000Z" });
    assert.deepEqual(list.map((c) => c.field), ["PunchOut", "totalHours"]);
    assert.equal(after.totalHours, 10);
    assert.equal(list[0].from, "2026-07-06T12:30:00.000Z");
  });
  await test("identical values produce an empty diff", () => {
    assert.equal(diffChanges(before, { status: "Absent" }).list.length, 0);
  });
  await test("revert is allowed only if the record is unchanged since the correction", () => {
    const afterValues = { status: "Present", PunchIn: before.punchIn!.toISOString(), PunchOut: before.punchOut!.toISOString() };
    assert.equal(canRevert({ ...before, status: "Present" }, afterValues).ok, true);
    assert.equal(canRevert({ ...before, status: "Leave" }, afterValues).ok, false);
  });
  await test("who may correct: super admin always; HR view-only by default; matrix overrides; employees never", () => {
    assert.equal(canEditAttendance("Super Admin", {}), true);
    assert.equal(canEditAttendance("admin", undefined), true);
    assert.equal(canEditAttendance("hr", undefined), false);
    assert.equal(canEditAttendance("hr", { hr: { attendance: "edit" } }), true);
    assert.equal(canEditAttendance("admin", { admin: { attendance: "view" } }), false);
    assert.equal(canEditAttendance("employee", { employee: { attendance: "edit" } }), false);
    assert.equal(canEditAttendance(undefined, undefined), false);
  });

  // ---------------- backup ----------------------------------------------
  const live = [
    { id: "b", data: { userId: "u", date: "2026-07-02", PunchIn: new Date("2026-07-02T03:30:00Z"), status: "Present", nested: { z: 1, a: [new Date("2026-07-02T00:00:00Z")] } } },
    { id: "a", data: { userId: "u", date: "2026-07-01", PunchIn: null, status: "Absent" } },
  ];
  const range = { from: REPORT_START, to: REPORT_END };
  const file = await createBackupFile({ records: live, range, createdBy: "admin@x.com", projectId: "test", backupId: "bk1", now: new Date("2026-10-09T06:00:00Z") });

  await test("backup stores timestamps losslessly and round-trips", () => {
    assert.deepEqual((file.records[1].data.PunchIn as { __ts: string }).__ts, "2026-07-02T03:30:00.000Z");
    const back = deserializeValue(file.records[1].data) as { PunchIn: Date };
    assert.ok(back.PunchIn instanceof Date);
    assert.equal(back.PunchIn.toISOString(), "2026-07-02T03:30:00.000Z");
    assert.equal(file.meta.count, 2);
  });
  await test("canonical JSON ignores key order", () => assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 })));
  await test("a good backup file verifies", async () => assert.deepEqual((await verifyBackupFile(JSON.parse(JSON.stringify(file)))).ok, true));
  await test("tampering is detected (checksum)", async () => {
    const bad = JSON.parse(JSON.stringify(file));
    bad.records[0].data.status = "Present";
    const r = await verifyBackupFile(bad);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => /checksum/i.test(p)));
  });
  await test("a truncated file is detected (count)", async () => {
    const bad = JSON.parse(JSON.stringify(file));
    bad.records.pop();
    assert.equal((await verifyBackupFile(bad)).ok, false);
  });
  await test("garbage is rejected", async () => assert.equal((await verifyBackupFile({ hello: 1 })).ok, false));
  await test("comparison with live data: identical / changed / missing / new", () => {
    const liveNow = [
      { id: "a", data: { userId: "u", date: "2026-07-01", PunchIn: null, status: "Absent" } },
      { id: "b", data: { ...live[0].data, status: "Absent" } },
      { id: "c", data: { userId: "u", date: "2026-07-03", status: "Present" } },
    ];
    const cmp = compareWithLive(file, liveNow);
    assert.equal(cmp.identical, 1);
    assert.deepEqual(cmp.changedSinceBackup, ["b"]);
    assert.deepEqual(cmp.newSinceBackup, ["c"]);
    assert.deepEqual(compareWithLive(file, [liveNow[0]]).missingNow, ["b"]);
  });
  await test("bulk-change gate: needs a covering, verified, fresh backup", () => {
    const now = new Date("2026-10-09T10:00:00Z");
    const meta = { backupId: "bk1", createdAt: "2026-10-09T06:00:00Z", range, count: 2, sha256: "x" };
    assert.equal(bulkChangeGate([], range, now).allowed, false);
    assert.equal(bulkChangeGate([meta], range, now).allowed, false); // unverified
    assert.equal(bulkChangeGate([{ ...meta, verifiedAt: "2026-10-09T07:00:00Z" }], range, now).allowed, true);
    assert.equal(bulkChangeGate([{ ...meta, verifiedAt: "x", range: { from: "2026-08-01", to: "2026-09-30" } }], range, now).allowed, false); // too narrow
    assert.equal(bulkChangeGate([{ ...meta, verifiedAt: "x" }], range, new Date("2026-10-12T10:00:00Z")).allowed, false); // stale
  });
  await test("serializeValue drops undefined and keeps nulls", () => {
    assert.deepEqual(serializeValue({ a: undefined, b: null, c: 1 }), { b: null, c: 1 });
  });

  // ---------------- demo generator ---------------------------------------
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
  const holidays = new Set(["2026-08-15", "2026-09-05"]);
  const employees = makeDemoEmployees(8, ["day", "day", "night", null]);
  const gen = () => generateDemoAttendance({ employees, rules, holidays, from: REPORT_START, to: REPORT_END, seed: 42, batchId: "demo-batch-1", now: new Date("2026-10-09T00:00:00Z") });
  const demo = gen();

  await test("demo data is deterministic for a seed", () => assert.equal(canonicalJson(serializeValue(gen().attendance)), canonicalJson(serializeValue(demo.attendance))));
  await test("every demo document is clearly flagged and namespaced", () => {
    assert.ok(demo.attendance.length > 400);
    for (const r of demo.attendance) {
      assert.ok(r.id.startsWith(DEMO_ID_PREFIX));
      assert.equal(r.data.isDemo, true);
      assert.equal(r.data.verified, false);
      assert.equal(r.data.attendanceSource, "DEMO-GENERATED");
    }
    for (const l of demo.leaves) assert.equal(l.data.isDemo, true);
  });
  await test("every demo employee is below 100% and in a plausible band", () => {
    assert.equal(demo.perEmployee.length, 8);
    for (const e of demo.perEmployee) {
      assert.ok(e.percentage < 100, `${e.uid} at ${e.percentage}`);
      assert.ok(e.absentDays >= 2, `${e.uid} has ${e.absentDays} absences`);
      assert.ok(e.percentage >= 60 && e.percentage <= 97, `${e.uid} at ${e.percentage}`);
    }
    const distinct = new Set(demo.perEmployee.map((e) => e.percentage));
    assert.ok(distinct.size >= 5, "attendance patterns should vary between employees");
  });
  await test("no demo record on weekly offs, holidays or approved-leave days", () => {
    const leaveByUser = new Map<string, Set<string>>();
    for (const l of demo.leaves) {
      const set = leaveByUser.get(String(l.data.uid)) || new Set<string>();
      expandLeaveDates([l.data as { fromDate: string; toDate: string; status: string }]).forEach((d) => set.add(d));
      leaveByUser.set(String(l.data.uid), set);
    }
    for (const r of demo.attendance) {
      const d = String(r.data.date);
      assert.ok(!holidays.has(d), `holiday ${d}`);
      assert.ok(!(leaveByUser.get(String(r.data.userId))?.has(d)), `leave ${d}`);
      assert.notEqual(new Date(`${d}T00:00:00Z`).getUTCDay(), 0, `Sunday ${d}`);
    }
  });
  await test("report over demo data matches the generator, has no 'No record' gaps, and audit finds no calendar errors", () => {
    const now = new Date("2026-10-09T06:00:00Z");
    const records = demo.attendance.map((r) => normalizeRecord({ id: r.id, ...r.data }));
    const leaveDatesByUser = new Map<string, Set<string>>();
    for (const l of demo.leaves) {
      leaveDatesByUser.set(String(l.data.uid), expandLeaveDates([...(demo.leaves.filter((x) => x.data.uid === l.data.uid).map((x) => x.data as { fromDate: string; toDate: string; status: string }))]));
    }
    for (const e of employees) {
      const rep = buildEmployeeReport({ employee: { uid: e.uid, name: e.name, shiftId: e.shiftId }, records, holidays, leaveDates: leaveDatesByUser.get(e.uid) || new Set(), rules, from: REPORT_START, to: REPORT_END, now });
      const g = demo.perEmployee.find((x) => x.uid === e.uid)!;
      assert.equal(rep.summary.counts["no-record"], 0, `${e.uid} no-record`);
      assert.equal(rep.summary.counts.absent, g.absentDays);
      assert.ok(rep.summary.percentage! < 100);
    }
    const audit = runAudit({
      employees: employees.map((e) => ({ uid: e.uid, name: e.name, shiftId: e.shiftId })),
      records, holidays, leaveDatesByUser, rules, from: REPORT_START, to: REPORT_END, now,
    });
    for (const bad of ["absent-on-weekly-off", "absent-on-holiday", "absent-on-leave", "missing-record", "date-mismatch", "duplicate-records"]) {
      assert.equal(audit.byType[bad] || 0, 0, `${bad} found in clean demo data`);
    }
  });
  await test("the generator refuses to target production", () => {
    assert.match(assertSafeDemoTarget("omtatva-portal", true)!, /PRODUCTION/);
    assert.match(assertSafeDemoTarget(undefined, true)!, /DEMO_FIREBASE_PROJECT_ID/);
    assert.match(assertSafeDemoTarget("my-test-proj", false)!, /understand/);
    assert.equal(assertSafeDemoTarget("my-test-proj", true), null);
  });

  console.log(`\n${passed} passed (corrections, backup, demo)${process.exitCode ? " - with FAILURES" : ""}`);
})();
