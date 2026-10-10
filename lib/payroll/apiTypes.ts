// Shapes returned by /api/payroll/* (JSON), shared by the payroll screens.
import type { EmployeeResult, Flag, PayrollSummary } from "./engine";
import type { PayrollPolicy, SalaryComponent } from "./policy";
import type { SheetPreview } from "./salarySheet";

export type RunInfo = {
  status: "approving" | "approved" | "payslips_generated" | "reversed";
  revision: number;
  approvedAt: string | null;
  approvedBy: string | null;
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
  netPay: number; gross: number; status: string; issuedAt: string | null;
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
