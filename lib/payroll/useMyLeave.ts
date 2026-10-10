"use client";

// The signed-in employee's leave position, from the server (same ledger and
// same leave records payroll uses). Pass a changing `refreshKey` to reload.

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { getJson } from "../reportsClient";
import type { MyLeaveResponse } from "./apiTypes";

export function useMyLeave(refreshKey: string | number = 0) {
  const [data, setData] = useState<MyLeaveResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      getJson<MyLeaveResponse>("/api/payroll/my-leave")
        .then((r) => { if (alive) { setData(r); setError(""); } })
        .catch((e: Error) => { if (alive) setError(e.message || "Could not load your leave balance."); });
    });
    return () => { alive = false; off(); };
  }, [refreshKey]);

  return { data, error };
}
