// Attendance policy engine — pure functions only (no Firestore, no React),
// shared by the browser and the server routes so both always agree.
//
// POLICY (effective from ABSENT_POLICY_DEFAULT_EFFECTIVE_FROM, configurable):
//   A punch-in AFTER the shift's grace deadline is recorded as "Absent"
//   (not "Late"). The original punch timestamp is always preserved.
//
// BOUNDARY: the deadline itself is still on time.
//   shift 09:00, grace 15  ->  deadline 09:15:00.000
//   09:15:00.000 -> Present      09:15:00.001 -> Absent
//   Timestamps are compared exactly; seconds are NOT rounded down to the
//   minute, so 09:15:30 is Absent.
//
// All wall-clock times (shift start/end, the "date" of an attendance
// record, weekdays) are evaluated in the shift's company-local timezone,
// never the browser's or server's timezone.
//
// The old "Late" calculation is NOT deleted — it stays commented out in
// lib/attendanceRules.ts for later re-use.

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const ABSENT_POLICY_DEFAULT_EFFECTIVE_FROM = "2026-10-10";
// Earliest a punch-in is matched to a shift instance before it starts.
export const EARLY_PUNCH_MINUTES = 180;
// A session still open this long after punch-in can no longer be closed
// by punching out; it needs a correction request (shows as Incomplete).
export const MAX_SESSION_HOURS = 24;

export const DEFAULT_SHIFT_ID = "default";
// 0 = Sunday ... 6 = Saturday
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5, 6];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type ShiftConfig = {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM" — at or before startTime means it ends next day
  graceMinutes?: number;
  timezone?: string; // IANA, e.g. "Asia/Kolkata"
  workdays?: number[]; // 0-6, Sunday = 0
};

export type ResolvedShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  timezone: string;
  workdays: number[];
};

export type PolicyRules = {
  officeStartTime?: string;
  officeEndTime?: string;
  graceMinutes?: number;
  extraBufferMinutes?: number;
  timezone?: string;
  workingDays?: string[];
  shifts?: ShiftConfig[];
  absentPolicy?: { enabled?: boolean; effectiveFrom?: string };
  [key: string]: unknown;
};

// ---------------------------------------------------------------------
// Timezone helpers (Intl only — no dependencies)
// ---------------------------------------------------------------------

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - Math.floor(utcMs / 1000) * 1000) / 60000;
}

// "2026-10-10" + "09:00" in `timeZone` -> the real instant.
export function zonedWallTimeToInstant(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);

  let offset = offsetMinutes(guess, timeZone);
  let instant = guess - offset * 60000;
  const corrected = offsetMinutes(instant, timeZone);
  if (corrected !== offset) {
    offset = corrected;
    instant = guess - offset * 60000;
  }
  return new Date(instant);
}

// The calendar date ("YYYY-MM-DD") it currently is in `timeZone`.
export function localDateString(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ---------------------------------------------------------------------
// Shift resolution
// ---------------------------------------------------------------------

function workdaysFromNames(names?: string[]): number[] | undefined {
  if (!Array.isArray(names) || names.length === 0) return undefined;
  const nums = names.map((n) => DAY_NAMES.indexOf(n)).filter((n) => n >= 0);
  return nums.length ? nums : undefined;
}

export function companyTimezone(rules: PolicyRules | null | undefined): string {
  const tz = rules?.timezone;
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

// All shifts an employee can pick from. When the company hasn't defined any
// shift, there is a single built-in "Default office timing" shift.
export function listShifts(rules: PolicyRules | null | undefined): ResolvedShift[] {
  const configured = Array.isArray(rules?.shifts) ? rules!.shifts! : [];
  if (configured.length === 0) return [resolveShift(rules, DEFAULT_SHIFT_ID)];
  return configured.map((s) => resolveShift(rules, s.id));
}

// Never throws: an unknown/blank id resolves to the office default so a
// stale shiftId on an employee can't break punching.
export function resolveShift(
  rules: PolicyRules | null | undefined,
  shiftId?: string | null
): ResolvedShift {
  const configured = shiftId ? rules?.shifts?.find((s) => s.id === shiftId) : undefined;
  const companyDays = workdaysFromNames(rules?.workingDays) || DEFAULT_WORKDAYS;

  const timezone = configured?.timezone && isValidTimezone(configured.timezone)
    ? configured.timezone
    : companyTimezone(rules);

  const grace = Number(configured?.graceMinutes ?? rules?.graceMinutes ?? 15);

  return {
    id: configured ? configured.id : DEFAULT_SHIFT_ID,
    name: configured ? configured.name : "Default office timing",
    startTime: configured?.startTime || rules?.officeStartTime || "10:00",
    endTime: configured?.endTime || rules?.officeEndTime || "19:00",
    graceMinutes: Number.isFinite(grace) && grace >= 0 ? grace : 15,
    timezone,
    workdays: configured?.workdays?.length ? configured.workdays : companyDays,
  };
}

export function isOvernight(shift: Pick<ResolvedShift, "startTime" | "endTime">): boolean {
  return shift.endTime <= shift.startTime;
}

export type ShiftInstance = {
  date: string; // company-local date the shift STARTS on = the attendance date
  start: Date;
  end: Date;
  graceDeadline: Date;
};

export function shiftInstance(shift: ResolvedShift, dateStr: string): ShiftInstance {
  const start = zonedWallTimeToInstant(dateStr, shift.startTime, shift.timezone);
  const endDate = isOvernight(shift) ? addDays(dateStr, 1) : dateStr;
  const end = zonedWallTimeToInstant(endDate, shift.endTime, shift.timezone);
  return {
    date: dateStr,
    start,
    end,
    graceDeadline: new Date(start.getTime() + shift.graceMinutes * 60000),
  };
}

// Which shift occurrence does this punch belong to? Looks at the shift
// instances starting yesterday/today/tomorrow (company-local) so a 01:00
// punch on an overnight shift lands on the PREVIOUS day's instance.
export function findShiftInstanceForPunch(shift: ResolvedShift, punch: Date): ShiftInstance {
  const local = localDateString(punch, shift.timezone);
  const candidates = [addDays(local, -1), local, addDays(local, 1)].map((d) => shiftInstance(shift, d));

  const early = EARLY_PUNCH_MINUTES * 60000;
  const inWindow = candidates.filter(
    (c) => punch.getTime() >= c.start.getTime() - early && punch.getTime() <= c.end.getTime()
  );

  if (inWindow.length > 0) {
    return inWindow.reduce((best, c) =>
      Math.abs(c.start.getTime() - punch.getTime()) < Math.abs(best.start.getTime() - punch.getTime()) ? c : best
    );
  }
  // Outside every shift window (e.g. very late): still belongs to the
  // company-local calendar day it happened on.
  return candidates[1];
}

// ---------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------

export function getAbsentPolicy(rules: PolicyRules | null | undefined) {
  return {
    enabled: rules?.absentPolicy?.enabled !== false,
    effectiveFrom: rules?.absentPolicy?.effectiveFrom || ABSENT_POLICY_DEFAULT_EFFECTIVE_FROM,
  };
}

export type SkipReason =
  | "policy-disabled"
  | "policy-not-yet-effective"
  | "holiday"
  | "weekly-off"
  | "approved-leave";

export type PunchInEvaluation = {
  instance: ShiftInstance;
  status: "Present" | "Absent";
  policyApplied: boolean;
  skipReason?: SkipReason;
  reason: string;
  minutesAfterDeadline: number; // 0 when on time
};

export function evaluatePunchIn(input: {
  punch: Date;
  shift: ResolvedShift;
  rules?: PolicyRules | null;
  isHoliday?: boolean;
  onApprovedLeave?: boolean;
}): PunchInEvaluation {
  const { punch, shift, rules } = input;
  const instance = findShiftInstanceForPunch(shift, punch);
  const policy = getAbsentPolicy(rules);

  const base = { instance, minutesAfterDeadline: 0 };

  let skipReason: SkipReason | undefined;
  if (!policy.enabled) skipReason = "policy-disabled";
  else if (instance.date < policy.effectiveFrom) skipReason = "policy-not-yet-effective";
  else if (input.isHoliday) skipReason = "holiday";
  else if (input.onApprovedLeave) skipReason = "approved-leave";
  else if (!shift.workdays.includes(weekdayOf(instance.date))) skipReason = "weekly-off";

  if (skipReason) {
    return {
      ...base,
      status: "Present",
      policyApplied: false,
      skipReason,
      reason: `Grace-period rule not applied (${skipReason.replace(/-/g, " ")}).`,
    };
  }

  // Inclusive boundary: exactly at the deadline is on time.
  if (punch.getTime() <= instance.graceDeadline.getTime()) {
    return { ...base, status: "Present", policyApplied: true, reason: "Punched in within the grace period." };
  }

  const late = Math.ceil((punch.getTime() - instance.graceDeadline.getTime()) / 60000);
  return {
    ...base,
    status: "Absent",
    policyApplied: true,
    minutesAfterDeadline: late,
    reason: `Punched in after the grace deadline (${shift.startTime} + ${shift.graceMinutes} min).`,
  };
}

// ---------------------------------------------------------------------
// Punch-out
// ---------------------------------------------------------------------

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTotalHours(punchIn: Date, punchOut: Date): number {
  return round2((punchOut.getTime() - punchIn.getTime()) / 3600000);
}

// Overtime = time worked beyond (shift end + buffer), measured against the
// SAME shift instance the session started in, so overnight shifts work.
export function computeExtraHours(punchOut: Date, instanceEnd: Date, bufferMinutes: number): number {
  const cutoff = instanceEnd.getTime() + bufferMinutes * 60000;
  return punchOut.getTime() > cutoff ? round2((punchOut.getTime() - cutoff) / 3600000) : 0;
}

export type PunchOutCheck = { ok: true } | { ok: false; code: string; message: string };

export function validatePunchOut(punchIn: Date | null, existingPunchOut: unknown, now: Date): PunchOutCheck {
  if (!punchIn) return { ok: false, code: "no-session", message: "Please punch in first." };
  if (existingPunchOut) return { ok: false, code: "already-punched-out", message: "You have already punched out." };
  if (now.getTime() < punchIn.getTime()) {
    return { ok: false, code: "invalid-sequence", message: "Punch-out cannot be before punch-in." };
  }
  if ((now.getTime() - punchIn.getTime()) / 3600000 > MAX_SESSION_HOURS) {
    return {
      ok: false,
      code: "session-expired",
      message: `This session has been open more than ${MAX_SESSION_HOURS} hours. Please send a punch-out correction request to HR.`,
    };
  }
  return { ok: true };
}

// Is a session without a punch-out still legitimately in progress? Used so
// an overnight shift isn't flagged "Incomplete" the next calendar morning.
export function isSessionStillOpen(shiftEndAt: Date | null | undefined, now: Date): boolean {
  return !!shiftEndAt && now.getTime() <= shiftEndAt.getTime();
}
