import { ApiError, errorResponse, verifyRequest } from "@/lib/server/firebaseAdmin";
import {
  applySalarySheet, approveRun, deleteSalary, generatePayslips, getPolicy, listPeriodPayslips, listRuns, myPayslips,
  payslipPdf, previewRun, previewSalarySheet, resolveMissing, reverseRun, saveDecisions, savePolicy, saveSalary, salaryHistory,
} from "@/lib/server/payrollActions";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

// Every action checks the caller's role on the server (from the verified ID
// token + adminAccess + the Module Permissions matrix) inside its own
// function; nothing the browser sends can substitute for that.
export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await params;
    const user = await verifyRequest(req);
    const url = new URL(req.url);

    switch (action) {
      case "policy":
        return Response.json(await getPolicy(user), { headers: NO_STORE });
      case "runs":
        return Response.json(await listRuns(user), { headers: NO_STORE });
      case "preview":
        return Response.json(await previewRun(user, url.searchParams.get("period")), { headers: NO_STORE });
      case "payslips":
        return Response.json(await listPeriodPayslips(user, url.searchParams.get("period")), { headers: NO_STORE });
      case "my-payslips":
        return Response.json(await myPayslips(user), { headers: NO_STORE });
      case "salary-history":
        return Response.json(await salaryHistory(user, url.searchParams.get("employeeId")), { headers: NO_STORE });
      case "payslip-pdf": {
        const { bytes, filename } = await payslipPdf(user, url.searchParams.get("id"));
        return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${filename}"`,
            "X-Content-Type-Options": "nosniff",
            ...NO_STORE,
          },
        });
      }
      default:
        throw new ApiError(404, "not-found", "Unknown payroll action.");
    }
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

    switch (action) {
      case "policy-save":
        return Response.json(await savePolicy(user, body), { headers: NO_STORE });
      case "decisions":
        return Response.json(await saveDecisions(user, body), { headers: NO_STORE });
      case "resolve-missing":
        return Response.json(await resolveMissing(user, body), { headers: NO_STORE });
      case "approve":
        return Response.json(await approveRun(user, body), { headers: NO_STORE });
      case "generate-payslips":
        return Response.json(await generatePayslips(user, body), { headers: NO_STORE });
      case "reverse":
        return Response.json(await reverseRun(user, body), { headers: NO_STORE });
      case "salary-preview":
        return Response.json(await previewSalarySheet(user, body), { headers: NO_STORE });
      case "salary-apply":
        return Response.json(await applySalarySheet(user, body), { headers: NO_STORE });
      case "salary-save":
        return Response.json(await saveSalary(user, body), { headers: NO_STORE });
      case "salary-delete":
        return Response.json(await deleteSalary(user, body), { headers: NO_STORE });
      default:
        throw new ApiError(404, "not-found", "Unknown payroll action.");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
