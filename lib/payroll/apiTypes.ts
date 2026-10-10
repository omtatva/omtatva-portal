// Shapes returned by /api/payroll/* (JSON), shared by the payroll screens.
import type { EmployeeResult, Flag, PayrollSummary } from "./engine";
import type { PayrollPolicy, SalaryComponent } from "./policy";
import type { SheetPreview } from "./salarySheet";

export type RunInfo = {
  status: "approving" | "approved" | "payslips_generated" | "reversed";
  revision: number;
  approvedAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  summary: PayrollSummary | null;
  payslipCount: number;
  history: { revision: number; approvedAt: string | null; reversedAt: string; reversedBy: string; reason: string; netPay: number | null }[];
  driftNetPay: number | null;
};

export type PreviewResponse = {
  period: string;
  policy: PayrollPolicy;
  companyFlags: Flag[];
  results: EmployeeResult[];
  summary: PayrollSummary;
  blockers: string[];
  skipped: { employeeId: string; name: string; reason: string }[];
  digest: string;
  decisions: Record<string, { treatment: "paid" | "unpaid"; reason: string; by?: string; at?: string }>;
  canEdit: boolean;
  run: RunInfo | null;
};

export type PayslipRow = {
  id: string; period: string; revision: number; employeeId: string; employeeName: string;
  netPay: number; gross: number; status: string; issuedAt: string | null; published?: boolean; publishedAt?: string | null;
};

export type SalaryPreviewResponse = { preview: SheetPreview; previewHash: string; components: SalaryComponent[] };

export type RunListItem = {
  period: string; status: string; revision: number; approvedAt: string | null; approvedBy: string | null;
  summary: PayrollSummary | null; payslipCount: number;
};

export type SalaryHistoryItem = {
  id: string; employeeId: string; employeeName: string; source: string; reason: string;
  changes: { key: string; label: string; old: number | null; new: number }[]; by: string; at: string | null;
};

export type LeaveImpact = { id: string; workingDays: number; paidDays: number; unpaidDays: number };

export type MyLeaveResponse = {
  today: string;
  policy: { annualEntitlement: number; accrualPerMonth: number; paidLeaveTypes: string[]; unpaidLeaveTypes: string[]; carryForwardEnabled: boolean; negativeBalanceAllowed: boolean };
  policyConfirmed: boolean;
  summary: { leaveYear: number; opening: number; accruedToDate: number; usedYearToDate: number; usedThisMonth: number; unpaidThisMonth: number; available: number; encashableDays: number };
  pendingWorkingDays: number;
  flags: string[];
  offWeekdays: number[];
  holidays: string[];
  requests: { id: string; leaveType: string; fromDate: string; toDate: string; reason: string; status: string; remarks: string; approvedBy: string; appliedOn: string | null; impact: LeaveImpact | null }[];
};

export type LeaveOverviewResponse = {
  today: string;
  policy: MyLeaveResponse["policy"];
  policyConfirmed: boolean;
  employees: { uid: string; employeeId: string; name: string; available: number; used: number; accrued: number; opening: number; pendingWorkingDays: number }[];
  impacts: Record<string, LeaveImpact>;
};
