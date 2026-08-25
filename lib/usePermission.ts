"use client";

// Client hook for "can the signed-in admin-tier user edit this module".
// Combines useAccess() (who is it, what role) with the live
// settings/permissions matrix. Use this to disable/hide the
// save/approve/reject/delete/upload actions on an admin page — never to
// hide the whole page (that's still useAccess().isAdminTier's job); HR
// should still be able to VIEW every admin page, just not change things
// outside Employee Management / Documents by default.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useAccess } from "./useAccess";
import {
  defaultMatrix,
  resolveCanEdit,
  type ModuleKey,
  type PermissionMatrix,
} from "./permissions";

export function usePermission(moduleKey: ModuleKey) {
  const { role, roleReady } = useAccess();
  const [matrix, setMatrix] = useState<PermissionMatrix>(defaultMatrix());
  const [matrixReady, setMatrixReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "permissions"),
      (snap) => {
        const saved = snap.exists() ? (snap.data().matrix as PermissionMatrix) : {};
        const merged = defaultMatrix();
        for (const r of Object.keys(saved || {})) {
          merged[r] = { ...merged[r], ...saved[r] };
        }
        setMatrix(merged);
        setMatrixReady(true);
      },
      (error) => {
        console.error("PERMISSIONS SNAPSHOT ERROR:", error);
        setMatrixReady(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const ready = roleReady && matrixReady;
  // Defaults to true (edit) while still loading, so buttons don't
  // flash disabled-then-enabled for the common case (roles that can
  // edit everything) — only actually restrict once we know for sure.
  const canEdit = ready ? resolveCanEdit(matrix, role, moduleKey) : true;

  return { canEdit, ready };
}
