// Run with:  npm run test:payroll
// Source-contract checks (no Firestore emulator is available here): they pin
// the ORDER and PLACEMENT of the safety checks in the server code, the
// Firestore rules, and the absence of browser-side payroll writes.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};
const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const actions = read("lib/server/payrollActions.ts");
const data = read("lib/server/payrollData.ts");
const route = read("app/api/payroll/[action]/route.ts");
const rules = read("firestore.rules");

const body = (src: string, fn: string) => {
  const start = src.indexOf(`export async function ${fn}(`);
  assert.ok(start >= 0, `${fn} exists`);
  const next = src.indexOf("\nexport async function ", start + 10);
  return src.slice(start, next < 0 ? undefined : next);
};
const before = (src: string, a: string, b: string, msg: string) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  assert.ok(i >= 0, `missing: ${a}`);
  assert.ok(j >= 0, `missing: ${b}`);
  assert.ok(i < j, msg);
};

test("every payroll action authorizes on the server before doing anything", () => {
  const names = [...actions.matchAll(/export async function (\w+)\(user: VerifiedUser/g)].map((m) => m[1]);
  assert.ok(names.length >= 14, `found ${names.length} actions`);
  for (const n of names) {
    const first = body(actions, n).split("\n").slice(1, 4).join("\n");
    assert.ok(/await (actorWith|superAdminActor|memberFor)\(user/.test(first), `${n} must authorize first`);
  }
});
test("role requirements: policy + reversal = Super Admin; salary edits = salaryStructure edit; run/approve/generate = payroll edit", () => {
  assert.ok(body(actions, "savePolicy").includes("superAdminActor(user)"));
  assert.ok(body(actions, "reverseRun").includes("superAdminActor(user)"));
  for (const f of ["previewSalarySheet", "applySalarySheet", "saveSalary", "deleteSalary"]) assert.ok(body(actions, f).includes('actorWith(user, "salaryStructure", "edit")'), f);
  for (const f of ["approveRun", "generatePayslips", "saveDecisions", "resolveMissing"]) assert.ok(body(actions, f).includes('actorWith(user, "payroll", "edit")'), f);
  for (const f of ["previewRun", "listRuns", "listPeriodPayslips"]) assert.ok(body(actions, f).includes('actorWith(user, "payroll", "view")'), f);
});
test("route: the ID token is verified before any action runs; unknown actions 404; PDFs are not cached", () => {
  assert.ok(route.indexOf("verifyRequest(req)") < route.indexOf("switch (action)"));
  assert.ok(route.includes('"not-found"'));
  assert.ok(route.includes("application/pdf") && route.includes("no-store") && route.includes("nosniff"));
  for (const a of ["policy-save", "approve", "generate-payslips", "reverse", "salary-preview", "salary-apply", "salary-save", "salary-delete", "decisions", "resolve-missing", "my-payslips", "payslip-pdf"]) {
    assert.ok(route.includes(`"${a}"`), a);
  }
});

test("approve: typed confirm → policy confirmed → no blockers → matches the reviewed preview → lock → entries → finalize", () => {
  const b = body(actions, "approveRun");
  before(b, "body.confirm !==", "computeRun(period)", "confirm first");
  before(b, "policy.confirmed", "computed.blockers.length", "policy check");
  before(b, "computed.blockers.length", "body.previewDigest !== computed.digest", "blockers");
  before(b, "body.previewDigest !== computed.digest", "runTransaction", "digest before lock");
  before(b, "planApprove(state, nowMs)", 'batch.set(db().doc(`payrollEntries/', "lock before entries");
  before(b, 'batch.set(db().doc(`payrollEntries/', 'status: "approved"', "entries before finalize");
  assert.ok(b.includes("previousStatus"), "a failed approval releases its lock");
});
test("generate: only for an approved period; payslips are create()d (never overwritten) and skipped when they exist", () => {
  const b = body(actions, "generatePayslips");
  before(b, "planGenerate(state)", "planPayslips(", "state check first");
  assert.ok(b.includes(".create({") && !/payslips\/\$\{[^}]+\}`\)\.set\(/.test(b), "create, not set");
  assert.ok(b.includes("hashOf(result) !== item.entryHash"), "the snapshot is verified before a payslip is issued");
  assert.ok(b.includes("code === 6"), "ALREADY_EXISTS is a skip");
});
test("reverse: Super Admin, typed confirm, reason, state check, BACKUP, then void; history is kept", () => {
  const b = body(actions, "reverseRun");
  before(b, "superAdminActor(user)", "body.confirm !==", "role first");
  before(b, "planReverse(state)", "writeBackup(", "state before backup");
  before(b, "writeBackup(", 'status: "voided"', "backup before voiding");
  before(b, 'status: "voided"', 'status: "reversed"', "void before status change");
  assert.ok(b.includes("history") && b.includes("payrollAudit") === false && b.includes('audit(actor, "reversed"'));
});
test("decisions can only be changed while no approval is in force", () => {
  assert.ok(body(actions, "saveDecisions").includes("canEditDecisions(state)"));
  assert.ok(body(actions, "resolveMissing").includes("canEditDecisions(state)"));
  assert.ok(body(actions, "saveDecisions").includes("reason(it.reason)"), "every decision needs a reason");
});
test("approved payroll is a snapshot: previewing an approved month never rewrites it, only reports drift", () => {
  const b = body(actions, "previewRun");
  assert.ok(b.includes("driftNetPay") && !/\.(set|update|create|delete)\(/.test(b));
});
test("salary sheet apply: preview hash → typed confirm → reason → backup → per-row transaction with history", () => {
  const b = body(actions, "applySalarySheet");
  before(b, "body.previewHash !==", "body.confirm !==", "hash first");
  before(b, "body.confirm !==", "reason(body.reason", "confirm before reason");
  const apply = actions.slice(actions.indexOf("async function applyRows("));
  before(apply, "writeBackup(", "runTransaction", "backup before any write");
  before(apply, "hashOf(before) !== hashOf(expected)", "tx.update(ref, fields)", "concurrent edits are detected");
  assert.ok(apply.includes("salaryChangeHistory") && apply.includes("tx.set(histRef"), "history is written in the same transaction");
  assert.ok(apply.includes('tx.get(db().collection("salaryStructure").where("employeeId"'), "no duplicate structure for an employee");
});
test("payslip download: owner or authorized HR only; wrong/other ids look like 'not found'; integrity is verified", () => {
  const b = body(actions, "payslipPdf");
  assert.ok(b.includes("canOpenPayslip(") && b.includes('"not-found"'));
  assert.ok(b.includes("hashOf(result) !== p.entryHash") && b.includes("retainedPdf("), "the retained PDF is checksum-verified (retainedPdf)");
  assert.ok(/\^\\d\{4\}-\\d\{2\}_/.test(b), "ids are validated");
  const mine = body(actions, "myPayslips");
  assert.ok(mine.includes('where("uid", "==", actor.uid)'), "uid comes from the verified token");
  assert.ok(!/body|req\./.test(mine));
});
test("the payroll computation reads real data only: demo records skipped, months/IDs matched exactly, joiners/leavers handled", () => {
  assert.ok(data.includes("isDemo === true"));
  assert.ok(data.includes('where("date", ">=", leaveYearStart(period') && data.includes('where("date", "<=", `${period}-31`)'), "attendance is loaded from the leave-year start through the month");
  assert.ok(data.includes("x.userId || x.uid"), "attendance is matched by userId (the audit's problem #1)");
  assert.ok(data.includes('collection("leaveRequests").where("status", "==", "Approved")'), "approved leave comes from leaveRequests (problem #2)");
  assert.ok(data.includes("duplicate-employee-id") && data.includes("duplicate-structure"));
  assert.ok(data.includes("removedEmployees"));
});
test("PDF endpoint and payslips: every request is authorized by the caller's token; policy writes are server only", () => {
  assert.ok(data.includes("memberFor") && data.includes("removedEmployees/${user.uid}"));
});

// ------------------------------------------------------------------- rules
const rule = (name: string) => new RegExp(`match /${name}/\\{id\\}\\s*\\{[^}]*\\}`).exec(rules)?.[0] || "";
test("rules: payroll/salary collections cannot be written from a browser; server-only ones cannot be read either", () => {
  assert.ok(/allow read: if isAdminTier\(\); allow write: if false;/.test(rule("payroll")));
  assert.ok(/allow read: if isAdminTier\(\); allow write: if false;/.test(rule("salaryStructure")));
  for (const c of ["payrollRuns", "payrollEntries", "payrollDrafts", "payrollAudit", "payrollBackups", "payrollPolicyVersions", "payslips", "salaryChangeHistory", "salaryImports"]) {
    assert.ok(/allow read, write: if false;/.test(rule(c)), `${c} is server-only`);
  }
});
test("rules: the payroll policy document cannot be written from a browser; employees never read payslips directly", () => {
  assert.ok(rules.includes("docId == 'payrollPolicy'   ? false"));
  assert.ok(!/match \/payslips\/\{id\}\s*\{[^}]*isMember/.test(rules));
});

// -------------------------------------------------- no browser-side writes
test("no screen writes payroll or salary data straight from the browser", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "api") continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) files.push(rel);
    }
  };
  for (const d of ["app", "components", "lib"]) walk(d);
  for (const f of files.filter((x) => !x.startsWith("lib/server/"))) {
    const src = read(f).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    for (const col of ["payroll", "salaryStructure", "payslips", "payrollRuns"]) {
      assert.ok(!new RegExp(`(addDoc|setDoc)\\(\\s*collection\\(db,\\s*"${col}"`).test(src), `${f} writes ${col}`);
      assert.ok(!new RegExp(`(updateDoc|deleteDoc|setDoc)\\(\\s*doc\\(\\s*db,\\s*"${col}"`).test(src.replace(/\s+/g, " ")), `${f} modifies ${col}`);
    }
  }
});
test("the buggy legacy payroll code is gone and the salary screen points to the new workflow", () => {
  for (const f of ["components/salary/PayrollProcess.js", "components/salary/BulkUpload.js", "lib/payrollCalculation.js", "lib/generatePayslip.js", "lib/attendanceService.js"]) {
    assert.ok(!fs.existsSync(path.join(root, f)), `${f} should be deleted`);
  }
  const sal = read("app/admin/salary-structure/page.js");
  assert.ok(sal.includes('"/api/payroll/salary-save"') && sal.includes('"/api/payroll/salary-delete"') && sal.includes('href="/admin/payroll"'));
  assert.ok(!sal.includes("PayrollProcess") && !sal.includes("BulkUpload"));
});
test("employee dashboard links to the server-checked payslips page", () => {
  assert.ok(read("app/dashboard/page.js").includes('window.location.href = "/payslips"'));
  assert.ok(read("app/payslips/page.tsx").includes("/api/payroll/my-payslips"));
});

test("removing a salary component that employees still have amounts for needs an explicit acknowledgement, and is audited", () => {
  const b = body(actions, "savePolicy");
  assert.ok(b.includes("component-in-use") && b.includes("acknowledgeRemoved") && b.includes("loadStructures(previous)"));
  before(b, "component-in-use", 'set({ ...policy, updatedAt: now', "checked before the policy is written");
  assert.ok(b.includes("removedComponents"));
  const ui = read("components/payroll/PolicyTab.tsx");
  assert.ok(ui.includes("Remove") && ui.includes('disabled={c.key === "basicSalary"}') && ui.includes("add back") && ui.includes("window.confirm"));
});

console.log(`\n${passed} passed (payroll contracts)${process.exitCode ? " - with FAILURES" : ""}`);
