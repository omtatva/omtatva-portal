// Reads an uploaded .xlsx / .csv into plain rows (header row = keys). Runs in
// the browser; the server re-validates everything it is sent.

import * as XLSX from "xlsx";
import { MAX_SHEET_COLUMNS, MAX_SHEET_ROWS, type SheetRow } from "./salarySheet";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class SheetFileError extends Error {}

export function readSheetFile(data: ArrayBuffer | Uint8Array, fileName: string): SheetRow[] {
  const name = fileName.toLowerCase();
  if (!/\.(xlsx|csv)$/.test(name)) throw new SheetFileError("Only .xlsx and .csv files are supported.");
  const size = data instanceof ArrayBuffer ? data.byteLength : data.length;
  if (size > MAX_FILE_BYTES) throw new SheetFileError("The file is larger than 5 MB.");
  if (size === 0) throw new SheetFileError("The file is empty.");

  // Check the real content, not just the extension.
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (name.endsWith(".xlsx")) {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
      throw new SheetFileError("This is not a valid .xlsx file. Save it again as .xlsx or .csv.");
    }
  } else if (bytes.subarray(0, 2048).includes(0)) {
    throw new SheetFileError("This is not a valid .csv text file.");
  }

  let workbook: XLSX.WorkBook;
  try {
    // raw: true keeps CSV cells as text, so an ID like "0012" keeps its zeros.
    workbook = XLSX.read(data, { type: "array", raw: true, cellFormula: false, cellHTML: false });
  } catch {
    throw new SheetFileError("The file could not be read. Save it again as .xlsx or .csv.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new SheetFileError("The file has no sheet.");

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "", raw: true });
  if (rows.length === 0) throw new SheetFileError("The sheet has no data rows.");
  if (rows.length > MAX_SHEET_ROWS) throw new SheetFileError(`The sheet has more than ${MAX_SHEET_ROWS} rows.`);
  const columns = new Set(rows.flatMap((r) => Object.keys(r)));
  if (columns.size > MAX_SHEET_COLUMNS) throw new SheetFileError(`The sheet has more than ${MAX_SHEET_COLUMNS} columns.`);
  // Plain data only — drop anything that is not a string/number.
  return rows.map((r) => {
    const clean: SheetRow = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      clean[k] = typeof v === "number" || typeof v === "string" ? v : String(v ?? "");
    }
    return clean;
  });
}
