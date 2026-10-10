// Bulk payslip e-mail — server side.
//
// Safety model (see docs/payroll-email-setup.md):
//  * nothing is sent unless the server is configured (provider token, From on
//    the company domain), PAYSLIP_EMAIL_MODE=live, AND a Super Admin has sent
//    a test e-mail and switched live sending on in the app;
//  * one delivery record per payslip (id = payslip id); a worker must claim it
//    atomically before calling the provider, so repeated clicks / tabs / retries
//    can never send a person's payslip twice;
//  * every message goes to ONE verified company address (taken from Firebase
//    Auth, not from a free-text field) with ONLY that person's PDF attached;
//  * statuses are the provider's word, reported honestly — "sent" is not
//    "delivered", and nothing here claims inbox placement.

import dns from "node:dns";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { computeEmployee } from "../payroll/engine";
import { checkEmailDns } from "../payroll/dnsCheck";
import { applyEvent, maskEmail, normalizeStale, planBatch, renderEmail, validateEmail, type Delivery } from "../payroll/email";
import { PostmarkProvider, configProblems, loadEmailConfig, parseWebhook, type EmailConfig, type EmailMessage } from "../payroll/emailProvider";
import { runBatch, type DeliveryStore, type SendDeps } from "../payroll/emailSender";
import { periodLabel, renderPayslip } from "../payroll/payslipPdf";
import { resolvePolicy } from "../payroll/policy";
import { hashOf, sha256 } from "../payroll/runState";
import type { EmployeeResult } from "../payroll/engine";
import { ApiError, adminAuth, adminDb, type VerifiedUser } from "./firebaseAdmin";
import { audit, getRunState, retainedPdf } from "./payrollActions";
import { actorWith, loadRules, superAdminActor, validatePeriod, type Actor } from "./payrollData";

const db = () => adminDb();
const STATE_DOC = "payslipEmailConfig/state";
const reasonText = (v: unknown, min: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min) throw new ApiError(400, "bad-request", `Please give a reason (at least ${min} characters).`);
  return s.slice(0, 300);
};

// ------------------------------------------------------------------ gating
type SendState = { testSentAt: string | null; testSentBy: string | null; liveApproved: boolean; liveApprovedBy: string | null; liveApprovedAt: string | null };

async function sendState(): Promise<SendState> {
  const snap = await db().doc(STATE_DOC).get();
  const d = snap.exists ? snap.data()! : {};
  const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null);
  return { testSentAt: iso(d.testSentAt), testSentBy: d.testSentBy || null, liveApproved: d.liveApproved === true, liveApprovedBy: d.liveApprovedBy || null, liveApprovedAt: iso(d.liveApprovedAt) };
}

const providerOf = (cfg: EmailConfig) => new PostmarkProvider(cfg.token);

// Why a real send is not allowed yet (empty = allowed).
export function sendBlockers(cfg: EmailConfig, state: SendState, runStatus: string | null, published = true): string[] {
  const out: string[] = [];
  if (runStatus !== "payslips_generated") out.push("Approve the payroll and generate the payslips first.");
  else if (!published) out.push("Press “Send to Employees” first — e-mails are sent only for payslips that are published to employees.");
  for (const p of configProblems(cfg)) if (!p.startsWith("PAYSLIP_EMAIL_MODE")) out.push(`Server setup: ${p}.`);
  if (cfg.mode !== "live") out.push(`Server mode is "${cfg.mode}". Real payslips are sent only when PAYSLIP_EMAIL_MODE is "live".`);
  if (!state.testSentAt) out.push("No test e-mail has been sent yet. A Super Admin must send one and check it arrived.");
  if (!state.liveApproved) out.push("A Super Admin has not switched live payslip e-mails on yet.");
  return out;
}

// ------------------------------------------------------------ delivery store
const toDelivery = (id: string, d: DocumentData): Delivery => ({
  id, period: d.period, revision: Number(d.revision), uid: d.uid, employeeId: d.employeeId, employeeName: d.employeeName, toEmail: d.toEmail ?? null,
  status: d.status, attempts: Number(d.attempts || 0), lastError: d.lastError ?? null, retryable: d.retryable === true, skipReason: d.skipReason ?? null,
  providerMessageId: d.providerMessageId ?? null, leaseUntilMs: d.leaseUntilMs ?? null, batchId: d.batchId ?? null, mode: d.mode === "test" ? "test" : "live",
  content: d.content === "link" ? "link" : "attachment", // records written before this option always carried the PDF
});

class FirestoreStore implements DeliveryStore {
  async claim(id: string, nowMs: number, leaseMs: number, allowFailed: boolean) {
    const ref = db().doc(`payslipEmails/${id}`);
    return db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const d = snap.data()!;
      const ok = d.status === "queued" || (allowFailed && d.status === "failed" && d.retryable === true);
      if (!ok) return null;
      tx.update(ref, { status: "sending", leaseUntilMs: nowMs + leaseMs, updatedAt: Timestamp.now() });
      return toDelivery(id, { ...d, status: "sending" });
    });
  }
  async update(id: string, patch: Partial<Delivery> & Record<string, unknown>) {
    const { sentAtMs, ...rest } = patch as Record<string, unknown> & { sentAtMs?: number };
    await db().doc(`payslipEmails/${id}`).update({ ...rest, ...(sentAtMs ? { sentAt: Timestamp.fromMillis(sentAtMs) } : {}), updatedAt: Timestamp.now() });
  }
}

async function buildMessage(cfg: EmailConfig, d: Delivery): Promise<EmailMessage> {
  const slipSnap = await db().doc(`payslips/${d.id}`).get();
  if (!slipSnap.exists || slipSnap.data()!.status !== "issued") throw new Error("the payslip is no longer issued (payroll was reversed?)");
  const slip = slipSnap.data()!;
  const entry = await db().doc(`payrollEntries/${slip.entryId}`).get();
  if (!entry.exists || hashOf(entry.data()!.result) !== slip.entryHash) throw new Error("payslip failed its integrity check");
  const result = entry.data()!.result as EmployeeResult;
  if (slip.published !== true) throw new Error("the payslip has not been published to the employee");
  const attach = d.content !== "link";
  const pdf = attach ? await retainedPdf(d.id, slip, result) : null;
  const content = renderEmail({ employeeName: result.name, periodLabel: periodLabel(d.period), companyName: String(slip.meta?.companyName || "Omtatva Digitals"), portalUrl: cfg.portalUrl, test: false, attached: attach });
  const to = validateEmail(d.toEmail, cfg.allowedDomains);
  if (!to.ok) throw new Error(to.reason);
  return {
    from: cfg.from, to: to.email, replyTo: cfg.replyTo || undefined, ...content, deliveryId: d.id,
    ...(pdf ? { attachment: { name: `Payslip_${result.employeeId}_${d.period}.pdf`, contentType: "application/pdf", data: pdf } } : {}),
  };
}

function depsFor(cfg: EmailConfig, allowFailed = false): SendDeps {
  return { store: new FirestoreStore(), provider: providerOf(cfg), build: (d) => buildMessage(cfg, d), allowFailed };
}

const suppressionId = (email: string) => sha256(email.toLowerCase());

async function suppressed(): Promise<Set<string>> {
  const snap = await db().collection("emailSuppressions").get();
  return new Set(snap.docs.map((d) => String(d.data().email || "").toLowerCase()));
}

async function addSuppression(email: string, reason: string) {
  await db().doc(`emailSuppressions/${suppressionId(email)}`).set({ email: email.toLowerCase(), reason: reason.slice(0, 200), at: Timestamp.now() }, { merge: true });
}

// uid -> the verified address Firebase Auth holds for that person
async function accountsFor(uids: string[]) {
  const out = new Map<string, { email: string | null; emailVerified: boolean }>();
  for (let i = 0; i < uids.length; i += 100) {
    const res = await adminAuth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    for (const u of res.users) out.set(u.uid, { email: u.disabled ? null : u.email ?? null, emailVerified: u.emailVerified });
  }
  return out;
}

async function currentPayslips(period: string, revision: number) {
  const snap = await db().collection("payslips").where("period", "==", period).get();
  return snap.docs.filter((d) => Number(d.data().revision) === revision && d.data().status === "issued").map((d) => ({ id: d.id, uid: String(d.data().uid), employeeId: String(d.data().employeeId), employeeName: String(d.data().employeeName) }));
}

async function deliveriesFor(period: string, revision: number) {
  const snap = await db().collection("payslipEmails").where("period", "==", period).get();
  return snap.docs.filter((d) => Number(d.data().revision) === revision).map((d) => toDelivery(d.id, d.data()));
}

async function context(periodIn: unknown) {
  const period = validatePeriod(periodIn, await loadRules());
  const { state, data } = await getRunState(period);
  return { period, revision: state?.revision ?? 0, runStatus: state?.status ?? null, run: data, published: !!data?.publishedAt };
}

// ---------------------------------------------------------- read-only views
export async function emailStatus(user: VerifiedUser, periodIn: unknown) {
  await actorWith(user, "payroll", "view");
  const { period, revision, runStatus } = await context(periodIn);
  const cfg = loadEmailConfig();
  const now = Date.now();
  const rows = (await deliveriesFor(period, revision)).map((d) => ({ ...d, status: normalizeStale(d, now) }));
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  return {
    period, runStatus, mode: cfg.mode, from: cfg.from || null, setupProblems: configProblems(cfg), state: await sendState(),
    counts,
    deliveries: rows
      .map((r) => ({ id: r.id, uid: r.uid, employeeId: r.employeeId, employeeName: r.employeeName, email: maskEmail(r.toEmail), status: r.status, attempts: r.attempts, lastError: r.lastError, retryable: r.retryable, skipReason: r.skipReason }))
      .sort((a, b) => a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true })),
  };
}

export async function emailPreview(user: VerifiedUser, periodIn: unknown) {
  await actorWith(user, "payroll", "edit");
  const { period, revision, runStatus, published } = await context(periodIn);
  const cfg = loadEmailConfig();
  const state = await sendState();
  const slips = runStatus === "payslips_generated" ? await currentPayslips(period, revision) : [];
  const existing = new Map((await deliveriesFor(period, revision)).map((d) => [d.id, d]));
  const accounts = await accountsFor(slips.map((s) => s.uid));
  const plan = planBatch({ payslips: slips, existing, accounts, suppressed: await suppressed(), allowedDomains: cfg.allowedDomains, nowMs: Date.now() });
  const byId = new Map(slips.map((s) => [s.id, s]));
  return {
    period, periodLabel: periodLabel(period), revision, runStatus,
    recipients: plan.filter((p) => p.action === "queue").map((p) => ({ employeeId: byId.get(p.id)!.employeeId, name: byId.get(p.id)!.employeeName, email: maskEmail((p as { email: string }).email) })),
    skipped: plan.filter((p) => p.action === "skip").map((p) => ({ employeeId: byId.get(p.id)!.employeeId, name: byId.get(p.id)!.employeeName, reason: (p as { reason: string }).reason, kind: (p as { kind: string }).kind })),
    blockers: sendBlockers(cfg, state, runStatus, published),
    mode: cfg.mode, from: cfg.from || null, state,
  };
}

export async function emailDns(user: VerifiedUser) {
  await actorWith(user, "payroll", "view");
  const cfg = loadEmailConfig();
  const items = await checkEmailDns(cfg.fromDomain, dns.promises as never, { dkimSelector: cfg.dkimSelector, returnPathHost: cfg.fromDomain ? `pm-bounces.${cfg.fromDomain}` : undefined });
  return {
    domain: cfg.fromDomain || null, items,
    note: "These checks show whether the DNS records exist. They cannot prove your provider has verified the domain, and no setup can guarantee inbox placement — that is decided by each recipient's mail system.",
  };
}

// ------------------------------------------------------------- test + go live
export async function sendTestEmail(user: VerifiedUser) {
  const actor = await superAdminActor(user);
  const cfg = loadEmailConfig();
  if (cfg.mode === "off") throw new ApiError(409, "conflict", 'PAYSLIP_EMAIL_MODE is "off". Set it to "test" first.');
  const missing = configProblems(cfg).filter((p) => p.startsWith("POSTMARK_SERVER_TOKEN") || p.startsWith("EMAIL_FROM"));
  if (missing.length) throw new ApiError(409, "conflict", `Server setup incomplete: ${missing.join("; ")}.`);
  const to = validateEmail(cfg.testRecipient || actor.email, cfg.testRecipient ? [] : cfg.allowedDomains);
  if (!to.ok) throw new ApiError(400, "bad-request", `Test recipient: ${to.reason}.`);

  // A clearly fake employee — no real salary data ever goes into a test.
  const result = computeEmployee("2026-01", resolvePolicy({ confirmed: true }), [], {
    uid: "TEST", employeeId: "TEST-001", name: "SAMPLE EMPLOYEE (not real data)", department: "Sample", designation: "Sample", weeklyOffDays: [0],
    salary: { basicSalary: 30000, hra: 10000, pf: 1800 }, attendance: [], leaveRequests: [], overrides: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`2026-01-${String(i + 1).padStart(2, "0")}`, { treatment: "paid" as const, reason: "sample" }])),
  });
  const pdf = renderPayslip(result, { companyName: "Omtatva Digitals (TEST)", period: "2026-01", revision: 1, payslipId: "2026-01_TEST_r1", approvedAtIso: new Date().toISOString(), policyLines: ["This is a SAMPLE payslip used to test e-mail delivery."] });
  const content = renderEmail({ employeeName: actor.name || "there", periodLabel: "January 2026 (sample)", companyName: "Omtatva Digitals", portalUrl: cfg.portalUrl, test: true });
  try {
    const sent = await providerOf(cfg).send({ from: cfg.from, to: to.email, replyTo: cfg.replyTo || undefined, ...content, deliveryId: "test", attachment: { name: "Sample_Payslip.pdf", contentType: "application/pdf", data: pdf } });
    await db().doc(STATE_DOC).set({ testSentAt: Timestamp.now(), testSentBy: actor.email, testMessageId: sent.messageId, testRecipient: maskEmail(to.email) }, { merge: true });
    await audit(actor, "email-test", null, { recipient: maskEmail(to.email) }, `Test payslip e-mail sent to ${maskEmail(to.email)}.`);
    return { sentTo: maskEmail(to.email), note: "The provider accepted the message. Check that it actually arrived in the inbox (and not in spam) before going live." };
  } catch (e) {
    throw new ApiError(502, "provider-error", `The test e-mail could not be sent: ${(e as Error).message}`);
  }
}

export async function setLive(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await superAdminActor(user);
  const cfg = loadEmailConfig();
  if (body.enable === false) {
    await db().doc(STATE_DOC).set({ liveApproved: false, liveDisabledAt: Timestamp.now(), liveDisabledBy: actor.email }, { merge: true });
    await audit(actor, "email-live-off", null, {}, "Live payslip e-mails switched off.");
    return { liveApproved: false };
  }
  const state = await sendState();
  if (!state.testSentAt) throw new ApiError(409, "conflict", "Send a test e-mail and check it arrived first.");
  const problems = configProblems(cfg).filter((p) => !p.startsWith("PAYSLIP_EMAIL_MODE"));
  if (problems.length) throw new ApiError(409, "conflict", `Server setup incomplete: ${problems.join("; ")}.`);
  if (body.domainVerified !== true || body.recipientsChecked !== true) throw new ApiError(400, "bad-request", "Confirm that the domain is verified and employee addresses were checked.");
  if (body.confirm !== "ENABLE LIVE PAYSLIP EMAILS") throw new ApiError(400, "confirmation-required", "Type ENABLE LIVE PAYSLIP EMAILS to confirm.");
  const items = await checkEmailDns(cfg.fromDomain, dns.promises as never, { dkimSelector: cfg.dkimSelector });
  const missing = items.filter((i) => i.status === "missing");
  if (missing.length) throw new ApiError(409, "conflict", `DNS check: ${missing.map((i) => `${i.label} record missing`).join(", ")}. Fix the DNS records first.`);
  await db().doc(STATE_DOC).set({ liveApproved: true, liveApprovedAt: Timestamp.now(), liveApprovedBy: actor.email }, { merge: true });
  await audit(actor, "email-live-on", null, { dns: items.map((i) => [i.id, i.status]) }, "Live payslip e-mails switched ON.");
  return { liveApproved: true, dns: items };
}

// ----------------------------------------------------------------- sending
async function processQueued(period: string, revision: number, cfg: EmailConfig, allowFailed = false, onlyIds?: string[]) {
  const queued = (await deliveriesFor(period, revision)).filter((d) => (onlyIds ? onlyIds.includes(d.id) : d.status === "queued" || (allowFailed && d.status === "failed")));
  const res = await runBatch(depsFor(cfg, allowFailed), queued.map((d) => d.id), { concurrency: 4, budgetMs: 40_000 });
  for (const e of res.suppress) await addSuppression(e, "provider reported the address inactive");
  return res;
}

async function writeDeliveries(plan: ReturnType<typeof planBatch>, slips: { id: string; uid: string; employeeId: string; employeeName: string }[], period: string, revision: number, batchId: string, mode: "test" | "live", content: "link" | "attachment") {
  const byId = new Map(slips.map((s) => [s.id, s]));
  for (const item of plan) {
    if (item.action === "skip" && item.kind !== "invalid") continue; // already sent / needs review: leave the record alone
    const s = byId.get(item.id)!;
    const ref = db().doc(`payslipEmails/${item.id}`);
    const base = {
      period, revision, uid: s.uid, employeeId: s.employeeId, employeeName: s.employeeName, batchId, mode, content, attempts: 0, lastError: null, retryable: false,
      providerMessageId: null, leaseUntilMs: null, queuedAt: Timestamp.now(), updatedAt: Timestamp.now(),
    };
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && !["queued", "skipped"].includes(snap.data()!.status)) return; // never overwrite a real delivery
      tx.set(ref, item.action === "queue" ? { ...base, toEmail: item.email, status: "queued", skipReason: null } : { ...base, toEmail: null, status: "skipped", skipReason: item.reason });
    });
  }
}

export async function sendPayslipEmails(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "payroll", "edit");
  const { period, revision, runStatus, published } = await context(body.period);
  const cfg = loadEmailConfig();
  const blockers = sendBlockers(cfg, await sendState(), runStatus, published);
  if (blockers.length) throw new ApiError(409, "blocked", blockers.join(" "));

  const slips = await currentPayslips(period, revision);
  const existing = new Map((await deliveriesFor(period, revision)).map((d) => [d.id, d]));
  const accounts = await accountsFor(slips.map((s) => s.uid));
  const plan = planBatch({ payslips: slips, existing, accounts, suppressed: await suppressed(), allowedDomains: cfg.allowedDomains, nowMs: Date.now() });
  const toQueue = plan.filter((p) => p.action === "queue").length;
  if (toQueue === 0 && !(await deliveriesFor(period, revision)).some((d) => d.status === "queued")) {
    throw new ApiError(409, "nothing-to-send", "There is nothing to send: every payslip was already sent or cannot be sent (see the skipped list).");
  }
  if (body.confirm !== `SEND ${toQueue} PAYSLIPS`) throw new ApiError(400, "confirmation-required", `Type SEND ${toQueue} PAYSLIPS to confirm.`);

  // Default: a notification only ("your payslip is available") — no salary data in the e-mail itself.
  const content: "link" | "attachment" = body.content === "attachment" ? "attachment" : "link";
  const batchId = `eb_${Date.now()}`;
  await db().doc(`payslipEmailBatches/${batchId}`).set({ period, revision, createdBy: actor.email, createdByUid: actor.uid, createdAt: Timestamp.now(), recipients: toQueue, mode: "live", content });
  await audit(actor, "email-send-started", period, { batchId, recipients: toQueue, revision }, `Payslip e-mails for ${period}: sending to ${toQueue} employee(s).`);
  await writeDeliveries(plan, slips, period, revision, batchId, "live", content);
  const res = await processQueued(period, revision, cfg);
  await audit(actor, "email-send-progress", period, { batchId, sent: res.sent, failed: res.failed, remaining: res.remaining.length, stopped: res.stoppedFatal ? "provider rejected our credentials" : null }, `Payslip e-mails ${period}: ${res.sent} accepted by the provider, ${res.failed} failed, ${res.remaining.length} still queued.`);
  return { batchId, queued: toQueue, sent: res.sent, failed: res.failed, remaining: res.remaining.length, stopped: res.stoppedFatal };
}

// The UI keeps calling this until `remaining` is 0 (each call has a time budget).
export async function continueSending(user: VerifiedUser, body: Record<string, unknown>) {
  await actorWith(user, "payroll", "edit");
  const { period, revision, runStatus, published } = await context(body.period);
  const cfg = loadEmailConfig();
  const blockers = sendBlockers(cfg, await sendState(), runStatus, published);
  if (blockers.length) throw new ApiError(409, "blocked", blockers.join(" "));
  const res = await processQueued(period, revision, cfg);
  return { sent: res.sent, failed: res.failed, remaining: res.remaining.length, stopped: res.stoppedFatal };
}

// Controlled resend: a named list of people, a written reason, and — for
// anything other than a plain temporary failure — a corrected address.
export async function resendPayslipEmails(user: VerifiedUser, body: Record<string, unknown>) {
  const actor = await actorWith(user, "payroll", "edit");
  const { period, revision, runStatus, published } = await context(body.period);
  const cfg = loadEmailConfig();
  const blockers = sendBlockers(cfg, await sendState(), runStatus, published);
  if (blockers.length) throw new ApiError(409, "blocked", blockers.join(" "));
  const why = reasonText(body.reason, 10);
  const uids = Array.isArray(body.uids) ? (body.uids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  if (uids.length === 0) throw new ApiError(400, "bad-request", "Choose who to resend to.");

  const all = await deliveriesFor(period, revision);
  const picked = all.filter((d) => uids.includes(d.uid));
  const accounts = await accountsFor(picked.map((d) => d.uid));
  const sup = await suppressed();
  const results: { employeeId: string; outcome: string }[] = [];
  const toSend: string[] = [];

  for (const d of picked) {
    const status = normalizeStale(d, Date.now());
    const acct = accounts.get(d.uid);
    const v = validateEmail(acct?.email, cfg.allowedDomains);
    const addressFixed = v.ok && !!acct?.emailVerified && v.email !== d.toEmail && !sup.has(v.email);

    if (status === "sent" || status === "delivered" || status === "sending" || status === "queued") {
      results.push({ employeeId: d.employeeId, outcome: `not resent: status is ${status}` });
      continue;
    }
    if (status === "failed" && d.retryable) {
      await db().doc(`payslipEmails/${d.id}`).update({ status: "queued", attempts: 0, resendReason: why, updatedAt: Timestamp.now() });
      toSend.push(d.id);
      continue;
    }
    if (status === "unknown" && body.confirmUnknown !== true) {
      results.push({ employeeId: d.employeeId, outcome: "not resent: it may already have been delivered — tick “I understand” to resend anyway" });
      continue;
    }
    if (status === "unknown" || addressFixed) {
      if (!(v.ok && acct?.emailVerified) || (status !== "unknown" && !addressFixed)) {
        results.push({ employeeId: d.employeeId, outcome: "not resent: the address is not valid / verified" });
        continue;
      }
      await db().doc(`payslipEmails/${d.id}`).update({ status: "queued", toEmail: v.email, attempts: 0, retryable: false, lastError: null, skipReason: null, providerMessageId: null, resendReason: why, updatedAt: Timestamp.now() });
      toSend.push(d.id);
      continue;
    }
    results.push({ employeeId: d.employeeId, outcome: "not resent: correct the employee's e-mail address (and verify it) first, then resend" });
  }

  const res = toSend.length ? await processQueued(period, revision, cfg, false, toSend) : null;
  await audit(actor, "email-resend", period, { requested: uids.length, queued: toSend.length, sent: res?.sent ?? 0, failed: res?.failed ?? 0, reason: why }, `Payslip e-mail resend ${period}: ${toSend.length} queued — ${why}`);
  return { requested: uids.length, queued: toSend.length, sent: res?.sent ?? 0, failed: res?.failed ?? 0, remaining: res?.remaining.length ?? 0, notResent: results };
}

// ----------------------------------------------------------------- webhooks
export async function processWebhook(body: unknown): Promise<{ handled: boolean }> {
  const ev = parseWebhook(body);
  if (!ev) return { handled: false };
  const snap = await db().collection("payslipEmails").where("providerMessageId", "==", ev.messageId).limit(1).get();
  if (snap.empty) return { handled: false }; // e.g. the test message: nothing to update
  const ref = snap.docs[0].ref;
  const change = applyEvent({ status: snap.docs[0].data().status }, ev);
  if (change) {
    await ref.update({
      status: change.status, lastError: change.lastError, updatedAt: Timestamp.now(),
      ...(change.status === "delivered" ? { deliveredAt: Timestamp.now() } : { bouncedAt: Timestamp.now() }),
    });
    await db().collection("payrollAudit").add({ type: "email-event", period: snap.docs[0].data().period, by: "provider-webhook", at: Timestamp.now(), details: { delivery: ref.id, status: change.status } });
  }
  if (ev.suppress && ev.email) await addSuppression(ev.email, ev.detail || ev.type);
  return { handled: true };
}

export type { Actor };
