import { loadEmailConfig, webhookAuthorized } from "@/lib/payroll/emailProvider";
import { processWebhook } from "@/lib/server/payslipEmail";

export const dynamic = "force-dynamic";

// Delivery / bounce / spam-complaint events from the e-mail provider. There is
// no signed-in user here, so the request is accepted ONLY with the shared
// webhook credentials (HTTP Basic, set in the provider's webhook URL and in the
// POSTMARK_WEBHOOK_USER / POSTMARK_WEBHOOK_PASS secrets). The body is only ever
// used to update the status of a delivery we created ourselves.
export async function POST(req: Request) {
  const cfg = loadEmailConfig();
  if (!webhookAuthorized(req.headers.get("authorization"), cfg)) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="webhook"' } });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  try {
    await processWebhook(body);
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("E-mail webhook failed:", (error as Error).message);
    return new Response("error", { status: 500 }); // the provider will retry
  }
}
