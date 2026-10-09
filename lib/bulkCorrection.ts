// Bulk attendance corrections — pure rules shared by the dialog (browser) and
// the server route. A bulk run is NOT one big write: every record is
// corrected through the same audited single-record path (its own correction
// document with the original and new values, who, when and why). Bulk only
// saves the clicking.

import { CORRECTION_STATUSES, MIN_REASON_LENGTH } from "./attendanceCorrection";

export const MAX_BULK_ITEMS = 200; // per request; the browser sends several requests for more
export const MAX_BULK_TOTAL = 2000; // per bulk run

// Either an existing record, or a day with no record yet for an employee.
export type BulkItem = { recordId?: string; userId?: string; date?: string };

export type BulkRequest = {
  items: BulkItem[];
  status: string;
  reason: string;
  confirmVerified?: boolean;
  // Typed by the administrator: APPLY <total> CORRECTIONS
  confirm?: string;
  // Total for the whole bulk run (a run may be split over several requests).
  batchTotal?: number;
  batchId?: string;
};

export const confirmPhrase = (total: number) => `APPLY ${total} CORRECTIONS`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateBulk(req: BulkRequest): string[] {
  const errors: string[] = [];

  if (!Array.isArray(req.items) || req.items.length === 0) errors.push("Select at least one record.");
  else if (req.items.length > MAX_BULK_ITEMS) errors.push(`At most ${MAX_BULK_ITEMS} records per request.`);

  const items = Array.isArray(req.items) ? req.items : [];
  const seen = new Set<string>();
  for (const it of items) {
    const isUpdate = !!it.recordId;
    const isCreate = !!it.userId && !!it.date && DATE_RE.test(String(it.date));
    if (!isUpdate && !isCreate) {
      errors.push("Every item needs either a record id, or an employee and a valid date.");
      break;
    }
    const key = isUpdate ? `r:${it.recordId}` : `c:${it.userId}|${it.date}`;
    if (seen.has(key)) {
      errors.push("The same record or day was selected twice.");
      break;
    }
    seen.add(key);
  }

  if (!(CORRECTION_STATUSES as readonly string[]).includes(req.status)) {
    errors.push(`Status must be one of: ${CORRECTION_STATUSES.join(", ")}.`);
  }
  if (typeof req.reason !== "string" || req.reason.trim().length < MIN_REASON_LENGTH) {
    errors.push(`A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
  }
  if (req.status === "Present" && req.confirmVerified !== true) {
    errors.push("To mark people Present you must confirm you have verified their attendance.");
  }

  const total = Number(req.batchTotal);
  if (!Number.isInteger(total) || total < items.length || total > MAX_BULK_TOTAL) {
    errors.push("Invalid batch size.");
  } else if (req.confirm !== confirmPhrase(total)) {
    errors.push(`Type exactly "${confirmPhrase(total)}" to confirm.`);
  }

  return errors;
}

export type Selectable = { type: string; recordId: string; userId: string; date: string; proposedStatus: string | null };

// Audit finding -> the item a bulk run would correct (null = can't be bulk-corrected).
export function toBulkItem(f: Selectable): BulkItem | null {
  if (f.type === "duplicate-records" || f.type === "invalid-date" || f.type === "orphan-record") return null;
  if (f.recordId && !f.recordId.includes("+")) return { recordId: f.recordId };
  if (f.type === "missing-record" && f.userId && f.date) return { userId: f.userId, date: f.date };
  return null;
}

// "Apply suggested fix": group the selected findings by the status the audit
// proposes, skipping the ones with no proposal.
export function groupBySuggestion(findings: Selectable[]): { status: string; items: BulkItem[]; skippedNoSuggestion: number } [] {
  const groups = new Map<string, BulkItem[]>();
  let skipped = 0;
  for (const f of findings) {
    const item = toBulkItem(f);
    if (!item || !f.proposedStatus) {
      skipped++;
      continue;
    }
    groups.set(f.proposedStatus, [...(groups.get(f.proposedStatus) || []), item]);
  }
  return [...groups].map(([status, items]) => ({ status, items, skippedNoSuggestion: skipped }));
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type BulkOutcome = "updated" | "created" | "skipped" | "failed";
export type BulkResult = { updated: number; created: number; skipped: number; failed: number; errors: { item: BulkItem; message: string }[] };

export const emptyResult = (): BulkResult => ({ updated: 0, created: 0, skipped: 0, failed: 0, errors: [] });

export function mergeResults(a: BulkResult, b: BulkResult): BulkResult {
  return {
    updated: a.updated + b.updated,
    created: a.created + b.created,
    skipped: a.skipped + b.skipped,
    failed: a.failed + b.failed,
    errors: [...a.errors, ...b.errors].slice(0, 100),
  };
}
