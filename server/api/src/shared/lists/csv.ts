/**
 * CSV for list exports (058-list-framework AC-LF7).
 *
 * RFC 4180 quoting, CRLF line ends, and a UTF-8 byte order mark so a
 * spreadsheet shows Kinyarwanda and French names correctly.
 *
 * **Formula injection.** A cell a spreadsheet would read as a formula (one that
 * starts with `=`, `+`, `-`, `@`, a tab or a carriage return) is prefixed with an
 * apostrophe. Staff names, notes and reasons are typed by people, and an export
 * opened by the owner must not run what one of them typed. Numbers are written
 * as numbers, so a negative amount is not prefixed.
 */

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  readonly header: string;
  readonly value: (row: T) => CsvValue;
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
