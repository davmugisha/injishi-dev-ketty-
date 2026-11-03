import { type LeaderAudience, type LeaderGuest, guestHostLines } from '@injishi/contracts';
import PDFDocument from 'pdfkit';

import { exportOrder, guestSummary, statusWords } from './guest-export';
import { pdfText } from './guest-report-pdf';

const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const BAND = '#F3F4F6';

interface ListPdfInput {
  title: string;
  meta: [string, string][];
  guests: readonly LeaderGuest[];
  audience: LeaderAudience;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-11-02` as `2 Nov 2026`. */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''} ${y}`;
}

interface PdfColumn {
  header: string;
  width: number;
  value: (g: LeaderGuest) => [string, string?];
}

function columns(audience: LeaderAudience): PdfColumn[] {
  const where: PdfColumn = {
    header: 'Where',
    width: 150,
    value: (g) => {
      const lines = guestHostLines(g);
      return [lines.place, [g.place.kindLabel, lines.detail].filter(Boolean).join(' · ')];
    },
  };
  const stay: PdfColumn = {
    header: 'Stay',
    width: 112,
    value: (g) => [`${shortDay(g.arrivalOn)} to ${shortDay(g.departureOn)}`, `${g.nights === 1 ? '1 night' : `${g.nights} nights`} · ${statusWords(g)}`],
  };
  const id: PdfColumn = {
    header: audience === 'dgie' ? 'Document' : 'ID',
    width: 100,
    value: (g) => [g.idNumber ?? '-', g.idKind === 'passport' ? 'Passport' : g.idKind === 'national_id' ? 'National ID' : ''],
  };
  return [
    { header: 'Guest', width: 150, value: (g) => [g.fullName, g.nationalityName] },
    id,
    { header: 'Phone', width: 90, value: (g) => [g.phone || '-'] },
    stay,
    where,
    { header: 'Coming from', width: 100, value: (g) => [g.originWords] },
    { header: 'Village', width: 52, value: (g) => [g.home.villageName ?? '-'] },
  ];
}

/**
 * The guest list on A4 landscape (P5, 2026-11-02): who it is for and the filters, the counts first, then the
 * guests. Local government reads Rwandan guests, then foreign guests by nationality, each under its own
 * heading; DGIE reads its guests from abroad by nationality. The header repeats on every page.
 */
export function renderGuestListPdf(input: ListPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: pdfText(input.title), Author: 'Injishi' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = doc.page.height - doc.page.margins.bottom;

    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(pdfText(input.title), left, 36, { width });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    for (const [label, value] of input.meta) doc.text(pdfText(`${label}: ${value}`), { width });
    doc.moveDown(0.6);

    // --- The counts, first ---------------------------------------------------------------
    const [counts, ...breakdowns] = guestSummary(input.guests, input.audience);
    const figures = (counts?.rows ?? []).filter(([, v]) => v !== null);
    const cell = width / Math.max(1, figures.length);
    const top = doc.y;
    doc.rect(left, top, width, 40).strokeColor(LINE).lineWidth(0.8).stroke();
    figures.forEach(([label, value], i) => {
      const x = left + i * cell + 8;
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(pdfText(label), x, top + 7, { width: cell - 12 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(String(value), x, top + 19, { width: cell - 12 });
    });
    doc.y = top + 48;
    const lines = breakdowns.map((s) => `${s.title}: ${s.rows.map(([l, v]) => `${l} ${v}`).join(', ')}`);
    doc.font('Helvetica').fontSize(8.5).fillColor(INK);
    for (const line of lines) doc.text(pdfText(line), left, doc.y, { width });
    doc.moveDown(0.6);

    // --- The guests -----------------------------------------------------------------------
    const cols = columns(input.audience);
    const scale = width / cols.reduce((n, c) => n + c.width, 0);
    const widths = cols.map((c) => c.width * scale);
    const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((n, w) => n + w, 0));
    const header = (): void => {
      const y = doc.y;
      doc.rect(left, y, width, 15).fillColor(BAND).fill();
      cols.forEach((c, i) => doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(c.header, (xs[i] ?? left) + 3, y + 4, { width: (widths[i] ?? 0) - 6, lineBreak: false }));
      doc.y = y + 18;
    };
    const room = (h: number): void => {
      if (doc.y + h > bottom) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        header();
      }
    };
    const group = (title: string): void => {
      room(40);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(pdfText(title), left, doc.y + 4, { width });
      doc.y += 3;
      header();
    };
    const row = (g: LeaderGuest): void => {
      room(26);
      const y = doc.y;
      cols.forEach((c, i) => {
        const [first, second] = c.value(g);
        const x = (xs[i] ?? left) + 3;
        const w = (widths[i] ?? 0) - 6;
        doc.font('Helvetica').fontSize(8).fillColor(INK).text(pdfText(first), x, y, { width: w, height: 10, ellipsis: true, lineBreak: false });
        if (second) doc.fontSize(7).fillColor(MUTED).text(pdfText(second), x, y + 10, { width: w, height: 9, ellipsis: true, lineBreak: false });
      });
      doc.moveTo(left, y + 22).lineTo(left + width, y + 22).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = y + 26;
    };

    const ordered = exportOrder(input.guests, input.audience);
    if (ordered.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('No guests match these filters.', left, doc.y, { width });
    } else if (input.audience === 'local') {
      const rwandan = ordered.filter((g) => !g.fromAbroad);
      const foreign = ordered.filter((g) => g.fromAbroad);
      if (rwandan.length) {
        group(`Rwandan guests (${rwandan.length})`);
        rwandan.forEach(row);
      }
      if (foreign.length) {
        doc.y += 6;
        group(`Foreign guests (${foreign.length})`);
        foreign.forEach(row);
      }
    } else {
      group(`Guests from abroad (${ordered.length})`);
      ordered.forEach(row);
    }

    doc.moveDown(0.8);
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text('Personal data: keep this list for the work it was made for, and destroy it once done. Injishi deletes guest records 12 months after the guest leaves.', left, Math.min(doc.y, bottom - 20), { width });
    doc.end();
  });
}
