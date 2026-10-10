// Sending orchestration. It works against two small interfaces (a delivery
// store and an e-mail provider) so the duplicate-send protection, retries and
// failure handling are tested with in-memory fakes.
//
// Duplicate protection: every payslip has exactly ONE delivery record (its id
// is the payslip id). A worker must atomically CLAIM it (queued → sending)
// before calling the provider; a second click, a second tab or a retry after a
// crash finds it already claimed/sent and does nothing.

import type { Delivery } from "./email";
import { ProviderError, type EmailMessage, type EmailProvider } from "./emailProvider";

export interface DeliveryStore {
  // Atomic. Returns the claimed delivery, or null when it is not claimable
  // (already sent/delivered/sending, or not queued).
  claim(id: string, nowMs: number, leaseMs: number, allowFailed: boolean): Promise<Delivery | null>;
  update(id: string, patch: Partial<Delivery> & Record<string, unknown>): Promise<void>;
}

export type SendOutcome = {
  id: string;
  result: "sent" | "skipped" | "failed" | "fatal";
  error?: string;
  suppress?: string; // address that should not be mailed again
};

export const RETRY_DELAYS_MS = [1_000, 4_000, 15_000];
export const MAX_ATTEMPTS = 3;
const LEASE_MS = 2 * 60 * 1000;

export type SendDeps = {
  store: DeliveryStore;
  provider: EmailProvider;
  build: (d: Delivery) => Promise<EmailMessage>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  allowFailed?: boolean; // controlled resend of a failed delivery
};

const clean = (s: string) => s.replace(/\s+/g, " ").slice(0, 200); // never contains payslip contents

export async function sendOne(deps: SendDeps, id: string): Promise<SendOutcome> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = deps.maxAttempts ?? MAX_ATTEMPTS;

  const claimed = await deps.store.claim(id, now(), LEASE_MS, deps.allowFailed === true);
  if (!claimed) return { id, result: "skipped" };

  let message: EmailMessage;
  try {
    message = await deps.build(claimed);
  } catch (e) {
    await deps.store.update(id, { status: "failed", retryable: false, lastError: clean(`could not prepare the message: ${(e as Error).message}`), leaseUntilMs: null });
    return { id, result: "failed", error: "could not prepare the message" };
  }

  let attempts = claimed.attempts;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts += 1;
    try {
      const { messageId } = await deps.provider.send(message);
      await deps.store.update(id, { status: "sent", providerMessageId: messageId, attempts, lastError: null, retryable: false, leaseUntilMs: null, sentAtMs: now() });
      return { id, result: "sent" };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError("temporary", (e as Error).message || "unknown error");
      if (err.kind === "fatal") {
        // our credentials/account are wrong: give the delivery back and stop the whole batch
        await deps.store.update(id, { status: "queued", attempts, lastError: clean(err.message), retryable: true, leaseUntilMs: null });
        return { id, result: "fatal", error: clean(err.message) };
      }
      if (err.kind === "temporary" && attempt < maxAttempts) {
        await deps.store.update(id, { attempts, lastError: clean(err.message), leaseUntilMs: now() + LEASE_MS });
        await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
        continue;
      }
      await deps.store.update(id, {
        status: "failed", attempts, lastError: clean(err.message), retryable: err.kind === "temporary", leaseUntilMs: null,
        ...(err.kind === "inactive" ? { skipReason: "address is inactive at the provider (earlier hard bounce)" } : {}),
      });
      return { id, result: "failed", error: clean(err.message), ...(err.kind === "inactive" ? { suppress: message.to } : {}) };
    }
  }
  return { id, result: "failed", error: "retries exhausted" };
}

export type BatchResult = { sent: number; skipped: number; failed: number; remaining: string[]; stoppedFatal: string | null; suppress: string[] };

// Sends a list of deliveries with limited concurrency and a time budget; what
// does not fit stays queued and the caller simply continues.
export async function runBatch(deps: SendDeps, ids: string[], opts: { concurrency?: number; budgetMs?: number } = {}): Promise<BatchResult> {
  const now = deps.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? 40_000);
  const queue = [...ids];
  const out: BatchResult = { sent: 0, skipped: 0, failed: 0, remaining: [], stoppedFatal: null, suppress: [] };

  const worker = async () => {
    while (queue.length > 0 && out.stoppedFatal === null && now() < deadline) {
      const id = queue.shift()!;
      const r = await sendOne(deps, id);
      if (r.result === "sent") out.sent += 1;
      else if (r.result === "skipped") out.skipped += 1;
      else if (r.result === "failed") {
        out.failed += 1;
        if (r.suppress) out.suppress.push(r.suppress);
      } else {
        out.stoppedFatal = r.error || "provider rejected our credentials";
        queue.unshift(id);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
  out.remaining = queue;
  return out;
}
