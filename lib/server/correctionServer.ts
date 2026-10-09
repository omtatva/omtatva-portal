// Server-side attendance corrections. Every change:
//  - needs a verified administrator whose role may edit Attendance,
//  - needs a written reason,
//  - keeps the ORIGINAL punch timestamps (originalPunchIn/Out) the first
//    time they are changed,
//  - is written in one transaction together with an immutable
//    attendanceCorrections/{id} document holding the before/after values,
//    who did it and when,
//  - appends to the record's own statusHistory and to activityLogs.
// Nothing is ever deleted.

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { canEditAttendance, canRevert, diffChanges, isCompletedMonthDate, validateCorrection, type CorrectionRequest, type RecordValues } from "../attendanceCorrection";
import { companyTimezone, localDateString, type PolicyRules } from "../attendancePolicy";
import { isAdminTierRole, normalizeRole } from "../roles";
import { ApiError, adminDb, type VerifiedUser } from "./firebaseAdmin";
import { assertVerifiedBackupCovers } from "./reportsServer";

export type Admin = VerifiedUser & { role: string };

export async function requireAttendanceAdmin(user: VerifiedUser): Promise<Admin> {
  const db = adminDb();
  const email = user.email.trim().toLowerCase();
  if (!email) throw new ApiError(403, "forbidden", "Only administrators can correct attendance.");

  const access = await db.doc(`adminAccess/${email}`).get();
  const role = access.exists ? String(access.data()?.role || "") : "";

  if (!isAdminTierRole(role)) {
    throw new ApiError(403, "forbidden", "Only administrators can correct attendance.");
  }

  const permSnap = await db.doc("settings/permissions").get();
  const matrix = permSnap.exists ? permSnap.data()?.matrix : undefined;

  if (!canEditAttendance(role, matrix)) {
    throw new ApiError(403, "forbidden", "Your role has view-only access to Attendance. Ask a Super Admin to grant edit access.");
  }

  return { ...user, role: normalizeRole(role) };
}

const toValues = (d: DocumentData): RecordValues => ({
  status: String(d.status || ""),
  punchIn: d.PunchIn?.toDate ? d.PunchIn.toDate() : null,
  punchOut: d.PunchOut?.toDate ? d.PunchOut.toDate() : null,
  totalHours: Number(d.totalHours || 0),
});

const toPlain = (v: RecordValues) => ({
  status: v.status,
  PunchIn: v.punchIn ? v.punchIn.toISOString() : null,
  PunchOut: v.punchOut ? v.punchOut.toISOString() : null,
  totalHours: v.totalHours,
});

const ts = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);

export type CorrectionOptions = {
  // The caller already verified a backup covering every date it will touch.
  backupChecked?: boolean;
  // Groups the corrections of one bulk run (stored on each correction document).
  batchId?: string;
  // A bulk run writes ONE summary activity entry instead of one per record.
  skipActivityLog?: boolean;
};

export async function applyCorrection(admin: Admin, req: CorrectionRequest, opts: CorrectionOptions = {}) {
  const db = adminDb();
  const now = new Date();

  const rulesSnap = await db.doc("settings/attendanceRules").get();
  const rules = (rulesSnap.exists ? rulesSnap.data() : {}) as PolicyRules;
  const today = localDateString(now, companyTimezone(rules));

  const check = validateCorrection(req, { today });
  if (!check.ok) throw new ApiError(400, "invalid-correction", check.errors.join(" "));

  const reason = req.reason.trim();
  const by = { uid: admin.uid, email: admin.email, name: admin.name, role: admin.role };
  const attendance = db.collection("attendance");
  const corrections = db.collection("attendanceCorrections");

  // Corrections to a COMPLETED month are historical: they need a Super Admin
  // (authorised review) and a verified, fresh backup covering that date.
  let targetDate = req.date || "";
  if (req.kind === "update" && req.recordId) {
    const s = await attendance.doc(req.recordId).get();
    targetDate = s.exists ? String(s.data()?.date || "") : "";
  }
  if (req.kind === "revert" && req.correctionId) {
    const s = await corrections.doc(req.correctionId).get();
    targetDate = s.exists ? String(s.data()?.date || "") : "";
  }
  if (targetDate && isCompletedMonthDate(targetDate, today)) {
    if (admin.role !== "super_admin") {
      throw new ApiError(403, "super-admin-required", "Corrections to a completed month can only be made by a Super Admin.");
    }
    if (!opts.backupChecked) await assertVerifiedBackupCovers(targetDate, now);
  }

  const result = await db.runTransaction(async (tx) => {
    // ------------------------------------------------------------ UPDATE
    if (req.kind === "update") {
      const ref = attendance.doc(req.recordId as string);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ApiError(404, "not-found", "That attendance record no longer exists.");

      const data = snap.data() as DocumentData;
      const before = toValues(data);
      const { after, list } = diffChanges(before, req.changes || {});
      if (list.length === 0) throw new ApiError(409, "no-change", "The record already has these values.");
      if (after.punchIn && after.punchOut && after.punchOut.getTime() <= after.punchIn.getTime()) {
        throw new ApiError(400, "invalid-correction", "Punch-out must be after punch-in.");
      }

      const correctionRef = corrections.doc();
      const patch: Record<string, unknown> = {
        status: after.status,
        PunchIn: ts(after.punchIn),
        PunchOut: ts(after.punchOut),
        totalHours: after.totalHours,
        lastCorrectedAt: Timestamp.fromDate(now),
        lastCorrectedBy: admin.email,
        lastCorrectionId: correctionRef.id,
        statusHistory: [
          ...(Array.isArray(data.statusHistory) ? data.statusHistory : []),
          {
            at: Timestamp.fromDate(now),
            type: "correction",
            from: before.status || null,
            to: after.status,
            reason,
            by: admin.email,
            correctionId: correctionRef.id,
          },
        ],
      };
      // Keep the very first punch timestamps, whatever happens later.
      if (list.some((c) => c.field === "PunchIn") && !data.originalPunchIn && before.punchIn) {
        patch.originalPunchIn = Timestamp.fromDate(before.punchIn);
      }
      if (list.some((c) => c.field === "PunchOut") && !data.originalPunchOut && before.punchOut) {
        patch.originalPunchOut = Timestamp.fromDate(before.punchOut);
      }

      tx.update(ref, patch);
      tx.create(correctionRef, {
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
        kind: "update",
        recordId: ref.id,
        userId: data.userId || "",
        employeeName: data.employeeName || "",
        date: data.date || "",
        reason,
        before: toPlain(before),
        after: toPlain(after),
        changes: list,
        by,
        at: Timestamp.fromDate(now),
      });

      return { correctionId: correctionRef.id, changes: list, userId: data.userId, name: data.employeeName, date: data.date };
    }

    // ------------------------------------------------------------ CREATE
    if (req.kind === "create") {
      const existing = await tx.get(
        attendance.where("userId", "==", req.userId as string).where("date", "==", req.date as string)
      );
      if (!existing.empty) {
        throw new ApiError(409, "record-exists", "A record already exists for that day — correct it instead of creating a new one.");
      }
      const userSnap = await tx.get(db.doc(`users/${req.userId}`));
      if (!userSnap.exists) throw new ApiError(404, "no-employee", "That employee does not exist.");
      const u = userSnap.data() as DocumentData;
      const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "";

      const empty: RecordValues = { status: "", punchIn: null, punchOut: null, totalHours: 0 };
      const { after, list } = diffChanges(empty, req.changes || {});

      const ref = attendance.doc();
      const correctionRef = corrections.doc();

      tx.create(ref, {
        userId: req.userId,
        employeeName: name,
        email: u.email || "",
        date: req.date,
        PunchIn: ts(after.punchIn),
        PunchOut: ts(after.punchOut),
        totalHours: after.totalHours,
        extraHours: 0,
        status: after.status,
        attendanceSource: "Admin correction",
        createdByCorrection: true,
        verifiedBy: admin.email,
        lastCorrectedAt: Timestamp.fromDate(now),
        lastCorrectedBy: admin.email,
        lastCorrectionId: correctionRef.id,
        statusHistory: [
          {
            at: Timestamp.fromDate(now),
            type: "correction",
            from: null,
            to: after.status,
            reason,
            by: admin.email,
            correctionId: correctionRef.id,
          },
        ],
        createdAt: Timestamp.fromDate(now),
      });

      tx.create(correctionRef, {
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
        kind: "create",
        recordId: ref.id,
        userId: req.userId,
        employeeName: name,
        date: req.date,
        reason,
        before: null,
        after: toPlain(after),
        changes: list,
        by,
        at: Timestamp.fromDate(now),
      });

      return { correctionId: correctionRef.id, changes: list, userId: req.userId, name, date: req.date };
    }

    // ------------------------------------------------------------ REVERT
    const target = await tx.get(corrections.doc(req.correctionId as string));
    if (!target.exists) throw new ApiError(404, "not-found", "That correction no longer exists.");
    const c = target.data() as DocumentData;

    if (c.kind === "create" || !c.before) {
      throw new ApiError(409, "not-revertable", "A record created by a correction can't be reverted — correct it again instead.");
    }
    if (c.revertedBy) throw new ApiError(409, "already-reverted", "That correction was already reverted.");
    if (c.kind === "revert") throw new ApiError(409, "not-revertable", "A revert can't be reverted — apply a new correction instead.");

    const ref = attendance.doc(c.recordId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(404, "not-found", "The attendance record no longer exists.");
    const data = snap.data() as DocumentData;
    const current = toValues(data);

    const safe = canRevert(current, c.after);
    if (!safe.ok) throw new ApiError(409, "changed-since", safe.reason);

    const restored: RecordValues = {
      status: c.before.status,
      punchIn: c.before.PunchIn ? new Date(c.before.PunchIn) : null,
      punchOut: c.before.PunchOut ? new Date(c.before.PunchOut) : null,
      totalHours: Number(c.before.totalHours || 0),
    };

    const revertRef = corrections.doc();
    tx.update(ref, {
      status: restored.status,
      PunchIn: ts(restored.punchIn),
      PunchOut: ts(restored.punchOut),
      totalHours: restored.totalHours,
      lastCorrectedAt: Timestamp.fromDate(now),
      lastCorrectedBy: admin.email,
      lastCorrectionId: revertRef.id,
      statusHistory: [
        ...(Array.isArray(data.statusHistory) ? data.statusHistory : []),
        {
          at: Timestamp.fromDate(now),
          type: "revert",
          from: current.status || null,
          to: restored.status,
          reason,
          by: admin.email,
          correctionId: revertRef.id,
          revertOf: target.id,
        },
      ],
    });
    tx.create(revertRef, {
      kind: "revert",
      revertOf: target.id,
      recordId: ref.id,
      userId: data.userId || "",
      employeeName: data.employeeName || "",
      date: data.date || "",
      reason,
      before: toPlain(current),
      after: toPlain(restored),
      changes: [],
      by,
      at: Timestamp.fromDate(now),
    });
    tx.update(target.ref, { revertedBy: revertRef.id, revertedAt: Timestamp.fromDate(now) });

    return { correctionId: revertRef.id, changes: [], userId: data.userId, name: data.employeeName, date: data.date };
  });

  // Best-effort entry in the shared Recent Activity feed.
  if (opts.skipActivityLog) return { correctionId: result.correctionId, changes: result.changes };
  try {
    await db.collection("activityLogs").add({
      employeeName: result.name || "",
      employeeEmail: "",
      uid: result.userId || "",
      activity: req.kind === "revert" ? "Attendance Correction Reverted" : "Attendance Corrected",
      module: "Attendance",
      type: "Attendance",
      description: `${result.date}: ${reason}`.slice(0, 300),
      updatedBy: admin.email,
      updatedByUid: admin.uid,
      createdAt: Timestamp.fromDate(now),
    });
  } catch (error) {
    console.warn("Activity log for correction failed:", error);
  }

  return { correctionId: result.correctionId, changes: result.changes };
}
