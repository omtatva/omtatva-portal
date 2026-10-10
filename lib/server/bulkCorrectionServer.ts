// Bulk attendance corrections (Super Admin only — the route checks that first).
//
// Each record goes through applyCorrection(): its own transaction, its own
// attendanceCorrections document (original values, new values, reason, who,
// when) and its own statusHistory entry. Bulk adds only: one backup check for
// the whole run, a typed confirmation, and ONE summary line in the activity log.
//
// Re-running the same request is harmless: records already at the target
// status come back as "no change" and are counted as skipped.

import { Timestamp } from "firebase-admin/firestore";
import { MAX_BULK_ITEMS, emptyResult, validateBulk, type BulkItem, type BulkRequest, type BulkResult } from "../bulkCorrection";
import { companyTimezone, localDateString, resolveShift, type PolicyRules, type ResolvedShift } from "../attendancePolicy";
import { computePunchOut, validateBulkPunchOut, type BulkPunchOutRequest } from "../bulkPunchOut";
import { computePunchTimes, validateBulkPunchTimes, type BulkPunchTimesRequest } from "../bulkPunchTimes";
import { isCompletedMonthDate } from "../attendanceCorrection";
import { ApiError, adminDb } from "./firebaseAdmin";
import { applyCorrection, type Admin } from "./correctionServer";
import { assertVerifiedBackupCoversRange } from "./reportsServer";

const SOFT_ERRORS = new Set(["no-change", "record-exists"]);

export async function applyBulkCorrections(admin: Admin, body: BulkRequest): Promise<BulkResult & { total: number }> {
  if (admin.role !== "super_admin") {
    throw new ApiError(403, "forbidden", "Only a Super Admin can run bulk corrections.");
  }

  const errors = validateBulk(body);
  if (errors.length) throw new ApiError(400, "invalid-bulk", errors.join(" "));

  const db = adminDb();
  const now = new Date();
  const rulesSnap = await db.doc("settings/attendanceRules").get();
  const today = localDateString(now, companyTimezone((rulesSnap.exists ? rulesSnap.data() : {}) as PolicyRules));

  // ---- one backup check for the whole request ------------------------
  const refs = body.items.filter((i) => i.recordId).map((i) => db.collection("attendance").doc(i.recordId as string));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  const dateOfRecord = new Map(snaps.map((s) => [s.id, s.exists ? String(s.data()?.date || "") : ""]));

  const dates = body.items
    .map((i) => (i.recordId ? dateOfRecord.get(i.recordId) || "" : String(i.date || "")))
    .filter(Boolean);
  const historical = dates.filter((d) => isCompletedMonthDate(d, today)).sort();
  if (historical.length) {
    await assertVerifiedBackupCoversRange(historical[0], historical[historical.length - 1], now);
  }

  // ---- correct each record through the audited single-record path ----
  const batchId = body.batchId && /^[A-Za-z0-9_-]{6,60}$/.test(body.batchId) ? body.batchId : `bulk_${Date.now()}`;
  const result = emptyResult();

  const run = async (item: BulkItem) => {
    try {
      await applyCorrection(
        admin,
        item.recordId
          ? { kind: "update", recordId: item.recordId, reason: body.reason, confirmVerified: body.confirmVerified, changes: { status: body.status } }
          : { kind: "create", userId: item.userId, date: item.date, reason: body.reason, confirmVerified: body.confirmVerified, changes: { status: body.status } },
        { backupChecked: true, batchId, skipActivityLog: true }
      );
      if (item.recordId) result.updated++;
      else result.created++;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "error";
      if (SOFT_ERRORS.has(code)) {
        result.skipped++;
      } else {
        result.failed++;
        result.errors.push({ item, message: error instanceof ApiError ? error.message : "Could not be saved." });
      }
    }
  };

  // small concurrency: each correction is its own transaction
  const queue = [...body.items];
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await run(item);
    })
  );

  try {
    await db.collection("activityLogs").add({
      employeeName: "",
      employeeEmail: "",
      uid: "",
      activity: "Bulk Attendance Correction",
      module: "Attendance",
      type: "Attendance",
      description: `${body.status}: ${result.updated} updated, ${result.created} created, ${result.skipped} skipped, ${result.failed} failed (${batchId}) — ${body.reason}`.slice(0, 300),
      updatedBy: admin.email,
      updatedByUid: admin.uid,
      createdAt: Timestamp.fromDate(now),
    });
  } catch (error) {
    console.warn("Bulk correction activity log failed:", error);
  }

  return { ...result, total: body.items.length };
}

export { MAX_BULK_ITEMS };


// ---------------------------------------------------------------------------
// Bulk "set punch-out": for records with a punch-in but no punch-out.
// The server computes every time itself from the stored record + the saved
// rules — the browser only chooses the METHOD and the records.
// ---------------------------------------------------------------------------
export async function applyBulkPunchOut(admin: Admin, body: BulkPunchOutRequest): Promise<BulkResult & { total: number }> {
  if (admin.role !== "super_admin") {
    throw new ApiError(403, "forbidden", "Only a Super Admin can run bulk corrections.");
  }

  const errors = validateBulkPunchOut(body);
  if (errors.length) throw new ApiError(400, "invalid-bulk", errors.join(" "));

  const db = adminDb();
  const now = new Date();
  const rulesSnap = await db.doc("settings/attendanceRules").get();
  const rules = (rulesSnap.exists ? rulesSnap.data() : {}) as PolicyRules;
  const today = localDateString(now, companyTimezone(rules));

  // load the records (and, for older records without a saved shift, their employees)
  const recSnaps = await db.getAll(...body.items.map((i) => db.collection("attendance").doc(i.recordId)));
  const userIds = [...new Set(recSnaps.filter((r) => r.exists && !r.data()?.shiftSnapshot).map((r) => String(r.data()?.userId || "")).filter(Boolean))];
  const userSnaps = userIds.length ? await db.getAll(...userIds.map((u) => db.collection("users").doc(u))) : [];
  const shiftOfUser = new Map(userSnaps.map((u) => [u.id, u.exists ? (u.data()?.shiftId as string | undefined) : undefined]));

  // one backup check for the whole request
  const dates = recSnaps.filter((r) => r.exists).map((r) => String(r.data()?.date || "")).filter(Boolean);
  const historical = dates.filter((d) => isCompletedMonthDate(d, today)).sort();
  if (historical.length) await assertVerifiedBackupCoversRange(historical[0], historical[historical.length - 1], now);

  const batchId = body.batchId && /^[A-Za-z0-9_-]{6,60}$/.test(body.batchId) ? body.batchId : `bulk_${Date.now()}`;
  const result = emptyResult();

  const run = async (snap: (typeof recSnaps)[number], recordId: string) => {
    const item = { recordId };
    if (!snap.exists) {
      result.failed++;
      result.errors.push({ item, message: "That record no longer exists." });
      return;
    }
    const d = snap.data() || {};
    const punchIn: Date | null = d.PunchIn?.toDate ? d.PunchIn.toDate() : null;
    if (!punchIn || d.PunchOut) {
      result.skipped++; // nothing to fill in (already has a punch-out / never punched in)
      return;
    }

    const snapShift = d.shiftSnapshot as Partial<ResolvedShift> | undefined;
    const shift: ResolvedShift = snapShift?.startTime
      ? { ...resolveShift(rules, d.shiftId as string), ...snapShift } as ResolvedShift
      : resolveShift(rules, shiftOfUser.get(String(d.userId || "")));

    const at = computePunchOut({
      params: body,
      date: String(d.date || ""),
      punchIn,
      shiftEndAt: d.shiftEndAt?.toDate ? d.shiftEndAt.toDate() : null,
      shift,
      now,
    });
    if (!at.ok) {
      result.failed++;
      result.errors.push({ item, message: at.reason });
      return;
    }

    try {
      await applyCorrection(
        admin,
        { kind: "update", recordId, reason: body.reason, confirmVerified: body.confirmVerified, changes: { punchOut: at.at.toISOString() } },
        { backupChecked: true, batchId, skipActivityLog: true }
      );
      result.updated++;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "error";
      if (SOFT_ERRORS.has(code)) result.skipped++;
      else {
        result.failed++;
        result.errors.push({ item, message: error instanceof ApiError ? error.message : "Could not be saved." });
      }
    }
  };

  const queue = body.items.map((i, idx) => ({ id: i.recordId, snap: recSnaps[idx] }));
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await run(job.snap, job.id);
    })
  );

  const how = body.mode === "shift-end" ? "shift end" : body.mode === "fixed-time" ? `fixed ${body.time}` : `${body.hours} h after punch-in`;
  try {
    await db.collection("activityLogs").add({
      employeeName: "",
      employeeEmail: "",
      uid: "",
      activity: "Bulk Punch-out Set",
      module: "Attendance",
      type: "Attendance",
      description: `${how}: ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed (${batchId}) — ${body.reason}`.slice(0, 300),
      updatedBy: admin.email,
      updatedByUid: admin.uid,
      createdAt: Timestamp.fromDate(now),
    });
  } catch (error) {
    console.warn("Bulk punch-out activity log failed:", error);
  }

  return { ...result, total: body.items.length };
}


// ---------------------------------------------------------------------------
// Bulk "set punch-in and punch-out": for records marked Present that have no
// punch times (or only one of them). The server computes every time itself from
// the stored record + the saved rules; existing punch times are never overwritten.
// ---------------------------------------------------------------------------
export async function applyBulkPunchTimes(admin: Admin, body: BulkPunchTimesRequest): Promise<BulkResult & { total: number }> {
  if (admin.role !== "super_admin") {
    throw new ApiError(403, "forbidden", "Only a Super Admin can run bulk corrections.");
  }

  const errors = validateBulkPunchTimes(body);
  if (errors.length) throw new ApiError(400, "invalid-bulk", errors.join(" "));

  const db = adminDb();
  const now = new Date();
  const rulesSnap = await db.doc("settings/attendanceRules").get();
  const rules = (rulesSnap.exists ? rulesSnap.data() : {}) as PolicyRules;
  const today = localDateString(now, companyTimezone(rules));

  const recSnaps = await db.getAll(...body.items.map((i) => db.collection("attendance").doc(i.recordId)));
  const userIds = [...new Set(recSnaps.filter((r) => r.exists && !r.data()?.shiftSnapshot).map((r) => String(r.data()?.userId || "")).filter(Boolean))];
  const userSnaps = userIds.length ? await db.getAll(...userIds.map((u) => db.collection("users").doc(u))) : [];
  const shiftOfUser = new Map(userSnaps.map((u) => [u.id, u.exists ? (u.data()?.shiftId as string | undefined) : undefined]));

  // one backup check for the whole request
  const dates = recSnaps.filter((r) => r.exists).map((r) => String(r.data()?.date || "")).filter(Boolean);
  const historical = dates.filter((d) => isCompletedMonthDate(d, today)).sort();
  if (historical.length) await assertVerifiedBackupCoversRange(historical[0], historical[historical.length - 1], now);

  const batchId = body.batchId && /^[A-Za-z0-9_-]{6,60}$/.test(body.batchId) ? body.batchId : `bulk_${Date.now()}`;
  const result = emptyResult();

  const run = async (snap: (typeof recSnaps)[number], recordId: string) => {
    const item = { recordId };
    if (!snap.exists) {
      result.failed++;
      result.errors.push({ item, message: "That record no longer exists." });
      return;
    }
    const d = snap.data() || {};
    const snapShift = d.shiftSnapshot as Partial<ResolvedShift> | undefined;
    const shift: ResolvedShift = snapShift?.startTime
      ? { ...resolveShift(rules, d.shiftId as string), ...snapShift } as ResolvedShift
      : resolveShift(rules, shiftOfUser.get(String(d.userId || "")));

    const times = computePunchTimes({
      params: body,
      date: String(d.date || ""),
      status: String(d.status || ""),
      punchIn: d.PunchIn?.toDate ? d.PunchIn.toDate() : null,
      punchOut: d.PunchOut?.toDate ? d.PunchOut.toDate() : null,
      shiftEndAt: d.shiftEndAt?.toDate ? d.shiftEndAt.toDate() : null,
      shift,
      now,
    });
    if (!times.ok) {
      // "already complete" is not an error; anything else is reported with its reason
      if (times.reason.startsWith("Already has both")) result.skipped++;
      else {
        result.failed++;
        result.errors.push({ item, message: times.reason });
      }
      return;
    }

    try {
      await applyCorrection(
        admin,
        {
          kind: "update", recordId, reason: body.reason, confirmVerified: body.confirmVerified,
          changes: { ...(times.setIn ? { punchIn: times.punchIn.toISOString() } : {}), ...(times.setOut ? { punchOut: times.punchOut.toISOString() } : {}) },
        },
        { backupChecked: true, batchId, skipActivityLog: true }
      );
      result.updated++;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "error";
      if (SOFT_ERRORS.has(code)) result.skipped++;
      else {
        result.failed++;
        result.errors.push({ item, message: error instanceof ApiError ? error.message : "Could not be saved." });
      }
    }
  };

  const queue = body.items.map((i, idx) => ({ id: i.recordId, snap: recSnaps[idx] }));
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await run(job.snap, job.id);
    })
  );

  const inHow = body.inMode === "shift-start" ? "shift start" : `fixed ${body.inTime}`;
  const outHow = body.mode === "shift-end" ? "shift end" : body.mode === "fixed-time" ? `fixed ${body.time}` : `${body.hours} h after punch-in`;
  try {
    await db.collection("activityLogs").add({
      employeeName: "",
      employeeEmail: "",
      uid: "",
      activity: "Bulk Punch Times Set",
      module: "Attendance",
      type: "Attendance",
      description: `in ${inHow}, out ${outHow}: ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed (${batchId}) — ${body.reason}`.slice(0, 300),
      updatedBy: admin.email,
      updatedByUid: admin.uid,
      createdAt: Timestamp.fromDate(now),
    });
  } catch (error) {
    console.warn("Bulk punch-times activity log failed:", error);
  }

  return { ...result, total: body.items.length };
}
