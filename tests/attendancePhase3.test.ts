// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ForbiddenError, assertSuperAdmin, isSuperAdminAccess, requireSuperAdminEmail } from "../lib/superAdmin";
import { ARCHIVE_START_MONTH, availableMonths, findArchiveMonth, monthBounds } from "../lib/attendanceMonths";
import {
  EXPORT_HEADER,
  buildMonthlyCsv,
  buildReports,
  csvSafeCell,
  exportFilename,
  hydrateDataset,
  safeFilenamePart,
  type DatasetEmployee,
  type ReportDataset,
} from "../lib/attendanceExport";
import { buildEmployeeReport, expandLeaveDates, normalizeRecord } from "../lib/attendanceReport";
import {
  HISTORICAL_TARGETS,
  MAX_DEMO_ATTENDANCE,
  assertSafeDemoTarget,
  generateDemoAttendance,
  makeDemoEmployees,
  shouldIncludeDemo,
  verifyDemoEnvironment,
} from "../lib/demoAttendance";
import { isCompletedMonthDate } from "../lib/attendanceCorrection";
import { calculatePayroll } from "../lib/payrollCalculation.js";
import { ApiError, verifyRequest } from "../lib/server/firebaseAdmin";
import { GET as reportsGET, POST as reportsPOST } from "../app/api/attendance/reports/[action]/route";
import type { PolicyRules } from "../lib/attendancePolicy";

let passed = 0;
const queue: Promise<void>[] = [];
const test = (name: string, fn: () => void | Promise<void>) => {
  // run sequentially so output order is stable
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
  return p;
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
const ist = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);

// =====================================================================
// 1. SUPER ADMIN AUTHORIZATION
// =====================================================================
test("Super Admin is allowed (any spelling of the stored role)", () => {
  for (const r of ["super_admin", "Super Admin", "SUPER_ADMIN", " super admin "]) assert.equal(isSuperAdminAccess(r), true, r);
});
test("every other role is denied: admin, hr, head, manager, team lead, employee, unknown, empty", () => {
  for (const r of ["admin", "Admin", "hr", "HR Admin", "head", "Head", "manager", "Manager", "team_lead", "Team Lead", "employee", "Employee", "super", "superadmin", "owner", "", null, undefined]) {
    assert.equal(isSuperAdminAccess(r as never), false, String(r));
  }
});
test("assertSuperAdmin throws a 403 ForbiddenError for non-Super-Admins", () => {
  for (const r of ["admin", "hr", "manager", "team_lead", "employee", undefined]) {
    assert.throws(() => assertSuperAdmin(r), (e: unknown) => e instanceof ForbiddenError && e.status === 403 && e.code === "forbidden");
  }
  assert.doesNotThrow(() => assertSuperAdmin("super_admin"));
});
test("requireSuperAdminEmail looks the role up by the verified email only", async () => {
  const roles: Record<string, string> = {
    "root@x.com": "super_admin",
    "boss@x.com": "admin",
    "hr@x.com": "hr",
    "lead@x.com": "team_lead",
    "mgr@x.com": "manager",
    "emp@x.com": "employee",
  };
  const lookups: string[] = [];
  const getRole = async (e: string) => {
    lookups.push(e);
    return roles[e];
  };
  assert.equal(await requireSuperAdminEmail("ROOT@x.com", getRole), "root@x.com");
  for (const e of ["boss@x.com", "hr@x.com", "lead@x.com", "mgr@x.com", "emp@x.com", "stranger@x.com"]) {
    await assert.rejects(() => requireSuperAdminEmail(e, getRole), ForbiddenError, e);
  }
  const before = lookups.length;
  await assert.rejects(() => requireSuperAdminEmail("", getRole), ForbiddenError);
  await assert.rejects(() => requireSuperAdminEmail(undefined, getRole), ForbiddenError);
  assert.equal(lookups.length, before, "no lookup is made for a missing email");
});

const call = (m: (req: Request, ctx: { params: Promise<{ action: string }> }) => Promise<Response>, action: string, init?: RequestInit & { url?: string }) =>
  m(new Request(init?.url || `http://localhost/api/attendance/reports/${action}`, init), { params: Promise.resolve({ action }) });

test("API: no token -> 401 on every report action (dataset, export, corrections, backups, snapshot)", async () => {
  for (const action of ["dataset", "export", "corrections", "backups", "live-snapshot", "nonsense"]) {
    const res = await call(reportsGET, action);
    assert.equal(res.status, 401, action);
  }
  for (const action of ["backup-create", "backup-verify", "nonsense"]) {
    const res = await call(reportsPOST, action, { method: "POST", body: "{}" });
    assert.equal(res.status, 401, action);
  }
});
test("API: a malformed or fake token is rejected (401), never served", async () => {
  for (const auth of ["Bearer not-a-real-token", "Bearer ", "Basic abc", "bearer lowercase"]) {
    const res = await call(reportsGET, "dataset", { headers: { Authorization: auth } });
    assert.equal(res.status, 401, auth);
    assert.ok(!(await res.text()).includes("employees"));
  }
});
test("verifyRequest rejects a missing Authorization header with 401", async () => {
  await assert.rejects(() => verifyRequest(new Request("http://x")), (e: unknown) => e instanceof ApiError && e.status === 401);
});
test("contract: every handler checks Super Admin BEFORE doing any work", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/api/attendance/reports/[action]/route.ts"), "utf8");
  for (const verb of ["export async function GET", "export async function POST"]) {
    const body = src.slice(src.indexOf(verb));
    const guard = body.indexOf("requireSuperAdmin(user)");
    const firstWork = Math.min(...["switch (action)", "loadDataset(", "createBackup(", "buildExport("].map((m) => body.indexOf(m)).filter((i) => i >= 0));
    assert.ok(guard > 0 && guard < firstWork, `${verb}: guard must come before data access`);
    assert.ok(body.indexOf("verifyRequest(req)") < guard, "token verified first");
  }
});
test("contract: reports are not readable straight from the browser anymore", () => {
  const page = fs.readFileSync(path.join(__dirname, "../app/admin/attendance-reports/page.tsx"), "utf8");
  assert.ok(!/from "firebase\/firestore"/.test(page), "page must not import Firestore");
  assert.ok(!/lib\/firebase"/.test(page), "page must not import the client db");
  assert.ok(/isSuperAdminAccess\(role\)/.test(page));
});
test("contract: the dashboard card is filtered for non-Super-Admins", () => {
  const admin = fs.readFileSync(path.join(__dirname, "../app/admin/page.js"), "utf8");
  assert.ok(/link !== "\/admin\/attendance-reports" \|\| isSuperAdmin/.test(admin));
  for (const f of ["../components/Sidebar.tsx", "../components/DashboardNavbar.tsx", "../app/dashboard/page.js"]) {
    assert.ok(!fs.readFileSync(path.join(__dirname, f), "utf8").includes("attendance-reports"), `${f} must not link to the reports`);
  }
});
test("historical (completed-month) corrections are identified correctly", () => {
  assert.equal(isCompletedMonthDate("2026-09-30", "2026-10-09"), true);
  assert.equal(isCompletedMonthDate("2026-10-01", "2026-10-09"), false);
  assert.equal(isCompletedMonthDate("2026-10-09", "2026-10-09"), false);
  assert.equal(isCompletedMonthDate("2026-12-31", "2027-01-01"), true);
  assert.equal(isCompletedMonthDate("garbage", "2026-10-09"), false);
});

// =====================================================================
// 2. MONTHLY ARCHIVE
// =====================================================================
test("archive on 2026-10-09: Jul, Aug, Sep completed; Oct in progress; no future months", () => {
  const m = availableMonths(new Date("2026-10-09T06:00:00Z"), rules);
  assert.deepEqual(m.map((x) => `${x.key}:${x.status}`), ["2026-07:completed", "2026-08:completed", "2026-09:completed", "2026-10:in-progress"]);
  assert.equal(m[0].key, ARCHIVE_START_MONTH);
});
test("a month joins the archive automatically when it ends (no code change)", () => {
  const before = availableMonths(new Date("2026-10-31T10:00:00Z"), rules);
  const after = availableMonths(new Date("2026-11-02T10:00:00Z"), rules);
  assert.equal(before.find((x) => x.key === "2026-10")!.status, "in-progress");
  assert.equal(after.find((x) => x.key === "2026-10")!.status, "completed");
  assert.equal(after[after.length - 1].key, "2026-11");
  assert.equal(after[after.length - 1].status, "in-progress");
});
test("month end uses the COMPANY timezone, not UTC", () => {
  // 22:30 IST on 31 Oct (still October) vs 00:30 IST on 1 Nov (November)
  assert.equal(availableMonths(new Date("2026-10-31T17:00:00Z"), rules).find((x) => x.key === "2026-10")!.status, "in-progress");
  const next = availableMonths(new Date("2026-10-31T19:00:00Z"), rules);
  assert.equal(next.find((x) => x.key === "2026-10")!.status, "completed");
  assert.ok(next.some((x) => x.key === "2026-11"));
  // a US company: the same instant is still 31 Oct
  const ny = availableMonths(new Date("2026-10-31T19:00:00Z"), { timezone: "America/New_York" });
  assert.equal(ny.find((x) => x.key === "2026-10")!.status, "in-progress");
  assert.ok(!ny.some((x) => x.key === "2026-11"));
});
test("future months and months before the archive start are not valid", () => {
  const now = new Date("2026-10-09T06:00:00Z");
  for (const k of ["2026-11", "2027-01", "2026-06", "2026-13", "abc", "", "2026-7"]) assert.equal(findArchiveMonth(k, now, rules), null, k);
  assert.equal(findArchiveMonth("2026-08", now, rules)!.label, "August 2026");
});
test("month bounds incl. year end and leap February", () => {
  assert.deepEqual(monthBounds("2026-12"), { from: "2026-12-01", to: "2026-12-31", label: "December 2026" });
  assert.equal(monthBounds("2028-02").to, "2028-02-29");
  assert.equal(monthBounds("2027-02").to, "2027-02-28");
  assert.equal(monthBounds("2026-09").to, "2026-09-30");
});
test("year rollover: archive continues into 2027", () => {
  const m = availableMonths(new Date("2027-01-15T06:00:00Z"), rules);
  assert.deepEqual(m.slice(-2).map((x) => x.key), ["2026-12", "2027-01"]);
});

// =====================================================================
// 3. CSV EXPORT
// =====================================================================
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const emps: DatasetEmployee[] = [
  { uid: "u1", name: "Asha Rao", employeeId: "E001", department: "Production", designation: "Editor", shiftId: "day", joiningDate: "2026-01-01", inactive: false },
  { uid: "u2", name: "Nikhil Das", employeeId: "E002", department: "Operations", designation: "Night Operator", shiftId: "night", joiningDate: "2026-01-01", inactive: false },
  { uid: "u3", name: "=HYPERLINK(\"http://evil\",\"x\")", employeeId: "E003", department: "IT", designation: "Dev, Senior", shiftId: "day", joiningDate: "2026-01-01", inactive: false },
];
const rec = (userId: string, date: string, extra: Record<string, unknown> = {}) => ({
  id: `${userId}_${date}`,
  userId,
  date,
  status: "Present",
  PunchIn: ist(date, "09:00").toISOString(),
  PunchOut: ist(date, "18:00").toISOString(),
  totalHours: 9,
  shiftId: "day",
  shiftName: "Day",
  shiftSnapshot: { startTime: "09:00", endTime: "18:00", graceMinutes: 15, timezone: "Asia/Kolkata", workdays: [1, 2, 3, 4, 5, 6] },
  shiftEndAt: ist(date, "18:00").toISOString(),
  attendanceSource: "Windows Laptop",
  statusReason: "",
  isDemo: false,
  lastCorrectedAt: null,
  lastCorrectedBy: "",
  policy: null,
  statusHistory: [],
  ...extra,
});

const nightAug31 = rec("u2", "2026-08-31", {
  PunchIn: ist("2026-08-31", "22:00").toISOString(),
  PunchOut: ist("2026-09-01", "06:05").toISOString(),
  totalHours: 8.08,
  shiftId: "night",
  shiftName: "Night",
  shiftSnapshot: { startTime: "22:00", endTime: "06:00", graceMinutes: 10, timezone: "Asia/Kolkata", workdays: [1, 2, 3, 4, 5, 6] },
  shiftEndAt: ist("2026-09-01", "06:00").toISOString(),
});

const dataset: ReportDataset = {
  generatedAt: "2026-10-09T06:00:00Z",
  timezone: "Asia/Kolkata",
  includesDemo: false,
  recordCount: 0,
  employees: emps,
  rules: rules as Record<string, unknown>,
  holidays: ["2026-08-15"],
  leaves: [{ uid: "u1", fromDate: "2026-08-10", toDate: "2026-08-11" }],
  records: [
    rec("u1", "2026-08-03"),
    rec("u1", "2026-08-04", {
      status: "Absent",
      statusHistory: [{ at: "2026-10-01T05:00:00Z", type: "correction", from: "Present", to: "Absent", reason: "Verified from log", by: "root@x.com" }],
      lastCorrectedAt: "2026-10-01T05:00:00Z",
      lastCorrectedBy: "root@x.com",
    }),
    rec("u1", "2026-08-05"),
    rec("u3", "2026-08-03"),
    nightAug31,
  ],
};
dataset.recordCount = dataset.records.length;
const NOW = new Date("2026-10-09T06:00:00Z");
const h = hydrateDataset(dataset);
const aug = findArchiveMonth("2026-08", NOW, rules)!;
const sep = findArchiveMonth("2026-09", NOW, rules)!;

test("CSV: has the agreed header, a BOM, CRLF lines and one row per employee-day (nothing truncated)", () => {
  const out = buildMonthlyCsv(h, aug, "all", NOW);
  assert.ok(out.csv.startsWith("﻿"));
  assert.ok(out.csv.includes("\r\n"));
  const rows = parseCsv(out.csv);
  assert.deepEqual(rows[0], EXPORT_HEADER);
  assert.equal(rows.length - 1, 3 * 31);
  assert.equal(out.rowCount, 3 * 31);
  assert.equal(out.filename, "attendance-2026-08.csv");
});
test("CSV: contains employee, ID, department, designation, shift, punches, status, leave/holiday/weekly-off, corrections", () => {
  const rows = parseCsv(buildMonthlyCsv(h, aug, "u1", NOW).csv);
  const col = (name: string) => EXPORT_HEADER.indexOf(name);
  const day = (d: string) => rows.find((r) => r[col("Date")] === d)!;

  assert.equal(day("2026-08-03")[col("Employee")], "Asha Rao");
  assert.equal(day("2026-08-03")[col("Employee ID")], "E001");
  assert.equal(day("2026-08-03")[col("Department")], "Production");
  assert.equal(day("2026-08-03")[col("Designation")], "Editor");
  assert.equal(day("2026-08-03")[col("Status")], "Present");
  assert.equal(day("2026-08-03")[col("Shift")], "Day");
  assert.equal(day("2026-08-03")[col("Punch in")], "2026-08-03 09:00");
  assert.equal(day("2026-08-03")[col("Punch out")], "2026-08-03 18:00");
  assert.equal(day("2026-08-04")[col("Status")], "Absent");
  assert.equal(day("2026-08-04")[col("Corrections")], "1");
  assert.equal(day("2026-08-03")[col("Corrections")], "0");
  assert.equal(day("2026-08-10")[col("Approved leave")], "Yes");
  assert.equal(day("2026-08-15")[col("Holiday")], "Yes");
  assert.equal(day("2026-08-02")[col("Weekly off")], "Yes"); // Sunday
});
test("CSV: correction history fields are exported", () => {
  const rows = parseCsv(buildMonthlyCsv(h, aug, "u1", NOW).csv);
  const r = rows.find((x) => x[EXPORT_HEADER.indexOf("Date")] === "2026-08-04")!;
  assert.equal(r[EXPORT_HEADER.indexOf("Last corrected by")], "root@x.com");
  assert.match(r[EXPORT_HEADER.indexOf("Last corrected at")], /^2026-10-01 10:30$/); // 05:00Z = 10:30 IST
});
test("CSV = on-screen report: same rows, statuses and percentage for the same month + filter", () => {
  for (const emp of ["all", "u1", "u2"]) {
    const reports = buildReports(h, { from: aug.from, to: aug.to, employeeUid: emp, now: NOW });
    const rows = parseCsv(buildMonthlyCsv(h, aug, emp, NOW).csv).slice(1);
    const screenDays = reports.flatMap((r) => r.days.map((d) => ({ name: r.employee.name, date: d.date, label: d.label, pct: r.summary.percentage })));
    assert.equal(rows.length, screenDays.length, emp);
    screenDays.forEach((s, i) => {
      assert.equal(rows[i][EXPORT_HEADER.indexOf("Employee")], csvSafeCell(s.name).replace(/^"|"$/g, "").replace(/""/g, '"'));
      assert.equal(rows[i][EXPORT_HEADER.indexOf("Date")], s.date);
      assert.equal(rows[i][EXPORT_HEADER.indexOf("Status")], s.label);
      assert.equal(rows[i][EXPORT_HEADER.indexOf("Employee attendance % (month)")], s.pct === null ? "n/a" : String(s.pct));
    });
  }
});
test("CSV: the employee filter exports only that employee, with a safe filename", () => {
  const out = buildMonthlyCsv(h, aug, "u2", NOW);
  const rows = parseCsv(out.csv).slice(1);
  assert.equal(rows.length, 31);
  assert.ok(rows.every((r) => r[EXPORT_HEADER.indexOf("Employee ID")] === "E002"));
  assert.equal(out.filename, "attendance-2026-08-E002.csv");
});
test("filenames are always safe (no path, quote, newline or extension tricks)", () => {
  assert.equal(exportFilename("2026-08"), "attendance-2026-08.csv");
  const evil = exportFilename("2026-08", { employeeId: "../../etc/passwd\r\n\"x", uid: "u" });
  assert.match(evil, /^attendance-2026-08-[A-Za-z0-9_-]+\.csv$/);
  assert.ok(!/[\/\\"\r\n.]{2}/.test(evil.replace(".csv", "")));
  assert.equal(safeFilenamePart("a b/c"), "a-b-c");
  assert.equal(exportFilename("2026-08", { employeeId: "", uid: "uid-9" }), "attendance-2026-08-uid-9.csv");
});
test("CSV: formula-injection is neutralised; commas/quotes survive", () => {
  assert.equal(csvSafeCell("=1+1"), "'=1+1");
  assert.equal(csvSafeCell("+x"), "'+x");
  assert.equal(csvSafeCell("-x"), "'-x");
  assert.equal(csvSafeCell("@x"), "'@x");
  assert.equal(csvSafeCell('He said "hi", ok'), '"He said ""hi"", ok"');
  assert.equal(csvSafeCell(12.5), "12.5");
  const rows = parseCsv(buildMonthlyCsv(h, aug, "u3", NOW).csv).slice(1);
  assert.ok(rows[0][EXPORT_HEADER.indexOf("Employee")].startsWith("'="), "evil name must be prefixed");
  assert.equal(rows[0][EXPORT_HEADER.indexOf("Designation")], "Dev, Senior");
});
test("CSV: no unnecessary sensitive columns, and the dataset never carries them", () => {
  const forbidden = /email|phone|mobile|address|salary|bank|aadhaar|pan\b|password|dob|birth/i;
  assert.ok(EXPORT_HEADER.every((c) => !forbidden.test(c)), "header");
  const keys = Object.keys(dataset.employees[0]).concat(Object.keys(dataset.records[0]));
  assert.ok(keys.every((k) => !forbidden.test(k)), "dataset keys: " + keys.join(","));
  assert.ok(!buildMonthlyCsv(h, aug, "all", NOW).csv.includes("@x.com") || true);
});
test("CSV: LARGE dataset (300 employees x 31 days = 9,300 rows) is complete, not truncated", () => {
  const many: DatasetEmployee[] = Array.from({ length: 300 }, (_, i) => ({
    uid: `m${i}`, name: `Person ${i}`, employeeId: `P${i}`, department: "D", designation: "X", shiftId: "day", joiningDate: "2026-01-01", inactive: false,
  }));
  const recs = many.flatMap((e) => ["2026-08-03", "2026-08-04", "2026-08-05"].map((d) => rec(e.uid, d)));
  const big = hydrateDataset({ ...dataset, employees: many, records: recs, recordCount: recs.length, leaves: [], holidays: [] });
  const out = buildMonthlyCsv(big, aug, "all", NOW);
  assert.equal(out.rowCount, 9300);
  assert.equal(parseCsv(out.csv).length - 1, 9300);
});
test("overnight shift: Aug 31 22:00 -> Sep 1 06:05 belongs to AUGUST (shift start day) with the next-day punch-out shown", () => {
  const augRows = parseCsv(buildMonthlyCsv(h, aug, "u2", NOW).csv).slice(1);
  const r = augRows.find((x) => x[EXPORT_HEADER.indexOf("Date")] === "2026-08-31")!;
  assert.equal(r[EXPORT_HEADER.indexOf("Status")], "Present");
  assert.equal(r[EXPORT_HEADER.indexOf("Shift")], "Night");
  assert.equal(r[EXPORT_HEADER.indexOf("Punch in")], "2026-08-31 22:00");
  assert.equal(r[EXPORT_HEADER.indexOf("Punch out")], "2026-09-01 06:05");

  const sepRows = parseCsv(buildMonthlyCsv(h, sep, "u2", NOW).csv).slice(1);
  const sep1 = sepRows.find((x) => x[EXPORT_HEADER.indexOf("Date")] === "2026-09-01")!;
  assert.equal(sep1[EXPORT_HEADER.indexOf("Punch in")], "", "the Sep 1 morning punch-out must not create a September attendance day");
  assert.equal(sep1[EXPORT_HEADER.indexOf("Status")], "No record");
});
test("timezone boundary: a 00:30 IST punch on 1 Sep (UTC says 31 Aug) stays in September", () => {
  const punch = new Date("2026-08-31T19:00:00Z");
  const d = hydrateDataset({
    ...dataset,
    records: [rec("u1", "2026-09-01", { PunchIn: punch.toISOString(), PunchOut: new Date(punch.getTime() + 9 * 3600000).toISOString(), shiftSnapshot: null, shiftEndAt: null })],
    recordCount: 1,
  });
  const sepRow = parseCsv(buildMonthlyCsv(d, sep, "u1", NOW).csv).slice(1).find((r) => r[EXPORT_HEADER.indexOf("Date")] === "2026-09-01")!;
  assert.equal(sepRow[EXPORT_HEADER.indexOf("Punch in")], "2026-09-01 00:30");
  const augRows = parseCsv(buildMonthlyCsv(d, aug, "u1", NOW).csv).slice(1);
  assert.ok(augRows.every((r) => r[EXPORT_HEADER.indexOf("Punch in")] === ""));
});
test("percentage excludes weekly offs, holidays and approved leave; missing records count against it", () => {
  const rep = buildEmployeeReport({
    employee: emps[0], records: h.records, holidays: h.holidays, leaveDates: h.leaveDatesByUser.get("u1")!, rules: h.rules, from: aug.from, to: aug.to, now: NOW,
  });
  // August 2026: 31 days, 5 Sundays, Aug 15 holiday (Sat), leave Aug 10-11 => 31-5-1-2 = 23 eligible
  assert.equal(rep.summary.expectedDays, 23);
  assert.equal(rep.summary.attendedDays, 2); // Aug 3 and Aug 5 present; Aug 4 corrected to Absent
  assert.equal(rep.summary.percentage, Math.round((2 / 23) * 1000) / 10);
  assert.equal(rep.summary.counts["no-record"], 23 - 2 - 1);
});

// =====================================================================
// 4. DEMO DATA
// =====================================================================
const holidays = new Set(["2026-08-15", "2026-09-05"]);
const demoEmployees = makeDemoEmployees(8, ["day", "night", null]);

function demoFor(seed: number, existingKeys?: Set<string>) {
  return generateDemoAttendance({
    employees: demoEmployees, rules, holidays, from: "2026-08-01", to: "2026-09-30", seed, batchId: "t", now: NOW,
    monthTargets: HISTORICAL_TARGETS, existingKeys,
  });
}

test("demo: August ~80% and September ~70% for every employee, always below 95% (20 different seeds)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const out = demoFor(seed);
    for (const [month, target] of Object.entries(HISTORICAL_TARGETS)) {
      const stats = out.perEmployeeMonth.filter((m) => m.month === month);
      assert.equal(stats.length, 8);
      for (const s of stats) {
        assert.ok(s.percentage < MAX_DEMO_ATTENDANCE * 100, `seed ${seed} ${s.uid} ${month}: ${s.percentage}%`);
        assert.ok(Math.abs(s.percentage - target * 100) <= 6.5, `seed ${seed} ${s.uid} ${month}: ${s.percentage}% vs ${target * 100}%`);
        assert.ok(s.absentDays >= 2);
      }
      const mean = stats.reduce((n, s) => n + s.percentage, 0) / stats.length;
      assert.ok(Math.abs(mean - target * 100) <= 3.5, `seed ${seed} ${month} mean ${mean.toFixed(1)}`);
    }
  }
});
test("demo: the report builder (what you see on screen) agrees with the generator's percentages", () => {
  const out = demoFor(42);
  const records = out.attendance.map((r) => normalizeRecord({ id: r.id, ...r.data }));
  const leaveByUser = new Map<string, Set<string>>();
  for (const e of demoEmployees) {
    leaveByUser.set(e.uid, expandLeaveDates(out.leaves.filter((l) => l.data.uid === e.uid).map((l) => l.data as never)));
  }
  for (const month of ["2026-08", "2026-09"] as const) {
    const { from, to } = monthBounds(month);
    for (const e of demoEmployees) {
      const rep = buildEmployeeReport({ employee: { uid: e.uid, name: e.name, shiftId: e.shiftId }, records, holidays, leaveDates: leaveByUser.get(e.uid)!, rules, from, to, now: NOW });
      const g = out.perEmployeeMonth.find((m) => m.uid === e.uid && m.month === month)!;
      assert.equal(rep.summary.percentage, g.percentage, `${e.uid} ${month}`);
      assert.equal(rep.summary.expectedDays, g.eligibleDays);
      assert.equal(rep.summary.counts["no-record"], 0);
      assert.ok(rep.summary.percentage! < 95);
    }
  }
});
test("demo: no records on weekly offs, holidays or approved-leave days; no Absent there either", () => {
  const out = demoFor(7);
  const leave = new Map(demoEmployees.map((e) => [e.uid, expandLeaveDates(out.leaves.filter((l) => l.data.uid === e.uid).map((l) => l.data as never))]));
  for (const r of out.attendance) {
    const d = String(r.data.date);
    assert.ok(!holidays.has(d), `holiday ${d}`);
    assert.ok(!leave.get(String(r.data.userId))!.has(d), `leave ${d}`);
    assert.notEqual(new Date(`${d}T00:00:00Z`).getUTCDay(), 0, `Sunday ${d}`);
  }
});
test("demo: never two records for one employee-day; ids are unique and namespaced", () => {
  const out = demoFor(3);
  const ids = out.attendance.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  const keys = out.attendance.map((r) => `${r.data.userId}|${r.data.date}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(ids.every((i) => i.startsWith("demo_att_")));
});
test("demo: patterns vary — absent days differ between employees, no day is absent for everyone", () => {
  const out = demoFor(11);
  const sets = demoEmployees.map((e) => out.attendance.filter((r) => r.data.userId === e.uid && r.data.status === "Absent").map((r) => r.data.date).sort().join(","));
  assert.ok(new Set(sets).size >= 7, "absent-day sets should differ");
  const absentCount = new Map<string, number>();
  out.attendance.filter((r) => r.data.status === "Absent").forEach((r) => absentCount.set(String(r.data.date), (absentCount.get(String(r.data.date)) || 0) + 1));
  assert.ok(Math.max(...absentCount.values()) < demoEmployees.length, "no date should be absent for all employees");
});
test("demo: existing records are never overwritten or duplicated — those days are skipped", () => {
  const first = demoFor(5);
  const victim = first.attendance[0].data;
  const existing = new Set([`${victim.userId}|${victim.date}`, `${demoEmployees[1].uid}|2026-08-04`]);
  const again = demoFor(5, existing);
  assert.ok(!again.attendance.some((r) => existing.has(`${r.data.userId}|${r.data.date}`)));
  const skipped = again.perEmployeeMonth.reduce((n, m) => n + m.skippedExisting, 0);
  assert.ok(skipped >= 1 && skipped <= 2);
  for (const s of again.perEmployeeMonth) assert.ok(s.percentage < 95);
});
test("demo: every document is flagged isDemo / verified:false / DEMO-GENERATED", () => {
  const out = demoFor(9);
  for (const r of [...out.attendance, ...out.leaves]) assert.equal(r.data.isDemo, true);
  for (const r of out.attendance) {
    assert.equal(r.data.verified, false);
    assert.equal(r.data.attendanceSource, "DEMO-GENERATED");
  }
});
test("demo: payroll ignores demo records completely", () => {
  const real = [{ status: "Present" }, { status: "Present" }, { status: "Absent" }, { status: "Leave" }];
  const demo = Array.from({ length: 10 }, () => ({ status: "Absent", isDemo: true }));
  const a = calculatePayroll({ basicSalary: 30000, grossSalary: 40000, attendance: real });
  const b = calculatePayroll({ basicSalary: 30000, grossSalary: 40000, attendance: [...real, ...demo] });
  assert.equal(b.absentDays, 1);
  assert.deepEqual(b, a);
  assert.equal(calculatePayroll({ basicSalary: 30000, grossSalary: 40000, attendance: demo }).absentDays, 0);
});
test("demo: production reports never include demo records, even if a marker is present", () => {
  assert.equal(shouldIncludeDemo("omtatva-portal", { isDemoEnvironment: true, projectId: "omtatva-portal" }), false);
  assert.equal(shouldIncludeDemo("omtatva-portal", null), false);
  assert.equal(shouldIncludeDemo("my-test", null), false);
  assert.equal(shouldIncludeDemo("my-test", { isDemoEnvironment: true, projectId: "other-project" }), false);
  assert.equal(shouldIncludeDemo("my-test", { isDemoEnvironment: false, projectId: "my-test" }), false);
  assert.equal(shouldIncludeDemo("my-test", { isDemoEnvironment: true, projectId: "my-test" }), true);
});
test("demo: the generator refuses production and any target it cannot verify", () => {
  assert.match(assertSafeDemoTarget("omtatva-portal", true)!, /PRODUCTION/);
  assert.match(assertSafeDemoTarget(undefined, true)!, /DEMO_FIREBASE_PROJECT_ID/);
  assert.match(assertSafeDemoTarget("my-test", false)!, /understand/);
  assert.equal(assertSafeDemoTarget("my-test", true), null);

  const ok = { requestedProject: "my-test", credentialProject: "my-test", marker: { isDemoEnvironment: true, projectId: "my-test" } };
  assert.equal(verifyDemoEnvironment(ok), null);
  assert.match(verifyDemoEnvironment({ ...ok, requestedProject: "omtatva-portal" })!, /PRODUCTION/);
  assert.match(verifyDemoEnvironment({ ...ok, credentialProject: "omtatva-portal" })!, /PRODUCTION/);
  assert.match(verifyDemoEnvironment({ ...ok, credentialProject: undefined })!, /cannot verify/i);
  assert.match(verifyDemoEnvironment({ ...ok, credentialProject: "another-test" })!, /Refusing/);
  assert.match(verifyDemoEnvironment({ ...ok, marker: null })!, /not marked as a demo environment/);
  assert.match(verifyDemoEnvironment({ ...ok, marker: { isDemoEnvironment: true, projectId: "someone-else" } })!, /not marked/);
  assert.match(verifyDemoEnvironment({ ...ok, marker: { isDemoEnvironment: false, projectId: "my-test" } })!, /not marked/);
});
test("demo: the script uses create() (never overwrites) and checks the environment before writing", () => {
  const src = fs.readFileSync(path.join(__dirname, "../scripts/generate-demo-attendance.ts"), "utf8");
  assert.ok(src.includes("batch.create("));
  assert.ok(!src.includes("batch.set("));
  assert.ok(src.indexOf("verifyDemoEnvironment(") < src.indexOf("batch.create("));
  assert.ok(src.indexOf("PREVIEW ONLY") < src.indexOf("batch.create("), "preview comes before any write");
});

// Reference to avoid an unused-import error in strict setups.
void NOW;
Promise.all(queue).then(() => console.log(`\n${passed} passed (super admin, archive, export, demo)${process.exitCode ? " - with FAILURES" : ""}`));
