// Writes for the reportingStructure collection (one doc per employee,
// doc id = employee UID, field managerId = manager UID, "" = no manager).
// Only admin-tier users may write here — enforced by Firestore rules, the
// UI merely mirrors that.

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { REPORTING_COLLECTION } from "./orgHierarchy";
import { logActivity } from "./activityLog";

const MAX_HOPS = 200;

export class AssignmentError extends Error {}

// Sets (or clears, with managerUid = "") one employee's reporting manager.
//
// The loop check runs inside a Firestore transaction against the stored
// data — not just the locally cached chart — so two admins saving at the
// same moment still cannot create "A reports to B, B reports to A".
export async function assignManager(
  employeeUid: string,
  managerUid: string,
  names?: { employee?: string; employeeEmail?: string; manager?: string }
): Promise<void> {
  if (!employeeUid) throw new AssignmentError("No employee selected.");
  if (managerUid && managerUid === employeeUid) {
    throw new AssignmentError("An employee cannot be their own reporting manager.");
  }

  const actor = auth.currentUser;
  if (!actor) throw new AssignmentError("You are signed out. Please sign in again.");

  await runTransaction(db, async (tx) => {
    if (managerUid) {
      let cursor = managerUid;
      const seen = new Set<string>();

      for (let hops = 0; hops < MAX_HOPS && cursor && !seen.has(cursor); hops++) {
        if (cursor === employeeUid) {
          throw new AssignmentError(
            "That would create a circular reporting loop (the chosen manager already reports to this employee)."
          );
        }
        seen.add(cursor);
        const snap = await tx.get(doc(db, REPORTING_COLLECTION, cursor));
        const next = snap.exists() ? snap.data().managerId : "";
        cursor = typeof next === "string" ? next : "";
      }
    }

    tx.set(
      doc(db, REPORTING_COLLECTION, employeeUid),
      {
        employeeUid,
        managerId: managerUid || "",
        updatedAt: serverTimestamp(),
        updatedBy: actor.email || "",
        updatedByUid: actor.uid,
      },
      { merge: true }
    );
  });

  // Audit trail is best-effort: a logging failure must not make a
  // successful assignment look failed.
  try {
    await logActivity({
      employeeName: names?.employee || "",
      employeeEmail: names?.employeeEmail || "",
      uid: employeeUid,
      activity: managerUid ? "Reporting Manager Assigned" : "Reporting Manager Removed",
      module: "Users",
      description: managerUid
        ? `Now reports to ${names?.manager || managerUid}`
        : "Reporting manager cleared",
    });
  } catch (error) {
    console.warn("Activity log for reporting change failed:", error);
  }
}
