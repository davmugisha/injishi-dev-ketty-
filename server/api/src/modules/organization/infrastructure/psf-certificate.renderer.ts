import fontkit from '@pdf-lib/fontkit';
import { psfCardBand, psfCardHoneycomb, psfLevelColours, psfPaperPattern } from '@injishi/contracts';
import { encodeQr } from '@injishi/qr';
import { PDFDocument, StandardFonts, clip, degrees, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

import { FIGTREE_BOLD_BASE64 } from '../../hr/infrastructure/fonts/figtree-bold';
import { FIGTREE_REGULAR_BASE64 } from '../../hr/infrastructure/fonts/figtree-regular';
import { PSF_LOGO_PNG_BASE64 } from './assets/psf-logo';

/**
 * The PSF membership certificate and card as PDFs (2026-11-06, the owner's reform of PSF's own card):
 * each level has its colours, and each member's papers carry a line pattern drawn from their membership
 * number, so no two are alike. Both name the business and sector large, the level without its amount, and
 * carry a QR that opens the member's public card.
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
  /** The business's PSF sector and kind (2026-11-05): printed large, under its name. */
  sectorName: string | null;
  /** The level, as PSF names it: "Indatwa", never the band's amount. */
  levelName: string;
  /** The level's code, which picks its colours (2026-11-06). Falls back on the name. */
  levelCode?: string;
  /** What the band's ribbon says, like Bronze (2026-11-06). */
  badge?: string | null;
  /** The person who holds it, named on the card (2026-11-06). */
  ownerName?: string | null;
  membershipNumber: string;
  startsOn: string;
  expiresOn: string;
  /** Null for a member PSF confirmed from its card (2026-11-02): no application, so no docID; its code stands in. */
  docId: string | null;
  /** Who decided: "PSF Gasabo district office". */
  issuedBy: string;
  /** The tracking page, which the QR opens. */
  trackUrl: string;
  /** The business's own logo (2026-10-23), a PNG or JPEG; printed at the foot when given. */
  businessLogo?: { bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null;
  /** The owner's passport photo (2026-11-05), a PNG or JPEG; printed when given. */
  ownerPhoto?: { bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null;
}

/** A4 landscape, in points. */
const W = 841.89;
const H = 595.28;

const PAPER = rgb(0.984, 0.984, 0.972);
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

type Palette = { ground: RGB; ground2: RGB; accent: RGB; ink: RGB; soft: RGB };

const hex = (v: string): RGB => rgb(parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255);

function paletteOf(f: PsfCertificateFacts): Palette {
  const { ground, ground2, accent } = psfLevelColours(f.levelCode ?? f.levelName);
  return { ground: hex(ground), ground2: hex(ground2), accent: hex(accent), ink: rgb(1, 1, 1), soft: rgb(0.8, 0.82, 0.84) };
}

/** The member's own line pattern, the same one the tracking page shows; kept inside its box. */
function drawPattern(page: PDFPage, number: string, box: { x: number; y: number; w: number; h: number }, color: RGB, opacity: number): void {
  const { x, y, w, h } = box;
  const { paths, strokeWidth } = psfPaperPattern(number, w, h);
  page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
  // Paths count from the top left of the point they are drawn at.
  for (const path of paths) page.drawSvgPath(path, { x, y: y + h, borderColor: color, borderWidth: strokeWidth, borderOpacity: opacity });
  page.pushOperators(popGraphicsState());
}

const BADGE_COLOUR: Record<string, RGB> = {
  bronze: hex('#c9927b'),
  silver: hex('#c7ccd4'),
  gold: hex('#d9be6d'),
  platinum: hex('#e7e7ee'),
};

/** The band's ribbon, like the one on PSF's own card. */
function drawRibbon(page: PDFPage, x: number, y: number, width: number, height: number, color: RGB): void {
  page.drawSvgPath(`M 0 0 L ${width} 0 L ${width} ${height} L ${width / 2} ${height * 0.78} L 0 ${height} Z`, { x, y: y + height, color });
}

/** PSF's own lines wrap at spaces, to a width. */
function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

async function embedPicture(pdf: PDFDocument, picture: PsfCertificateFacts['ownerPhoto']): Promise<Awaited<ReturnType<PDFDocument['embedPng']>> | null> {
  if (!picture) return null;
  try {
    return picture.mime === 'image/png' ? await pdf.embedPng(picture.bytes) : await pdf.embedJpg(picture.bytes);
  } catch {
    // A file pdf-lib cannot read leaves the paper without it, rather than failing it.
    return null;
  }
}

/** A picture filling its frame, centred; the part that does not fit is cut, never stretched. */
function drawCover(page: PDFPage, picture: Awaited<ReturnType<PDFDocument['embedPng']>>, x: number, y: number, width: number, height: number): void {
  const scale = Math.max(width / picture.width, height / picture.height);
  const w = picture.width * scale;
  const h = picture.height * scale;
  // pdf-lib has no clip for images on its own surface, so a crop goes through the page's operators.
  page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
  page.drawImage(picture, { x: x + (width - w) / 2, y: y + (height - h) / 2, width: w, height: h });
  page.pushOperators(popGraphicsState());
}

/** dd/mm/yyyy, as PSF's card prints it. */
function shortDay(iso: string | null): string {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export async function renderPsfCertificate(f: PsfCertificateFacts): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`PSF membership certificate, ${f.businessName}`);
  pdf.setAuthor('Private Sector Federation, PSF Membership Hub');
  pdf.setSubject(`Membership ${f.membershipNumber}`);
  const page = pdf.addPage([W, H]);
  const sans = await pdf.embedFont(Buffer.from(FIGTREE_REGULAR_BASE64, 'base64'), { subset: true });
  const sansBold = await pdf.embedFont(Buffer.from(FIGTREE_BOLD_BASE64, 'base64'), { subset: true });
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const logo = await pdf.embedPng(Buffer.from(PSF_LOGO_PNG_BASE64, 'base64'));
  const colours = paletteOf(f);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });

  // The member's panel: the level's colours, their pattern, their face.
  const panel = 226;
  page.drawRectangle({ x: 0, y: 0, width: panel, height: H, color: colours.ground });
  drawPattern(page, f.membershipNumber, { x: 0, y: 0, w: panel, h: H }, colours.accent, 0.3);
  page.drawRectangle({ x: panel, y: 0, width: 3, height: H, color: colours.accent });

  const logoH = 64;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: panel / 2 - logoW / 2, y: H - 34 - logoH, width: logoW, height: logoH });
  centered(page, 'Private Sector Federation', H - 116, sansBold, 11.5, colours.ink, panel / 2);
  spaced(page, 'RWANDA', panel / 2, H - 130, sans, 7, colours.accent, 3, 'center');

  const photoW = 112;
  const photoH = 140;
  const photoX = panel / 2 - photoW / 2;
  const photoY = H - 292;
  const face = await embedPicture(pdf, f.ownerPhoto);
  if (face) {
    drawCover(page, face, photoX, photoY, photoW, photoH);
    page.drawRectangle({ x: photoX, y: photoY, width: photoW, height: photoH, borderColor: colours.accent, borderWidth: 1.2 });
  }
  if (f.ownerName) {
    const owner = f.ownerName;
    centered(page, owner, photoY - 18, sansBold, Math.min(11, fit(sansBold, owner, 11, panel - 28)), colours.ink, panel / 2);
  }

  const qr = 74;
  drawQr(page, f.trackUrl, panel / 2 - qr / 2, 62, qr);
  spaced(page, 'SCAN TO VERIFY', panel / 2, 48, sans, 6.5, colours.ink, 1.8, 'center');
  centered(page, f.membershipNumber, 30, sansBold, Math.min(9, fit(sansBold, f.membershipNumber, 9, panel - 28)), colours.accent, panel / 2);

  // The certificate itself.
  const left = panel + 3;
  const cx = left + (W - left) / 2;
  const room = W - left - 70;
  const heading = colours.ground;
  spaced(page, 'MEMBERSHIP CERTIFICATE', W - 36, H - 40, sans, 7.5, MUTED, 2.2, 'right');
  const ref = f.docId ? `DOCID ${f.docId}` : `NO. ${f.membershipNumber}`;
  spaced(page, ref, W - 36, H - 53, sans, 7.5, MUTED, 2.2, 'right');

  centered(page, 'Certificate of Membership', H - 112, serif, 38, heading, cx);
  page.drawRectangle({ x: cx - 34, y: H - 128, width: 68, height: 2, color: colours.accent });
  spaced(page, 'THIS CERTIFIES THAT', cx, H - 156, sans, 8, INK, 2.8, 'center');
  const name = safe(f.businessName);
  // The business and its sector are the biggest things on the page (2026-11-05).
  centered(page, name, H - 204, serif, fit(serif, name, 44, room), heading, cx);
  const sector = f.sectorName ? safe(f.sectorName) : null;
  if (sector) centered(page, sector, H - 234, sansBold, fit(sansBold, sector, 19, room), heading, cx);
  const where = [f.businessCode ? `Business code ${f.businessCode}` : null, f.districtName].filter(Boolean).join('   ·   ');
  if (where) centered(page, where, H - 254, sans, 11, MUTED, cx);
  centered(page, 'is a member of the Private Sector Federation, at the level of', H - 288, sans, 11.5, MUTED, cx);
  const level = f.badge ? `${f.levelName}  ·  ${f.badge}` : f.levelName;
  centered(page, level, H - 318, sansBold, 22, heading, cx);

  // Three facts, side by side.
  const facts: [string, string][] = [
    ['MEMBERSHIP NUMBER', f.membershipNumber],
    ['VALID FROM', day(f.startsOn)],
    ['VALID UNTIL', day(f.expiresOn)],
  ];
  const colW = Math.min(170, room / 3);
  const start = cx - (colW * 3) / 2;
  facts.forEach(([label, value], i) => {
    const at = start + colW * i + colW / 2;
    spaced(page, label, at, H - 372, sans, 7, MUTED, 2.2, 'center');
    centered(page, value, H - 392, sans, fit(sans, value, 13, colW - 16), INK, at);
    if (i > 0) page.drawLine({ start: { x: start + colW * i, y: H - 398 }, end: { x: start + colW * i, y: H - 360 }, thickness: 0.6, color: MIST });
  });

  // Who issued it, where a signature sits.
  const sx = left + 56;
  centered(page, day(f.startsOn), 92, sans, 11, INK, sx + 80);
  page.drawLine({ start: { x: sx, y: 82 }, end: { x: sx + 160, y: 82 }, thickness: 0.8, color: colours.accent });
  spaced(page, 'ISSUED BY', sx + 80, 68, sansBold, 7.5, INK, 2.6, 'center');
  spaced(page, f.issuedBy.toUpperCase(), sx + 80, 56, sans, 6.5, MUTED, 1.6, 'center');

  // The business's own logo, fitted inside its box, never stretched.
  const mark = await embedPicture(pdf, f.businessLogo);
  if (mark) {
    const scale = Math.min(150 / mark.width, 70 / mark.height);
    page.drawImage(mark, { x: W - 56 - mark.width * scale, y: 52 + (70 - mark.height * scale) / 2, width: mark.width * scale, height: mark.height * scale });
  }

  centered(page, `PSF Membership Hub  ·  Powered by Hangaa Softwares  ·  ${f.trackUrl}`, 24, sans, 6.5, MUTED, cx);

  return Buffer.from(await pdf.save());
}

/**
 * The membership card (2026-11-06): two sides, like PSF's own. The front is flat in the level's colour with
 * the member's own band of lines, their name, sector, business, number and photo, and the band's ribbon.
 * The back keeps PSF's return address and terms over a honeycomb, with the dates and a QR that opens the
 * public card.
 */
export async function renderPsfCard(f: PsfCertificateFacts): Promise<Buffer> {
  const w = 360;
  const h = 227;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`PSF membership card, ${f.businessName}`);
  pdf.setAuthor('Private Sector Federation, PSF Membership Hub');
  pdf.setSubject(`Membership ${f.membershipNumber}`);
  const sans = await pdf.embedFont(Buffer.from(FIGTREE_REGULAR_BASE64, 'base64'), { subset: true });
  const sansBold = await pdf.embedFont(Buffer.from(FIGTREE_BOLD_BASE64, 'base64'), { subset: true });
  const logo = await pdf.embedPng(Buffer.from(PSF_LOGO_PNG_BASE64, 'base64'));
  const colours = paletteOf(f);
  const m = 16;

  // --- The front ---
  // Flat ground and one band of crisp lines: the card speaks through the member's own figure.
  const front = pdf.addPage([w, h]);
  front.drawRectangle({ x: 0, y: 0, width: w, height: h, color: colours.ground });

  // What this card is, read upward along the left edge.
  const upright = (text: string, x: number, font: PDFFont, color: RGB, size: number, spacing: number): void => {
    const room = h - m * 2;
    const scale = Math.min(1, room / spacedWidth(font, text, size, spacing));
    let at = m;
    for (const ch of text) {
      front.drawText(ch, { x, y: at, size: size * scale, font, color, rotate: degrees(90) });
      at += (font.widthOfTextAtSize(ch, size) + spacing) * scale;
    }
  };
  upright(f.levelName.toUpperCase(), m + 8, sansBold, colours.accent, 9, 2.4);
  upright('MEMBERSHIP CARD', m + 23, sans, colours.ink, 8, 3);

  // The member's own band of lines.
  const bandX = 84;
  const band = psfCardBand(f.membershipNumber, h);
  front.pushOperators(pushGraphicsState(), rectangle(0, 0, w, h), clip(), endPath());
  for (const path of band.paths) front.drawSvgPath(path, { x: bandX, y: h, borderColor: colours.accent, borderWidth: band.strokeWidth });
  front.pushOperators(popGraphicsState());

  const left = 132;
  const right = w - m;
  /** Text on one line, shrunk to its width if it must be. */
  const line = (page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB, width: number): void => {
    page.drawText(text, { x, y, size: Math.min(size, size * (width / font.widthOfTextAtSize(text, size))), font, color });
  };

  // PSF at the head, a fine rule beneath it.
  const logoH = 38;
  const logoW = (logo.width / logo.height) * logoH;
  front.drawImage(logo, { x: left, y: h - m - logoH, width: logoW, height: logoH });
  const headX = left + logoW + 8;
  front.drawText('PRIVATE SECTOR', { x: headX, y: h - m - 13, size: 9, font: sansBold, color: colours.ink });
  front.drawText('FEDERATION-RWANDA', { x: headX, y: h - m - 24, size: 9, font: sansBold, color: colours.ink });
  if (f.levelCode === 'golden_circle') {
    front.drawText('THE ULTIMATE BUSINESS NETWORK', { x: headX, y: h - m - 35, size: 5.2, font: sans, color: colours.accent });
  }
  front.drawLine({ start: { x: left, y: h - m - logoH - 8 }, end: { x: right, y: h - m - logoH - 8 }, thickness: 0.5, color: colours.ink });

  // The photo, right of the name, in the level's accent; an empty frame on a card from before photos.
  const photoW = 58;
  const photoH = 72;
  const photoX = right - photoW;
  const photoY = h - m - logoH - 16 - photoH;
  front.drawRectangle({ x: photoX, y: photoY, width: photoW, height: photoH, color: colours.ground2 });
  const face = await embedPicture(pdf, f.ownerPhoto);
  if (face) drawCover(front, face, photoX, photoY, photoW, photoH);
  front.drawRectangle({ x: photoX, y: photoY, width: photoW, height: photoH, borderColor: colours.accent, borderWidth: 0.8 });

  // Who holds it, their sector in the accent, then the business.
  const textW = photoX - left - 10;
  let y = h - m - logoH - 26;
  front.drawText('Name', { x: left, y, size: 6.5, font: sans, color: colours.soft });
  y -= 15;
  line(front, f.ownerName ?? f.businessName, left, y, sansBold, 14, colours.ink, textW);
  if (f.sectorName) {
    y -= 12;
    line(front, f.sectorName, left, y, sansBold, 7, colours.accent, textW);
  }
  if (f.ownerName) {
    y -= 12;
    line(front, f.businessName, left, y, sans, 8.5, colours.ink, textW);
  }

  // The number along the foot. The dates are on the back, as on PSF's own card.
  const footRoom = f.badge ? right - left - 92 : right - left;
  front.drawText('Number', { x: left, y: 29, size: 6.5, font: sans, color: colours.soft });
  line(front, f.membershipNumber, left, 16, sansBold, 11, colours.ink, footRoom);

  // The band's ribbon, bottom right.
  if (f.badge) {
    const colour = BADGE_COLOUR[f.badge.trim().toLowerCase()] ?? colours.accent;
    const ribbonW = 17;
    const ribbonH = 25;
    const rx = right - ribbonW;
    drawRibbon(front, rx, 12, ribbonW, ribbonH, colour);
    const label = f.badge.toUpperCase();
    front.drawText(label, { x: rx - 6 - sansBold.widthOfTextAtSize(label, 11), y: 20, size: 11, font: sansBold, color: colour });
  }

  // --- The back ---
  // A honeycomb from the member's number, quiet enough to read over.
  const back = pdf.addPage([w, h]);
  back.drawRectangle({ x: 0, y: 0, width: w, height: h, color: colours.ground });
  const comb = psfCardHoneycomb(f.membershipNumber, w, h);
  back.pushOperators(pushGraphicsState(), rectangle(0, 0, w, h), clip(), endPath());
  for (const path of comb.filled) back.drawSvgPath(path, { x: 0, y: h, color: colours.ground2, opacity: 0.8 });
  for (const path of comb.outlines) back.drawSvgPath(path, { x: 0, y: h, borderColor: colours.accent, borderWidth: 0.35, borderOpacity: 0.16 });
  back.pushOperators(popGraphicsState());
  const cx = w / 2;
  centered(back, 'PRIVATE SECTOR FEDERATION-RWANDA', h - 26, sansBold, 10.5, colours.ink, cx);
  centered(back, 'If found please return to PSF offices Gikondo MAGERWA.', h - 42, sans, 7.5, colours.soft, cx);
  centered(back, 'P. O. Box 319, Kigali - Rwanda. Tel: +250-252-570650', h - 52, sans, 7.5, colours.soft, cx);

  const qr = 62;
  const boxesW = w - m * 2 - qr - 12;
  const dateBox = (label: string, value: string, y: number): void => {
    back.drawRectangle({ x: m, y, width: boxesW, height: 25, color: colours.ground, opacity: 0.7, borderColor: colours.accent, borderWidth: 0.5, borderOpacity: 0.8 });
    back.drawText(label, { x: m + 8, y: y + 8.5, size: 8, font: sansBold, color: colours.accent });
    const vw = sansBold.widthOfTextAtSize(value, 10);
    back.drawText(value, { x: m + boxesW - 8 - vw, y: y + 8, size: 10, font: sansBold, color: colours.ink });
  };
  const qrY = h - 66 - qr;
  dateBox('Valid from:', shortDay(f.startsOn), qrY + 33);
  dateBox('Expiry date:', shortDay(f.expiresOn), qrY + 4);
  drawQr(back, f.trackUrl, w - m - qr, qrY, qr);

  const terms = `This Card is issued by and is the property of PRIVATE SECTOR FEDERATION (PSF) RWANDA, it must be returned upon request. This card is strictly personal, subject to general terms and conditions of use. The card entitles the bearer access to PSF ${f.levelName} membership services.`;
  wrap(sans, terms, 6.8, w - m * 2 - 8).forEach((text, i) => {
    centered(back, text, qrY - 16 - i * 9.4, sans, 6.8, colours.soft, cx);
  });

  const site = 'www.psf.org.rw';
  const siteW = sansBold.widthOfTextAtSize(site, 7.5);
  back.drawLine({ start: { x: m, y: 25 }, end: { x: cx - siteW / 2 - 7, y: 25 }, thickness: 0.4, color: colours.accent });
  back.drawLine({ start: { x: cx + siteW / 2 + 7, y: 25 }, end: { x: w - m, y: 25 }, thickness: 0.4, color: colours.accent });
  centered(back, site, 22.5, sansBold, 7.5, colours.ink, cx);
  centered(back, 'Powered by Hangaa Softwares', 10, sans, 5.5, colours.soft, cx);

  return Buffer.from(await pdf.save());
}
