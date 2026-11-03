import { deflateRawSync } from 'node:zlib';

import type { CellKind, CellValue, Sheet, Workbook } from '../domain/guest-export';

/**
 * A workbook as a real .xlsx (P5, 2026-11-02): a Summary sheet first (title, who, filters, then the counts),
 * then each data sheet with its header row bold, frozen and filterable, and columns fitted to what they hold.
 *
 * Phones and ID numbers are written as text cells in the text format (`@`), so Excel shows `+250788123456`
 * as it is: no apostrophe, no formula, no number in scientific notation. A CSV needs a guard character for
 * that; a typed cell does not, and a text cell is never read as a formula. Days are real date cells.
 *
 * Written here rather than with a spreadsheet library: an .xlsx is a zip of a few XML parts, and this is the
 * small part of the format these files use (inline strings, numbers, five styles, a frozen pane, a filter),
 * with no dependency to keep up to date. Node's zlib deflates; the zip around it is below.
 */

// --- Cells -------------------------------------------------------------------------------------

/** The styles of `styles.xml`, by index. */
const STYLE = { plain: 0, text: 1, date: 2, datetime: 3, int: 4, header: 5, title: 6, muted: 7, bold: 8, number: 9 } as const;
const KIND_STYLE: Record<CellKind, number> = { text: STYLE.text, date: STYLE.date, datetime: STYLE.datetime, int: STYLE.int };

const DAY_MS = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;

/** `2026-11-02` as the Excel day number, or null when it is not a day. */
export function excelDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EXCEL_EPOCH) / DAY_MS : null;
}

/** An instant as the Excel date and time on the Kigali clock: Excel has no time zones, the reader is in Kigali. */
export function excelKigaliTime(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.round(((t + KIGALI_OFFSET_MS - EXCEL_EPOCH) / DAY_MS) * 1e8) / 1e8;
}

function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Characters XML 1.0 cannot hold are dropped.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** A1-style column letters: 1 is A, 27 is AA. */
export function columnName(n: number): string {
  let s = '';
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function cell(ref: string, value: CellValue, kind: CellKind | 'label', style?: number): string {
  if (value === null || value === '') return '';
  if (kind === 'date' || kind === 'datetime') {
    const n = typeof value === 'string' ? (kind === 'date' ? excelDay(value) : excelKigaliTime(value)) : value;
    if (n !== null) return `<c r="${ref}" s="${style ?? KIND_STYLE[kind]}"><v>${n}</v></c>`;
  }
  if (typeof value === 'number' && kind !== 'text') {
    return `<c r="${ref}" s="${style ?? (kind === 'int' ? STYLE.int : STYLE.number)}"><v>${value}</v></c>`;
  }
  const s = style ?? (kind === 'label' ? STYLE.plain : STYLE.text);
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
}

function row(n: number, cells: string[], height?: number): string {
  return `<row r="${n}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells.join('')}</row>`;
}

/** How wide a value reads, in characters. */
function widthOf(value: CellValue, kind: CellKind): number {
  if (value === null) return 0;
  if (kind === 'date') return 11;
  if (kind === 'datetime') return 17;
  return String(value).length;
}

function sheetXml(opts: { rows: string[]; widths: number[]; frozen: boolean; filter: string | null }): string {
  const cols = opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const pane = opts.frozen
    ? '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>'
    : '<sheetView workbookViewId="0"/>';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetViews>${pane}</sheetViews><sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${opts.rows.join('')}</sheetData>` +
    (opts.filter ? `<autoFilter ref="${opts.filter}"/>` : '') +
    '</worksheet>'
  );
}

function dataSheet(sheet: Sheet): { xml: string; filter: string | null } {
  const widths = sheet.columns.map((c, i) => {
    const longest = Math.max(c.header.length + 3, ...sheet.rows.map((r) => widthOf(r[i] ?? null, c.kind)));
    return Math.min(48, Math.max(8, longest + 2));
  });
  const rows = [
    row(
      1,
      sheet.columns.map((c, i) => cell(`${columnName(i + 1)}1`, c.header, 'label', STYLE.header)),
      20,
    ),
    ...sheet.rows.map((values, r) =>
      row(
        r + 2,
        values.map((v, i) => cell(`${columnName(i + 1)}${r + 2}`, v, sheet.columns[i]?.kind ?? 'text')),
      ),
    ),
  ];
  const filter = sheet.columns.length ? `A1:${columnName(sheet.columns.length)}${Math.max(1, sheet.rows.length + 1)}` : null;
  return { xml: sheetXml({ rows, widths, frozen: true, filter }), filter };
}

function summarySheet(wb: Workbook): string {
  const rows: string[] = [];
  let n = 1;
  const add = (cells: string[]): void => {
    rows.push(row(n, cells));
    n += 1;
  };
  add([cell(`A${n}`, wb.title, 'label', STYLE.title)]);
  for (const [label, value] of wb.meta) add([cell(`A${n}`, label, 'label', STYLE.muted), cell(`B${n}`, value, 'label')]);
  for (const section of wb.summary) {
    n += 1;
    const head = section.head ? [section.title, ...section.head.slice(1)] : [section.title];
    add(head.map((h, i) => cell(`${columnName(i + 1)}${n}`, h, 'label', STYLE.bold)));
    for (const line of section.rows) {
      add(line.map((v, i) => cell(`${columnName(i + 1)}${n}`, v, i === 0 ? 'label' : typeof v === 'number' ? 'int' : 'label', i === 0 ? STYLE.plain : typeof v === 'number' && !Number.isInteger(v) ? STYLE.number : undefined)));
    }
  }
  // Narrow value columns keep each count beside its label; a long line (the area, the filters) runs on
  // into the empty cells to its right.
  return sheetXml({ rows, widths: [40, 16, 14, 14, 14], frozen: false, filter: null });
}

// --- The package -------------------------------------------------------------------------------------

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="3"><numFmt numFmtId="164" formatCode="d mmm yyyy"/><numFmt numFmtId="165" formatCode="d mmm yyyy hh:mm"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>' +
  '<fonts count="4">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
  '<font><sz val="11"/><color rgb="FF6B7280"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="10">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/** `A1:X15` as `$A$1:$X$15`. */
function absolute(range: string): string {
  return range
    .split(':')
    .map((p) => p.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2'))
    .join(':');
}

/** A sheet's name as Excel allows it: 31 characters, none of `[]:*?/\`. */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
}

/** The workbook as .xlsx bytes. */
export async function writeXlsx(wb: Workbook): Promise<Buffer> {
  const sheets = [
    { name: 'Summary', xml: summarySheet(wb), filter: null as string | null },
    ...wb.sheets.map((s) => ({ name: sheetName(s.name), ...dataSheet(s) })),
  ];
  const definedNames = sheets
    .map((s, i) =>
      s.filter
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(s.name)}'!${absolute(s.filter)}</definedName>`
        : '',
    )
    .join('');
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>',
    ],
    [
      'docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${xml(wb.title)}</dc:title><dc:creator>Injishi</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created>` +
        '</cp:coreProperties>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView/></bookViews><sheets>' +
        sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets>' +
        (definedNames ? `<definedNames>${definedNames}</definedNames>` : '') +
        '</workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, s.xml]),
  ];
  return zip(files.map(([name, text]) => ({ name, data: Buffer.from(text, 'utf8') })));
}

// --- Zip ------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip archive of the files, each deflated (the format .xlsx is). */
export function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // 1 Jan 2026, 00:00 in DOS time: a fixed stamp keeps the bytes the same for the same content.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const packed = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
