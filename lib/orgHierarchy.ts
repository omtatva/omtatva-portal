// Organization hierarchy — pure data helpers (no React, no Firestore calls
// in here so they are trivially testable).
//
// Source of truth for "who reports to whom" is the `reportingStructure`
// collection: one doc per employee, doc id = the employee's Firebase UID,
// holding `managerId` (the manager's Firebase UID). Everything else (name,
// photo, designation, department, role) is resolved live from the
// employee records — users/{uid} and employeeProfiles/{uid} — never copied.

import { roleLabel } from "./roles";

export const REPORTING_COLLECTION = "reportingStructure";

export type OrgPerson = {
  uid: string;
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  department: string;
  role: string;
  photo: string;
  gender: string;
  active: boolean;
  managerId: string;
};

export type OrgIndex = {
  people: OrgPerson[];
  byId: Map<string, OrgPerson>;
  // Direct reports, sorted by name. Only contains edges whose manager
  // actually exists as a record and is not the person themself.
  children: Map<string, string[]>;
  // Employees whose stored managerId points at a record that no longer
  // exists (deleted user). uid -> the dangling manager uid.
  danglingManager: Map<string, string>;
  // Top-level people: no manager, or manager record missing.
  roots: string[];
  // People caught in a circular chain in stored data (should never
  // happen via the UI, but data can be edited from the console).
  cyclic: Set<string>;
};

const INACTIVE_STATUSES = ["inactive", "terminated", "resigned", "disabled", "left"];

type Raw = Record<string, unknown> | undefined;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return "";
}

// Merge users/{uid} + employeeProfiles/{uid} + reportingStructure/{uid}
// into one display record. The profile photo lives on employeeProfiles
// (that is what the Profile page uploads to); users only carries one for
// older uploads / the Google sign-in photo, so it is the fallback.
export function buildPerson(
  uid: string,
  user: Raw,
  profile: Raw,
  managerId: string
): OrgPerson {
  const email = firstNonEmpty(user?.email, profile?.email);

  const fullName =
    `${firstNonEmpty(profile?.firstName, user?.firstName)} ${firstNonEmpty(
      profile?.lastName,
      user?.lastName
    )}`.trim() ||
    firstNonEmpty(user?.name, user?.displayName, profile?.fullName) ||
    (email ? email.split("@")[0] : "");

  const documents = profile?.documents as Record<string, unknown> | undefined;

  const status = str(user?.status).toLowerCase();
  const approval = str(user?.hrApprovalStatus).toLowerCase();

  return {
    uid,
    name: fullName || "Unnamed employee",
    email,
    employeeId: firstNonEmpty(user?.employeeId, profile?.employeeCode),
    // HR edits designation/department from Admin -> Users (writes users/),
    // so it wins; the employee's own profile value is the fallback.
    designation: firstNonEmpty(user?.designation, profile?.designation),
    department: firstNonEmpty(user?.department, profile?.department),
    role: roleLabel(str(user?.role)),
    photo: firstNonEmpty(
      profile?.profilePhoto,
      user?.profilePhoto,
      user?.photoURL,
      documents?.photo,
      user?.profileImage
    ),
    gender: firstNonEmpty(profile?.gender, user?.gender),
    active: !INACTIVE_STATUSES.includes(status) && approval !== "rejected",
    managerId,
  };
}

export function buildIndex(people: OrgPerson[]): OrgIndex {
  const byId = new Map<string, OrgPerson>();
  for (const p of people) byId.set(p.uid, p);

  const children = new Map<string, string[]>();
  const danglingManager = new Map<string, string>();

  for (const p of people) {
    const m = p.managerId;
    if (!m || m === p.uid) continue;
    if (!byId.has(m)) {
      danglingManager.set(p.uid, m);
      continue;
    }
    const list = children.get(m);
    if (list) list.push(p.uid);
    else children.set(m, [p.uid]);
  }

  const byName = (a: string, b: string) =>
    (byId.get(a)?.name || "").localeCompare(byId.get(b)?.name || "");
  for (const list of children.values()) list.sort(byName);

  const hasLiveManager = (p: OrgPerson) =>
    !!p.managerId && p.managerId !== p.uid && byId.has(p.managerId);

  const roots = people
    .filter((p) => !hasLiveManager(p))
    .map((p) => p.uid)
    .sort(byName);

  // Anything unreachable from a root is stuck in a loop.
  const seen = new Set<string>();
  const walk = (uid: string) => {
    if (seen.has(uid)) return;
    seen.add(uid);
    for (const c of children.get(uid) || []) walk(c);
  };
  roots.forEach(walk);

  const cyclic = new Set<string>();
  for (const p of people) {
    if (seen.has(p.uid)) continue;

    // Follow managers upward until a node repeats: that node and everything
    // after it is the loop. Flag every member, and start the tree at one of
    // them so the whole group still renders.
    const trail: string[] = [];
    let cursor: string | undefined = p.uid;
    while (cursor && !trail.includes(cursor)) {
      trail.push(cursor);
      cursor = byId.get(cursor)?.managerId;
    }
    const loopStart = cursor && trail.includes(cursor) ? trail.indexOf(cursor) : 0;
    const loop = trail.slice(loopStart);
    loop.forEach((id) => cyclic.add(id));

    roots.push(loop[0]);
    walk(loop[0]);
  }

  return { people, byId, children, danglingManager, roots, cyclic };
}

// Manager chain, nearest first: [direct manager, their manager, ...].
// Stops at a missing record or a loop.
export function getManagerChain(index: OrgIndex, uid: string): OrgPerson[] {
  const chain: OrgPerson[] = [];
  const visited = new Set<string>([uid]);
  let current = index.byId.get(uid);

  while (current) {
    const mid = current.managerId;
    if (!mid || visited.has(mid)) break;
    const manager = index.byId.get(mid);
    if (!manager) break;
    visited.add(mid);
    chain.push(manager);
    current = manager;
  }
  return chain;
}

export function getDirectReports(index: OrgIndex, uid: string): OrgPerson[] {
  return (index.children.get(uid) || [])
    .map((id) => index.byId.get(id))
    .filter((p): p is OrgPerson => !!p);
}

export function getDescendantIds(index: OrgIndex, uid: string): Set<string> {
  const out = new Set<string>();
  const stack = [...(index.children.get(uid) || [])];
  while (stack.length) {
    const id = stack.pop() as string;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(index.children.get(id) || []));
  }
  return out;
}

// Teammates = other direct reports of the same manager.
export function getPeers(index: OrgIndex, uid: string): OrgPerson[] {
  const me = index.byId.get(uid);
  if (!me || !me.managerId) return [];
  return getDirectReports(index, me.managerId).filter((p) => p.uid !== uid);
}

export type AssignmentCheck = { ok: true } | { ok: false; reason: string };

// Validates a proposed "employee reports to manager" edge.
// managerId === "" (clearing the manager) is always allowed.
export function validateAssignment(
  index: OrgIndex,
  employeeId: string,
  managerId: string
): AssignmentCheck {
  if (!managerId) return { ok: true };

  if (managerId === employeeId) {
    return { ok: false, reason: "An employee cannot be their own reporting manager." };
  }

  const manager = index.byId.get(managerId);
  if (!manager) {
    return { ok: false, reason: "The selected manager no longer exists." };
  }
  if (!manager.active) {
    return { ok: false, reason: `${manager.name} is inactive and cannot be assigned as a manager.` };
  }

  // Walk up from the proposed manager; reaching the employee means the
  // employee is already above the manager -> A under B while B under A.
  const visited = new Set<string>();
  let cursor: OrgPerson | undefined = manager;
  while (cursor && !visited.has(cursor.uid)) {
    if (cursor.uid === employeeId) {
      const employeeName = index.byId.get(employeeId)?.name || "This employee";
      return {
        ok: false,
        reason: `${manager.name} already reports (directly or indirectly) to ${employeeName}. This would create a circular reporting loop.`,
      };
    }
    visited.add(cursor.uid);
    cursor = cursor.managerId ? index.byId.get(cursor.managerId) : undefined;
  }

  return { ok: true };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + last).toUpperCase() || "?";
}

export function matchesQuery(p: OrgPerson, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return [p.name, p.email, p.employeeId, p.designation, p.department, p.role]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}
