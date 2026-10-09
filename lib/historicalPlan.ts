// Historical attendance (1 Jul – 30 Sep 2026): what exists, what is missing,
// and — ONLY in a verified demo/test project — what synthetic attendance
// would be generated. Pure and read-only: nothing here writes anything.
//
//  * production  -> shows real records and missing dates, separately; NEVER
//                   proposes generated attendance (corrections go through the
//                   audited correction workflow, with evidence)
//  * demo        -> additionally previews the exact records that would be
//                   created (idempotent: existing days are skipped)
//  * unverified  -> treated like production for safety

import { addDays, companyTimezone, localDateString, type PolicyRules } from "./attendancePolicy";
import { monthBounds } from "./attendanceMonths";
import {
  HISTORICAL_TARGETS,
  generateDemoAttendance,
  makeDemoEmployees,
  type DemoEmployee,
  type DemoOutput,
  type Environment,
} from "./demoAttendance";
import { buildEmployeeReport, normalizeRecord } from "./attendanceReport";
import type { HydratedDataset } from "./attendanceExport";

export const HISTORY_FROM = "2026-07-01";
export const HISTORY_TO = "2026-09-30";
export const HISTORY_MONTHS = ["2026-07", "2026-08", "2026-09"] as const;
export const DEMO_BATCH_ID = "demo-history-2026-q3";

export type PlanRow = {
  uid: string;
  name: string;
  employeeId: string;
  department: string;
  inactive: boolean;
  month: string;
  monthLabel: string;
  existingRecords: number;
  presentDays: number;
  absentDays: number;
  incompleteDays: number;
  leaveDays: number;
  offDays: number; // weekly offs + company holidays
  eligibleDays: number;
  percentage: number | null;
  missingDates: string[];
  proposed: null | {
    newRecords: number;
    presentDays: number;
    absentDays: number;
    eligibleDays: number;
    percentage: number | null;
  };
};

export type PlanMonthSummary = {
  month: string;
  label: string;
  employees: number;
  existingRecords: number;
  missingDates: number;
  proposedNewRecords: number;
};

export type HistoricalPlan = {
  environment: Environment;
  projectId: string;
  generatedAt: string;
  range: { from: string; to: string };
  canGenerate: boolean;
  blockedReason: string;
  rows: PlanRow[];
  months: PlanMonthSummary[];
  // Server-side only (never sent to the browser): the documents that would be written.
  generated: DemoOutput | null;
  newUsers: DemoEmployee[];
};

export function blockedReasonFor(environment: Environment): string {
  if (environment === "production") {
    return "This is the PRODUCTION project. Attendance is never fabricated here: only real, verified records are shown, and missing days can be corrected one by one — with evidence, a reason and a verified backup — through the audited correction workflow.";
  }
  if (environment === "unverified") {
    return "This Firebase project is not verified as a demo/test environment (it has no demo marker), so nothing can be generated. Run the generator script once with --init-test-project on your TEST project.";
  }
  return "";
}

export function buildHistoricalPlan(input: {
  dataset: HydratedDataset;
  environment: Environment;
  projectId: string;
  now?: Date;
  seed?: number;
}): HistoricalPlan {
  const { dataset, environment, projectId } = input;
  const now = input.now || new Date();
  const rules = dataset.rules as (PolicyRules & Record<string, unknown>) | null;
  const tz = companyTimezone(rules);
  const today = localDateString(now, tz);
  const lastDay = addDays(today, -1) < HISTORY_TO ? addDays(today, -1) : HISTORY_TO;
  const canGenerate = environment === "demo";

  const monthsInRange = HISTORY_MONTHS.filter((m) => monthBounds(m).from <= lastDay);

  // ---- 1. what would be generated (demo only) --------------------------
  let generated: DemoOutput | null = null;
  let newUsers: DemoEmployee[] = [];
  let people = dataset.employees.map((e) => ({
    uid: e.uid,
    name: e.name,
    employeeId: e.employeeId || "",
    department: e.department || "",
    inactive: !!e.inactive,
    shiftId: e.shiftId ?? null,
  }));

  if (canGenerate && lastDay >= HISTORY_FROM) {
    let employees: DemoEmployee[] = dataset.employees
      .filter((e) => !e.inactive)
      .map((e) => ({ uid: e.uid, name: e.name, email: "", shiftId: e.shiftId ?? null }));

    // A brand-new test project may have no employees at all.
    if (dataset.employees.length === 0) {
      const shiftIds = ((rules?.shifts as { id: string }[] | undefined) || []).map((s) => s.id);
      newUsers = makeDemoEmployees(8, [null, ...shiftIds]);
      employees = newUsers;
      people = newUsers.map((u) => ({ uid: u.uid, name: u.name, employeeId: "", department: "", inactive: false, shiftId: u.shiftId ?? null }));
    }

    generated = generateDemoAttendance({
      employees,
      rules: (rules || {}) as PolicyRules,
      holidays: dataset.holidays,
      from: HISTORY_FROM,
      to: lastDay,
      seed: input.seed ?? 20260701,
      batchId: DEMO_BATCH_ID,
      now,
      monthTargets: HISTORICAL_TARGETS,
      existingKeys: new Set(dataset.records.map((r) => `${r.userId}|${r.date}`)),
      existingLeaveDates: dataset.leaveDatesByUser,
    });
  }

  const afterRecords = generated
    ? [...dataset.records, ...generated.attendance.map((r) => normalizeRecord({ id: r.id, ...r.data } as never))]
    : null;
  const afterLeave = new Map(dataset.leaveDatesByUser);
  if (generated) {
    for (const l of generated.leaves) {
      const uid = String(l.data.uid);
      const set = new Set(afterLeave.get(uid) || []);
      for (let d = String(l.data.fromDate); d <= String(l.data.toDate); d = addDays(d, 1)) set.add(d);
      afterLeave.set(uid, set);
    }
  }

  // ---- 2. one row per employee x month ---------------------------------
  const rows: PlanRow[] = [];
  for (const p of people) {
    for (const month of monthsInRange) {
      const b = monthBounds(month);
      const employee = { uid: p.uid, name: p.name, employeeId: p.employeeId, shiftId: p.shiftId };
      const report = buildEmployeeReport({
        employee,
        records: dataset.records,
        holidays: dataset.holidays,
        leaveDates: dataset.leaveDatesByUser.get(p.uid) || new Set(),
        rules,
        from: b.from,
        to: b.to > HISTORY_TO ? HISTORY_TO : b.to,
        now,
      });
      const c = report.summary.counts;

      let proposed: PlanRow["proposed"] = null;
      if (afterRecords) {
        const after = buildEmployeeReport({
          employee,
          records: afterRecords,
          holidays: dataset.holidays,
          leaveDates: afterLeave.get(p.uid) || new Set(),
          rules,
          from: b.from,
          to: b.to > HISTORY_TO ? HISTORY_TO : b.to,
          now,
        });
        const ac = after.summary.counts;
        proposed = {
          newRecords: (generated?.attendance || []).filter((r) => r.data.userId === p.uid && String(r.data.date).startsWith(month)).length,
          presentDays: ac.present + ac.late,
          absentDays: ac.absent,
          eligibleDays: after.summary.expectedDays,
          percentage: after.summary.percentage,
        };
      }

      rows.push({
        uid: p.uid,
        name: p.name,
        employeeId: p.employeeId,
        department: p.department,
        inactive: p.inactive,
        month,
        monthLabel: b.label,
        existingRecords: report.days.filter((d) => d.record).length,
        presentDays: c.present + c.late,
        absentDays: c.absent,
        incompleteDays: c.incomplete,
        leaveDays: c.leave,
        offDays: c.holiday + c["weekly-off"],
        eligibleDays: report.summary.expectedDays,
        percentage: report.summary.percentage,
        missingDates: report.days.filter((d) => d.kind === "no-record").map((d) => d.date),
        proposed,
      });
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name) || a.month.localeCompare(b.month));

  const months: PlanMonthSummary[] = monthsInRange.map((month) => {
    const r = rows.filter((x) => x.month === month);
    return {
      month,
      label: monthBounds(month).label,
      employees: r.length,
      existingRecords: r.reduce((n, x) => n + x.existingRecords, 0),
      missingDates: r.reduce((n, x) => n + x.missingDates.length, 0),
      proposedNewRecords: r.reduce((n, x) => n + (x.proposed?.newRecords || 0), 0),
    };
  });

  return {
    environment,
    projectId,
    generatedAt: now.toISOString(),
    range: { from: HISTORY_FROM, to: lastDay },
    canGenerate,
    blockedReason: canGenerate ? "" : blockedReasonFor(environment),
    rows,
    months,
    generated,
    newUsers,
  };
}

// What the browser may see: the plan without the documents to be written.
export function publicPlan(plan: HistoricalPlan): Omit<HistoricalPlan, "generated" | "newUsers"> & {
  willCreateUsers: number;
  willCreateLeaves: number;
} {
  const { generated, newUsers, ...rest } = plan;
  return { ...rest, willCreateUsers: newUsers.length, willCreateLeaves: generated?.leaves.length || 0 };
}
