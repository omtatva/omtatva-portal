// Transactional e-mail provider adapter (Postmark). The provider is a thin
// interface so the sending logic is tested with a fake one; credentials come
// ONLY from server environment variables / secrets.

import crypto from "node:crypto";
import type { ProviderEvent } from "./email";

export type EmailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachment: { name: string; contentType: string; data: Uint8Array };
  deliveryId: string; // echoed back in provider metadata
};

export type ErrorKind =
  | "temporary" // network / rate limit / provider 5xx — retry
  | "permanent" // this message can never succeed as-is
  | "inactive" // the provider already knows this address is dead
  | "fatal"; // our credentials / account are wrong — stop the whole batch

export class ProviderError extends Error {
  kind: ErrorKind;
  status: number | null;
  constructor(kind: ErrorKind, message: string, status: number | null = null) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<{ messageId: string }>;
}

// Postmark: HTTP status + ErrorCode (https://postmarkapp.com/developer/api/overview#error-codes)
export function classifyPostmark(httpStatus: number | null, errorCode: number | null): ErrorKind {
  if (httpStatus === null) return "temporary"; // network failure / timeout
  if (httpStatus === 401 || httpStatus === 403 || errorCode === 10 || errorCode === 100) return "fatal"; // bad token / inactive account
  if (errorCode === 406) return "inactive"; // inactive recipient
  if (httpStatus === 429 || httpStatus >= 500 || errorCode === 405 || errorCode === 409) return "temporary";
  return "permanent"; // 300 invalid email, 400, 410 attachment problems, other 4xx
}

export class PostmarkProvider implements EmailProvider {
  constructor(
    private token: string,
    private fetchImpl: typeof fetch = fetch,
    private timeoutMs = 20_000
  ) {}

  async send(msg: EmailMessage): Promise<{ messageId: string }> {
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": this.token },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          From: msg.from,
          To: msg.to, // exactly one recipient — never Cc/Bcc
          ReplyTo: msg.replyTo,
          Subject: msg.subject,
          TextBody: msg.text,
          HtmlBody: msg.html,
          MessageStream: "outbound",
          TrackOpens: false,
          TrackLinks: "None",
          Metadata: { deliveryId: msg.deliveryId },
          Attachments: [{ Name: msg.attachment.name, Content: Buffer.from(msg.attachment.data).toString("base64"), ContentType: msg.attachment.contentType }],
        }),
      });
    } catch (e) {
      throw new ProviderError("temporary", `network error: ${(e as Error).message}`.slice(0, 200));
    }
    let body: { ErrorCode?: number; Message?: string; MessageID?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* non-JSON body */
    }
    if (!res.ok || (body.ErrorCode ?? 0) !== 0) {
      throw new ProviderError(classifyPostmark(res.status, body.ErrorCode ?? null), `provider ${res.status}/${body.ErrorCode ?? "?"}: ${body.Message || "error"}`.slice(0, 200), res.status);
    }
    if (!body.MessageID) throw new ProviderError("temporary", "provider accepted the message but returned no id", res.status);
    return { messageId: body.MessageID };
  }
}

// ------------------------------------------------------------------- config
export type EmailMode = "off" | "test" | "live";

export type EmailConfig = {
  mode: EmailMode;
  token: string;
  from: string;
  replyTo: string;
  fromDomain: string;
  allowedDomains: string[];
  testRecipient: string;
  webhookUser: string;
  webhookPass: string;
  dkimSelector: string;
  portalUrl: string;
};

export function loadEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  const from = (env.EMAIL_FROM || "").trim();
  const addr = /<([^>]+)>/.exec(from)?.[1] || from;
  const fromDomain = (addr.split("@")[1] || "").toLowerCase();
  const mode = (["off", "test", "live"] as const).find((m) => m === (env.PAYSLIP_EMAIL_MODE || "").trim().toLowerCase()) || "off";
  return {
    mode,
    token: (env.POSTMARK_SERVER_TOKEN || "").trim(),
    from,
    replyTo: (env.EMAIL_REPLY_TO || "").trim(),
    fromDomain,
    allowedDomains: (env.EMAIL_ALLOWED_DOMAINS || "omtatvadigitals.com").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
    testRecipient: (env.PAYSLIP_EMAIL_TEST_RECIPIENT || "").trim().toLowerCase(),
    webhookUser: (env.POSTMARK_WEBHOOK_USER || "").trim(),
    webhookPass: (env.POSTMARK_WEBHOOK_PASS || "").trim(),
    dkimSelector: (env.EMAIL_DKIM_SELECTOR || "").trim(),
    portalUrl: (env.PORTAL_BASE_URL || "https://omtatva-portal.web.app").replace(/\/+$/, ""),
  };
}

// What still has to be configured on the server (names only — never values).
export function configProblems(c: EmailConfig): string[] {
  const out: string[] = [];
  if (!c.token) out.push("POSTMARK_SERVER_TOKEN is not set");
  if (!c.from) out.push("EMAIL_FROM is not set");
  else if (!c.fromDomain || !c.allowedDomains.includes(c.fromDomain)) out.push("EMAIL_FROM must use your company domain so SPF/DKIM/DMARC align");
  if (!c.webhookUser || !c.webhookPass) out.push("POSTMARK_WEBHOOK_USER / POSTMARK_WEBHOOK_PASS are not set (delivery and bounce tracking is off)");
  if (c.mode === "off") out.push("PAYSLIP_EMAIL_MODE is \"off\" (set \"test\", then \"live\")");
  return out;
}

export function webhookAuthorized(authHeader: string | null, c: Pick<EmailConfig, "webhookUser" | "webhookPass">): boolean {
  if (!c.webhookUser || !c.webhookPass || !authHeader?.startsWith("Basic ")) return false;
  const given = Buffer.from(authHeader.slice(6), "base64");
  const want = Buffer.from(`${c.webhookUser}:${c.webhookPass}`);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

// Postmark webhook body -> our event (anything else is ignored).
export function parseWebhook(body: unknown): ProviderEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const messageId = typeof b.MessageID === "string" ? b.MessageID : "";
  if (!messageId) return null;
  const email = String(b.Recipient || b.Email || "").toLowerCase();
  switch (b.RecordType) {
    case "Delivery":
      return { type: "delivered", messageId, email, detail: "", suppress: false };
    case "Bounce": {
      const hard = b.Type === "HardBounce" || b.Inactive === true;
      return { type: "bounced", messageId, email, detail: `${String(b.Type || "Bounce")}: ${String(b.Description || "").slice(0, 150)}`, suppress: hard };
    }
    case "SpamComplaint":
      return { type: "complained", messageId, email, detail: "spam complaint", suppress: true };
    default:
      return null;
  }
}
