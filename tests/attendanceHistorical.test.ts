// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildHistoricalPlan, publicPlan, HISTORY_MONTHS, type HistoricalPlan } from "../lib/historicalPlan";
import { classifyEnvironment, MAX_DEMO_ATTENDANCE } from "../lib/demoAttendance";
import { hydrateDataset, type DatasetEmployee, type HydratedDataset, type ReportDataset } from "../lib/attendanceExport";
import { buildEmployeeReport } from "../lib/attendanceReport";
import { monthBounds } from "../lib/attendanceMonths";
import { weekdayOf, type PolicyRules } from "../lib/attendancePolicy";
import { statusCategory, isAttendedStatus } from "../lib/attendanceRules";

let passed = 0;
const queue: Promise<void>[] = [];
const test = (name: string, fn: () => void | Promise<void>) => {
  const prev = queue[queue.length - 1] || Promise.resolve();
  const p = prev.then(async () => {
    try {
      await fn();
      passed++;
      console.log("PASS", name);
    } catch (e) {
      console.error("FAIL", name, "\n  ", (e as Error).message);
      process.exitCode = 1;
    }
  });
  queue.push(p);
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
const HOLIDAYS = ["2026-08-15", "2026-09-05"];
const ist = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`).toISOString();

const employees: DatasetEmployee[] = Array.from({ length: 10 }, (_, i) => ({
  uid: `e${i + 1}`,
  name: `Employee ${String(i + 1).padStart(2, "0")}`,
  employeeId: `E${100 + i}`,
  department: i % 2 ? "Production" : "Marketing",
  designation: "Staff",
  shiftId: i % 3 === 0 ? "night" : i % 3 === 1 ? "day" : null,
  joiningDate: "2026-01-01",
  inactive: false,
}));

const rec = (userId: string, date: string, extra: Record<string, unknown> = {}) => ({
  id: `real_${userId}_${date}`,
  userId,
  date,
  status: "Present",
  PunchIn: ist(date, "09:00"),
  PunchOut: ist(date, "18:00"),
  totalHours: 9,
  shiftId: "day",
  shiftName: "Day",
  shiftSnapshot: { startTime: "09:00", endTime: "18:00", graceMinutes: 15, timezone: "Asia/Kolkata", workdays: [1, 2, 3, 4, 5, 6] },
  shiftEndAt: ist(date, "18:00"),
  attendanceSource: "Windows Laptop",
  statusReason: "",
  isDemo: false,
  statusHistory: [],
  ...extra,
});

function dataset(opts: { records?: Record<string, unknown>[]; leaves?: { uid: string; fromDate: string; toDate: string }[]; emps?: DatasetEmployee[] } = {}): HydratedDataset {
  const records = opts.records || [];
  const ds: ReportDataset = {
    generatedAt: NOW.toISOString(),
    timezone: "Asia/Kolkata",
    includesDemo: false,
    recordCount: records.length,
    employees: opts.emps || employees,
    rules: rules as Record<string, unknown>,
    holidays: HOLIDAYS,
    leaves: opts.leaves || [],
    records,
  };
  return hydrateDataset(ds);
}

const plan = (env: "production" | "demo" | "unverified", ds = dataset()): HistoricalPlan =>
  buildHistoricalPlan({ dataset: ds, environment: env, projectId: env === "production" ? "omtatva-portal" : "my-test", now: NOW });

// =====================================================================
// PRODUCTION: real records only
// =====================================================================
const realRecords = [
  rec("e2", "2026-07-01"), rec("e2", "2026-07-02"), rec("e2", "2026-07-03"),
  rec("e2", "2026-08-03", { status: "Absent", PunchIn: null, PunchOut: null, totalHours: 0, attendanceSource: "Auto-marked (no punch-in)" }),
];
const realDs = dataset({ records: realRecords, leaves: [{ uid: "e2", fromDate: "2026-07-06", toDate: "2026-07-07" }] });

test("production: nothing is generated, ever — the plan has no documents and no proposals", () => {
  const p = plan("production", realDs);
  assert.equal(p.canGenerate, false);
  assert.equal(p.generated, null);
  assert.deepEqual(p.newUsers, []);
  assert.ok(p.rows.every((r) => r.proposed === null));
  assert.ok(p.months.every((m) => m.proposedNewRecords === 0));
  assert.match(p.blockedReason, /PRODUCTION/);
  assert.match(p.blockedReason, /evidence|audited/i);
});
test("production: an unverified project is treated exactly the same (cannot be verified -> read-only)", () => {
  const p = plan("unverified", realDs);
  assert.equal(p.canGenerate, false);
  assert.equal(p.generated, null);
  assert.match(p.blockedReason, /not verified/i);
});
test("production: every employee appears in July, August and September", () => {
  const p = plan("production", realDs);
  assert.equal(p.rows.length, employees.length * 3);
  for (const e of employees) assert.deepEqual(p.rows.filter((r) => r.uid === e.uid).map((r) => r.month), [...HISTORY_MONTHS]);
});
test("production: percentages come only from real records; missing dates are shown separately and never counted as present", () => {
  const p = plan("production", realDs);
  const july = p.rows.find((r) => r.uid === "e2" && r.month === "2026-07")!;
  assert.equal(july.existingRecords, 3);
  assert.equal(july.presentDays, 3);
  assert.equal(july.leaveDays, 2);
  assert.ok(july.missingDates.length > 20, "most of July has no record");
  assert.ok(!july.missingDates.includes("2026-07-01"));
  assert.equal(july.percentage, Math.round((3 / july.eligibleDays) * 1000) / 10);
  assert.ok(july.percentage! < 25);
  // employees with no records at all: 0%, everything missing
  const none = p.rows.find((r) => r.uid === "e5" && r.month === "2026-07")!;
  assert.equal(none.percentage, 0);
  assert.equal(none.existingRecords, 0);
  assert.equal(none.missingDates.length, none.eligibleDays);
});
test("production: an existing Absent record stays Absent (counted as absent, not rewritten)", () => {
  const aug = plan("production", realDs).rows.find((r) => r.uid === "e2" && r.month === "2026-08")!;
  assert.equal(aug.absentDays, 1);
  assert.equal(aug.existingRecords, 1);
});
test("eligible days exclude Sundays, company holidays and approved leave", () => {
  const p = plan("production", realDs);
  // August 2026: 31 days, 5 Sundays, 15 Aug holiday (Sat) => 25 eligible for a Mon-Sat employee
  const aug = p.rows.find((r) => r.uid === "e2" && r.month === "2026-08")!;
  assert.equal(aug.eligibleDays, 25);
  assert.equal(aug.offDays, 6); // 5 Sundays + 1 holiday
  // July: 31 days, 4 Sundays, 2 leave days => 25
  const jul = p.rows.find((r) => r.uid === "e2" && r.month === "2026-07")!;
  assert.equal(jul.eligibleDays, 25);
  assert.equal(jul.offDays, 4);
  assert.equal(jul.leaveDays, 2);
});

// =====================================================================
// DEMO: the preview of what would be created
// =====================================================================
const demoPlan = plan("demo", realDs);

test("demo: every employee has a proposal for every month, and EVERY one is below 100% (below 95%)", () => {
  assert.equal(demoPlan.canGenerate, true);
  assert.equal(demoPlan.rows.length, employees.length * 3);
  for (const r of demoPlan.rows) {
    assert.ok(r.proposed, `${r.uid} ${r.month}`);
    assert.ok(r.proposed!.percentage! < 100, `${r.uid} ${r.month}: ${r.proposed!.percentage}`);
    assert.ok(r.proposed!.percentage! < MAX_DEMO_ATTENDANCE * 100 + 0.01, `${r.uid} ${r.month}: ${r.proposed!.percentage}`);
  }
});
test("demo: August ≈ 80%, September ≈ 70%, July varied and below 100%, with variation between employees", () => {
  const forMonth = (m: string) => demoPlan.rows.filter((r) => r.month === m && r.uid !== "e2").map((r) => r.proposed!.percentage!);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const aug = forMonth("2026-08");
  const sep = forMonth("2026-09");
  const jul = forMonth("2026-07");
  assert.ok(Math.abs(mean(aug) - 80) <= 3.5, `Aug mean ${mean(aug).toFixed(1)}`);
  assert.ok(Math.abs(mean(sep) - 70) <= 3.5, `Sep mean ${mean(sep).toFixed(1)}`);
  aug.forEach((x) => assert.ok(Math.abs(x - 80) <= 6.5, `Aug ${x}`));
  sep.forEach((x) => assert.ok(Math.abs(x - 70) <= 6.5, `Sep ${x}`));
  jul.forEach((x) => assert.ok(x < 95 && x >= 55, `Jul ${x}`));
  assert.ok(new Set(aug).size >= 3 && new Set(sep).size >= 3, "employees must not all get the same percentage");
  assert.ok(mean(aug) > mean(sep), "August is higher than September");
});
test("demo: existing real records are preserved — nothing is generated on days that already have a record", () => {
  const generated = demoPlan.generated!;
  const existing = new Set(realRecords.map((r) => `${r.userId}|${r.date}`));
  for (const g of generated.attendance) assert.ok(!existing.has(`${g.data.userId}|${g.data.date}`), `${g.id} would overwrite an existing record`);
  assert.ok(!generated.attendance.some((g) => realRecords.some((r) => r.id === g.id)));
  const e2jul = demoPlan.rows.find((r) => r.uid === "e2" && r.month === "2026-07")!;
  assert.equal(e2jul.existingRecords, 3, "the 3 real records are still counted as existing");
});
test("demo: no attendance on Sundays, holidays, or approved-leave days (existing leave is respected)", () => {
  const generated = demoPlan.generated!;
  const e2Leave = new Set(["2026-07-06", "2026-07-07"]);
  for (const g of generated.attendance) {
    const d = String(g.data.date);
    assert.ok(!HOLIDAYS.includes(d), `holiday ${d}`);
    assert.notEqual(weekdayOf(d), 0, `Sunday ${d}`);
    if (g.data.userId === "e2") assert.ok(!e2Leave.has(d), `existing leave ${d}`);
  }
});
test("demo: every generated record is flagged isDemo with a clear source", () => {
  const generated = demoPlan.generated!;
  for (const g of generated.attendance) {
    assert.equal(g.data.isDemo, true);
    assert.equal(g.data.verified, false);
    assert.equal(g.data.attendanceSource, "DEMO-GENERATED");
    assert.ok(g.id.startsWith("demo_"));
  }
  for (const l of generated.leaves) assert.equal(l.data.isDemo, true);
});
test("demo: IDEMPOTENT — applying the plan and re-planning creates nothing and changes nothing", () => {
  const first = plan("demo", realDs);
  const records = [
    ...(realRecords as Record<string, unknown>[]),
    ...first.generated!.attendance.map((g) => ({
      id: g.id,
      ...g.data,
      PunchIn: g.data.PunchIn instanceof Date ? g.data.PunchIn.toISOString() : g.data.PunchIn,
      PunchOut: g.data.PunchOut instanceof Date ? g.data.PunchOut.toISOString() : g.data.PunchOut,
      shiftEndAt: g.data.shiftEndAt instanceof Date ? g.data.shiftEndAt.toISOString() : g.data.shiftEndAt,
      createdAt: undefined,
    })),
  ];
  const leaves = [
    { uid: "e2", fromDate: "2026-07-06", toDate: "2026-07-07" },
    ...first.generated!.leaves.map((l) => ({ uid: String(l.data.uid), fromDate: String(l.data.fromDate), toDate: String(l.data.toDate) })),
  ];
  const second = plan("demo", dataset({ records, leaves }));
  assert.equal(second.generated!.attendance.length, 0, "no duplicates on a re-run");
  assert.equal(second.generated!.leaves.length, 0);
  assert.ok(second.rows.every((r) => r.proposed!.newRecords === 0));
  // and the percentages now shown are exactly what the first preview promised
  for (const r of second.rows) {
    const promised = first.rows.find((x) => x.uid === r.uid && x.month === r.month)!;
    assert.equal(r.percentage, promised.proposed!.percentage, `${r.uid} ${r.month}`);
    assert.ok(r.percentage! < 100);
  }
});
test("demo: a brand-new test project with no employees gets 8 flagged demo employees, all below 100%", () => {
  const p = plan("demo", dataset({ emps: [] }));
  assert.equal(p.newUsers.length, 8);
  assert.ok(p.newUsers.every((u) => u.uid.startsWith("demo_user_")));
  assert.equal(p.rows.length, 8 * 3);
  assert.ok(p.rows.every((r) => r.proposed!.percentage! < 100));
});
test("demo: the dashboard's numbers equal the report builder's (same eligible-day rule)", () => {
  const ds = realDs;
  for (const r of demoPlan.rows.slice(0, 12)) {
    const e = ds.employees.find((x) => x.uid === r.uid)!;
    const b = monthBounds(r.month);
    const rep = buildEmployeeReport({ employee: e, records: ds.records, holidays: ds.holidays, leaveDates: ds.leaveDatesByUser.get(r.uid) || new Set(), rules: ds.rules, from: b.from, to: b.to, now: NOW });
    assert.equal(r.eligibleDays, rep.summary.expectedDays);
    assert.equal(r.percentage, rep.summary.percentage);
  }
});
test("preview sent to the browser carries no documents to be written", () => {
  const pub = publicPlan(demoPlan);
  assert.ok(!("generated" in pub) && !("newUsers" in pub));
  assert.equal(JSON.stringify(pub).includes("DEMO-GENERATED"), false);
  assert.ok(pub.willCreateLeaves >= 0);
});
test("environment classification: production / demo / unverified", () => {
  assert.equal(classifyEnvironment("omtatva-portal", { isDemoEnvironment: true, projectId: "omtatva-portal" }), "production");
  assert.equal(classifyEnvironment("my-test", { isDemoEnvironment: true, projectId: "my-test" }), "demo");
  assert.equal(classifyEnvironment("my-test", null), "unverified");
  assert.equal(classifyEnvironment("my-test", { isDemoEnvironment: true, projectId: "other" }), "unverified");
});

// =====================================================================
// SERVER / UI CONTRACTS
// =====================================================================
const server = fs.readFileSync(path.join(__dirname, "../lib/server/historicalServer.ts"), "utf8");
const route = fs.readFileSync(path.join(__dirname, "../app/api/attendance/reports/[action]/route.ts"), "utf8");
const adminPage = fs.readFileSync(path.join(__dirname, "../app/admin/attendance/page.js"), "utf8").split("// \"use client\";")[0];

test("server: refuses anything but a verified demo project BEFORE any write, then confirmation, then backup", () => {
  const firstWrite = server.search(/\.create\(\s*db\.collection/);
  const env = server.indexOf('environment !== "demo"');
  const confirm = server.indexOf("INITIALIZE ${projectId}");
  const backup = server.indexOf("const gate = bulkChangeGate(");
  assert.ok(env > 0 && env < confirm && confirm < backup && backup < firstWrite, "order: environment, confirmation, backup, then writes");
  assert.ok(server.includes("blockedReasonFor(environment)"));
});
test("server: only create() is used for attendance — never set/update/delete — and an existing document is skipped", () => {
  const attendanceWrites = server.split("\n").filter((l) => /attendance|leaveRequests|users/.test(l) && /\.(set|update|delete)\(/.test(l));
  assert.deepEqual(attendanceWrites, []);
  assert.ok(!/batch\.set\(|\.set\(/.test(server.replace(/\/\/.*$/gm, "")));
  assert.ok(server.includes("ALREADY_EXISTS") && server.includes("return false"));
  assert.ok(server.includes("corrected: 0"), "this operation never corrects/overwrites records");
});
test("server: the plan is recomputed on the server and every run is audited", () => {
  assert.ok(server.includes("freshPlan(now)"));
  assert.ok(server.includes("attendanceInitializations") && server.includes("activityLogs"));
});
test("route: preview and initialize sit behind the Super Admin check; preview is read-only", () => {
  assert.ok(route.indexOf("requireSuperAdmin(user)") < route.indexOf('case "historical-preview"'));
  assert.ok(route.indexOf("requireSuperAdmin(user)", route.indexOf("export async function POST")) < route.indexOf('case "historical-initialize"'));
});
test("ui: the Historical Attendance panel is gone from the main Attendance page (corrections happen in Reports → Audit)", () => {
  assert.ok(!adminPage.includes("HistoricalAttendancePanel"));
  assert.ok(!fs.existsSync(path.join(__dirname, "../components/HistoricalAttendancePanel.tsx")));
});
test("statusCategory: Leave / Holiday / Weekly Off are their own kinds of day, never Present", () => {
  assert.equal(statusCategory("Leave"), "leave");
  assert.equal(statusCategory("Half Day Leave"), "leave");
  assert.equal(statusCategory("Holiday"), "holiday");
  assert.equal(statusCategory("Weekly Off"), "weekly-off");
  assert.equal(statusCategory("weekly-off"), "weekly-off");
  assert.equal(statusCategory("Absent"), "absent");
  assert.equal(statusCategory("Incomplete"), "incomplete");
  assert.equal(statusCategory("Late"), "late");
  assert.equal(statusCategory("Present"), "present");
  assert.equal(statusCategory(undefined), "present");
  for (const s of ["Present", "Late", "Incomplete"]) assert.equal(isAttendedStatus(s), true, s);
  for (const s of ["Absent", "Leave", "Holiday", "Weekly Off"]) assert.equal(isAttendedStatus(s), false, s);
});
test("ui: admin Attendance, employee Attendance, calendar and dashboard all use the shared classification", () => {
  const rd = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");
  for (const f of ["../app/admin/attendance/page.js", "../app/attendance/page.js", "../app/attendance/AttendanceCalendar.js"]) {
    assert.ok(rd(f).includes("statusCategory"), f);
  }
  assert.ok(rd("../app/dashboard/page.js").includes("isAttendedStatus(a.status)"));
  assert.ok(rd("../app/admin/attendance/page.js").includes('<option value="Leave">Leave</option>'));
});
test("rules: attendanceInitializations is server-only", () => {
  const rules = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");
  assert.ok(/match \/attendanceInitializations\/\{id\}\s*\{ allow read, write: if false; \}/.test(rules));
});

Promise.all(queue).then(() => console.log(`\n${passed} passed (historical initialization)${process.exitCode ? " - with FAILURES" : ""}`));
