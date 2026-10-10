// Who may do what in payroll. Pure, so the server routes and the tests use the
// same rule. Identity/role always come from the server (verified token +
// adminAccess/{email}); the View/Edit matrix is the one configured in
// Settings → Module Permissions (settings/permissions).

import { ADMIN_TIER_ROLES, normalizeRole, type RoleValue } from "../roles";

export type PayrollModule = "payroll" | "salaryStructure";
export type Level = "view" | "edit";
export type Matrix = Record<string, Partial<Record<string, Level>>> | null | undefined;

export class PayrollForbidden extends Error {
  status = 403;
  code = "forbidden";
}

// Same defaults as lib/permissions.ts: HR is view-only on everything except
// Employee Management / Documents; every other admin-tier role can edit.
function defaultLevel(role: RoleValue): Level {
  return role === "hr" ? "view" : "edit";
}

export function payrollLevel(roleRaw: string | null | undefined, matrix: Matrix, module: PayrollModule): Level | "none" {
  const role = normalizeRole(roleRaw);
  if (role === "super_admin") return "edit";
  if (!ADMIN_TIER_ROLES.includes(role)) return "none";
  return matrix?.[role]?.[module] ?? defaultLevel(role);
}

export function can(roleRaw: string | null | undefined, matrix: Matrix, module: PayrollModule, need: Level): boolean {
  const have = payrollLevel(roleRaw, matrix, module);
  if (have === "none") return false;
  return need === "view" ? true : have === "edit";
}

// Policy changes and reversing an approved payroll are Super Admin only.
export function isSuperAdminRole(roleRaw: string | null | undefined): boolean {
  return normalizeRole(roleRaw) === "super_admin";
}

export function assertCan(roleRaw: string | null | undefined, matrix: Matrix, module: PayrollModule, need: Level) {
  if (!can(roleRaw, matrix, module, need)) {
    throw new PayrollForbidden(need === "edit" ? "You do not have edit access to payroll." : "You do not have access to payroll.");
  }
}

export function assertSuperAdmin(roleRaw: string | null | undefined) {
  if (!isSuperAdminRole(roleRaw)) throw new PayrollForbidden("Only a Super Admin can do this.");
}

// A payslip can be opened by its owner, or by a payroll-authorized admin.
export function canOpenPayslip(input: { callerUid: string; ownerUid: string; role: string | null | undefined; matrix: Matrix; voided: boolean }): boolean {
  if (input.callerUid === input.ownerUid) return !input.voided;
  return can(input.role, input.matrix, "payroll", "view");
}
