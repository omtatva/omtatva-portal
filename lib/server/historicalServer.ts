// Server side of "Initialize Historical Attendance" (1 Jul – 30 Sep 2026).
// Super Admin only (checked by the route BEFORE any of this runs).
//
// SAFETY, in order — every one is enforced here on the server:
//  1. production / unverified project  -> refused. Never fabricates attendance.
//  2. exact typed confirmation ("INITIALIZE <project id>")
//  3. the plan is recomputed here from fresh data — the browser's preview is
//     never trusted
//  4. a VERIFIED backup (< 24 h) covering the whole range
//  5. every document is written with create(): an existing record can never
//     be overwritten, a re-run adds nothing (idempotent), a race just skips
//  6. every run is recorded in attendanceInitializations + the activity log

import { Timestamp } from "firebase-admin/firestore";
import { hydrateDataset } from "../attendanceExport";
import { bulkChangeGate } from "../attendanceBackup";
import { classifyEnvironment, type Environment } from "../demoAttendance";
import {
  DEMO_BATCH_ID,
  HISTORY_MONTHS,
  blockedReasonFor,
  buildHistoricalPlan,
  publicPlan,
  type HistoricalPlan,
} from "../historicalPlan";
import { ApiError, adminDb } from "./firebaseAdmin";
import { currentProjectId, listBackups, loadDataset, type SuperAdmin } from "./reportsServer";

const ALREADY_EXISTS = 6; // gRPC status code

export async function serverEnvironment(): Promise<{ projectId: string; environment: Environment }> {
  const projectId = currentProjectId();
  const snap = await adminDb().doc("settings/demoEnvironment").get();
  const marker = snap.exists ? (snap.data() as { isDemoEnvironment?: boolean; projectId?: string }) : null;
  return { projectId, environment: classifyEnvironment(projectId, marker) };
}

async function freshPlan(now: Date): Promise<HistoricalPlan> {
  const [{ projectId, environment }, ds] = await Promise.all([serverEnvironment(), loadDataset(now)]);
  return buildHistoricalPlan({ dataset: hydrateDataset(ds), environment, projectId, now });
}

export async function previewHistorical() {
  const plan = await freshPlan(new Date());
  return publicPlan(plan);
}

export type MonthResult = { month: string; created: number; skipped: number; corrected: number };

export async function initializeHistoricalDemo(admin: SuperAdmin, body: { confirm?: unknown }) {
  const now = new Date();
  const { projectId, environment } = await serverEnvironment();

  // 1. never in production / unverified projects
  if (environment !== "demo") {
    throw new ApiError(403, "not-demo-environment", blockedReasonFor(environment));
  }

  // 2. explicit typed confirmation
  if (body.confirm !== `INITIALIZE ${projectId}`) {
    throw new ApiError(400, "confirmation-required", `Type exactly "INITIALIZE ${projectId}" to confirm.`);
  }

  // 3. recompute everything from fresh data (the browser's preview is never trusted)
  const plan = await freshPlan(now);
  if (!plan.generated) throw new ApiError(409, "nothing-to-generate", "Nothing can be generated for this range yet.");

  // 4. verified, fresh backup covering the range
  const backups = await listBackups();
  const gate = bulkChangeGate(
    backups.map((b) => ({ backupId: b.backupId, createdAt: b.createdAtIso, verifiedAt: b.verifiedAt, range: b.range, count: b.count, sha256: b.sha256 })),
    plan.range,
    now
  );
  if (!gate.allowed) throw new ApiError(409, "backup-required", `A verified backup is required first. ${gate.reason}`);

  const db = adminDb();
  const writer = db.bulkWriter();
  writer.onWriteError((error) => {
    if (error.code === ALREADY_EXISTS) return false; // idempotent: skip, never overwrite
    return error.failedAttempts < 3;
  });

  const result = new Map<string, MonthResult>(HISTORY_MONTHS.map((m) => [m, { month: m, created: 0, skipped: 0, corrected: 0 }]));
  let usersCreated = 0;
  let leavesCreated = 0;
  const pending: Promise<void>[] = [];

  // 5. create() only — never set()/update()
  for (const u of plan.newUsers) {
    pending.push(
      writer
        .create(db.collection("users").doc(u.uid), {
          firstName: u.name.split(" ")[0],
          lastName: u.name.split(" ").slice(1).join(" "),
          email: u.email,
          shiftId: u.shiftId || "",
          status: "Active",
          role: "employee",
          isDemo: true,
        })
        .then(() => void usersCreated++, () => undefined)
    );
  }

  for (const l of plan.generated.leaves) {
    pending.push(
      writer
        .create(db.collection("leaveRequests").doc(l.id), l.data)
        .then(() => void leavesCreated++, () => undefined)
    );
  }

  for (const r of plan.generated.attendance) {
    const month = String(r.data.date).slice(0, 7);
    const bucket = result.get(month);
    pending.push(
      writer
        .create(db.collection("attendance").doc(r.id), r.data)
        .then(
          () => void (bucket && bucket.created++),
          () => void (bucket && bucket.skipped++)
        )
    );
  }

  await writer.close();
  await Promise.all(pending);

  // days that already had a record were left exactly as they were
  for (const m of plan.months) {
    const bucket = result.get(m.month);
    if (bucket) bucket.skipped += m.existingRecords;
  }

  const perMonth = [...result.values()].filter((m) => plan.months.some((x) => x.month === m.month));
  const totals = perMonth.reduce(
    (t, m) => ({ created: t.created + m.created, skipped: t.skipped + m.skipped, corrected: t.corrected + m.corrected }),
    { created: 0, skipped: 0, corrected: 0 }
  );

  // 6. audit trail (best effort — the writes above already happened)
  try {
    await db.collection("attendanceInitializations").add({
      at: Timestamp.fromDate(now),
      by: admin.email,
      byUid: admin.uid,
      projectId,
      environment,
      batchId: DEMO_BATCH_ID,
      range: plan.range,
      perMonth,
      totals,
      usersCreated,
      leavesCreated,
    });
    await db.collection("activityLogs").add({
      employeeName: "",
      employeeEmail: "",
      uid: "",
      activity: "Historical Demo Attendance Initialized",
      module: "Attendance",
      type: "Attendance",
      description: `${projectId}: ${totals.created} created, ${totals.skipped} skipped, ${totals.corrected} corrected`,
      updatedBy: admin.email,
      updatedByUid: admin.uid,
      createdAt: Timestamp.fromDate(now),
    });
  } catch (error) {
    console.warn("Initialization audit log failed:", error);
  }

  return { projectId, perMonth, totals, usersCreated, leavesCreated };
}
