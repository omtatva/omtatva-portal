// Restore attendance records from a VERIFIED backup file (rollback tool).
//
//   DRY RUN (default, changes nothing):
//     npx tsx scripts/attendance-restore.ts --file backup.json --project omtatva-portal
//
//   APPLY (only after reviewing the dry run):
//     npx tsx scripts/attendance-restore.ts --file backup.json --project omtatva-portal \
//       --apply --confirm-project omtatva-portal
//
// Credentials: set GOOGLE_APPLICATION_CREDENTIALS to a service-account key
// file, or FIREBASE_SERVICE_ACCOUNT_JSON to the JSON itself.
//
// Safety:
//  * the file's checksum/count are verified first; a damaged file is refused
//  * the project in the file must match --project
//  * before writing, a fresh snapshot of the CURRENT records is saved to
//    backups/pre-restore_<time>.json, so the restore itself can be undone
//  * only records that differ from (or are missing versus) the backup are
//    written; records created after the backup are reported, never deleted

import fs from "node:fs";
import path from "node:path";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  compareWithLive,
  createBackupFile,
  deserializeValue,
  verifyBackupFile,
  type BackupFile,
} from "../lib/attendanceBackup";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const file = arg("file");
  const project = arg("project");
  const apply = flag("apply");

  if (!file || !project) {
    console.error("Usage: --file <backup.json> --project <firebase-project-id> [--apply --confirm-project <id>]");
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(file, "utf8")) as BackupFile;
  const check = await verifyBackupFile(backup);
  if (!check.ok) {
    console.error("Backup file is NOT valid:\n - " + check.problems.join("\n - "));
    process.exit(1);
  }
  if (backup.meta.projectId !== project) {
    console.error(`Backup was taken from project "${backup.meta.projectId}", not "${project}". Refusing.`);
    process.exit(1);
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  initializeApp({ projectId: project, credential: json ? cert(JSON.parse(json)) : applicationDefault() });
  const db = getFirestore();

  const { from, to } = backup.meta.range;
  const liveSnap = await db.collection("attendance").where("date", ">=", from).where("date", "<=", to).get();
  const live = liveSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));

  const cmp = compareWithLive(backup, live);
  console.log(`Backup ${backup.meta.backupId} (${backup.meta.createdAt}) covers ${from} → ${to}, ${backup.meta.count} records.`);
  console.log(`Live now: ${live.length} records in that range.`);
  console.log(`  identical:            ${cmp.identical}`);
  console.log(`  changed since backup: ${cmp.changedSinceBackup.length}  (would be RESTORED)`);
  console.log(`  missing now:          ${cmp.missingNow.length}  (would be RE-CREATED)`);
  console.log(`  newer than backup:    ${cmp.newSinceBackup.length}  (left untouched)`);
  [...cmp.changedSinceBackup, ...cmp.missingNow].slice(0, 25).forEach((id) => console.log("   -", id));

  const toWrite = new Set([...cmp.changedSinceBackup, ...cmp.missingNow]);

  if (!apply) {
    console.log("\nDRY RUN — nothing was written. Re-run with --apply --confirm-project <id> to restore.");
    return;
  }

  if (arg("confirm-project") !== project) {
    console.error(`--apply also needs --confirm-project ${project}`);
    process.exit(1);
  }
  if (toWrite.size === 0) {
    console.log("Nothing to restore.");
    return;
  }

  // Safety snapshot of the current state, so this restore can be undone.
  fs.mkdirSync("backups", { recursive: true });
  const safety = await createBackupFile({
    records: live,
    range: backup.meta.range,
    createdBy: "attendance-restore.ts",
    projectId: project,
    backupId: `pre-restore_${Date.now()}`,
  });
  const safetyPath = path.join("backups", `${safety.meta.backupId}.json`);
  fs.writeFileSync(safetyPath, JSON.stringify(safety));
  console.log(`Saved pre-restore snapshot: ${safetyPath}`);

  const byId = new Map(backup.records.map((r) => [r.id, r]));
  let batch = db.batch();
  let n = 0;
  for (const id of toWrite) {
    const rec = byId.get(id)!;
    batch.set(db.collection("attendance").doc(id), deserializeValue(rec.data) as Record<string, unknown>);
    if (++n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
  console.log(`Restored ${n} records.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
