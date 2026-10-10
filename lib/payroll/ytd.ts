// Year-to-date totals for the payslip (what large companies show beside the
// current month). Built ONLY from approved payroll snapshots; a voided or
// superseded revision never counts, and each month is counted once.

import type { EmployeeResult } from "./engine";

export const FISCAL_YEAR_START_MONTH = 4; // April (India)

export function fiscalYearStart(period: string, startMonth = FISCAL_YEAR_START_MONTH): string {
  const [y, m] = period.split("-").map(Number);
  const startYear = m >= startMonth ? y : y - 1;
  return `${startYear}-${String(startMonth).padStart(2, "0")}`;
}

export function fiscalYearLabel(period: string, startMonth = FISCAL_YEAR_START_MONTH): string {
  const startYear = Number(fiscalYearStart(period, startMonth).slice(0, 4));
  return startMonth === 1 ? String(startYear) : `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

type Slim = Pick<
  EmployeeResult,
  "uid" | "earnings" | "deductions" | "grossEarnings" | "attendanceDeduction" | "leaveDeduction" | "notEmployedDeduction" | "totalDeductions" | "netPay"
>;

export type YtdInput = { period: string; revision: number; voided?: boolean; result: Slim };

export type Ytd = {
  fiscalYear: string;
  throughPeriod: string;
  months: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  absence: number;
  leave: number;
  prorata: number;
  gross: number;
  totalDeductions: number;
  net: number;
};

const c = (n: number) => Math.round(n * 100);

export function buildYtd(entries: YtdInput[], uid: string, period: string, startMonth = FISCAL_YEAR_START_MONTH): Ytd {
  const from = fiscalYearStart(period, startMonth);
  // newest non-voided revision per month, for this employee, inside the fiscal year up to and including `period`
  const latest = new Map<string, YtdInput>();
  for (const e of entries) {
    if (e.voided || e.result.uid !== uid || e.period < from || e.period > period) continue;
    const have = latest.get(e.period);
    if (!have || e.revision > have.revision) latest.set(e.period, e);
  }
  const earnings: Record<string, number> = {};
  const deductions: Record<string, number> = {};
  let absence = 0, leave = 0, prorata = 0, gross = 0, ded = 0, net = 0;
  for (const e of latest.values()) {
    for (const l of e.result.earnings) earnings[l.key] = (earnings[l.key] || 0) + c(l.amount);
    for (const l of e.result.deductions) deductions[l.key] = (deductions[l.key] || 0) + c(l.amount);
    absence += c(e.result.attendanceDeduction);
    leave += c(e.result.leaveDeduction);
    prorata += c(e.result.notEmployedDeduction);
    gross += c(e.result.grossEarnings);
    ded += c(e.result.totalDeductions);
    net += c(e.result.netPay);
  }
  const money = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / 100]));
  return {
    fiscalYear: fiscalYearLabel(period, startMonth),
    throughPeriod: period,
    months: latest.size,
    earnings: money(earnings),
    deductions: money(deductions),
    absence: absence / 100,
    leave: leave / 100,
    prorata: prorata / 100,
    gross: gross / 100,
    totalDeductions: ded / 100,
    net: net / 100,
  };
}
