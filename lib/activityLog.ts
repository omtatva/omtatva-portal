// Shared writer for the "activityLogs" collection that Admin Dashboard's
// Recent Activity table reads (app/admin/page.js). Previously each admin
// page wrote to this collection ad-hoc, with copy-pasted shapes that had
// drifted (e.g. app/admin/leave/page.js was writing the WFH log entry
// twice, and none of them recorded the employee's email or who actually
// made the change).

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export type ActivityLogInput = {
  // Who/what the activity is about.
  employeeName?: string;
  employeeEmail?: string;
  uid?: string;
  // Short label shown in the Activity column, e.g. "Leave Approved".
  activity: string;
  // Grouping/category, e.g. "Leave", "WFH", "Attendance", "Users".
  module?: string;
  description?: string;
};

export async function logActivity(input: ActivityLogInput) {
  const actor = auth.currentUser;

  await addDoc(collection(db, "activityLogs"), {
    employeeName: input.employeeName || "",
    employeeEmail: input.employeeEmail || "",
    uid: input.uid || "",
    activity: input.activity,
    module: input.module || "",
    type: input.module || "",
    description: input.description || "",
    // Who actually performed the action — the signed-in HR/admin for
    // admin-side actions, or the employee themselves for self-service
    // actions like applying for leave.
    updatedBy: actor?.email || "",
    updatedByUid: actor?.uid || "",
    createdAt: serverTimestamp(),
  });
}
