# Attendance → leave → LOP payroll audit (read-only)

Settings audited: divisor = **working days** (excl. weekly offs and company holidays) · LOP on **Basic** ·
rounding **nearest rupee** · punched-in-never-out = **needs an HR decision**.
Code: `lib/payroll/engine.ts`, `lib/payroll/leave.ts`, `lib/payroll/policy.ts`, `lib/attendanceRules.ts`.
Nothing in production data, formulas or approved payslips was changed. Sample results below come from running the real engine.

## 1. How working days are counted

```
D = days in month − weekly-off days (from the employee's shift) − company holidays that are NOT on a weekly off
```
Aug 2026: 31 − 5 Sundays − 2 holidays (15 Aug National, 26 Aug Company) = **24**. Holiday categories listed as
"non-company" (default `Optional`) do not count — 20 Aug (Optional) is a working day. A holiday on a Sunday is
removed once. Each employee uses their own shift's weekly offs, so D can differ per employee.

## 2. What each status does to salary

| Day type | Effect |
|---|---|
| Present | paid |
| Late | paid (the "late" penalty logic is switched off) — no deduction |
| Absent (record) | **LOP**, unless the day is a weekly off / company holiday (then nothing) or approved leave covers it |
| Half Day | **not implemented** — status "Half Day" is treated as a normal Present day: **paid in full, no deduction** |
| Approved paid leave | paid, uses leave balance (only while balance lasts) |
| Approved unpaid leave (LOP type) | **LOP** |
| Paid leave beyond the balance | **LOP** (flagged as a warning, not a block) |
| Weekly off / company holiday | paid, never deducted, never uses leave |
| No attendance record | **not deducted, not paid-by-default: "needs a decision"**; approval is blocked until HR sets paid/unpaid |
| Punched in, no punch-out (your setting) | **needs an HR decision**; approval blocked |

## 3. LOP formula

```
per-day rate  = Basic ÷ D                       (Aug: 30,000 ÷ 24 = 1,250.00)
LOP days      = absent + unpaid-leave + HR-decided-unpaid
LOP deduction = round( per-day rate × LOP days )   nearest rupee, applied to the TOTAL (never per day)
              capped at Basic
```
3 absences → 3,750 · all 24 working days absent → 30,000 (= Basic).

## 4. Sample results (gross 50,000 = Basic 30,000 + HRA 12,000 + Special 8,000; PF 1,800 fixed)

| Case | LOP days | LOP | Net | Note |
|---|---|---|---|---|
| A Full attendance | 0 | 0 | 48,200 | |
| B 3 absent | 3 | 3,750 | 44,450 | |
| C absent all 24 working days | 24 | 30,000 | 18,200 | still paid HRA/Special + weekly offs |
| D 5 × Late | 0 | 0 | 48,200 | |
| E 4 × "Half Day" | 0 | 0 | 48,200 | **half days paid in full** |
| F paid leave 2 d (balance ok) | 0 | 0 | 48,200 | |
| G unpaid leave 2 d | 2 | 2,500 | 45,700 | |
| H paid leave 5 d, joined 1 Aug (2 d balance) | 3 | 3,750 | 44,450 | approved as paid, 3 d became LOP |
| I leave Fri 14–Mon 17 | 0 | 0 | 48,200 | only the 2 working days used |
| J 4 days no record | 0 | 0 (provisional) | 48,200 | status = needs decision |
| K 2 × punched-in-no-out | 0 | 0 (provisional) | 48,200 | status = needs decision |
| L Absent on Sunday + holiday | 0 | 0 | 48,200 | not deducted |
| M Absent + unpaid leave same day | 1 | 1,250 | 46,950 | counted once |
| N joined 20 Aug | 0 | 0 (pro-rata 30,645) | 17,555 | |
| O joined 20 Aug + 2 absent | 2 | 2,500 (+30,645) | 15,055 | |
| P HR: 4 missing days unpaid | 4 | 5,000 | 43,200 | |
| Q 3 absent, TDS 10% earned | 3 | 3,750 | 39,825 | TDS = 10% × 46,250 |
| R Basic 10,000 + allowances 40,000, 3 absent | 3 | 1,250 | 47,550 | allowances untouched |

## 5. Can paid leave or a missing record wrongly cause LOP?

* **Approved paid leave** never causes LOP *while the balance lasts*. Once the balance is exhausted the excess days
  become LOP even though HR approved them as Casual/Paid (case H). It is shown as a warning, not a block — easy to miss.
* **Missing records** never cause LOP automatically for months before the auto-absent policy (10 Oct 2026); they are
  held for a decision. From that date the system itself writes an "Absent" record for a non-punch day, which is LOP by design.
* An **Absent record under approved leave** is not charged (leave wins) ✔ · **Absent on a worked/leave day** is counted once ✔.

## 6. Duplicates / approved payroll

Every calendar day gets exactly one class, so nothing is deducted twice (cases L, M; 300+ random months in the tests).
Approving stores an immutable snapshot with a fingerprint; correcting attendance afterwards does **not** touch it
(the preview only reports "drift"). Re-approving the same month is refused; changes need a Super Admin reversal → new revision.

## 7. How LOP interacts with gross, net, TDS, PF, ESI

```
NET = Gross − LOP − Pro-rata − fixed deductions (PF, ESI, PT, other) − TDS
```
* Gross is never reduced — LOP is a separate deduction line.
* **TDS** (percentage mode) is computed on *earned* salary = Gross − LOP − Pro-rata ✔. In fixed mode it ignores LOP.
* **PF / ESI / PT are fixed rupee amounts** from the salary structure: they do **not** fall when LOP reduces earned
  Basic, and ESI is not switched off above its wage ceiling.

## 8. Issues found (decisions needed — nothing changed yet)

| # | Issue | Impact | Suggested fix |
|---|---|---|---|
| 1 | **Half Day is not supported** — a "Half Day" record is paid as a full day | half-day absences cost nothing | add a Half Day status = 0.5 LOP day (and half-day leave) |
| 2 | **LOP on Basic only** leaves allowances intact: an employee absent every working day still nets 18,200 of 50,000 (C); low-Basic/high-allowance staff lose almost nothing for absences (R) | under-deduction | LOP on Gross, or prorate allowances too |
| 3 | **Pro-rata for joiners uses calendar days** (19/31 → 30,645) while LOP uses working days (15/24 → 31,250) | ₹605 difference in the example; inconsistent with the "working days" divisor | pro-rate joiners on the same working-day basis |
| 4 | **Paid leave beyond balance silently becomes LOP** (warning only) | HR approves "Casual", employee is deducted | make it a blocking flag / force an explicit HR decision |
| 5 | **PF/ESI do not follow earned Basic** | PF slightly over-deducted when LOP applies; ESI wage-ceiling not enforced | compute PF = 12% of earned Basic (capped), ESI only if gross ≤ ceiling |
| 6 | Provisional net (cases J, K) pays the undecided days | preview net is overstated until decided (approval is blocked, so no payout error) | label as "provisional" in the review (already flagged per employee) |
| 7 | Late / WFH / On Duty / Comp Off / unknown statuses are all paid | none for Late (by policy); unknown statuses never deduct | confirm intended |

Items 1–5 change pay and need your decision before any formula is touched.
