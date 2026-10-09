// Safety checks for Settings -> Access Management (pure, unit-tested).
// The Firestore rules only let a Super Admin edit access, so the one way to
// lock everybody out of Settings is to demote or remove the LAST Super Admin.

import { normalizeRole } from "./roles";

type Entry = { email: string; role: string };

const superAdmins = (entries: Entry[]) => entries.filter((e) => normalizeRole(e.role) === "super_admin");

export function checkRoleChange(entries: Entry[], email: string, newRole: string): string | null {
  const target = entries.find((e) => e.email === email);
  if (!target) return null;
  const wasSuper = normalizeRole(target.role) === "super_admin";
  if (wasSuper && normalizeRole(newRole) !== "super_admin" && superAdmins(entries).length <= 1) {
    return "At least one Super Admin must remain. Make someone else a Super Admin first.";
  }
  return null;
}

export function checkRemoval(entries: Entry[], email: string): string | null {
  const target = entries.find((e) => e.email === email);
  if (target && normalizeRole(target.role) === "super_admin" && superAdmins(entries).length <= 1) {
    return "You can't remove the last Super Admin. Make someone else a Super Admin first.";
  }
  return null;
}
