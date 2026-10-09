"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  ACTIVITY_KEY,
  formatRemaining,
  idleState,
  loginPathFor,
  resolveLastActivity,
  shouldRecordActivity,
} from "@/lib/idleSession";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click", "wheel"] as const;
const WRITE_EVERY_MS = 5000;
const CHECK_EVERY_MS = 15000;

function readLast(): number {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeLast(t: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(t));
  } catch {
    /* private mode / storage blocked: the in-memory timer below still works */
  }
}

// Mounted once in the root layout. While someone is signed in it watches for
// inactivity; after 1 hour without any activity (in any tab) it signs them out
// and sends them to the login page, with a message. Coming back later to an
// expired session also signs out immediately.
export default function IdleLogout() {
  const [user, setUser] = useState<User | null>(null);
  const [warnMs, setWarnMs] = useState<number | null>(null);
  const lastRef = useRef(0);
  const lastWrite = useRef(0);
  const expiring = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const expire = useCallback(async () => {
    if (expiring.current) return;
    expiring.current = true;
    try {
      localStorage.removeItem(ACTIVITY_KEY);
    } catch {
      /* ignore */
    }
    try {
      await signOut(auth);
    } finally {
      window.location.replace(loginPathFor(window.location.pathname));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      lastRef.current = 0;
      expiring.current = false;
      return;
    }

    const signedInAt = Date.parse(user.metadata.lastSignInTime || "");
    const now = Date.now();
    const stored = readLast();
    const resolved = resolveLastActivity(stored, signedInAt, now);

    // Fresh login (sign-in newer than stored activity): start the clock now.
    const fresh = !stored || signedInAt > stored;
    lastRef.current = fresh && idleState(now, resolved).status !== "expired" ? now : resolved;
    if (fresh && lastRef.current === now) {
      writeLast(now);
    }

    const check = () => {
      // another tab may have been active more recently
      lastRef.current = Math.max(lastRef.current, readLast());
      const s = idleState(Date.now(), lastRef.current);
      if (s.status === "expired") {
        void expire();
      } else {
        setWarnMs(s.status === "warning" ? s.remainingMs : null);
      }
    };

    const onActivity = () => {
      const t = Date.now();
      lastRef.current = Math.max(lastRef.current, readLast());
      if (!shouldRecordActivity(t, lastRef.current)) {
        void expire();
        return;
      }
      lastRef.current = t;
      if (t - lastWrite.current > WRITE_EVERY_MS) {
        lastWrite.current = t;
        writeLast(t);
      }
      setWarnMs((w) => (w === null ? w : null));
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_KEY) check();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    // while the warning is showing, tick every second for the countdown
    const tick = setInterval(() => {
      const s = idleState(Date.now(), Math.max(lastRef.current, readLast()));
      if (s.status === "warning") setWarnMs(s.remainingMs);
      else if (s.status === "expired") void expire();
    }, 1000);

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener("focus", check);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      clearInterval(tick);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, expire]);

  if (!user || warnMs === null) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Session about to expire"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 5000,
        maxWidth: "calc(100vw - 32px)",
        background: "#0f172a",
        color: "#fff",
        padding: "14px 18px",
        borderRadius: 14,
        boxShadow: "0 16px 40px rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <span>
        You will be signed out in <b>{formatRemaining(warnMs)}</b> because you have been inactive.
      </span>
      <button
        onClick={() => {
          const t = Date.now();
          lastRef.current = t;
          writeLast(t);
          setWarnMs(null);
        }}
        style={{ background: "#3d6fa8", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}
      >
        Stay signed in
      </button>
    </div>
  );
}
