// Settings -> Security. A single settings/security Firestore doc, checked
// by both login pages before letting a Google sign-in through.

import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { isSuperAdminRole, type RoleValue } from "./roles";

export type SecuritySettings = {
  maintenanceMode: boolean;
  allowedLoginDomain: string;
};

const DEFAULTS: SecuritySettings = {
  maintenanceMode: false,
  allowedLoginDomain: "",
};

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const snap = await getDoc(doc(db, "settings", "security"));
  if (!snap.exists()) return DEFAULTS;
  const data = snap.data();
  return {
    maintenanceMode: !!data.maintenanceMode,
    allowedLoginDomain: (data.allowedLoginDomain || "").trim().toLowerCase(),
  };
}

// Checked after Google sign-in, before the users/{uid} doc is created or
// the person is let into the app. Returns a human-readable reason when
// login should be blocked, or null when it's fine to proceed.
export async function checkLoginAllowed(
  email: string,
  role: RoleValue
): Promise<string | null> {
  const settings = await getSecuritySettings();
  const normalizedEmail = email.trim().toLowerCase();

  if (
    settings.allowedLoginDomain &&
    !normalizedEmail.endsWith(`@${settings.allowedLoginDomain}`)
  ) {
    return `Access Denied!\nOnly @${settings.allowedLoginDomain} accounts can sign in.`;
  }

  if (settings.maintenanceMode && !isSuperAdminRole(role)) {
    return "The portal is currently in maintenance mode.\nOnly Super Admin can sign in right now — try again shortly.";
  }

  return null;
}
