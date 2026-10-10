// The employee-visible payslip list ("payslipIndex/{uid}"): a small document the
// SERVER writes and only its owner can read (Firestore rules), so the dashboard
// widget can update in real time without opening up the payslips collection.
// It is always rebuilt from the payslips themselves, for one employee at a time.

import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { buildIndex, type SlipLite } from "../payroll/publish";
import { adminDb } from "./firebaseAdmin";

const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

export const toSlip = (id: string, d: DocumentData): SlipLite => ({
  id,
  uid: String(d.uid),
  period: String(d.period),
  revision: Number(d.revision),
  status: String(d.status),
  published: d.published === true,
  netPay: Number(d.netPay),
  gross: Number(d.gross),
  employeeId: String(d.employeeId),
  employeeName: String(d.employeeName),
  publishedAtIso: iso(d.publishedAt),
});

export async function rebuildPayslipIndex(uid: string): Promise<number> {
  const db = adminDb();
  const snap = await db.collection("payslips").where("uid", "==", uid).get();
  const items = buildIndex(snap.docs.map((d) => toSlip(d.id, d.data())));
  await db.doc(`payslipIndex/${uid}`).set({ uid, items, updatedAt: Timestamp.now() });
  return items.length;
}
