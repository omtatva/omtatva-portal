// Remove a REJECTED employee and revoke their access. Server-side so it can
// actually disable the Firebase login (the browser cannot) and so the rules
// below cannot be skipped. See lib/employeeRemoval.ts for what is and is not
// deleted.

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { buildTombstone, checkRemovable } from "../employeeRemoval";
import { canEditModule } from "../modulePermissions";
import { isAdminTierRole, normalizeRole } from "../roles";
import { ApiError, adminAuth, adminDb, type VerifiedUser } from "./firebaseAdmin";

type Caller = VerifiedUser & { role: string };

async function requireUsersEditor(user: VerifiedUser): Promise<Caller> {
  const db = adminDb();
  const email = user.email.trim().toLowerCase();
  const access = email ? await db.doc(`adminAccess/${email}`).get() : null;
  const role = access?.exists ? String(access.data()?.role || "") : "";

  if (!isAdminTierRole(role)) throw new ApiError(403, "forbidden", "Only administrators can remove employees.");

  const perm = await db.doc("settings/permissions").get();
  if (!canEditModule(role, perm.exists ? perm.data()?.matrix : undefined, "users")) {
    throw new ApiError(403, "forbidden", "Your role has view-only access to Employee Management.");
  }
  return { ...user, role: normalizeRole(role) };
}

export async function removeRejectedEmployee(user: VerifiedUser, body: { uid?: unknown; reason?: unknown }) {
  const caller = await requireUsersEditor(user);
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!uid || uid.includes("/")) throw new ApiError(400, "bad-request", "Choose an employee.");

  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();

  if (!snap.exists) {
    // Already removed earlier? Then this is a harmless repeat.
    const done = await db.doc(`removedEmployees/${uid}`).get();
    if (done.exists) return { uid, alreadyRemoved: true, name: String(done.data()?.name || ""), loginDisabled: !!done.data()?.loginDisabled };
    throw new ApiError(404, "not-found", "That employee no longer exists.");
  }

  const data = snap.data() as DocumentData;
  const email = String(data.email || "").trim().toLowerCase();

  // access-list entry for this person (if any) + how many Super Admins exist
  const accessRef = email ? db.doc(`adminAccess/${email}`) : null;
  const accessSnap = accessRef ? await accessRef.get() : null;
  const accessRole = accessSnap?.exists ? String(accessSnap.data()?.role || "") : "";
  const superAdmins = await db.collection("adminAccess").where("role", "==", "super_admin").get();

  const problem = checkRemovable({
    callerUid: caller.uid,
    callerRole: caller.role,
    targetUid: uid,
    targetStatus: String(data.hrApprovalStatus || ""),
    targetAccessRole: accessSnap?.exists ? accessRole : null,
    superAdminCount: superAdmins.size,
  });
  if (problem) throw new ApiError(409, "not-removable", problem);

  // ---- 1. revoke the login FIRST: if this fails nothing else is touched ----
  let loginDisabled = false;
  const auth = adminAuth();
  try {
    await auth.updateUser(uid, { disabled: true });
    await auth.revokeRefreshTokens(uid);
    loginDisabled = true;
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    // no sign-in account exists for this uid: nothing to disable
  }

  // ---- 2. who reports to them? clear those links (no dangling managers) ----
  const reports = await db.collection("reportingStructure").where("managerId", "==", uid).get();

  // ---- 3. one batch: record + deletions -----------------------------------
  const now = new Date();
  const batch = db.batch();

  batch.set(db.doc(`removedEmployees/${uid}`), {
    ...buildTombstone(uid, data, { email, hadAccessEntry: !!accessSnap?.exists, accessRole, loginDisabled, reason }),
    removedAt: Timestamp.fromDate(now),
    removedBy: caller.email,
    removedByUid: caller.uid,
  });

  batch.delete(userRef);
  batch.delete(db.doc(`employees/${uid}`));
  batch.delete(db.doc(`employeeProfiles/${uid}`));
  batch.delete(db.doc(`reportingStructure/${uid}`));
  if (accessRef && accessSnap?.exists) batch.delete(accessRef);

  reports.docs.slice(0, 400).forEach((d) =>
    batch.set(
      d.ref,
      { managerId: "", updatedAt: Timestamp.fromDate(now), updatedBy: caller.email, updatedByUid: caller.uid },
      { merge: true }
    )
  );

  batch.set(db.collection("activityLogs").doc(), {
    employeeName: buildTombstone(uid, data, { email, hadAccessEntry: false, accessRole: "", loginDisabled, reason }).name,
    employeeEmail: email,
    uid,
    activity: "Rejected Employee Removed",
    module: "Users",
    type: "Users",
    description: `Login disabled${accessSnap?.exists ? ", access-list entry removed" : ""}${reason ? ` — ${reason}` : ""}`.slice(0, 300),
    updatedBy: caller.email,
    updatedByUid: caller.uid,
    createdAt: Timestamp.fromDate(now),
  });

  await batch.commit();

  return {
    uid,
    alreadyRemoved: false,
    name: String(data.firstName || "") + (data.lastName ? ` ${data.lastName}` : ""),
    loginDisabled,
    accessEntryRemoved: !!accessSnap?.exists,
    reportsCleared: Math.min(reports.size, 400),
  };
}
