// TDS (tax deducted at source) by percentage.
//
// Many employers deduct a flat percentage (for example 10% where people are
// treated as contractual / professional-fee payees). This is a flat-rate
// calculation set in the payroll policy — it is NOT an individual income-tax
// (slab) computation and does not use PAN, regime or declarations.

export type TdsMode = "fixed" | "percent";
export type TdsBase = "earned" | "gross";

export type TdsPolicy = {
  mode: TdsMode; // fixed = the monthly TDS amount saved on each salary structure (as before)
  percent: number; // used when mode = "percent" (0–50)
  base: TdsBase; // earned = gross less loss of pay and pro-rata (what is actually payable) | gross = full monthly gross
};

export const DEFAULT_TDS: TdsPolicy = { mode: "fixed", percent: 10, base: "earned" };

export const MAX_TDS_PERCENT = 50;

export function calculateTds(
  tds: TdsPolicy,
  parts: { gross: number; lopDeduction: number; proration: number },
  rounding: "rupee" | "paisa"
): { amount: number; base: number } {
  if (tds.mode !== "percent" || !(tds.percent > 0)) return { amount: 0, base: 0 };
  const earned = Math.max(parts.gross - parts.lopDeduction - parts.proration, 0);
  const base = tds.base === "gross" ? parts.gross : earned;
  const raw = (base * tds.percent) / 100;
  const amount = rounding === "rupee" ? Math.round(raw + 1e-9) : Math.round(raw * 100 + 1e-9) / 100;
  return { amount, base: Math.round(base * 100) / 100 };
}

export function describeTds(tds: TdsPolicy): string {
  if (tds.mode !== "percent") return "TDS is the fixed monthly amount saved on each employee's salary structure";
  return `TDS is ${tds.percent}% of ${tds.base === "gross" ? "gross salary" : "earned salary (gross less loss of pay and pro-rata)"}, for every employee`;
}
