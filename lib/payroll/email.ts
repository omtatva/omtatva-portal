// Payslip e-mail: pure rules (no network, no Firebase) so the safety behaviour
// — one e-mail per person per payroll revision, only valid verified company
// addresses, honest statuses — is unit-tested.

export type DeliveryStatus =
  | "queued" // waiting to be sent
  | "sending" // claimed by a worker (lease)
  | "sent" // accepted by the provider — NOT proof of delivery
  | "delivered" // the recipient's mail server accepted it (provider webhook)
  | "bounced" // the recipient's mail server rejected it (provider webhook)
  | "complained" // marked as spam by the recipient
  | "failed" // we could not hand it to the provider
  | "skipped" // not sent: invalid / unverified / suppressed address
  | "unknown"; // a worker died mid-send: may or may not have gone out

export type Delivery = {
  id: string; // = payslip id, so there is exactly one delivery per payslip
  period: string;
  revision: number;
  uid: string;
  employeeId: string;
  employeeName: string;
  toEmail: string | null;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  retryable: boolean;
  skipReason: string | null;
  providerMessageId: string | null;
  leaseUntilMs: number | null;
  batchId: string | null;
  mode: "test" | "live";
  // "link" = notification only ("your payslip is available in the portal"); "attachment" = the PDF is attached
  content?: "link" | "attachment";
};

// --------------------------------------------------------------- addresses
const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export function validateEmail(raw: unknown, allowedDomains: string[]): { ok: true; email: string } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "no e-mail address" };
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, reason: "no e-mail address" };
  if (email.length > 254 || /[\s,;<>()[\]\\"]/.test(email) || !EMAIL_RE.test(email)) return { ok: false, reason: "not a valid e-mail address" };
  const domain = email.split("@")[1];
  if (allowedDomains.length && !allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
    return { ok: false, reason: `address is not on a company domain (${domain})` };
  }
  return { ok: true, email };
}

export function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "—";
  return `${user.slice(0, 1)}${"*".repeat(Math.max(user.length - 1, 1))}@${domain}`;
}

// ----------------------------------------------------------- batch planning
export type PlanInput = {
  payslips: { id: string; uid: string }[];
  existing: ReadonlyMap<string, Pick<Delivery, "status" | "leaseUntilMs" | "toEmail">>;
  // from Firebase Auth (never from a free-text field): the person's address and whether it is verified
  accounts: ReadonlyMap<string, { email: string | null; emailVerified: boolean }>;
  suppressed: ReadonlySet<string>; // addresses that hard-bounced before
  allowedDomains: string[];
  nowMs: number;
};

export type PlanItem =
  | { id: string; uid: string; action: "queue"; email: string }
  | { id: string; uid: string; action: "skip"; reason: string; kind: "already" | "invalid" | "needs-review" };

export function planBatch(input: PlanInput): PlanItem[] {
  return input.payslips.map((p): PlanItem => {
    const have = input.existing.get(p.id);
    if (have) {
      if (have.status === "sent" || have.status === "delivered") return { id: p.id, uid: p.uid, action: "skip", kind: "already", reason: `already ${have.status}` };
      if (have.status === "sending" && (have.leaseUntilMs ?? 0) > input.nowMs) return { id: p.id, uid: p.uid, action: "skip", kind: "already", reason: "being sent right now" };
      // bounced / complained / failed / unknown are never re-sent by the normal button:
      // they need the controlled resend (reason, and a corrected address for bounces).
      if (["bounced", "complained", "failed", "unknown", "sending"].includes(have.status)) {
        return { id: p.id, uid: p.uid, action: "skip", kind: "needs-review", reason: `${have.status === "sending" ? "unknown" : have.status} — use Resend` };
      }
    }
    const account = input.accounts.get(p.uid);
    if (!account || !account.email) return { id: p.id, uid: p.uid, action: "skip", kind: "invalid", reason: "no sign-in account / e-mail on record" };
    if (!account.emailVerified) return { id: p.id, uid: p.uid, action: "skip", kind: "invalid", reason: "e-mail address is not verified" };
    const v = validateEmail(account.email, input.allowedDomains);
    if (!v.ok) return { id: p.id, uid: p.uid, action: "skip", kind: "invalid", reason: v.reason };
    if (input.suppressed.has(v.email)) return { id: p.id, uid: p.uid, action: "skip", kind: "invalid", reason: "this address hard-bounced before — fix the address first" };
    return { id: p.id, uid: p.uid, action: "queue", email: v.email };
  });
}

// A worker that died after claiming leaves "sending" with an expired lease.
// We cannot know whether the provider got it, so say so instead of guessing.
export function normalizeStale(d: Pick<Delivery, "status" | "leaseUntilMs">, nowMs: number): DeliveryStatus {
  return d.status === "sending" && (d.leaseUntilMs ?? 0) <= nowMs ? "unknown" : d.status;
}

// ------------------------------------------------------------ webhook events
export type ProviderEvent = { type: "delivered" | "bounced" | "complained"; messageId: string; email: string; detail: string; suppress: boolean };

// Provider events can arrive out of order or twice: bounce/complaint always win
// over delivered, and delivered never undoes them. Returns null when nothing changes.
export function applyEvent(current: Pick<Delivery, "status">, ev: ProviderEvent): { status: DeliveryStatus; lastError: string | null } | null {
  const s = current.status;
  if (ev.type === "delivered") {
    if (s === "bounced" || s === "complained" || s === "delivered") return null;
    return { status: "delivered", lastError: null };
  }
  if (ev.type === "bounced") {
    if (s === "bounced" || s === "complained") return null;
    return { status: "bounced", lastError: ev.detail.slice(0, 200) };
  }
  if (s === "complained") return null;
  return { status: "complained", lastError: "recipient marked the message as spam" };
}

// ------------------------------------------------------------------- content
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(input: { employeeName: string; periodLabel: string; companyName: string; portalUrl: string; test: boolean; attached?: boolean }) {
  const attached = input.attached !== false;
  const first = input.employeeName.trim().split(/\s+/)[0] || "there";
  const subject = `${input.test ? "[TEST] " : ""}Your payslip for ${input.periodLabel} — ${input.companyName}`;
  const text = [
    `Hello ${first},`,
    "",
    attached ? `Your payslip for ${input.periodLabel} is attached to this email as a PDF.` : `Your payslip for ${input.periodLabel} is now available in your portal dashboard.`,
    "",
    attached ? `You can also open it any time after signing in at ${input.portalUrl}/payslips` : `Sign in to view and download it: ${input.portalUrl}/payslips`,
    "",
    attached ? "This message was sent only to you. Please do not forward it — it contains your salary details." : "This message was sent only to you. For your security it contains no salary details — sign in to see them.",
    "If anything looks wrong, reply to HR rather than to this automated message.",
    "",
    input.companyName,
  ].join("\n");
  const html =
    `<p>Hello ${esc(first)},</p>` +
    (attached
      ? `<p>Your payslip for <b>${esc(input.periodLabel)}</b> is attached to this email as a PDF.</p>` +
        `<p>You can also open it any time after signing in at <a href="${esc(input.portalUrl)}/payslips">${esc(input.portalUrl)}/payslips</a>.</p>`
      : `<p>Your payslip for <b>${esc(input.periodLabel)}</b> is now available in your portal dashboard.</p>` +
        `<p><a href="${esc(input.portalUrl)}/payslips">Sign in to view and download it</a>.</p>`) +
    `<p style="color:#555;font-size:13px">${attached ? "This message was sent only to you. Please do not forward it — it contains your salary details." : "This message was sent only to you and contains no salary details — sign in to see them."}<br>` +
    `If anything looks wrong, reply to HR rather than to this automated message.</p>` +
    `<p>${esc(input.companyName)}</p>`;
  return { subject, text, html };
}
