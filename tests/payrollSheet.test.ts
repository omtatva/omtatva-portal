// Run with:  npm run test:payroll
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { readSheetFile, SheetFileError } from "../lib/payroll/readSheetFile";
import { parseAmount, previewSheet, normalizeEmployeeId, type EmployeeRef, type StructureRef } from "../lib/payroll/salarySheet";
import { DEFAULT_COMPONENTS } from "../lib/payroll/policy";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { console.error("FAIL", name, "\n  ", (e as Error).message); process.exitCode = 1; }
};

const employees: EmployeeRef[] = [
  { uid: "u1", employeeId: "E001", name: "Asha Rao" },
  { uid: "u2", employeeId: "E002", name: "Ravi Kumar" },
  { uid: "u3", employeeId: "E003", name: "Meera Shah" },
  { uid: "u4a", employeeId: "E004", name: "Twin One" },
  { uid: "u4b", employeeId: "E004", name: "Twin Two" },
];
const structures: StructureRef[] = [
  { id: "s1", employeeId: "E001", values: { basicSalary: 30000, hra: 10000, pf: 1800 } },
  { id: "s2", employeeId: "E002", values: { basicSalary: 20000 } },
];
const run = (rows: Record<string, unknown>[]) => previewSheet({ rows, components: DEFAULT_COMPONENTS, employees, structures });
const row = (o: Record<string, unknown>) => ({ Employee_ID: "E001", Employee_Name: "Asha Rao", Basic_Salary: 30000, HRA: 10000, PF: 1800, ...o });

test("amounts: numbers, formatted text, blanks; rejects text/negative/3 decimals/huge", () => {
  assert.deepEqual(parseAmount(12000), { kind: "ok", value: 12000 });
  assert.deepEqual(parseAmount("12,000.50"), { kind: "ok", value: 12000.5 });
  assert.deepEqual(parseAmount("₹ 12,000"), { kind: "ok", value: 12000 });
  assert.deepEqual(parseAmount("Rs. 500"), { kind: "ok", value: 500 });
  assert.deepEqual(parseAmount(""), { kind: "blank" });
  assert.deepEqual(parseAmount(null), { kind: "blank" });
  for (const bad of ["abc", "-5", -5, "12.345", "1e9", "NaN", NaN, Infinity, 1e9, {} as never, true as never]) {
    assert.equal(parseAmount(bad).kind, "invalid", String(bad));
  }
  assert.equal(parseAmount(0).kind, "ok");
});
test("employee id: numeric cells and padding are normalised, never guessed from a name", () => {
  assert.equal(normalizeEmployeeId(1001), "1001");
  assert.equal(normalizeEmployeeId("  E 001 "), "E 001");
});

test("a changed salary shows OLD and PROPOSED values per component", () => {
  const p = run([row({ Basic_Salary: 35000, HRA: 12000 })]);
  const r = p.rows[0];
  assert.equal(r.status, "ok");
  assert.deepEqual(r.changes.map((c) => [c.key, c.old, c.new]), [["basicSalary", 30000, 35000], ["hra", 10000, 12000]]);
  assert.equal(r.structureId, "s1");
  assert.equal(p.summary.applicable, 1);
});
test("an identical row is 'unchanged' and is not written", () => {
  const p = run([row({})]);
  assert.equal(p.rows[0].status, "unchanged");
  assert.equal(p.summary.applicable, 0);
});
test("a new employee (no structure yet) is created, with blank components set to 0 and a warning", () => {
  const p = run([{ Employee_ID: "E003", Basic_Salary: 25000, HRA: "" }]);
  const r = p.rows[0];
  assert.equal(r.isNew, true);
  assert.equal(r.status, "warning");
  assert.equal(r.proposed.hra, 0);
  assert.equal(r.proposed.basicSalary, 25000);
});
test("a blank cell never silently becomes 0 for an existing structure — the old value is kept", () => {
  const p = run([row({ HRA: "", Basic_Salary: 31000 })]);
  assert.equal(p.rows[0].proposed.hra, 10000);
  assert.ok(p.rows[0].messages.some((m) => m.text.includes("kept")));
});
test("unknown employee ID, missing ID, invalid amount, zero basic: all errors, none applicable", () => {
  const p = run([
    row({ Employee_ID: "NOPE" }),
    row({ Employee_ID: "" }),
    row({ Employee_ID: "E002", Basic_Salary: "twenty" }),
    row({ Employee_ID: "E002", Basic_Salary: 0 }),
    { Employee_ID: "E003", Basic_Salary: "" },
  ]);
  assert.deepEqual(p.rows.map((r) => r.status), ["error", "error", "error", "error", "error"]);
  assert.equal(p.summary.applicable, 0);
});
test("duplicate employee IDs in the file: EVERY occurrence is an error (no 'last one wins')", () => {
  const p = run([row({ Basic_Salary: 31000 }), row({ Basic_Salary: 32000 }), row({ Employee_ID: "E002", Basic_Salary: 21000 })]);
  assert.equal(p.rows[0].status, "error");
  assert.equal(p.rows[1].status, "error");
  assert.notEqual(p.rows[2].status, "error");
  assert.equal(p.summary.applicable, 1);
});
test("an ID shared by two employees in the system is refused", () => {
  const p = run([{ Employee_ID: "E004", Basic_Salary: 20000 }]);
  assert.equal(p.rows[0].status, "error");
});
test("matching is by ID, not name: a different name is only a warning", () => {
  const p = run([row({ Employee_Name: "Someone Else", Basic_Salary: 31000 })]);
  assert.equal(p.rows[0].uid, "u1");
  assert.equal(p.rows[0].status, "warning");
});
test("ID matching is case-insensitive and trims spaces", () => {
  assert.equal(run([row({ Employee_ID: " e001 ", Basic_Salary: 31000 })]).rows[0].uid, "u1");
});
test("unexpected columns are reported and ignored; missing ID/Basic columns block everything", () => {
  const p = run([row({ Favourite_Colour: "blue", Basic_Salary: 31000 })]);
  assert.deepEqual(p.columns.unexpected, ["Favourite_Colour"]);
  assert.equal(p.rows[0].status, "ok");
  const noId = run([{ Name: "Asha", Basic_Salary: 1 }]);
  assert.ok(noId.columns.problems.some((x) => x.includes("Employee ID")));
  assert.equal(noId.rows[0].status, "error");
  const noBasic = run([{ Employee_ID: "E001", HRA: 5 }]);
  assert.ok(noBasic.columns.problems.some((x) => x.includes("Basic")));
});
test("configurable components: a custom 'Bonus' column and a column label both resolve", () => {
  const comps = [...DEFAULT_COMPONENTS, { key: "shiftAllowance", label: "Shift Allowance", type: "earning" as const }];
  const p = previewSheet({ rows: [{ "Employee ID": "E001", "Basic Salary": 30000, "Shift Allowance": 1500, Bonus: 2000 }], components: comps, employees, structures });
  assert.equal(p.rows[0].proposed.shiftAllowance, 1500);
  assert.equal(p.rows[0].proposed.bonus, 2000);
  assert.deepEqual(p.columns.unexpected, []);
});
test("a very large basic change is warned about", () => {
  assert.ok(run([row({ Basic_Salary: 90000 })]).rows[0].messages.some((m) => m.text.includes("50%")));
});
test("the digest covers exactly the applicable rows (changes if a value changes)", () => {
  const a = run([row({ Basic_Salary: 31000 })]).digest;
  const b = run([row({ Basic_Salary: 31000 })]).digest;
  const c = run([row({ Basic_Salary: 31001 })]).digest;
  assert.equal(a, b);
  assert.notEqual(a, c);
});

// ------------------------------------------------- real .xlsx and .csv files
const toXlsx = (aoa: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Salary");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
const sample = [["Employee_ID", "Employee_Name", "Basic_Salary", "HRA"], ["E001", "Asha Rao", 35000, 12000], ["E002", "Ravi Kumar", 21000, ""]];

test(".xlsx file → rows → preview", () => {
  const rows = readSheetFile(toXlsx(sample), "salary.xlsx");
  assert.equal(rows.length, 2);
  const p = run(rows);
  assert.equal(p.rows[0].status, "ok");
  assert.equal(p.rows[0].proposed.basicSalary, 35000);
});
test(".csv file → rows → preview; IDs keep leading zeros as text", () => {
  const csv = "Employee_ID,Employee_Name,Basic_Salary,HRA\nE001,Asha Rao,\"35,000\",12000\n0042,Zero Pad,15000,0\n";
  const rows = readSheetFile(new TextEncoder().encode(csv), "salary.csv");
  assert.equal(rows[1].Employee_ID, "0042");
  const p = run(rows);
  assert.equal(p.rows[0].proposed.basicSalary, 35000);
  assert.equal(p.rows[1].status, "error"); // 0042 is not an employee
});
test("files: wrong type, empty, oversized, header-only, corrupt are all refused cleanly", () => {
  assert.throws(() => readSheetFile(new Uint8Array([1, 2, 3]), "x.txt"), SheetFileError);
  assert.throws(() => readSheetFile(new Uint8Array(0), "x.csv"), SheetFileError);
  assert.throws(() => readSheetFile(new Uint8Array(6 * 1024 * 1024), "x.xlsx"), SheetFileError);
  assert.throws(() => readSheetFile(new TextEncoder().encode("Employee_ID,Basic_Salary\n"), "x.csv"), SheetFileError);
  assert.throws(() => readSheetFile(new Uint8Array(Array.from({ length: 500 }, (_, i) => i % 251)), "x.xlsx"), SheetFileError);
});

console.log(`\n${passed} passed (salary sheet import)${process.exitCode ? " - with FAILURES" : ""}`);
