// Run with:  npm run test:payroll
// No real e-mail is ever sent here: a fake provider and an in-memory store stand in.
import assert from "node:assert/strict";
import { applyEvent, maskEmail, normalizeStale, planBatch, renderEmail, validateEmail, type Delivery } from "../lib/payroll/email";
import { ProviderError, PostmarkProvider, classifyPostmark, configProblems, loadEmailConfig, parseWebhook, webhookAuthorized, type EmailMessage, type EmailProvider } from "../lib/payroll/emailProvider";
import { MAX_ATTEMPTS, RETRY_DELAYS_MS, runBatch, sendOne, type DeliveryStore } from "../lib/payroll/emailSender";
import { checkEmailDns, type Resolver } from "../lib/payroll/dnsCheck";

let passed = 0;
const queue: Promise<void>[] = [];
const test = (name: string, fn: () => void | Promise<void>) => {
  queue.push((async () => {
    try { await fn(); passed++; console.log("PASS", name); }
    catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
  })());
};

const DOMAINS = ["omtatvadigitals.com"];
const delivery = (id: string, over: Partial<Delivery> = {}): Delivery => ({
  id, period: "2026-08", revision: 1, uid: id, employeeId: "E" + id, employeeName: "Asha Rao", toEmail: `${id}@omtatvadigitals.com`,
  status: "queued", attempts: 0, lastError: null, retryable: false, skipReason: null, providerMessageId: null, leaseUntilMs: null, batchId: "b1", mode: "live", ...over,
});

class MemStore implements DeliveryStore {
  rows = new Map<string, Delivery>();
  constructor(list: Delivery[]) { list.forEach((d) => this.rows.set(d.id, { ...d })); }
  async claim(id: string, nowMs: number, leaseMs: number, allowFailed: boolean) {
    const d = this.rows.get(id);
    if (!d) return null;
    const ok = d.status === "queued" || (allowFailed && d.status === "failed" && d.retryable);
    if (!ok) return null;
    d.status = "sending";
    d.leaseUntilMs = nowMs + leaseMs;
    return { ...d };
  }
  async update(id: string, patch: Partial<Delivery>) { Object.assign(this.rows.get(id)!, patch); }
}

class FakeProvider implements EmailProvider {
  calls: EmailMessage[] = [];
  script: (ProviderError | "ok")[] = [];
  async send(msg: EmailMessage) {
    this.calls.push(msg);
    await Promise.resolve();
    const next = this.script.shift() ?? "ok";
    if (next !== "ok") throw next;
    return { messageId: `m${this.calls.length}` };
  }
}
const build = async (d: Delivery): Promise<EmailMessage> => ({
  from: "Payroll <payroll@omtatvadigitals.com>", to: d.toEmail!, subject: "s", text: "t", html: "h", deliveryId: d.id,
  attachment: { name: `Payslip_${d.employeeId}.pdf`, contentType: "application/pdf", data: new Uint8Array([37, 80, 68, 70]) },
});
const noSleep = (log: number[] = []) => async (ms: number) => { log.push(ms); };

// ----------------------------------------------------------------- addresses
test("addresses: valid company address only; one recipient only; no lists", () => {
  assert.deepEqual(validateEmail(" Asha.Rao@OmtatvaDigitals.com ", DOMAINS), { ok: true, email: "asha.rao@omtatvadigitals.com" });
  for (const bad of ["", null, "asha", "a@b", "a b@omtatvadigitals.com", "a@omtatvadigitals.com, b@omtatvadigitals.com", "a@omtatvadigitals.com;b@omtatvadigitals.com", "<a@omtatvadigitals.com>", "a@gmail.com", "a@evil-omtatvadigitals.com", "a@omtatvadigitals.com.evil.io"]) {
    assert.equal(validateEmail(bad, DOMAINS).ok, false, String(bad));
  }
  assert.equal(maskEmail("asha.rao@omtatvadigitals.com"), "a*******@omtatvadigitals.com");
});

// -------------------------------------------------------------- planning
const accounts = new Map([
  ["a", { email: "a@omtatvadigitals.com", emailVerified: true }],
  ["b", { email: "b@omtatvadigitals.com", emailVerified: false }],
  ["c", { email: "c@gmail.com", emailVerified: true }],
  ["d", { email: "d@omtatvadigitals.com", emailVerified: true }],
  ["e", { email: "e@omtatvadigitals.com", emailVerified: true }],
  ["f", { email: null, emailVerified: false }],
]);
test("planning: queue only verified company addresses; explain every skip", () => {
  const plan = planBatch({
    payslips: ["a", "b", "c", "d", "e", "f", "zz"].map((u) => ({ id: `p_${u}`, uid: u })),
    existing: new Map(), accounts, suppressed: new Set(["d@omtatvadigitals.com"]), allowedDomains: DOMAINS, nowMs: 0,
  });
  const by = Object.fromEntries(plan.map((p) => [p.uid, p]));
  assert.equal(by.a.action, "queue");
  assert.equal(by.e.action, "queue");
  for (const u of ["b", "c", "d", "f", "zz"]) assert.equal(by[u].action, "skip", u);
  assert.ok((by.b as { reason: string }).reason.includes("not verified"));
  assert.ok((by.c as { reason: string }).reason.includes("company domain"));
  assert.ok((by.d as { reason: string }).reason.includes("hard-bounced"));
});
test("planning: sent/delivered/in-flight are never queued again; failed/bounced/unknown need the controlled resend", () => {
  const status = (s: Delivery["status"], lease: number | null = null) => ({ status: s, leaseUntilMs: lease, toEmail: "a@omtatvadigitals.com" });
  const existing = new Map([
    ["p_sent", status("sent")], ["p_deliv", status("delivered")], ["p_live", status("sending", 5000)], ["p_stale", status("sending", 10)],
    ["p_fail", status("failed")], ["p_bounce", status("bounced")], ["p_q", status("queued")],
  ]);
  const plan = planBatch({
    payslips: [...existing.keys()].map((id) => ({ id, uid: "a" })), existing, accounts, suppressed: new Set(), allowedDomains: DOMAINS, nowMs: 1000,
  });
  const act = Object.fromEntries(plan.map((p) => [p.id, p.action]));
  assert.deepEqual(act, { p_sent: "skip", p_deliv: "skip", p_live: "skip", p_stale: "skip", p_fail: "skip", p_bounce: "skip", p_q: "queue" });
  assert.equal(normalizeStale({ status: "sending", leaseUntilMs: 10 }, 1000), "unknown");
  assert.equal(normalizeStale({ status: "sending", leaseUntilMs: 5000 }, 1000), "sending");
});

// ------------------------------------------------------------ sending
test("duplicate prevention: two clicks at the same moment send exactly ONE e-mail", async () => {
  const store = new MemStore([delivery("1")]);
  const provider = new FakeProvider();
  const deps = { store, provider, build };
  const [a, b] = await Promise.all([sendOne(deps, "1"), sendOne(deps, "1")]);
  assert.equal(provider.calls.length, 1);
  assert.deepEqual([a.result, b.result].sort(), ["sent", "skipped"]);
  assert.equal(store.rows.get("1")!.status, "sent");
  assert.equal(store.rows.get("1")!.providerMessageId, "m1");
  // a later click does nothing either
  assert.equal((await sendOne(deps, "1")).result, "skipped");
  assert.equal(provider.calls.length, 1);
});
test("a whole batch pressed twice at once still sends one e-mail per person", async () => {
  const ids = ["1", "2", "3", "4", "5", "6"];
  const store = new MemStore(ids.map((i) => delivery(i)));
  const provider = new FakeProvider();
  const deps = { store, provider, build };
  const [r1, r2] = await Promise.all([runBatch(deps, ids, { concurrency: 3 }), runBatch(deps, ids, { concurrency: 3 })]);
  assert.equal(provider.calls.length, 6);
  assert.equal(r1.sent + r2.sent, 6);
  assert.equal(new Set(provider.calls.map((c) => c.to)).size, 6);
});
test("privacy: each message goes to ONE recipient with ONLY that person's attachment; no cc/bcc", async () => {
  const store = new MemStore([delivery("1"), delivery("2")]);
  const provider = new FakeProvider();
  await runBatch({ store, provider, build }, ["1", "2"]);
  for (const c of provider.calls) {
    assert.ok(!c.to.includes(",") && !c.to.includes(";"));
    assert.ok(c.attachment.name.includes(c.deliveryId === "1" ? "E1" : "E2"));
    assert.ok(!("cc" in c) && !("bcc" in c));
  }
  assert.notEqual(provider.calls[0].to, provider.calls[1].to);
});
test("retries: temporary errors are retried with backoff, then it succeeds", async () => {
  const store = new MemStore([delivery("1")]);
  const provider = new FakeProvider();
  provider.script = [new ProviderError("temporary", "429 rate limit", 429), new ProviderError("temporary", "503", 503), "ok"];
  const waits: number[] = [];
  const r = await sendOne({ store, provider, build, sleep: noSleep(waits) }, "1");
  assert.equal(r.result, "sent");
  assert.equal(provider.calls.length, 3);
  assert.deepEqual(waits, RETRY_DELAYS_MS.slice(0, 2));
  assert.equal(store.rows.get("1")!.attempts, 3);
});
test("retries stop: after the maximum attempts it is 'failed' but retryable, and nothing more is sent", async () => {
  const store = new MemStore([delivery("1")]);
  const provider = new FakeProvider();
  provider.script = Array.from({ length: 10 }, () => new ProviderError("temporary", "timeout"));
  const r = await sendOne({ store, provider, build, sleep: noSleep() }, "1");
  assert.equal(r.result, "failed");
  assert.equal(provider.calls.length, MAX_ATTEMPTS);
  const row = store.rows.get("1")!;
  assert.deepEqual([row.status, row.retryable], ["failed", true]);
});
test("permanent errors are not retried and are not marked retryable", async () => {
  const store = new MemStore([delivery("1")]);
  const provider = new FakeProvider();
  provider.script = [new ProviderError("permanent", "invalid address", 422)];
  const r = await sendOne({ store, provider, build, sleep: noSleep() }, "1");
  assert.equal(r.result, "failed");
  assert.equal(provider.calls.length, 1);
  assert.equal(store.rows.get("1")!.retryable, false);
});
test("an address the provider already knows is dead is failed and suppressed — never retried", async () => {
  const store = new MemStore([delivery("1")]);
  const provider = new FakeProvider();
  provider.script = [new ProviderError("inactive", "406 inactive recipient", 422)];
  const r = await sendOne({ store, provider, build, sleep: noSleep() }, "1");
  assert.equal(r.suppress, "1@omtatvadigitals.com");
  assert.equal(provider.calls.length, 1);
});
test("bad credentials stop the whole batch and leave everything queued (nothing is lost or marked failed)", async () => {
  const ids = ["1", "2", "3", "4"];
  const store = new MemStore(ids.map((i) => delivery(i)));
  const provider = new FakeProvider();
  provider.script = [new ProviderError("fatal", "401 unauthorized", 401)];
  const r = await runBatch({ store, provider, build }, ids, { concurrency: 1 });
  assert.ok(r.stoppedFatal);
  assert.equal(provider.calls.length, 1);
  assert.deepEqual(r.remaining.sort(), ["1", "2", "3", "4"]);
  assert.ok([...store.rows.values()].every((d) => d.status === "queued"));
});
test("controlled resend: only a FAILED+retryable delivery can be claimed again, and only on request", async () => {
  const store = new MemStore([delivery("1", { status: "failed", retryable: true, attempts: 3 }), delivery("2", { status: "sent" }), delivery("3", { status: "failed", retryable: false })]);
  const provider = new FakeProvider();
  assert.equal((await sendOne({ store, provider, build }, "1")).result, "skipped", "normal sending ignores failed");
  assert.equal((await sendOne({ store, provider, build, allowFailed: true }, "1")).result, "sent");
  assert.equal((await sendOne({ store, provider, build, allowFailed: true }, "2")).result, "skipped", "sent can never be resent this way");
  assert.equal((await sendOne({ store, provider, build, allowFailed: true }, "3")).result, "skipped", "non-retryable needs a corrected address first");
  assert.equal(provider.calls.length, 1);
});
test("a message that cannot be prepared (e.g. payslip integrity failure) is failed, never sent", async () => {
  const store = new MemStore([delivery("1")]);
  const provider = new FakeProvider();
  const r = await sendOne({ store, provider, build: async () => { throw new Error("payslip failed its integrity check"); } }, "1");
  assert.equal(r.result, "failed");
  assert.equal(provider.calls.length, 0);
});
test("the stored error text never contains payslip contents (only a short provider message)", async () => {
  const store = new MemStore([delivery("1")]);
  const provider = new FakeProvider();
  provider.script = [new ProviderError("permanent", "x".repeat(900))];
  await sendOne({ store, provider, build }, "1");
  assert.ok(store.rows.get("1")!.lastError!.length <= 200);
});
test("the time budget stops a long batch cleanly; the rest stays queued for the next call", async () => {
  const ids = Array.from({ length: 6 }, (_, i) => String(i + 1));
  const store = new MemStore(ids.map((i) => delivery(i)));
  const provider = new FakeProvider();
  let t = 0;
  const r = await runBatch({ store, provider, build, now: () => (t += 10) }, ids, { concurrency: 1, budgetMs: 50 });
  assert.ok(r.sent >= 1 && r.sent < 6);
  assert.equal(r.sent + r.remaining.length, 6);
  assert.ok(r.remaining.every((id) => store.rows.get(id)!.status === "queued"));
});

// ------------------------------------------------- webhooks / bounces
test("webhook events: delivered, bounced, complained — honest ordering, no downgrades", () => {
  const ev = (type: "delivered" | "bounced" | "complained") => ({ type, messageId: "m", email: "a@x.com", detail: "HardBounce: no such user", suppress: type !== "delivered" });
  assert.equal(applyEvent({ status: "sent" }, ev("delivered"))!.status, "delivered");
  assert.equal(applyEvent({ status: "delivered" }, ev("delivered")), null, "duplicate event");
  assert.equal(applyEvent({ status: "sent" }, ev("bounced"))!.status, "bounced");
  assert.equal(applyEvent({ status: "delivered" }, ev("bounced"))!.status, "bounced", "a later bounce wins");
  assert.equal(applyEvent({ status: "bounced" }, ev("delivered")), null, "delivered cannot undo a bounce");
  assert.equal(applyEvent({ status: "bounced" }, ev("complained"))!.status, "complained");
  assert.equal(applyEvent({ status: "complained" }, ev("bounced")), null);
  assert.ok(applyEvent({ status: "sent" }, ev("bounced"))!.lastError!.includes("HardBounce"));
});
test("webhook parsing (Postmark): delivery, hard/soft bounce, spam complaint; junk is ignored", () => {
  assert.deepEqual(parseWebhook({ RecordType: "Delivery", MessageID: "m1", Recipient: "A@x.com" }), { type: "delivered", messageId: "m1", email: "a@x.com", detail: "", suppress: false });
  const hard = parseWebhook({ RecordType: "Bounce", MessageID: "m2", Email: "a@x.com", Type: "HardBounce", Description: "mailbox does not exist" })!;
  assert.deepEqual([hard.type, hard.suppress], ["bounced", true]);
  const soft = parseWebhook({ RecordType: "Bounce", MessageID: "m3", Email: "a@x.com", Type: "SoftBounce", Description: "mailbox full" })!;
  assert.deepEqual([soft.type, soft.suppress], ["bounced", false]);
  assert.equal(parseWebhook({ RecordType: "SpamComplaint", MessageID: "m4", Email: "a@x.com" })!.type, "complained");
  for (const junk of [null, 5, {}, { RecordType: "Open", MessageID: "m" }, { RecordType: "Delivery" }]) assert.equal(parseWebhook(junk), null);
});
test("webhook authentication: only the configured credentials are accepted (constant-time compare)", () => {
  const cfg = { webhookUser: "hook", webhookPass: "s3cret-value" };
  const header = (u: string, p: string) => "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
  assert.equal(webhookAuthorized(header("hook", "s3cret-value"), cfg), true);
  for (const bad of [header("hook", "wrong"), header("x", "s3cret-value"), "Bearer abc", null, "Basic !!"]) assert.equal(webhookAuthorized(bad, cfg), false);
  assert.equal(webhookAuthorized(header("", ""), { webhookUser: "", webhookPass: "" }), false, "unconfigured = closed");
});

// ------------------------------------------------------ provider adapter
test("provider error classification", () => {
  assert.equal(classifyPostmark(null, null), "temporary");
  assert.equal(classifyPostmark(429, null), "temporary");
  assert.equal(classifyPostmark(503, null), "temporary");
  assert.equal(classifyPostmark(401, null), "fatal");
  assert.equal(classifyPostmark(422, 10), "fatal");
  assert.equal(classifyPostmark(422, 406), "inactive");
  assert.equal(classifyPostmark(422, 300), "permanent");
  assert.equal(classifyPostmark(422, 400), "permanent");
});
test("Postmark request: server-side token header, one To, base64 PDF attachment, tracking off, no cc/bcc", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fakeFetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ ErrorCode: 0, MessageID: "pm-1" }), { status: 200 }); }) as unknown as typeof fetch;
  const r = await new PostmarkProvider("tok-123", fakeFetch).send(await build(delivery("1")));
  assert.equal(r.messageId, "pm-1");
  assert.equal(seen!.url, "https://api.postmarkapp.com/email");
  assert.equal((seen!.init.headers as Record<string, string>)["X-Postmark-Server-Token"], "tok-123");
  const body = JSON.parse(seen!.init.body as string);
  assert.equal(body.To, "1@omtatvadigitals.com");
  assert.ok(!("Cc" in body) && !("Bcc" in body));
  assert.equal(body.TrackOpens, false);
  assert.equal(body.TrackLinks, "None");
  assert.equal(body.Attachments.length, 1);
  assert.equal(Buffer.from(body.Attachments[0].Content, "base64").toString(), "%PDF");
  assert.equal(body.Metadata.deliveryId, "1");
  assert.ok(!JSON.stringify(body).includes("tok-123"), "the token is never in the message body");
});
test("Postmark errors become classified ProviderErrors; network failure is temporary", async () => {
  const mk = (status: number, code: number) => (async () => new Response(JSON.stringify({ ErrorCode: code, Message: "nope" }), { status })) as unknown as typeof fetch;
  const msg = await build(delivery("1"));
  await assert.rejects(new PostmarkProvider("t", mk(422, 406)).send(msg), (e: ProviderError) => e.kind === "inactive");
  await assert.rejects(new PostmarkProvider("t", mk(401, 0)).send(msg), (e: ProviderError) => e.kind === "fatal");
  await assert.rejects(new PostmarkProvider("t", mk(500, 0)).send(msg), (e: ProviderError) => e.kind === "temporary");
  const down = (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
  await assert.rejects(new PostmarkProvider("t", down).send(msg), (e: ProviderError) => e.kind === "temporary");
});

// -------------------------------------------------------- config / secrets
test("configuration: reports what is missing by NAME only; defaults to OFF; From must be on the company domain", () => {
  const empty = loadEmailConfig({});
  assert.equal(empty.mode, "off");
  const problems = configProblems(empty);
  assert.ok(problems.some((p) => p.startsWith("POSTMARK_SERVER_TOKEN")) && problems.some((p) => p.startsWith("EMAIL_FROM")));
  const good = loadEmailConfig({ POSTMARK_SERVER_TOKEN: "t", EMAIL_FROM: "Omtatva Payroll <payroll@omtatvadigitals.com>", PAYSLIP_EMAIL_MODE: "test", POSTMARK_WEBHOOK_USER: "u", POSTMARK_WEBHOOK_PASS: "p" });
  assert.deepEqual(configProblems(good), []);
  assert.equal(good.fromDomain, "omtatvadigitals.com");
  assert.ok(configProblems(loadEmailConfig({ POSTMARK_SERVER_TOKEN: "t", EMAIL_FROM: "x@gmail.com", PAYSLIP_EMAIL_MODE: "live", POSTMARK_WEBHOOK_USER: "u", POSTMARK_WEBHOOK_PASS: "p" })).some((p) => p.includes("company domain")));
  assert.equal(loadEmailConfig({ PAYSLIP_EMAIL_MODE: "LIVE " }).mode, "live");
  assert.equal(loadEmailConfig({ PAYSLIP_EMAIL_MODE: "yes" }).mode, "off");
  assert.ok(!JSON.stringify(configProblems(good)).includes("tok"), "no secret values in problem text");
});

// ------------------------------------------------------------------ content
test("e-mail content: personalised, mentions the period and the PDF, contains NO salary figures, HTML is escaped", () => {
  const m = renderEmail({ employeeName: "Asha <script>alert(1)</script> Rao", periodLabel: "August 2026", companyName: "Omtatva Digitals", portalUrl: "https://portal.example", test: false });
  assert.ok(m.subject.includes("August 2026") && !m.subject.includes("[TEST]"));
  assert.ok(m.text.startsWith("Hello Asha,"));
  assert.ok(!m.html.includes("<script>"));
  assert.ok(!/\d{1,3}(,\d{2,3})*\.\d{2}|Rs\.|₹/.test(m.text + m.html), "no amounts in the body");
  assert.ok(renderEmail({ employeeName: "A", periodLabel: "X", companyName: "C", portalUrl: "u", test: true }).subject.startsWith("[TEST]"));
});

// --------------------------------------------------------------------- DNS
const resolver = (txt: Record<string, string[][] | "NOTFOUND" | "ERROR">, cname: Record<string, string[]> = {}): Resolver => ({
  async resolveTxt(name) {
    const v = txt[name];
    if (v === "ERROR") throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
    if (!v || v === "NOTFOUND") throw Object.assign(new Error("nx"), { code: "ENODATA" });
    return v;
  },
  async resolveCname(name) {
    if (!cname[name]) throw Object.assign(new Error("nx"), { code: "ENODATA" });
    return cname[name];
  },
});
test("DNS check: finds SPF / DKIM / DMARC, reports missing ones with the exact record to add, never claims inbox placement", async () => {
  const d = "omtatvadigitals.com";
  const ok = await checkEmailDns(d, resolver({
    [d]: [["v=spf1 include:spf.mtasv.net ~all"]],
    [`20260101pm._domainkey.${d}`]: [["k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1234567890abcdef"]],
    [`_dmarc.${d}`]: [["v=DMARC1; p=quarantine; rua=mailto:d@omtatvadigitals.com"]],
  }, { [`pm-bounces.${d}`]: ["pm.mtasv.net"] }), { dkimSelector: "20260101pm", returnPathHost: `pm-bounces.${d}` });
  assert.deepEqual(ok.map((i) => i.status), ["ok", "ok", "ok", "ok"]);
  const bare = await checkEmailDns(d, resolver({ [d]: "NOTFOUND" }), { dkimSelector: "sel" });
  assert.deepEqual(bare.map((i) => [i.id, i.status]), [["spf", "missing"], ["dkim", "missing"], ["dmarc", "missing"]]);
  assert.ok(bare[0].detail.includes("v=spf1 include:spf.mtasv.net") && bare[2].detail.includes("_dmarc.omtatvadigitals.com"));
  const mon = await checkEmailDns(d, resolver({ [d]: [["v=spf1 include:other.net -all"]], [`_dmarc.${d}`]: [["v=DMARC1; p=none"]] }), {});
  assert.deepEqual(mon.map((i) => i.status), ["warning", "unknown", "warning"]);
  const err = await checkEmailDns(d, resolver({ [d]: "ERROR", [`_dmarc.${d}`]: "ERROR" }), {});
  assert.equal(err[0].status, "unknown");
  assert.equal((await checkEmailDns("", resolver({}))).length, 1);
  const twoSpf = await checkEmailDns(d, resolver({ [d]: [["v=spf1 -all"], ["v=spf1 include:x ~all"]] }), {});
  assert.equal(twoSpf[0].status, "warning");
});

Promise.all(queue).then(() => console.log(`\n${passed} passed (payslip e-mail)${process.exitCode ? " - with FAILURES" : ""}`));
