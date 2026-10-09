// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_BULK_ITEMS,
  MAX_BULK_TOTAL,
  chunk,
  confirmPhrase,
  emptyResult,
  groupBySuggestion,
  mergeResults,
  toBulkItem,
  validateBulk,
  type BulkRequest,
  type Selectable,
} from "../lib/bulkCorrection";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    console.error("FAIL", name, "\n  ", (e as Error).message);
    process.exitCode = 1;
  }
};

const good = (over: Partial<BulkRequest> = {}): BulkRequest => ({
  items: [{ recordId: "r1" }, { recordId: "r2" }, { userId: "u1", date: "2026-08-04" }],
  status: "Weekly Off",
  reason: "Verified: these were Sundays",
  batchTotal: 3,
  confirm: confirmPhrase(3),
  ...over,
});

// ---------------------------------------------------------------- validation
test("a complete bulk request is valid", () => assert.deepEqual(validateBulk(good()), []));
test("a written reason (>= 10 chars) is required", () => {
  assert.ok(validateBulk(good({ reason: "short" })).some((e) => /reason/i.test(e)));
  assert.ok(validateBulk(good({ reason: "   " })).some((e) => /reason/i.test(e)));
});
test("the typed confirmation must match the total exactly", () => {
  assert.ok(validateBulk(good({ confirm: "APPLY 2 CORRECTIONS" })).some((e) => /Type exactly/.test(e)));
  assert.ok(validateBulk(good({ confirm: "" })).length > 0);
  assert.ok(validateBulk(good({ confirm: "apply 3 corrections" })).length > 0, "case-sensitive");
  assert.deepEqual(validateBulk(good({ confirm: confirmPhrase(5), batchTotal: 5 })), [], "a run split over several requests confirms the whole run");
});
test("marking people Present needs the 'I have verified' confirmation", () => {
  assert.ok(validateBulk(good({ status: "Present" })).some((e) => /verified/i.test(e)));
  assert.deepEqual(validateBulk(good({ status: "Present", confirmVerified: true })), []);
  for (const s of ["Leave", "Holiday", "Weekly Off", "Absent"]) assert.deepEqual(validateBulk(good({ status: s })), [], s);
});
test("only the allowed statuses can be applied", () => {
  assert.ok(validateBulk(good({ status: "Banana" })).length > 0);
  assert.ok(validateBulk(good({ status: "" })).length > 0);
});
test("empty, oversized, duplicated or malformed selections are rejected", () => {
  assert.ok(validateBulk(good({ items: [], batchTotal: 0, confirm: confirmPhrase(0) })).length > 0);
  const big = Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => ({ recordId: `r${i}` }));
  assert.ok(validateBulk(good({ items: big, batchTotal: big.length, confirm: confirmPhrase(big.length) })).some((e) => /At most/.test(e)));
  assert.ok(validateBulk(good({ items: [{ recordId: "r1" }, { recordId: "r1" }], batchTotal: 2, confirm: confirmPhrase(2) })).some((e) => /twice/.test(e)));
  assert.ok(validateBulk(good({ items: [{}], batchTotal: 1, confirm: confirmPhrase(1) })).length > 0);
  assert.ok(validateBulk(good({ items: [{ userId: "u1", date: "04-08-2026" }], batchTotal: 1, confirm: confirmPhrase(1) })).length > 0);
});
test("the declared batch total cannot be smaller than the request, or absurdly large", () => {
  assert.ok(validateBulk(good({ batchTotal: 1, confirm: confirmPhrase(1) })).some((e) => /batch size/i.test(e)));
  assert.ok(validateBulk(good({ batchTotal: MAX_BULK_TOTAL + 1, confirm: confirmPhrase(MAX_BULK_TOTAL + 1) })).some((e) => /batch size/i.test(e)));
  assert.ok(validateBulk(good({ batchTotal: undefined })).length > 0);
});

// ---------------------------------------------------------- audit -> items
const f = (over: Partial<Selectable>): Selectable => ({ type: "absent-on-weekly-off", recordId: "r1", userId: "u1", date: "2026-07-05", proposedStatus: "Weekly Off", ...over });

test("findings map to bulk items: records are updated, missing days are created, unsafe ones are excluded", () => {
  assert.deepEqual(toBulkItem(f({})), { recordId: "r1" });
  assert.deepEqual(toBulkItem(f({ type: "missing-record", recordId: "", proposedStatus: null })), { userId: "u1", date: "2026-07-05" });
  assert.equal(toBulkItem(f({ type: "duplicate-records", recordId: "a+b" })), null);
  assert.equal(toBulkItem(f({ type: "invalid-date" })), null);
  assert.equal(toBulkItem(f({ type: "orphan-record" })), null);
  assert.equal(toBulkItem(f({ type: "hours-mismatch", recordId: "" })), null);
});
test("'Apply suggested fix' groups by the status the audit proposed and skips findings with no suggestion", () => {
  const groups = groupBySuggestion([
    f({ recordId: "a", proposedStatus: "Weekly Off" }),
    f({ recordId: "b", proposedStatus: "Weekly Off" }),
    f({ type: "absent-on-holiday", recordId: "c", proposedStatus: "Holiday" }),
    f({ type: "absent-with-punch", recordId: "d", proposedStatus: "Present" }),
    f({ type: "missing-record", recordId: "", proposedStatus: null }), // no suggestion: never guessed
    f({ type: "duplicate-records", recordId: "x+y", proposedStatus: null }),
  ]);
  const byStatus = Object.fromEntries(groups.map((g) => [g.status, g.items.length]));
  assert.deepEqual(byStatus, { "Weekly Off": 2, Holiday: 1, Present: 1 });
  assert.equal(groups[0].skippedNoSuggestion, 2);
  assert.ok(!groups.some((g) => g.items.some((i) => i.userId === "u1" && !i.recordId)), "missing days are never auto-filled");
});

// ------------------------------------------------------------------ helpers
test("chunking keeps every item and respects the per-request limit", () => {
  const list = Array.from({ length: 450 }, (_, i) => i);
  const parts = chunk(list, MAX_BULK_ITEMS);
  assert.deepEqual(parts.map((p) => p.length), [200, 200, 50]);
  assert.deepEqual(parts.flat(), list);
});
test("results from several requests add up", () => {
  const a = { ...emptyResult(), updated: 3, skipped: 1 };
  const b = { ...emptyResult(), created: 2, failed: 1, errors: [{ item: { recordId: "x" }, message: "boom" }] };
  const m = mergeResults(a, b);
  assert.deepEqual([m.updated, m.created, m.skipped, m.failed, m.errors.length], [3, 2, 1, 1, 1]);
});

// ------------------------------------------------------------ source contracts
const read = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");
const server = read("../lib/server/bulkCorrectionServer.ts");
const route = read("../app/api/attendance/reports/[action]/route.ts");
const corr = read("../lib/server/correctionServer.ts");
const page = read("../app/admin/attendance-reports/page.tsx");
const dialog = read("../components/BulkCorrectionDialog.tsx");

test("server: Super Admin + validation + ONE backup check come before any record is touched", () => {
  const role = server.indexOf('admin.role !== "super_admin"');
  const valid = server.indexOf("validateBulk(body)");
  const backup = server.indexOf("assertVerifiedBackupCoversRange(");
  const firstWrite = server.indexOf("await applyCorrection(");
  assert.ok(role > 0 && role < valid && valid < backup && backup < firstWrite);
});
test("server: every record goes through the audited single-record path; bulk never writes attendance itself", () => {
  assert.ok(server.includes("applyCorrection("));
  assert.ok(!/collection\("attendance"\)[^;]*\.(set|update|delete|add)\(/.test(server.replace(/\s+/g, " ")));
  assert.ok(!/\.update\(|\.set\(|batch\(/.test(server.replace(/\/\/.*$/gm, "")), "no direct writes in the bulk module");
  assert.ok(server.includes("batchId") && corr.includes("...(opts.batchId ? { batchId: opts.batchId } : {})"));
  assert.ok(corr.includes("opts.skipActivityLog") && server.includes("Bulk Attendance Correction"), "one summary activity entry per request");
});
test("server: re-running the same request is harmless (already-correct records are skipped, not failed)", () => {
  assert.ok(server.includes('"no-change"') && server.includes('"record-exists"') && server.includes("result.skipped++"));
});
test("route: bulk-correct is only reachable after the Super Admin check", () => {
  const post = route.slice(route.indexOf("export async function POST"));
  assert.ok(post.indexOf("requireSuperAdmin(user)") < post.indexOf('case "bulk-correct"'));
});
test("ui: checkboxes and the bulk bar exist only for editors; the dialog asks for reason, verification and typed confirmation", () => {
  assert.ok(page.includes("canEdit && selected.size > 0") && page.includes("canEdit && toBulkItem(f) !== null"));
  assert.ok(page.includes("Apply suggested fix") && page.includes("Set status…"));
  assert.ok(page.includes("Select all"));
  for (const must of ["confirmPhrase(total)", "batchTotal: total", "needsVerified", "bulkChangeGate(", "MIN_REASON_LENGTH"]) assert.ok(dialog.includes(must), must);
  assert.ok(dialog.includes("typed === required"));
});
test("single-record correction is still there (Review & correct / Correct buttons)", () => {
  assert.ok(page.includes("Review &amp; correct"));
  assert.ok(read("../components/AttendanceReportViews.tsx").includes('{r ? "Correct" : "Add record"}'));
});

console.log(`\n${passed} passed (bulk corrections)${process.exitCode ? " - with FAILURES" : ""}`);
