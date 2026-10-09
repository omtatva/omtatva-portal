// Generate DEMO attendance for August and September 2026 in a SEPARATE
// Firebase TEST project. It never runs against production (omtatva-portal),
// and it refuses any target it cannot positively verify as a demo project.
//
// Targets: August ≈ 80% and September ≈ 70% attendance per demo employee
// (every employee stays below 95%), measured on eligible working days —
// weekly offs, holidays and approved-leave days are excluded.
//
// ONE-TIME SETUP of the test project (marks it as a demo environment):
//   DEMO_FIREBASE_PROJECT_ID=<test-project> npx tsx scripts/generate-demo-attendance.ts \
//     --i-understand-this-is-not-production --init-test-project
//
// PREVIEW (default — prints record counts and expected percentages, writes nothing):
//   DEMO_FIREBASE_PROJECT_ID=<test-project> npx tsx scripts/generate-demo-attendance.ts \
//     --i-understand-this-is-not-production
//
// WRITE (after reading the preview):  add  --apply
// REMOVE all demo data:               add  --remove-demo
//
// Credentials: a service-account key FOR THE TEST PROJECT via
// GOOGLE_APPLICATION_CREDENTIALS (file path) or FIREBASE_SERVICE_ACCOUNT_JSON.
//
// Existing records are never overwritten or duplicated: days that already
// have a record are skipped, and documents are written with create().

import fs from "node:fs";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  DEMO_ID_PREFIX,
  HISTORICAL_TARGETS,
  assertSafeDemoTarget,
  generateDemoAttendance,
  makeDemoEmployees,
  verifyDemoEnvironment,
} from "../lib/demoAttendance";
import type { PolicyRules } from "../lib/attendancePolicy";

const flag = (name: string) => process.argv.includes(`--${name}`);
const FROM = "2026-08-01";
const TO = "2026-09-30";

function credentialProjectId(): string | undefined {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  try {
    if (inline) return JSON.parse(inline).project_id;
    const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (file) return JSON.parse(fs.readFileSync(file, "utf8")).project_id;
  } catch {
    return undefined;
  }
  return undefined;
}

async function main() {
  const projectId = process.env.DEMO_FIREBASE_PROJECT_ID;
  const first = assertSafeDemoTarget(projectId, flag("i-understand-this-is-not-production"));
  if (first) {
    console.error(first);
    process.exit(1);
  }
  const project = projectId as string;
  const credProject = credentialProjectId();

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  initializeApp({ projectId: project, credential: json ? cert(JSON.parse(json)) : applicationDefault() });
  const db = getFirestore();

  const markerRef = db.doc("settings/demoEnvironment");

  if (flag("init-test-project")) {
    const pre = verifyDemoEnvironment({
      requestedProject: project,
      credentialProject: credProject,
      marker: { isDemoEnvironment: true, projectId: project }, // marker is what we are about to create
    });
    if (pre) {
      console.error(pre);
      process.exit(1);
    }
    await markerRef.set({ isDemoEnvironment: true, projectId: project, markedAt: new Date().toISOString() });
    console.log(`Marked "${project}" as a demo/test environment.`);
    return;
  }

  const markerSnap = await markerRef.get();
  const problem = verifyDemoEnvironment({
    requestedProject: project,
    credentialProject: credProject,
    marker: markerSnap.exists ? (markerSnap.data() as { isDemoEnvironment?: boolean; projectId?: string }) : null,
  });
  if (problem) {
    console.error(problem);
    process.exit(1);
  }

  if (flag("remove-demo")) {
    for (const col of ["attendance", "leaveRequests", "users"]) {
      const snap = await db.collection(col).get();
      const demo = snap.docs.filter((d) => d.id.startsWith(DEMO_ID_PREFIX));
      for (const d of demo) await d.ref.delete();
      console.log(`${col}: removed ${demo.length} demo documents`);
    }
    return;
  }

  const rulesSnap = await db.doc("settings/attendanceRules").get();
  const rules = (rulesSnap.exists ? rulesSnap.data() : {}) as PolicyRules;
  const holidays = new Set((await db.collection("holidays").get()).docs.map((d) => String(d.data().date || "")));

  // Days that already have ANY record (real or demo) are left alone.
  const existingSnap = await db.collection("attendance").where("date", ">=", FROM).where("date", "<=", TO).get();
  const existingKeys = new Set(existingSnap.docs.map((d) => `${d.data().userId}|${d.data().date}`));

  const employees = makeDemoEmployees(8, [null, ...(rules.shifts || []).map((s) => s.id)]);
  const batchId = `demo-${new Date().toISOString().slice(0, 10)}`;
  const out = generateDemoAttendance({
    employees,
    rules,
    holidays,
    from: FROM,
    to: TO,
    batchId,
    monthTargets: HISTORICAL_TARGETS,
    existingKeys,
  });

  console.log(`Target project: ${project} (verified demo environment)`);
  console.log(`Range: ${FROM} → ${TO}   Targets: Aug ≈ 80%, Sep ≈ 70%, every employee < 95%`);
  console.log(`Will create: ${out.attendance.length} attendance docs, ${out.leaves.length} approved-leave docs, ${employees.length} demo users`);
  const skipped = out.perEmployeeMonth.reduce((n, m) => n + m.skippedExisting, 0);
  console.log(`Existing records skipped (never overwritten): ${skipped}`);
  console.log("\nExpected attendance (present ÷ eligible working days):");
  for (const e of employees) {
    const parts = out.perEmployeeMonth
      .filter((m) => m.uid === e.uid)
      .map((m) => `${m.month}: ${m.presentDays}/${m.eligibleDays} = ${m.percentage}%`);
    console.log(`  ${e.name.padEnd(14)} ${parts.join("   ")}`);
  }

  if (!flag("apply")) {
    console.log("\nPREVIEW ONLY — nothing was written. Add --apply to write to the TEST project.");
    return;
  }

  const existingUsers = new Set((await db.collection("users").get()).docs.map((d) => d.id));
  const existingLeaves = new Set((await db.collection("leaveRequests").get()).docs.map((d) => d.id));

  const writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [
    ...employees
      .filter((e) => !existingUsers.has(e.uid))
      .map((e) => ({
        ref: db.collection("users").doc(e.uid),
        data: {
          firstName: e.name.split(" ")[0],
          lastName: e.name.split(" ").slice(1).join(" "),
          email: e.email,
          shiftId: e.shiftId || "",
          status: "Active",
          role: "employee",
          isDemo: true,
        } as Record<string, unknown>,
      })),
    ...out.attendance.map((r) => ({ ref: db.collection("attendance").doc(r.id), data: r.data })),
    ...out.leaves.filter((r) => !existingLeaves.has(r.id)).map((r) => ({ ref: db.collection("leaveRequests").doc(r.id), data: r.data })),
  ];

  let batch = db.batch();
  let n = 0;
  for (const w of writes) {
    batch.create(w.ref, w.data); // fails (instead of overwriting) if it already exists
    if (++n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
  console.log(`Wrote ${n} demo documents to ${project}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
