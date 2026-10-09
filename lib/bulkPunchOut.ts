// Bulk "set punch-out" for records that have a punch-in but no punch-out.
// Pure rules shared by the dialog (preview) and the server (the real value —
// the server recomputes every time itself and never trusts the browser).
//
// One rule is applied to every selected record:
//   shift-end       each record's own shift end (its saved shift, incl. overnight)
//   fixed-time      the same clock time (company timezone) on each record's day;
//                   if that is not after the punch-in it means the NEXT day
//                   (night shifts)
//   hours-after-in  punch-in + N hours
//
// A computed time is rejected (record skipped, reported) unless it is after the
// punch-in, within one session length (24 h) and not in the future.

import { addDays, shiftInstance, zonedWallTimeToInstant, MAX_SESSION_HOURS, type ResolvedShift } from "./attendancePolicy";
import { MIN_REASON_LENGTH } from "./attendanceCorrection";
import { MAX_BULK_ITEMS, MAX_BULK_TOTAL, confirmPhrase } from "./bulkCorrection";

export type PunchOutMode = "shift-end" | "fixed-time" | "hours-after-in";

export type PunchOutParams = { mode: PunchOutMode; time?: string; hours?: number };

export type PunchOutComputation = { ok: true; at: Date } | { ok: false; reason: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateParams(p: PunchOutParams): string | null {
  if (p.mode === "shift-end") return null;
  if (p.mode === "fixed-time") return p.time && TIME_RE.test(p.time) ? null : "Enter a valid time (HH:MM).";
  if (p.mode === "hours-after-in") {
    return typeof p.hours === "number" && Number.isFinite(p.hours) && p.hours > 0 && p.hours <= MAX_SESSION_HOURS
      ? null
      : `Hours must be more than 0 and at most ${MAX_SESSION_HOURS}.`;
  }
  return "Choose how the punch-out time is set.";
}

export function computePunchOut(input: {
  params: PunchOutParams;
  date: string; // attendance date (company-local)
  punchIn: Date | null;
  shiftEndAt: Date | null; // saved on records written by the server
  shift: ResolvedShift; // fallback for older records
  now: Date;
}): PunchOutComputation {
  const { params, date, punchIn, now } = input;
  if (!punchIn) return { ok: false, reason: "No punch-in on this record." };

  let at: Date;
  if (params.mode === "shift-end") {
    at = input.shiftEndAt ?? shiftInstance(input.shift, date).end;
  } else if (params.mode === "fixed-time") {
    const bad = validateParams(params);
    if (bad) return { ok: false, reason: bad };
    at = zonedWallTimeToInstant(date, params.time as string, input.shift.timezone);
    if (at.getTime() <= punchIn.getTime()) at = zonedWallTimeToInstant(addDays(date, 1), params.time as string, input.shift.timezone);
  } else if (params.mode === "hours-after-in") {
    const bad = validateParams(params);
    if (bad) return { ok: false, reason: bad };
    at = new Date(punchIn.getTime() + (params.hours as number) * 3600000);
  } else {
    return { ok: false, reason: "Unknown method." };
  }

  if (at.getTime() <= punchIn.getTime()) return { ok: false, reason: "The calculated punch-out is not after the punch-in." };
  if ((at.getTime() - punchIn.getTime()) / 3600000 > MAX_SESSION_HOURS) {
    return { ok: false, reason: `That would be more than ${MAX_SESSION_HOURS} hours after punch-in.` };
  }
  if (at.getTime() > now.getTime()) return { ok: false, reason: "That time is in the future." };
  return { ok: true, at };
}

// ------------------------------------------------------------------ request
export type BulkPunchOutRequest = PunchOutParams & {
  items: { recordId: string }[];
  reason: string;
  confirmVerified?: boolean;
  confirm?: string;
  batchTotal?: number;
  batchId?: string;
};

export function validateBulkPunchOut(req: BulkPunchOutRequest): string[] {
  const errors: string[] = [];
  const items = Array.isArray(req.items) ? req.items : [];

  if (items.length === 0) errors.push("Select at least one record.");
  else if (items.length > MAX_BULK_ITEMS) errors.push(`At most ${MAX_BULK_ITEMS} records per request.`);
  if (items.some((i) => !i || typeof i.recordId !== "string" || !i.recordId)) errors.push("Every item needs a record id.");
  if (new Set(items.map((i) => i?.recordId)).size !== items.length) errors.push("The same record was selected twice.");

  const bad = validateParams(req);
  if (bad) errors.push(bad);

  if (typeof req.reason !== "string" || req.reason.trim().length < MIN_REASON_LENGTH) {
    errors.push(`A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
  }
  // Setting a punch-out asserts that the person worked until then.
  if (req.confirmVerified !== true) errors.push("You must confirm you have verified these punch-out times.");

  const total = Number(req.batchTotal);
  if (!Number.isInteger(total) || total < items.length || total > MAX_BULK_TOTAL) errors.push("Invalid batch size.");
  else if (req.confirm !== confirmPhrase(total)) errors.push(`Type exactly "${confirmPhrase(total)}" to confirm.`);

  return errors;
}
