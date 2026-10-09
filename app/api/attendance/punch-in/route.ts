import { errorResponse, verifyRequest, ApiError } from "@/lib/server/firebaseAdmin";
import { serverPunchIn } from "@/lib/server/attendanceServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await verifyRequest(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "bad-request", "Invalid request.");
    }

    const result = await serverPunchIn(user, body);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
