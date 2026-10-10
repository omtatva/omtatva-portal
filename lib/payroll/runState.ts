// The payroll-period state machine and the idempotency plans. Pure, so the
// rules that stop duplicate runs / duplicate payslips are unit-tested; the
// server only EXECUTES these plans inside Firestore transactions.
//
//   (none) ──approve──▶ approving ──▶ approved ──generate──▶ payslips_generated
//                                        │                        │
//                                        └──────── reverse ───────┘
//                                                   ▼
//                                               reversed ──approve──▶ (revision + 1)

import crypto from "node:crypto";

export type RunStatus = "approving" | "approved" | "payslips_generated" | "reversed";

export type RunState = {
  period: string;
  status: RunStatus;
  revision: number;
  approvingSinceMs?: number | null;
};

export class RunConflict extends Error {
  status = 409;
  code = "conflict";
}

export const APPROVING_LOCK_MS = 10 * 60 * 1000;

export const payslipId = (period: string, uid: string, revision: number) => `${period}_${uid}_r${revision}`;
export const entryId = (period: string, uid: string, revision: number) => `${period}_r${revision}_${uid}`;

export function planApprove(run: RunState | null, nowMs: number): { revision: number; resume: boolean } {
  if (!run) return { revision: 1, resume: false };
  switch (run.status) {
    case "reversed":
      return { revision: run.revision + 1, resume: false };
    case "approving":
      if (run.approvingSinceMs && nowMs - run.approvingSinceMs < APPROVING_LOCK_MS) {
        throw new RunConflict(`Payroll for ${run.period} is already being approved. Wait a few minutes and refresh.`);
      }
      // a crashed attempt: safe to resume, entry ids are deterministic
      return { revision: run.revision, resume: true };
    case "approved":
    case "payslips_generated":
      throw new RunConflict(`Payroll for ${run.period} is already approved (revision ${run.revision}). Reverse it first if it must be recalculated.`);
  }
}

export function planReverse(run: RunState | null): { revision: number } {
  if (!run || (run.status !== "approved" && run.status !== "payslips_generated")) {
    throw new RunConflict("Only an approved payroll period can be reversed.");
  }
  return { revision: run.revision };
}

export function canEditDecisions(run: RunState | null): boolean {
  return !run || run.status === "reversed";
}

export function planGenerate(run: RunState | null): { revision: number } {
  if (!run || (run.status !== "approved" && run.status !== "payslips_generated")) {
    throw new RunConflict("Approve the payroll for this period before generating payslips.");
  }
  return { revision: run.revision };
}

export type ExistingPayslip = { status: string; entryHash: string };

// Which payslips to create now. Existing + same content => skipped (so
// pressing the button twice, or after a crash, creates nothing new).
export function planPayslips(
  period: string,
  revision: number,
  entries: { uid: string; entryHash: string }[],
  existing: ReadonlyMap<string, ExistingPayslip>
) {
  const create: { id: string; uid: string; entryHash: string }[] = [];
  const skip: string[] = [];
  const conflict: string[] = [];
  for (const e of entries) {
    const id = payslipId(period, e.uid, revision);
    const have = existing.get(id);
    if (!have) create.push({ id, uid: e.uid, entryHash: e.entryHash });
    else if (have.entryHash === e.entryHash && have.status === "issued") skip.push(id);
    else conflict.push(id); // same id, different content or voided: never overwritten
  }
  return { create, skip, conflict };
}

// ------------------------------------------------------------------ hashing
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export const sha256 = (s: string | Uint8Array) => crypto.createHash("sha256").update(s).digest("hex");
export const hashOf = (v: unknown) => sha256(stableStringify(v));
