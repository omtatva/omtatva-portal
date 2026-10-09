// Rules for administrator corrections to attendance — pure functions shared
// by the correction form (browser) and the server route that actually
// writes. A correction never deletes a record, never rewrites history
// silently, and always needs a written reason.

import { normalizeRole, type RoleValue } from "./roles";
import { computeTotalHours, round2 } from "./attendancePolicy";

export const CORRECTION_STATUSES = ["Present", "Absent", "Leave", "Holiday", "Weekly Off"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const MIN_REASON_LENGTH = 10;

// A record is "historical" once its month has finished (company-local
// dates, "YYYY-MM-DD"). Historical corrections need a Super Admin and a
// verified, fresh backup.
export function isCompletedMonthDate(date: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < `${today.slice(0, 7)}-01`;
}

export type CorrectionKind = "update" | "create" | "revert";

export type CorrectionRequest = {
  kind: CorrectionKind;
  reason: string;
  // update / revert
  recordId?: string;
  correctionId?: string;
  // create (for a day with no record at all)
  userId?: string;
  date?: string;
  changes?: {
    status?: string;
    punchIn?: string | null; // ISO timestamp
    punchOut?: string | null;
  };
  // The administrator states they have verified the facts (required before
  // anything is turned into Present).
  confirmVerified?: boolean;
};

export type RecordValues = {
  status: string;
  punchIn: Date | null;
  punchOut: Date | null;
  totalHours: number;
};

export type FieldChange = { field: "status" | "PunchIn" | "PunchOut" | "totalHours"; from: unknown; to: unknown };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIso(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export type Validation = { ok: true } | { ok: false; errors: string[] };

export function validateCorrection(req: CorrectionRequest, ctx: { today: string }): Validation {
  const errors: string[] = [];

  if (!["update", "create", "revert"].includes(req.kind)) errors.push("Unknown correction type.");
  if (typeof req.reason !== "string" || req.reason.trim().length < MIN_REASON_LENGTH) {
    errors.push(`A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
  }

  if (req.kind === "revert") {
    if (!req.correctionId) errors.push("Choose which correction to revert.");
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  if (req.kind === "update" && !req.recordId) errors.push("Choose the attendance record to correct.");

  if (req.kind === "create") {
    if (!req.userId) errors.push("Choose the employee.");
    if (!req.date || !DATE_RE.test(req.date)) errors.push("A valid date (YYYY-MM-DD) is required.");
    else if (req.date > ctx.today) errors.push("Corrections cannot be made for a future date.");
  }

  const c = req.changes || {};
  if (c.status !== undefined && !(CORRECTION_STATUSES as readonly string[]).includes(c.status)) {
    errors.push(`Status must be one of: ${CORRECTION_STATUSES.join(", ")}.`);
  }

  const pin = c.punchIn === undefined ? undefined : parseIso(c.punchIn);
  const pout = c.punchOut === undefined ? undefined : parseIso(c.punchOut);
  if (c.punchIn !== undefined && pin === undefined) errors.push("Punch-in time is not a valid date/time.");
  if (c.punchOut !== undefined && pout === undefined) errors.push("Punch-out time is not a valid date/time.");
  if (pin && pout && pout.getTime() <= pin.getTime()) errors.push("Punch-out must be after punch-in.");

  if (req.kind === "create" && !c.status) errors.push("Choose the status for the new record.");
  if (req.kind === "update" && c.status === undefined && c.punchIn === undefined && c.punchOut === undefined) {
    errors.push("Nothing to change.");
  }

  const makesPresent = c.status === "Present" || (req.kind === "create" && !!pin);
  if (makesPresent && req.confirmVerified !== true) {
    errors.push("To mark someone Present you must confirm you have verified their attendance.");
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

// Compares the stored values with the requested ones and returns only real
// differences (plus a recalculated totalHours when punch times change).
export function diffChanges(before: RecordValues, changes: NonNullable<CorrectionRequest["changes"]>): {
  after: RecordValues;
  list: FieldChange[];
} {
  const after: RecordValues = { ...before };
  const list: FieldChange[] = [];
  const same = (a: Date | null, b: Date | null) => (a ? a.getTime() : null) === (b ? b.getTime() : null);

  if (changes.status !== undefined && changes.status !== before.status) {
    after.status = changes.status;
    list.push({ field: "status", from: before.status || null, to: changes.status });
  }

  if (changes.punchIn !== undefined) {
    const next = parseIso(changes.punchIn) ?? null;
    if (!same(next, before.punchIn)) {
      after.punchIn = next;
      list.push({ field: "PunchIn", from: before.punchIn?.toISOString() ?? null, to: next?.toISOString() ?? null });
    }
  }

  if (changes.punchOut !== undefined) {
    const next = parseIso(changes.punchOut) ?? null;
    if (!same(next, before.punchOut)) {
      after.punchOut = next;
      list.push({ field: "PunchOut", from: before.punchOut?.toISOString() ?? null, to: next?.toISOString() ?? null });
    }
  }

  if (after.punchIn && after.punchOut && (list.some((c) => c.field === "PunchIn" || c.field === "PunchOut"))) {
    const hours = computeTotalHours(after.punchIn, after.punchOut);
    if (round2(hours) !== round2(before.totalHours)) {
      after.totalHours = hours;
      list.push({ field: "totalHours", from: before.totalHours, to: hours });
    }
  }

  return { after, list };
}

// A revert is only safe if nobody has changed the record since the
// correction being undone.
export function canRevert(
  current: RecordValues,
  correctionAfter: { status?: string; PunchIn?: string | null; PunchOut?: string | null }
): { ok: true } | { ok: false; reason: string } {
  const t = (d: Date | null) => (d ? d.toISOString() : null);
  if (
    (correctionAfter.status ?? current.status) !== current.status ||
    (correctionAfter.PunchIn ?? null) !== t(current.punchIn) ||
    (correctionAfter.PunchOut ?? null) !== t(current.punchOut)
  ) {
    return {
      ok: false,
      reason: "This record has been changed again since that correction, so it cannot be reverted automatically.",
    };
  }
  return { ok: true };
}

// ---- who may correct ---------------------------------------------------

type Matrix = Record<string, Partial<Record<string, "view" | "edit">>> | undefined;

// Mirrors lib/permissions.ts: Super Admin can always edit; HR defaults to
// view-only outside Employee Management/Documents; others default to edit.
// The Settings -> Access Management matrix overrides the defaults.
export function canEditAttendance(roleRaw: string | null | undefined, matrix: Matrix): boolean {
  const role: RoleValue = normalizeRole(roleRaw);
  if (role === "super_admin") return true;
  if (role === "employee") return false;
  const saved = matrix?.[role]?.attendance;
  return (saved ?? (role === "hr" ? "view" : "edit")) === "edit";
}
