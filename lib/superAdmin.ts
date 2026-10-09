// Super Admin gate for Attendance Reports, audit/correction summaries and
// backup controls. Pure (no Firebase imports) so the exact same rule is used
// by the server routes and by the tests.
//
// Who is a Super Admin is decided ONLY by the adminAccess/{email} document
// (Settings -> Access Management) — never by a label on users/{uid}, and
// never by anything the browser sends.

import { isSuperAdminRole, normalizeRole } from "./roles";

export class ForbiddenError extends Error {
  status = 403;
  code = "forbidden";
  constructor(message = "Only a Super Admin can access attendance reports.") {
    super(message);
  }
}

// True only for the Super Admin role. Unknown, empty or look-alike roles
// ("manager", "team_lead", "admin", "hr", "head", "employee", "super") are
// all denied — roles that don't exist yet normalise to "employee".
export function isSuperAdminAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  return isSuperAdminRole(normalizeRole(role));
}

export function assertSuperAdmin(role: string | null | undefined): void {
  if (!isSuperAdminAccess(role)) throw new ForbiddenError();
}

// Server routes pass a lookup so the check can be tested without Firestore.
export async function requireSuperAdminEmail(
  email: string | null | undefined,
  getRole: (email: string) => Promise<string | null | undefined>
): Promise<string> {
  const e = (email || "").trim().toLowerCase();
  if (!e) throw new ForbiddenError();
  const role = await getRole(e);
  assertSuperAdmin(role);
  return e;
}
