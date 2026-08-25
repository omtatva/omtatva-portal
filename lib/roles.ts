// Canonical role list — every role dropdown and access gate in the app
// reads from this single source instead of keeping its own copy, which is
// how the role strings used to drift out of sync with each other.

export type RoleValue = "employee" | "hr" | "head" | "admin" | "super_admin";

export type Role = {
  value: RoleValue;
  label: string;
  adminTier: boolean;
  isSuperAdmin?: boolean;
};

export const ROLES: Role[] = [
  { value: "employee", label: "Employee", adminTier: false },
  { value: "hr", label: "HR Admin", adminTier: true },
  { value: "head", label: "Head", adminTier: true },
  { value: "admin", label: "Admin", adminTier: true },
  { value: "super_admin", label: "Super Admin", adminTier: true, isSuperAdmin: true },
];

export const ADMIN_TIER_ROLES: RoleValue[] = ROLES.filter((r) => r.adminTier).map(
  (r) => r.value
);

export const SUPER_ADMIN_ROLES: RoleValue[] = ROLES.filter((r) => r.isSuperAdmin).map(
  (r) => r.value
);

// Accepts any of the mixed-case/spaced role strings that existed before
// this refactor ("Super Admin", "HR Admin", "Head", "admin", ...) and maps
// them onto a canonical RoleValue, defaulting to "employee".
export function normalizeRole(role?: string | null): RoleValue {
  const key = (role || "").trim().toLowerCase().replace(/\s+/g, "_");
  const match = ROLES.find((r) => r.value === key);
  return match ? match.value : "employee";
}

export function roleLabel(role?: string | null): string {
  const value = normalizeRole(role);
  return ROLES.find((r) => r.value === value)?.label || "Employee";
}

export function isAdminTierRole(role?: string | null): boolean {
  return ADMIN_TIER_ROLES.includes(normalizeRole(role));
}

export function isSuperAdminRole(role?: string | null): boolean {
  return SUPER_ADMIN_ROLES.includes(normalizeRole(role));
}
