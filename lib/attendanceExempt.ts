// Roles that do not need to mark attendance (by default the shared IT Support
// and Admin accounts). Exempt people are never auto-marked Absent, never show
// up as "missing record" in attendance reports / audits, and their month is
// not held for review in payroll.
//
// Configured in Admin → Attendance Settings (settings/attendanceRules.attendanceExemptRoles);
// the default applies until someone saves a different list.

import type { RoleValue } from "./roles";

export const DEFAULT_EXEMPT_ROLES: RoleValue[] = ["admin", "super_admin"];

const VALID: RoleValue[] = ["employee", "team_lead", "manager", "hr", "head", "admin", "super_admin"];

const ALIASES: Record<string, RoleValue> = { hr_admin: "hr", it_support: "super_admin" };

// A saved value counts only if it IS a known role — normalizeRole() would turn junk into "employee",
// which here would wrongly exempt every regular employee.
const toRole = (raw: unknown): RoleValue | null => {
  const key = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (VALID.includes(key as RoleValue)) return key as RoleValue;
  return ALIASES[key] ?? null;
};

export function exemptRolesOf(rules: { attendanceExemptRoles?: unknown } | null | undefined): RoleValue[] {
  const raw = rules?.attendanceExemptRoles;
  if (!Array.isArray(raw)) return DEFAULT_EXEMPT_ROLES;
  return raw.map(toRole).filter((r, i, a): r is RoleValue => r !== null && a.indexOf(r) === i);
}

export function isAttendanceExempt(role: string | null | undefined, rules: { attendanceExemptRoles?: unknown } | null | undefined): boolean {
  const r = toRole(role);
  return r !== null && exemptRolesOf(rules).includes(r);
}
