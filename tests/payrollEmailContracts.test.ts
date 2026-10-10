// Run with:  npm run test:payroll
// Source-contract checks for exports + e-mail (no Firestore emulator here).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sendBlockers } from "../lib/server/payslipEmail";
import { loadEmailConfig } from "../lib/payroll/emailProvider";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};
const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const mail = read("lib/server/payslipEmail.ts");
const exp = read("lib/server/payrollExports.ts");
const body = (src: string, fn: string) => {
  const i = src.indexOf(`export async function ${fn}(`);
  assert.ok(i >= 0, fn);
  const j = src.indexOf("\nexport ", i + 10);
  return src.slice(i, j < 0 ? undefined : j);
};
const before = (src: string, a: string, b: string, msg: string) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  assert.ok(i >= 0 && j >= 0, `missing ${a} / ${b}`);
  assert.ok(i < j, msg);
};

// ------------------------------------------------------- the safety gates
const ENV = { POSTMARK_SERVER_TOKEN: "t", EMAIL_FROM: "Payroll <payroll@omtatvadigitals.com>", POSTMARK_WEBHOOK_USER: "u", POSTMARK_WEBHOOK_PASS: "p" };
const okState = { testSentAt: "2026-09-01T00:00:00Z", testSentBy: "a", liveApproved: true, liveApprovedBy: "a", liveApprovedAt: "x" };
test("real sending is blocked until: payslips generated, server configured, mode=live, test e-mail sent, live switched on", () => {
  const live = loadEmailConfig({ ...ENV, PAYSLIP_EMAIL_MODE: "live" });
  assert.deepEqual(sendBlockers(live, okState, "payslips_generated"), []);
  assert.ok(sendBlockers(live, okState, "approved").some((b) => b.includes("generate the payslips")));
  assert.ok(sendBlockers(live, okState, null).length > 0);
  assert.ok(sendBlockers(loadEmailConfig({ ...ENV, PAYSLIP_EMAIL_MODE: "test" }), okState, "payslips_generated").some((b) => b.includes('"test"')));
  assert.ok(sendBlockers(loadEmailConfig({ ...ENV }), okState, "payslips_generated").some((b) => b.includes('"off"')));
  assert.ok(sendBlockers(live, { ...okState, testSentAt: null }, "payslips_generated").some((b) => b.includes("test e-mail")));
  assert.ok(sendBlockers(live, { ...okState, liveApproved: false }, "payslips_generated").some((b) => b.includes("switched live")));
  assert.ok(sendBlockers(loadEmailConfig({ PAYSLIP_EMAIL_MODE: "live" }), okState, "payslips_generated").some((b) => b.includes("POSTMARK_SERVER_TOKEN")));
  assert.ok(sendBlockers(loadEmailConfig({ ...ENV, EMAIL_FROM: "x@gmail.com", PAYSLIP_EMAIL_MODE: "live" }), okState, "payslips_generated").some((b) => b.includes("company domain")));
  assert.ok(sendBlockers(loadEmailConfig({ ...ENV, POSTMARK_WEBHOOK_USER: "", PAYSLIP_EMAIL_MODE: "live" }), okState, "payslips_generated").some((b) => b.includes("WEBHOOK")), "no live sending without bounce tracking");
});

test("every e-mail action authorizes on the server first; test/live switch are Super Admin only", () => {
  const names = [...mail.matchAll(/export async function (\w+)\(user: VerifiedUser/g)].map((m) => m[1]);
  assert.ok(names.length >= 8, String(names));
  for (const n of names) {
    const first = body(mail, n).split("\n").slice(1, 3).join("\n");
    assert.ok(/await (actorWith|superAdminActor)\(user/.test(first), `${n} must authorize first`);
  }
  assert.ok(body(mail, "sendTestEmail").includes("superAdminActor(user)") && body(mail, "setLive").includes("superAdminActor(user)"));
  for (const n of ["emailPreview", "sendPayslipEmails", "continueSending", "resendPayslipEmails"]) assert.ok(body(mail, n).includes('actorWith(user, "payroll", "edit")'), n);
  for (const n of ["emailStatus", "emailDns"]) assert.ok(body(mail, n).includes('actorWith(user, "payroll", "view")'), n);
});
test("send: blockers → fresh plan → typed confirmation of the exact count → batch record → deliveries → sending → audit", () => {
  const b = body(mail, "sendPayslipEmails");
  before(b, "sendBlockers(", "planBatch(", "blockers first");
  before(b, "planBatch(", "body.confirm !==", "plan before confirm");
  before(b, "body.confirm !==", "payslipEmailBatches", "confirm before anything is written");
  before(b, "payslipEmailBatches", "writeDeliveries(", "batch record first");
  before(b, "writeDeliveries(", "processQueued(", "queue before sending");
  assert.ok(b.includes("`SEND ${toQueue} PAYSLIPS`"), "the confirmation carries the recipient count");
  assert.ok(b.includes('audit(actor, "email-send-started"') && b.includes('audit(actor, "email-send-progress"'));
});
test("duplicate protection: one delivery doc per payslip, claimed in a transaction; a real delivery is never overwritten", () => {
  assert.ok(mail.includes("class FirestoreStore") && mail.includes("runTransaction") && mail.includes('d.status === "queued"'));
  assert.ok(mail.includes('!["queued", "skipped"].includes(snap.data()!.status)) return; // never overwrite a real delivery'));
  assert.ok(mail.includes("payslipEmails/${item.id}") && mail.includes("payslipEmails/${id}"));
});
test("recipients come from Firebase Auth (verified, not disabled), are validated, and are never shown in full to other recipients", () => {
  assert.ok(mail.includes("adminAuth().getUsers(") && mail.includes("emailVerified: u.emailVerified") && mail.includes("u.disabled ? null"));
  assert.ok(mail.includes("planBatch(") && mail.includes("validateEmail("));
  assert.ok(mail.includes("maskEmail(") && !/\bCc\b|\bBcc\b|cc:|bcc:/.test(mail));
  assert.ok(mail.includes("attachment: { name: `Payslip_${result.employeeId}_${d.period}.pdf`"), "only that employee's PDF");
});
test("each message is built from the verified snapshot and the retained PDF; a reversed payroll cannot be e-mailed", () => {
  const b = mail.slice(mail.indexOf("async function buildMessage("), mail.indexOf("function depsFor("));
  assert.ok(b.includes('status !== "issued"') && b.includes("hashOf(entry.data()!.result) !== slip.entryHash") && b.includes("retainedPdf("));
});
test("resend is controlled: reason, status rules, corrected/verified address, 'unknown' needs explicit acknowledgement", () => {
  const b = body(mail, "resendPayslipEmails");
  assert.ok(b.includes("reasonText(body.reason, 10)") && b.includes("confirmUnknown") && b.includes("addressFixed"));
  assert.ok(b.includes('status === "sent" || status === "delivered"') && b.includes("not resent"));
  before(b, "sendBlockers(", "reasonText(", "same gates as a normal send");
});
test("audit: who, period, counts and reasons — never payslip contents or full addresses", () => {
  const audits = [...mail.matchAll(/await audit\(([^;]*)\);/g)].map((m) => m[1]);
  assert.ok(audits.length >= 6, String(audits.length));
  for (const a of audits) assert.ok(!/toEmail|netPay|gross|grossEarnings|\bresult\b|\.pdf|pdf\b/.test(a), a.slice(0, 80));
  assert.ok(!/audit\([^;]*(?<!maskEmail\()to\.email/.test(mail), "no raw address in audit calls");
  assert.ok(mail.includes("recipient: maskEmail("));
});
test("test e-mail uses a clearly fake sample employee — never real payslip data", () => {
  const b = body(mail, "sendTestEmail");
  assert.ok(b.includes("SAMPLE EMPLOYEE (not real data)") && !b.includes("payslips/") && !b.includes("payrollEntries"));
  assert.ok(b.includes("testSentAt"));
});
test("go-live needs a prior test e-mail, setup complete, acknowledgements, a typed phrase and no 'missing' DNS records", () => {
  const b = body(mail, "setLive");
  before(b, "testSentAt", "domainVerified", "test before ack");
  before(b, "domainVerified", "ENABLE LIVE PAYSLIP EMAILS", "ack before phrase");
  before(b, "ENABLE LIVE PAYSLIP EMAILS", "checkEmailDns(", "phrase before dns");
  assert.ok(b.includes('i.status === "missing"') && b.includes("liveApproved: true"));
});

// -------------------------------------------------------------- webhook
test("webhook: refuses anything without the shared credentials BEFORE reading the body; only updates our own deliveries", () => {
  const r = read("app/api/payroll/email-webhook/route.ts");
  before(r, "webhookAuthorized(", "req.json()", "auth before parsing");
  assert.ok(r.includes("status: 401"));
  const w = body(mail, "processWebhook");
  assert.ok(w.includes('where("providerMessageId", "==", ev.messageId)') && w.includes("applyEvent(") && w.includes("addSuppression("));
  assert.ok(!w.includes("toEmail"), "no address in webhook audit");
});

// --------------------------------------------------------------- exports
test("exports: built from the approved snapshot (not live data), totals verified against the approved summary, audited", () => {
  assert.ok(!exp.includes("computeRun") && exp.includes("payrollEntries"));
  assert.ok(exp.includes("hashOf(r) !== x.entryHash"), "each snapshot row's fingerprint is checked");
  before(exp, "verifyAgainstSummary(", "toCsv(table", "totals verified before the file is produced");
  assert.ok(exp.includes('actorWith(user, "payroll", "view")') && exp.includes("audit(actor"));
  assert.ok(exp.includes("only after the payroll for this month is approved"));
  assert.ok(exp.includes('run.status !== "payslips_generated"'), "ZIP only after payslips exist");
  assert.ok(exp.includes("p.status !== \"issued\""), "voided payslips are never exported");
});
test("route: exports and e-mail actions exist; every GET/POST still verifies the token first", () => {
  const r = read("app/api/payroll/[action]/route.ts");
  for (const a of ["payroll-export", "payslips-zip", "email-status", "email-preview", "email-dns", "email-test", "email-live", "email-send", "email-continue", "email-resend"]) assert.ok(r.includes(`"${a}"`), a);
  assert.ok(r.includes("attachment; filename") && r.includes("nosniff") && r.includes("no-store"));
});

// ----------------------------------------------- retained PDFs / secrets
test("PDFs are retained at generation (server-only) and verified against their checksum when read", () => {
  const a = read("lib/server/payrollActions.ts");
  before(a, "payslipFiles/${item.id}`).set(", "payslips/${item.id}`).create(", "file before the payslip record");
  assert.ok(a.includes("export async function retainedPdf(") && a.includes("sha256(bytes) !== payslip.pdfSha256"));
});
test("rules: delivery tracking, retained PDFs and suppressions are server-only", () => {
  const rules = read("firestore.rules");
  for (const c of ["payslipFiles", "payslipEmails", "payslipEmailBatches", "payslipEmailConfig", "emailSuppressions"]) {
    assert.ok(new RegExp(`match /${c}/\\{id\\}\\s*\\{ allow read, write: if false; \\}`).test(rules), c);
  }
});
test("secrets: the provider token / webhook password are read only on the server and never appear in frontend code or the repo", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|jsx|ts|tsx|yaml|yml|json|md)$/.test(e.name)) files.push(rel);
    }
  };
  for (const d of ["app", "components", "lib", "docs"]) walk(d);
  files.push("apphosting.yaml", "firebase.json", ".env.local.example");
  for (const f of files) {
    const src = read(f);
    const server = f.startsWith("lib/server/") || f.startsWith("app/api/") || f === "lib/payroll/emailProvider.ts" || f.startsWith("tests/");
    if (!server) {
      assert.ok(!/POSTMARK_SERVER_TOKEN|POSTMARK_WEBHOOK_PASS|X-Postmark-Server-Token/.test(src) || f.startsWith("docs/") || f === ".env.local.example" || f === "apphosting.yaml", `${f} must not touch e-mail secrets`);
    }
    assert.ok(!/(?:server[_-]?token|token)\s*[:=]\s*["'][A-Za-z0-9-]{24,}["']/i.test(src.replace(/\/\/.*$/gm, "")), `${f} looks like it contains a hard-coded secret`);
  }
  // no client component imports the provider or the e-mail server
  for (const f of files.filter((x) => x.startsWith("components/") || /^app\/.*\/page\.(js|tsx)$/.test(x) || x === "app/page.tsx")) {
    assert.ok(!/payslipEmail|emailProvider|emailSender/.test(read(f).replace(/\/\/.*$/gm, "")), `${f} imports server-only e-mail code`);
  }
  assert.ok(read(".gitignore").includes(".env*"));
});
test("screen: honest statuses (accepted ≠ delivered), typed confirmation, preview of recipients and period, controlled resend", () => {
  const ui = read("components/payroll/EmailPanel.tsx");
  assert.ok(ui.includes("NOT yet confirmation that it reached the inbox"));
  assert.ok(ui.includes("It may still be filtered to spam"));
  assert.ok(ui.includes("will each get their own e-mail with only their own payslip PDF"));
  assert.ok(ui.includes("`SEND ${preview.recipients.length} PAYSLIPS`") && ui.includes("periodLabel"));
  assert.ok(ui.includes("Controlled resend") && ui.includes("never sends anyone a second copy"));
  assert.ok(!/guarantee(?!d? inbox)/i.test(ui.replace("no setup can guarantee", "")), "no delivery guarantees are claimed");
});

console.log(`\n${passed} passed (exports + e-mail contracts)${process.exitCode ? " - with FAILURES" : ""}`);
