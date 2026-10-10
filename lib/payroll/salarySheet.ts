// Salary-sheet import: pure validation + diff. The browser reads the .xlsx /
// .csv file into plain rows; the SERVER runs this same code on those rows
// both for the preview and again at apply time, so the preview can never
// drift from what is written.

import type { SalaryComponent } from "./policy";

export const MAX_SHEET_ROWS = 2000;
export const MAX_SHEET_COLUMNS = 60;
export const MAX_AMOUNT = 100_000_000;

export type SheetRow = Record<string, unknown>;

export type EmployeeRef = { uid: string; employeeId: string; name: string };
export type StructureRef = { id: string; employeeId: string; values: Record<string, number> };

export type Message = { severity: "error" | "warning" | "info"; text: string };

export type Change = { key: string; label: string; old: number | null; new: number };

export type RowResult = {
  rowNumber: number; // 1-based spreadsheet row (header = row 1)
  employeeId: string;
  uid: string | null;
  employeeName: string;
  structureId: string | null;
  isNew: boolean;
  status: "ok" | "warning" | "error" | "unchanged";
  messages: Message[];
  proposed: Record<string, number>;
  changes: Change[];
};

export type ColumnReport = {
  recognized: { header: string; key: string }[];
  informational: string[]; // name / department / designation — read, never written
  unexpected: string[]; // not understood — ignored
  problems: string[]; // sheet-level errors (no employee-id column, duplicate columns…)
};

export type SheetPreview = {
  columns: ColumnReport;
  rows: RowResult[];
  summary: { total: number; ok: number; warning: number; error: number; unchanged: number; applicable: number };
  digest: string; // canonical string of what would be written; the server hashes it
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const ID_HEADERS = new Set(["employeeid", "empid", "employeecode", "empcode", "employeeno", "employeenumber"]);
const INFO_HEADERS: Record<string, string> = { employeename: "name", name: "name", department: "department", designation: "designation" };

export type Amount = { kind: "blank" } | { kind: "ok"; value: number } | { kind: "invalid"; reason: string };

// Accepts 12000, "12000", "12,000.50", "₹ 12,000", "Rs. 12000". Rejects text,
// negatives, more than two decimals, absurd sizes and non-finite numbers.
export function parseAmount(cell: unknown): Amount {
  if (cell === null || cell === undefined) return { kind: "blank" };
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return { kind: "invalid", reason: "not a number" };
    return checkAmount(cell);
  }
  if (typeof cell === "boolean" || typeof cell === "object") return { kind: "invalid", reason: "not a number" };
  let s = String(cell).trim();
  if (s === "" || s === "-") return { kind: "blank" };
  s = s.replace(/^(₹|rs\.?|inr)\s*/i, "").replace(/,/g, "").replace(/\s+/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { kind: "invalid", reason: `"${String(cell).trim().slice(0, 30)}" is not a valid amount` };
  return checkAmount(Number(s));
}

function checkAmount(n: number): Amount {
  if (n < 0) return { kind: "invalid", reason: "negative amounts are not allowed" };
  if (n > MAX_AMOUNT) return { kind: "invalid", reason: "amount is unrealistically large" };
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { kind: "invalid", reason: "more than 2 decimal places" };
  return { kind: "ok", value: Math.round(n * 100) / 100 };
}

export function normalizeEmployeeId(cell: unknown): string {
  if (typeof cell === "number" && Number.isFinite(cell)) return String(cell);
  return String(cell ?? "").trim().replace(/\s+/g, " ");
}

export function buildColumns(headers: string[], components: SalaryComponent[]): { report: ColumnReport; idHeader: string | null; map: Map<string, string>; infoHeaders: Map<string, string> } {
  const report: ColumnReport = { recognized: [], informational: [], unexpected: [], problems: [] };
  const map = new Map<string, string>(); // header -> component key
  const infoHeaders = new Map<string, string>(); // header -> name|department|designation
  const byAlias = new Map<string, string>();
  for (const c of components) {
    byAlias.set(norm(c.key), c.key);
    byAlias.set(norm(c.label), c.key);
  }
  let idHeader: string | null = null;
  const seenKey = new Map<string, string>();
  for (const h of headers) {
    const n = norm(h);
    if (!n) continue;
    if (ID_HEADERS.has(n)) {
      if (idHeader && idHeader !== h) report.problems.push(`More than one Employee ID column ("${idHeader}" and "${h}").`);
      else idHeader = h;
    } else if (INFO_HEADERS[n]) {
      infoHeaders.set(h, INFO_HEADERS[n]);
      report.informational.push(h);
    } else if (byAlias.has(n)) {
      const key = byAlias.get(n)!;
      if (seenKey.has(key)) report.problems.push(`Columns "${seenKey.get(key)}" and "${h}" are both "${key}".`);
      else {
        seenKey.set(key, h);
        map.set(h, key);
        report.recognized.push({ header: h, key });
      }
    } else {
      report.unexpected.push(h);
    }
  }
  if (!idHeader) report.problems.push('There is no Employee ID column. Rows are matched on the employee ID, never on the name.');
  if (!Array.from(map.values()).includes("basicSalary")) report.problems.push("There is no Basic Salary column.");
  return { report, idHeader, map, infoHeaders };
}

export function previewSheet(input: {
  rows: SheetRow[];
  components: SalaryComponent[];
  employees: EmployeeRef[];
  structures: StructureRef[];
}): SheetPreview {
  const { rows, components, employees, structures } = input;
  const label = new Map(components.map((c) => [c.key, c.label]));
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const { report, idHeader, map, infoHeaders } = buildColumns(headers, components);

  const empById = new Map<string, EmployeeRef[]>();
  for (const e of employees) {
    const k = e.employeeId.trim().toLowerCase();
    if (!k) continue;
    empById.set(k, [...(empById.get(k) || []), e]);
  }
  const structByEmp = new Map<string, StructureRef[]>();
  for (const s of structures) {
    const k = s.employeeId.trim().toLowerCase();
    structByEmp.set(k, [...(structByEmp.get(k) || []), s]);
  }

  // duplicate IDs inside the file
  const seen = new Map<string, number[]>();
  const results: RowResult[] = [];
  rows.forEach((row, i) => {
    const rowNumber = i + 2;
    const empty = Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === "");
    if (empty) return;
    const id = idHeader ? normalizeEmployeeId(row[idHeader]) : "";
    const key = id.toLowerCase();
    if (key) seen.set(key, [...(seen.get(key) || []), rowNumber]);

    const messages: Message[] = [];
    const err = (text: string) => messages.push({ severity: "error", text });
    const warn = (text: string) => messages.push({ severity: "warning", text });
    const result: RowResult = {
      rowNumber, employeeId: id, uid: null, employeeName: "", structureId: null, isNew: false,
      status: "ok", messages, proposed: {}, changes: [],
    };
    results.push(result);

    if (report.problems.length) { err("The sheet has problems (see the column report) — no rows can be applied."); return; }
    if (!id) { err("Employee ID is missing."); return; }

    const matches = empById.get(key) || [];
    if (matches.length === 0) { err(`Employee ID "${id}" does not match any employee.`); return; }
    if (matches.length > 1) { err(`Employee ID "${id}" is shared by ${matches.length} employees in the system — fix the employee records first.`); return; }
    const employee = matches[0];
    result.uid = employee.uid;
    result.employeeName = employee.name;

    const existing = structByEmp.get(key) || [];
    if (existing.length > 1) { err(`More than one salary structure exists for "${id}" — clean this up before importing.`); return; }
    const current = existing[0] || null;
    result.structureId = current ? current.id : null;
    result.isNew = !current;

    for (const [header, kind] of infoHeaders) {
      if (kind === "name") {
        const given = String(row[header] ?? "").trim();
        if (given && given.toLowerCase() !== employee.name.trim().toLowerCase()) {
          warn(`Name in the sheet ("${given}") differs from the system ("${employee.name}"). Matched on ID ${id}.`);
        }
      }
    }

    const proposed: Record<string, number> = { ...(current ? current.values : {}) };
    for (const [header, comp] of map) {
      const a = parseAmount(row[header]);
      const old = current ? current.values[comp] ?? 0 : 0;
      if (a.kind === "invalid") { err(`${label.get(comp) || comp}: ${a.reason}.`); continue; }
      if (a.kind === "blank") {
        if (comp === "basicSalary" && !current) err("Basic Salary is missing.");
        else if (current) warn(`${label.get(comp) || comp} is blank — the existing value (${old}) is kept.`);
        else warn(`${label.get(comp) || comp} is blank — set to 0.`);
        if (!current && comp !== "basicSalary") proposed[comp] = 0;
        continue;
      }
      proposed[comp] = a.value;
    }
    if (!(Number(proposed.basicSalary) > 0) && !messages.some((m) => m.severity === "error")) err("Basic Salary must be greater than 0.");

    const changes: Change[] = [];
    for (const comp of map.values()) {
      const oldVal = current ? (current.values[comp] ?? 0) : null;
      const newVal = proposed[comp] ?? 0;
      if (oldVal === null ? true : Math.round(oldVal * 100) !== Math.round(newVal * 100)) {
        if (oldVal !== null || newVal !== 0 || comp === "basicSalary") changes.push({ key: comp, label: label.get(comp) || comp, old: oldVal, new: newVal });
      }
    }
    const oldBasic = current?.values.basicSalary;
    if (oldBasic && proposed.basicSalary && Math.abs(proposed.basicSalary - oldBasic) / oldBasic > 0.5) {
      warn(`Basic Salary changes by more than 50% (${oldBasic} → ${proposed.basicSalary}) — please double-check.`);
    }
    result.proposed = proposed;
    result.changes = changes;
  });

  // duplicates make EVERY occurrence an error (never "last one wins")
  for (const [key, rowNumbers] of seen) {
    if (rowNumbers.length > 1) {
      for (const r of results) {
        if (r.employeeId.toLowerCase() === key) {
          r.messages.push({ severity: "error", text: `Employee ID "${r.employeeId}" appears ${rowNumbers.length} times in the file (rows ${rowNumbers.join(", ")}).` });
        }
      }
    }
  }

  for (const r of results) {
    const hasErr = r.messages.some((m) => m.severity === "error");
    const hasWarn = r.messages.some((m) => m.severity === "warning");
    r.status = hasErr ? "error" : r.changes.length === 0 && !r.isNew ? "unchanged" : hasWarn ? "warning" : "ok";
  }

  const count = (s: RowResult["status"]) => results.filter((r) => r.status === s).length;
  const applicable = results.filter((r) => (r.status === "ok" || r.status === "warning") && r.uid).sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  return {
    columns: report,
    rows: results,
    summary: {
      total: results.length, ok: count("ok"), warning: count("warning"), error: count("error"),
      unchanged: count("unchanged"), applicable: applicable.length,
    },
    digest: JSON.stringify(applicable.map((r) => [r.employeeId.toLowerCase(), r.structureId, Object.entries(r.proposed).sort(([a], [b]) => a.localeCompare(b))])),
  };
}

// Header names of a blank template the user can download.
export function templateHeaders(components: SalaryComponent[]): string[] {
  return ["Employee_ID", "Employee_Name", ...components.map((c) => c.label)];
}
