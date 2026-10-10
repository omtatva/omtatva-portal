# Payroll module — handover

Audit of the old module: [payroll-audit.md](payroll-audit.md). Tests: `npm run test:payroll`.

## Workflow (Admin → Payroll)

1. **Policy & leave rules** (Super Admin, once): confirm divisor, loss-of-pay base, leave rules. Payroll cannot be approved until confirmed.
2. **Upload salary sheet**: `.xlsx`/`.csv` → preview with old/new values → type `APPLY n SALARY CHANGES` + reason → backup + history written.
3. **Run payroll**: pick month → preview per employee + company totals → resolve "needs a decision" days → type `APPROVE YYYY-MM`.
4. **Generate Payslips**: one PDF per employee, idempotent. Employees open theirs at `/payslips`.
5. **Reverse** (Super Admin): reason + `REVERSE YYYY-MM`; backup, payslips voided, new revision on re-approval.

## Exact formulas (per employee, per month)

```
Gross              = Σ earning components (Basic, HRA, allowances, bonus, …)
D (divisor)        = days in the month        (policy: calendar | fixed N | working days)
Base               = Basic Salary             (policy: basic | gross)
Per-day rate       = Base ÷ D
LOP days           = absent days + unpaid-leave days + HR-decided-unpaid days
LOP deduction      = min(Base, round(rate × LOP days))      (rupee or paisa rounding)
Not-employed days  = days before joining / after last working day
Pro-rata           = round(Gross × not-employed days ÷ days in month)
Fixed deductions   = Σ deduction components (PF, ESI, PT, TDS, other)
NET PAY            = Gross − LOP deduction − Pro-rata − Fixed deductions
```

Defaults (until a Super Admin changes them): calendar-day divisor, LOP on Basic, whole-rupee rounding.
The old module used a fixed 30 on Basic — choose "Fixed number of days = 30" to reproduce it.

**Every calendar day gets exactly one class**, in this order:
not employed → weekly off → company holiday → worked (Present/Late/Incomplete) → HR decision →
approved leave (paid / unpaid) → Absent record → Leave/Holiday/Weekly-Off attendance status → *needs a decision*.
So an Absent record on a weekly off/holiday is not deducted, and Absent + approved leave on one day is counted once.

*Needs a decision* (never auto-paid, never auto-deducted; blocks approval until resolved with a reason):
no attendance record at all, attendance says "Leave" with no approved request, conflicting records for one day,
and (if the policy says so) "punched in, never punched out".

## Leave & holidays

* 24 days/year, 2/month, leave year starts in January — all configurable. Balance is **recomputed from approved
  leave requests every time** (never a stored counter), so re-running payroll cannot deduct leave twice.
* Weekly offs (from the employee's shift) and company holidays inside a leave range are skipped — they never use balance.
* Leave beyond the balance becomes unpaid (or negative balance within the configured limit). `LOP` / `Unpaid Leave` types are always unpaid.
* Company holidays come from the existing Holidays calendar; category `Optional` is not a company holiday (configurable).
  A month with a number of company holidays different from the policy (default 2) shows a warning.
* Carry-forward (with cap) and encashment (reported only, never paid automatically) are configurable.

## Data (all written by the server only)

`settings/payrollPolicy` · `payrollRuns/{YYYY-MM}` (status, revision, summary, policy snapshot, history) ·
`payrollEntries/{period}_r{rev}_{uid}` (immutable per-employee snapshot) · `payslips/{period}_{uid}_r{rev}` ·
`payrollDrafts/{period}` (HR decisions) · `salaryChangeHistory` · `salaryImports` · `payrollBackups` (+ `items`) ·
`payrollAudit` · `payrollPolicyVersions`. Browsers cannot read or write any of them (rules); admins can still *read*
`salaryStructure` and the legacy `payroll` collection.

## Permissions

Server-enforced from the verified token + `adminAccess` role + the Module Permissions matrix:
view payroll / list payslips = `payroll` view · run, approve, generate, decisions = `payroll` edit ·
upload/edit/delete salary = `salaryStructure` edit · policy + reversal = Super Admin only ·
an employee can open **only their own** non-voided payslip. By default HR is view-only on these modules —
a Super Admin must grant HR "edit" in Settings → Module Permissions if HR should run payroll.

## Known limits

* Salary structures are not effective-dated: payroll uses the structure current at approval (and snapshots it).
* Encashment is reported, not paid. Substitute holidays are flagged, not auto-created.
* Single-tenant app (one Firebase project): isolation is verified company e-mail + roles; there is no tenant id.
* The Firestore flow (transactions, backups, payslip create) has not been run against a real database in this
  environment — only its pure logic and the source order of the safety checks are tested.
