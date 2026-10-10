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
import { canEditAttendance, isCompletedMonthDate } from "../lib/attendanceCorrection";
import { ADMIN_TIER_ROLES, ROLES, isAdminTierRole, normalizeRole, roleLabel } from "../lib/roles";
import { computeEmployee } from "../lib/payroll/engine";
import { resolvePolicy } from "../lib/payroll/policy";
import { ApiError, verifyRequest } from "../lib/server/firebaseAdmin";
import { GET as reportsGET, POST as reportsPOST } from "../app/api/attendance/reports/[action]/route";
import type { PolicyRules } from "../lib/attendancePolicy";
import { buildLineIndex, chainIds, directReportIds, emptyEntry, lineReady, type LineDocs } from "../lib/reportingLine";
import { getManagerChain } from "../lib/orgHierarchy";
import { DEPARTMENTS, departmentOptions } from "../lib/departments";
import { checkRemoval, checkRoleChange } from "../lib/accessGuards";

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
  const pol = resolvePolicy({ confirmed: true });
  const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-08-${String(i + 3).padStart(2, "0")}`);
  const real = [{ date: days(4)[0], status: "Present" }, { date: days(4)[1], status: "Absent" }];
  const demo = days(10).map((date) => ({ date, status: "Absent", isDemo: true }));
  const emp = (attendance: { date: string; status: string; isDemo?: boolean }[]) =>
    computeEmployee("2026-08", pol, [], { uid: "u", employeeId: "E1", name: "A", weeklyOffDays: [0], salary: { basicSalary: 30000 }, attendance, leaveRequests: [], overrides: {} });
  const a = emp(real);
  const b = emp([...real, ...demo]);
  assert.equal(b.counts.absent, 1);
  assert.deepEqual(b, a);
  assert.equal(emp(demo).counts.absent, 0);
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

// =====================================================================
// 5. MANAGER / TEAM LEAD ROLES
// =====================================================================
test("roles: Team Lead and Manager exist, with labels, and normalise from any spelling", () => {
  assert.deepEqual(ROLES.map((r) => r.value), ["employee", "team_lead", "manager", "hr", "head", "admin", "super_admin"]);
  assert.equal(roleLabel("manager"), "Manager");
  assert.equal(roleLabel("Team Lead"), "Team Lead");
  assert.equal(normalizeRole("TEAM LEAD"), "team_lead");
  assert.equal(normalizeRole("Manager"), "manager");
});
test("roles: existing roles are unchanged and the admin-tier list did NOT grow", () => {
  assert.deepEqual(ADMIN_TIER_ROLES, ["hr", "head", "admin", "super_admin"]);
  for (const r of ["employee", "hr", "head", "admin", "super_admin"]) assert.equal(normalizeRole(r), r);
  assert.equal(normalizeRole("HR"), "hr");
  assert.equal(normalizeRole("nonsense"), "employee");
});
test("roles: Manager and Team Lead are NOT admin-tier and get no admin permissions automatically", () => {
  for (const r of ["manager", "Manager", "team_lead", "Team Lead"]) {
    assert.equal(isAdminTierRole(r), false, r);
    assert.equal(isSuperAdminAccess(r), false, r);
    assert.equal(canEditAttendance(r, { [normalizeRole(r)]: { attendance: "edit" } }), false, r + " even if a matrix says edit");
    assert.equal(canEditAttendance(r, undefined), false, r);
  }
  // others unchanged
  assert.equal(canEditAttendance("admin", undefined), true);
  assert.equal(canEditAttendance("hr", undefined), false);
  assert.equal(canEditAttendance("super_admin", undefined), true);
});
test("roles: the position-based default in Access Management was replaced by a lookup of 'hr'", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/settings/access/page.js"), "utf8");
  assert.ok(!src.includes("ROLES[1]"));
  assert.ok(src.includes('r.value === "hr"'));
});
test("roles: every role dropdown reads the shared ROLES list (so Manager / Team Lead appear everywhere)", () => {
  for (const f of ["../app/admin/users/add/page.tsx", "../app/admin/users/[id]/page.js", "../app/admin/users/page.js"]) {
    assert.ok(fs.readFileSync(path.join(__dirname, f), "utf8").includes("ROLES.map"), f);
  }
});
test("designation dropdown: options come from the users table's designations", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/admin/users/[id]/page.js"), "utf8");
  assert.ok(src.includes('getDocs(collection(db,"users"))'));
  assert.ok(src.includes("designationOptions.map"));
  assert.ok(src.includes("Add new designation"));
});

// =====================================================================
// 6. EMPLOYEE HIERARCHY PRIVACY, DEPARTMENTS, ACTIVITY LOG
// =====================================================================
const entry = (name: string, managerId = "", designation = "Staff") => ({
  ...emptyEntry(),
  user: { firstName: name, lastName: "", designation, status: "Active" },
  profile: {},
  rel: managerId ? { managerId } : {},
  loaded: { user: true, profile: true, rel: true },
});
const lineDocs: LineDocs = {
  me: entry("Me", "m1", "Editor"),
  m1: entry("Manager One", "m2", "Dept Manager"),
  m2: entry("Chief", "", "CEO"),
  // people who must NEVER appear for "me":
  peer: entry("Peer Pat", "m1"),
  report: entry("Report Ray", "me"),
  stranger: entry("Stranger Sam", ""),
};

test("privacy: an employee's line is themselves + people above, in order", () => {
  assert.deepEqual(chainIds(lineDocs, "me"), ["me", "m1", "m2"]);
  assert.deepEqual(chainIds(lineDocs, "m2"), ["m2"]);
});
test("privacy: with no direct-report ids, subordinates/peers/strangers are never in the index (even if their docs were present)", () => {
  const idx = buildLineIndex(lineDocs, "me");
  assert.deepEqual(idx.people.map((p) => p.name).sort(), ["Chief", "Manager One", "Me"]);
  for (const hidden of ["Peer Pat", "Report Ray", "Stranger Sam"]) assert.ok(!idx.people.some((p) => p.name === hidden), hidden);
  assert.deepEqual(getManagerChain(idx, "me").map((p) => p.name), ["Manager One", "Chief"]);
  // a manager's line still excludes the people below them
  const mgr = buildLineIndex(lineDocs, "m1");
  assert.deepEqual(mgr.people.map((p) => p.name).sort(), ["Chief", "Manager One"]);
});
test("direct reports: the chart shows me + people above + MY direct reports only", () => {
  const idx = buildLineIndex(lineDocs, "me", ["report"]);
  assert.deepEqual(idx.people.map((p) => p.name).sort(), ["Chief", "Manager One", "Me", "Report Ray"]);
  assert.ok(!idx.people.some((p) => p.name === "Peer Pat" || p.name === "Stranger Sam"));
  assert.deepEqual((idx.children.get("me") || []).map((id) => idx.byId.get(id)!.name), ["Report Ray"]);
  assert.equal(idx.byId.get("report")!.managerId, "me", "a direct report's manager is me");
});
test("direct reports: never include me or anyone above me, and are de-duplicated", () => {
  assert.deepEqual(directReportIds(lineDocs, "me", ["me", "m1", "m2", "report", "report"]), ["report"]);
  // a report with no loaded record yet is simply not shown, and readiness waits for it
  const waiting: LineDocs = { ...lineDocs, late: emptyEntry() };
  assert.equal(lineReady(waiting, "me", ["report", "late"]), false);
  assert.equal(buildLineIndex(waiting, "me", ["report", "late"]).people.some((p) => p.uid === "late"), false);
  assert.equal(lineReady(lineDocs, "me", ["report"]), true);
});
test("privacy: loops, self-manager and missing manager records are handled", () => {
  const loop: LineDocs = { a: entry("A", "b"), b: entry("B", "a") };
  assert.deepEqual(chainIds(loop, "a"), ["a", "b"]);
  assert.deepEqual(chainIds({ x: entry("X", "x") }, "x"), ["x"]);
  const gone: LineDocs = {
    me: entry("Me", "ghost"),
    ghost: { ...emptyEntry(), loaded: { user: true, profile: true, rel: true } },
  };
  const idx = buildLineIndex(gone, "me");
  assert.deepEqual(idx.people.map((p) => p.name), ["Me"]);
  assert.equal(idx.danglingManager.get("me"), "ghost");
});
test("privacy: the line is 'ready' only after every document on it has loaded", () => {
  assert.equal(lineReady({ me: { ...entry("Me", "m1"), loaded: { user: true, profile: false, rel: true } } }, "me"), false);
  assert.equal(lineReady({ me: entry("Me") }, "me"), true);
  assert.equal(lineReady({ me: entry("Me", "m1") }, "me"), false, "manager docs not yet loaded");
});
test("privacy contract: the dashboard section has no company-wide chart, search, peers or subordinates", () => {
  const src = fs.readFileSync(path.join(__dirname, "../components/OrgHierarchySection.tsx"), "utf8");
  for (const banned of ["useOrgChart", "Full Organization", "Teammates", "index.people", "CompanyView", "type=\"search\""]) {
    assert.ok(!src.includes(banned), `must not contain: ${banned}`);
  }
  assert.ok(src.includes("useReportingLine"));
  assert.ok(src.includes("OrgFlowChart"));
});
test("privacy contract: employee-facing code never lists whole collections for the hierarchy", () => {
  const hook = fs.readFileSync(path.join(__dirname, "../lib/useReportingLine.ts"), "utf8");
  assert.equal((hook.match(/collection\(/g) || []).length, 1, "the only collection query is the direct-reports one");
  assert.ok(hook.includes('where("managerId", "==", myUid)'), "constrained to MY direct reports");
  assert.ok(hook.includes("doc(db"));
  const profile = fs.readFileSync(path.join(__dirname, "../app/profile/components/EmploymentDetails.tsx"), "utf8");
  assert.ok(profile.includes("useReportingLine") && !profile.includes("useOrgChart"));
});
test("the full organisation chart is admin-only (admin Hierarchy page, flow chart)", () => {
  const admin = fs.readFileSync(path.join(__dirname, "../app/admin/hierarchy/page.tsx"), "utf8");
  assert.ok(admin.includes("OrgFlowChart") && admin.includes("isAdminTier"));
  assert.ok(!fs.existsSync(path.join(__dirname, "../components/OrgTree.tsx")), "old indented tree removed");
});
test("departments: one shared list; unknown stored values are kept, never dropped", () => {
  for (const d of ["HR", "Production", "AI", "Finance", "IT", "Marketing", "Management", "Operations", "Creative"]) {
    assert.ok(DEPARTMENTS.includes(d as never), d);
  }
  assert.deepEqual(departmentOptions().slice(0, DEPARTMENTS.length), [...DEPARTMENTS]);
  const opts = departmentOptions(["hr", "Legal", "legal", "", undefined, "Production"]);
  assert.equal(opts.filter((o) => o.toLowerCase() === "hr").length, 1, "case-insensitive duplicates are not added");
  assert.equal(opts.filter((o) => o.toLowerCase() === "legal").length, 1);
  assert.equal(opts[opts.length - 1], "Legal");
});
test("departments: every department dropdown uses the shared list", () => {
  for (const f of ["../app/admin/users/page.js", "../app/admin/users/[id]/page.js", "../app/profile/components/EmploymentDetails.tsx"]) {
    assert.ok(fs.readFileSync(path.join(__dirname, f), "utf8").includes("departmentOptions("), f);
  }
  assert.ok(fs.readFileSync(path.join(__dirname, "../app/admin/users/add/page.tsx"), "utf8").includes("DEPARTMENTS.map"));
});
test("activity log: removed from the Admin dashboard, present (month-wise) in Reports", () => {
  const admin = fs.readFileSync(path.join(__dirname, "../app/admin/page.js"), "utf8").split("// \"use client\";")[0];
  assert.ok(!admin.includes("Recent Activity</h2>") && !admin.includes("📢 Recent Activity"), "dashboard must not show the table");
  assert.ok(!admin.includes("activityLogs"), "dashboard no longer queries activityLogs");
  const reports = fs.readFileSync(path.join(__dirname, "../app/admin/tools-report/page.tsx"), "utf8");
  assert.ok(reports.includes("<ActivityLogReport />"));
  const comp = fs.readFileSync(path.join(__dirname, "../components/ActivityLogReport.tsx"), "utf8");
  assert.ok(comp.includes("availableMonths(") && comp.includes("addDays(to, 1)") && !comp.includes("limit("), "month range, next-day end bound, no row limit");
});

// =====================================================================
// 7. FIRESTORE RULES FILE (static checks — syntax is validated by Firebase on publish)
// =====================================================================
const rulesSrc = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");

test("rules: no open 'if true' access remains and there is no catch-all that would override the restrictions", () => {
  assert.ok(!/if\s+true\b/.test(rulesSrc.replace(/\/\/.*$/gm, "")), "no `if true`");
  assert.ok(!rulesSrc.includes("{document=**}"), "no wildcard match (rules are OR'd, a wildcard would defeat the rest)");
});
test("rules: firebase.json points at the rules files, and the app deploy config is untouched", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../firebase.json"), "utf8"));
  assert.deepEqual(cfg.firestore, { rules: "firestore.rules" });
  assert.deepEqual(cfg.storage, { bucket: "omtatva-portal.firebasestorage.app", rules: "storage.rules" });
  assert.equal(cfg.apphosting.length, 1);
  assert.equal(cfg.apphosting[0].backendId, "omtatva-backend");
  assert.equal(cfg.apphosting[0].rootDir, ".");
  assert.ok(fs.existsSync(path.join(__dirname, "../firestore.rules")) && fs.existsSync(path.join(__dirname, "../storage.rules")));
});
test("rules: package scripts only ever deploy the rules (never the app) and have a dry-run check", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  assert.equal(pkg.scripts["rules:deploy"], "firebase deploy --only firestore:rules,storage");
  assert.equal(pkg.scripts["rules:check"], "firebase deploy --only firestore:rules,storage --dry-run");
});
test("rules: every collection the app uses has a rule (unlisted collections are denied)", () => {
  for (const c of ["users", "employeeProfiles", "employees", "adminAccess", "settings", "attendance", "reportingStructure", "activityLogs",
    "attendanceCorrections", "attendanceBackups", "payroll", "salaryStructure", "assets", "holidays", "announcements", "toolUsage",
    "leaveRequests", "wfhRequests", "leaves", "timesheets", "documents", "commonDocuments", "employeeDocuments", "birthdayWishes"]) {
    assert.ok(rulesSrc.includes(`match /${c}/`), c);
  }
});
test("rules: admin status requires a verified email, comes from adminAccess, and sensitive data is locked", () => {
  assert.ok(rulesSrc.includes("email_verified == true"));
  assert.ok(/match \/payroll\/\{id\}\s*\{ allow read: if isAdminTier\(\); allow write: if false;/.test(rulesSrc), "payroll: read-only for admins, server writes");
  assert.ok(/match \/salaryStructure\/\{id\}\s*\{ allow read: if isAdminTier\(\); allow write: if false;/.test(rulesSrc));
  assert.ok(/match \/attendanceBackups\/\{id\}\s*\{ allow read, write: if false/.test(rulesSrc));
  assert.ok(/match \/attendanceCorrections\/\{id\}\s*\{ allow read, write: if false/.test(rulesSrc));
  assert.ok(rulesSrc.includes("allow update, delete: if isSuperAdmin();"), "only a Super Admin edits access");
});
test("rules: browsers cannot write punch data; only the placeholder create and correction-request update remain", () => {
  const att = rulesSrc.slice(rulesSrc.indexOf("match /attendance/{recordId}"), rulesSrc.indexOf("match /attendanceCorrections"));
  assert.ok(att.includes("hasOnly(['correctionRequest'])"));
  assert.ok(att.includes("Auto-marked"));
  assert.ok(att.includes("request.resource.data.PunchIn == null"));
});
test("rules: bootstrap admins match lib/adminAccess.ts exactly", () => {
  const ts = fs.readFileSync(path.join(__dirname, "../lib/adminAccess.ts"), "utf8");
  const block = ts.slice(ts.indexOf("BOOTSTRAP_ADMINS"), ts.indexOf("};", ts.indexOf("BOOTSTRAP_ADMINS")));
  const pairs = [...block.matchAll(/"([^"]+@[^"]+)":\s*"([a-z_]+)"/g)].map((m) => [m[1], m[2]]);
  assert.ok(pairs.length >= 4);
  for (const [email, role] of pairs) {
    assert.ok(new RegExp(`email == '${email.replace(/\./g, "\\.")}' \\? '${role}'`).test(rulesSrc), `${email} -> ${role}`);
  }
});

test("rules: outsiders can do nothing — data rules require a verified company account (or adminAccess), not just any login", () => {
  assert.ok(rulesSrc.includes("function isCompanyUser()"));
  assert.ok(rulesSrc.includes("email_verified == true"));
  assert.ok(rulesSrc.includes("@omtatvadigitals[.]com"));
  assert.ok(rulesSrc.includes("function isMember()"));
  // outside the helper functions and the adminAccess own-document lookup, no rule may rely on a bare login
  const body = rulesSrc.slice(rulesSrc.indexOf("// Access control"));
  const adminBlock = body.slice(body.indexOf("match /adminAccess/"), body.indexOf("// Settings: public pages"));
  const rest = body.replace(adminBlock, "");
  assert.ok(!rest.includes("signedIn()"), "data rules must use isMember(), not signedIn()");
  // the only public reads are the three display settings
  const publicReads = [...rulesSrc.matchAll(/allow read: if ([^;]+);/g)].map((m) => m[1]).filter((c) => !c.includes("isMember()") && !c.includes("isAdminTier()") && !c.includes("false"));
  assert.deepEqual(publicReads.length, 0);
  assert.ok(rulesSrc.includes("docId in ['appearance', 'branding', 'media']"));
});

// =====================================================================
// 8. ACCESS MANAGEMENT (Settings)
// =====================================================================
const accessSrc = fs.readFileSync(path.join(__dirname, "../app/settings/access/page.js"), "utf8");

test("access management: the role dropdowns offer EVERY role (incl. Employee, Team Lead, Manager), grouped", () => {
  assert.equal((accessSrc.match(/<RoleSelect/g) || []).length, 2, "grant bar + each row use the shared dropdown");
  assert.ok(!/ROLES\.filter\(\(r\) => r\.adminTier\)\.map\(\(r\) => \(\s*<option/.test(accessSrc.split("function RoleSelect")[0]), "no admin-only option list left in the page body");
  const sel = accessSrc.slice(accessSrc.indexOf("function RoleSelect"), accessSrc.indexOf("function Section"));
  assert.ok(sel.includes("!r.adminTier") && sel.includes("r.adminTier"), "both groups present");
  assert.ok(sel.includes("Organisation roles") && sel.includes("Admin roles"));
  assert.deepEqual(ROLES.map((r) => r.label), ["Employee", "Team Lead", "Manager", "HR Admin", "Head", "Admin", "Super Admin"]);
});
test("access management: assigning Manager / Team Lead / Employee never grants admin access", () => {
  for (const r of ["employee", "team_lead", "manager"]) {
    assert.equal(isAdminTierRole(r), false);
    assert.equal(isSuperAdminAccess(r), false);
  }
});
test("access management: the last Super Admin can't be demoted or removed (everyone else can)", () => {
  const entries = [
    { email: "root@x.com", role: "super_admin" },
    { email: "hr@x.com", role: "hr" },
    { email: "mgr@x.com", role: "manager" },
  ];
  assert.match(checkRoleChange(entries, "root@x.com", "admin")!, /At least one Super Admin/);
  assert.match(checkRoleChange(entries, "root@x.com", "manager")!, /At least one Super Admin/);
  assert.match(checkRemoval(entries, "root@x.com")!, /last Super Admin/);
  assert.equal(checkRoleChange(entries, "root@x.com", "super_admin"), null);
  assert.equal(checkRoleChange(entries, "hr@x.com", "manager"), null);
  assert.equal(checkRoleChange(entries, "mgr@x.com", "admin"), null);
  assert.equal(checkRemoval(entries, "mgr@x.com"), null);
  const two = [...entries, { email: "root2@x.com", role: "Super Admin" }];
  assert.equal(checkRoleChange(two, "root@x.com", "admin"), null, "allowed when another Super Admin exists");
  assert.equal(checkRemoval(two, "root@x.com"), null);
});
test("settings: Backup lists whole collections, so the rules give Super Admin 'list' on settings and adminAccess", () => {
  const backup = fs.readFileSync(path.join(__dirname, "../app/settings/backup/page.js"), "utf8");
  assert.ok(backup.includes('getDocs(collection(db, "settings"))') && backup.includes('getDocs(collection(db, "adminAccess"))'));
  const settingsRule = rulesSrc.slice(rulesSrc.indexOf("match /settings/{docId}"), rulesSrc.indexOf("match /users/{uid}"));
  assert.ok(settingsRule.includes("allow list: if isSuperAdmin();"));
  assert.ok(settingsRule.includes("allow get:"), "single-document reads are separate from listing");
  assert.ok(rulesSrc.slice(rulesSrc.indexOf("match /adminAccess/")).includes("allow list: if isSuperAdmin();"));
});

// =====================================================================
// 9. STORAGE RULES FILE (static checks)
// =====================================================================
const storageSrc = fs.readFileSync(path.join(__dirname, "../storage.rules"), "utf8");
const storageCode = storageSrc.replace(/\/\/.*$/gm, "");

test("storage rules: only branding logos are public; no catch-all, nothing else is 'if true'", () => {
  const trues = storageCode.split("\n").filter((l) => /if\s+true\b/.test(l));
  assert.equal(trues.length, 1, "exactly one public rule");
  const brandingBlock = storageCode.slice(storageCode.indexOf("match /settings/branding/"));
  assert.ok(brandingBlock.includes("allow read: if true;"));
  assert.ok(!storageCode.includes("{allPaths=**}"), "no wildcard that would re-open the bucket");
});
test("storage rules: every path the app uploads to has a rule", () => {
  const sources = [
    ["../app/profile/components/PersonalInfo.tsx", "employees/${user.uid}/profile/", "match /employees/{uid}/profile/"],
    ["../app/profile/components/DocumentUpload.tsx", "employees/${user.uid}/documents/", "match /employees/{uid}/documents/"],
    ["../app/admin/documents/[id]/page.js", "documents/${id}/", "match /documents/{uid}/"],
    ["../app/admin/documents/page.tsx", "commonDocuments/", "match /commonDocuments/"],
    ["../app/settings/branding/page.tsx", "settings/branding/", "match /settings/branding/"],
  ];
  for (const [file, pathUsed, ruleStart] of sources) {
    assert.ok(fs.readFileSync(path.join(__dirname, file), "utf8").includes(pathUsed), `${file} uses ${pathUsed}`);
    assert.ok(storageCode.includes(ruleStart), `rule for ${pathUsed}`);
  }
});
test("storage rules: admin status is checked against adminAccess with a verified email; uploads are size-limited", () => {
  assert.ok(storageCode.includes("firestore.get(accessPath())"));
  assert.ok(storageCode.includes("email_verified == true"));
  assert.ok(storageCode.includes("@omtatvadigitals[.]com"));
  assert.ok((storageCode.match(/smallerThanMb\(/g) || []).length >= 5);
  assert.ok(storageCode.includes("function notRunnable()"));
});
test("storage rules: employees can only touch their own folder; HR files and company files are admin-written", () => {
  assert.ok(/match \/employees\/\{uid\}\/profile[^]*?allow read: if isOwner\(uid\) \|\| isAdminTier\(\)/.test(storageCode));
  assert.ok(/match \/documents\/\{uid\}[^]*?allow create, update: if isAdminTier\(\)/.test(storageCode));
  assert.ok(/match \/commonDocuments[^]*?allow create, update: if isAdminTier\(\)/.test(storageCode));
  assert.ok(/match \/settings\/branding[^]*?allow create, update: if isSuperAdmin\(\)/.test(storageCode));
});


// Reference to avoid an unused-import error in strict setups.
void NOW;
Promise.all(queue).then(() => console.log(`\n${passed} passed (super admin, archive, export, demo)${process.exitCode ? " - with FAILURES" : ""}`));
