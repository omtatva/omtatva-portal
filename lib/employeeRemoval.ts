// Removing a REJECTED employee (and their access) — pure rules, shared by the
// button (browser) and the server route, and unit-tested.
//
// What "remove" means:
//   * their sign-in is DISABLED and every session revoked, so they cannot log
//     in again (deleting the profile alone is not enough: a Google sign-in
//     would simply create a fresh account)
//   * their profile/roster entries and reporting line are deleted
//   * any entry in the access list (adminAccess) is deleted
//   * a permanent record is kept in removedEmployees (who, when, why)
//   * attendance, leave, payroll and uploaded files are NOT deleted — they
//     are company records that history and payroll depend on

import { isAdminTierRole, normalizeRole } from "./roles";

export type RemovalCheckInput = {
  callerUid: string;
  callerRole: string;
  targetUid: string;
  targetStatus: string; // users/{uid}.hrApprovalStatus
  targetAccessRole: string | null; // adminAccess/{email}.role, null when no entry
  superAdminCount: number; // entries currently holding super_admin
};

export function checkRemovable(i: RemovalCheckInput): string | null {
  if (!i.targetUid) return "Choose an employee.";
  if (i.targetUid === i.callerUid) return "You can't remove your own account.";

  if (String(i.targetStatus || "").trim().toLowerCase() !== "rejected") {
    return "Only employees whose HR approval status is Rejected can be removed.";
  }

  if (i.targetAccessRole && isAdminTierRole(i.targetAccessRole)) {
    if (normalizeRole(i.callerRole) !== "super_admin") {
      return "This person also has admin access. Only a Super Admin can remove them.";
    }
    if (normalizeRole(i.targetAccessRole) === "super_admin" && i.superAdminCount <= 1) {
      return "They are the last Super Admin. Make someone else a Super Admin first.";
    }
  }
  return null;
}

export function confirmText(name: string): string {
  return `Remove ${name || "this person"} and revoke their access?\n\n` +
    "This will:\n" +
    "• disable their login (they can no longer sign in)\n" +
    "• delete their profile and any role / access-list entry\n" +
    "• keep a permanent removal record\n\n" +
    "Their attendance, leave, payroll history and uploaded files are kept.";
}

export type Tombstone = {
  uid: string;
  email: string;
  name: string;
  employeeId: string;
  department: string;
  designation: string;
  role: string;
  hrApprovalStatus: string;
  hadAccessEntry: boolean;
  accessRole: string;
  loginDisabled: boolean;
  reason: string;
};

export function buildTombstone(
  uid: string,
  user: Record<string, unknown>,
  extra: { email: string; hadAccessEntry: boolean; accessRole: string; loginDisabled: boolean; reason: string }
): Tombstone {
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || extra.email || uid;
  return {
    uid,
    email: extra.email,
    name,
    employeeId: String(user.employeeId || ""),
    department: String(user.department || ""),
    designation: String(user.designation || ""),
    role: String(user.role || ""),
    hrApprovalStatus: String(user.hrApprovalStatus || ""),
    hadAccessEntry: extra.hadAccessEntry,
    accessRole: extra.accessRole,
    loginDisabled: extra.loginDisabled,
    reason: extra.reason,
  };
}
