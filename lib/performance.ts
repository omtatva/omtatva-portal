// Performance ratings — the rules, as pure functions (no Firebase), so who may
// rate whom, and what needs approval before an employee sees it, is tested.
//
//   Team Lead  → rates their direct reports        → needs their MANAGER's approval
//   Manager    → rates people under them           → published straight away
//   Head / Admin / Super Admin → rate anyone       → published straight away
//   Employee / HR → no rating access
//
// An employee only ever sees APPROVED (published) ratings.

import { normalizeRole, type RoleValue } from "./roles";

export const RATINGS = [
  { value: "Excellent", score: 5, color: "#16a34a", emoji: "🌟" },
  { value: "Very Good", score: 4, color: "#2563eb", emoji: "✅" },
  { value: "Good", score: 3, color: "#0ea5e9", emoji: "👍" },
  { value: "Average", score: 2, color: "#f59e0b", emoji: "⚠️" },
  { value: "Needs Improvement", score: 1, color: "#dc2626", emoji: "📉" },
] as const;

export type RatingValue = (typeof RATINGS)[number]["value"];

export const ratingInfo = (value: string | null | undefined) => RATINGS.find((r) => r.value === value) || null;
export const isRatingValue = (v: unknown): v is RatingValue => typeof v === "string" && RATINGS.some((r) => r.value === v);

export const MAX_COMMENT = 500;
export const RATER_ROLES: RoleValue[] = ["team_lead", "manager", "head", "admin", "super_admin"];
export const COMPANY_WIDE_ROLES: RoleValue[] = ["head", "admin", "super_admin"];

export type RatingStatus = "pending" | "approved" | "rejected";

export const canUseRatings = (roleRaw: string | null | undefined): boolean => RATER_ROLES.includes(normalizeRole(roleRaw));

// ---------------------------------------------------------------- the tree
// managerOf: employeeUid -> managerUid ("" or missing = no manager)
export type ManagerMap = ReadonlyMap<string, string>;

export function directReports(managerOf: ManagerMap, managerUid: string): string[] {
  return [...managerOf.entries()].filter(([, m]) => m === managerUid).map(([e]) => e);
}

export function descendants(managerOf: ManagerMap, managerUid: string, maxDepth = 12): string[] {
  const out = new Set<string>();
  let frontier = [managerUid];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const m of frontier) for (const e of directReports(managerOf, m)) if (e !== managerUid && !out.has(e)) { out.add(e); next.push(e); }
    frontier = next;
  }
  return [...out];
}

// ------------------------------------------------------------ who rates whom
export function canRate(input: { raterRole: string | null | undefined; raterUid: string; subjectUid: string; managerOf: ManagerMap }): boolean {
  const role = normalizeRole(input.raterRole);
  if (!input.subjectUid || input.subjectUid === input.raterUid) return false; // never yourself
  if (COMPANY_WIDE_ROLES.includes(role)) return true;
  if (role === "manager") return descendants(input.managerOf, input.raterUid).includes(input.subjectUid);
  if (role === "team_lead") return directReports(input.managerOf, input.raterUid).includes(input.subjectUid);
  return false;
}

// Everyone this person may rate (from the active people list).
export function ratableUids(input: { raterRole: string | null | undefined; raterUid: string; everyone: string[]; managerOf: ManagerMap }): string[] {
  return input.everyone.filter((uid) => canRate({ raterRole: input.raterRole, raterUid: input.raterUid, subjectUid: uid, managerOf: input.managerOf }));
}

// A Team Lead's rating is a PROPOSAL until their manager approves it.
export const needsApproval = (raterRole: string | null | undefined): boolean => normalizeRole(raterRole) === "team_lead";

// Who may approve / reject a pending rating that `submitterUid` (a team lead) made.
export function canReview(input: { reviewerRole: string | null | undefined; reviewerUid: string; submitterUid: string; subjectUid: string; managerOf: ManagerMap }): boolean {
  const role = normalizeRole(input.reviewerRole);
  if (input.reviewerUid === input.submitterUid || input.reviewerUid === input.subjectUid) return false; // never your own work / about yourself
  if (COMPANY_WIDE_ROLES.includes(role)) return true;
  // the submitter's own manager
  return role === "manager" && (input.managerOf.get(input.submitterUid) || "") === input.reviewerUid;
}

// The person who should approve a team lead's rating (for display / routing).
export const approverOf = (submitterUid: string, managerOf: ManagerMap): string | null => managerOf.get(submitterUid) || null;

// ---------------------------------------------------------------- the data
export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validateSubmission(input: { rating: unknown; period: unknown; comment: unknown; currentPeriod: string }): { ok: true; rating: RatingValue; period: string; comment: string } | { ok: false; error: string } {
  if (!isRatingValue(input.rating)) return { ok: false, error: "Choose a rating." };
  if (typeof input.period !== "string" || !PERIOD_RE.test(input.period)) return { ok: false, error: "Choose a valid review month." };
  if (input.period > input.currentPeriod) return { ok: false, error: "You cannot rate a month that has not started." };
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > MAX_COMMENT) return { ok: false, error: `Keep the comment under ${MAX_COMMENT} characters.` };
  return { ok: true, rating: input.rating, period: input.period, comment };
}

export type PublishedRating = {
  rating: RatingValue;
  score: number;
  comment: string;
  publishedAt: string | null;
  ratedBy: string; // display name + role, e.g. "Priya Shah (Manager)"
  approvedBy: string | null;
};

export type IndexEntry = PublishedRating & { period: string };

// What the employee's dashboard card shows: newest month first, one entry per month.
export function buildPerformanceIndex(entries: IndexEntry[], limit = 24): { latest: IndexEntry | null; items: IndexEntry[]; average: number | null } {
  const byPeriod = new Map<string, IndexEntry>();
  for (const e of entries) byPeriod.set(e.period, e);
  const items = [...byPeriod.values()].sort((a, b) => b.period.localeCompare(a.period)).slice(0, limit);
  const recent = items.slice(0, 6);
  const average = recent.length ? Math.round((recent.reduce((s, e) => s + e.score, 0) / recent.length) * 10) / 10 : null;
  return { latest: items[0] || null, items, average };
}
