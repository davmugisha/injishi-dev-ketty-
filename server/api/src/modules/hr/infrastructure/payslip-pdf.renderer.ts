import type { PayslipLine } from '@injishi/contracts';
import fontkit from '@pdf-lib/fontkit';
import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';

import { FIGTREE_BOLD_BASE64 } from './fonts/figtree-bold';
import { FIGTREE_REGULAR_BASE64 } from './fonts/figtree-regular';
import type { PayslipSnapshot } from './pay-records.repository';

/** One payslip as a page draws it: its frozen figures and the day's snapshot. */
export interface PayslipPage {
  period: string;
  snapshot: PayslipSnapshot;
  grossRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  nonIncomeRwf: number;
  netRwf: number;
  lines: readonly PayslipLine[];
}

const INK = rgb(0.09, 0.11, 0.13);
const MUTED = rgb(0.42, 0.46, 0.5);
const RULE = rgb(0.82, 0.85, 0.87);
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const RIGHT = A4.width - MARGIN;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function francs(n: number): string {
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${s} RWF`;
}

function monthName(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * The payslip PDF (058-payroll AC-PY11): one page per payslip, drawn only from
 * its frozen lines and the snapshot the confirm stored, never from today's file
 * or business, so a payslip printed next year says what it said the day it was
 * confirmed. Generated on request and never stored: the lines are the record,
 * and a stored PDF would be a second copy that could disagree.
 *
 * Figtree is embedded (subset), because the fourteen standard PDF faces cannot
 * draw every name. Layout is arithmetic from named constants, as the training
 * certificate's is.
 */
@Injectable()
export class PayslipPdfRenderer {
  async render(pages: readonly PayslipPage[]): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const regular = await doc.embedFont(Buffer.from(FIGTREE_REGULAR_BASE64, 'base64'), { subset: true });
    const bold = await doc.embedFont(Buffer.from(FIGTREE_BOLD_BASE64, 'base64'), { subset: true });
    doc.setTitle(pages.length === 1 ? `Payslip ${pages[0].period}` : `Payslips ${pages[0]?.period ?? ''}`);
    doc.setProducer('Injishi');
    for (const p of pages) this.page(doc, p, regular, bold);
    return Buffer.from(await doc.save());
  }

  private page(doc: PDFDocument, p: PayslipPage, regular: PDFFont, bold: PDFFont): void {
    // Reassigned when a long payslip runs on: every helper below draws on the current page.
    let page = doc.addPage([A4.width, A4.height]);
    const s = p.snapshot;
    let y = A4.height - MARGIN;
    const text = (t: string, x: number, at: number, size = 10, font = regular, color = INK): void => {
      page.drawText(t, { x, y: at, size, font, color });
    };
    const right = (t: string, at: number, size = 10, font = regular, color = INK): void => {
      page.drawText(t, { x: RIGHT - font.widthOfTextAtSize(t, size), y: at, size, font, color });
    };
    const rule = (at: number): void => {
      page.drawLine({ start: { x: MARGIN, y: at }, end: { x: RIGHT, y: at }, thickness: 0.6, color: RULE });
    };

    // The business.
    text(s.businessName, MARGIN, y, 14, bold);
    y -= 16;
    const ids = [s.tin ? `TIN ${s.tin}` : null, s.rssbEmployerNumber ? `RSSB employer ${s.rssbEmployerNumber}` : null].filter(Boolean).join('   ');
    if (ids) text(ids, MARGIN, y, 9, regular, MUTED);
    right(`Payslip, ${monthName(p.period)}`, A4.height - MARGIN, 14, bold);
    y -= 22;
    rule(y);
    y -= 20;

    // The person.
    const facts: [string, string | null][] = [
      ['Name', s.personName],
      ['Number', s.employeeNumber],
      ['Position', s.jobPosition],
      ['RSSB number', s.rssbNumber],
      ['Paid to', s.payAccount],
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
          text(l.basis.length > 95 ? `${l.basis.slice(0, 94)}…` : l.basis, MARGIN + 10, y, 8, regular, MUTED);
          y -= 13;
        }
      }
      if (total !== null) {
        text(`Total ${title.toLowerCase()}`, MARGIN, y, 10, bold);
        right(francs(total), y, 10, bold);
        y -= 20;
      }
    };
    section('Earnings', p.lines.filter((l) => l.side === 'earning'), p.grossRwf);
    section(
      'Withheld',
      p.lines.filter((l) => l.side === 'employee' || l.side === 'deduction'),
      p.payeRwf + p.employeeContributionsRwf + p.otherDeductionsRwf,
    );
    section('Paid with the net, not income', p.lines.filter((l) => l.side === 'passthrough'), p.nonIncomeRwf);

    rule(y + 4);
    y -= 18;
    text('Net pay', MARGIN, y, 13, bold);
    right(francs(p.netRwf), y, 13, bold);
    y -= 26;
    const employer = p.lines.filter((l) => l.side === 'employer');
    if (employer.length > 0) {
      text(`The business also paid ${francs(p.employerContributionsRwf)} in employer contributions for you.`, MARGIN, y, 9, regular, MUTED);
      y -= 14;
    }
    text(`Figures frozen when the ${monthName(p.period)} run was confirmed, on ${s.confirmedOn}.`, MARGIN, MARGIN, 8, regular, MUTED);
  }
}
