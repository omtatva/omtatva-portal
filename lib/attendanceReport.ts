// Attendance report builder — pure functions (no Firestore/React).
//
// Turns raw attendance documents + holidays + approved leave + shift
// schedules into one classified row per calendar day for an employee, and
// a summary with an attendance percentage.
//
// RULES
//  * A missing record is NEVER assumed Present. A past working day with no
//    record is shown as "No record" (unverified) and counts against the
//    percentage until an administrator confirms it.
//  * A real punch always wins. Otherwise: holiday > approved leave >
//    weekly off > stored record > "No record".
//  * Dates, weekdays and "today" use the company timezone, never the
//    browser's. Weekly offs come from the shift saved on the record (or the
//    employee's assigned shift / company working days).
//  * Percentage = (Present + Late) / expected working days, where expected
//    days exclude holidays, approved leave, weekly offs and days that
//    haven't happened yet. Incomplete, Absent, No record and other
//    statuses stay in the denominator but not the numerator. Work done on a
//    holiday/weekly off is shown but excluded from both sides.

import { computeDisplayStatus, type AttendanceRules } from "./attendanceRules";
import {
  addDays,
  companyTimezone,
  localDateString,
  resolveShift,
  weekdayOf,
  type PolicyRules,
} from "./attendancePolicy";

export type DayKind =
  | "present"
  | "late"
  | "absent"
  | "incomplete"
  | "leave"
  | "holiday"
  | "weekly-off"
  | "no-record"
  | "upcoming"
  | "other";

export type RawAttendance = Record<string, unknown> & { id?: string };

export type AttendanceRecord = {
  id: string;
  userId: string;
  date: string;
  status: string;
  punchIn: Date | null;
  punchOut: Date | null;
  totalHours: number;
  shiftId: string;
  shiftName: string;
  shiftSnapshot: {
    startTime?: string;
    endTime?: string;
    graceMinutes?: number;
    timezone?: string;
    workdays?: number[];
  } | null;
  shiftEndAt: Date | null;
  source: string;
  statusReason: string;
  correctionCount: number;
  isDemo: boolean;
  raw: RawAttendance;
};

export type ReportEmployee = {
  uid: string;
  name: string;
  email?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  shiftId?: string | null;
};

export type ReportDay = {
  date: string;
  weekday: number;
  kind: DayKind;
  label: string;
  record: AttendanceRecord | null;
  shiftName: string;
  shiftTimes: string;
  flags: string[];
};

export type EmployeeSummary = {
  counts: Record<DayKind, number>;
  expectedDays: number;
  attendedDays: number;
  percentage: number | null; // null when there are no expected days
  workedOffDays: number;
};

export type EmployeeReport = {
  employee: ReportEmployee;
  days: ReportDay[];
  summary: EmployeeSummary;
};

export function toDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
  if (typeof v.toDate === "function") return v.toDate();
  const seconds = v.seconds ?? v._seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

export function normalizeRecord(raw: RawAttendance): AttendanceRecord {
  const snapshot = raw.shiftSnapshot as AttendanceRecord["shiftSnapshot"] | undefined;
  const history = Array.isArray(raw.statusHistory) ? (raw.statusHistory as { type?: string }[]) : [];
  return {
    id: String(raw.id || ""),
    userId: String(raw.userId || ""),
    date: String(raw.date || ""),
    status: String(raw.status || ""),
    punchIn: toDateValue(raw.PunchIn),
    punchOut: toDateValue(raw.PunchOut),
    totalHours: Number(raw.totalHours || 0),
    shiftId: String(raw.shiftId || ""),
    shiftName: String(raw.shiftName || ""),
    shiftSnapshot: snapshot && typeof snapshot === "object" ? snapshot : null,
    shiftEndAt: toDateValue(raw.shiftEndAt),
    source: String(raw.attendanceSource || ""),
    statusReason: String(raw.statusReason || ""),
    correctionCount: history.filter((h) => h?.type === "correction" || h?.type === "revert").length,
    isDemo: raw.isDemo === true,
    raw,
  };
}

export function isAutoPlaceholder(r: Pick<AttendanceRecord, "punchIn" | "status" | "source">): boolean {
  return !r.punchIn && r.status === "Absent" && r.source.startsWith("Auto-marked");
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}

export function expandLeaveDates(
  leaves: { fromDate?: unknown; toDate?: unknown; status?: unknown }[]
): Set<string> {
  const set = new Set<string>();
  for (const l of leaves) {
    if (String(l.status || "").toLowerCase() !== "approved") continue;
    const from = String(l.fromDate || "");
    const to = String(l.toDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) continue;
    datesBetween(from, to).forEach((d) => set.add(d));
  }
  return set;
}

const EMPTY_COUNTS = (): Record<DayKind, number> => ({
  present: 0,
  late: 0,
  absent: 0,
  incomplete: 0,
  leave: 0,
  holiday: 0,
  "weekly-off": 0,
  "no-record": 0,
  upcoming: 0,
  other: 0,
});

export const KIND_LABEL: Record<DayKind, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  incomplete: "Incomplete",
  leave: "Approved leave",
  holiday: "Holiday",
  "weekly-off": "Weekly off",
  "no-record": "No record",
  upcoming: "Upcoming",
  other: "Other",
};

export function buildEmployeeReport(input: {
  employee: ReportEmployee;
  records: AttendanceRecord[];
  holidays: Set<string>;
  leaveDates: Set<string>;
  rules: (PolicyRules & AttendanceRules) | null | undefined;
  from: string;
  to: string;
  now?: Date;
}): EmployeeReport {
  const { employee, holidays, leaveDates, rules, from, to } = input;
  const tz = companyTimezone(rules);
  const today = localDateString(input.now || new Date(), tz);
  const assigned = resolveShift(rules, employee.shiftId);

  // One record per date; prefer a real punch, then the most recent.
  const byDate = new Map<string, AttendanceRecord[]>();
  for (const r of input.records) {
    if (r.userId !== employee.uid) continue;
    byDate.set(r.date, [...(byDate.get(r.date) || []), r]);
  }

  const pick = (list: AttendanceRecord[]) =>
    [...list].sort((a, b) => Number(!!b.punchIn) - Number(!!a.punchIn))[0];

  const days: ReportDay[] = datesBetween(from, to).map((date) => {
    const weekday = weekdayOf(date);
    const list = byDate.get(date) || [];
    const record = list.length ? pick(list) : null;
    const flags: string[] = [];
    if (list.length > 1) flags.push("duplicate-records");

    const snap = record?.shiftSnapshot;
    const workdays = snap?.workdays?.length ? snap.workdays : assigned.workdays;
    const shiftName = record?.shiftName || (record ? "—" : assigned.name);
    const shiftTimes = snap?.startTime
      ? `${snap.startTime}–${snap.endTime}`
      : `${assigned.startTime}–${assigned.endTime}`;

    const isHoliday = holidays.has(date);
    const onLeave = leaveDates.has(date);
    const weeklyOff = !workdays.includes(weekday);

    const make = (kind: DayKind, label?: string): ReportDay => ({
      date,
      weekday,
      kind,
      label: label || KIND_LABEL[kind],
      record,
      shiftName,
      shiftTimes,
      flags,
    });

    // A real punch always counts, even on an off day.
    if (record?.punchIn) {
      const display = computeDisplayStatus(
        {
          status: record.status,
          PunchIn: record.punchIn,
          PunchOut: record.punchOut,
          shiftEndAt: record.shiftEndAt,
          date: record.date,
        },
        rules,
        employee.shiftId,
        today
      );
      const offDay = isHoliday || weeklyOff || onLeave;
      if (offDay) flags.push("worked-on-off-day");
      if (display === "Absent") {
        flags.push("absent-with-punch");
        return make("absent");
      }
      if (record.date > today) return make("upcoming");
      if (display === "Late") return make("late");
      if (display === "Incomplete") return make("incomplete");
      return make("present");
    }

    if (date > today) return make("upcoming");

    if (isHoliday) {
      if (record?.status === "Absent") flags.push("absent-on-holiday");
      return make("holiday");
    }
    if (onLeave) {
      if (record?.status === "Absent") flags.push("absent-on-leave");
      return make("leave");
    }
    if (weeklyOff) {
      if (record?.status === "Absent") flags.push("absent-on-weekly-off");
      return make("weekly-off");
    }

    if (record) {
      if (isAutoPlaceholder(record)) flags.push("auto-marked");
      if (record.status === "Absent") return make("absent");
      if (/leave/i.test(record.status)) return make("leave");
      if (record.status === "Present") {
        // Present with no punch times: only an administrator can have set
        // this — show it, but flag it as unverified by a punch.
        flags.push("present-without-punch");
        return make("present");
      }
      return make("other", record.status || "Other");
    }

    if (date === today) return make("upcoming", "Pending today");
    return make("no-record");
  });

  const counts = EMPTY_COUNTS();
  let workedOffDays = 0;
  for (const d of days) {
    counts[d.kind]++;
    if (d.flags.includes("worked-on-off-day") && d.kind !== "absent") workedOffDays++;
  }

  // Off-day work is excluded from both sides of the percentage.
  const countable = days.filter((d) => !d.flags.includes("worked-on-off-day") || d.kind === "absent");
  const kindCount = (k: DayKind) => countable.filter((d) => d.kind === k).length;

  const attendedDays = kindCount("present") + kindCount("late");
  const expectedDays =
    attendedDays +
    kindCount("absent") +
    kindCount("incomplete") +
    kindCount("no-record") +
    kindCount("other");

  return {
    employee,
    days,
    summary: {
      counts,
      expectedDays,
      attendedDays,
      percentage: expectedDays > 0 ? Math.round((attendedDays / expectedDays) * 1000) / 10 : null,
      workedOffDays,
    },
  };
}

// ---- month filters ------------------------------------------------------

export const REPORT_START = "2026-07-01";
export const REPORT_END = "2026-09-30";

export const REPORT_MONTHS = [
  { key: "2026-07", label: "July 2026", from: "2026-07-01", to: "2026-07-31" },
  { key: "2026-08", label: "August 2026", from: "2026-08-01", to: "2026-08-31" },
  { key: "2026-09", label: "September 2026", from: "2026-09-01", to: "2026-09-30" },
  { key: "all", label: "July – September 2026", from: REPORT_START, to: REPORT_END },
] as const;

export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}
