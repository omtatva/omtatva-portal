// Run with:  npm run test:payroll
import assert from "node:assert/strict";
import { RunConflict, entryId, hashOf, payslipId, planApprove, planGenerate, planPayslips, planReverse, stableStringify, canEditDecisions, APPROVING_LOCK_MS, type RunState } from "../lib/payroll/runState";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};
const run = (status: RunState["status"], revision = 1, extra: Partial<RunState> = {}): RunState => ({ period: "2026-08", status, revision, ...extra });

test("first approval creates revision 1", () => {
  assert.deepEqual(planApprove(null, 0), { revision: 1, resume: false });
});
test("duplicate payroll run is refused: an approved or payslipped period cannot be approved again", () => {
  assert.throws(() => planApprove(run("approved"), 0), RunConflict);
  assert.throws(() => planApprove(run("payslips_generated"), 0), RunConflict);
});
test("a second click while approving is refused; a crashed attempt can resume after the lock expires", () => {
  const now = 1_000_000;
  assert.throws(() => planApprove(run("approving", 1, { approvingSinceMs: now - 1000 }), now), RunConflict);
  assert.deepEqual(planApprove(run("approving", 1, { approvingSinceMs: now - APPROVING_LOCK_MS - 1 }), now), { revision: 1, resume: true });
});
test("re-approving after a reversal starts a NEW revision (history is kept, nothing is overwritten)", () => {
  assert.deepEqual(planApprove(run("reversed", 1), 0), { revision: 2, resume: false });
  assert.deepEqual(planApprove(run("reversed", 4), 0), { revision: 5, resume: false });
});
test("reversal only applies to approved periods", () => {
  assert.deepEqual(planReverse(run("approved", 2)), { revision: 2 });
  assert.deepEqual(planReverse(run("payslips_generated", 3)), { revision: 3 });
  for (const r of [null, run("reversed"), run("approving")]) assert.throws(() => planReverse(r), RunConflict);
});
test("payslips can only be generated for an approved period", () => {
  assert.deepEqual(planGenerate(run("approved")), { revision: 1 });
  assert.deepEqual(planGenerate(run("payslips_generated")), { revision: 1 });
  for (const r of [null, run("reversed"), run("approving")]) assert.throws(() => planGenerate(r), RunConflict);
});
test("review decisions can be edited only while no approval is in force", () => {
  assert.equal(canEditDecisions(null), true);
  assert.equal(canEditDecisions(run("reversed")), true);
  assert.equal(canEditDecisions(run("approved")), false);
  assert.equal(canEditDecisions(run("payslips_generated")), false);
});

test("payslip generation is idempotent: second run creates nothing", () => {
  const entries = [{ uid: "a", entryHash: "h1" }, { uid: "b", entryHash: "h2" }];
  const first = planPayslips("2026-08", 1, entries, new Map());
  assert.equal(first.create.length, 2);
  const existing = new Map(first.create.map((c) => [c.id, { status: "issued", entryHash: c.entryHash }]));
  const second = planPayslips("2026-08", 1, entries, existing);
  assert.equal(second.create.length, 0);
  assert.equal(second.skip.length, 2);
});
test("a crashed generation resumes: only the missing payslips are created", () => {
  const entries = [{ uid: "a", entryHash: "h1" }, { uid: "b", entryHash: "h2" }, { uid: "c", entryHash: "h3" }];
  const existing = new Map([[payslipId("2026-08", "a", 1), { status: "issued", entryHash: "h1" }]]);
  const plan = planPayslips("2026-08", 1, entries, existing);
  assert.deepEqual(plan.create.map((c) => c.uid), ["b", "c"]);
  assert.deepEqual(plan.skip, ["2026-08_a_r1"]);
});
test("an existing payslip with different content or a voided one is never overwritten", () => {
  const plan = planPayslips("2026-08", 1, [{ uid: "a", entryHash: "NEW" }, { uid: "b", entryHash: "h2" }], new Map([
    ["2026-08_a_r1", { status: "issued", entryHash: "OLD" }],
    ["2026-08_b_r1", { status: "voided", entryHash: "h2" }],
  ]));
  assert.equal(plan.create.length, 0);
  assert.deepEqual(plan.conflict.sort(), ["2026-08_a_r1", "2026-08_b_r1"]);
});
test("ids are deterministic and revision-specific", () => {
  assert.equal(payslipId("2026-08", "u1", 2), "2026-08_u1_r2");
  assert.equal(entryId("2026-08", "u1", 2), "2026-08_r2_u1");
  assert.notEqual(payslipId("2026-08", "u1", 1), payslipId("2026-08", "u1", 2));
});
test("hashing is order-independent and detects any change", () => {
  assert.equal(hashOf({ a: 1, b: [1, 2], c: { x: 1, y: 2 } }), hashOf({ c: { y: 2, x: 1 }, b: [1, 2], a: 1 }));
  assert.notEqual(hashOf({ a: 1 }), hashOf({ a: 2 }));
  assert.equal(stableStringify({ a: undefined, b: 1 }), '{"b":1}');
});

console.log(`\n${passed} passed (payroll run state)${process.exitCode ? " - with FAILURES" : ""}`);
