import { ApiError, errorResponse, verifyRequest } from "@/lib/server/firebaseAdmin";
import { performanceOverview, reviewRating, submitRating } from "@/lib/server/performanceServer";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

// Who may rate whom, and who may approve, is decided inside each function from
// the verified token + adminAccess role + the reporting structure.
export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await params;
    const user = await verifyRequest(req);
    if (action === "overview") {
      return Response.json(await performanceOverview(user, new URL(req.url).searchParams.get("period")), { headers: NO_STORE });
    }
    throw new ApiError(404, "not-found", "Unknown action.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await params;
    const user = await verifyRequest(req);
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "bad-request", "Invalid request.");
    }
    if (action === "rate") return Response.json(await submitRating(user, body), { headers: NO_STORE });
    if (action === "review") return Response.json(await reviewRating(user, body), { headers: NO_STORE });
    throw new ApiError(404, "not-found", "Unknown action.");
  } catch (error) {
    return errorResponse(error);
  }
}
