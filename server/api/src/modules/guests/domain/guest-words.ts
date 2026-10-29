/**
 * Places and files in words (P5). Pure.
 */
import { tidyPlaceName } from '@injishi/contracts';

/** Names of a place from the village up; any may be missing. */
export interface PlaceNames {
  villageName: string | null;
  cellName: string | null;
  sectorName: string | null;
  districtName: string | null;
}

/** `Urugwiro village, Kamatamu cell, Kacyiru sector, Gasabo`: the levels known, each once. */
export function placeWords(p: PlaceNames): string {
  const parts = [
    p.villageName ? `${tidyPlaceName(p.villageName)} village` : null,
    p.cellName ? `${tidyPlaceName(p.cellName)} cell` : null,
    p.sectorName ? `${tidyPlaceName(p.sectorName)} sector` : null,
    p.districtName ? tidyPlaceName(p.districtName) : null,
  ].filter((x): x is string => Boolean(x));
  return parts.join(', ');
}

/**
 * A home's address: the street line first, then the village up to the
 * district, each place named once (a street line that repeats a place name
 * drops the repeat).
 */
export function addressWords(street: string | null, p: PlaceNames): string {
  const names = [p.villageName, p.cellName, p.sectorName, p.districtName]
    .filter((x): x is string => Boolean(x))
    .map(tidyPlaceName);
  const known = new Set(names.map((n) => n.toLowerCase()));
  const streetParts = (street ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !known.has(s.toLowerCase()));
  const place = placeWords(p);
  return [...streetParts, ...(place ? [place] : [])].join(', ') || 'No address on record';
}

/** One CSV cell: quoted when it holds a comma, quote or line break; a leading = + - @ is neutralised. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let v = String(value);
  if (/^[=+\-@]/.test(v) && typeof value === 'string') v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Rows to CSV with CRLF line ends, the header first. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
