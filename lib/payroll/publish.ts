// Publication of payslips to employees ("Send to Employees").
//
//   Draft (not approved) → Approved → Generated → PUBLISHED → (Reissued after a reversal + new approval)
//
// Pure rules, so what an employee may see and what a publish click does are
// unit-tested. An employee sees a payslip only when it is BOTH issued (not
// voided) AND published; generating payslips alone never exposes them.

export type SlipLite = {
  id: string;
  uid: string;
  period: string; // YYYY-MM
  revision: number;
  status: string; // issued | voided
  published: boolean;
  netPay: number;
  gross: number;
  employeeId: string;
  employeeName: string;
  publishedAtIso: string | null;
};

export const visibleToEmployee = (p: Pick<SlipLite, "status" | "published">): boolean => p.status === "issued" && p.published === true;

// Which payslips a "Send to Employees" click would publish. Idempotent: anything
// already published is only counted, never touched again.
export function planPublish(slips: Pick<SlipLite, "id" | "status" | "published">[]) {
  const toPublish: string[] = [];
  const already: string[] = [];
  const blocked: string[] = [];
  for (const s of slips) {
    if (s.status !== "issued") blocked.push(s.id);
    else if (s.published) already.push(s.id);
    else toPublish.push(s.id);
  }
  return { toPublish, already, blocked };
}

export type IndexItem = {
  id: string;
  period: string;
  revision: number;
  employeeId: string;
  employeeName: string;
  netPay: number;
  gross: number;
  publishedAt: string | null;
  status: "Published" | "Reissued";
};

export const MAX_INDEX_ITEMS = 36;

// The employee's own list for the dashboard widget: for each month only the
// newest published revision; a later revision (after a reversal) shows as "Reissued".
export function buildIndex(slips: SlipLite[]): IndexItem[] {
  const best = new Map<string, SlipLite>();
  for (const s of slips) {
    if (!visibleToEmployee(s)) continue;
    const have = best.get(s.period);
    if (!have || s.revision > have.revision) best.set(s.period, s);
  }
  return [...best.values()]
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, MAX_INDEX_ITEMS)
    .map((s) => ({
      id: s.id, period: s.period, revision: s.revision, employeeId: s.employeeId, employeeName: s.employeeName,
      netPay: s.netPay, gross: s.gross, publishedAt: s.publishedAtIso, status: s.revision > 1 ? "Reissued" : "Published",
    }));
}

// Where a month stands, for the HR screen.
export type PublishStage = "draft" | "approved" | "generated" | "published";

export function stageOf(run: { status: string; publishedAt?: unknown } | null): PublishStage {
  if (!run) return "draft";
  if (run.status === "approved") return "approved";
  if (run.status === "payslips_generated") return run.publishedAt ? "published" : "generated";
  return "draft";
}
