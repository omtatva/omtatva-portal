# Attendance audit, migration & rollback plan (Phase 2) — FOR REVIEW

**Status: proposal only.** Nothing in this plan has been run. No production attendance
data has been modified, and nothing is deployed until you approve it.

## 0. Why this matters (payroll)

Payroll (`lib/payrollCalculation.js`) deducts **one day of basic salary (basic ÷ 30) for every
attendance document whose `status` is exactly `"Absent"`**. Documents with status `"Leave"` are
counted as leave (no deduction). Any other status (`Holiday`, `Weekly Off`) is neutral, and
a day with **no** document is also neutral (no deduction).

So every wrong `"Absent"` document in July–September is a wrongful salary deduction, and the
new grace-period rule (from 2026-10-10) will deduct a day for each late punch-in. Payroll for
the affected months should be re-checked after any correction.

## 1. What was built (read-only until you use it)

| Item | Where | Writes data? |
|---|---|---|
| Month / employee report (Jul, Aug, Sep, all) | Admin → Attendance Reports & Audit → Report | No |
| Historical audit (13 check types) | …→ Audit | No |
| Single-record correction (reason required, original values kept) | …→ "Correct" / "Add record" | Only when an admin saves |
| Corrections log + per-correction revert | …→ Corrections log | Revert writes a new entry |
| Backup, checksum, verify against live data | …→ Backup & rollback | Writes only a backup record |
| Restore script (dry-run by default) | `scripts/attendance-restore.ts` | Only with `--apply` |
| Demo generator (test project only) | `scripts/generate-demo-attendance.ts` | Refuses production |

There is **no bulk-update feature** in the app. Bulk changes happen only through the steps below.

## 2. Audit — what is checked

High: invalid date format · date differs from the punch-in day (company timezone) ·
Absent on a weekly off / holiday / approved-leave day · Absent although a punch-in exists
(before the policy start date, or with no recorded policy decision) · punch-out before punch-in.
Medium: working day with **no record** (never assumed Present) · Present with no punch times ·
duplicate records for one day. Low: punched in but never punched out · saved hours ≠ punches ·
record for an unknown employee.

The audit proposes a status for the "Absent on a weekly off / holiday / leave" findings
(Weekly Off / Holiday / Leave). Everything else needs a human decision.

## 3. Step-by-step (nothing below happens without your approval)

1. **Publish the new Firestore rules** (section 6) — needed for the corrections log and backups.
2. **Run the audit** (admin sign-in → Attendance Reports → Audit → Run audit), then export CSV/JSON.
   *Read-only.* Share the export for review. This is the "audit report first" step.
3. **You review the audit** and mark which findings to fix and how. Typical decisions:
   - Absent placeholders on Sundays/holidays/leave days → change to Weekly Off / Holiday / Leave.
   - Absent with a punch-in before 2026-10-10 → likely Present, after checking the punch time.
   - Missing records → verify (leave request, WFH, door logs) before anything is written.
4. **Backup** (Backup & rollback tab): create → file downloads → choose that file to verify →
   "Mark as verified". The bulk-change gate turns green only for a verified backup covering
   Jul 1–Sep 30 that is under 24 hours old.
5. **Apply fixes** as individual corrections in the app (each has reason, admin, time,
   original and corrected values). For a large batch, a one-off script reading your approved list
   will be written and reviewed separately and must pass the gate in step 4 first; it will have a
   dry-run mode like the restore script.
6. **Re-run the audit** — findings you fixed should disappear; compare counts.
7. **Re-check payroll** for July–September.

## 4. Rollback

- **One record:** Corrections log → Revert (only if the record has not been changed since).
- **Many records:** `scripts/attendance-restore.ts` with the verified backup file.
  1. Dry run: `npx tsx scripts/attendance-restore.ts --file <backup.json> --project omtatva-portal`
     — prints identical / changed / missing / newer counts. Changes nothing.
  2. Apply: add `--apply --confirm-project omtatva-portal`.
  3. Before writing, it saves a snapshot of the current state to `backups/pre-restore_<time>.json`,
     so the restore itself can be undone with the same script.
  4. Records created after the backup are reported but never deleted.
- Corrections never delete anything and keep `originalPunchIn/Out`, so history is recoverable
  even without a backup.

## 5. Verifying the backup (what "verified" means)

- the file parses; record count and SHA-256 checksum match the header;
- the checksum matches the one stored at creation time (`attendanceBackups`);
- it is compared against live data (identical / changed since / missing / newer);
- an admin then marks it verified (stored with who and when).

## 6. Firestore rules to publish (additive)

The report, export, correction-history and backup data are now served ONLY by the
Super-Admin-checked server API, so these collections can be locked completely to
browsers (the server uses the Admin SDK, which bypasses rules):

```
match /attendanceCorrections/{id} { allow read, write: if false; }
match /attendanceBackups/{id}     { allow read, write: if false; }
match /settings/demoEnvironment   { allow read, write: if false; }
```

(If you already published the earlier `isAdminTier()` versions of these, replace them with the above.)
The earlier `attendance` rules (employees can't write punch times/status directly) stay as they are.
Nothing else about other roles' normal attendance access changes.

## 7. Demo data (test project only) — Aug ≈ 80 %, Sep ≈ 70 %

1. Create a separate Firebase project (free tier is fine) and a service-account key for it.
2. Dry run:  `DEMO_FIREBASE_PROJECT_ID=<test-project> npx tsx scripts/generate-demo-attendance.ts --i-understand-this-is-not-production`
3. Write: add `--apply`. Remove later with `--remove-demo` (deletes only ids starting `demo_`).
4. To view it in the portal: put the test project's web config in `.env.local` (see
   `.env.local.example`) and run `npm run dev`.

Demo documents carry `isDemo: true`, `verified: false`, `attendanceSource: "DEMO-GENERATED"`,
and each demo employee is below 100% attendance. The script exits if the project id is
`omtatva-portal`.

## 8. Known limits / open questions for you

- The audit and report load the whole `attendance` collection in the browser. Fine at your size;
  say so if it grows large.
- Correction statuses: Present, Absent, Leave, Holiday, Weekly Off. "Half day" is not offered.
- A record **created** by a correction can't be auto-reverted (correct it again instead).
- Whether "No record" days should become Absent, Leave or stay empty is a payroll-policy
  decision for you — the tool never decides it.
- Server routes (punch-in/out, corrections) need Firebase Admin credentials on the host;
  check `/api/attendance/health` after deploying.

## 9. Phase 3 — Super Admin reports & monthly archive

- **Who can see what.** `/admin/attendance-reports`, the monthly CSV downloads, the audit
  exports, the corrections history and the backup controls are **Super Admin only**.
  Enforcement is on the server: every `/api/attendance/reports/*` call verifies the Firebase ID
  token, looks the caller up in `adminAccess` and returns **403** unless the role is
  `super_admin` (Admin, HR, Head, Manager, Team Lead, Employee are all refused). The page itself
  is a client page (this app has no server sessions), so it contains no data: a non-Super-Admin
  sees "Access restricted" and is redirected to `/admin`, a signed-out visitor to `/admin/login`.
  The dashboard card is hidden for everyone but Super Admins.
- **Monthly archive.** Months are computed from today's date in the company timezone:
  every month since July 2026 that has ended is "Completed", the current month is shown as
  "In progress — not final", future months never appear. A month appears the moment it ends —
  no code change or deploy.
- **Download CSV** (per month, optional employee filter): built on the server from the same
  report builder as the screen, UTF-8 with BOM, safe filenames (`attendance-2026-08.csv`,
  `attendance-2026-08-<employeeId>.csv`), formula-injection safe, no truncation. Columns hold no
  email, phone, address, salary, bank or document data.
- **Historical corrections** (record dated in a completed month) now additionally require:
  a Super Admin **and** a verified backup under 24 hours old that covers that date — enforced
  by the server, not the UI. Current-month corrections keep their previous permission rule.
- **Payroll safety.** Payroll code now ignores any attendance record flagged `isDemo`. Production
  reports never include demo records: they are included only in a non-production project that
  carries its own `settings/demoEnvironment` marker.
- **Existing records.** Nothing in this feature changes existing production attendance or
  payroll records. Historical records stay exactly as they are unless a verified operation
  (a Super Admin correction with a verified backup, or an approved restore) actually changes them.

### Deployment
1. Publish the rules in section 6.
2. Deploy (`firebase deploy --only apphosting`, as before). Nothing in the database is migrated.
3. Open `/api/attendance/health` → `ok: true` (Admin credentials work).
4. Sign in as Super Admin → Admin dashboard → "Attendance Reports & Audit".
5. Sign in as Admin/HR → the card is absent, and `/admin/attendance-reports` redirects away.

### Demo data in the test project (not run yet)
```
DEMO_FIREBASE_PROJECT_ID=<test-project> GOOGLE_APPLICATION_CREDENTIALS=<key.json>   npx tsx scripts/generate-demo-attendance.ts --i-understand-this-is-not-production --init-test-project   # once
DEMO_FIREBASE_PROJECT_ID=<test-project> GOOGLE_APPLICATION_CREDENTIALS=<key.json>   npx tsx scripts/generate-demo-attendance.ts --i-understand-this-is-not-production                       # preview
… same command with --apply                                                                                # write
```
The preview prints record counts and each employee's expected Aug/Sep percentage first.

## 10. Historical Attendance panel (main Attendance dashboard) — Jul · Aug · Sep 2026

Super Admin only. Admin → Attendance → "Historical Attendance" panel.

- **Always (any project):** one row per employee per month — existing records, Present, Absent, Leave,
  Weekly offs / holidays, Eligible working days, Attendance %, and the list of **missing dates**
  (shown separately, never counted as present). Eligible days exclude Sundays/configured weekly offs
  (per shift), company holidays and approved leave, in company time.
- **Production (`omtatva-portal`) and any unverified project:** read-only. The "Initialize Historical
  Attendance" button only explains why nothing can be generated and links to the audited correction
  workflow (Attendance Reports → correct: evidence, reason, verified backup, audit trail). The server
  refuses the request regardless of the UI.
- **Verified demo/test project only** (non-production id **and** its own `settings/demoEnvironment`
  marker): the panel previews every employee x month with the proposed percentage and number of
  records, then — after a typed confirmation `INITIALIZE <project id>` and a verified backup under 24 h
  covering the range — creates the missing days. Aug ≈ 80 %, Sep ≈ 70 %, July varied, all < 95 %.
  Records are flagged `isDemo: true`, source `DEMO-GENERATED`, and are ignored by payroll.
- **Idempotent:** documents use fixed ids and `create()`; existing days are skipped, never overwritten;
  a re-run creates 0. Per-month result: created / skipped / corrected (corrected is always 0 here —
  corrections only happen through the audited workflow). Every run is stored in
  `attendanceInitializations` and the activity log.
- Rules: `attendanceInitializations` is server-only (already in `firestore.rules`).

### Running it safely
1. Create a separate Firebase TEST project; put its web config in `.env.local` (see `.env.local.example`)
   and a service-account key in `FIREBASE_SERVICE_ACCOUNT_JSON`.
2. Mark it once: `DEMO_FIREBASE_PROJECT_ID=<test> npx tsx scripts/generate-demo-attendance.ts --i-understand-this-is-not-production --init-test-project`
3. `npm run dev`, sign in as Super Admin of the TEST project → Admin → Attendance → panel.
4. Check the banner says **DEMO / TEST project** and shows the test project id.
5. Attendance Reports → Backup & rollback: create + verify a backup. Then Initialize, type the phrase, confirm.
