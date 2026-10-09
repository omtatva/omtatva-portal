// Server side of Attendance Reports. EVERY function here sits behind
// requireSuperAdmin(): the report data, CSV export, correction history and
// backups are only ever produced for a verified Super Admin, regardless of
// what the browser UI shows.

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { buildMonthlyCsv, hydrateDataset, type DatasetEmployee, type ReportDataset } from "../attendanceExport";
import { createBackupFile, bulkChangeGate, type BackupFile, type BackupMetaRecord } from "../attendanceBackup";
import { availableMonths, findArchiveMonth } from "../attendanceMonths";
import { companyTimezone, type PolicyRules } from "../attendancePolicy";
import { shouldIncludeDemo } from "../demoAttendance";
import { ForbiddenError, requireSuperAdminEmail } from "../superAdmin";
import { ApiError, adminDb, type VerifiedUser } from "./firebaseAdmin";

export type SuperAdmin = VerifiedUser & { role: "super_admin" };

export async function requireSuperAdmin(user: VerifiedUser): Promise<SuperAdmin> {
  try {
    await requireSuperAdminEmail(user.email, async (email) => {
      const snap = await adminDb().doc(`adminAccess/${email}`).get();
      return snap.exists ? String(snap.data()?.role || "") : "";
    });
  } catch (error) {
    if (error instanceof ForbiddenError) throw new ApiError(403, "forbidden", error.message);
    throw error;
  }
  return { ...user, role: "super_admin" };
}

const PRODUCTION_PROJECT_ID = "omtatva-portal";

export function currentProjectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || PRODUCTION_PROJECT_ID;
}

// Demo records may be shown ONLY in a project that was explicitly marked as a
// demo/test environment (settings/demoEnvironment, written by the demo
// generator's --init-test-project step) and is not production.
export async function isDemoEnvironment(): Promise<boolean> {
  const project = currentProjectId();
  if (project === PRODUCTION_PROJECT_ID) return false;
  const snap = await adminDb().doc("settings/demoEnvironment").get();
  return shouldIncludeDemo(project, snap.exists ? (snap.data() as { isDemoEnvironment?: boolean; projectId?: string }) : null);
}

const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : null;
};

const RULE_FIELDS = [
  "timezone",
  "shifts",
  "graceMinutes",
  "extraBufferMinutes",
  "officeStartTime",
  "officeEndTime",
  "workingDays",
  "absentPolicy",
];

export async function loadDataset(now: Date = new Date()): Promise<ReportDataset> {
  const db = adminDb();
  const includesDemo = await isDemoEnvironment();

  const [usersSnap, rulesSnap, holSnap, leaveSnap, attSnap] = await Promise.all([
    db.collection("users").get(),
    db.doc("settings/attendanceRules").get(),
    db.collection("holidays").get(),
    db.collection("leaveRequests").where("status", "==", "Approved").get(),
    db.collection("attendance").get(),
  ]);

  const rulesData = rulesSnap.exists ? (rulesSnap.data() as DocumentData) : null;
  const rules = rulesData ? Object.fromEntries(RULE_FIELDS.filter((k) => k in rulesData).map((k) => [k, rulesData[k]])) : null;

  const employees: DatasetEmployee[] = usersSnap.docs
    .filter((d) => includesDemo || d.data().isDemo !== true)
    .map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || String(u.email || d.id).split("@")[0],
        employeeId: String(u.employeeId || ""),
        department: String(u.department || ""),
        designation: String(u.designation || ""),
        shiftId: u.shiftId ? String(u.shiftId) : null,
        joiningDate: String(u.joiningDate || ""),
        inactive: String(u.status || "").toLowerCase() === "inactive",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const records = attSnap.docs
    .filter((d) => includesDemo || d.data().isDemo !== true)
    .map((d) => {
      const x = d.data();
      const history = Array.isArray(x.statusHistory) ? x.statusHistory : [];
      return {
        id: d.id,
        userId: x.userId || "",
        date: x.date || "",
        status: x.status || "",
        PunchIn: iso(x.PunchIn),
        PunchOut: iso(x.PunchOut),
        totalHours: Number(x.totalHours || 0),
        shiftId: x.shiftId || "",
        shiftName: x.shiftName || "",
        shiftSnapshot: x.shiftSnapshot || null,
        shiftEndAt: iso(x.shiftEndAt),
        attendanceSource: x.attendanceSource || "",
        statusReason: x.statusReason || "",
        isDemo: x.isDemo === true,
        lastCorrectedAt: iso(x.lastCorrectedAt),
        lastCorrectedBy: x.lastCorrectedBy || "",
        policy: x.policy ? { applied: x.policy.applied === true } : null,
        statusHistory: history.map((h: DocumentData) => ({
          at: iso(h.at),
          type: h.type || "",
          from: h.from ?? null,
          to: h.to ?? null,
          reason: h.reason || "",
          by: h.by || "",
        })),
      };
    });

  return {
    generatedAt: now.toISOString(),
    timezone: companyTimezone(rules as PolicyRules | null),
    includesDemo,
    recordCount: records.length,
    employees,
    rules,
    holidays: holSnap.docs.map((d) => String(d.data().date || "")).filter(Boolean),
    leaves: leaveSnap.docs
      .filter((d) => includesDemo || d.data().isDemo !== true)
      .map((d) => {
        const l = d.data();
        return { uid: String(l.uid || l.userId || ""), fromDate: String(l.fromDate || ""), toDate: String(l.toDate || "") };
      }),
    records,
  };
}

export async function buildExport(admin: SuperAdmin, monthKey: string, employee: string) {
  const now = new Date();
  const ds = await loadDataset(now);
  const month = findArchiveMonth(monthKey, now, ds.rules as PolicyRules | null);
  if (!month) {
    throw new ApiError(400, "invalid-month", "That month is not available (future months and months before July 2026 can't be exported).");
  }
  const h = hydrateDataset(ds);
  if (employee !== "all" && !h.employees.some((e) => e.uid === employee)) {
    throw new ApiError(400, "invalid-employee", "That employee does not exist.");
  }
  const out = buildMonthlyCsv(h, month, employee, now);
  console.info(`Attendance export by ${admin.email}: ${month.key} employee=${employee} rows=${out.rowCount}`);
  return out;
}

export function months(ds: ReportDataset, now: Date = new Date()) {
  return availableMonths(now, ds.rules as PolicyRules | null);
}

// ------------------------------------------------------------ corrections

export async function listCorrections() {
  const snap = await adminDb().collection("attendanceCorrections").orderBy("at", "desc").limit(300).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      kind: x.kind || "",
      recordId: x.recordId || "",
      userId: x.userId || "",
      employeeName: x.employeeName || "",
      date: x.date || "",
      reason: x.reason || "",
      before: x.before || null,
      after: x.after || null,
      changes: x.changes || [],
      by: { email: x.by?.email || "" },
      at: iso(x.at),
      revertedBy: x.revertedBy || "",
    };
  });
}

// ---------------------------------------------------------------- backups

function validateRange(from: unknown, to: unknown): { from: string; to: string } {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof from !== "string" || typeof to !== "string" || !re.test(from) || !re.test(to) || from > to) {
    throw new ApiError(400, "invalid-range", "A valid date range is required.");
  }
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (days > 400) throw new ApiError(400, "invalid-range", "That date range is too large.");
  return { from, to };
}

async function rawRecords(from: string, to: string) {
  const includesDemo = await isDemoEnvironment();
  const snap = await adminDb().collection("attendance").where("date", ">=", from).where("date", "<=", to).get();
  return snap.docs
    .filter((d) => includesDemo || d.data().isDemo !== true)
    .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
}

export async function liveSnapshot(fromIn: unknown, toIn: unknown) {
  const { from, to } = validateRange(fromIn, toIn);
  const records = await rawRecords(from, to);
  const file = await createBackupFile({ records, range: { from, to }, createdBy: "", projectId: currentProjectId(), backupId: "live" });
  return { records: file.records };
}

export async function createBackup(admin: SuperAdmin, fromIn: unknown, toIn: unknown): Promise<BackupFile> {
  const { from, to } = validateRange(fromIn, toIn);
  const records = await rawRecords(from, to);
  const backupId = `bk_${Date.now()}`;

  const file = await createBackupFile({
    records,
    range: { from, to },
    createdBy: admin.email,
    projectId: currentProjectId(),
    backupId,
  });

  await adminDb().collection("attendanceBackups").add({
    backupId,
    createdAt: Timestamp.fromDate(new Date(file.meta.createdAt)),
    createdAtIso: file.meta.createdAt,
    createdBy: admin.email,
    range: file.meta.range,
    count: file.meta.count,
    sha256: file.meta.sha256,
    verifiedAt: null,
    verifiedBy: null,
    projectId: file.meta.projectId,
  });

  return file;
}

export async function listBackups() {
  const snap = await adminDb().collection("attendanceBackups").orderBy("createdAtIso", "desc").limit(30).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      backupId: x.backupId || "",
      createdAtIso: x.createdAtIso || "",
      createdBy: x.createdBy || "",
      range: x.range,
      count: x.count || 0,
      sha256: x.sha256 || "",
      verifiedAt: x.verifiedAt || null,
      verifiedBy: x.verifiedBy || null,
    };
  });
}

export async function verifyBackup(admin: SuperAdmin, backupId: unknown, sha256: unknown) {
  if (typeof backupId !== "string" || typeof sha256 !== "string") {
    throw new ApiError(400, "bad-request", "Backup id and checksum are required.");
  }
  const snap = await adminDb().collection("attendanceBackups").where("backupId", "==", backupId).limit(1).get();
  if (snap.empty) throw new ApiError(404, "not-found", "No such backup was created here.");
  if (snap.docs[0].data().sha256 !== sha256) {
    throw new ApiError(409, "checksum-mismatch", "The file's checksum does not match the one recorded when the backup was created.");
  }
  await snap.docs[0].ref.update({ verifiedAt: new Date().toISOString(), verifiedBy: admin.email });
  return { ok: true };
}

// A correction to a record in an already-completed month needs a verified,
// fresh backup that covers that date.
export async function assertVerifiedBackupCovers(date: string, now: Date = new Date()) {
  const list = await listBackups();
  const gate = bulkChangeGate(
    list.map(
      (b): BackupMetaRecord => ({
        backupId: b.backupId,
        createdAt: b.createdAtIso,
        verifiedAt: b.verifiedAt,
        range: b.range,
        count: b.count,
        sha256: b.sha256,
      })
    ),
    { from: date, to: date },
    now
  );
  if (!gate.allowed) {
    throw new ApiError(409, "backup-required", `Corrections to a completed month need a verified backup first. ${gate.reason}`);
  }
}
