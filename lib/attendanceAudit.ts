// Read-only audit of historical attendance. It only DESCRIBES problems and
// proposes what a human should review — it never writes anything, and no
// finding is applied automatically.

import {
  buildEmployeeReport,
  datesBetween,
  isAutoPlaceholder,
  type AttendanceRecord,
  type ReportEmployee,
} from "./attendanceReport";
import { type AttendanceRules } from "./attendanceRules";
import {
  companyTimezone,
  getAbsentPolicy,
  localDateString,
  resolveShift,
  weekdayOf,
  type PolicyRules,
} from "./attendancePolicy";

export type FindingType =
  | "invalid-date"
  | "date-mismatch"
  | "absent-on-weekly-off"
  | "absent-on-holiday"
  | "absent-on-leave"
  | "absent-with-punch"
  | "missing-record"
  | "present-without-punch"
  | "duplicate-records"
  | "punch-out-before-punch-in"
  | "missing-punch-out"
  | "hours-mismatch"
  | "orphan-record";

export type Severity = "high" | "medium" | "low";

export type Finding = {
  id: string;
  type: FindingType;
  severity: Severity;
  userId: string;
  employeeName: string;
  date: string;
  recordId: string;
  message: string;
  // What a reviewer might do. Nothing here is applied automatically.
  suggestion: string;
  // For single-record corrections only: a proposed status (null = needs a human).
  proposedStatus: string | null;
};

export const FINDING_META: Record<FindingType, { label: string; severity: Severity }> = {
  "invalid-date": { label: "Invalid date format", severity: "high" },
  "date-mismatch": { label: "Date does not match punch-in day", severity: "high" },
  "absent-on-weekly-off": { label: "Absent on a weekly off", severity: "high" },
  "absent-on-holiday": { label: "Absent on a holiday", severity: "high" },
  "absent-on-leave": { label: "Absent on approved leave", severity: "high" },
  "absent-with-punch": { label: "Absent despite a punch-in", severity: "high" },
  "missing-record": { label: "Working day with no record", severity: "medium" },
  "present-without-punch": { label: "Present with no punch times", severity: "medium" },
  "duplicate-records": { label: "Duplicate records for one day", severity: "medium" },
  "punch-out-before-punch-in": { label: "Punch-out before punch-in", severity: "high" },
  "missing-punch-out": { label: "Punched in, never punched out", severity: "low" },
  "hours-mismatch": { label: "Saved hours differ from punches", severity: "low" },
  "orphan-record": { label: "Record for unknown employee", severity: "low" },
};

export type AuditInput = {
  employees: (ReportEmployee & { joiningDate?: string })[];
  records: AttendanceRecord[];
  holidays: Set<string>;
  // approved-leave dates per employee uid
  leaveDatesByUser: Map<string, Set<string>>;
  rules: (PolicyRules & AttendanceRules) | null | undefined;
  from: string;
  to: string;
  now?: Date;
};

export type AuditResult = {
  findings: Finding[];
  byType: Record<string, number>;
  bySeverity: Record<Severity, number>;
  recordsScanned: number;
  employeesScanned: number;
  generatedAt: string;
  range: { from: string; to: string };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function runAudit(input: AuditInput): AuditResult {
  const { employees, records, holidays, leaveDatesByUser, rules, from, to } = input;
  const now = input.now || new Date();
  const tz = companyTimezone(rules);
  const today = localDateString(now, tz);
  const policy = getAbsentPolicy(rules);
  const empById = new Map(employees.map((e) => [e.uid, e]));
  const findings: Finding[] = [];

  const add = (
    type: FindingType,
    userId: string,
    date: string,
    recordId: string,
    message: string,
    suggestion: string,
    proposedStatus: string | null = null
  ) => {
    findings.push({
      id: `${type}|${userId}|${date}|${recordId}`,
      type,
      severity: FINDING_META[type].severity,
      userId,
      employeeName: empById.get(userId)?.name || "(unknown employee)",
      date,
      recordId,
      message,
      suggestion,
      proposedStatus,
    });
  };

  // ---- per-record checks ------------------------------------------------
  const perUserDate = new Map<string, AttendanceRecord[]>();

  for (const r of records) {
    const inRange = r.date >= from && r.date <= to;

    if (!DATE_RE.test(r.date)) {
      add("invalid-date", r.userId, r.date, r.id, `Stored date "${r.date}" is not YYYY-MM-DD.`, "Find the correct date from the punch time and correct it.");
      continue;
    }
    if (!inRange) continue;

    const key = `${r.userId}|${r.date}`;
    perUserDate.set(key, [...(perUserDate.get(key) || []), r]);

    const emp = empById.get(r.userId);
    if (!emp) {
      add("orphan-record", r.userId, r.date, r.id, "Employee no longer exists in the users list.", "Leave as history, or confirm with HR before any change.");
    }

    const leaveDates = leaveDatesByUser.get(r.userId) || new Set<string>();
    const shift = resolveShift(rules, emp?.shiftId);
    const workdays = r.shiftSnapshot?.workdays?.length ? r.shiftSnapshot.workdays : shift.workdays;

    // Date vs the day the punch actually happened (company timezone).
    if (r.punchIn && !r.shiftSnapshot) {
      const expected = localDateString(r.punchIn, tz);
      if (expected !== r.date) {
        add(
          "date-mismatch",
          r.userId,
          r.date,
          r.id,
          `Punch-in is on ${expected} (company time) but the record is dated ${r.date}.`,
          `Check whether this record belongs to ${expected}; do not move it without confirming no record already exists there.`
        );
      }
    }

    // Absent on a day nobody was expected to attend.
    if (r.status === "Absent" && !r.punchIn) {
      if (holidays.has(r.date)) {
        add("absent-on-holiday", r.userId, r.date, r.id, "Marked Absent on a company holiday.", "Change to Holiday after review.", "Holiday");
      } else if (leaveDates.has(r.date)) {
        add("absent-on-leave", r.userId, r.date, r.id, "Marked Absent on an approved leave day.", "Change to Leave after review.", "Leave");
      } else if (!workdays.includes(weekdayOf(r.date))) {
        add("absent-on-weekly-off", r.userId, r.date, r.id, "Marked Absent on a weekly off.", "Change to Weekly Off after review.", "Weekly Off");
      }
    }

    // Absent although the person punched in, with no grace-policy basis.
    if (r.status === "Absent" && r.punchIn) {
      const policyApplied = (r.raw.policy as { applied?: boolean } | undefined)?.applied === true;
      if (!policyApplied) {
        add(
          "absent-with-punch",
          r.userId,
          r.date,
          r.id,
          r.date < policy.effectiveFrom
            ? `Marked Absent but punched in; the grace-period Absent rule only starts ${policy.effectiveFrom}.`
            : "Marked Absent but punched in, and no grace-period policy decision is recorded.",
          "Review the punch time against the shift; likely should be Present.",
          "Present"
        );
      }
    }

    if (r.status === "Present" && !r.punchIn && !isAutoPlaceholder(r)) {
      add("present-without-punch", r.userId, r.date, r.id, "Marked Present but there are no punch times.", "Confirm with the employee/manager; only an administrator should keep this as Present.");
    }

    if (r.punchIn && r.punchOut) {
      if (r.punchOut.getTime() < r.punchIn.getTime()) {
        add("punch-out-before-punch-in", r.userId, r.date, r.id, "Punch-out time is earlier than punch-in.", "Correct the punch times from a verified source.");
      } else {
        const hours = (r.punchOut.getTime() - r.punchIn.getTime()) / 3600000;
        if (Math.abs(hours - r.totalHours) > 0.1) {
          add("hours-mismatch", r.userId, r.date, r.id, `Saved ${r.totalHours} h but punches give ${hours.toFixed(2)} h.`, "Recalculate hours after confirming the punch times.");
        }
      }
    }

    if (r.punchIn && !r.punchOut && r.date < today) {
      const stillOpen = r.shiftEndAt && now.getTime() <= r.shiftEndAt.getTime();
      if (!stillOpen) {
        add("missing-punch-out", r.userId, r.date, r.id, "No punch-out was recorded.", "Use the employee's punch-out correction request, or correct with a reason.");
      }
    }
  }

  for (const [key, list] of perUserDate) {
    if (list.length > 1) {
      const [userId, date] = key.split("|");
      add(
        "duplicate-records",
        userId,
        date,
        list.map((r) => r.id).join("+"),
        `${list.length} records exist for the same day.`,
        "Decide which record is correct; never delete without a backup."
      );
    }
  }

  // ---- missing working days --------------------------------------------
  for (const emp of employees) {
    const report = buildEmployeeReport({
      employee: emp,
      records,
      holidays,
      leaveDates: leaveDatesByUser.get(emp.uid) || new Set(),
      rules,
      from,
      to,
      now,
    });
    for (const day of report.days) {
      if (day.kind !== "no-record") continue;
      if (emp.joiningDate && DATE_RE.test(emp.joiningDate) && day.date < emp.joiningDate) continue;
      add(
        "missing-record",
        emp.uid,
        day.date,
        "",
        "Working day with no attendance record.",
        "Do not assume Present. Verify (leave, WFH, punch logs) and have an administrator confirm the correct status."
      );
    }
  }

  const byType: Record<string, number> = {};
  const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    byType[f.type] = (byType[f.type] || 0) + 1;
    bySeverity[f.severity]++;
  }

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      a.employeeName.localeCompare(b.employeeName) ||
      a.date.localeCompare(b.date)
  );

  return {
    findings,
    byType,
    bySeverity,
    recordsScanned: records.length,
    employeesScanned: employees.length,
    generatedAt: now.toISOString(),
    range: { from, to },
  };
}

export { datesBetween };
