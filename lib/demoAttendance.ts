// Demo attendance generator (pure). For the SEPARATE Firebase test project
// only — never for production. Every generated document is flagged
// (isDemo: true, attendanceSource: "DEMO-GENERATED", verified: false) so it
// can never be mistaken for verified attendance, and its id starts with
// "demo_" so it can be removed in one query. Payroll and production reports
// ignore isDemo records.
//
// Percentages use ELIGIBLE days only: scheduled working days that are not a
// weekly off, a company holiday or an approved-leave day — the same rule the
// report builder uses, so the numbers shown on screen match this file.

import {
  addDays,
  resolveShift,
  shiftInstance,
  weekdayOf,
  type PolicyRules,
  type ResolvedShift,
} from "./attendancePolicy";
import { datesBetween } from "./attendanceReport";

export const DEMO_ID_PREFIX = "demo_";
export const PRODUCTION_PROJECT_ID = "omtatva-portal";

export type DemoEmployee = { uid: string; name: string; email: string; shiftId?: string | null };

export const DEMO_EMPLOYEE_NAMES = [
  "Aarav Mehta",
  "Diya Nair",
  "Kabir Sethi",
  "Meera Iyer",
  "Rohan Bhatt",
  "Ishita Rao",
  "Vikram Pillai",
  "Sana Qureshi",
];

export function makeDemoEmployees(count: number, shiftIds: (string | null)[] = [null]): DemoEmployee[] {
  return Array.from({ length: count }, (_, i) => ({
    uid: `${DEMO_ID_PREFIX}user_${String(i + 1).padStart(2, "0")}`,
    name: DEMO_EMPLOYEE_NAMES[i % DEMO_EMPLOYEE_NAMES.length],
    email: `demo.employee${i + 1}@example.invalid`,
    shiftId: shiftIds[i % shiftIds.length],
  }));
}

// FNV-1a: turns (seed, uid) into a 32-bit seed for that employee's stream.
export function hashSeed(seed: number, uid: string): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Small deterministic PRNG so a given seed always yields the same data.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Target attendance for the requested historical months.
export const HISTORICAL_TARGETS: Record<string, number> = { "2026-08": 0.8, "2026-09": 0.7 };
// Hard ceiling: no demo employee may reach this in any month.
export const MAX_DEMO_ATTENDANCE = 0.95;

export type DemoMonthStat = {
  uid: string;
  month: string;
  eligibleDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  skippedExisting: number;
  percentage: number;
};

export type DemoOutput = {
  attendance: { id: string; data: Record<string, unknown> }[];
  leaves: { id: string; data: Record<string, unknown> }[];
  perEmployee: { uid: string; workingDays: number; presentDays: number; absentDays: number; leaveDays: number; percentage: number }[];
  perEmployeeMonth: DemoMonthStat[];
};

export function generateDemoAttendance(input: {
  employees: DemoEmployee[];
  rules: PolicyRules;
  holidays: Set<string>;
  from: string;
  to: string;
  seed?: number;
  batchId: string;
  now?: Date;
  // month key -> target attendance (e.g. {"2026-08": 0.8}). Months without a
  // target get a per-employee random rate of 72-94%.
  monthTargets?: Record<string, number>;
  // "uid|date" pairs that already have an attendance record. Those days are
  // left completely alone (never overwritten, never duplicated).
  existingKeys?: Set<string>;
  // Approved-leave dates that already exist per employee uid. Treated as
  // leave: no attendance is generated on them and they stay out of the
  // eligible-day denominator.
  existingLeaveDates?: Map<string, Set<string>>;
  // Probability that a present day is missing its punch-out (Incomplete).
  // Defaults to 5% for untargeted data and 0 when monthTargets are used, so
  // the targets are hit exactly.
  missingPunchOutRate?: number;
}): DemoOutput {
  const { employees, rules, holidays, from, to, batchId } = input;
  const seed = input.seed ?? 20260701;
  const now = input.now || new Date();
  const existing = input.existingKeys || new Set<string>();
  const targeted = !!input.monthTargets;
  const missingRate = input.missingPunchOutRate ?? (targeted ? 0 : 0.05);
  const out: DemoOutput = { attendance: [], leaves: [], perEmployee: [], perEmployeeMonth: [] };
  const seenIds = new Set<string>();

  for (const emp of employees) {
    // Each employee has their OWN random stream (seed + uid). What one
    // employee gets never depends on the other employees or on which days
    // already have records — that is what makes a re-run reproduce the same
    // leave blocks (and therefore create nothing new).
    const rand = mulberry32(hashSeed(seed, emp.uid));
    const shift = resolveShift(rules, emp.shiftId);
    const dates = datesBetween(from, to);
    const randomRate = 0.72 + rand() * 0.22;

    // Approved-leave blocks (1-2 days), a few times over the period.
    const leaveDates = new Set<string>(input.existingLeaveDates?.get(emp.uid) || []);
    const leaveBlocks = 2 + Math.floor(rand() * 2);
    for (let b = 0; b < leaveBlocks; b++) {
      const start = dates[Math.floor(rand() * Math.max(dates.length - 3, 1))];
      const len = 1 + Math.floor(rand() * 2);
      const blockDates: string[] = [];
      for (let i = 0; i < len; i++) {
        const d = addDays(start, i);
        if (d <= to && shift.workdays.includes(weekdayOf(d)) && !holidays.has(d) && !existing.has(`${emp.uid}|${d}`)) blockDates.push(d);
      }
      // Only add a leave document if it brings at least one NEW leave day.
      if (blockDates.some((d) => !leaveDates.has(d))) {
        blockDates.forEach((d) => leaveDates.add(d));
        out.leaves.push({
          id: `${DEMO_ID_PREFIX}leave_${emp.uid}_${blockDates[0]}`,
          data: {
            uid: emp.uid,
            employeeName: emp.name,
            email: emp.email,
            leaveType: rand() < 0.5 ? "Casual Leave" : "Sick Leave",
            fromDate: blockDates[0],
            toDate: blockDates[blockDates.length - 1],
            totalDays: blockDates.length,
            reason: "Demo data",
            status: "Approved",
            isDemo: true,
            demoBatchId: batchId,
          },
        });
      }
    }

    // Group eligible days by month and decide each month on its own.
    const months = Array.from(new Set(dates.map((d) => d.slice(0, 7))));
    let totalEligible = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    for (const month of months) {
      const monthDates = dates.filter((d) => d.startsWith(month));
      const scheduled = monthDates.filter(
        (d) => shift.workdays.includes(weekdayOf(d)) && !holidays.has(d) && !leaveDates.has(d)
      );
      const skipped = scheduled.filter((d) => existing.has(`${emp.uid}|${d}`));
      const eligible = scheduled.filter((d) => !existing.has(`${emp.uid}|${d}`));

      const target = input.monthTargets?.[month];
      // Per-employee spread of up to +/-2 percentage points around the target.
      const rate =
        target !== undefined ? Math.min(target + (rand() - 0.5) * 0.04, MAX_DEMO_ATTENDANCE - 0.02) : randomRate;

      const presentCount = Math.min(
        Math.round(eligible.length * rate),
        Math.ceil(eligible.length * MAX_DEMO_ATTENDANCE) - 1
      );
      const absentCount = Math.max(eligible.length - presentCount, Math.min(2, eligible.length));

      // Pick this employee's own absent days (random, a little heavier on
      // Mondays/Fridays) so patterns differ between employees.
      const absentSet = new Set(
        eligible
          .map((d) => ({ d, w: rand() * (weekdayOf(d) === 1 || weekdayOf(d) === 5 ? 0.6 : 1) }))
          .sort((a, b) => a.w - b.w)
          .slice(0, absentCount)
          .map((x) => x.d)
      );

      let present = 0;
      let absent = 0;

      for (const date of eligible) {
        const id = `${DEMO_ID_PREFIX}att_${emp.uid}_${date}`;
        if (seenIds.has(id)) continue; // never two records for one user+day
        seenIds.add(id);

        const base = {
          userId: emp.uid,
          employeeName: emp.name,
          email: emp.email,
          date,
          isDemo: true,
          verified: false,
          demoBatchId: batchId,
          createdAt: now,
        };

        if (absentSet.has(date)) {
          absent++;
          out.attendance.push({
            id,
            data: {
              ...base,
              PunchIn: null,
              PunchOut: null,
              totalHours: 0,
              extraHours: 0,
              status: "Absent",
              attendanceSource: "DEMO-GENERATED",
            },
          });
          continue;
        }

        present++;
        const inst = shiftInstance(shift, date);
        const inMs = inst.start.getTime() + Math.round((rand() * 30 - 20) * 60000);
        const missingOut = rand() < missingRate;
        const outMs = inst.end.getTime() + Math.round((rand() * 50 - 10) * 60000);

        out.attendance.push({
          id,
          data: {
            ...base,
            PunchIn: new Date(inMs),
            PunchOut: missingOut ? null : new Date(outMs),
            totalHours: missingOut ? 0 : Math.round(((outMs - inMs) / 3600000) * 100) / 100,
            extraHours: 0,
            status: "Present",
            shiftId: shift.id,
            shiftName: shift.name,
            shiftSnapshot: snapshotOf(shift),
            shiftEndAt: inst.end,
            attendanceSource: "DEMO-GENERATED",
          },
        });
      }

      const leaveInMonth = monthDates.filter((d) => leaveDates.has(d)).length;
      out.perEmployeeMonth.push({
        uid: emp.uid,
        month,
        eligibleDays: eligible.length,
        presentDays: present,
        absentDays: absent,
        leaveDays: leaveInMonth,
        skippedExisting: skipped.length,
        percentage: eligible.length ? Math.round((present / eligible.length) * 1000) / 10 : 0,
      });

      totalEligible += eligible.length;
      totalPresent += present;
      totalAbsent += absent;
    }

    out.perEmployee.push({
      uid: emp.uid,
      workingDays: totalEligible,
      presentDays: totalPresent,
      absentDays: totalAbsent,
      leaveDays: leaveDates.size,
      percentage: totalEligible ? Math.round((totalPresent / totalEligible) * 1000) / 10 : 0,
    });
  }

  return out;
}

function snapshotOf(s: ResolvedShift) {
  return {
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    graceMinutes: s.graceMinutes,
    timezone: s.timezone,
    workdays: s.workdays,
  };
}

// ---------------------------------------------------------------------
// Target-environment safety
// ---------------------------------------------------------------------

// First gate (before any connection): the caller must name a test project,
// and it must not be production.
export function assertSafeDemoTarget(projectId: string | undefined, confirmFlag: boolean): string | null {
  if (!projectId) return "Set DEMO_FIREBASE_PROJECT_ID to your TEST project id.";
  if (projectId === PRODUCTION_PROJECT_ID) return "Refusing to run: that is the PRODUCTION project.";
  if (!confirmFlag) return "Pass --i-understand-this-is-not-production to confirm the target is a test project.";
  return null;
}

// Second gate (after connecting): the project the credentials really belong to
// must match, and the database must carry the explicit demo-environment marker
// (settings/demoEnvironment, created once by --init-test-project). Anything
// that cannot be verified is refused.
export function verifyDemoEnvironment(input: {
  requestedProject: string;
  credentialProject: string | undefined;
  marker: { isDemoEnvironment?: boolean; projectId?: string } | null;
}): string | null {
  const { requestedProject, credentialProject, marker } = input;
  if (requestedProject === PRODUCTION_PROJECT_ID || credentialProject === PRODUCTION_PROJECT_ID) {
    return "Refusing to run: the credentials or target resolve to the PRODUCTION project.";
  }
  if (!credentialProject) {
    return "Cannot verify the target: the credentials do not name a project. Use a service-account key for the test project.";
  }
  if (credentialProject !== requestedProject) {
    return `Credentials belong to "${credentialProject}" but the target is "${requestedProject}". Refusing.`;
  }
  if (!marker || marker.isDemoEnvironment !== true || marker.projectId !== requestedProject) {
    return "Target is not marked as a demo environment. Run once with --init-test-project to mark this TEST project.";
  }
  return null;
}

// Production NEVER shows demo records. Only a non-production project that
// carries the explicit demo-environment marker for ITSELF may include them.
export function shouldIncludeDemo(
  projectId: string,
  marker: { isDemoEnvironment?: boolean; projectId?: string } | null | undefined
): boolean {
  if (projectId === PRODUCTION_PROJECT_ID) return false;
  return !!marker && marker.isDemoEnvironment === true && marker.projectId === projectId;
}

export type Environment = "production" | "demo" | "unverified";

// What kind of Firebase project is this server connected to?
//  - production: the real portal — synthetic data is NEVER allowed
//  - demo: a non-production project carrying its own demo marker
//  - unverified: a non-production project without the marker — treated as
//    "cannot verify", so nothing is generated
export function classifyEnvironment(
  projectId: string,
  marker: { isDemoEnvironment?: boolean; projectId?: string } | null | undefined
): Environment {
  if (projectId === PRODUCTION_PROJECT_ID) return "production";
  return shouldIncludeDemo(projectId, marker) ? "demo" : "unverified";
}
