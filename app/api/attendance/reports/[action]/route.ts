import { ApiError, errorResponse, verifyRequest } from "@/lib/server/firebaseAdmin";
import { initializeHistoricalDemo, previewHistorical } from "@/lib/server/historicalServer";
import { applyBulkCorrections } from "@/lib/server/bulkCorrectionServer";
import {
  buildExport,
  createBackup,
  listBackups,
  listCorrections,
  liveSnapshot,
  loadDataset,
  requireSuperAdmin,
  verifyBackup,
} from "@/lib/server/reportsServer";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Every action below is Super Admin only. The check runs FIRST, on the
// server, from the verified ID token — nothing the browser sends can
// substitute for it.
export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await params;
    const user = await verifyRequest(req);
    const admin = await requireSuperAdmin(user);
    const url = new URL(req.url);

    switch (action) {
      case "dataset":
        return Response.json(await loadDataset(), { headers: NO_STORE });

      case "corrections":
        return Response.json({ corrections: await listCorrections() }, { headers: NO_STORE });

      // Read-only preview of historical attendance (and, in a verified demo
      // project only, of what would be generated).
      case "historical-preview":
        return Response.json(await previewHistorical(), { headers: NO_STORE });

      case "backups":
        return Response.json({ backups: await listBackups() }, { headers: NO_STORE });

      case "live-snapshot":
        return Response.json(await liveSnapshot(url.searchParams.get("from"), url.searchParams.get("to")), { headers: NO_STORE });

      case "export": {
        const out = await buildExport(admin, url.searchParams.get("month") || "", url.searchParams.get("employee") || "all");
        return new Response(out.csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${out.filename}"`,
            "X-Content-Type-Options": "nosniff",
            "X-Row-Count": String(out.rowCount),
            ...NO_STORE,
          },
        });
      }

      default:
        throw new ApiError(404, "not-found", "Unknown report action.");
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await params;
    const user = await verifyRequest(req);
    const admin = await requireSuperAdmin(user);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "bad-request", "Invalid request.");
    }

    switch (action) {
      case "backup-create": {
        const file = await createBackup(admin, body.from, body.to);
        return new Response(JSON.stringify(file), {
          headers: { "Content-Type": "application/json", ...NO_STORE },
        });
      }
      // Demo/test projects only — the server refuses production.
      case "historical-initialize":
        return Response.json(await initializeHistoricalDemo(admin, body), { headers: NO_STORE });
      // Many records at once — each still corrected and audited individually.
      case "bulk-correct":
        return Response.json(await applyBulkCorrections(admin, body as never), { headers: NO_STORE });
      case "backup-verify":
        return Response.json(await verifyBackup(admin, body.backupId, body.sha256), { headers: NO_STORE });
      default:
        throw new ApiError(404, "not-found", "Unknown report action.");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
