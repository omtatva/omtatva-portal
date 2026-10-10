# Payslip e-mail — what you still have to set up

The code is finished and tested with fake providers only. **Nothing has been sent, and nothing can be sent**
until you do the steps below: the app ships with `PAYSLIP_EMAIL_MODE=off`, and even in `live` mode a Super
Admin must send a test e-mail and switch live sending on inside the app.

Provider supported by the code: **Postmark** (transactional-only service, delivery + bounce webhooks,
per-message status). The sending code sits behind a small interface (`lib/payroll/emailProvider.ts`), so another
provider can be added later without touching the payroll flow.

## 1. Create the provider account  (you)

1. Sign up at postmarkapp.com, create a **Server**, keep its **Message Stream = Transactional ("outbound")**.
2. New accounts start in test mode: ask Postmark to approve the account before sending to real employees.
3. Copy the **Server API token** (you will store it as a secret in step 3 — never in code, chat or GitHub).

## 2. Authenticate the sending domain  (you, in your DNS host)

Use a sending address on your own domain, e.g. `payroll@omtatvadigitals.com`. In Postmark: *Sender Signatures →
Domains → Add domain*, then add the DNS records it shows:

| Record | Where | Value | Why |
|---|---|---|---|
| **DKIM** | TXT `<selector>._domainkey.omtatvadigitals.com` | the long `k=rsa; p=…` value Postmark gives you | proves the message was signed by your domain |
| **Return-Path** | CNAME `pm-bounces.omtatvadigitals.com` | `pm.mtasv.net` | bounce address on your domain → SPF alignment |
| **SPF** | TXT on `omtatvadigitals.com` | add `include:spf.mtasv.net` to your **existing** `v=spf1 …` record (a domain may have only ONE SPF record) | authorizes the provider's servers |
| **DMARC** | TXT `_dmarc.omtatvadigitals.com` | start with `v=DMARC1; p=none; rua=mailto:dmarc@omtatvadigitals.com` | tells receivers what to do with failures; `p=none` = monitor only |

Alignment (what DMARC checks): the **visible From domain** must match the domain that DKIM signs with (and/or the
Return-Path domain for SPF). Using `payroll@omtatvadigitals.com` with Postmark's DKIM for `omtatvadigitals.com` gives
alignment. After a few weeks of clean DMARC reports, move `p=none` → `p=quarantine`.

Then press **Verify** in Postmark. In the portal, Payroll → *Check sending-domain DNS* shows whether SPF, DKIM
(needs `EMAIL_DKIM_SELECTOR`) and DMARC records exist. It checks DNS only — it cannot prove Postmark has verified the
domain, and nothing can prove inbox placement.

## 3. Store the secrets and settings  (you)

```bash
firebase apphosting:secrets:set POSTMARK_SERVER_TOKEN
firebase apphosting:secrets:set POSTMARK_WEBHOOK_USER      # choose any username
firebase apphosting:secrets:set POSTMARK_WEBHOOK_PASS      # choose a long random password
```

Then uncomment the block at the bottom of `apphosting.yaml` (create the secrets **first** or the rollout fails) and
set `EMAIL_FROM`, `EMAIL_DKIM_SELECTOR` (and optionally `EMAIL_REPLY_TO`, `PORTAL_BASE_URL`). Keep
`PAYSLIP_EMAIL_MODE: "off"` for now. Locally, put the same names in `.env.local` (gitignored — see `.env.local.example`).

## 4. Webhooks for delivery and bounces  (you)

Postmark → your Server → *Webhooks → Add webhook*:

* URL: `https://<WEBHOOK_USER>:<WEBHOOK_PASS>@<your portal domain>/api/payroll/email-webhook`
* Tick **Delivery**, **Bounce**, **Spam complaint**. (Leave Open/Click off — tracking is disabled on payslips.)
* The endpoint rejects any request without those credentials. If maintenance mode is on, the webhook is blocked too.

## 5. Go-live sequence

1. Deploy the app + the updated `firestore.rules` (`npm run rules:check`, then `npm run rules:deploy`).
2. Set `PAYSLIP_EMAIL_MODE: "test"` and redeploy. In Payroll (a finalized month), as Super Admin press
   **Send test e-mail to me**. It sends a clearly fake *SAMPLE EMPLOYEE* payslip to **your own** address
   (or `PAYSLIP_EMAIL_TEST_RECIPIENT`). Check it arrived in the inbox, then open "Show original" and confirm
   SPF / DKIM / DMARC = PASS and that the DKIM domain matches the From domain.
3. Rehearse in a **separate Firebase test project** with 2–3 test employees (own mailboxes): full payroll → approve →
   generate → send → confirm statuses reach *Delivered*; bounce one deliberately (use a non-existent mailbox) and
   confirm it shows *Bounced* and is skipped next time.
4. Set `PAYSLIP_EMAIL_MODE: "live"`, redeploy. As Super Admin tick the two acknowledgements, type
   `ENABLE LIVE PAYSLIP EMAILS` and press **Switch live sending on** (it refuses if SPF/DKIM/DMARC records are missing).
5. Only now, for a real month: Payroll → approved → *Generate Payslips* → *Send Payslips by Email* → check the recipient
   count and period, type `SEND <n> PAYSLIPS`.

## 6. How it behaves

* One e-mail per employee, to the verified Firebase-Auth address only (must be on `EMAIL_ALLOWED_DOMAINS`),
  with only that employee's PDF. No Cc/Bcc, no shared link, open/click tracking off.
* Statuses: *Queued → Sending → Accepted by provider → Delivered*, or *Bounced / Marked as spam / Failed / Not sent /
  Unknown*. "Accepted" is **not** "delivered". "Delivered" means the recipient's mail server accepted it; it can still
  be filtered to spam.
* Temporary errors (network, rate limit, 5xx) are retried 3 times with back-off. Permanent errors are not.
  Wrong provider credentials stop the batch and leave everything queued.
* Pressing the button twice, using two tabs, or retrying after a crash cannot send anyone a second copy; an
  interrupted send shows as **Unknown** and needs a deliberate resend.
* **Controlled resend** (reason required): failed e-mails are retried; bounced / not-sent ones only after the employee's
  address is corrected and verified. A hard bounce or spam complaint blocks that address from future sends.
* Audit (`payrollAudit`, activity log): who started/resent, period, counts, reasons. Never payslip contents or full addresses.

## 7. Honest limits

* Inbox placement is decided by each recipient's mail system; correct SPF/DKIM/DMARC and a clean reputation make it
  likely, never guaranteed.
* PDFs are attached (TLS in transit is up to the receiving server). Payslips are also always available, only to their
  owner, at `/payslips` after sign-in.
* Rehearsal with real Postmark and real Firestore has **not** been done — only fake providers/stores in tests.
