// Payroll exports — summary (CSV / XLSX) and a ZIP of the issued payslips.
// Built ONLY from the approved, immutable snapshot of a finalized period, and
// every figure is checked against the approved run summary before it leaves
// the server. Requires payroll access; every export is audited (who, what,
// which period, how many rows — never the salary figures themselves).

import type { DocumentData } from "firebase-admin/firestore";
import type { EmployeeResult, PayrollSummary } from "../payroll/engine";
import { buildPayrollTable, toCsv, toXlsx, verifyAgainstSummary, type ExportMeta } from "../payroll/export";
import { normalizeComponents } from "../payroll/policy";
import { hashOf } from "../payroll/runState";
import { buildZip } from "../payroll/zip";
import { ApiError, adminDb, type VerifiedUser } from "./firebaseAdmin";
import { audit, getRunState, retainedPdf } from "./payrollActions";
import { actorWith, iso, loadRules, validatePeriod } from "./payrollData";

const FINAL = new Set(["approved", "payslips_generated"]);

async function finalizedRun(periodIn: unknown) {
  const period = validatePeriod(periodIn, await loadRules());
  const { state, data } = await getRunState(period);
  if (!state || !FINAL.has(state.status) || !data) {
    throw new ApiError(409, "conflict", "Exports are available only after the payroll for this month is approved.");
  }
  return { period, revision: state.revision, run: data };
}

async function approvedResults(period: string, revision: number): Promise<{ results: EmployeeResult[]; hashes: Map<string, string> }> {
  const snap = await adminDb().collection("payrollEntries").where("period", "==", period).get();
  const results: EmployeeResult[] = [];
  const hashes = new Map<string, string>();
  for (const d of snap.docs) {
    const x = d.data();
    if (Number(x.revision) !== revision || x.voided === true) continue;
    const r = x.result as EmployeeResult;
    // the stored snapshot must still match its fingerprint
    if (hashOf(r) !== x.entryHash) throw new ApiError(409, "integrity", "A saved payroll record failed its integrity check. Nothing was exported.");
    results.push(r);
    hashes.set(r.uid, x.entryHash);
  }
  return { results, hashes };
}

function metaOf(run: DocumentData, period: string, revision: number): ExportMeta {
  return {
    companyName: String(run.companyName || "Omtatva Digitals"), period, revision,
    approvedAt: iso(run.approvedAt), approvedBy: run.approvedBy || null, digest: String(run.digest || ""),
    components: normalizeComponents(run.policy?.components),
  };
}

export async function exportPayroll(user: VerifiedUser, periodIn: unknown, formatIn: unknown) {
  const actor = await actorWith(user, "payroll", "view");
  const format = formatIn === "xlsx" ? "xlsx" : formatIn === "csv" ? "csv" : null;
  if (!format) throw new ApiError(400, "bad-request", "Choose csv or xlsx.");
  const { period, revision, run } = await finalizedRun(periodIn);
  const { results } = await approvedResults(period, revision);
  const summary = run.summary as PayrollSummary;
  const meta = metaOf(run, period, revision);
  const table = buildPayrollTable(results, meta.components);

  // The export must equal the approved record. If it does not, refuse.
  const problems = verifyAgainstSummary(table, summary);
  if (problems.length) {
    console.error("Payroll export totals mismatch", period, problems);
    throw new ApiError(409, "integrity", "The export does not match the approved payroll totals, so it was not produced. Contact support.");
  }
  await audit(actor, "export", period, { format, revision, rows: table.rows.length }, `Payroll summary ${period} exported as ${format.toUpperCase()} (${table.rows.length} employees).`);

  const base = `Payroll_${period}_r${revision}`;
  return format === "csv"
    ? { bytes: new TextEncoder().encode(toCsv(table, meta)), filename: `${base}.csv`, contentType: "text/csv; charset=utf-8" }
    : { bytes: toXlsx(table, meta, summary), filename: `${base}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}

export async function exportPayslipsZip(user: VerifiedUser, periodIn: unknown) {
  const actor = await actorWith(user, "payroll", "view");
  const { period, revision, run } = await finalizedRun(periodIn);
  if (run.status !== "payslips_generated") throw new ApiError(409, "conflict", "Generate the payslips first.");
  const slips = await adminDb().collection("payslips").where("period", "==", period).get();
  const files: { name: string; data: Uint8Array }[] = [];
  for (const d of slips.docs.sort((a, b) => String(a.data().employeeId).localeCompare(String(b.data().employeeId), undefined, { numeric: true }))) {
    const p = d.data();
    if (Number(p.revision) !== revision || p.status !== "issued") continue;
    const entry = await adminDb().doc(`payrollEntries/${p.entryId}`).get();
    if (!entry.exists || hashOf(entry.data()!.result) !== p.entryHash) throw new ApiError(409, "integrity", "A payslip failed its integrity check. Nothing was exported.");
    files.push({ name: `Payslip_${p.employeeId}_${period}.pdf`, data: await retainedPdf(d.id, p, entry.data()!.result as EmployeeResult) });
  }
  if (files.length === 0) throw new ApiError(409, "conflict", "There are no issued payslips for this month.");
  await audit(actor, "export", period, { format: "zip", revision, files: files.length }, `Payslips ${period} downloaded as ZIP (${files.length} PDFs).`);
  return { bytes: buildZip(files), filename: `Payslips_${period}_r${revision}.zip`, contentType: "application/zip" };
}
