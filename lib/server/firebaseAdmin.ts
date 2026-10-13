// Server-only Firebase Admin access (used by app/api/** route handlers).
//
// Credentials:
//  - On Firebase App Hosting / Cloud Run: Application Default Credentials
//    are provided automatically — nothing to configure.
//  - Locally: set FIREBASE_SERVICE_ACCOUNT_JSON (the whole service-account
//    JSON on one line) in .env.local, or GOOGLE_APPLICATION_CREDENTIALS to a
//    key file path. NEVER commit either; .env.local is gitignored.

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Local development with no credentials at all: Application Default
// Credentials would spend a long time probing the Google metadata server
// (and spray unhandled rejections) before failing, which the browser sees as
// a request timeout. Say what is missing straight away instead. Never applies
// in production / on Cloud Run, where ADC is provided.
function assertCredentialsConfigured() {
  if (
    process.env.NODE_ENV !== "production" &&
    !process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.FIRESTORE_EMULATOR_HOST &&
    !process.env.K_SERVICE
  ) {
    throw new ApiError(
      503,
      "server-not-configured",
      "The attendance server has no Firebase Admin credentials in this environment. Set FIREBASE_SERVICE_ACCOUNT_JSON in .env.local (see .env.local.example) and restart the dev server."
    );
  }
}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "omtatva-portal";
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  return initializeApp({
    projectId,
    credential: json ? cert(JSON.parse(json)) : applicationDefault(),
  });
}

let settingsApplied = false;

export function adminDb() {
  assertCredentialsConfigured();
  const db = getFirestore(adminApp());
  if (!settingsApplied) {
    settingsApplied = true;
    try {
      // A stray `undefined` in a document must never turn into a 500 for the user.
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* already configured / already in use in this process */
    }
  }
  return db;
}

export function adminAuth() {
  return getAuth(adminApp());
}

export type VerifiedUser = { uid: string; email: string; name: string };

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>".
// Identity always comes from the verified token — never from the body.
export async function verifyRequest(req: Request): Promise<VerifiedUser> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new ApiError(401, "unauthenticated", "Please sign in again.");

  try {
    // checkRevoked: a removed/disabled account is refused immediately, not
    // after its ID token expires.
    // Signature/expiry first (needs no credentials), so a fake token is a 401
    // everywhere; the revocation check below does need credentials.
    await getAuth(adminApp()).verifyIdToken(token, false);
    assertCredentialsConfigured();
    const decoded = await getAuth(adminApp()).verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email || "", name: (decoded.name as string) || "" };
  } catch (error) {
    if (error instanceof ApiError) throw error; // e.g. server not configured - not the user's fault
    console.error("ID token verification failed:", (error as Error).message);
    throw new ApiError(401, "invalid-token", "Your session has expired. Please sign in again.");
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("Unhandled attendance API error:", error);
  const message = (error as Error)?.message || "";
  // Missing/insufficient credentials show up as these — tell the operator.
  const credentialIssue = /credential|permission|PERMISSION_DENIED|Could not load the default/i.test(message);
  return Response.json(
    {
      error: {
        code: credentialIssue ? "server-not-configured" : "server-error",
        message: credentialIssue
          ? "The attendance server is not configured with Firebase Admin credentials yet. Contact IT support."
          : "Something went wrong on the server. Please try again.",
      },
    },
    { status: credentialIssue ? 503 : 500 }
  );
}
