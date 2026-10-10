// Payroll server — every operation that WRITES. Each one re-checks the
// caller's role on the server, recomputes from source data (never trusts
// numbers sent by the browser), writes an audit event, and takes a backup
// first when it changes or replaces existing records.

import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { describePolicy, resolvePolicy, type PayrollPolicy } from "../payroll/policy";
import { canOpenPayslip, can } from "../payroll/access";
import { maskAccount, renderPayslip, type PayslipMeta } from "../payroll/payslipPdf";
import { buildYtd, fiscalYearStart, type YtdInput } from "../payroll/ytd";
import {
  RunConflict, canEditDecisions, entryId, hashOf, planApprove, planGenerate, planPayslips, planReverse, sha256,
  type RunState,
} from "../payroll/runState";
import { MAX_SHEET_COLUMNS, MAX_SHEET_ROWS, previewSheet, type SheetPreview, type SheetRow } from "../payroll/salarySheet";
import type { EmployeeResult } from "../payroll/engine";
import { ApiError, adminDb } from "./firebaseAdmin";
import { rebuildPayslipIndex } from "./payslipIndex";
import {
  actorWith, companyAddress, companyName, computeRun, iso, loadDecisions, loadPolicy, loadRules, loadStructures, loadUsers,
  memberFor, superAdminActor, validatePeriod, valuesFromDoc, type Actor,
} from "./payrollData";
import type { VerifiedUser } from "./firebaseAdmin";

const db = () => adminDb();
const reason = (v: unknown, min = 5): string => {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min) throw new ApiError(400, "bad-request", `Please give a reason (at least ${min} characters).`);
  return s.slice(0, 300);
};
const conflict = (e: unknown): never => {
  if (e instanceof RunConflict) throw new ApiError(409, "conflict", e.message);
  throw e;
};

// ------------------------------------------------------------------- audit
export async function audit(actor: Actor, type: string, period: string | null, details: Record<string, unknown>, summary: string) {
  const now = Timestamp.now();
  await db().collection("payrollAudit").add({
    type, period, by: actor.email, byUid: actor.uid, role: actor.role, at: now, details: JSON.parse(JSON.stringify(details)),
  });
  try {
    await db().collection("activityLogs").add({
      employeeName: "", employeeEmail: "", uid: "", activity: `Payroll: ${type}`, module: "Payroll", type: "Payroll",
      description: summary.slice(0, 300), updatedBy: actor.email, updatedByUid: actor.uid, createdAt: now,
    });
  } catch (error) {
    console.warn("Payroll activity log failed:", error);
  }
}

// Copy records into a server-only backup BEFORE they are changed.
async function writeBackup(actor: Actor, kind: string, label: string, items: { path: string; data: DocumentData }[]): Promise<string> {
  const ref = db().collection("payrollBackups").doc();
  await ref.set({
    kind, label, count: items.length, sha256: hashOf(items.map((i) => [i.path, i.data])),
    createdBy: actor.email, createdByUid: actor.uid, createdAt: Timestamp.now(),
  });
  for (let i = 0; i < items.length; i += 400) {
    const batch = db().batch();
    items.slice(i, i + 400).forEach((it, j) => batch.set(ref.collection("items").doc(String(i + j).padStart(5, "0")), { path: it.path, data: it.data }));
    await batch.commit();
  }
  return ref.id;
}

export async function getRunState(period: string): Promise<{ state: RunState | null; data: DocumentData | null }> {
  const snap = await db().doc(`payrollRuns/${period}`).get();
  if (!snap.exists) return { state: null, data: null };
  const d = snap.data()!;
  return {
    state: { period, status: d.status, revision: Number(d.revision || 1), approvingSinceMs: d.approvingSince instanceof Timestamp ? d.approvingSince.toMillis() : null },
    data: d,
  };
}

// ------------------------------------------------------------------ policy
export async function getPolicy(user: VerifiedUser) {
  await actorWith(user, "payroll", "view");
  return { policy: await loadPolicy(), explanation: describePolicy(await loadPolicy()) };
}

export async function savePolicy(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await superAdminActor(user);
  // JSON round-trip: the stored document must be plain data (no undefined values — Firestore rejects them)
  const policy: PayrollPolicy = JSON.parse(JSON.stringify(resolvePolicy({ ...(body.policy as object), confirmed: body.confirm === true })));
  const now = Timestamp.now();

  // Removing a salary component stops it being paid / deducted from now on. If
  // employees still have an amount saved for it, that is a real change to their
  // pay — so it must be acknowledged explicitly (the amounts themselves are kept
  // on the record and come back if the component is re-added).
  const previous = await loadPolicy();
  const removed = previous.components.filter((c) => !policy.components.some((n) => n.key === c.key));
  if (removed.length) {
    const structures = await loadStructures(previous);
    const acknowledged = Array.isArray(body.acknowledgeRemoved) ? (body.acknowledgeRemoved as unknown[]).map(String) : [];
    const inUse = removed
      .map((c) => ({
        c,
        count: structures.filter((s) => Number(c.legacy ? s.raw[c.key] : s.raw.extraComponents?.[c.key]) > 0).length,
      }))
      .filter((x) => x.count > 0 && !acknowledged.includes(x.c.key));
    if (inUse.length) {
      throw new ApiError(
        409, "component-in-use",
        `${inUse.map((x) => `${x.c.label} (${x.c.type}) still has an amount for ${x.count} employee(s)`).join("; ")}. ` +
          `Removing it changes their salary from the next payroll run (months already approved are not affected). Confirm to remove it anyway.`
      );
    }
  }

  const before = await db().doc("settings/payrollPolicy").get();
  await db().doc("settings/payrollPolicy").set({ ...policy, updatedAt: now, updatedBy: actor.email });
  await db().collection("payrollPolicyVersions").add({ policy, previous: before.exists ? before.data() : null, by: actor.email, at: now });
  await audit(actor, "policy-saved", null, { confirmed: policy.confirmed, removedComponents: removed.map((c) => c.key) }, `Payroll policy saved (confirmed: ${policy.confirmed})${removed.length ? `; removed components: ${removed.map((c) => c.label).join(", ")}` : ""}.`);
  return { policy, explanation: describePolicy(policy) };
}

// ------------------------------------------------------------ preview / runs
export async function previewRun(user: VerifiedUser, periodIn: unknown) {
  const actor = await actorWith(user, "payroll", "view");
  const rules = await loadRules();
  const period = validatePeriod(periodIn, rules);
  const [computed, run] = await Promise.all([computeRun(period), getRunState(period)]);
  const decisions = await loadDecisions(period);
  const approved = run.state && (run.state.status === "approved" || run.state.status === "payslips_generated") ? run.data : null;
  return {
    ...computed,
    decisions,
    canEdit: can(actor.role, actor.matrix, "payroll", "edit"),
    run: run.data
      ? {
          status: run.data.status, revision: run.data.revision, approvedAt: iso(run.data.approvedAt), approvedBy: run.data.approvedBy || null,
          publishedAt: iso(run.data.publishedAt), publishedBy: run.data.publishedBy || null,
          summary: run.data.summary || null, payslipCount: run.data.payslipCount || 0, history: run.data.history || [],
          // The live numbers moved since approval (e.g. an attendance correction): the approved payroll is NOT
          // changed automatically — this only tells HR that a reversal would produce different figures.
          driftNetPay: approved?.summary ? Math.round((computed.summary.netPay - approved.summary.netPay) * 100) / 100 : null,
        }
      : null,
  };
}

export async function listRuns(user: VerifiedUser) {
  await actorWith(user, "payroll", "view");
  const snap = await db().collection("payrollRuns").get();
  return {
    runs: snap.docs
      .map((d) => ({ period: d.id, status: d.data().status, revision: d.data().revision, approvedAt: iso(d.data().approvedAt), approvedBy: d.data().approvedBy || null, summary: d.data().summary || null, payslipCount: d.data().payslipCount || 0 }))
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 36),
  };
}

// --------------------------------------------------- decisions (HR overrides)
type DecisionItem = { uid: string; date: string; treatment: "paid" | "unpaid"; reason: string };

export async function saveDecisions(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "payroll", "edit");
  const period = validatePeriod(body.period, await loadRules());
  const { state } = await getRunState(period);
  if (!canEditDecisions(state)) throw new ApiError(409, "conflict", "This period is approved. Reverse it before changing review decisions.");

  const items = Array.isArray(body.items) ? (body.items as DecisionItem[]) : [];
  const clear = Array.isArray(body.clear) ? (body.clear as { uid: string; date: string }[]) : [];
  if (items.length + clear.length === 0 || items.length + clear.length > 2000) throw new ApiError(400, "bad-request", "Nothing to save.");

  const computed = await computeRun(period);
  const byUid = new Map(computed.results.map((r) => [r.uid, r]));
  const writes: Record<string, unknown> = {};
  for (const it of items) {
    const r = byUid.get(String(it.uid));
    if (!r || typeof it.date !== "string" || !it.date.startsWith(period)) throw new ApiError(400, "bad-request", "A decision refers to an unknown employee or date.");
    if (it.treatment !== "paid" && it.treatment !== "unpaid") throw new ApiError(400, "bad-request", "Choose paid or unpaid.");
    const cls = r.dayClasses[it.date];
    if (cls !== "review" && cls !== "decided-paid" && cls !== "decided-unpaid") throw new ApiError(400, "bad-request", `${it.date} for ${r.employeeId} does not need a decision.`);
    writes[`overrides.${it.uid}|${it.date}`] = { treatment: it.treatment, reason: reason(it.reason), by: actor.email, at: new Date().toISOString() };
  }
  for (const c of clear) writes[`overrides.${c.uid}|${c.date}`] = FieldValue.delete();

  const ref = db().doc(`payrollDrafts/${period}`);
  if (!(await ref.get()).exists) await ref.set({ period, overrides: {}, createdAt: Timestamp.now() });
  await ref.update({ ...writes, updatedAt: Timestamp.now() });
  await audit(actor, "decisions-saved", period, { set: items.length, cleared: clear.length }, `${items.length} review decision(s) saved, ${clear.length} cleared for ${period}.`);
  return { saved: items.length, cleared: clear.length };
}

// One decision for every day that simply has no attendance record.
export async function resolveMissing(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "payroll", "edit");
  const period = validatePeriod(body.period, await loadRules());
  const { state } = await getRunState(period);
  if (!canEditDecisions(state)) throw new ApiError(409, "conflict", "This period is approved. Reverse it first.");
  if (body.treatment !== "paid" && body.treatment !== "unpaid") throw new ApiError(400, "bad-request", "Choose paid or unpaid.");
  const why = reason(body.reason, 10);

  const computed = await computeRun(period);
  const days: { uid: string; date: string }[] = [];
  for (const r of computed.results) for (const f of r.flags) if (f.code === "missing-attendance" && f.date) days.push({ uid: r.uid, date: f.date });
  if (days.length === 0) return { saved: 0 };
  if (body.confirm !== `RESOLVE ${days.length} DAYS`) {
    throw new ApiError(400, "confirmation-required", `Type RESOLVE ${days.length} DAYS to confirm.`);
  }
  const writes: Record<string, unknown> = {};
  for (const d of days) writes[`overrides.${d.uid}|${d.date}`] = { treatment: body.treatment, reason: why, by: actor.email, at: new Date().toISOString() };
  const ref = db().doc(`payrollDrafts/${period}`);
  if (!(await ref.get()).exists) await ref.set({ period, overrides: {}, createdAt: Timestamp.now() });
  await ref.update({ ...writes, updatedAt: Timestamp.now() });
  await audit(actor, "missing-resolved", period, { days: days.length, treatment: body.treatment, reason: why }, `${days.length} missing-attendance day(s) set to ${body.treatment} for ${period}: ${why}`);
  return { saved: days.length };
}

// ----------------------------------------------------------------- approval
export async function approveRun(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "payroll", "edit");
  const period = validatePeriod(body.period, await loadRules());
  if (body.confirm !== `APPROVE ${period}`) throw new ApiError(400, "confirmation-required", `Type APPROVE ${period} to confirm.`);

  const computed = await computeRun(period);
  if (!computed.policy.confirmed) throw new ApiError(409, "conflict", "The payroll policy has not been confirmed by a Super Admin.");
  if (computed.blockers.length) throw new ApiError(409, "blocked", `Cannot approve yet: ${computed.blockers.join(" ")}`);
  // Approve exactly what the reviewer saw.
  if (body.previewDigest !== computed.digest) {
    throw new ApiError(409, "changed", "The figures changed after you opened this preview (attendance, leave or salary was updated). Reload the preview and review it again.");
  }

  const runRef = db().doc(`payrollRuns/${period}`);
  const nowMs = Date.now();
  let plan: { revision: number; resume: boolean };
  let previousStatus: string | null = null;
  try {
    plan = await db().runTransaction(async (tx) => {
      const snap = await tx.get(runRef);
      const d = snap.data();
      const state: RunState | null = snap.exists
        ? { period, status: d!.status, revision: Number(d!.revision || 1), approvingSinceMs: d!.approvingSince instanceof Timestamp ? d!.approvingSince.toMillis() : null }
        : null;
      const p = planApprove(state, nowMs);
      previousStatus = state ? state.status : null;
      tx.set(runRef, { period, status: "approving", revision: p.revision, approvingSince: Timestamp.fromMillis(nowMs), approvingBy: actor.email, history: d?.history || [] }, { merge: true });
      return p;
    });
  } catch (e) {
    return conflict(e);
  }

  const ready = computed.results.filter((r) => r.status === "ready");
  try {
    const entries = ready.map((r) => ({ id: entryId(period, r.uid, plan.revision), result: r, hash: hashOf(r) }));
    for (let i = 0; i < entries.length; i += 300) {
      const batch = db().batch();
      for (const e of entries.slice(i, i + 300)) {
        batch.set(db().doc(`payrollEntries/${e.id}`), {
          period, revision: plan.revision, uid: e.result.uid, employeeId: e.result.employeeId, result: JSON.parse(JSON.stringify(e.result)),
          entryHash: e.hash, voided: false, createdAt: Timestamp.fromMillis(nowMs),
        });
      }
      await batch.commit();
    }
    const policyLines = describePolicy(computed.policy);
    await runRef.set({
      period, status: "approved", revision: plan.revision, approvedAt: Timestamp.fromMillis(nowMs), approvedBy: actor.email, approvedByUid: actor.uid,
      approvingSince: FieldValue.delete(), approvingBy: FieldValue.delete(),
      summary: computed.summary, policy: JSON.parse(JSON.stringify(computed.policy)), policyLines, companyName: await companyName(),
      entryCount: entries.length, digest: computed.digest, payslipCount: 0, decisionsSnapshot: await loadDecisions(period),
      excluded: computed.results.filter((r) => r.status === "excluded").map((r) => r.employeeId),
    }, { merge: true });
  } catch (error) {
    // release the lock so the approval can be retried
    if (previousStatus === null) await runRef.delete().catch(() => undefined);
    else await runRef.set({ status: previousStatus === "approving" ? "reversed" : previousStatus, approvingSince: FieldValue.delete() }, { merge: true }).catch(() => undefined);
    throw error;
  }
  await audit(actor, "approved", period, { revision: plan.revision, employees: ready.length, netPay: computed.summary.netPay, digest: computed.digest }, `Payroll ${period} approved (revision ${plan.revision}): ${ready.length} employees, net ${computed.summary.netPay}.`);
  return { period, revision: plan.revision, employees: ready.length, netPay: computed.summary.netPay };
}

// --------------------------------------------------------------- payslips
async function entriesFor(period: string, revision: number) {
  const snap = await db().collection("payrollEntries").where("period", "==", period).get();
  return snap.docs.filter((d) => Number(d.data().revision) === revision && d.data().voided !== true);
}

function metaFor(run: DocumentData, result: EmployeeResult, id: string, joiningDate: string | null, extras: Partial<PayslipMeta> = {}): PayslipMeta {
  return {
    companyName: String(run.companyName || "Omtatva Digitals"), period: run.period, revision: Number(run.revision),
    payslipId: id, approvedAtIso: (iso(run.approvedAt) as string) || new Date(0).toISOString(),
    joiningDate, policyLines: Array.isArray(run.policyLines) ? run.policyLines : [], ...extras,
  };
}

const text = (v: unknown, max = 60): string | null => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
};

export async function generatePayslips(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "payroll", "edit");
  const period = validatePeriod(body.period, await loadRules());
  const { state, data: run } = await getRunState(period);
  let plan: { revision: number };
  try {
    plan = planGenerate(state);
  } catch (e) {
    return conflict(e);
  }
  const entryDocs = await entriesFor(period, plan.revision);
  const existingSnap = await db().collection("payslips").where("period", "==", period).get();
  const existing = new Map(existingSnap.docs.filter((d) => Number(d.data().revision) === plan.revision).map((d) => [d.id, { status: String(d.data().status), entryHash: String(d.data().entryHash) }]));
  const users = new Map((await loadUsers()).map((u) => [u.uid, u]));

  // What a large-company payslip also shows: bank / statutory details from the employee's profile
  // (printed only when present) and year-to-date totals from the approved payroll snapshots.
  const addr = await companyAddress();
  const profileRefs = entryDocs.map((d) => db().doc(`employeeProfiles/${String(d.data().uid)}`));
  const profileSnaps = profileRefs.length ? await db().getAll(...profileRefs) : [];
  const profiles = new Map(profileSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));
  const ytdSnap = await db().collection("payrollEntries").where("period", ">=", fiscalYearStart(period)).where("period", "<=", period).get();
  const ytdEntries: YtdInput[] = ytdSnap.docs.map((d) => ({ period: String(d.data().period), revision: Number(d.data().revision), voided: d.data().voided === true, result: d.data().result }));

  const todo = planPayslips(period, plan.revision, entryDocs.map((d) => ({ uid: String(d.data().uid), entryHash: String(d.data().entryHash) })), existing);
  const byUid = new Map(entryDocs.map((d) => [String(d.data().uid), d]));

  let created = 0;
  const failed: string[] = [];
  for (const item of todo.create) {
    try {
      const entry = byUid.get(item.uid)!;
      const result = entry.data().result as EmployeeResult;
      if (hashOf(result) !== item.entryHash) throw new Error("entry snapshot does not match its hash");
      const p = profiles.get(item.uid) || {};
      const meta: PayslipMeta = JSON.parse(JSON.stringify(
        metaFor(run!, result, item.id, users.get(item.uid)?.joiningDate || null, {
          companyAddress: addr,
          employee: {
            location: text(p.officeLocation), bankName: text(p.bankName), bankAccountMasked: maskAccount(p.accountNumber), ifsc: text(p.ifsc, 20),
            pfNumber: text(p.pfNumber, 30), esiNumber: text(p.esicNumber, 30), uan: text(p.uanNumber, 30), pan: text(p.panNumber, 12),
          },
          ytd: buildYtd(ytdEntries, item.uid, period),
        })
      ));
      const pdf = renderPayslip(result, meta);
      // The generated PDF is retained (server-only collection), so what was issued is exactly what can be re-sent or re-downloaded.
      await db().doc(`payslipFiles/${item.id}`).set({ pdf: Buffer.from(pdf), sha256: sha256(pdf), bytes: pdf.length, createdAt: Timestamp.now() });
      await db().doc(`payslips/${item.id}`).create({
        // the exact header/basis text is frozen with the payslip, so it can be re-rendered identically after a later re-approval
        meta,
        period, revision: plan.revision, uid: item.uid, employeeId: result.employeeId, employeeName: result.name, entryId: entry.id,
        entryHash: item.entryHash, pdfSha256: sha256(pdf), pdfBytes: pdf.length,
        gross: result.grossEarnings, totalDeductions: result.totalDeductions, netPay: result.netPay,
        status: "issued", issuedAt: Timestamp.now(), issuedBy: actor.email,
      });
      created++;
    } catch (error) {
      // create() on an existing id means another click got there first: that is a skip, not an error
      if ((error as { code?: number }).code === 6) continue;
      console.error("Payslip failed", item.id, error);
      failed.push(item.id);
    }
  }
  const total = existing.size + created;
  await db().doc(`payrollRuns/${period}`).set({
    status: failed.length === 0 && todo.conflict.length === 0 ? "payslips_generated" : state!.status,
    payslipCount: total, payslipsGeneratedAt: Timestamp.now(), payslipsGeneratedBy: actor.email,
  }, { merge: true });
  await audit(actor, "payslips-generated", period, { revision: plan.revision, created, skipped: todo.skip.length, failed: failed.length, conflicts: todo.conflict.length }, `Payslips ${period}: ${created} created, ${todo.skip.length} already existed, ${failed.length} failed.`);
  return { period, revision: plan.revision, created, skipped: todo.skip.length, failed: failed.length, conflicts: todo.conflict.length };
}

export async function listPeriodPayslips(user: VerifiedUser, periodIn: unknown) {
  await actorWith(user, "payroll", "view");
  const period = validatePeriod(periodIn, await loadRules());
  const snap = await db().collection("payslips").where("period", "==", period).get();
  return {
    payslips: snap.docs.map((d) => ({ id: d.id, ...pub(d.data()) })).sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
  };
}

const pub = (x: DocumentData) => ({
  period: String(x.period), revision: Number(x.revision), employeeId: String(x.employeeId), employeeName: String(x.employeeName),
  netPay: Number(x.netPay), gross: Number(x.gross), status: String(x.status), issuedAt: iso(x.issuedAt),
  published: x.published === true, publishedAt: iso(x.publishedAt),
});

// HR: the PUBLISHED payslips of one employee (shown under Admin → Documents → that employee → Payslip).
// Needs payroll view access; unpublished / voided payslips are not listed.
export async function employeePayslips(user: VerifiedUser, uidIn: unknown) {
  await actorWith(user, "payroll", "view");
  const uid = typeof uidIn === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(uidIn) ? uidIn : "";
  if (!uid) throw new ApiError(400, "bad-request", "Invalid employee.");
  const snap = await db().collection("payslips").where("uid", "==", uid).get();
  return {
    payslips: snap.docs
      .filter((d) => d.data().status === "issued" && d.data().published === true)
      .map((d) => ({ id: d.id, ...pub(d.data()) }))
      .sort((a, b) => b.period.localeCompare(a.period)),
  };
}

// The caller's OWN payslips — the uid always comes from the verified token.
export async function myPayslips(user: VerifiedUser) {
  const actor = await memberFor(user);
  const snap = await db().collection("payslips").where("uid", "==", actor.uid).get();
  return {
    payslips: snap.docs
      .filter((d) => d.data().status === "issued" && d.data().published === true)
      .map((d) => ({ id: d.id, ...pub(d.data()) }))
      .sort((a, b) => b.period.localeCompare(a.period)),
  };
}

export async function payslipPdf(user: VerifiedUser, id: unknown): Promise<{ bytes: Uint8Array; filename: string }> {
  if (typeof id !== "string" || !/^\d{4}-\d{2}_[A-Za-z0-9_-]{6,128}_r\d{1,3}$/.test(id)) throw new ApiError(400, "bad-request", "Invalid payslip.");
  const actor = await memberFor(user);
  const snap = await db().doc(`payslips/${id}`).get();
  // Not found and not-yours look the same on purpose.
  if (!snap.exists) throw new ApiError(404, "not-found", "Payslip not found.");
  const p = snap.data()!;
  if (!canOpenPayslip({ callerUid: actor.uid, ownerUid: String(p.uid), role: actor.role, matrix: actor.matrix, voided: p.status !== "issued" || p.published !== true })) {
    throw new ApiError(404, "not-found", "Payslip not found.");
  }
  const entry = await db().doc(`payrollEntries/${p.entryId}`).get();
  if (!entry.exists || !p.meta) throw new ApiError(404, "not-found", "Payslip not found.");
  const result = entry.data()!.result as EmployeeResult;
  if (hashOf(result) !== p.entryHash) throw new ApiError(409, "integrity", "This payslip failed its integrity check. Contact HR.");
  const bytes = await retainedPdf(id, p, result);
  return { bytes, filename: `Payslip_${result.employeeId}_${p.period}.pdf` };
}

// The retained PDF issued for a payslip (verified against the checksum saved at
// generation). Falls back to re-rendering from the immutable snapshot — which
// is byte-identical — if the stored copy is missing.
export async function retainedPdf(id: string, payslip: DocumentData, result: EmployeeResult): Promise<Uint8Array> {
  const file = await db().doc(`payslipFiles/${id}`).get();
  const stored = file.exists ? file.data()!.pdf : null;
  const bytes: Uint8Array = stored ? new Uint8Array(stored as Buffer) : renderPayslip(result, payslip.meta as PayslipMeta);
  if (payslip.pdfSha256 && sha256(bytes) !== payslip.pdfSha256) throw new ApiError(409, "integrity", "This payslip failed its integrity check. Contact HR.");
  return bytes;
}

// ---------------------------------------------------------------- reversal
export async function reverseRun(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await superAdminActor(user);
  const period = validatePeriod(body.period, await loadRules());
  const why = reason(body.reason, 10);
  if (body.confirm !== `REVERSE ${period}`) throw new ApiError(400, "confirmation-required", `Type REVERSE ${period} to confirm.`);
  const { state, data: run } = await getRunState(period);
  let plan: { revision: number };
  try {
    plan = planReverse(state);
  } catch (e) {
    return conflict(e);
  }

  const [entryDocs, slipSnap] = await Promise.all([entriesFor(period, plan.revision), db().collection("payslips").where("period", "==", period).get()]);
  const slips = slipSnap.docs.filter((d) => Number(d.data().revision) === plan.revision);
  // Backup first — if it cannot be written, nothing is reversed.
  const backupId = await writeBackup(actor, "reversal", `Reversal of ${period} revision ${plan.revision}`, [
    { path: `payrollRuns/${period}`, data: run! },
    ...entryDocs.map((d) => ({ path: d.ref.path, data: d.data() })),
    ...slips.map((d) => ({ path: d.ref.path, data: d.data() })),
  ]);

  const now = Timestamp.now();
  const docs = [...entryDocs.map((d) => d.ref), ...slips.map((d) => d.ref)];
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db().batch();
    for (const ref of docs.slice(i, i + 400)) {
      batch.update(ref, ref.path.startsWith("payslips/") ? { status: "voided", voidedAt: now, voidedBy: actor.email, voidReason: why } : { voided: true });
    }
    await batch.commit();
  }
  const history = [...(Array.isArray(run!.history) ? run!.history : []), {
    revision: plan.revision, approvedAt: iso(run!.approvedAt), approvedBy: run!.approvedBy || null,
    reversedAt: now.toDate().toISOString(), reversedBy: actor.email, reason: why, backupId, netPay: run!.summary?.netPay ?? null,
  }];
  await db().doc(`payrollRuns/${period}`).set({
    status: "reversed", reversedAt: now, reversedBy: actor.email, reversalReason: why, history,
    publishedAt: FieldValue.delete(), publishedBy: FieldValue.delete(), publishedCount: 0, // the old payslips are withdrawn from employees
  }, { merge: true });
  for (const uid of new Set(slips.map((d) => String(d.data().uid)))) {
    try { await rebuildPayslipIndex(uid); } catch (e) { console.error("index rebuild after reversal failed", uid, (e as Error).message); }
  }
  // allow review decisions to be edited again for the recalculation
  await audit(actor, "reversed", period, { revision: plan.revision, reason: why, backupId, entries: entryDocs.length, payslipsVoided: slips.length }, `Payroll ${period} (revision ${plan.revision}) reversed: ${why}`);
  return { period, revision: plan.revision, backupId, payslipsVoided: slips.length };
}

// ------------------------------------------------------------ salary sheet
function cleanRows(raw: unknown): SheetRow[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ApiError(400, "bad-request", "The sheet has no rows.");
  if (raw.length > MAX_SHEET_ROWS) throw new ApiError(400, "bad-request", `Too many rows (max ${MAX_SHEET_ROWS}).`);
  return raw.map((r) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new ApiError(400, "bad-request", "Invalid sheet data.");
    const entries = Object.entries(r as Record<string, unknown>);
    if (entries.length > MAX_SHEET_COLUMNS) throw new ApiError(400, "bad-request", "Too many columns.");
    const row: SheetRow = {};
    for (const [k, v] of entries) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      row[k.slice(0, 80)] = typeof v === "number" ? v : typeof v === "string" ? v.slice(0, 200) : "";
    }
    return row;
  });
}

async function sheetContext() {
  const policy = await loadPolicy();
  const [users, structures] = await Promise.all([loadUsers(), loadStructures(policy)]);
  return {
    policy, users, structures,
    employees: users.filter((u) => u.employeeId).map((u) => ({ uid: u.uid, employeeId: u.employeeId, name: u.name })),
    structureRefs: structures.map((s) => ({ id: s.id, employeeId: s.employeeId, values: s.values })),
  };
}

export async function previewSalarySheet(user: VerifiedUser, body: Record<string, unknown>) {
  await actorWith(user, "salaryStructure", "edit");
  const ctx = await sheetContext();
  const preview = previewSheet({ rows: cleanRows(body.rows), components: ctx.policy.components, employees: ctx.employees, structures: ctx.structureRefs });
  return { preview, previewHash: sha256(preview.digest), components: ctx.policy.components };
}

function structureFields(values: Record<string, number>, policy: PayrollPolicy): DocumentData {
  const flat: DocumentData = {};
  const extra: Record<string, number> = {};
  let gross = 0;
  let ded = 0;
  for (const c of policy.components) {
    const v = Math.round(Number(values[c.key] || 0) * 100) / 100;
    if (c.legacy) flat[c.key] = v; else extra[c.key] = v;
    if (c.type === "earning") gross += v; else ded += v;
  }
  return { ...flat, extraComponents: extra, grossSalary: Math.round(gross * 100) / 100, netSalary: Math.round((gross - ded) * 100) / 100 };
}

async function applyRows(actor: Actor, ctx: Awaited<ReturnType<typeof sheetContext>>, preview: SheetPreview, meta: { source: "sheet-import" | "manual-edit"; reason: string; fileName: string }) {
  const rows = preview.rows.filter((r) => (r.status === "ok" || r.status === "warning") && r.uid);
  const importRef = db().collection("salaryImports").doc();
  const existing = rows.filter((r) => r.structureId).map((r) => ctx.structures.find((s) => s.id === r.structureId)!).filter(Boolean);
  // backup of every salary structure that is about to change
  const backupId = existing.length ? await writeBackup(actor, "salary", `${meta.source} ${meta.fileName}`, existing.map((s) => ({ path: `salaryStructure/${s.id}`, data: s.raw }))) : null;

  let applied = 0;
  const conflicts: string[] = [];
  for (const r of rows) {
    const user = ctx.users.find((u) => u.uid === r.uid)!;
    const histRef = db().collection("salaryChangeHistory").doc();
    try {
      await db().runTransaction(async (tx) => {
        const fields = { ...structureFields(r.proposed, ctx.policy), updatedAt: Timestamp.now(), updatedBy: actor.email, lastChangeId: histRef.id };
        if (r.structureId) {
          const ref = db().doc(`salaryStructure/${r.structureId}`);
          const snap = await tx.get(ref);
          const before = snap.exists ? valuesFromDoc(snap.data()!, ctx.policy) : null;
          const expected = ctx.structures.find((s) => s.id === r.structureId)!.values;
          if (!before || hashOf(before) !== hashOf(expected)) throw new RunConflict("changed");
          tx.update(ref, fields);
          tx.set(histRef, history(r, actor, meta, importRef.id, expected, valuesFromDoc({ ...snap.data()!, ...fields }, ctx.policy), ref.id));
        } else {
          const dup = await tx.get(db().collection("salaryStructure").where("employeeId", "==", r.employeeId));
          if (!dup.empty) throw new RunConflict("exists");
          const ref = db().collection("salaryStructure").doc();
          tx.create(ref, { employeeId: r.employeeId, employeeName: user.name, department: user.department, designation: user.designation, status: "Active", createdAt: Timestamp.now(), createdBy: actor.email, ...fields });
          tx.set(histRef, history(r, actor, meta, importRef.id, null, r.proposed, ref.id));
        }
      });
      applied++;
    } catch (e) {
      if (e instanceof RunConflict) conflicts.push(r.employeeId);
      else throw e;
    }
  }
  await importRef.set({
    source: meta.source, fileName: meta.fileName, reason: meta.reason, rows: preview.summary, applied, conflicts, backupId,
    by: actor.email, at: Timestamp.now(),
  });
  await audit(actor, meta.source === "sheet-import" ? "salary-import" : "salary-edit", null, { importId: importRef.id, applied, conflicts, backupId, fileName: meta.fileName }, `Salary ${meta.source === "sheet-import" ? "sheet" : "edit"}: ${applied} structure(s) updated${conflicts.length ? `, ${conflicts.length} skipped (changed meanwhile)` : ""} — ${meta.reason}`);
  return { applied, conflicts, backupId, importId: importRef.id };
}

function history(r: SheetPreview["rows"][number], actor: Actor, meta: { source: string; reason: string }, importId: string, before: Record<string, number> | null, after: Record<string, number>, structureId: string): DocumentData {
  return {
    employeeId: r.employeeId, uid: r.uid, employeeName: r.employeeName, structureId, source: meta.source, importId, reason: meta.reason,
    before, after, changes: r.changes, by: actor.email, byUid: actor.uid, at: Timestamp.now(),
  };
}

export async function applySalarySheet(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "salaryStructure", "edit");
  const ctx = await sheetContext();
  const preview = previewSheet({ rows: cleanRows(body.rows), components: ctx.policy.components, employees: ctx.employees, structures: ctx.structureRefs });
  if (body.previewHash !== sha256(preview.digest)) {
    throw new ApiError(409, "changed", "Salary records changed after you previewed this file. Upload it again to see the current differences.");
  }
  const n = preview.summary.applicable;
  if (n === 0) throw new ApiError(400, "bad-request", "There is nothing to apply: no valid, changed rows.");
  if (body.confirm !== `APPLY ${n} SALARY CHANGES`) throw new ApiError(400, "confirmation-required", `Type APPLY ${n} SALARY CHANGES to confirm.`);
  const why = reason(body.reason, 10);
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 120) : "salary-sheet";
  return applyRows(actor, ctx, preview, { source: "sheet-import", reason: why, fileName });
}

// Single employee edit from the Salary Structure screen — same validation,
// history and backup as the sheet.
export async function saveSalary(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "salaryStructure", "edit");
  const why = reason(body.reason, 5);
  const ctx = await sheetContext();
  const values = (body.values && typeof body.values === "object" ? body.values : {}) as Record<string, unknown>;
  const row: SheetRow = { Employee_ID: String(body.employeeId || "") };
  for (const c of ctx.policy.components) if (c.key in values) row[c.key] = values[c.key] as never;
  const preview = previewSheet({ rows: [row], components: ctx.policy.components, employees: ctx.employees, structures: ctx.structureRefs });
  const r = preview.rows[0];
  if (r.status === "error") throw new ApiError(400, "invalid", r.messages.filter((m) => m.severity === "error").map((m) => m.text).join(" "));
  if (r.status === "unchanged") return { applied: 0, conflicts: [], backupId: null, importId: null };
  return applyRows(actor, ctx, preview, { source: "manual-edit", reason: why, fileName: "manual edit" });
}

export async function deleteSalary(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "salaryStructure", "edit");
  const why = reason(body.reason, 5);
  if (typeof body.structureId !== "string" || !body.structureId) throw new ApiError(400, "bad-request", "Missing salary record.");
  const ref = db().doc(`salaryStructure/${body.structureId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError(404, "not-found", "Salary record not found.");
  const backupId = await writeBackup(actor, "salary", "delete salary structure", [{ path: ref.path, data: snap.data()! }]);
  const histRef = db().collection("salaryChangeHistory").doc();
  await histRef.set({
    employeeId: String(snap.data()!.employeeId || ""), structureId: ref.id, source: "delete", reason: why, before: snap.data(), after: null,
    by: actor.email, byUid: actor.uid, at: Timestamp.now(), backupId,
  });
  await ref.delete();
  await audit(actor, "salary-delete", null, { structureId: ref.id, backupId }, `Salary structure of ${snap.data()!.employeeId} deleted — ${why}`);
  return { deleted: true, backupId };
}

export async function salaryHistory(user: VerifiedUser, employeeId: unknown) {
  await actorWith(user, "salaryStructure", "view");
  let q = db().collection("salaryChangeHistory").orderBy("at", "desc").limit(100);
  if (typeof employeeId === "string" && employeeId) q = db().collection("salaryChangeHistory").where("employeeId", "==", employeeId).limit(100) as never;
  const snap = await q.get();
  return {
    history: snap.docs
      .map((d) => {
        const x = d.data();
        return { id: d.id, employeeId: x.employeeId, employeeName: x.employeeName || "", source: x.source, reason: x.reason, changes: x.changes || [], by: x.by, at: iso(x.at) };
      })
      .sort((a, b) => String(b.at).localeCompare(String(a.at))),
  };
}
