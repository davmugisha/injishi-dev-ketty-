import fontkit from '@pdf-lib/fontkit';
import { encodeQr } from '@injishi/qr';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

import { FIGTREE_BOLD_BASE64 } from '../../people/infrastructure/fonts/figtree-bold';
import { FIGTREE_REGULAR_BASE64 } from '../../people/infrastructure/fonts/figtree-regular';
import { PSF_LOGO_PNG_BASE64 } from './assets/psf-logo';

/**
 * The PSF membership certificate as a PDF (2026-10-20, redrawn the same day
 * to the owner's design): PSF's logo and name at the head, the title and the
 * business in a serif, the level of membership without its amount, three
 * facts, who issued it, and a QR that opens the tracking page so whoever is
 * shown the paper can check it.
 *
 * Drawn with `pdf-lib`, like the training certificate and the payslip, so the
 * API image needs no browser. Figtree (embedded, from the payslip) carries
 * every letter of a name; the serif is the standard Times face, so text set in
 * it passes through `safe` first.
 */
export interface PsfCertificateFacts {
  businessName: string;
  businessCode: string | null;
  districtName: string | null;
  /** The level, as PSF names it: "Indatwa", never the band's amount. */
  levelName: string;
  membershipNumber: string;
  startsOn: string;
  expiresOn: string;
  docId: string;
  /** Who decided: "PSF Gasabo district office". */
  issuedBy: string;
  /** The tracking page, which the QR opens. */
  trackUrl: string;
  /** The business's own logo (2026-10-23), a PNG or JPEG; printed at the foot when given. */
  businessLogo?: { bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null;
}

/** A4 landscape, in points. */
const W = 841.89;
const H = 595.28;

const PAPER = rgb(0.984, 0.984, 0.972);
const DEEP = rgb(0.07, 0.25, 0.17);
const GREEN = rgb(0.13, 0.42, 0.26);
const SAGE = rgb(0.45, 0.62, 0.5);
const MIST = rgb(0.72, 0.81, 0.74);
const INK = rgb(0.15, 0.18, 0.17);
const MUTED = rgb(0.4, 0.44, 0.42);

/** The standard Times face speaks WinAnsi only; anything else is replaced, never thrown on. */
function safe(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e -ÿ–—’·]/g, '?');
}

function day(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kigali' });
}

/** Width of text drawn with extra space between letters. */
function spacedWidth(font: PDFFont, text: string, size: number, spacing: number): number {
  return font.widthOfTextAtSize(text, size) + spacing * Math.max(0, text.length - 1);
}

/** Draw text with letter spacing, anchored left, centre or right at `x`. */
function spaced(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB, spacing: number, align: 'left' | 'center' | 'right' = 'left'): void {
  const width = spacedWidth(font, text, size, spacing);
  let at = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  for (const ch of text) {
    page.drawText(ch, { x: at, y, size, font, color });
    at += font.widthOfTextAtSize(ch, size) + spacing;
  }
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: RGB, cx = W / 2): void {
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

/** The largest size, from `max` down, at which the text fits the width. */
function fit(font: PDFFont, text: string, max: number, width: number): number {
  let size = max;
  while (size > 12 && font.widthOfTextAtSize(text, size) > width) size -= 1;
  return size;
}

function drawQr(page: PDFPage, payload: string, x: number, y: number, edge: number): void {
  const symbol = encodeQr(payload);
  const quiet = 2;
  const total = symbol.size + quiet * 2;
  const m = edge / total;
  page.drawRectangle({ x, y, width: edge, height: edge, color: rgb(1, 1, 1) });
  for (let row = 0; row < symbol.size; row += 1) {
    for (let col = 0; col < symbol.size; col += 1) {
      if (symbol.modules[row]![col] !== 1) continue;
      // PDF counts from the bottom; a QR's first row is its top.
      page.drawRectangle({ x: x + (col + quiet) * m, y: y + (total - 1 - (row + quiet)) * m, width: m, height: m, color: rgb(0, 0, 0) });
    }
  }
}

/** The leaf-like sweeps in two corners: overlapping discs, cut off by the page edge. */
function corners(page: PDFPage): void {
  page.drawEllipse({ x: W + 8, y: H - 14, xScale: 92, yScale: 70, color: MIST });
  page.drawEllipse({ x: W + 26, y: H + 6, xScale: 74, yScale: 62, color: SAGE });
  page.drawEllipse({ x: W + 34, y: H + 22, xScale: 52, yScale: 46, color: GREEN });
  page.drawEllipse({ x: 6, y: 18, xScale: 120, yScale: 104, color: MIST });
  page.drawEllipse({ x: -18, y: -8, xScale: 108, yScale: 92, color: SAGE });
  page.drawEllipse({ x: -36, y: -26, xScale: 88, yScale: 78, color: DEEP });
}

export async function renderPsfCertificate(f: PsfCertificateFacts): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`PSF membership certificate, ${f.businessName}`);
  pdf.setAuthor('Private Sector Federation, through Injishi');
  pdf.setSubject(`Membership ${f.membershipNumber}`);
  const page = pdf.addPage([W, H]);
  const sans = await pdf.embedFont(Buffer.from(FIGTREE_REGULAR_BASE64, 'base64'), { subset: true });
  const sansBold = await pdf.embedFont(Buffer.from(FIGTREE_BOLD_BASE64, 'base64'), { subset: true });
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const logo = await pdf.embedPng(Buffer.from(PSF_LOGO_PNG_BASE64, 'base64'));

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  corners(page);

  // The frame: a fine line, open where the corners sweep in.
  const inset = 20;
  const frame = { thickness: 0.8, color: SAGE };
  page.drawLine({ start: { x: inset, y: H - inset }, end: { x: W - 96, y: H - inset }, ...frame });
  page.drawLine({ start: { x: W - inset, y: H - 82 }, end: { x: W - inset, y: inset }, ...frame });
  page.drawLine({ start: { x: W - inset, y: inset }, end: { x: 122, y: inset }, ...frame });
  page.drawLine({ start: { x: inset, y: 128 }, end: { x: inset, y: H - inset }, ...frame });

  // PSF, at the head: its logo and its name.
  const logoH = 66;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: 58, y: H - 52 - logoH, width: logoW, height: logoH });
  const nameX = 58 + logoW + 14;
  page.drawText('Private Sector', { x: nameX, y: H - 78, size: 16, font: sansBold, color: DEEP });
  page.drawText('Federation', { x: nameX, y: H - 97, size: 16, font: sansBold, color: DEEP });
  spaced(page, 'BEYOND ADVOCACY', nameX, H - 114, sans, 7, GREEN, 2.6);

  // What this paper is, and its docID, top right.
  const right = W - 60;
  spaced(page, 'MEMBERSHIP CERTIFICATE', right, H - 72, sans, 7.5, INK, 2.4, 'right');
  spaced(page, `DOCID ${f.docId}`, right, H - 87, sans, 7.5, INK, 2.4, 'right');
  page.drawLine({ start: { x: right - spacedWidth(sans, `DOCID ${f.docId}`, 7.5, 2.4), y: H - 98 }, end: { x: right - spacedWidth(sans, `DOCID ${f.docId}`, 7.5, 2.4) + 46, y: H - 98 }, thickness: 1.2, color: SAGE });

  // The certificate itself.
  spaced(page, 'PRIVATE SECTOR FEDERATION', W / 2, H - 152, sansBold, 10, GREEN, 4.2, 'center');
  centered(page, 'Certificate of Membership', H - 200, serif, 46, DEEP);
  spaced(page, 'THIS CERTIFIES THAT', W / 2, H - 236, sans, 8, INK, 2.8, 'center');
  const name = safe(f.businessName);
  centered(page, name, H - 282, serif, fit(serif, name, 38, W - 200), DEEP);
  page.drawLine({ start: { x: W / 2 - 250, y: H - 300 }, end: { x: W / 2 + 250, y: H - 300 }, thickness: 0.8, color: SAGE });
  const where = [f.businessCode ? `Business code ${f.businessCode}` : null, f.districtName].filter(Boolean).join('   ·   ');
  if (where) centered(page, where, H - 324, sans, 11, MUTED);
  centered(page, 'is a member, at the level of', H - 350, sans, 11, MUTED);
  centered(page, f.levelName, H - 376, sansBold, 18, GREEN);

  // Three facts, side by side, divided by fine rules.
  const facts: [string, string][] = [
    ['MEMBERSHIP NUMBER', f.membershipNumber],
    ['VALID FROM', day(f.startsOn)],
    ['VALID UNTIL', day(f.expiresOn)],
  ];
  const colW = 190;
  const left = W / 2 - (colW * 3) / 2;
  facts.forEach(([label, value], i) => {
    const cx = left + colW * i + colW / 2;
    spaced(page, label, cx, H - 426, sans, 7, MUTED, 2.2, 'center');
    centered(page, value, H - 446, sans, fit(sans, value, 13, colW - 20), INK, cx);
    if (i > 0) page.drawLine({ start: { x: left + colW * i, y: H - 452 }, end: { x: left + colW * i, y: H - 414 }, thickness: 0.6, color: MIST });
  });

  // Who issued it, where a signature would sit.
  const sx = 150;
  centered(page, day(f.startsOn), 108, sans, 11, INK, sx + 75);
  page.drawLine({ start: { x: sx, y: 98 }, end: { x: sx + 150, y: 98 }, thickness: 0.8, color: SAGE });
  spaced(page, 'ISSUED BY', sx + 75, 84, sansBold, 7.5, INK, 2.6, 'center');
  spaced(page, f.issuedBy.toUpperCase(), sx + 75, 72, sans, 6.5, MUTED, 1.8, 'center');

  // The business's own logo, at the foot between who issued it and the QR:
  // fitted inside its box, never stretched. A file pdf-lib cannot read leaves
  // the certificate as it would be without one, rather than failing it.
  if (f.businessLogo) {
    try {
      const mark = f.businessLogo.mime === 'image/png' ? await pdf.embedPng(f.businessLogo.bytes) : await pdf.embedJpg(f.businessLogo.bytes);
      const scale = Math.min(160 / mark.width, 66 / mark.height);
      const w = mark.width * scale;
      const h = mark.height * scale;
      page.drawImage(mark, { x: W / 2 - w / 2, y: 58 + (66 - h) / 2, width: w, height: h });
    } catch {
      /* drawn without the logo */
    }
  }

  // How to check it.
  const qr = 62;
  drawQr(page, f.trackUrl, W - 62 - qr, 62, qr);
  spaced(page, 'SCAN TO VERIFY', W - 62 - qr / 2, 50, sans, 6, MUTED, 1.6, 'center');
  centered(page, `Issued through Injishi  ·  ${f.trackUrl}`, 30, sans, 6.5, MUTED);

  return Buffer.from(await pdf.save());
}
