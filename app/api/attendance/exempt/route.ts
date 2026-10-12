import { errorResponse, verifyRequest } from "@/lib/server/firebaseAdmin";
import { exemptUids, isExemptEmail } from "@/lib/server/attendanceExempt";
import { normalizeRole, isAdminTierRole } from "@/lib/roles";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/attendance/exempt
//   everyone: { me: boolean }  — am I exempt from marking attendance?
//   admin tier also gets { uids: string[] } — who is exempt (to hide them from attendance lists).
export async function GET(req: Request) {
  try {
    const user = await verifyRequest(req);
    const me = await isExemptEmail(user.email);
    const access = await adminDb().doc(`adminAccess/${user.email.trim().toLowerCase()}`).get();
    const role = normalizeRole(access.exists ? String(access.data()?.role || "") : "");
    const body: { me: boolean; uids?: string[] } = { me };
    if (isAdminTierRole(role)) body.uids = [...(await exemptUids())];
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
