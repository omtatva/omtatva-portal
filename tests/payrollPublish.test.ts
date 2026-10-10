// Run with:  npm run test:payroll
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildIndex, planPublish, stageOf, visibleToEmployee, type SlipLite } from "../lib/payroll/publish";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};
const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const slip = (o: Partial<SlipLite> = {}): SlipLite => ({
  id: `${o.period || "2026-08"}_${o.uid || "u1"}_r${o.revision || 1}`, uid: "u1", period: "2026-08", revision: 1, status: "issued", published: false,
  netPay: 43200, gross: 50000, employeeId: "E1", employeeName: "Asha", publishedAtIso: null, ...o,
});

test("an employee sees a payslip only when it is issued AND published", () => {
  assert.equal(visibleToEmployee(slip()), false, "generated but not published");
  assert.equal(visibleToEmployee(slip({ published: true })), true);
  assert.equal(visibleToEmployee(slip({ published: true, status: "voided" })), false);
  assert.equal(visibleToEmployee(slip({ published: false, status: "voided" })), false);
});
test("publish plan: only unpublished, issued payslips are published; already-published are counted, not touched", () => {
  const plan = planPublish([slip({ id: "a" }), slip({ id: "b", published: true }), slip({ id: "c", status: "voided" }), slip({ id: "d" })]);
  assert.deepEqual(plan.toPublish, ["a", "d"]);
  assert.deepEqual(plan.already, ["b"]);
  assert.deepEqual(plan.blocked, ["c"]);
});
test("duplicate click: after a publish, the same plan has nothing left to publish (idempotent)", () => {
  const before = [slip({ id: "a" }), slip({ id: "b" })];
  const first = planPublish(before);
  assert.equal(first.toPublish.length, 2);
  const after = before.map((s) => ({ ...s, published: true }));
  const second = planPublish(after);
  assert.deepEqual([second.toPublish.length, second.already.length], [0, 2]);
});
test("a failed publish is retried safely: only the unpublished remainder is planned", () => {
  const partial = [slip({ id: "a", published: true }), slip({ id: "b" }), slip({ id: "c" })];
  assert.deepEqual(planPublish(partial).toPublish, ["b", "c"]);
});
test("employee history: newest first, one entry per month, voided/unpublished never listed", () => {
  const items = buildIndex([
    slip({ period: "2026-06", published: true, publishedAtIso: "2026-07-02T00:00:00Z", netPay: 40000 }),
    slip({ period: "2026-08", published: true, publishedAtIso: "2026-09-02T00:00:00Z", netPay: 43200 }),
    slip({ period: "2026-07", published: false }),
    slip({ period: "2026-05", published: true, status: "voided" }),
  ]);
  assert.deepEqual(items.map((i) => i.period), ["2026-08", "2026-06"]);
  assert.equal(items[0].netPay, 43200);
  assert.equal(items[0].status, "Published");
});
test("reissue: after a correction the new revision replaces the old one and is labelled Reissued; the old stays hidden", () => {
  const items = buildIndex([
    slip({ period: "2026-08", revision: 1, status: "voided", published: true, netPay: 43200 }),
    slip({ period: "2026-08", revision: 2, published: true, netPay: 44000, publishedAtIso: "2026-09-10T00:00:00Z" }),
  ]);
  assert.equal(items.length, 1);
  assert.deepEqual([items[0].revision, items[0].netPay, items[0].status], [2, 44000, "Reissued"]);
});
test("historical payslips are preserved: publishing August does not alter June", () => {
  const june = slip({ period: "2026-06", published: true, netPay: 40000, publishedAtIso: "2026-07-02T00:00:00Z" });
  const before = JSON.stringify(buildIndex([june]));
  const after = JSON.stringify(buildIndex([june, slip({ period: "2026-08", published: true, netPay: 43200 })]).filter((i) => i.period === "2026-06"));
  assert.equal(JSON.stringify(JSON.parse(after)), JSON.stringify(JSON.parse(before)));
});
test("a different employee's payslips are never part of someone's index (the index is built per employee)", () => {
  const mine = buildIndex([slip({ uid: "u1", published: true }), slip({ uid: "u1", period: "2026-07", published: true })]);
  assert.ok(mine.every((i) => i.employeeId === "E1"));
  const src = read("lib/server/payslipIndex.ts");
  assert.ok(src.includes('.where("uid", "==", uid)'), "the index query is scoped to the one employee");
});
test("stages: Draft → Approved → Generated → Published", () => {
  assert.equal(stageOf(null), "draft");
  assert.equal(stageOf({ status: "approved" }), "approved");
  assert.equal(stageOf({ status: "payslips_generated" }), "generated");
  assert.equal(stageOf({ status: "payslips_generated", publishedAt: "2026-09-02" }), "published");
  assert.equal(stageOf({ status: "reversed", publishedAt: "x" }), "draft");
});

// ------------------------------------------------------------ server contracts
const pub = read("lib/server/payslipPublish.ts");
const actions = read("lib/server/payrollActions.ts");
const mail = read("lib/server/payslipEmail.ts");
const fn = (src: string, name: string) => {
  const i = src.indexOf(`export async function ${name}(`);
  assert.ok(i >= 0, name);
  const j = src.indexOf("\nexport ", i + 10);
  return src.slice(i, j < 0 ? undefined : j);
};
const before = (src: string, a: string, b: string, msg: string) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  assert.ok(i >= 0 && j >= 0, `missing ${a} / ${b}`);
  assert.ok(i < j, msg);
};

test("Send to Employees: needs payroll EDIT access; only an approved + generated month; draft/unapproved can never be sent", () => {
  for (const n of ["publishPreview", "publishPayslips"]) assert.ok(/await actorWith\(user, "payroll", "edit"\)/.test(fn(pub, n).split("\n").slice(0, 3).join("\n")), n);
  const b = fn(pub, "publishPayslips");
  before(b, 'state.status !== "payslips_generated"', "body.confirm !==", "state check before confirmation");
  assert.ok(b.includes("Only an approved month with generated payslips can be sent to employees."));
  assert.ok(fn(pub, "publishPreview").includes("draft or unapproved payroll can never be sent"));
});
test("publishing is idempotent: one transaction per payslip, an already-published one is skipped; records who and when", () => {
  const b = fn(pub, "publishPayslips");
  assert.ok(b.includes("runTransaction") && b.includes("if (d.published === true) return false"));
  assert.ok(b.includes("publishedBy: actor.email") && b.includes("publishedAt: Timestamp.now()") && b.includes("publishBatchId"));
  assert.ok(b.includes("plan.toPublish.length > 0 && body.confirm"), "a repeated click with nothing left needs no confirmation and changes nothing");
});
test("per-employee outcome: failures are collected (not swallowed), reported, and retried by pressing again", () => {
  const b = fn(pub, "publishPayslips");
  assert.ok(b.includes("failed.push(") && b.includes("press again to retry") && b.includes("indexFailed"));
  assert.ok(b.includes('"payslips-published"'));
});
test("employees only ever get PUBLISHED payslips: list, PDF, and the dashboard index (server side)", () => {
  const mine = fn(actions, "myPayslips");
  assert.ok(mine.includes('where("uid", "==", actor.uid)') && mine.includes("published === true"));
  const pdf = fn(actions, "payslipPdf");
  assert.ok(pdf.includes("p.published !== true") && pdf.includes("canOpenPayslip("));
  const idx = read("lib/server/payslipIndex.ts");
  assert.ok(idx.includes("buildIndex(") && idx.includes('.where("uid", "==", uid)') && idx.includes("payslipIndex/${uid}"));
});
test("a reversal withdraws the publication and refreshes each employee's list; the correction is a new revision", () => {
  const b = fn(actions, "reverseRun");
  assert.ok(b.includes("publishedAt: FieldValue.delete()") && b.includes("rebuildPayslipIndex(uid)") && b.includes('status: "voided"'));
});
test("rules: only the owner can read payslipIndex/{uid}; nobody can write it from a browser; payslips stay server-only", () => {
  const rules = read("firestore.rules");
  assert.ok(/match \/payslipIndex\/\{uid\}\s*\{ allow read: if isMember\(\) && request\.auth\.uid == uid; allow write: if false; \}/.test(rules));
  assert.ok(/match \/payslips\/\{id\}\s*\{ allow read, write: if false; \}/.test(rules));
});
test("widget: reads ONLY the signed-in user's own index document in real time; open/download go through the checked API; empty state + history", () => {
  const w = read("components/PayslipWidget.tsx");
  assert.ok(w.includes('doc(db, "payslipIndex", u.uid)') && w.includes("onSnapshot("));
  assert.ok(w.includes("/api/payroll/payslip-pdf?id=") && w.includes("No payslip has been published yet") && w.includes("Previous payslips"));
  for (const needle of ["netPay", "publishedAt", "employeeId", "employeeName", "status"]) assert.ok(w.includes(needle), needle);
  assert.ok(read("app/dashboard/page.js").includes("<PayslipWidget />"));
});
test("e-mail notification is separate from publication, needs a published month, and by default carries NO salary data", () => {
  assert.ok(mail.includes("Send to Employees"));
  assert.ok(mail.includes('body.content === "attachment" ? "attachment" : "link"'), "notification-only is the default");
  assert.ok(mail.includes("slip.published !== true"), "never e-mail about an unpublished payslip");
  assert.ok(mail.includes("const pdf = attach ? await retainedPdf("), "no PDF is loaded for a notification");
  assert.ok(!/payslips\/\$\{[^}]+\}`\)\.(update|set)\(/.test(mail), "e-mail code never changes the payslip (publication) records");
  const ui = read("components/payroll/PublishPanel.tsx");
  assert.ok(ui.includes("PUBLISH ${p.toPublish} PAYSLIPS") && ui.includes("Payroll month") && ui.includes("Payslips to publish now") && ui.includes("never duplicates anything"));
});

console.log(`\n${passed} passed (payslip publication)${process.exitCode ? " - with FAILURES" : ""}`);
