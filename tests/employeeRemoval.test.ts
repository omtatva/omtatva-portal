// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildTombstone, checkRemovable, confirmText, type RemovalCheckInput } from "../lib/employeeRemoval";
import { canEditModule } from "../lib/modulePermissions";

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

const base = (over: Partial<RemovalCheckInput> = {}): RemovalCheckInput => ({
  callerUid: "hr1",
  callerRole: "hr",
  targetUid: "emp1",
  targetStatus: "Rejected",
  targetAccessRole: null,
  superAdminCount: 2,
  ...over,
});

// ------------------------------------------------------------ who can be removed
test("a Rejected employee with no access entry can be removed by HR", () => assert.equal(checkRemovable(base()), null));
test("only REJECTED employees can be removed — never Pending or Approved", () => {
  for (const s of ["Approved", "Pending", "", "approved"]) assert.match(checkRemovable(base({ targetStatus: s }))!, /Rejected/, s);
  assert.equal(checkRemovable(base({ targetStatus: "rejected" })), null, "case-insensitive");
});
test("you can't remove yourself", () => assert.match(checkRemovable(base({ targetUid: "hr1" }))!, /your own/));
test("a rejected person with a Manager / Team Lead / Employee role entry can be removed by HR (those roles grant no admin access)", () => {
  for (const r of ["manager", "team_lead", "employee"]) assert.equal(checkRemovable(base({ targetAccessRole: r })), null, r);
});
test("a rejected person with ADMIN access can only be removed by a Super Admin", () => {
  for (const r of ["hr", "head", "admin", "super_admin"]) {
    assert.match(checkRemovable(base({ targetAccessRole: r, callerRole: "hr" }))!, /Super Admin/, r);
    assert.match(checkRemovable(base({ targetAccessRole: r, callerRole: "admin" }))!, /Super Admin/, r);
  }
  assert.equal(checkRemovable(base({ targetAccessRole: "admin", callerRole: "super_admin", callerUid: "sa1" })), null);
});
test("the last Super Admin can never be removed", () => {
  assert.match(checkRemovable(base({ targetAccessRole: "super_admin", callerRole: "super_admin", callerUid: "sa1", superAdminCount: 1 }))!, /last Super Admin/);
  assert.equal(checkRemovable(base({ targetAccessRole: "super_admin", callerRole: "super_admin", callerUid: "sa1", superAdminCount: 2 })), null);
});
test("the confirmation text tells the admin exactly what happens and what is kept", () => {
  const t = confirmText("Asha Rao");
  assert.ok(t.includes("Asha Rao") && /disable their login/.test(t) && /access/.test(t) && /attendance, leave, payroll/i.test(t));
});
test("a permanent removal record captures who, what and whether access existed", () => {
  const t = buildTombstone("u1", { firstName: "Asha", lastName: "Rao", employeeId: "E1", department: "IT", designation: "Dev", role: "employee", hrApprovalStatus: "Rejected" }, {
    email: "asha@omtatvadigitals.com", hadAccessEntry: true, accessRole: "manager", loginDisabled: true, reason: "Rejected by HR",
  });
  assert.equal(t.name, "Asha Rao");
  assert.equal(t.hadAccessEntry, true);
  assert.equal(t.loginDisabled, true);
  assert.equal(t.hrApprovalStatus, "Rejected");
});

// -------------------------------------------------------------- permissions
test("who may edit Employee Management: Super Admin, HR (default), Head, Admin — never Employee / Team Lead / Manager", () => {
  for (const r of ["super_admin", "hr", "head", "admin"]) assert.equal(canEditModule(r, undefined, "users"), true, r);
  for (const r of ["employee", "team_lead", "manager", "", undefined]) assert.equal(canEditModule(r as never, { manager: { users: "edit" } }, "users"), false, String(r));
});
test("the saved permission matrix can make Employee Management view-only for a role", () => {
  assert.equal(canEditModule("hr", { hr: { users: "view" } }, "users"), false);
  assert.equal(canEditModule("admin", { admin: { users: "view" } }, "users"), false);
  assert.equal(canEditModule("super_admin", { super_admin: { users: "view" } }, "users"), true, "Super Admin always can");
  assert.equal(canEditModule("hr", undefined, "payroll"), false, "HR defaults to view-only outside users/documents");
});

// ------------------------------------------------------------ source contracts
const read = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");
const server = read("../lib/server/employeeRemovalServer.ts");
const route = read("../app/api/admin/employees/remove/route.ts");
const page = read("../app/admin/users/page.js").split('// "use client";')[0];
const fbadmin = read("../lib/server/firebaseAdmin.ts");
const fsRules = read("../firestore.rules");
const stRules = read("../storage.rules");

test("server: the permission and Rejected checks run BEFORE anything is changed; the login is disabled BEFORE data is deleted", () => {
  const editor = server.indexOf("requireUsersEditor(user)");
  const check = server.indexOf("checkRemovable({");
  const disable = server.indexOf("disabled: true");
  const revoke = server.indexOf("revokeRefreshTokens(uid)");
  const commit = server.indexOf("await batch.commit()");
  assert.ok(editor > 0 && editor < check && check < disable && disable < revoke && revoke < commit);
  assert.ok(server.includes('"users"') && server.includes("canEditModule("));
});
test("server: removes the profile, roster entries, reporting line and ACCESS-LIST entry — and keeps attendance, leave, payroll and files", () => {
  for (const must of ["batch.delete(userRef)", "employees/${uid}", "employeeProfiles/${uid}", "reportingStructure/${uid}", "batch.delete(accessRef)", "removedEmployees/${uid}"]) {
    assert.ok(server.includes(must), must);
  }
  for (const kept of ['"attendance"', "attendance/", "leaveRequests", "payroll", "salaryStructure", "employeeDocuments", "getStorage", "bucket"]) {
    assert.ok(!server.includes(kept), `must not touch ${kept}`);
  }
});
test("server: people who reported to the removed person are cleared (no dangling manager) and the action is logged", () => {
  assert.ok(server.includes('where("managerId", "==", uid)') && server.includes('managerId: ""'));
  assert.ok(server.includes("Rejected Employee Removed"));
});
test("server: repeating a removal is harmless (already-removed returns a clean result)", () => {
  assert.ok(server.includes("alreadyRemoved: true") && server.includes("removedEmployees/${uid}"));
});
test("every server route refuses a revoked or disabled account immediately (checkRevoked)", () => {
  assert.ok(fbadmin.includes("verifyIdToken(token, true)"));
});
test("route: needs a verified sign-in and is POST only", () => {
  assert.ok(route.includes("verifyRequest(req)") && route.includes("export async function POST") && !route.includes("export async function GET"));
});
test("rules: removed people are locked out of Firestore AND Storage straight away, and the record is server-only", () => {
  assert.ok(fsRules.includes("function isRemoved()") && fsRules.includes("&& !isRemoved()"));
  assert.ok(stRules.includes("function isRemoved()") && stRules.includes("&& !isRemoved()"));
  assert.ok(/match \/removedEmployees\/\{id\}\s*\{ allow read, write: if false; \}/.test(fsRules));
});
test("ui: the Remove button appears only on Rejected rows and is disabled for view-only roles; bulk removal is offered", () => {
  assert.ok(page.includes('(user.hrApprovalStatus || "") === "Rejected" && ('));
  assert.ok(page.includes("Remove &amp; revoke access") || page.includes("Remove & revoke access"));
  assert.ok(page.includes("disabled={!canEdit || !!removingId}"));
  assert.ok(page.includes("Remove all rejected") && page.includes("/api/admin/employees/remove"));
  assert.ok(page.includes("window.confirm(confirmText("), "asks for confirmation first");
});

console.log(`\n${passed} passed (employee removal)${process.exitCode ? " - with FAILURES" : ""}`);
