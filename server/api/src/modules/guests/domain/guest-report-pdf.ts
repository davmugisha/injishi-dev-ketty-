import { type GuestReport, kigaliDateOf, longDate } from '@injishi/contracts';
import PDFDocument from 'pdfkit';

const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const BAR = '#4B5563';

/** Helvetica covers Latin-1: other characters are reduced to plain letters. */
export function pdfText(value: string): string {
  return value
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\u0000-ÿ]/g, (ch) => ch.normalize('NFKD').replace(/[^\u0000-ÿ]/g, ''));
}

const AREA_HEADING: Record<GuestReport['areaLevel'], string> = { sector: 'By sector', cell: 'By cell', village: 'By village' };

/**
 * The leader's report on one A4 page (P5), to send up the chain: who it is
 * from and for which area, the period, the totals, arrivals over the period,
 * and the four breakdowns. Counts only: no guest's name, phone or ID number,
 * and homes by address, never by who lives there.
 */
export function renderGuestReportPdf(report: GuestReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      info: {
        Title: pdfText(`Guest report ${report.period.from} to ${report.period.to}`),
        Author: 'Injishi',
        Subject: 'Guests registered in a local leader area',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    // --- Who, where, when -------------------------------------------------------------
    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text('Guest report', left, 44, { width });
    doc.moveDown(0.15);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(INK)
      .text(pdfText(`${longDate(report.period.from)} to ${longDate(report.period.to)}`), { width });
    const by = report.leader.name ? `${report.leader.name} (${report.leader.email})` : report.leader.email;
    doc.fontSize(9).fillColor(MUTED).text(pdfText(`Prepared by ${by}`), { width });
    for (const s of report.scopes) doc.text(pdfText(`${s.roleLabel}: ${s.area}`), { width });
    if (report.narrowedTo) doc.text(pdfText(`Narrowed to ${report.narrowedTo}`), { width });
    if (report.filteredBy.length) doc.text(pdfText(`Guests: ${report.filteredBy.join(', ')}`), { width });
    doc.text(pdfText(`Generated ${longDate(kigaliDateOf(report.generatedAt))} on Injishi`), { width });
    doc.moveDown(0.8);

    // --- The totals ---------------------------------------------------------------------
    const t = report.totals;
    const figures: [string, string][] = [
      ['Registered', String(t.registered)],
      ['Staying now', String(t.stayingNow)],
      ['From abroad', String(t.fromAbroad)],
      ['Flagged', String(t.flagged)],
      ['Average stay', t.averageNights === null ? '-' : `${t.averageNights} ${t.averageNights === 1 ? 'night' : 'nights'}`],
    ];
    const cell = width / figures.length;
    const top = doc.y;
    doc.rect(left, top, width, 48).strokeColor(LINE).lineWidth(0.8).stroke();
    figures.forEach(([label, value], i) => {
      const x = left + i * cell + 10;
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(label, x, top + 8, { width: cell - 16 });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(value, x, top + 22, { width: cell - 16 });
    });
    doc.y = top + 60;

    // --- Arrivals over the period ------------------------------------------------------
    const points = report.arrivals.points;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`Arrivals per ${report.arrivals.bucket}`, left, doc.y, { width });
    const chartTop = doc.y + 6;
    const chartHeight = 70;
    const max = Math.max(1, ...points.map((p) => p.count));
    const slot = points.length ? width / points.length : width;
    const barWidth = Math.max(1.5, Math.min(18, slot * 0.7));
    points.forEach((p, i) => {
      const h = (p.count / max) * chartHeight;
      const x = left + i * slot + (slot - barWidth) / 2;
      if (h > 0) doc.rect(x, chartTop + chartHeight - h, barWidth, h).fillColor(BAR).fill();
    });
    doc.moveTo(left, chartTop + chartHeight).lineTo(left + width, chartTop + chartHeight).strokeColor(LINE).lineWidth(0.8).stroke();
    const first = points[0];
    const last = points[points.length - 1];
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    if (first) doc.text(first.label, left, chartTop + chartHeight + 3, { width: width / 2 });
    if (last && last !== first) doc.text(last.label, left + width / 2, chartTop + chartHeight + 3, { width: width / 2, align: 'right' });
    doc.text(`Most in one ${report.arrivals.bucket}: ${Math.max(0, ...points.map((p) => p.count))}`, left, chartTop - 12, { width, align: 'right' });
    doc.y = chartTop + chartHeight + 20;

    // --- The breakdowns, two columns -------------------------------------------------------
    const half = (width - 24) / 2;
    const rowsTop = doc.y;
    table(doc, AREA_HEADING[report.areaLevel], ['Area', 'Guests', 'Abroad', 'Flagged'],
      report.byArea.slice(0, 10).map((a) => [a.name, String(a.registered), String(a.fromAbroad), String(a.flagged)]), left, rowsTop, half);
    const leftEnd = doc.y;
    table(doc, 'By nationality', ['Nationality', 'Guests'],
      report.byNationality.slice(0, 10).map((n) => [n.name, String(n.count)]), left + half + 24, rowsTop, half);
    const secondTop = Math.max(leftEnd, doc.y) + 14;
    table(doc, 'Who the guests are to their hosts', ['Relationship', 'Guests'],
      report.byRelationship.slice(0, 8).map((r) => [r.label, String(r.count)]), left, secondTop, half);
    const leftEnd2 = doc.y;
    table(doc, 'Homes with the most guests', ['Address', 'Guests'],
      report.topHomes.slice(0, 6).map((h) => [h.unitLabel ? `Unit ${h.unitLabel}, ${h.address}` : h.address, String(h.guests)]),
      left + half + 24, secondTop, half);
    doc.y = Math.max(leftEnd2, doc.y) + 14;
    if (report.chain.length > 0) {
      table(doc, 'Along the chain', ['Leader post', 'Received', 'Opened', 'Flagged', 'No leader yet'],
        report.chain.map((c) => [c.label, String(c.guests), String(c.opened), String(c.flagged), String(c.waiting)]), left, doc.y, width);
      doc.y += 14;
    }

    // --- Footnote --------------------------------------------------------------------------
    const notes = [
      'Counts only: guest names, phone numbers and ID numbers stay in Injishi. Homes are listed by address.',
      'Registered counts guests whose arrival falls in the period; staying now is today.',
    ];
    if (report.purged) {
      notes.push(`Records before ${longDate(report.purged.before)} were deleted after 12 months; their counts are included in the totals.`);
    }
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(pdfText(notes.join(' ')), left, Math.min(doc.y, doc.page.height - 80), { width });
    doc.end();
  });
}

function table(doc: PDFKit.PDFDocument, title: string, head: string[], rows: string[][], x: number, y: number, width: number): void {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(pdfText(title), x, y, { width });
  let at = doc.y + 4;
  const numberCols = head.length - 1;
  const numberWidth = 46;
  const textWidth = width - numberCols * numberWidth;
  const line = (cells: string[], bold: boolean): void => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(bold ? MUTED : INK);
    doc.text(pdfText(cells[0] ?? ''), x, at, { width: textWidth - 6, height: 11, ellipsis: true, lineBreak: false });
    cells.slice(1).forEach((c, i) => {
      doc.text(c, x + textWidth + i * numberWidth, at, { width: numberWidth, align: 'right', lineBreak: false });
    });
    at += 13;
    doc.moveTo(x, at - 2).lineTo(x + width, at - 2).strokeColor(LINE).lineWidth(0.5).stroke();
  };
  line(head, true);
  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('No guests in this period.', x, at, { width });
    at += 13;
  }
  for (const r of rows) line(r, false);
  doc.y = at;
}
