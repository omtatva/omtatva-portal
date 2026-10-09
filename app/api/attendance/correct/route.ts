import { ApiError, errorResponse, verifyRequest } from "@/lib/server/firebaseAdmin";
import { applyCorrection, requireAttendanceAdmin } from "@/lib/server/correctionServer";

export const dynamic = "force-dynamic";

// Administrator-only: correct, create or revert an attendance record.
export async function POST(req: Request) {
  try {
    const user = await verifyRequest(req);
    const admin = await requireAttendanceAdmin(user);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "bad-request", "Invalid request.");
    }

    const result = await applyCorrection(admin, body as never);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
