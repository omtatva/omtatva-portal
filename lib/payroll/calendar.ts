// Date helpers for payroll. Every date is a plain "YYYY-MM-DD" string in the
// company's local calendar — the same form attendance, holidays and leave use
// — and all arithmetic is done in UTC on that string, so the browser/server
// timezone can never move a day across a month boundary.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function daysInMonth(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(period: string): string[] {
  const n = daysInMonth(period);
  return Array.from({ length: n }, (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`);
}

export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
}

export function addDay(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export const monthOf = (date: string): string => date.slice(0, 7);

export function prevMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function monthIndex(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return y * 12 + (m - 1);
}

// Leave year a date belongs to, labelled by the calendar year it STARTS in.
export function leaveYearOf(date: string, startMonth: number): number {
  const [y, m] = date.split("-").map(Number);
  return m >= startMonth ? y : y - 1;
}
