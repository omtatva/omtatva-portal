// Single source of truth for "who is allowed admin/HR/etc access, by
// email". Settings -> Access Management reads/writes this. Login flows
// consult it to decide what role a new users/{uid} doc should get. If a
// users/{uid} doc already exists for that email, we patch its role too, so
// a change here takes effect immediately via Sidebar's live listener
// without requiring the person to log out and back in.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeRole, type RoleValue } from "./roles";

export type AdminAccessEntry = {
  email: string;
  role: RoleValue;
  addedAt?: unknown;
  updatedAt?: unknown;
};

const COLLECTION = "adminAccess";

// One-time bootstrap only: the accounts that had hardcoded admin access
// before this migration. Consulted ONLY when an email has no adminAccess
// doc yet — on a match, the doc is created immediately so this list is
// never consulted again for that email. This exists purely so shipping
// this change doesn't lock everyone out before anyone can open Settings
// to grant access properly; manage real access from Settings -> Access
// Management from here on, not by editing this list.
const BOOTSTRAP_ADMINS: Record<string, RoleValue> = {
  "admin@omtatvadigitals.com": "admin",
  "hr@omtatvadigitals.com": "hr",
  "itsupport@omtatvadigitals.com": "super_admin",
  "sudhanshu@omtatvadigitals.com": "head",
};

function docIdForEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function listAdminAccess(): Promise<AdminAccessEntry[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((d) => ({ ...(d.data() as AdminAccessEntry), email: d.id }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

// Finds any existing users/{uid} doc for this email and updates its role
// field so the change is picked up live — returns true if one was found.
async function syncExistingUserRole(email: string, role: RoleValue) {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return false;

  await Promise.all(
    snap.docs.map((d) => setDoc(doc(db, "users", d.id), { role }, { merge: true }))
  );
  return true;
}

export async function upsertAdminAccess(email: string, role: string) {
  const normalizedEmail = docIdForEmail(email);
  const normalizedRole = normalizeRole(role);
  const ref = doc(db, COLLECTION, normalizedEmail);
  const existing = await getDoc(ref);

  await setDoc(
    ref,
    {
      email: normalizedEmail,
      role: normalizedRole,
      addedAt: existing.exists() ? existing.data()?.addedAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await syncExistingUserRole(normalizedEmail, normalizedRole);
}

export async function removeAdminAccess(email: string) {
  const normalizedEmail = docIdForEmail(email);
  await deleteDoc(doc(db, COLLECTION, normalizedEmail));
  // Revoke immediately for anyone already signed in, rather than leaving
  // their old elevated role live until some other write touches it.
  await syncExistingUserRole(normalizedEmail, "employee");
}

// Used by login flows to decide the role for a brand-new users/{uid} doc.
export async function lookupRoleForEmail(email: string): Promise<RoleValue> {
  const normalizedEmail = docIdForEmail(email);
  const ref = doc(db, COLLECTION, normalizedEmail);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return normalizeRole(snap.data()?.role);
  }

  const bootstrapRole = BOOTSTRAP_ADMINS[normalizedEmail];
  if (bootstrapRole) {
    await setDoc(ref, {
      email: normalizedEmail,
      role: bootstrapRole,
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return bootstrapRole;
  }

  return "employee";
}
