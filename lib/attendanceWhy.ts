// "Why is this person's attendance 100% — and why is someone else's 0%?"
//
// Read-only: turns an employee's month report into plain-language reasons by
// looking at WHAT the counted days are made of (real punches, "Present" set
// without any punch, "Absent" placeholders, days with no record at all…) and
// WHERE those records came from. It changes nothing.

import type { EmployeeReport, ReportDay } from "./attendanceReport";

export type Why = {
  uid: string;
  name: string;
  employeeId: string;
  percentage: number | null;
  expectedDays: number;
  attendedDays: number;
  // what the counted days are made of
  presentWithPunch: number;
  presentWithoutPunch: number;
  absentAuto: number; // "Absent" written automatically for a missed day
  absentOther: number;
  noRecord: number;
  incomplete: number;
  other: number;
  duplicates: number;
  sources: { source: string; days: number }[]; // where the "Present" records came from
  verdict: "all-punched" | "no-punch-evidence" | "mixed-evidence" | "mostly-absent" | "mostly-no-record" | "no-working-days" | "ok";
  reasons: string[];
};

const sourceLabel = (r: ReportDay["record"]) => {
  const s = (r?.source || "").trim();
  if (!s) return "no source recorded (not a normal punch)";
  if (s.startsWith("Auto-marked")) return "auto-marked placeholder";
  return s;
};

export function explainEmployee(report: EmployeeReport): Why {
  const countable = report.days.filter((d) => !d.flags.includes("worked-on-off-day") || d.kind === "absent");
  let presentWithPunch = 0, presentWithoutPunch = 0, absentAuto = 0, absentOther = 0, noRecord = 0, incomplete = 0, other = 0, duplicates = 0;
  const sources = new Map<string, number>();

  for (const d of countable) {
    if (d.flags.includes("duplicate-records")) duplicates += 1;
    switch (d.kind) {
      case "present":
      case "late":
        if (d.record?.punchIn) presentWithPunch += 1;
        else {
          presentWithoutPunch += 1;
          const src = sourceLabel(d.record);
          sources.set(src, (sources.get(src) || 0) + 1);
        }
        break;
      case "absent":
        if (d.flags.includes("auto-marked")) absentAuto += 1;
        else absentOther += 1;
        break;
      case "no-record": noRecord += 1; break;
      case "incomplete": incomplete += 1; break;
      case "other": other += 1; break;
      default: break;
    }
  }

  const s = report.summary;
  const expected = s.expectedDays;
  const reasons: string[] = [];
  let verdict: Why["verdict"] = "ok";

  if (expected === 0) {
    verdict = "no-working-days";
    reasons.push("No working days to measure in this period (all weekly offs, holidays, leave or not started yet).");
  } else if (s.percentage === 100 && presentWithoutPunch > 0 && presentWithPunch === 0) {
    verdict = "no-punch-evidence";
    reasons.push(
      `100% because all ${expected} working day(s) are marked Present — but NONE of them has a punch-in/out time. ` +
        `The status was set without a punch (HR/admin or an import), so this is unverified, not proof of attendance.`
    );
  } else if (s.percentage === 100) {
    verdict = presentWithoutPunch > 0 ? "mixed-evidence" : "all-punched";
    reasons.push(
      presentWithoutPunch > 0
        ? `100%: ${presentWithPunch} day(s) have real punches and ${presentWithoutPunch} are marked Present with NO punch time.`
        : `100%: every working day has a real punch.`
    );
  } else {
    if (absentAuto > 0) reasons.push(`${absentAuto} day(s) are "Absent" placeholders created automatically for a day with no punch — they are not a person's actual absence decision.`);
    if (absentOther > 0) reasons.push(`${absentOther} day(s) are marked Absent (by HR/admin or by the late-punch rule).`);
    if (noRecord > 0) reasons.push(`${noRecord} working day(s) have NO record at all, so they were not marked Present (a missing record is never assumed Present).`);
    if (incomplete > 0) reasons.push(`${incomplete} day(s) have a punch-in but no punch-out (Incomplete) — not counted as Present until a punch-out is added.`);
    if (other > 0) reasons.push(`${other} day(s) carry another status that is not Present.`);
    if (presentWithoutPunch > 0) reasons.push(`${presentWithoutPunch} counted Present day(s) have no punch time.`);
    if (absentAuto + absentOther >= expected * 0.8) verdict = "mostly-absent";
    else if (noRecord >= expected * 0.8) verdict = "mostly-no-record";
    else verdict = presentWithoutPunch > 0 ? "mixed-evidence" : "ok";
  }
  if (duplicates > 0) reasons.push(`${duplicates} day(s) have more than one record; the one with a real punch (else the latest) is used.`);

  return {
    uid: report.employee.uid,
    name: report.employee.name,
    employeeId: report.employee.employeeId || "",
    percentage: s.percentage,
    expectedDays: expected,
    attendedDays: s.attendedDays,
    presentWithPunch, presentWithoutPunch, absentAuto, absentOther, noRecord, incomplete, other, duplicates,
    sources: [...sources].map(([source, days]) => ({ source, days })).sort((a, b) => b.days - a.days),
    verdict,
    reasons,
  };
}

export function explainAll(reports: EmployeeReport[]): Why[] {
  return reports.map(explainEmployee);
}

// One-line summary shown above the table.
export function summarizeWhy(list: Why[]) {
  const withData = list.filter((w) => w.expectedDays > 0);
  return {
    hundredWithoutPunch: withData.filter((w) => w.verdict === "no-punch-evidence").length,
    hundredPunched: withData.filter((w) => w.verdict === "all-punched").length,
    mostlyAbsent: withData.filter((w) => w.verdict === "mostly-absent").length,
    mostlyNoRecord: withData.filter((w) => w.verdict === "mostly-no-record").length,
    total: withData.length,
  };
}
