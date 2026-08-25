// Per-role, per-module View/Edit permission matrix — configured from
// Settings -> Access Management, stored in settings/permissions.
// "View" means the page loads and shows data as normal; "Edit" means the
// save/approve/reject/delete/upload actions on that page are enabled.
// This only restricts admin-tier roles among themselves — it never
// grants access to someone who isn't admin-tier to begin with (that's
// still adminAccess/useAccess's job).

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { ADMIN_TIER_ROLES, SUPER_ADMIN_ROLES, type RoleValue } from "./roles";

export type PermissionLevel = "view" | "edit";

export type ModuleKey =
  | "users"
  | "documents"
  | "attendance"
  | "leave"
  | "payroll"
  | "holidays"
  | "announcements"
  | "assets"
  | "salaryStructure"
  | "timesheet"
  | "attendanceSettings";

export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "users", label: "Employee Management" },
  { key: "documents", label: "Documents" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave / WFH Approvals" },
  { key: "payroll", label: "Payroll" },
  { key: "holidays", label: "Holidays" },
  { key: "announcements", label: "Announcements" },
  { key: "assets", label: "Assets" },
  { key: "salaryStructure", label: "Salary Structure" },
  { key: "timesheet", label: "Timesheet" },
  { key: "attendanceSettings", label: "Attendance Settings" },
];

export type PermissionMatrix = Record<string, Partial<Record<ModuleKey, PermissionLevel>>>;

// Seeded the first time anyone opens the Module Permissions screen (or
// before that doc exists at all): HR can edit Employee Management and
// Documents, view-only everywhere else. Every other admin-tier role
// defaults to edit everywhere, so turning this feature on doesn't
// silently restrict anyone who wasn't asked about.
export function defaultMatrix(): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const role of ADMIN_TIER_ROLES) {
    matrix[role] = {};
    for (const { key } of MODULES) {
      const isHr = role === "hr";
      const isEmployeeOrDocs = key === "users" || key === "documents";
      matrix[role][key] = isHr && !isEmployeeOrDocs ? "view" : "edit";
    }
  }
  return matrix;
}

export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  const snap = await getDoc(doc(db, "settings", "permissions"));
  const saved = snap.exists() ? (snap.data().matrix as PermissionMatrix) : {};
  // Merge over defaults so newly added modules/roles always have a
  // sensible value even if the saved doc predates them.
  const merged = defaultMatrix();
  for (const role of Object.keys(saved || {})) {
    merged[role] = { ...merged[role], ...saved[role] };
  }
  return merged;
}

export async function savePermissionMatrix(matrix: PermissionMatrix) {
  await setDoc(doc(db, "settings", "permissions"), { matrix }, { merge: true });
}

// Super Admin always has edit everywhere, regardless of the saved
// matrix — a safety net so a misconfiguration can never lock the one
// role that can fix Settings out of the pages needed to fix it.
export function resolveCanEdit(
  matrix: PermissionMatrix,
  role: RoleValue,
  moduleKey: ModuleKey
): boolean {
  if (SUPER_ADMIN_ROLES.includes(role)) return true;
  return (matrix[role]?.[moduleKey] ?? "edit") === "edit";
}
