# Payroll audit (read-only) — findings BEFORE any fix

Scope: every payroll-related file in the repo as of 2026-10-10. Nothing in live
data was read or changed; this is a code audit.

## What exists today

| Piece | Where | Notes |
|---|---|---|
| Salary structure (per employee) | Firestore `salaryStructure`, UI `app/admin/salary-structure/page.js`, `components/salary/SalaryForm.js`, `BulkUpload.js` | flat fields: basic, hra, specialAllowance, medical, conveyance, foodAllowance, internetAllowance, pf, esi, professionalTax, tds, grossSalary |
| Payroll run that actually executes | `components/salary/PayrollProcess.js` (inline `calculatePayroll`) → writes `payroll` docs | the **only** automatic calculation in use |
| `lib/payrollCalculation.js` | exported `calculatePayroll` | **dead code** — imported nowhere |
| Manual payroll form | `app/admin/payroll/page.js` | free-typed basic/allowance/tax/"leave deduction"; writes `payroll` with `addDoc` |
| Payslip PDF | `lib/generatePayslip.js` (jsPDF) | imported by the manual payroll page but never called |
| Employee-facing payslip | `userData.documents.salarySlip` (a manually uploaded file URL) | no payslip is generated for employees |
| Rules | `firestore.rules` | `payroll`, `salaryStructure`: read/write = any admin-tier role (HR, Head, Admin, Super Admin) |

## Problems found

### Critical — pay is wrong today

1. **Attendance is never found.** `PayrollProcess.getEmployeeAttendance` queries
   `attendance where employeeId == …`. Real attendance records carry `userId`
   (the Firebase uid) and **no `employeeId`** (`lib/server/attendanceServer.ts`).
   The query returns nothing, so `presentDays = absentDays = 0` and **absence is
   never deducted** for punch-based records. (`lib/attendanceService.js` has the
   same bug and is unused.)
2. **Leave is read from the wrong collection.** It reads `leaves`; the Leave page
   writes `leaveRequests` (`uid`, `fromDate`, `toDate`, `leaveType`, `status`).
   Approved leave is therefore never seen.
3. **Unpaid leave can never match.** The code tests `leaveType === "Unpaid Leave"`;
   the Leave form's unpaid type is **"LOP"**. Even with the right collection no
   LOP leave would be deducted.
4. **Leave is not filtered by month.** `getEmployeeLeaves` returns *all* approved
   leave ever taken. If (1)–(3) were fixed naively, an old unpaid leave would be
   deducted again in every later month.
5. **Divisor is hard-coded to 30** (`totalDays = 30`) for every month (28–31 days)
   and every employee, and the deduction is `basic / 30` — not gross, not the
   month's working/calendar days. A day's loss of pay is therefore wrong in 28-,
   29- and 31-day months, and for anyone whose pay is mostly allowances.
6. **Duplicate / double counting.** `lopDeduction = (absentDays + unpaidLeaveDays) × rate`.
   A day that has both an "Absent" record and an approved unpaid leave is charged
   twice; an "Absent" record on a **weekly off or company holiday** is charged
   although the person is not expected to work.
7. **Weekly offs and holidays are not modelled.** No payroll code reads
   `holidays`, shift `workdays`, or the attendance rules. Their effect on pay is
   accidental (only if an "Absent" document happens to exist on that day).
8. **Missing attendance is silently paid in full.** No record = no deduction, no
   flag. A person who simply did not punch in and was never auto-marked is paid
   as if present.
9. **Leave balance does not exist.** Nothing tracks the 24-day entitlement,
   accrual, carry-forward or negative balance. "Leave" days are counted but never
   limited, and Casual/Sick/Paid/Emergency leave is not separated from LOP.
10. **`leaveDays` (stored) is the total of *all* approved leave** (calendar days,
    including weekly offs/holidays inside the range, not month-filtered) —
    misleading on the record and on any export.

### High — correctness / integrity

11. **Duplicate payroll runs.** `PayrollProcess` skips an employee/month only
    after a client-side read; two admins (or a double click) can both pass the
    check and create two documents. The manual page (`payroll/page.js`) has **no
    check at all**, and uses field `month` while the automated run uses
    `salaryMonth`, so each path is blind to the other's records.
12. **Approval does not exist.** Records are created `status: "Pending"` and
    nothing approves, locks or publishes them; any admin-tier user can edit or
    delete any month through the browser (rules allow it). No audit trail.
13. **Historical pay is not protected.** Records store only results (no attendance
    or salary snapshot), so they cannot be reproduced or explained later.
14. **Statuses other than exactly "Present"/"Absent" are ignored.** "Late",
    "Incomplete", "Leave", "Holiday", "Weekly Off" are unmodelled (neutral). That
    is acceptable for Late, but the choice is implicit, not a policy.
15. **Timezone/date boundaries.** Month selection is the string prefix
    `date.startsWith("YYYY-MM")` on company-local date strings — correct *if* every
    record's `date` is the company-local date, which the punch server guarantees.
    Leave ranges are plain `YYYY-MM-DD` strings. No UTC `Date` parsing is used for
    selection, so no off-by-one was found there. The risk is the *absence* of any
    month-length / joining-date handling (an employee who joins on the 20th is
    charged for the 1st–19th only if "Absent" docs exist for those days — none do).
16. **Gross is stored, not derived.** `grossSalary` on the structure is computed
    once in the browser when saving; a later edit to one component can leave
    gross stale. Payroll trusts it.
17. **Bulk salary upload overwrites silently** (`BulkUpload.js`): matches on
    `Employee_ID` against `salaryStructure` (no check that the employee exists),
    `updateDoc` with no preview, no old/new values, no history, no backup;
    `Number(row.X || 0)` turns a typo or blank into **0**. Only `.xlsx/.xls`
    (no CSV); unknown columns ignored silently. Duplicate IDs: last write wins.
18. **Payslip PDF** prints `₹` with the built-in Helvetica font, which has no
    rupee glyph (renders as a wrong character); shows only Basic/"Allowance"/Tax/
    "Leave deduction" — no attendance or payable days; date uses the browser's
    locale/timezone.

### Security

19. Any admin-tier role (Head, Admin, HR) can read **and write** payroll and
    salary data directly from the browser; the per-module View/Edit matrix is
    enforced in the UI only. Employees correctly cannot read `payroll`/
    `salaryStructure`, but there is **no employee-facing, server-checked payslip
    access** at all.
20. The `xlsx` dependency is 0.18.5, which has published advisories (prototype
    pollution / ReDoS when parsing hostile files). Uploads are by authorized
    HR only and parsing happens in their own browser, but this should be
    upgraded to the vendor's patched build when possible.

## Test evidence (existing behaviour, from reading the code)

Basic 30,000 · Gross 50,000 (PF/ESI/PT/TDS = 0):

| Scenario | Today's net | Why |
|---|---|---|
| 31-day month, 3 "Absent" docs found | 50,000 − 3×1,000 = **47,000** | divisor 30, not 31 (in a 31-day month a day is 30,000/31) |
| Same employee, but docs are keyed by `userId` | **50,000** | query finds nothing (problem 1) |
| 2 approved days of "Casual Leave" | 50,000 | leaves not read (2) |
| 2 approved "LOP" days | 50,000 | type never matches (3) |
| No attendance records at all | **50,000** | silently paid in full (8) |
| "Absent" on a Sunday | −1,000 | weekly off charged (6) |

## Decisions the formula needs (configurable in the new module, not assumed)

* **Divisor** — calendar days of the month (default), fixed 30, or working days.
* **Loss-of-pay base** — Basic (today's behaviour, kept as the default) or Gross.
* **Missing attendance** — flagged for review and never auto-paid/auto-deducted.

All three are stored in `settings/payrollPolicy` and printed on every payslip
run so the numbers are explainable.

---

## Resolution (2026-10-10)

Problems 1–19 are addressed by the new module — see [payroll.md](payroll.md). The old `PayrollProcess`, `BulkUpload`,
`payrollCalculation.js`, `generatePayslip.js`, `attendanceService.js` and the manual payroll form were removed;
existing `payroll` records are untouched and shown read-only under Payroll → History.
Problem 20 (`xlsx` 0.18.5) is **not** fixed: upgrading needs the vendor's patched build and is listed as a remaining issue.
