// Server-side spreadsheet parser. Handles .xlsx (via exceljs) and .csv (via
// papaparse). Returns headers + rows as plain objects keyed by the (trimmed)
// header text. Rejects files over MAX_FILE_BYTES or MAX_ROWS to bound work.

import ExcelJS from "exceljs";
import Papa from "papaparse";

export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_ROWS = 1000;

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  /** First N rows shipped separately for AI mapping (already redacted on the caller side). */
  sampleRows: Record<string, unknown>[];
};

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

function detectFormat(filename: string, mimeType: string | undefined): "xlsx" | "csv" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".csv")) return "csv";
  if (mimeType === "text/csv") return "csv";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  )
    return "xlsx";
  throw new ParseError(
    `Unsupported file type: ${filename}. Expected .xlsx or .csv.`,
  );
}

function normaliseHeader(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).replace(/\s+/g, " ").trim();
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const base = h || "(blank)";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  for (const v of Object.values(row)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    return false;
  }
  return true;
}

async function parseXlsx(buf: ArrayBuffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new ParseError("Spreadsheet has no sheets.");

  const rawHeaderRow = ws.getRow(1);
  const headers = uniqueHeaders(
    (rawHeaderRow.values as unknown[])
      // exceljs prefixes the array with a leading undefined (1-indexed cells)
      .slice(1)
      .map((v) => normaliseHeader(v)),
  );
  if (headers.length === 0) throw new ParseError("Header row is empty.");

  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    const values = (row.values as unknown[]).slice(1);
    for (let i = 0; i < headers.length; i++) {
      const v = values[i];
      obj[headers[i]] = normaliseCell(v);
    }
    if (!isEmptyRow(obj)) rows.push(obj);
  });

  if (rows.length > MAX_ROWS) {
    throw new ParseError(
      `Spreadsheet has ${rows.length} rows; max ${MAX_ROWS} per import.`,
    );
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    sampleRows: rows.slice(0, 5),
  };
}

function parseCsv(text: string): ParsedSheet {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => normaliseHeader(h),
  });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new ParseError(`CSV parse failure at row ${first.row}: ${first.message}`);
  }
  const headers = uniqueHeaders(parsed.meta.fields ?? []);
  const rows = (parsed.data as Record<string, unknown>[])
    .map((r) => {
      const cleaned: Record<string, unknown> = {};
      for (const h of headers) cleaned[h] = normaliseCell(r[h]);
      return cleaned;
    })
    .filter((r) => !isEmptyRow(r));

  if (rows.length > MAX_ROWS) {
    throw new ParseError(
      `CSV has ${rows.length} rows; max ${MAX_ROWS} per import.`,
    );
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    sampleRows: rows.slice(0, 5),
  };
}

// Excel dates come through as Date objects, formulas as { result }, etc.
// Flatten everything to JSON-safe primitives.
function normaliseCell(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) {
    // YYYY-MM-DD if midnight UTC; else ISO timestamp.
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof v === "object" && v !== null) {
    // exceljs rich text / formulas / hyperlinks
    const anyV = v as Record<string, unknown>;
    if (typeof anyV.text === "string") return anyV.text;
    if (typeof anyV.result === "string" || typeof anyV.result === "number")
      return anyV.result;
    if (Array.isArray(anyV.richText)) {
      return (anyV.richText as { text: string }[]).map((r) => r.text).join("");
    }
    return String(v);
  }
  if (typeof v === "string") return v.trim();
  return v;
}

export async function parseSpreadsheet(
  filename: string,
  mimeType: string | undefined,
  buffer: ArrayBuffer,
): Promise<ParsedSheet> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new ParseError(
      `File is ${Math.round(buffer.byteLength / 1024)} KB; max ${MAX_FILE_BYTES / 1024} KB.`,
    );
  }
  const format = detectFormat(filename, mimeType);
  if (format === "csv") {
    const decoder = new TextDecoder("utf-8");
    return parseCsv(decoder.decode(buffer));
  }
  return parseXlsx(buffer);
}
