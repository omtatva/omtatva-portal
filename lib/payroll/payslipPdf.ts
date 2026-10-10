// Individual payslip PDF, laid out like a large-company payslip:
//   header (company, "PAYSLIP", month) → employee / bank / statutory block →
//   Earnings | Deductions side by side with CURRENT MONTH and YEAR-TO-DATE
//   columns → net pay (figures and words) → attendance & leave summary → notes.
//
// Rendered from the immutable payroll snapshot saved at approval, so the same
// payslip is byte-for-byte reproducible later. Uses the built-in Helvetica font,
// which has no ₹ glyph — amounts print as "Rs.".

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { EmployeeResult } from "./engine";
import type { Ytd } from "./ytd";

export type PayslipMeta = {
  companyName: string;
  period: string; // YYYY-MM
  revision: number;
  payslipId: string;
  approvedAtIso: string; // fixed timestamp => deterministic output
  joiningDate?: string | null;
  policyLines: string[];
  // --- optional: shown when known (older payslips simply omit them)
  companyAddress?: string | null;
  employee?: {
    location?: string | null;
    bankName?: string | null;
    bankAccountMasked?: string | null; // e.g. XXXXXX1234
    ifsc?: string | null;
    pfNumber?: string | null;
    esiNumber?: string | null;
    uan?: string | null;
    pan?: string | null;
  };
  ytd?: Ytd | null;
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
const neg = (n: number) => (n < 0 ? "Minus " : "");

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

// Bank account numbers are only ever printed masked: XXXXXX1234.
export function maskAccount(v: unknown): string | null {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? "X".repeat(Math.max(digits.length - 4, 0)) + digits.slice(-4) : null;
}

const NAVY: [number, number, number] = [31, 56, 100];
const SOFT: [number, number, number] = [236, 241, 250];
const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export function renderPayslip(r: EmployeeResult, meta: PayslipMeta): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  doc.setCreationDate(new Date(meta.approvedAtIso));
  doc.setFileId(meta.payslipId.replace(/[^0-9a-fA-F]/g, "").padEnd(32, "0").slice(0, 32));
  doc.setProperties({ title: `Payslip ${periodLabel(meta.period)} - ${r.employeeId}`, subject: "Payslip", author: meta.companyName, creator: meta.companyName });

  const W = 210;
  const L = 14;
  const R = W - 14;
  const ytd = meta.ytd || null;
  const emp = meta.employee || {};

  // ---------------------------------------------------------------- header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...NAVY);
  doc.text(meta.companyName.toUpperCase(), L, 17);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("PAYSLIP", R, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(periodLabel(meta.period), R, 20, { align: "right" });
  if (meta.companyAddress) {
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text(meta.companyAddress, L, 23, { maxWidth: 120 });
    doc.setTextColor(0, 0, 0);
  }
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(L, 28, R, 28);

  // ------------------------------------------- employee / bank / statutory
  const pairs: [string, string][] = [
    ["Employee No.", r.employeeId],
    ["Employee Name", r.name],
    ["Designation", r.designation || "-"],
    ["Department", r.department || "-"],
    ["Date of Joining", meta.joiningDate || "-"],
    ["Location", emp.location || "-"],
    ["Pay Period", periodLabel(meta.period)],
    ["Pay Days", `${r.payableDays} of ${r.daysInMonth}`],
    ["LOP Days", String(r.lopDays)],
    ["Leave Balance", r.leave ? `${r.leave.available} day(s)` : "-"],
  ];
  const optional: [string, string | null | undefined][] = [
    ["Bank", emp.bankName],
    ["Bank A/C No.", emp.bankAccountMasked],
    ["IFSC", emp.ifsc],
    ["PAN", emp.pan],
    ["PF No.", emp.pfNumber],
    ["UAN", emp.uan],
    ["ESI No.", emp.esiNumber],
  ];
  for (const [k, v] of optional) if (v) pairs.push([k, v]);
  if (pairs.length % 2) pairs.push(["", ""]);
  const info: string[][] = [];
  for (let i = 0; i < pairs.length; i += 2) info.push([pairs[i][0], pairs[i][1], pairs[i + 1][0], pairs[i + 1][1]]);
  autoTable(doc, {
    startY: 32,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [200, 205, 215], lineWidth: 0.2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 30, fillColor: SOFT },
      1: { cellWidth: 61 },
      2: { fontStyle: "bold", cellWidth: 30, fillColor: SOFT },
      3: { cellWidth: 61 },
    },
    body: info,
    margin: { left: L, right: 14 },
  });

  // --------------------------------- earnings | deductions (month + YTD)
  const earn: string[][] = r.earnings.map((e) => [e.label, formatRs(e.amount), ytd ? formatRs(ytd.earnings[e.key] ?? 0) : "-"]);
  const ded: string[][] = [];
  if (r.attendanceDeduction > 0 || (ytd?.absence ?? 0) > 0) ded.push([`Loss of pay - absence (${r.attendanceLopDays} d)`, formatRs(r.attendanceDeduction), ytd ? formatRs(ytd.absence) : "-"]);
  if (r.leaveDeduction > 0 || (ytd?.leave ?? 0) > 0) ded.push([`Loss of pay - unpaid leave (${r.leaveLopDays} d)`, formatRs(r.leaveDeduction), ytd ? formatRs(ytd.leave) : "-"]);
  if (r.notEmployedDeduction > 0 || (ytd?.prorata ?? 0) > 0) ded.push([`Pro-rata (${r.notEmployedDays} d not employed)`, formatRs(r.notEmployedDeduction), ytd ? formatRs(ytd.prorata) : "-"]);
  for (const d of r.deductions) ded.push([d.label, formatRs(d.amount), ytd ? formatRs(ytd.deductions[d.key] ?? 0) : "-"]);

  const n = Math.max(earn.length, ded.length, 1);
  const body: string[][] = [];
  for (let i = 0; i < n; i++) {
    body.push([earn[i]?.[0] || "", earn[i]?.[1] || "", earn[i]?.[2] || "", ded[i]?.[0] || "", ded[i]?.[1] || "", ded[i]?.[2] || ""]);
  }
  body.push(["Gross Earnings", formatRs(r.grossEarnings), ytd ? formatRs(ytd.gross) : "-", "Total Deductions", formatRs(r.totalDeductions), ytd ? formatRs(ytd.totalDeductions) : "-"]);
  autoTable(doc, {
    startY: lastY(doc) + 5,
    theme: "grid",
    head: [["Earnings", "Current (Rs.)", ytd ? `YTD ${ytd.fiscalYear} (Rs.)` : "YTD (Rs.)", "Deductions", "Current (Rs.)", ytd ? `YTD ${ytd.fiscalYear} (Rs.)` : "YTD (Rs.)"]],
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8.5, halign: "center" },
    styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [200, 205, 215], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 43 }, 1: { halign: "right", cellWidth: 24 }, 2: { halign: "right", cellWidth: 24 },
      3: { cellWidth: 43 }, 4: { halign: "right", cellWidth: 24 }, 5: { halign: "right", cellWidth: 24 },
    },
    body,
    margin: { left: L, right: 14 },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === body.length - 1) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = SOFT;
      }
    },
  });

  // ---------------------------------------------------------------- net pay
  let y = lastY(doc) + 5;
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  const netBottom = y + 19;
  doc.roundedRect(L, y, R - L, 19, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text("NET PAY  (Gross Earnings - Total Deductions)", L + 4, y + 7);
  doc.setFontSize(14);
  doc.text(`Rs. ${formatRs(r.netPay)}`, R - 4, y + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(rupeesInWords(r.netPay), L + 4, y + 14.5, { maxWidth: R - L - 8 });
  if (ytd) {
    doc.setTextColor(90, 90, 90);
    doc.text(`Year-to-date net pay (${ytd.fiscalYear}, ${ytd.months} month${ytd.months === 1 ? "" : "s"}): Rs. ${formatRs(ytd.net)}`, R - 4, y + 14.5, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  // ------------------------------------------- attendance + leave summary
  const c = r.counts;
  const att: string[][] = [
    ["Days in month", String(r.daysInMonth)],
    ["Days worked", String(c.present + c.incomplete)],
    ["Weekly offs", String(c["weekly-off"])],
    ["Company holidays", String(c.holiday)],
    ["Paid leave", String(c["paid-leave"] + c["decided-paid"])],
    ["Loss of pay days", String(r.lopDays)],
    ...(r.notEmployedDays ? [["Not employed", String(r.notEmployedDays)]] : []),
    ["Payable days", String(r.payableDays)],
  ];
  const lv = r.leave;
  const leaveRows: string[][] = lv
    ? [
        ["Opening balance", String(lv.opening)],
        ["Accrued (year to date)", String(lv.accruedToDate)],
        ["Availed (year to date)", String(lv.usedYearToDate)],
        ["Availed this month", String(lv.usedThisMonth)],
        ["Closing balance", String(lv.available)],
      ]
    : [];
  y = netBottom + 5; // below the net-pay box (autoTable's own last position is the table above it)
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Attendance summary", "Days"]],
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 1.3, lineColor: [200, 205, 215], lineWidth: 0.2 },
    columnStyles: { 0: { cellWidth: 58 }, 1: { halign: "right", cellWidth: 25 } },
    body: att,
    margin: { left: L, right: W - L - 83 },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === att.length - 1) d.cell.styles.fontStyle = "bold";
    },
  });
  const attEnd = lastY(doc);
  if (leaveRows.length) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [[`Leave summary (${lv!.leaveYear})`, "Days"]],
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 1.3, lineColor: [200, 205, 215], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 58 }, 1: { halign: "right", cellWidth: 25 } },
      body: leaveRows,
      margin: { left: L + 99, right: 14 },
      didParseCell: (d) => {
        if (d.section === "body" && d.row.index === leaveRows.length - 1) d.cell.styles.fontStyle = "bold";
      },
    });
  }
  y = Math.max(attEnd, leaveRows.length ? lastY(doc) : 0) + 6;

  // ------------------------------------------------------------------ notes
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const basis = ["Basis of calculation:", ...meta.policyLines.map((p) => `- ${p}`)];
  doc.text(basis, L, y, { maxWidth: R - L });
  y += basis.length * 3.2 + 3;
  doc.text(`Payslip ${meta.payslipId} - revision ${meta.revision} - issued ${meta.approvedAtIso.slice(0, 10)}`, L, y);
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.2);
  doc.line(L, 280, R, 280);
  doc.text("This is a computer-generated payslip and does not require a signature. Please keep it confidential.", W / 2, 285, { align: "center" });

  return new Uint8Array(doc.output("arraybuffer"));
}
