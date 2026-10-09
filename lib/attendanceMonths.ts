// Monthly archive: which months can be reported on, derived from the
// CURRENT DATE (company timezone) — so a month appears in the archive the
// moment it ends, with no code change or redeploy.
//
//  * "completed"   — the month is over (its last day is before today)
//  * "in-progress" — the current month; shown, but flagged as not final
//  * future months are never listed.

import { addDays, companyTimezone, localDateString, type PolicyRules } from "./attendancePolicy";

// First month the portal reports on.
export const ARCHIVE_START_MONTH = "2026-07";

export type ArchiveMonth = {
  key: string; // "2026-08"
  label: string; // "August 2026"
  from: string; // "2026-08-01"
  to: string; // "2026-08-31"
  status: "completed" | "in-progress";
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string): boolean {
  return KEY_RE.test(value);
}

export function monthBounds(key: string): { from: string; to: string; label: string } {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid month key: ${key}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const from = `${m[1]}-${m[2]}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { from, to: addDays(next, -1), label: `${MONTH_NAMES[month - 1]} ${year}` };
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function availableMonths(
  now: Date,
  rules: Pick<PolicyRules, "timezone"> | null | undefined,
  startKey: string = ARCHIVE_START_MONTH
): ArchiveMonth[] {
  const today = localDateString(now, companyTimezone(rules as PolicyRules));
  const currentKey = today.slice(0, 7);
  const out: ArchiveMonth[] = [];

  for (let key = startKey; key <= currentKey && out.length < 240; key = nextMonthKey(key)) {
    const b = monthBounds(key);
    out.push({
      key,
      label: b.label,
      from: b.from,
      to: b.to,
      status: b.to < today ? "completed" : "in-progress",
    });
  }
  return out;
}

// A requested month is valid only if it is in the archive right now
// (i.e. not in the future and not before the archive start).
export function findArchiveMonth(
  key: string,
  now: Date,
  rules: Pick<PolicyRules, "timezone"> | null | undefined
): ArchiveMonth | null {
  if (!isMonthKey(key)) return null;
  return availableMonths(now, rules).find((m) => m.key === key) || null;
}
