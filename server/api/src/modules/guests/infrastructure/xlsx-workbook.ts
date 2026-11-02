import ExcelJS from 'exceljs';

import type { CellKind, CellValue, Sheet, Workbook } from '../domain/guest-export';

/**
 * A workbook as a real .xlsx (P5, 2026-11-02), with ExcelJS: a Summary sheet first (title, who, filters, then
 * the counts), then each data sheet with its header row bold, frozen and filterable, and columns fitted to
 * what they hold.
 *
 * Phones and ID numbers are written as text cells in a text format, so Excel shows `+250788123456` as it is:
 * no apostrophe, no formula, no number in scientific notation. A CSV needs a guard character for that; a
 * typed cell does not, and a string is never read as a formula. Days are real date cells.
 */

const MONTH_DAY = 'd mmm yyyy';
const DAY_TIME = 'd mmm yyyy hh:mm';
const HEADER_FILL = 'FFF3F4F6';
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;

/** `2026-11-02` as the Excel day it names. */
function dayCell(iso: string): Date | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : iso;
}

/** An instant as the Kigali wall clock: Excel has no time zones, and the reader is in Kigali. */
function timeCell(iso: string): Date | string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t + KIGALI_OFFSET_MS);
}

function cellOf(value: CellValue, kind: CellKind): ExcelJS.CellValue {
  if (value === null || value === '') return null;
  if (kind === 'date' && typeof value === 'string') return dayCell(value);
  if (kind === 'datetime' && typeof value === 'string') return timeCell(value);
  if (kind === 'int') return typeof value === 'number' ? value : Number(value);
  return String(value);
}

const FORMAT: Record<CellKind, string | undefined> = { text: '@', date: MONTH_DAY, datetime: DAY_TIME, int: '0' };

/** How wide a value reads, in characters. */
function widthOf(value: CellValue, kind: CellKind): number {
  if (value === null) return 0;
  if (kind === 'date') return 11;
  if (kind === 'datetime') return 17;
  return String(value).length;
}

function addDataSheet(book: ExcelJS.Workbook, sheet: Sheet): void {
  const ws = book.addWorksheet(sheet.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = sheet.columns.map((c, i) => {
    const longest = Math.max(c.header.length + 3, ...sheet.rows.map((r) => widthOf(r[i] ?? null, c.kind)));
    return { key: c.key, width: Math.min(48, Math.max(8, longest + 2)), style: { numFmt: FORMAT[c.kind] } };
  });
  const header = ws.getRow(1);
  sheet.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.numFmt = 'General';
  });
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
  });
  for (const values of sheet.rows) {
    const row = ws.addRow(values.map((v, i) => cellOf(v, sheet.columns[i]?.kind ?? 'text')));
    sheet.columns.forEach((c, i) => {
      const fmt = FORMAT[c.kind];
      if (fmt) row.getCell(i + 1).numFmt = fmt;
    });
  }
  if (sheet.columns.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rows.length + 1), column: sheet.columns.length } };
  }
}

function addSummarySheet(book: ExcelJS.Workbook, wb: Workbook): void {
  const ws = book.addWorksheet('Summary');
  const wide = wb.summary.some((s) => (s.head?.length ?? 0) > 2);
  ws.columns = wide ? [{ width: 40 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }] : [{ width: 40 }, { width: 60 }];
  const title = ws.addRow([wb.title]);
  title.font = { bold: true, size: 14 };
  for (const [label, value] of wb.meta) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { color: { argb: 'FF6B7280' } };
    if (wide) ws.mergeCells(row.number, 2, row.number, 5);
  }
  for (const section of wb.summary) {
    ws.addRow([]);
    const head = ws.addRow(section.head ? [section.title, ...section.head.slice(1)] : [section.title]);
    head.font = { bold: true };
    for (const line of section.rows) {
      const row = ws.addRow(line);
      if (!section.head) row.getCell(2).alignment = { horizontal: 'left' };
    }
  }
}

/** The workbook as .xlsx bytes. */
export async function writeXlsx(wb: Workbook): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = 'Injishi';
  book.created = new Date();
  book.title = wb.title;
  addSummarySheet(book, wb);
  for (const sheet of wb.sheets) addDataSheet(book, sheet);
  const bytes = await book.xlsx.writeBuffer();
  return Buffer.from(bytes as ArrayBuffer);
}
