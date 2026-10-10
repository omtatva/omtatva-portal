// Bulk "set punch-in AND punch-out" — for days that are marked Present but have
// no punch times (or only one of them). Pure rules shared by the dialog (the
// preview) and the server (the real value: it recomputes every time itself and
// never trusts the browser).
//
// One rule per side is applied to every selected record:
//   punch-in   shift start (each record's own shift) | one fixed clock time
//   punch-out  shift end | one fixed clock time | punch-in + N hours   (see bulkPunchOut.ts)
//
// Safety: only records whose status is Present (or Late / Incomplete) are
// touched, a punch time that already exists is KEPT (never overwritten), and a
// computed time is rejected unless punch-out is after punch-in, within one
// session length and not in the future. Each record is still corrected and
// audited on its own; the reason, the "I verified this" tick, a verified backup
// and a typed confirmation are all required.

import { shiftInstance, zonedWallTimeToInstant, MAX_SESSION_HOURS, type ResolvedShift } from "./attendancePolicy";
import { MIN_REASON_LENGTH } from "./attendanceCorrection";
import { MAX_BULK_ITEMS, MAX_BULK_TOTAL, confirmPhrase } from "./bulkCorrection";
import { computePunchOut, validateParams, type PunchOutParams } from "./bulkPunchOut";

export type PunchInMode = "shift-start" | "fixed-time";

export type PunchTimesParams = PunchOutParams & { inMode: PunchInMode; inTime?: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Statuses for which "worked from … to …" makes sense.
export const PUNCHABLE_STATUSES = new Set(["Present", "Late", "Incomplete", ""]);

export function validateTimesParams(p: PunchTimesParams): string | null {
  if (p.inMode !== "shift-start" && p.inMode !== "fixed-time") return "Choose how the punch-in time is set.";
  if (p.inMode === "fixed-time" && !(p.inTime && TIME_RE.test(p.inTime))) return "Enter a valid punch-in time (HH:MM).";
  return validateParams(p);
}

export type PunchTimesComputation =
  | { ok: true; punchIn: Date; punchOut: Date; setIn: boolean; setOut: boolean }
  | { ok: false; reason: string };

export function computePunchTimes(input: {
  params: PunchTimesParams;
  date: string;
  status: string;
  punchIn: Date | null; // existing
  punchOut: Date | null; // existing
  shiftEndAt: Date | null;
  shift: ResolvedShift;
  now: Date;
}): PunchTimesComputation {
  const { params, date, now } = input;
  if (!PUNCHABLE_STATUSES.has(input.status || "")) {
    return { ok: false, reason: `Status is ${input.status} — set the status to Present first, then the times.` };
  }
  if (input.punchIn && input.punchOut) return { ok: false, reason: "Already has both punch-in and punch-out." };
  const bad = validateTimesParams(params);
  if (bad) return { ok: false, reason: bad };

  // ---- punch-in: keep an existing one, otherwise compute
  let inAt = input.punchIn;
  const setIn = !inAt;
  if (!inAt) {
    inAt = params.inMode === "shift-start" ? shiftInstance(input.shift, date).start : zonedWallTimeToInstant(date, params.inTime as string, input.shift.timezone);
    if (inAt.getTime() > now.getTime()) return { ok: false, reason: "The punch-in time is in the future." };
  }

  // ---- punch-out: keep an existing one, otherwise compute from the punch-in
  if (input.punchOut) {
    const out = input.punchOut;
    if (out.getTime() <= inAt.getTime()) return { ok: false, reason: "The calculated punch-in is not before the existing punch-out." };
    if ((out.getTime() - inAt.getTime()) / 3600000 > MAX_SESSION_HOURS) return { ok: false, reason: `That would be more than ${MAX_SESSION_HOURS} hours before the punch-out.` };
    return { ok: true, punchIn: inAt, punchOut: out, setIn, setOut: false };
  }
  const out = computePunchOut({ params, date, punchIn: inAt, shiftEndAt: input.shiftEndAt, shift: input.shift, now });
  if (!out.ok) return out;
  return { ok: true, punchIn: inAt, punchOut: out.at, setIn, setOut: true };
}

// ------------------------------------------------------------------ request
export type BulkPunchTimesRequest = PunchTimesParams & {
  items: { recordId: string }[];
  reason: string;
  confirmVerified?: boolean;
  confirm?: string;
  batchTotal?: number;
  batchId?: string;
};

export function validateBulkPunchTimes(req: BulkPunchTimesRequest): string[] {
  const errors: string[] = [];
  const items = Array.isArray(req.items) ? req.items : [];

  if (items.length === 0) errors.push("Select at least one record.");
  else if (items.length > MAX_BULK_ITEMS) errors.push(`At most ${MAX_BULK_ITEMS} records per request.`);
  if (items.some((i) => !i || typeof i.recordId !== "string" || !i.recordId)) errors.push("Every item needs a record id.");
  if (new Set(items.map((i) => i?.recordId)).size !== items.length) errors.push("The same record was selected twice.");

  const bad = validateTimesParams(req);
  if (bad) errors.push(bad);

  if (typeof req.reason !== "string" || req.reason.trim().length < MIN_REASON_LENGTH) {
    errors.push(`A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
  }
  // Setting punch times asserts the person really worked those hours.
  if (req.confirmVerified !== true) errors.push("You must confirm you have verified that these people worked these times.");

  const total = Number(req.batchTotal);
  if (!Number.isInteger(total) || total < items.length || total > MAX_BULK_TOTAL) errors.push("Invalid batch size.");
  else if (req.confirm !== confirmPhrase(total)) errors.push(`Type exactly "${confirmPhrase(total)}" to confirm.`);

  return errors;
}
