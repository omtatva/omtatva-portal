// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  approverOf, buildPerformanceIndex, canRate, canReview, canUseRatings, descendants, directReports, needsApproval, ratableUids, validateSubmission,
  type IndexEntry, type ManagerMap,
} from "../lib/performance";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

// head ─ mgr1 ─ tl1 ─ e1, e2          mgr2 ─ tl2 ─ e3
//         └──── e4 (direct)                └ e5 (direct)
const managerOf: ManagerMap = new Map([
  ["mgr1", "head"], ["mgr2", "head"], ["tl1", "mgr1"], ["e1", "tl1"], ["e2", "tl1"], ["e4", "mgr1"],
  ["tl2", "mgr2"], ["e3", "tl2"], ["e5", "mgr2"],
]);
const everyone = ["head", "mgr1", "mgr2", "tl1", "tl2", "e1", "e2", "e3", "e4", "e5"];

test("who can open the ratings screen: Team Lead, Manager, Head, Admin, Super Admin — not Employee or HR", () => {
  for (const r of ["team_lead", "manager", "head", "admin", "super_admin", "Super Admin", "Team Lead"]) assert.equal(canUseRatings(r), true, r);
  for (const r of ["employee", "hr", "HR Admin", "", null, undefined, "intern"]) assert.equal(canUseRatings(r as string), false, String(r));
});
test("tree helpers", () => {
  assert.deepEqual(directReports(managerOf, "mgr1").sort(), ["e4", "tl1"]);
  assert.deepEqual(descendants(managerOf, "mgr1").sort(), ["e1", "e2", "e4", "tl1"]);
  assert.deepEqual(descendants(managerOf, "e1"), []);
});
test("a Team Lead rates only their direct reports", () => {
  assert.deepEqual(ratableUids({ raterRole: "team_lead", raterUid: "tl1", everyone, managerOf }).sort(), ["e1", "e2"]);
  assert.equal(canRate({ raterRole: "team_lead", raterUid: "tl1", subjectUid: "e3", managerOf }), false, "another team's employee");
  assert.equal(canRate({ raterRole: "team_lead", raterUid: "tl1", subjectUid: "mgr1", managerOf }), false, "their own manager");
  assert.equal(canRate({ raterRole: "team_lead", raterUid: "tl1", subjectUid: "e4", managerOf }), false, "a peer-level direct of the manager");
});
test("a Manager rates the team leads (and everyone) under them — not other managers' people", () => {
  assert.deepEqual(ratableUids({ raterRole: "manager", raterUid: "mgr1", everyone, managerOf }).sort(), ["e1", "e2", "e4", "tl1"]);
  assert.equal(canRate({ raterRole: "manager", raterUid: "mgr1", subjectUid: "tl2", managerOf }), false);
  assert.equal(canRate({ raterRole: "manager", raterUid: "mgr1", subjectUid: "head", managerOf }), false, "never upwards");
});
test("Head / Admin / Super Admin can rate anyone — except themselves", () => {
  for (const role of ["head", "admin", "super_admin"]) {
    const list = ratableUids({ raterRole: role, raterUid: "head", everyone, managerOf });
    assert.equal(list.length, everyone.length - 1);
    assert.ok(!list.includes("head"));
  }
});
test("nobody can rate themselves; Employee/HR can rate no one", () => {
  for (const role of ["team_lead", "manager", "head", "admin", "super_admin"]) assert.equal(canRate({ raterRole: role, raterUid: "x", subjectUid: "x", managerOf }), false, role);
  for (const role of ["employee", "hr"]) assert.equal(canRate({ raterRole: role, raterUid: "hr1", subjectUid: "e1", managerOf }), false, role);
});
test("only a Team Lead's rating needs approval; the others publish directly", () => {
  assert.equal(needsApproval("team_lead"), true);
  for (const r of ["manager", "head", "admin", "super_admin"]) assert.equal(needsApproval(r), false, r);
});
test("approval: the team lead's own manager or a Head/Admin/Super Admin — never the author or the person rated", () => {
  const base = { submitterUid: "tl1", subjectUid: "e1", managerOf };
  assert.equal(canReview({ ...base, reviewerRole: "manager", reviewerUid: "mgr1" }), true);
  assert.equal(canReview({ ...base, reviewerRole: "manager", reviewerUid: "mgr2" }), false, "another team's manager");
  for (const r of ["head", "admin", "super_admin"]) assert.equal(canReview({ ...base, reviewerRole: r, reviewerUid: "someone" }), true, r);
  assert.equal(canReview({ ...base, reviewerRole: "team_lead", reviewerUid: "tl2" }), false);
  assert.equal(canReview({ ...base, reviewerRole: "employee", reviewerUid: "e1" }), false);
  assert.equal(canReview({ ...base, reviewerRole: "admin", reviewerUid: "tl1" }), false, "cannot approve your own submission");
  assert.equal(canReview({ ...base, reviewerRole: "admin", reviewerUid: "e1" }), false, "cannot approve a rating about yourself");
  assert.equal(approverOf("tl1", managerOf), "mgr1");
  assert.equal(approverOf("head", managerOf), null);
});
test("validation: a real rating, a valid month that has started, a bounded comment", () => {
  const ok = validateSubmission({ rating: "Good", period: "2026-08", comment: "  steady  ", currentPeriod: "2026-09" });
  assert.deepEqual(ok, { ok: true, rating: "Good", period: "2026-08", comment: "steady" });
  assert.equal(validateSubmission({ rating: "Amazing", period: "2026-08", comment: "", currentPeriod: "2026-09" }).ok, false);
  assert.equal(validateSubmission({ rating: "Good", period: "2026-13", comment: "", currentPeriod: "2026-09" }).ok, false);
  assert.equal(validateSubmission({ rating: "Good", period: "2026-10", comment: "", currentPeriod: "2026-09" }).ok, false);
  assert.equal(validateSubmission({ rating: "Good", period: "2026-08", comment: "x".repeat(501), currentPeriod: "2026-09" }).ok, false);
});
test("employee view: one entry per month, newest first, average of the last 6", () => {
  const e = (period: string, score: number, rating: IndexEntry["rating"]): IndexEntry => ({ period, score, rating, comment: "", publishedAt: null, ratedBy: "A (Manager)", approvedBy: null });
  const idx = buildPerformanceIndex([e("2026-06", 3, "Good"), e("2026-08", 5, "Excellent"), e("2026-07", 4, "Very Good"), e("2026-08", 4, "Very Good")]);
  assert.deepEqual(idx.items.map((i) => i.period), ["2026-08", "2026-07", "2026-06"]);
  assert.equal(idx.latest!.rating, "Very Good", "a later entry for the same month replaces the earlier one");
  assert.equal(idx.average, 3.7);
  assert.deepEqual(buildPerformanceIndex([]), { latest: null, items: [], average: null });
});

// ------------------------------------------------------------ server / UI contracts
const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const server = read("lib/server/performanceServer.ts");
const fn = (name: string) => {
  const i = server.indexOf(`export async function ${name}(`);
  assert.ok(i >= 0, name);
  const j = server.indexOf("\nexport ", i + 10);
  return server.slice(i, j < 0 ? undefined : j);
};

test("server: every action starts from the verified user's role and the reporting structure — nothing from the browser decides authority", () => {
  for (const n of ["performanceOverview", "submitRating", "reviewRating"]) assert.ok(fn(n).includes("await context(user)"), n);
  const ctx = server.slice(server.indexOf("async function context("), server.indexOf("const nameOf"));
  assert.ok(ctx.includes("memberFor(user)") && ctx.includes("canUseRatings(actor.role)") && ctx.includes('"reportingStructure"') && ctx.includes('"adminAccess"'));
  assert.ok(ctx.includes('status === "active"') && ctx.includes("removedEmployees"));
});
test("server: submit checks canRate, validates, sets pending ONLY for a team lead, and never changes what the employee already sees for a proposal", () => {
  const b = fn("submitRating");
  assert.ok(b.includes("canRate({") && b.includes("validateSubmission(") && b.includes("needsApproval(c.actor.role)"));
  assert.ok(b.includes("prev?.published ?? null") && b.includes("if (!pending) await rebuildPerformanceIndex(subjectUid)"));
  assert.ok(b.includes('status: pending ? "pending" : "approved"') && b.includes("approverUid"));
});
test("server: review needs a pending rating and canReview; reject needs a reason; only approval publishes", () => {
  const b = fn("reviewRating");
  assert.ok(b.includes('r.status !== "pending"') && b.includes("canReview({") && b.includes("note.length < 5"));
  assert.ok(b.includes('if (decision === "approve") await rebuildPerformanceIndex(subjectUid)'));
  assert.ok(b.includes("history"), "an audit trail is kept on the record");
});
test("rules: ratings are server-only; an employee can read only their OWN performanceIndex", () => {
  const rules = read("firestore.rules");
  assert.ok(/match \/performanceRatings\/\{id\}\s*\{ allow read, write: if false; \}/.test(rules));
  assert.ok(/match \/performanceIndex\/\{uid\}\s*\{ allow read: if isMember\(\) && request\.auth\.uid == uid; allow write: if false; \}/.test(rules));
});
test("route: token verified first; only overview / rate / review exist", () => {
  const r = read("app/api/performance/[action]/route.ts");
  assert.ok(r.indexOf("verifyRequest(req)") < r.indexOf("performanceOverview("));
  for (const a of ['"overview"', '"rate"', '"review"']) assert.ok(r.includes(a), a);
});
test("UI: rating editor removed from Users → details; new page + dashboard entry points are role-gated; employee card is real-time and sits above Quick Actions", () => {
  const users = read("app/admin/users/[id]/page.js");
  assert.ok(!users.includes("Select Rating") && !users.includes("setPerformance") && users.includes("no longer edited here"));
  assert.ok(read("app/performance/page.tsx").includes("/api/performance/overview") && read("app/performance/page.tsx").includes("Waiting for your approval"));
  const dash = read("app/dashboard/page.js");
  assert.ok(dash.includes("showTeamPerformance") && dash.includes("canUseRatings(accessRole)"));
  assert.ok(dash.indexOf("<PerformanceCard") > 0 && dash.indexOf("<PerformanceCard") < dash.indexOf("🚀 Quick Actions"), "the card is no longer at the bottom");
  const activeDash = dash.split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith("//")).join(String.fromCharCode(10));
  assert.ok(!activeDash.includes("Rated by HR Department"), "the old bottom card is gone");
  const adm = read("app/admin/page.js");
  assert.ok(adm.includes('"/performance"') && adm.includes('["head", "admin", "super_admin"]'));
  const card = read("components/PerformanceCard.tsx");
  assert.ok(card.includes('doc(db, "performanceIndex", u.uid)') && card.includes("onSnapshot("));
});

console.log(`\n${passed} passed (performance ratings)${process.exitCode ? " - with FAILURES" : ""}`);
