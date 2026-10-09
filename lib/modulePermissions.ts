// "May this role EDIT this admin module?" — pure version of the check in
// lib/permissions.ts (Settings -> Access Management matrix), for server code.
// Super Admin always; non-admin roles (Employee, Team Lead, Manager) never;
// HR defaults to edit only for Employee Management and Documents; everyone
// else defaults to edit. The saved matrix overrides the defaults.

import { isAdminTierRole, normalizeRole } from "./roles";

type Matrix = Record<string, Partial<Record<string, "view" | "edit">>> | undefined;

export function canEditModule(roleRaw: string | null | undefined, matrix: Matrix, moduleKey: string): boolean {
  const role = normalizeRole(roleRaw);
  if (role === "super_admin") return true;
  if (!isAdminTierRole(roleRaw)) return false;
  const saved = matrix?.[role]?.[moduleKey];
  const fallback = role === "hr" && moduleKey !== "users" && moduleKey !== "documents" ? "view" : "edit";
  return (saved ?? fallback) === "edit";
}
