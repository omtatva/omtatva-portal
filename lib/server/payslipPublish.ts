// "Send to Employees": publishes the generated payslips of an APPROVED month.
//
// Generating payslips never exposes them; publishing does. The action is
// idempotent (each payslip is published once, in its own transaction), records
// who published and when, reports per-employee success/failure, and can simply
// be pressed again to retry the failures.

import { Timestamp } from "firebase-admin/firestore";
import { periodLabel } from "../payroll/payslipPdf";
import { planPublish, stageOf } from "../payroll/publish";
import { ApiError, adminDb, type VerifiedUser } from "./firebaseAdmin";
import { audit, getRunState } from "./payrollActions";
import { actorWith, iso, loadRules, validatePeriod } from "./payrollData";
import { rebuildPayslipIndex, toSlip } from "./payslipIndex";

const db = () => adminDb();

async function load(periodIn: unknown) {
  const period = validatePeriod(periodIn, await loadRules());
  const { state, data } = await getRunState(period);
  const revision = state?.revision ?? 0;
  const snap = state ? await db().collection("payslips").where("period", "==", period).get() : null;
  const slips = (snap?.docs || []).filter((d) => Number(d.data().revision) === revision && d.data().status === "issued");
  return { period, state, run: data, revision, slips };
}

export async function publishPreview(user: VerifiedUser, periodIn: unknown) {
  await actorWith(user, "payroll", "edit");
  const { period, state, run, revision, slips } = await load(periodIn);
  const plan = planPublish(slips.map((d) => toSlip(d.id, d.data())));
  const blockers: string[] = [];
  if (!state || state.status !== "payslips_generated") {
    blockers.push(state?.status === "approved" ? "Generate the payslips first." : "Approve the payroll and generate the payslips first — draft or unapproved payroll can never be sent.");
  }
  if (state?.status === "payslips_generated" && slips.length === 0) blockers.push("There are no issued payslips for this month.");
  return {
    period, periodLabel: periodLabel(period), revision,
    stage: stageOf(run ? { status: String(run.status), publishedAt: run.publishedAt } : null),
    employees: new Set(slips.map((d) => String(d.data().uid))).size,
    toPublish: plan.toPublish.length,
    alreadyPublished: plan.already.length,
    publishedAt: iso(run?.publishedAt), publishedBy: run?.publishedBy || null,
    blockers,
  };
}

export async function publishPayslips(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "payroll", "edit");
  const { period, state, run, revision, slips } = await load(body.period);
  if (!state || state.status !== "payslips_generated") {
    throw new ApiError(409, "conflict", "Only an approved month with generated payslips can be sent to employees.");
  }
  const lite = slips.map((d) => toSlip(d.id, d.data()));
  const plan = planPublish(lite);

  // Confirmation names the exact number about to be published. When there is
  // nothing left (a repeated click), no confirmation is needed and nothing changes.
  if (plan.toPublish.length > 0 && body.confirm !== `PUBLISH ${plan.toPublish.length} PAYSLIPS`) {
    throw new ApiError(400, "confirmation-required", `Type PUBLISH ${plan.toPublish.length} PAYSLIPS to confirm.`);
  }

  const batchId = `pub_${Date.now()}`;
  const published: string[] = [];
  const failed: { employeeId: string; message: string }[] = [];
  const byId = new Map(lite.map((s) => [s.id, s]));

  for (const id of plan.toPublish) {
    const ref = db().doc(`payslips/${id}`);
    try {
      const did = await db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const d = snap.data();
        if (!d || d.status !== "issued") throw new Error("payslip is not issued");
        if (d.published === true) return false; // another click got there first
        tx.update(ref, { published: true, publishedAt: Timestamp.now(), publishedBy: actor.email, publishBatchId: batchId });
        return true;
      });
      if (did) published.push(id);
    } catch (e) {
      failed.push({ employeeId: byId.get(id)?.employeeId || id, message: (e as Error).message.slice(0, 120) });
    }
  }

  // Employees' lists are rebuilt for everyone in the month (cheap, and it also heals an earlier partial run).
  const uids = [...new Set(lite.map((s) => s.uid))];
  let indexFailed = 0;
  for (const uid of uids) {
    try {
      await rebuildPayslipIndex(uid);
    } catch (e) {
      indexFailed += 1;
      console.error("payslip index rebuild failed", uid, (e as Error).message);
    }
  }

  const totalPublished = plan.already.length + published.length;
  if (published.length > 0 || !run?.publishedAt) {
    await db().doc(`payrollRuns/${period}`).set({
      ...(run?.publishedAt ? {} : { publishedAt: Timestamp.now(), publishedBy: actor.email }),
      lastPublishedAt: Timestamp.now(), lastPublishedBy: actor.email, publishedCount: totalPublished, publishedRevision: revision,
    }, { merge: true });
  }
  await audit(
    actor, "payslips-published", period,
    { batchId, revision, published: published.length, alreadyPublished: plan.already.length, failed: failed.length, indexFailed },
    `Payslips ${period} sent to employees: ${published.length} published, ${plan.already.length} already published, ${failed.length} failed.`
  );
  return {
    period, revision, batchId, published: published.length, alreadyPublished: plan.already.length, failed, indexFailed,
    message: failed.length ? `${published.length} published, ${failed.length} failed — press again to retry the failed ones.` : `${totalPublished} payslip(s) are now visible to their employees.`,
  };
}

