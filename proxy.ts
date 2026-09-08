import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============================================================
// MAINTENANCE MODE — gates the entire portal centrally, before any
// route renders. Runs on the server for every matched request (see
// `config.matcher` below), so it can't be bypassed by navigating
// directly to a URL — unlike a client-side check inside a layout,
// which only runs after the page's JS has already loaded.
//
// Toggle: set MAINTENANCE_MODE=true (or "false"/unset to disable).
// This is a server-only env var — it is NOT prefixed with
// NEXT_PUBLIC_, so its value is never bundled into client JS.
//
// This app's existing auth (Firebase client SDK, see lib/firebase.js)
// has no server-verifiable session — there is no session cookie, no
// firebase-admin, no JWT the server can check. Per the "don't
// introduce a new auth system" instruction, admin bypass is instead a
// single secret token (MAINTENANCE_BYPASS_TOKEN) rather than a
// (currently impossible to verify server-side) "is this Firebase user
// an admin" check. Visiting /any-page?bypass=<token> once sets an
// HttpOnly cookie that every subsequent request is re-verified
// against — never trusted from the client alone.
// ============================================================

const BYPASS_COOKIE = "omtatva_maintenance_bypass";
const BYPASS_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export function proxy(request: NextRequest) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  if (!isMaintenanceMode) {
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;

  // Let the maintenance page's own request through untouched — matcher
  // below already excludes static assets, but not this page itself,
  // and without this check every render of it would recursively rewrite
  // to itself.
  if (pathname === "/maintenance") {
    return NextResponse.next();
  }

  const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;
  const suppliedToken = searchParams.get("bypass");
  const cookieToken = request.cookies.get(BYPASS_COOKIE)?.value;

  const hasValidBypass =
    !!bypassToken && (suppliedToken === bypassToken || cookieToken === bypassToken);

  if (hasValidBypass) {
    const response = NextResponse.next();
    // Only (re)set the cookie when the token just arrived via the URL —
    // no need to rewrite it on every request once it's already set.
    if (suppliedToken === bypassToken) {
      response.cookies.set(BYPASS_COOKIE, bypassToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: BYPASS_MAX_AGE_SECONDS,
        path: "/",
      });
    }
    return response;
  }

  // Rewrite (not redirect): the browser's URL bar and any bookmarks stay
  // exactly as the user typed them, there's no visible redirect, and —
  // critically — the real page's component code (and the Firebase calls
  // it would make on mount) never loads, since the server responds with
  // the maintenance page's output instead.
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Run on every route except:
     * - _next/static, _next/image (build output, image optimizer)
     * - favicon.ico, logo.ico, profile.png (top-level public assets
     *   referenced directly, e.g. by the maintenance page itself)
     * - robots.txt, sitemap.xml
     * This app has no app/api/* routes — all data access goes straight
     * from the browser to Firebase, not through this Next.js server —
     * so there is no separate "/api" segment to special-case here.
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.ico|profile.png|robots.txt|sitemap.xml).*)",
  ],
};
