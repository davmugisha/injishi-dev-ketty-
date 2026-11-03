/**
 * One table, saved as CSV, Excel, PDF or Word (2026-11-02), in the browser and with no library: an
 * .xlsx and a .docx are zips of XML, written here with a stored (uncompressed) zip; the PDF is drawn
 * with the standard Helvetica font, in A4 landscape, its header row repeated on every page.
 *
 * A report of several parts is several sections; each keeps its own heading row.
 */

export type ExportFormat = "csv" | "xlsx" | "pdf" | "docx";

export const EXPORT_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "csv", label: "CSV" },
  { id: "xlsx", label: "Excel" },
  { id: "pdf", label: "PDF" },
  { id: "docx", label: "Word" },
];

export type Cell = string | number | null | undefined;

export interface ExportSection {
  /** Shown above the section's table; omitted for a single-table export. */
  title?: string;
  heading: string[];
  rows: Cell[][];
}

export interface ExportTable {
  /** The file's name without its extension, like `psf-businesses-2026-11-02`. */
  filename: string;
  /** The title printed at the top of a PDF or Word file, and the Excel sheet's name. */
  title: string;
  /** One line under the title: the region, the period, the filter. */
  subtitle?: string;
  sections: ExportSection[];
}

/** The file itself, without saving it. */
export function buildExport(format: ExportFormat, table: ExportTable): Blob {
  return format === "csv" ? csvFile(table) : format === "xlsx" ? xlsxFile(table) : format === "docx" ? docxFile(table) : pdfFile(table);
}

export function exportTable(format: ExportFormat, table: ExportTable): void {
  const url = URL.createObjectURL(buildExport(format, table));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${table.filename}.${format}`;
  a.click();
  // Revoked on the next turn: some browsers start the save only after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const text = (v: Cell): string => (v === null || v === undefined ? "" : String(v));

// ── CSV ─────────────────────────────────────────────────────────────────────────────────────────

/** A byte-order mark leads, so Excel reads accents; every cell is quoted, so a comma stays in its cell. */
function csvFile(t: ExportTable): Blob {
  const cell = (v: Cell) => `"${text(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  t.sections.forEach((s, i) => {
    if (i > 0) lines.push("");
    if (s.title && t.sections.length > 1) lines.push(cell(s.title));
    lines.push(s.heading.map(cell).join(","), ...s.rows.map((r) => r.map(cell).join(",")));
  });
  return new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
}

// ── Zip (stored, no compression) ────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; body: string }[], type: string): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.body);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names are UTF-8
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type });
}

const xml = (v: string): string =>
  v
    // biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 forbids these characters in a sheet's text, so matching them is the point.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ── Excel (.xlsx) ───────────────────────────────────────────────────────────────────────────────

function columnName(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xlsxFile(t: ExportTable): Blob {
  // One sheet: the title, the subtitle, then each section with a bold heading row.
  const rows: { cells: Cell[]; style: 0 | 1 | 2 }[] = [{ cells: [t.title], style: 2 }];
  if (t.subtitle) rows.push({ cells: [t.subtitle], style: 0 });
  for (const s of t.sections) {
    rows.push({ cells: [], style: 0 });
    if (s.title && t.sections.length > 1) rows.push({ cells: [s.title], style: 2 });
    rows.push({ cells: s.heading, style: 1 });
    for (const r of s.rows) rows.push({ cells: r, style: 0 });
  }
  const widest = Math.max(...t.sections.map((s) => s.heading.length));
  const widths = Array.from({ length: widest }, (_, c) =>
    Math.min(60, Math.max(8, ...t.sections.flatMap((s) => [s.heading[c] ?? "", ...s.rows.map((r) => text(r[c]))]).map((v) => v.length + 2))),
  );
  const sheetRows = rows
    .map((r, i) => {
      const cells = r.cells
        .map((v, c) => {
          const ref = `${columnName(c)}${i + 1}`;
          const style = r.style ? ` s="${r.style}"` : "";
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
          const s = text(v);
          return s ? `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(s)}</t></is></c>` : "";
        })
        .join("");
      return `<row r="${i + 1}">${cells}</row>`;
    })
    .join("");
  const sheetName = xml(t.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
  return zip(
    [
      {
        name: "[Content_Types].xml",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      },
      {
        name: "_rels/.rels",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      },
      {
        name: "xl/workbook.xml",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      },
      {
        name: "xl/styles.xml",
        // 0: plain; 1: bold with a grey fill (heading rows); 2: bold and larger (titles).
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEEA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
      },
      {
        name: "xl/worksheets/sheet1.xml",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join("")}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
      },
    ],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

// ── Word (.docx) ────────────────────────────────────────────────────────────────────────────────

function docxFile(t: ExportTable): Blob {
  const run = (v: string, opts: { bold?: boolean; size?: number } = {}) =>
    `<w:r><w:rPr>${opts.bold ? "<w:b/>" : ""}<w:sz w:val="${opts.size ?? 18}"/></w:rPr><w:t xml:space="preserve">${xml(v)}</w:t></w:r>`;
  const para = (v: string, opts: { bold?: boolean; size?: number; after?: number } = {}) =>
    `<w:p><w:pPr><w:spacing w:after="${opts.after ?? 120}"/></w:pPr>${run(v, opts)}</w:p>`;
  const cell = (v: string, heading: boolean) =>
    `<w:tc><w:tcPr>${heading ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEEA"/>' : ""}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(v, { bold: heading })}</w:p></w:tc>`;
  const border = '<w:top w:val="single" w:sz="4" w:color="C9D3CD"/><w:left w:val="single" w:sz="4" w:color="C9D3CD"/><w:bottom w:val="single" w:sz="4" w:color="C9D3CD"/><w:right w:val="single" w:sz="4" w:color="C9D3CD"/><w:insideH w:val="single" w:sz="4" w:color="C9D3CD"/><w:insideV w:val="single" w:sz="4" w:color="C9D3CD"/>';
  const tables = t.sections
    .map((s) => {
      const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${s.heading.map((h) => cell(h, true)).join("")}</w:tr>`;
      const body = s.rows.map((r) => `<w:tr>${s.heading.map((_, c) => cell(text(r[c]), false)).join("")}</w:tr>`).join("");
      return `${s.title && t.sections.length > 1 ? para(s.title, { bold: true, size: 22, after: 80 }) : ""}<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${border}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>${head}${body}</w:tbl>${para("", { after: 200 })}`;
    })
    .join("");
  const body = `${para(t.title, { bold: true, size: 32, after: 60 })}${t.subtitle ? para(t.subtitle, { size: 20, after: 240 }) : ""}${tables}`;
  // A4 landscape, 1.5 cm margins: wide tables fit across.
  const section = '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>';
  return zip(
    [
      {
        name: "[Content_Types].xml",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      },
      {
        name: "_rels/.rels",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      },
      {
        name: "word/document.xml",
        body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}${section}</w:body></w:document>`,
      },
    ],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}

// ── PDF ─────────────────────────────────────────────────────────────────────────────────────────

/** Helvetica's widths for printable ASCII (32 to 126), in 1/1000 em; anything else counts as 556. */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278,
  278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556,
  556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const widthOf = (s: string, size: number, bold: boolean): number =>
  [...s].reduce((w, ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= 32 && code <= 126 ? HELVETICA[code - 32]! : 556;
    return w + base * (bold ? 1.05 : 1);
  }, 0) *
  (size / 1000);

/** The standard fonts speak Latin-1 (WinAnsi): accents stay, anything else becomes "?". */
function latin1(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

const pdfString = (s: string): string => `(${s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;

function fit(s: string, max: number, size: number, bold: boolean): string {
  if (widthOf(s, size, bold) <= max) return s;
  let out = s;
  while (out.length > 1 && widthOf(`${out}...`, size, bold) > max) out = out.slice(0, -1);
  return `${out}...`;
}

function pdfFile(t: ExportTable): Blob {
  const W = 842;
  const H = 595; // A4 landscape, in points
  const M = 36;
  const SIZE = 8;
  const ROW = 15;
  const pages: string[] = [];
  let ops: string[] = [];
  let y = H - M;

  const textAt = (x: number, yy: number, s: string, size: number, bold: boolean, grey = false) =>
    ops.push(`BT ${grey ? "0.4 0.45 0.42 rg" : "0.1 0.12 0.11 rg"} /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td ${pdfString(latin1(s))} Tj ET`);
  const newPage = () => {
    if (ops.length) pages.push(ops.join("\n"));
    ops = [];
    y = H - M;
    textAt(W - M - 60, M / 2, `Page ${pages.length + 1}`, 7, false, true);
  };
  newPage();
  textAt(M, y - 14, t.title, 15, true);
  y -= 24;
  if (t.subtitle) {
    textAt(M, y - 10, t.subtitle, 9, false, true);
    y -= 18;
  }

  for (const s of t.sections) {
    const n = s.heading.length;
    // Columns share the width by their content, each at least a little, the widest capped.
    const natural = s.heading.map((h, c) =>
      Math.min(
        220,
        Math.max(40, widthOf(h, SIZE, true), ...s.rows.slice(0, 200).map((r) => widthOf(latin1(text(r[c])), SIZE, false))) + 10,
      ),
    );
    const scale = (W - 2 * M) / natural.reduce((a, b) => a + b, 0);
    const cols = natural.map((w) => w * scale);
    const header = () => {
      ops.push(`0.91 0.93 0.92 rg ${M} ${(y - ROW).toFixed(2)} ${W - 2 * M} ${ROW} re f`);
      let x = M;
      s.heading.forEach((h, c) => {
        textAt(x + 4, y - ROW + 4.5, fit(latin1(h), cols[c]! - 8, SIZE, true), SIZE, true);
        x += cols[c]!;
      });
      y -= ROW;
    };
    if (y - (s.title ? 20 : 0) - 2 * ROW < M) newPage();
    if (s.title && t.sections.length > 1) {
      y -= 6;
      textAt(M, y - 10, s.title, 10, true);
      y -= 18;
    }
    header();
    for (const r of s.rows) {
      if (y - ROW < M) {
        newPage();
        header();
      }
      let x = M;
      for (let c = 0; c < n; c++) {
        textAt(x + 4, y - ROW + 4.5, fit(latin1(text(r[c])), cols[c]! - 8, SIZE, false), SIZE, false);
        x += cols[c]!;
      }
      ops.push(`0.85 0.88 0.86 RG 0.5 w ${M} ${(y - ROW).toFixed(2)} m ${W - M} ${(y - ROW).toFixed(2)} l S`);
      y -= ROW;
    }
    y -= 12;
  }
  pages.push(ops.join("\n"));

  // Objects: 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold, then a page and its content per page.
  const objects: string[] = [];
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((content, i) => {
    const page = 5 + i * 2;
    objects[page] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${page + 1} 0 R >>`;
    const bytes = latin1Bytes(content);
    objects[page + 1] = `<< /Length ${bytes.length} >>\nstream\n${content}\nendstream`;
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = latin1Bytes(body).length;
    body += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = latin1Bytes(body).length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([latin1Bytes(body) as BlobPart], { type: "application/pdf" });
}

/** One byte per character: the PDF's text is Latin-1 already. */
function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
