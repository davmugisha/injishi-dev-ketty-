import {
  E_SIGNATURE_LAW,
  ID_KIND_LABEL,
  formatRwf,
  kigaliDateOf,
  longDate,
  ordinal,
  type LeaseContract,
  type LeaseSigningMethod,
} from '@injishi/contracts';
import PDFDocument from 'pdfkit';

/** One signature as the PDF prints it, with its evidence. */
export interface PdfSignature {
  role: 'landlord' | 'tenant';
  typedName: string | null;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  signedAt: Date;
  verifiedAt: Date | null;
  method: LeaseSigningMethod;
  /** The PNG they drew, when they drew one. */
  drawing: Buffer | null;
}

export interface LeasePdfInput {
  /** "L-0007": the number on the contract and in every conversation about it. */
  reference: string;
  leaseId: string;
  /** Which version of the contract this is. */
  version: number;
  contract: LeaseContract;
  /** `contractHash(contract)`: what every signature repeats. */
  documentHash: string;
  /** The signatures standing on this version (voided ones are left out). */
  signatures: PdfSignature[];
  /** Both sides have signed: a signed copy, not a preview. */
  signed: boolean;
  generatedAt: Date;
}

const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const SOFT = '#F3F4F6';

/**
 * The lease as a PDF (ported from feat/rentals' `lease-pdf.ts`, 2026-10-22):
 * the parties, the home down to its village, the terms at a glance, every
 * clause of the contract as it was frozen (`buildLeaseContract` in contracts,
 * so the screen, the API and this file hold the same text), a signature block
 * per side, and, once anyone has signed, an audit trail page: who signed, when,
 * from where, how they proved it was them, and the contract's SHA-256.
 *
 * A copy not signed by both sides says so on every page. Helvetica, the font
 * every PDF reader has, so the file opens anywhere; text outside its character
 * set is reduced to plain letters first (`pdfText`).
 */
export function renderLeasePdf(input: LeasePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const c = input.contract;
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      bufferPages: true,
      info: {
        Title: pdfText(`${c.title}, ${input.reference}`),
        Author: 'Injishi',
        Subject: input.signed ? 'Signed residential lease' : 'Residential lease, not signed yet',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const half = (width - 24) / 2;
    const { landlord, tenant } = c.parties;

    // --- Title ---------------------------------------------------------------
    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(pdfText(c.title), left, 56, { width });
    doc.moveDown(0.2);
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(
        pdfText(
          `${input.signed ? 'Signed on Injishi' : 'Preview, not signed by both sides yet'}. ` +
            `Lease ${input.reference}, version ${input.version}. Issued ${longDate(kigaliDateOf(c.issuedAt))}.`,
        ),
        { width },
      );
    doc.moveDown(1);

    // --- The parties ------------------------------------------------------------
    const top = doc.y;
    partyBlock(doc, 'Landlord', [
      landlord.legalName,
      `Represented by ${landlord.signatoryName}`,
      `ID or TIN ${landlord.idNumber}`,
      landlord.phone,
      landlord.email,
    ], left, top, half);
    const leftEnd = doc.y;
    partyBlock(doc, 'Tenant', [
      tenant.fullName,
      `${ID_KIND_LABEL[tenant.idKind]} ${tenant.idNumber}`,
      `Nationality ${tenant.nationality}`,
      tenant.phone,
      tenant.email,
    ], left + half + 24, top, half);
    doc.y = Math.max(leftEnd, doc.y) + 12;

    // --- The home ---------------------------------------------------------------
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('THE HOME', left, doc.y, { width, characterSpacing: 0.4 });
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(pdfText(c.premisesLine), left, doc.y, { width });
    doc.moveDown(0.9);

    // --- The terms at a glance ----------------------------------------------------
    const t = c.terms;
    const facts: [string, string][] = [
      ['Starts', longDate(t.startDate)],
      ['Ends', longDate(t.endDate)],
      ['Monthly rent', formatRwf(t.monthlyRentRwf)],
      ['Rent due', `the ${ordinal(t.rentDueDay)} of each month`],
      ['Deposit', t.depositRwf > 0 ? formatRwf(t.depositRwf) : 'None'],
      ['Late after', t.graceDays > 0 ? `${t.graceDays} ${t.graceDays === 1 ? 'day' : 'days'}` : 'the due day'],
      ['Notice', `${t.noticeDays} days`],
      ['Living there', t.occupants.length > 0 ? `the tenant and ${t.occupants.join(', ')}` : 'the tenant'],
    ];
    if (t.billingStartsOn && t.billingStartsOn > t.startDate) facts.splice(2, 0, ['Billed from', longDate(t.billingStartsOn)]);
    termsGrid(doc, facts, left, width);
    doc.moveDown(1);

    // --- The clauses --------------------------------------------------------------
    c.clauses.forEach((clause, i) => {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(pdfText(`${i + 1}. ${clause.heading}`), left, doc.y, { width });
      doc.moveDown(0.15);
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(pdfText(clause.body), left, doc.y, { width, lineGap: 2 });
      doc.moveDown(0.7);
    });

    // --- Signatures: one block per side, the drawing over the typed name -----------
    if (doc.y > doc.page.height - 220) doc.addPage();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Signatures', left, doc.y, { width });
    doc.moveDown(0.5);
    const blockTop = doc.y;
    (['landlord', 'tenant'] as const).forEach((role, i) => {
      const x = left + i * (half + 24);
      const sig = input.signatures.find((s) => s.role === role) ?? null;
      const name = role === 'landlord' ? `${landlord.signatoryName}, for ${landlord.legalName}` : tenant.fullName;
      let y = blockTop;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(role === 'landlord' ? 'LANDLORD' : 'TENANT', x, y, { width: half, characterSpacing: 0.4 });
      y = doc.y + 4;
      if (sig?.drawing) {
        try {
          doc.image(sig.drawing, x, y, { fit: [half, 56] });
        } catch {
          // A drawing that will not decode leaves the typed name to stand alone.
        }
      } else if (sig?.typedName) {
        doc.font('Helvetica-Oblique').fontSize(16).fillColor(INK).text(pdfText(sig.typedName), x, y + 24, { width: half });
      }
      y += 60;
      doc.moveTo(x, y).lineTo(x + half, y).lineWidth(0.75).strokeColor(LINE).stroke();
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(pdfText(name), x, y + 4, { width: half });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(sig ? `Signed electronically ${stamp(sig.signedAt)}` : 'Not signed yet', x, doc.y + 1, { width: half });
    });
    doc.x = left;
    doc.moveDown(2);

    // --- The audit trail, on its own page, once anyone has signed --------------------
    if (input.signatures.length > 0) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('Audit trail', left, 56, { width });
      doc.moveDown(0.3);
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(MUTED)
        .text(
          pdfText(
            `Signed electronically under ${E_SIGNATURE_LAW}. Each signer typed their full name as the contract states it ` +
              'and confirmed it was them before the signature was recorded. The fingerprint below is the SHA-256 of the ' +
              'contract text; a copy whose text differs has a different fingerprint.',
          ),
          { width, lineGap: 1.5 },
        );
      doc.moveDown(0.8);
      fact(doc, 'Document', pdfText(`${c.title}, ${c.premisesLine}`), left, width);
      fact(doc, 'Lease', `${input.reference} (${input.leaseId})`, left, width);
      fact(doc, 'Version', String(input.version), left, width);
      fact(doc, 'SHA-256', input.documentHash, left, width);
      fact(doc, 'Issued', stamp(new Date(c.issuedAt)), left, width);
      doc.moveDown(0.6);
      for (const sig of input.signatures) {
        doc
          .font('Helvetica-Bold')
          .fontSize(10.5)
          .fillColor(INK)
          .text(`${sig.role === 'landlord' ? 'Landlord' : 'Tenant'} signed`, left, doc.y, { width });
        doc.moveDown(0.2);
        fact(doc, 'Typed name', pdfText(sig.typedName ?? 'Not recorded'), left, width);
        fact(doc, 'Email', pdfText(sig.email ?? 'Not recorded'), left, width);
        fact(doc, 'Signed at', stamp(sig.signedAt), left, width);
        fact(doc, 'Confirmed', confirmedWords(sig), left, width);
        fact(doc, 'Drawn signature', sig.drawing ? 'Yes' : 'No, typed name only', left, width);
        fact(doc, 'IP address', sig.ip ?? 'Not recorded', left, width);
        fact(doc, 'Browser', pdfText(sig.userAgent ?? 'Not recorded'), left, width);
        doc.moveDown(0.6);
      }
      fact(doc, input.signed ? 'Signed copy made' : 'Copy made', stamp(input.generatedAt), left, width);
    }

    // --- Every page says what this file is and where it stands ------------------------
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(i);
      // Below the bottom margin, which would otherwise start a new page.
      const margin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `${input.signed ? 'Signed lease' : 'Preview, not signed'}  |  ${input.reference} v${input.version}  |  SHA-256 ${input.documentHash.slice(0, 16)}  |  Page ${i + 1} of ${pages.count}`,
          left,
          doc.page.height - 36,
          { width, align: 'center', lineBreak: false },
        );
      doc.page.margins.bottom = margin;
    }
    doc.end();
  });
}

function partyBlock(doc: PDFKit.PDFDocument, title: string, lines: string[], x: number, y: number, width: number): void {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(title.toUpperCase(), x, y, { width, characterSpacing: 0.4 });
  doc.moveDown(0.15);
  lines
    .filter((line) => line.trim().length > 0)
    .forEach((line, i) => {
      doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(INK).text(pdfText(line), x, doc.y, { width });
    });
}

/** The terms in two columns of label and value, on a soft band. */
function termsGrid(doc: PDFKit.PDFDocument, facts: [string, string][], left: number, width: number): void {
  const rows = Math.ceil(facts.length / 2);
  const rowHeight = 30;
  const top = doc.y;
  doc.rect(left, top, width, rows * rowHeight + 12).fill(SOFT);
  const colWidth = (width - 24) / 2;
  facts.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = left + 12 + col * colWidth;
    const y = top + 8 + row * rowHeight;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y, { width: colWidth - 12, characterSpacing: 0.3 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(pdfText(value), x, y + 11, { width: colWidth - 12, lineBreak: false, ellipsis: true });
  });
  doc.x = left;
  doc.y = top + rows * rowHeight + 12;
}

function fact(doc: PDFKit.PDFDocument, label: string, value: string, left: number, width: number): void {
  const y = doc.y;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, left, y, { width: 110 });
  doc.font('Helvetica').fontSize(9).fillColor(INK).text(value, left + 116, y, { width: width - 116 });
  doc.moveDown(0.25);
}

function confirmedWords(sig: PdfSignature): string {
  if (sig.method === 'legacy' || !sig.verifiedAt) return 'Signed before Injishi recorded e-signatures';
  return `${stamp(sig.verifiedAt)}, ${sig.method === 'password' ? 'with their Injishi password' : 'with a code emailed to them'}`;
}

/** `22 October 2026, 14:05 Kigali time`. Kigali is UTC+2 all year; no locale tables. */
export function stamp(d: Date): string {
  const k = new Date(d.getTime() + 2 * 3_600_000);
  const time = `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
  return `${longDate(k.toISOString().slice(0, 10))}, ${time} Kigali time`;
}

/**
 * Text Helvetica can print. The standard PDF fonts cover Latin-1 (WinAnsi):
 * accented names print as typed, typographic quotes and dashes become their
 * plain forms, and anything else is reduced to its base letters or dropped,
 * rather than printing as garbage.
 */
export function pdfText(value: string): string {
  return value
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '*')
    .replace(/[^\u0000-ÿ]/g, (ch) => ch.normalize('NFKD').replace(/[^\u0000-ÿ]/g, ''));
}
