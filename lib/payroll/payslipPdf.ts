// Individual payslip PDF. Rendered from the immutable payroll snapshot saved at
// approval, so the same payslip is byte-for-byte reproducible later.
// Uses the built-in Helvetica font, which has no ₹ glyph — amounts print as "Rs.".

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { EmployeeResult } from "./engine";

export type PayslipMeta = {
  companyName: string;
  period: string; // YYYY-MM
  revision: number;
  payslipId: string;
  approvedAtIso: string; // fixed timestamp => deterministic output
  joiningDate?: string | null;
  policyLines: string[];
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// 1,23,456.00 (Indian digit grouping)
export function formatRs(n: number): string {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${neg ? "-" : ""}${grouped}.${dec}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const below100 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
const below1000 = (n: number) => (n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? " " + below100(n % 100) : ""}` : below100(n));

export function rupeesInWords(amount: number): string {
  const total = Math.round(Math.abs(amount) * 100);
  let rupees = Math.floor(total / 100);
  const paise = total % 100;
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rupees) parts.push(below1000(rupees));
  let words = parts.join(" ") || "Zero";
  words += " Rupees";
  if (paise) words += ` and ${below100(paise)} Paise`;
  return `${neg(amount)}${words} Only`;
}
const neg = (n: number) => (n < 0 ? "Minus " : "");

export function renderPayslip(r: EmployeeResult, meta: PayslipMeta): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  const created = new Date(meta.approvedAtIso);
  doc.setCreationDate(created);
  doc.setFileId(meta.payslipId.replace(/[^0-9a-fA-F]/g, "").padEnd(32, "0").slice(0, 32));
  doc.setProperties({ title: `Payslip ${periodLabel(meta.period)} - ${r.employeeId}`, subject: "Payslip", author: meta.companyName, creator: meta.companyName });

  const W = 210;
  const L = 14; // left and right margin
  const R = W - 14;

  // header band
  doc.setFillColor(37, 71, 140);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(meta.companyName.toUpperCase(), W / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Payslip for ${periodLabel(meta.period)}`, W / 2, 22, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // employee block
  autoTable(doc, {
    startY: 36,
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 32 }, 1: { cellWidth: 59 }, 2: { fontStyle: "bold", cellWidth: 32 }, 3: { cellWidth: 59 } },
    body: [
      ["Employee", r.name, "Employee ID", r.employeeId],
      ["Department", r.department || "-", "Designation", r.designation || "-"],
      ["Date of joining", meta.joiningDate || "-", "Pay period", periodLabel(meta.period)],
    ],
    margin: { left: L, right: 14 },
  });

  // attendance summary
  const c = r.counts;
  const worked = c.present + c.incomplete;
  const paidLeave = c["paid-leave"] + c["decided-paid"];
  const unpaid = r.lopDays;
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Attendance summary", "Days"]],
    headStyles: { fillColor: [37, 71, 140], textColor: 255, fontSize: 9.5 },
    styles: { fontSize: 9.5, cellPadding: 1.6 },
    columnStyles: { 1: { halign: "right", cellWidth: 24 } },
    body: [
      ["Calendar days in month", String(r.daysInMonth)],
      ["Days worked", String(worked)],
      ["Weekly offs", String(c["weekly-off"])],
      ["Company holidays", String(c.holiday)],
      ["Paid leave", String(paidLeave)],
      ["Unpaid days (absent / unpaid leave) - loss of pay", String(unpaid)],
      ...(r.notEmployedDays ? [["Days not employed in this month", String(r.notEmployedDays)]] : []),
      ["Payable days", String(r.payableDays)],
    ],
    margin: { left: L, right: 14 },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === (d.table.body.length - 1)) d.cell.styles.fontStyle = "bold";
    },
  });

  // earnings | deductions
  const earn = r.earnings.map((e) => [e.label, formatRs(e.amount)]);
  const ded: string[][] = [];
  if (r.lopDeduction > 0) ded.push([`Loss of pay (${r.lopDays} day${r.lopDays === 1 ? "" : "s"} @ Rs. ${formatRs(r.perDayRate)})`, formatRs(r.lopDeduction)]);
  if (r.notEmployedDeduction > 0) ded.push([`Pro-rata (${r.notEmployedDays} day${r.notEmployedDays === 1 ? "" : "s"} not employed)`, formatRs(r.notEmployedDeduction)]);
  for (const d of r.deductions) ded.push([d.label, formatRs(d.amount)]);
  const rows = Math.max(earn.length, ded.length, 1);
  const body: string[][] = [];
  for (let i = 0; i < rows; i++) body.push([earn[i]?.[0] || "", earn[i]?.[1] || "", ded[i]?.[0] || "", ded[i]?.[1] || ""]);
  body.push(["Gross earnings", formatRs(r.grossEarnings), "Total deductions", formatRs(r.totalDeductions)]);
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Earnings", "Rs.", "Deductions", "Rs."]],
    headStyles: { fillColor: [37, 71, 140], textColor: 255, fontSize: 9.5 },
    styles: { fontSize: 9.5, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 58 }, 1: { halign: "right", cellWidth: 33 }, 2: { cellWidth: 58 }, 3: { halign: "right", cellWidth: 33 } },
    body,
    margin: { left: L, right: 14 },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === body.length - 1) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [236, 241, 250];
      }
    },
  });

  // net pay
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFillColor(236, 241, 250);
  doc.roundedRect(L, y, R - L, 20, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("NET PAY", L + 4, y + 8);
  doc.setFontSize(15);
  doc.text(`Rs. ${formatRs(r.netPay)}`, R - 4, y + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(rupeesInWords(r.netPay), L + 4, y + 15, { maxWidth: R - L - 8 });

  // leave balance
  y += 26;
  if (r.leave) {
    doc.setFontSize(9);
    doc.text(
      `Leave balance (year ${r.leave.leaveYear}): opening ${r.leave.opening}, accrued ${r.leave.accruedToDate}, used ${r.leave.usedYearToDate}, available ${r.leave.available}.`,
      L, y, { maxWidth: R - L },
    );
    y += 6;
  }

  // basis + footer
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const basis = ["Basis of calculation:", ...meta.policyLines.map((p) => `- ${p}`)];
  doc.text(basis, L, y, { maxWidth: R - L });
  y += basis.length * 3.6 + 4;
  doc.text(`Payslip ${meta.payslipId} · revision ${meta.revision} · issued ${meta.approvedAtIso.slice(0, 10)}`, L, y);
  doc.text("This is a computer-generated payslip and does not require a signature.", W / 2, 285, { align: "center" });

  return new Uint8Array(doc.output("arraybuffer"));
}
