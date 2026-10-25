import { LEASE_PAYMENT_METHOD_LABEL, formatRwf, kigaliDateOf, longDate, type LeasePaymentMethod } from '@injishi/contracts';
import PDFDocument from 'pdfkit';

import { pdfText, stamp } from './lease-pdf';

/** What a receipt prints (WP 1.6): the money, who paid it, what it paid. */
export interface ReceiptPdfInput {
  receiptNumber: string;
  paymentId: string;
  leaseReference: string;
  landlordName: string;
  tenantName: string;
  home: { unitLabel: string; propertyName: string };
  amountRwf: number;
  method: LeasePaymentMethod;
  /** Through Injishi, or written down by the landlord. */
  channel: 'gateway' | 'recorded';
  /** The slip or MoMo reference, or the rail's own reference masked. */
  reference: string | null;
  /** The number it was paid from, masked. */
  payerMasked: string | null;
  /** The day the money arrived, in Kigali. */
  paidOn: string;
  /** What it paid, in order. */
  lines: { label: string; amountRwf: number }[];
  /** Paid ahead and kept for the next charge. */
  creditRwf: number;
  generatedAt: Date;
}

const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';

/**
 * A payment's receipt as a one page PDF: the receipt number, the home, the
 * people, the amount and how it was paid, then each charge it paid. Issued by
 * Injishi for the landlord; Helvetica so it opens anywhere.
 */
export function renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A5',
      margin: 40,
      info: { Title: pdfText(`Receipt ${input.receiptNumber}`), Author: 'Injishi', Subject: 'Rent receipt' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text('Receipt', left, 40, { width });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(pdfText(`${input.receiptNumber}. Issued by Injishi for ${input.landlordName}.`), { width });
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(formatRwf(input.amountRwf), left, doc.y, { width });
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(
        pdfText(
          `${input.channel === 'gateway' ? 'Paid on Injishi' : 'Received by the landlord'} on ${longDate(input.paidOn)} by ${LEASE_PAYMENT_METHOD_LABEL[input.method]}` +
            (input.payerMasked ? ` from ${input.payerMasked}` : '') +
            (input.reference ? `. Reference ${input.reference}` : '') +
            '.',
        ),
        { width },
      );
    doc.moveDown(0.9);

    const facts: [string, string][] = [
      ['Tenant', input.tenantName],
      ['Home', `Unit ${input.home.unitLabel}, ${input.home.propertyName}`],
      ['Lease', input.leaseReference],
      ['Landlord', input.landlordName],
    ];
    for (const [label, value] of facts) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, left, y, { width: 70 });
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(pdfText(value), left + 76, y, { width: width - 76 });
      doc.moveDown(0.25);
    }
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('WHAT IT PAID', left, doc.y, { width, characterSpacing: 0.4 });
    doc.moveDown(0.3);
    const rows = [...input.lines.map((l) => [l.label, formatRwf(l.amountRwf)] as [string, string])];
    if (input.creditRwf > 0) rows.push(['Kept as credit for the next rent', formatRwf(input.creditRwf)]);
    for (const [label, value] of rows) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(pdfText(label), left, y, { width: width - 110 });
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(value, left + width - 110, y, { width: 110, align: 'right' });
      doc.moveDown(0.2);
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.moveDown(0.3);
    }
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Total', left, y, { width: width - 110 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(formatRwf(input.amountRwf), left + width - 110, y, { width: 110, align: 'right' });
    doc.moveDown(1.2);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(pdfText(`Payment ${input.paymentId}. Printed ${stamp(input.generatedAt)} (${kigaliDateOf(input.generatedAt)} in Kigali).`), left, doc.y, { width });
    doc.end();
  });
}
