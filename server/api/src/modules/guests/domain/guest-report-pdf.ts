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
const ABROAD = '#9CA3AF';

/**
 * The leader's report to send up the chain (P5, 2026-11-02), summary first: who it is from and for which
 * area, the period and filters, the totals, then guests present each day, and the breakdowns, two to a row.
 * Local government's has Rwandan and foreign guests side by side, by area and by relationship; DGIE's is
 * about guests from abroad only, by nationality first. Counts only: no guest's name, phone or ID number,
 * and places by name and address, never by who lives there.
 */
export function renderGuestReportPdf(report: GuestReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dgie = report.audience === 'dgie';
    const title = dgie ? 'Foreign guest report' : 'Guest report';
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      info: {
        Title: pdfText(`${title} ${report.period.from} to ${report.period.to}`),
        Author: 'Injishi',
        Subject: dgie ? 'Guests from abroad registered in a DGIE area' : 'Guests registered in a local leader area',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = doc.page.height - doc.page.margins.bottom;
    /** Room for `h` more points on this page, else a new page. */
    const room = (h: number): void => {
      if (doc.y + h > bottom) {
        doc.addPage();
        doc.y = doc.page.margins.top;
      }
    };

    // --- Who, where, when -------------------------------------------------------------
    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(title, left, 44, { width });
    doc.moveDown(0.15);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(INK)
      .text(pdfText(`Guests who arrived ${longDate(report.period.from)} to ${longDate(report.period.to)}`), { width });
    const by = report.leader.name ? `${report.leader.name} (${report.leader.email})` : report.leader.email;
    doc.fontSize(9).fillColor(MUTED).text(pdfText(`Prepared by ${by}`), { width });
    for (const s of report.scopes) doc.text(pdfText(`${s.roleLabel}: ${s.area}`), { width });
    if (report.narrowedTo) doc.text(pdfText(`Narrowed to ${report.narrowedTo}`), { width });
    if (report.filteredBy.length) doc.text(pdfText(`Filters: ${report.filteredBy.join(', ')}`), { width });
    doc.text(pdfText(`Generated ${longDate(kigaliDateOf(report.generatedAt))} on Injishi`), { width });
    doc.moveDown(0.8);

    // --- The summary --------------------------------------------------------------------
    const t = report.totals;
    const figures: [string, string][] = dgie
      ? [
          ['Foreign guests', String(t.registered)],
          ['Nationalities', String(t.nationalities)],
          ['Staying now', String(t.stayingNow)],
          ['Avg. nights', t.averageNights === null ? '-' : String(t.averageNights)],
          ['Flagged', String(t.flagged)],
        ]
      : [
          ['Guests arrived', String(t.registered)],
          ['Rwandan', String(t.nationals)],
          ['Foreign', String(t.fromAbroad)],
          ['Staying now', String(t.stayingNow)],
          ['Avg. nights', t.averageNights === null ? '-' : String(t.averageNights)],
          ['Flagged', String(t.flagged)],
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

    // --- Guests present each day ----------------------------------------------------------
    const days = report.presentByDay;
    const peak = days.reduce<(typeof days)[number] | null>((best, d) => (d.total > (best?.total ?? -1) ? d : best), null);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Guests present each day', left, doc.y, { width });
    if (!dgie) {
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Dark: Rwandan. Light: from abroad.', left, doc.y, { width });
    }
    const chartTop = doc.y + 14;
    const chartHeight = 70;
    const max = Math.max(1, ...days.map((p) => p.total));
    const slot = days.length ? width / days.length : width;
    const barWidth = Math.max(1, Math.min(18, slot * 0.7));
    days.forEach((p, i) => {
      const x = left + i * slot + (slot - barWidth) / 2;
      const h = (p.total / max) * chartHeight;
      const foreign = dgie ? 0 : (p.fromAbroad / max) * chartHeight;
      if (h - foreign > 0) doc.rect(x, chartTop + chartHeight - h, barWidth, h - foreign).fillColor(BAR).fill();
      if (foreign > 0) doc.rect(x, chartTop + chartHeight - foreign, barWidth, foreign).fillColor(ABROAD).fill();
    });
    doc.moveTo(left, chartTop + chartHeight).lineTo(left + width, chartTop + chartHeight).strokeColor(LINE).lineWidth(0.8).stroke();
    const first = days[0];
    const last = days[days.length - 1];
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    if (first) doc.text(first.label, left, chartTop + chartHeight + 3, { width: width / 2 });
    if (last && last !== first) doc.text(last.label, left + width / 2, chartTop + chartHeight + 3, { width: width / 2, align: 'right' });
    doc.text(peak && peak.total > 0 ? `Most on one day: ${peak.total} (${peak.label})` : 'Nobody was here in this period', left, chartTop - 12, { width, align: 'right' });
    doc.y = chartTop + chartHeight + 20;

    // --- The breakdowns, two to a row --------------------------------------------------------
    const half = (width - 24) / 2;
    const pair = (
      a: { title: string; head: string[]; rows: string[][] },
      b: { title: string; head: string[]; rows: string[][] } | null,
    ): void => {
      const tall = Math.max(a.rows.length, b?.rows.length ?? 0, 1) * 13 + 34;
      room(tall);
      const y = doc.y;
      table(doc, a.title, a.head, a.rows, left, y, half);
      const end = doc.y;
      if (b) table(doc, b.title, b.head, b.rows, left + half + 24, y, half);
      doc.y = Math.max(end, doc.y) + 14;
    };
    const places = dgie
      ? { title: 'By type of place', head: ['Type', 'Guests', 'Nights'], rows: report.byPlaceType.map((p) => [p.label, String(p.count), p.averageNights === null ? '-' : String(p.averageNights)]) }
      : { title: 'By type of place', head: ['Type', 'Guests', 'Abroad', 'Nights'], rows: report.byPlaceType.map((p) => [p.label, String(p.count), String(p.fromAbroad), p.averageNights === null ? '-' : String(p.averageNights)]) };
    const nations = { title: dgie ? 'Top nationalities' : 'Foreign guests by nationality', head: ['Nationality', 'Guests'], rows: report.byNationality.filter((n) => n.code !== 'RW').slice(0, 10).map((n) => [n.name, String(n.count)]) };
    const bands = { title: 'How long they stay', head: ['Length', 'Guests'], rows: report.stayBands.map((b) => [b.label, String(b.count)]) };
    const timing = { title: 'When they were reported', head: ['Reported', 'Guests'], rows: report.timing.map((x) => [x.label, String(x.count)]) };
    const areas = { title: AREA_HEADING[report.areaLevel], head: ['Area', 'Guests', 'Abroad', 'Flagged'], rows: report.byArea.slice(0, 10).map((a) => [a.name, String(a.registered), String(a.fromAbroad), String(a.flagged)]) };
    const relations = { title: 'Who they are to their hosts', head: ['Relationship', 'Guests'], rows: report.byRelationship.slice(0, 8).map((r) => [r.label, String(r.count)]) };
    if (dgie) {
      pair(nations, places);
      pair(bands, timing);
    } else {
      pair(places, nations);
      pair(areas, relations);
      pair(bands, timing);
    }
    const homes = report.topHomes
      .slice(0, 8)
      .map((h) => [[h.name, h.unitLabel ? `unit ${h.unitLabel}` : null].filter(Boolean).join(', '), h.placeLabel, String(h.guests), ...(dgie ? [] : [String(h.fromAbroad)])]);
    room(homes.length * 13 + 34);
    tableWide(doc, 'Places with the most guests', ['Place', 'Type', 'Guests', ...(dgie ? [] : ['Abroad'])], homes, left, doc.y, width);
    doc.y += 14;
    if (report.chain.length > 0) {
      room(report.chain.length * 13 + 34);
      table(doc, 'Along the chain', ['Leader post', 'Received', 'Opened', 'Flagged', 'Waiting'],
        report.chain.map((c) => [c.label, String(c.guests), String(c.opened), String(c.flagged), String(c.waiting)]), left, doc.y, width);
      doc.y += 14;
    }

    // --- Footnote --------------------------------------------------------------------------
    const notes = [
      'Counts only: guest names, phone numbers and ID numbers stay in Injishi. Places are named by business or building, never by who lives there.',
      'Arrivals count guests whose arrival falls in the period; guests present count everyone here that day, whenever they arrived; staying now is today.',
    ];
    if (report.purged) {
      notes.push(`Records before ${longDate(report.purged.before)} were deleted after 12 months; their counts are included in the totals.`);
    }
    room(40);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(pdfText(notes.join(' ')), left, doc.y, { width });
    doc.end();
  });
}

/** A table whose second column is words too (the type of a place), then numbers. */
function tableWide(doc: PDFKit.PDFDocument, title: string, head: string[], rows: string[][], x: number, y: number, width: number): void {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(pdfText(title), x, y, { width });
  let at = doc.y + 4;
  const numberWidth = 46;
  const typeWidth = 90;
  const nameWidth = width - typeWidth - (head.length - 2) * numberWidth;
  const line = (cells: string[], bold: boolean): void => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(bold ? MUTED : INK);
    doc.text(pdfText(cells[0] ?? ''), x, at, { width: nameWidth - 6, height: 11, ellipsis: true, lineBreak: false });
    doc.text(pdfText(cells[1] ?? ''), x + nameWidth, at, { width: typeWidth - 6, height: 11, ellipsis: true, lineBreak: false });
    cells.slice(2).forEach((c, i) => {
      doc.text(c, x + nameWidth + typeWidth + i * numberWidth, at, { width: numberWidth, align: 'right', lineBreak: false });
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
