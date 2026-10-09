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
import { companyTimezone, localDateString, type PolicyRules } from "../attendancePolicy";
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
