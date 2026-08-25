"use client";

// Shared client hook for "who is signed in and what tier are they" —
// previously this exact onAuthStateChanged + role read was duplicated
// (with drifting role-list copies) across Sidebar.tsx, app/admin/page.js,
// app/admin/login/page.js, app/settings/page.tsx and
// app/profile/components/BankDetails.tsx.
//
// Admin-tier access is decided ONLY by membership in the adminAccess
// collection (Settings -> Access Management), keyed by email — not by the
// "role" label stored on users/{uid}. That label is a free-text
// title/designation HR sets from Admin -> Users (e.g. "Head") for display
// purposes; it must NOT by itself grant real dashboard access, or editing
// someone's title would silently make them an admin.

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { isAdminTierRole, isSuperAdminRole, normalizeRole, type RoleValue } from "./roles";

export type AccessState = {
  authUser: User | null;
  authReady: boolean;
  role: RoleValue;
  roleReady: boolean;
  isAdminTier: boolean;
  isSuperAdmin: boolean;
};

export function useAccess(): AccessState {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [rawRole, setRawRole] = useState<string>("");
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const email = authUser?.email?.trim().toLowerCase();

    if (!email) {
      setRawRole("");
      setRoleReady(authReady);
      return;
    }

    setRoleReady(false);
    const accessRef = doc(db, "adminAccess", email);
    const unsubscribeRole = onSnapshot(
      accessRef,
      (snap) => {
        setRawRole(snap.exists() ? snap.data()?.role || "" : "");
        setRoleReady(true);
      },
      (error) => {
        console.error("useAccess role fetch error:", error);
        setRoleReady(true);
      }
    );
    return () => unsubscribeRole();
  }, [authUser, authReady]);

  const role = normalizeRole(rawRole);

  return {
    authUser,
    authReady,
    role,
    roleReady,
    isAdminTier: isAdminTierRole(role),
    isSuperAdmin: isSuperAdminRole(role),
  };
}
