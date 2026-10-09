import { adminDb, errorResponse } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

// Deployment check: open /api/attendance/health after deploying. "ok: true"
// means the server can read Firestore with its Admin credentials (needed for
// punch-in/out). Exposes no data.
export async function GET() {
  try {
    const snap = await adminDb().doc("settings/attendanceRules").get();
    return Response.json({ ok: true, rulesConfigured: snap.exists });
  } catch (error) {
    return errorResponse(error);
  }
}
