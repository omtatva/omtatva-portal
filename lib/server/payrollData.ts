// Payroll server — access control, data loading and the (read-only) payroll
// computation. Nothing in this file writes payroll records.

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { companyTimezone, localDateString, resolveShift, type PolicyRules } from "../attendancePolicy";
import { MONTH_RE } from "../payroll/calendar";
import {
  PayrollForbidden, assertCan, assertSuperAdmin, can, type Level, type Matrix, type PayrollModule,
} from "../payroll/access";
import {
  approvalBlockers, companyFlags, computeEmployee, summarize,
  type AttendanceRec, type EmployeeResult, type Flag, type HolidayRec, type Override, type PayrollSummary,
} from "../payroll/engine";
import { hashOf } from "../payroll/runState";
import { resolvePolicy, type PayrollPolicy } from "../payroll/policy";
import { normalizeRole } from "../roles";
import { ApiError, adminDb, type VerifiedUser } from "./firebaseAdmin";

// ------------------------------------------------------------------ access
export type Actor = VerifiedUser & { role: string; matrix: Matrix };

const COMPANY_DOMAIN = "@omtatvadigitals.com";

async function roleAndMatrix(email: string): Promise<{ role: string; matrix: Matrix }> {
  const db = adminDb();
  const [access, perm] = await Promise.all([
    db.doc(`adminAccess/${email.trim().toLowerCase()}`).get(),
    db.doc("settings/permissions").get(),
  ]);
  const role = access.exists ? normalizeRole(String(access.data()?.role || "")) : "employee";
  return { role, matrix: (perm.exists ? perm.data()?.matrix : null) as Matrix };
}

// Any signed-in, non-removed company member (used for "my payslips").
export async function memberFor(user: VerifiedUser): Promise<Actor> {
  const { role, matrix } = await roleAndMatrix(user.email);
  const adminTier = role !== "employee" && role !== "manager" && role !== "team_lead";
  if (!adminTier && !user.email.toLowerCase().endsWith(COMPANY_DOMAIN)) {
    throw new ApiError(403, "forbidden", "Only company accounts can use payroll.");
  }
  const removed = await adminDb().doc(`removedEmployees/${user.uid}`).get();
  if (removed.exists) throw new ApiError(403, "forbidden", "This account no longer has access.");
  return { ...user, role, matrix };
}

function wrap<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof PayrollForbidden) throw new ApiError(403, "forbidden", error.message);
    throw error;
  }
}

export async function actorWith(user: VerifiedUser, module: PayrollModule, level: Level): Promise<Actor> {
  const actor = await memberFor(user);
  wrap(() => assertCan(actor.role, actor.matrix, module, level));
  return actor;
}

export async function superAdminActor(user: VerifiedUser): Promise<Actor> {
  const actor = await memberFor(user);
  wrap(() => assertSuperAdmin(actor.role));
  return actor;
}

export const canViewPayroll = (a: Actor) => can(a.role, a.matrix, "payroll", "view");

// ------------------------------------------------------------------ helpers
export function currentPeriod(rules: PolicyRules | null, now = new Date()): string {
  return localDateString(now, companyTimezone(rules)).slice(0, 7);
}

export function validatePeriod(value: unknown, rules: PolicyRules | null, allowFuture = false): string {
  if (typeof value !== "string" || !MONTH_RE.test(value)) throw new ApiError(400, "bad-request", "Choose a valid payroll month.");
  if (!allowFuture && value > currentPeriod(rules)) throw new ApiError(400, "bad-request", "Payroll cannot be run for a future month.");
  return value;
}

export const iso = (v: unknown): string | null =>
  v instanceof Timestamp ? v.toDate().toISOString() : v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null;

export async function loadPolicy(): Promise<PayrollPolicy> {
  const snap = await adminDb().doc("settings/payrollPolicy").get();
  return resolvePolicy(snap.exists ? snap.data() : null);
}

export async function loadRules(): Promise<PolicyRules | null> {
  const snap = await adminDb().doc("settings/attendanceRules").get();
  return snap.exists ? (snap.data() as PolicyRules) : null;
}

export async function companyName(): Promise<string> {
  const snap = await adminDb().doc("settings/branding").get();
  const n = snap.exists ? String(snap.data()?.companyName || snap.data()?.name || "") : "";
  return n.trim().slice(0, 80) || "Omtatva Digitals";
}

// ----------------------------------------------------------- salary records
export type StructureDoc = { id: string; employeeId: string; values: Record<string, number>; raw: DocumentData };

export function valuesFromDoc(d: DocumentData, policy: PayrollPolicy): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of policy.components) {
    const raw = c.legacy ? d[c.key] : d.extraComponents?.[c.key];
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) out[c.key] = n;
  }
  return out;
}

export async function loadStructures(policy: PayrollPolicy): Promise<StructureDoc[]> {
  const snap = await adminDb().collection("salaryStructure").get();
  return snap.docs.map((d) => ({ id: d.id, employeeId: String(d.data().employeeId || "").trim(), values: valuesFromDoc(d.data(), policy), raw: d.data() }));
}

export type UserRow = {
  uid: string; employeeId: string; name: string; email: string; department: string; designation: string;
  shiftId: string | null; joiningDate: string | null; lastWorkingDate: string | null; status: string;
};

export async function loadUsers(): Promise<UserRow[]> {
  const snap = await adminDb().collection("users").get();
  return snap.docs
    .filter((d) => d.data().isDemo !== true)
    .map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        employeeId: String(u.employeeId || "").trim(),
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || String(u.name || u.email || d.id).split("@")[0],
        email: String(u.email || ""),
        department: String(u.department || ""),
        designation: String(u.designation || ""),
        shiftId: u.shiftId ? String(u.shiftId) : null,
        joiningDate: u.joiningDate ? String(u.joiningDate) : null,
        lastWorkingDate: u.lastWorkingDate ? String(u.lastWorkingDate) : u.exitDate ? String(u.exitDate) : null,
        status: String(u.status || "").toLowerCase(),
      };
    });
}

// ------------------------------------------------------------ the payroll run
export type SkippedEmployee = { employeeId: string; name: string; reason: string };

export type ComputedRun = {
  period: string;
  policy: PayrollPolicy;
  companyFlags: Flag[];
  results: EmployeeResult[];
  summary: PayrollSummary;
  blockers: string[];
  skipped: SkippedEmployee[];
  holidays: HolidayRec[];
  digest: string; // what the reviewer is looking at; approval must match it
};

export async function loadDecisions(period: string): Promise<Record<string, Override & { by?: string; at?: string }>> {
  const snap = await adminDb().doc(`payrollDrafts/${period}`).get();
  const o = snap.exists ? snap.data()?.overrides : null;
  return o && typeof o === "object" ? (o as Record<string, Override>) : {};
}

export async function computeRun(period: string, policyIn?: PayrollPolicy): Promise<ComputedRun> {
  const db = adminDb();
  const policy = policyIn || (await loadPolicy());
  const rules = await loadRules();

  const [users, structures, attSnap, leaveSnap, holSnap, decisions, removedSnap] = await Promise.all([
    loadUsers(),
    loadStructures(policy),
    db.collection("attendance").where("date", ">=", `${period}-01`).where("date", "<=", `${period}-31`).get(),
    db.collection("leaveRequests").where("status", "==", "Approved").get(),
    db.collection("holidays").get(),
    loadDecisions(period),
    db.collection("removedEmployees").get(),
  ]);
  const removed = new Set(removedSnap.docs.map((d) => d.id));

  const holidays: HolidayRec[] = holSnap.docs.map((d) => {
    const x = d.data();
    return { date: String(x.date || ""), name: String(x.name || ""), category: x.category ? String(x.category) : undefined, substituteFor: x.substituteFor ? String(x.substituteFor) : undefined };
  });

  const uidByEmployeeId = new Map<string, string>();
  for (const u of users) if (u.employeeId) uidByEmployeeId.set(u.employeeId.toLowerCase(), u.uid);

  const attByUid = new Map<string, AttendanceRec[]>();
  for (const d of attSnap.docs) {
    const x = d.data();
    if (x.isDemo === true) continue;
    // Real records carry `userId`; very old ones may only have uid/employeeId.
    const uid = String(x.userId || x.uid || uidByEmployeeId.get(String(x.employeeId || "").toLowerCase()) || "");
    if (!uid) continue;
    const list = attByUid.get(uid) || [];
    list.push({ date: String(x.date || ""), status: String(x.status || "") });
    attByUid.set(uid, list);
  }

  const leaveByUid = new Map<string, { id: string; leaveType: string; fromDate: string; toDate: string }[]>();
  for (const d of leaveSnap.docs) {
    const x = d.data();
    if (x.isDemo === true || !x.uid) continue;
    const list = leaveByUid.get(String(x.uid)) || [];
    list.push({ id: d.id, leaveType: String(x.leaveType || ""), fromDate: String(x.fromDate || ""), toDate: String(x.toDate || "") });
    leaveByUid.set(String(x.uid), list);
  }

  // duplicate employee IDs (users) / duplicate structures — never guessed
  const usersById = new Map<string, UserRow[]>();
  for (const u of users) if (u.employeeId) usersById.set(u.employeeId.toLowerCase(), [...(usersById.get(u.employeeId.toLowerCase()) || []), u]);
  const structById = new Map<string, StructureDoc[]>();
  for (const s of structures) structById.set(s.employeeId.toLowerCase(), [...(structById.get(s.employeeId.toLowerCase()) || []), s]);

  const skipped: SkippedEmployee[] = [];
  const results: EmployeeResult[] = [];
  const periodStart = `${period}-01`;
  const defaultOff = [0, 1, 2, 3, 4, 5, 6].filter((d) => !resolveShift(rules, null).workdays.includes(d));

  for (const u of users.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!u.employeeId) continue; // not an employee record (admins without an ID etc.)
    if (removed.has(u.uid)) { skipped.push({ employeeId: u.employeeId, name: u.name, reason: "removed from the portal" }); continue; }
    const active = u.status === "active";
    const leftThisPeriodOrLater = !!u.lastWorkingDate && u.lastWorkingDate >= periodStart;
    if (!active && !leftThisPeriodOrLater) { skipped.push({ employeeId: u.employeeId, name: u.name, reason: u.status ? `status "${u.status}"` : "no active status" }); continue; }

    const sameId = usersById.get(u.employeeId.toLowerCase()) || [];
    const structs = structById.get(u.employeeId.toLowerCase()) || [];
    const shift = resolveShift(rules, u.shiftId);
    const salary = sameId.length === 1 && structs.length === 1 ? structs[0].values : null;

    const result = computeEmployee(period, policy, holidays, {
      uid: u.uid, employeeId: u.employeeId, name: u.name, department: u.department, designation: u.designation,
      joiningDate: u.joiningDate, lastWorkingDate: u.lastWorkingDate,
      weeklyOffDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !shift.workdays.includes(d)),
      salary,
      attendance: attByUid.get(u.uid) || [],
      leaveRequests: leaveByUid.get(u.uid) || [],
      overrides: Object.fromEntries(
        Object.entries(decisions)
          .filter(([k]) => k.startsWith(`${u.uid}|`))
          .map(([k, v]) => [k.slice(u.uid.length + 1), { treatment: v.treatment, reason: v.reason }])
      ),
    });
    if (sameId.length > 1) result.flags.unshift({ severity: "block", code: "duplicate-employee-id", message: `Employee ID ${u.employeeId} is used by ${sameId.length} employees — excluded until fixed.` });
    if (structs.length > 1) result.flags.unshift({ severity: "block", code: "duplicate-structure", message: `${structs.length} salary structures exist for ${u.employeeId} — excluded until fixed.` });
    results.push(result);
  }

  const cflags = companyFlags(period, policy, holidays, defaultOff);
  const summary = summarize(results);
  const blockers = approvalBlockers(results, cflags);
  return {
    period, policy, companyFlags: cflags, results, summary, blockers, skipped, holidays,
    digest: hashOf({ period, policy, results }),
  };
}
