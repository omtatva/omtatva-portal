// Run with:  npm run test:attendance
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  IDLE_LIMIT_MS,
  WARN_BEFORE_MS,
  formatRemaining,
  idleState,
  loginPathFor,
  resolveLastActivity,
  shouldRecordActivity,
} from "../lib/idleSession";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    console.error("FAIL", name, "\n  ", (e as Error).message);
    process.exitCode = 1;
  }
};

const MIN = 60 * 1000;
const T0 = Date.parse("2026-10-12T09:00:00Z");

test("the limit is exactly one hour", () => assert.equal(IDLE_LIMIT_MS, 60 * MIN));
test("0-57 minutes idle: still active, no warning", () => {
  for (const m of [0, 1, 30, 57]) assert.equal(idleState(T0 + m * MIN, T0).status, "active", `${m} min`);
});
test("the last 2 minutes show a warning with the time left", () => {
  const s = idleState(T0 + 58 * MIN, T0);
  assert.equal(s.status, "warning");
  assert.equal(s.remainingMs, 2 * MIN);
  assert.equal(idleState(T0 + 59 * MIN + 30000, T0).status, "warning");
  assert.equal(WARN_BEFORE_MS, 2 * MIN);
});
test("BOUNDARY: at exactly 60 minutes the session is expired (59:59 is not)", () => {
  assert.equal(idleState(T0 + 60 * MIN - 1000, T0).status, "warning");
  assert.equal(idleState(T0 + 60 * MIN, T0).status, "expired");
  assert.equal(idleState(T0 + 61 * MIN, T0).status, "expired");
  assert.equal(idleState(T0 + 3 * 60 * MIN, T0).status, "expired", "coming back after 3 hours");
});
test("activity inside the hour resets the clock; activity after an expired hour does NOT revive the session", () => {
  assert.equal(shouldRecordActivity(T0 + 59 * MIN, T0), true);
  assert.equal(shouldRecordActivity(T0 + 60 * MIN, T0), false);
  assert.equal(shouldRecordActivity(T0 + 5 * 60 * MIN, T0), false, "first mouse move after hours away must not extend it");
});
test("coming back after more than an hour: the stored session is expired and a normal restart keeps it expired", () => {
  const stored = T0; // last seen 09:00
  const signedIn = T0 - 20 * MIN; // signed in earlier than that
  const now = T0 + 90 * MIN; // returns 10:30
  const last = resolveLastActivity(stored, signedIn, now);
  assert.equal(last, stored);
  assert.equal(idleState(now, last).status, "expired");
});
test("signing in again after an idle logout starts a fresh hour (no instant logout loop)", () => {
  const stored = T0; // old activity
  const now = T0 + 90 * MIN;
  const signedIn = now - 1000; // fresh login just now
  const last = resolveLastActivity(stored, signedIn, now);
  assert.equal(last, signedIn);
  assert.equal(idleState(now, last).status, "active");
});
test("no stored activity (storage cleared): trust the sign-in time — an old session is expired, a new one is active", () => {
  const now = T0 + 3 * 60 * MIN;
  assert.equal(idleState(now, resolveLastActivity(0, T0, now)).status, "expired");
  assert.equal(idleState(now, resolveLastActivity(0, now - 5 * MIN, now)).status, "active");
  assert.equal(resolveLastActivity(0, NaN, now), now, "unknown sign-in time -> now");
});
test("a whole day, simulated: active use, a lunch break, then an overnight absence", () => {
  let last = resolveLastActivity(0, T0, T0);
  const use = (at: number) => {
    assert.equal(shouldRecordActivity(at, last), true, "session alive");
    last = at;
  };
  use(T0 + 10 * MIN);
  use(T0 + 50 * MIN);
  use(T0 + 105 * MIN); // within an hour of the previous activity
  assert.equal(idleState(T0 + 105 * MIN + 59 * MIN, last).status, "warning");
  assert.equal(idleState(T0 + 105 * MIN + 61 * MIN, last).status, "expired");
  assert.equal(shouldRecordActivity(T0 + 24 * 60 * MIN, last), false);
});
test("employees go back to /login, admins and Settings back to /admin/login", () => {
  for (const p of ["/", "/dashboard", "/attendance", "/leave", "/profile", "/timesheet"]) assert.equal(loginPathFor(p), "/login", p);
  for (const p of ["/admin", "/admin/users", "/admin/attendance-reports", "/settings", "/settings/access"]) assert.equal(loginPathFor(p), "/admin/login", p);
});
test("countdown text", () => {
  assert.equal(formatRemaining(2 * MIN), "2:00");
  assert.equal(formatRemaining(75 * 1000), "1:15");
  assert.equal(formatRemaining(0), "0:00");
});

// ------------------------------------------------------------- wiring
const read = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");

test("the root layout mounts the idle logout for every page", () => {
  const layout = read("../app/layout.tsx").split("\n// //")[0];
  assert.ok(layout.includes('import IdleLogout from "@/components/IdleLogout"') && layout.includes("<IdleLogout />"));
});
test("idle logout: really signs out, tracks real activity in every tab, and checks on return", () => {
  const c = read("../components/IdleLogout.tsx");
  for (const must of ["signOut(auth)", '"mousemove"', '"keydown"', '"touchstart"', "visibilitychange", '"storage"', "setInterval", "shouldRecordActivity(", "idleState("]) {
    assert.ok(c.includes(must), must);
  }
  assert.ok(c.includes("window.location.replace(loginPathFor(window.location.pathname))"));
  assert.ok(c.includes("Stay signed in"));
});
test("signing out is silent: the login pages show NO 'signed out automatically' message", () => {
  for (const f of ["../app/login/page.js", "../app/admin/login/page.js"]) {
    const src = read(f);
    assert.ok(!src.includes("IdleNotice") && !/signed out automatically/i.test(src), f);
  }
  assert.ok(!fs.existsSync(path.join(__dirname, "../components/IdleNotice.tsx")));
  const c = read("../components/IdleLogout.tsx");
  assert.ok(!c.includes("reason=idle") && !c.includes("NOTICE_KEY"));
});

console.log(`\n${passed} passed (idle sign-out)${process.exitCode ? " - with FAILURES" : ""}`);
