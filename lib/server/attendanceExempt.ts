// Who is exempt from marking attendance — decided on the SERVER from the role in
// adminAccess (Settings → Access Management) and the configured exempt roles.

import { isAttendanceExempt } from "../attendanceExempt";
import { adminDb } from "./firebaseAdmin";

// uid -> true for every person whose role is exempt (never includes someone with no adminAccess role).
export async function exemptUids(): Promise<Set<string>> {
  const db = adminDb();
  const [rulesSnap, accessSnap, usersSnap] = await Promise.all([
    db.doc("settings/attendanceRules").get(),
    db.collection("adminAccess").get(),
    db.collection("users").get(),
  ]);
  const rules = rulesSnap.exists ? rulesSnap.data() : null;
  const roleByEmail = new Map(accessSnap.docs.map((d) => [d.id.toLowerCase(), String(d.data().role || "")]));
  const out = new Set<string>();
  for (const u of usersSnap.docs) {
    const email = String(u.data().email || "").trim().toLowerCase();
    const role = roleByEmail.get(email);
    if (role && isAttendanceExempt(role, rules)) out.add(u.id);
  }
  return out;
}

export async function isExemptEmail(email: string): Promise<boolean> {
  const db = adminDb();
  const [rulesSnap, accessSnap] = await Promise.all([db.doc("settings/attendanceRules").get(), db.doc(`adminAccess/${email.trim().toLowerCase()}`).get()]);
  if (!accessSnap.exists) return false;
  return isAttendanceExempt(String(accessSnap.data()?.role || ""), rulesSnap.exists ? rulesSnap.data() : null);
}
