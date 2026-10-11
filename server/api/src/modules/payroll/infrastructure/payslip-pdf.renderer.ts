import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

import type { PayslipLine } from '../domain/pay-rules';
import type { PayslipPage } from '../domain/payslip-page';

const INK = rgb(0.09, 0.11, 0.13);
const MUTED = rgb(0.42, 0.46, 0.5);
const RULE = rgb(0.82, 0.85, 0.87);
const WARN = rgb(0.72, 0.36, 0.02);
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const RIGHT = A4.width - MARGIN;

function francs(n: number): string {
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${s} RWF`;
}

/**
 * The payslip PDF: one A4 page per payslip, drawn only from what the payslip
 * stored when it was computed, never from today's salary or today's rates, so
 * a payslip printed next year says what it said the day it was approved.
 * Generated on request and never stored: the lines are the record, and a
 * stored PDF would be a second copy that could disagree.
 *
 * THE PAGE IS MAIN'S (`modules/people/infrastructure/payslip-pdf.renderer.ts`,
 * 058-payroll AC-PY11): the same sections in the same order, laid out by
 * arithmetic from named constants. ONE THING DIFFERS. Main embeds its own
 * typeface, which needs a font package this branch does not carry; this draws
 * in Helvetica, one of the fourteen faces every PDF reader has. Those faces
 * cover Western European letters only, so a character outside them is drawn
 * as "?" rather than failing the whole page. Swap to main's renderer when the
 * branches meet and that limit goes.
 */
@Injectable()
export class PayslipPdfRenderer {
  async render(pages: readonly PayslipPage[]): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    doc.setTitle(pages.length === 1 ? `Payslip, ${pages[0].month}` : `Payslips, ${pages[0]?.month ?? ''}`);
    doc.setProducer('Injishi');
    for (const p of pages) this.page(doc, p, regular, bold);
    return Buffer.from(await doc.save());
  }

  private page(doc: PDFDocument, p: PayslipPage, regular: PDFFont, bold: PDFFont): void {
    // What this face can draw. Anything else becomes "?" instead of throwing.
    const drawable = new Set(regular.getCharacterSet());
    const safe = (t: string): string =>
      [...t].map((ch) => (drawable.has(ch.codePointAt(0) ?? 0) ? ch : '?')).join('');

    // Reassigned when a long payslip runs on: every helper below draws on the current page.
    let page = doc.addPage([A4.width, A4.height]);
    let y = A4.height - MARGIN;
    const text = (t: string, x: number, at: number, size = 10, font = regular, color = INK): void => {
      page.drawText(safe(t), { x, y: at, size, font, color });
    };
    const right = (t: string, at: number, size = 10, font = regular, color = INK): void => {
      const s = safe(t);
      page.drawText(s, { x: RIGHT - font.widthOfTextAtSize(s, size), y: at, size, font, color });
    };
    const rule = (at: number): void => {
      page.drawLine({ start: { x: MARGIN, y: at }, end: { x: RIGHT, y: at }, thickness: 0.6, color: RULE });
    };

    // The business, and which payslip this is.
    text(p.businessName, MARGIN, y, 14, bold);
    right(`Payslip, ${p.month}`, y, 14, bold);
    y -= 16;
    text(p.periodText, MARGIN, y, 9, regular, MUTED);
    right(p.statusText, y, 9, p.draft ? bold : regular, p.draft ? WARN : MUTED);
    y -= 22;
    rule(y);
    y -= 20;

    // The person.
    const facts: [string, string | null][] = [
      ['Name', p.personName],
      ['Position', p.jobTitle],
      ['Department', p.departmentName],
      ['Attendance', p.attendanceText],
    ];
    for (const [label, value] of facts) {
      if (!value) continue;
      text(label, MARGIN, y, 9, regular, MUTED);
      text(value, MARGIN + 110, y, 10);
      y -= 15;
    }
    y -= 8;

    const section = (title: string, lines: readonly PayslipLine[], total: number | null): void => {
      if (lines.length === 0) return;
      rule(y + 4);
      y -= 12;
      text(title, MARGIN, y, 10, bold);
      y -= 16;
      for (const l of lines) {
        if (y < MARGIN + 40) {
          page = doc.addPage([A4.width, A4.height]);
          y = A4.height - MARGIN;
        }
        text(l.label, MARGIN, y, 10);
        right(francs(l.amountRwf), y, 10);
        y -= 12;
        if (l.basis) {
          text(l.basis.length > 95 ? `${l.basis.slice(0, 94)}...` : l.basis, MARGIN + 10, y, 8, regular, MUTED);
          y -= 13;
        } else {
          y -= 3;
        }
      }
      if (total !== null) {
        y -= 2;
        text(`Total ${title.toLowerCase()}`, MARGIN, y, 10, bold);
        right(francs(total), y, 10, bold);
        y -= 20;
      }
    };
    section('Earnings', p.lines.filter((l) => l.side === 'earning'), p.grossRwf);
    section('Withheld', p.lines.filter((l) => l.side === 'employee'), p.withheldRwf);

    rule(y + 4);
    y -= 18;
    text('Net pay', MARGIN, y, 13, bold);
    right(francs(p.netRwf), y, 13, bold);
    y -= 28;

    // What the business pays on top: on the page so the person can see it, and
    // after the net so nobody reads it as something taken from them.
    section('The business also pays, on top of your salary', p.lines.filter((l) => l.side === 'employer'), null);

    text(
      `Drawn from the figures stored when the ${p.month} payroll was computed. Rates still to be confirmed by an accountant.`,
      MARGIN,
      MARGIN,
      8,
      regular,
      MUTED,
    );
  }
}
