"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, getJson, postJson } from "@/lib/reportsClient";

const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");

type Status = {
  period: string; runStatus: string | null; mode: string; from: string | null; setupProblems: string[];
  state: { testSentAt: string | null; testSentBy: string | null; liveApproved: boolean; liveApprovedBy: string | null };
  counts: Record<string, number>;
  deliveries: { id: string; uid: string; employeeId: string; employeeName: string; email: string; status: string; attempts: number; lastError: string | null; retryable: boolean; skipReason: string | null }[];
};
type Preview = {
  periodLabel: string; blockers: string[];
  recipients: { employeeId: string; name: string; email: string }[];
  skipped: { employeeId: string; name: string; reason: string; kind: string }[];
};
type Dns = { domain: string | null; items: { id: string; label: string; status: string; detail: string }[]; note: string };

// What each status honestly means.
const STATUS: Record<string, { label: string; cls: string; hint: string }> = {
  queued: { label: "Queued", cls: "bg-gray-100 text-gray-700", hint: "Waiting to be sent." },
  sending: { label: "Sending", cls: "bg-blue-100 text-blue-700", hint: "A send is in progress." },
  sent: { label: "Accepted by provider", cls: "bg-sky-100 text-sky-800", hint: "The e-mail service accepted it. This is NOT yet confirmation that it reached the inbox." },
  delivered: { label: "Delivered", cls: "bg-green-100 text-green-700", hint: "The recipient's mail server accepted it (reported by the provider). It may still be filtered to spam by the recipient." },
  bounced: { label: "Bounced", cls: "bg-red-100 text-red-700", hint: "The recipient's mail server rejected it. Fix the address, then resend." },
  complained: { label: "Marked as spam", cls: "bg-red-100 text-red-700", hint: "The recipient reported it as spam. Do not resend to this address." },
  failed: { label: "Failed", cls: "bg-orange-100 text-orange-800", hint: "We could not hand it to the e-mail service." },
  skipped: { label: "Not sent", cls: "bg-yellow-100 text-yellow-800", hint: "The address is missing, unverified or not allowed." },
  unknown: { label: "Unknown", cls: "bg-purple-100 text-purple-800", hint: "A send was interrupted: it may or may not have gone out. Verify before resending." },
};

export default function EmailPanel({ period, isSuperAdmin, canEdit }: { period: string; isSuperAdmin: boolean; canEdit: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dns, setDns] = useState<Dns | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [why, setWhy] = useState("");
  const [understand, setUnderstand] = useState(false);
  const [content, setContent] = useState<"link" | "attachment">("link");
  const [liveTyped, setLiveTyped] = useState("");
  const [ackDomain, setAckDomain] = useState(false);
  const [ackRecipients, setAckRecipients] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getJson<Status>(`/api/payroll/email-status?period=${period}`);
      setStatus(s);
      if (canEdit) setPreview(await getJson<Preview>(`/api/payroll/email-preview?period=${period}`));
    } catch (e) {
      setError(msg(e));
    }
  }, [period, canEdit]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (label: string, fn: () => Promise<string>) => {
    setBusy(label); setError(""); setNotice("");
    try { setNotice(await fn()); await load(); } catch (e) { setError(msg(e)); } finally { setBusy(""); }
  };

  if (!status) return <p className="text-sm text-gray-500">{error || "Loading e-mail status…"}</p>;
  const { deliveries, counts } = status;
  const send = () => act("send", async () => {
    let r = await postJson<{ queued: number; sent: number; failed: number; remaining: number; stopped: string | null }>("/api/payroll/email-send", { period, confirm: typed, content });
    let sent = r.sent, failed = r.failed;
    // each call has a time budget; keep going until nothing is left queued
    while (r.remaining > 0 && !r.stopped) {
      r = await postJson("/api/payroll/email-continue", { period });
      sent += r.sent; failed += r.failed;
    }
    setTyped("");
    return `${sent} accepted by the e-mail service, ${failed} failed.${r.stopped ? ` Stopped: ${r.stopped}. Nothing was lost — fix the server setup and press Send again.` : ""} “Accepted” is not “delivered”: delivery and bounces appear in the table as the provider reports them.`;
  });

  const resend = () => act("resend", async () => {
    const r = await postJson<{ queued: number; sent: number; failed: number; notResent: { employeeId: string; outcome: string }[] }>("/api/payroll/email-resend", { period, uids: deliveries.filter((d) => picked.has(d.id)).map((d) => d.uid), reason: why, confirmUnknown: understand });
    setPicked(new Set()); setWhy("");
    return `${r.sent} resent, ${r.failed} failed.${r.notResent.length ? " Not resent: " + r.notResent.map((n) => `${n.employeeId} (${n.outcome})`).join("; ") : ""}`;
  });

  const canSendNow = !!preview && preview.blockers.length === 0 && preview.recipients.length > 0;
  const resendable = deliveries.filter((d) => ["failed", "bounced", "unknown", "skipped"].includes(d.status));

  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="font-semibold">✉ E-mail payslips to employees</h3>
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}
      {notice && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm" role="status">{notice}</div>}

      {/* ---- setup ---- */}
      <div className="rounded-lg border p-3 text-sm space-y-1">
        <div>Server mode: <b>{status.mode}</b> · From: <b>{status.from || "not set"}</b> · Live sending: <b>{status.state.liveApproved ? "ON" : "off"}</b> · Test e-mail: <b>{status.state.testSentAt ? `sent ${status.state.testSentAt.slice(0, 16).replace("T", " ")}` : "not sent yet"}</b></div>
        {status.setupProblems.length > 0 && <ul className="list-disc ml-5 text-amber-800">{status.setupProblems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="px-3 py-1.5 rounded bg-slate-700 text-white" disabled={!!busy} onClick={() => act("dns", async () => { setDns(await getJson<Dns>("/api/payroll/email-dns")); return "DNS checked."; })}>Check sending-domain DNS</button>
          {isSuperAdmin && <button className="px-3 py-1.5 rounded bg-blue-700 text-white" disabled={!!busy} onClick={() => act("test", async () => { const r = await postJson<{ sentTo: string; note: string }>("/api/payroll/email-test", {}); return `Test e-mail accepted for ${r.sentTo}. ${r.note}`; })}>Send test e-mail to me</button>}
        </div>
        {dns && (
          <div className="pt-2 space-y-1">
            {dns.items.map((i) => <div key={i.id} className={i.status === "ok" ? "text-green-700" : i.status === "missing" ? "text-red-700" : "text-amber-700"}>{i.status === "ok" ? "✓" : i.status === "missing" ? "✗" : "?"} <b>{i.label}</b>: {i.detail}</div>)}
            <p className="text-xs text-gray-500">{dns.note}</p>
          </div>
        )}
        {isSuperAdmin && (
          <div className="pt-2 border-t mt-2 space-y-1">
            {status.state.liveApproved ? (
              <button className="px-3 py-1.5 rounded bg-red-700 text-white" disabled={!!busy} onClick={() => act("live", async () => { await postJson("/api/payroll/email-live", { enable: false }); return "Live payslip e-mails switched off."; })}>Switch live sending off</button>
            ) : (
              <>
                <label className="block"><input type="checkbox" checked={ackDomain} onChange={(e) => setAckDomain(e.target.checked)} /> The sending domain is verified with my provider (SPF, DKIM, DMARC) and the test e-mail reached my inbox.</label>
                <label className="block"><input type="checkbox" checked={ackRecipients} onChange={(e) => setAckRecipients(e.target.checked)} /> I have checked that employee addresses are correct.</label>
                <div className="flex flex-wrap gap-2">
                  <input value={liveTyped} onChange={(e) => setLiveTyped(e.target.value)} placeholder="Type ENABLE LIVE PAYSLIP EMAILS" className="border rounded px-2 py-1.5 w-72" />
                  <button className="px-3 py-1.5 rounded bg-green-700 text-white disabled:opacity-40" disabled={!!busy || !ackDomain || !ackRecipients || liveTyped !== "ENABLE LIVE PAYSLIP EMAILS"} onClick={() => act("live", async () => { await postJson("/api/payroll/email-live", { enable: true, domainVerified: ackDomain, recipientsChecked: ackRecipients, confirm: liveTyped }); setLiveTyped(""); return "Live payslip e-mails switched ON."; })}>Switch live sending on</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ---- preview + send ---- */}
      {canEdit && preview && (
        <div className="rounded-lg border p-3 text-sm space-y-2">
          <div><b>{preview.recipients.length}</b> employee(s) will each get their own e-mail {content === "link" ? "telling them their payslip is available" : "with only their own payslip PDF attached"}, for <b>{preview.periodLabel}</b>.</div>
          <label className="block">E-mail contains:{" "}
            <select value={content} onChange={(e) => setContent(e.target.value as "link" | "attachment")} className="border rounded px-2 py-1">
              <option value="link">A notification only — no salary data (recommended)</option>
              <option value="attachment">The payslip PDF attached</option>
            </select>
          </label>
          {preview.blockers.length > 0 && <ul className="list-disc ml-5 text-red-700">{preview.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          {preview.skipped.length > 0 && <details><summary className="cursor-pointer text-amber-800">{preview.skipped.length} will NOT be sent</summary><ul className="list-disc ml-5">{preview.skipped.map((s) => <li key={s.employeeId}>{s.name} ({s.employeeId}): {s.reason}</li>)}</ul></details>}
          {preview.recipients.length > 0 && <details><summary className="cursor-pointer">Recipients</summary><ul className="list-disc ml-5">{preview.recipients.map((r) => <li key={r.employeeId}>{r.name} ({r.employeeId}) → {r.email}</li>)}</ul></details>}
          <div className="flex flex-wrap gap-2 items-center">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type SEND ${preview.recipients.length} PAYSLIPS`} className="border rounded px-2 py-1.5 w-60" />
            <button className="px-4 py-2 rounded-lg bg-blue-700 text-white disabled:opacity-40" disabled={!!busy || !canSendNow || typed !== `SEND ${preview.recipients.length} PAYSLIPS`} onClick={send}>{busy === "send" ? "Sending…" : "Send Payslips by Email"}</button>
          </div>
          <p className="text-xs text-gray-500">Pressing the button twice, or from two tabs, never sends anyone a second copy.</p>
        </div>
      )}

      {/* ---- delivery status ---- */}
      {deliveries.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(counts).map(([k, n]) => <span key={k} className={`px-2 py-1 rounded-full ${STATUS[k]?.cls || "bg-gray-100"}`} title={STATUS[k]?.hint}>{STATUS[k]?.label || k}: {n}</span>)}
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr><th className="p-2"></th><th className="p-2">Employee</th><th className="p-2">Address</th><th className="p-2">Status</th><th className="p-2">Attempts</th><th className="p-2">Detail</th></tr></thead>
            <tbody>{deliveries.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">{canEdit && resendable.some((r) => r.id === d.id) && <input type="checkbox" checked={picked.has(d.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} aria-label={`Select ${d.employeeName}`} />}</td>
                <td className="p-2">{d.employeeName} <span className="text-gray-500">({d.employeeId})</span></td><td className="p-2">{d.email}</td>
                <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS[d.status]?.cls || ""}`} title={STATUS[d.status]?.hint}>{STATUS[d.status]?.label || d.status}</span></td>
                <td className="p-2">{d.attempts}</td><td className="p-2 text-xs text-gray-600">{d.skipReason || d.lastError || STATUS[d.status]?.hint}</td>
              </tr>))}</tbody>
          </table></div>
          {canEdit && picked.size > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <b>Controlled resend ({picked.size})</b>
              <p className="text-xs text-gray-600">Failed e-mails are retried. Bounced or not-sent ones are resent only if the employee&apos;s e-mail address has been corrected and verified.</p>
              <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (required, 10+ characters)" className="border rounded px-2 py-1.5 w-full" />
              {deliveries.some((d) => picked.has(d.id) && d.status === "unknown") && <label className="block text-sm"><input type="checkbox" checked={understand} onChange={(e) => setUnderstand(e.target.checked)} /> I understand an “Unknown” e-mail may already have been delivered, and the employee could get it twice.</label>}
              <button className="px-4 py-2 rounded-lg bg-orange-700 text-white disabled:opacity-40" disabled={!!busy || why.trim().length < 10} onClick={resend}>Resend</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
