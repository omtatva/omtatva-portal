// Automatic sign-out after inactivity — pure rules (unit-tested). The browser
// part is components/IdleLogout.tsx.
//
// "Activity" = the person using the portal (mouse, keys, touch, scroll) in
// ANY open tab. The last-activity time lives in localStorage so it survives a
// closed laptop / closed browser: when they come back after more than the
// limit, they are signed out BEFORE anything else happens and must log in again.

export const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
export const WARN_BEFORE_MS = 2 * 60 * 1000; // "you will be signed out" notice
export const ACTIVITY_KEY = "omtatva:lastActivity";

export type IdleStatus = "active" | "warning" | "expired";

export function idleState(
  now: number,
  lastActivity: number,
  limit = IDLE_LIMIT_MS,
  warnBefore = WARN_BEFORE_MS
): { status: IdleStatus; remainingMs: number } {
  const remainingMs = limit - (now - lastActivity);
  if (remainingMs <= 0) return { status: "expired", remainingMs: 0 };
  if (remainingMs <= warnBefore) return { status: "warning", remainingMs };
  return { status: "active", remainingMs };
}

// What counts as the last activity when a page starts or the user changes?
//  - nothing stored (storage cleared / first ever visit) -> trust the sign-in time
//  - the sign-in is NEWER than the stored activity -> a fresh login: the old
//    "idle" time must not log them straight out again
//  - otherwise keep the stored value
export function resolveLastActivity(stored: number, signedInAt: number, now: number): number {
  const signedIn = Number.isFinite(signedInAt) && signedInAt > 0 ? signedInAt : now;
  if (!stored || signedIn > stored) return signedIn;
  return stored;
}

// Activity is only recorded while the session is still alive. Without this,
// the first mouse movement after hours away would silently "refresh" an
// already-expired session.
export function shouldRecordActivity(now: number, lastActivity: number, limit = IDLE_LIMIT_MS): boolean {
  return now - lastActivity < limit;
}

// Where to send someone after an idle sign-out.
export function loginPathFor(pathname: string): string {
  return pathname.startsWith("/admin") || pathname.startsWith("/settings") ? "/admin/login" : "/login";
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
