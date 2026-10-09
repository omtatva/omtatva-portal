import { ApiError, errorResponse, verifyRequest } from "@/lib/server/firebaseAdmin";
import { removeRejectedEmployee } from "@/lib/server/employeeRemovalServer";

export const dynamic = "force-dynamic";

// Administrators only (checked inside): remove a REJECTED employee, disable
// their login and delete their access-list entry.
export async function POST(req: Request) {
  try {
    const user = await verifyRequest(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "bad-request", "Invalid request.");
    }

    return Response.json(await removeRejectedEmployee(user, body), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
