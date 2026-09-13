import { TRAINING_CREDENTIAL_WORDING } from '@injishi/contracts';
import { encodeQr } from '@injishi/qr';
import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type {
  CertificateFacts,
  CertificateRenderer,
} from '../domain/training-certificate';

/**
 * The certificate PDF (AC-12, AC-13, AC-31).
 *
 * WHAT IT MUST CARRY, and why each one is on the paper rather than only in the
 * database: the holder name (who), the course title and version (what), the
 * session date (when), the venue (where), the lead trainer name (on whose
 * word), the serial (so it can be quoted down a phone line) and the QR (so it
 * can be checked by a stranger in ten seconds). Remove any one and the
 * document stops being checkable by the person holding it.
 *
 * WHAT IT MUST NOT CARRY: the holder's business name (AC-12), and any word
 * claiming competence (AC-31). Both are enforced upstream of the drawing code,
 * the first by `CertificateFacts` having no field for it and the second by the
 * claim line coming from `TRAINING_CREDENTIAL_WORDING` rather than being typed
 * here.
 *
 * WHY `pdf-lib` AND VECTOR DRAWING, rather than HTML through a headless
 * browser. The `pdf-tools` skill prefers Puppeteer for pixel-perfect
 * HTML-to-PDF, and ADR-049 decided against it: a browser in the API image is
 * two hundred megabytes and a sandbox to keep working, for a document that is
 * a dozen strings and a square of modules. The spec wins for the feature it
 * governs. The trade is that layout here is arithmetic rather than CSS, which
 * is why every position below is derived from named constants instead of being
 * sprinkled through the calls.
 *
 * THE ARTWORK IS NOT SPECIFIED, and ADR-049 says so in as many words: its
 * follow-up list carries "certificate artwork is unspecified" and its verify
 * checklist explicitly does not judge whether the result is handsome, only
 * whether the values are on it and correct. So this is a deliberately plain,
 * typographic document using the fonts every PDF reader already has. It is the
 * honest placeholder for a decision nobody has taken, not an attempt at one.
 *
 * NO EMBEDDED FONT FILE, and that is a containerisation choice: the `pdf-tools`
 * skill's warning about skipping font embedding applies to Puppeteer, which
 * renders with the system's fonts. `StandardFonts` are the fourteen faces
 * baked into the PDF specification itself, so this renders identically on a
 * laptop and in a scratch container with no fonts installed at all.
 */

/** A4 landscape, in PDF points (72 per inch). */
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 48;

/** The QR's drawn edge, and the module grid's quiet zone in modules. */
const QR_SIZE = 116;
const QUIET_ZONE = 4;

const INK = rgb(0.09, 0.11, 0.13);
const MUTED = rgb(0.42, 0.46, 0.5);
const RULE = rgb(0.82, 0.85, 0.87);
const ACCENT = rgb(0.04, 0.42, 0.4);

@Injectable()
export class PdfCertificateRenderer implements CertificateRenderer {
  async render(facts: CertificateFacts): Promise<Buffer> {
    const doc = await PDFDocument.create();

    // Metadata, so a file sitting in somebody's downloads folder still says
    // what it is. `Producer` is deliberately not a version string: it would
    // change on every dependency bump and make two identical certificates
    // differ byte for byte.
    doc.setTitle(`Injishi training certificate ${facts.serial}`);
    doc.setSubject(facts.courseTitle);
    doc.setAuthor('Injishi');
    doc.setProducer('Injishi');
    doc.setCreator('Injishi');

    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    // A border, inset from the trim, so that a page printed slightly off
    // centre still looks deliberate.
    page.drawRectangle({
      x: MARGIN / 2,
      y: MARGIN / 2,
      width: PAGE_WIDTH - MARGIN,
      height: PAGE_HEIGHT - MARGIN,
      borderColor: RULE,
      borderWidth: 1,
    });

    let y = PAGE_HEIGHT - MARGIN - 28;

    page.drawText('INJISHI', {
      x: MARGIN,
      y,
      size: 13,
      font: bold,
      color: ACCENT,
    });
    page.drawText('Certificate of attendance', {
      x: MARGIN,
      y: y - 22,
      size: 11,
      font: regular,
      color: MUTED,
    });

    y -= 86;

    // The holder. The largest thing on the page, because it is the claim.
    page.drawText(facts.holderName, {
      x: MARGIN,
      y,
      size: 34,
      font: bold,
      color: INK,
    });

    y -= 30;

    // The claim itself, from the contracts constant. AC-31 lives here.
    page.drawText(TRAINING_CREDENTIAL_WORDING.pdfClaim, {
      x: MARGIN,
      y,
      size: 12,
      font: regular,
      color: MUTED,
    });

    y -= 40;

    page.drawText(facts.courseTitle, {
      x: MARGIN,
      y,
      size: 18,
      font: bold,
      color: INK,
    });

    y -= 20;

    page.drawText(`Version ${facts.courseVersion}`, {
      x: MARGIN,
      y,
      size: 10,
      font: regular,
      color: MUTED,
    });

    y -= 44;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN - QR_SIZE - 32, y },
      color: RULE,
      thickness: 1,
    });

    y -= 26;

    // The four facts, as labelled pairs in two columns. Laid out from
    // constants so that a longer venue name pushes nothing off the page.
    const columnWidth = (PAGE_WIDTH - MARGIN * 2 - QR_SIZE - 32) / 2;
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['Session date', facts.sessionDate],
      ['Venue', `${facts.venueName}, ${facts.districtName}`],
      ['Led by', facts.leadTrainerName],
      ['Issued', facts.issuedOn],
    ];

    pairs.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + column * columnWidth;
      const rowY = y - row * 44;

      page.drawText(label.toUpperCase(), {
        x,
        y: rowY,
        size: 7.5,
        font: bold,
        color: MUTED,
      });
      page.drawText(truncate(value, regular, 11, columnWidth - 16), {
        x,
        y: rowY - 15,
        size: 11,
        font: regular,
        color: INK,
      });
    });

    // The QR, bottom right, with its serial and its URL beneath it. Placed
    // last so nothing above can overlap it.
    const qrX = PAGE_WIDTH - MARGIN - QR_SIZE;
    const qrY = MARGIN + 52;
    this.drawQr(page, facts.verifyUrl, qrX, qrY);

    page.drawText(facts.serial, {
      x: qrX,
      y: qrY - 16,
      size: 9,
      font: bold,
      color: INK,
    });

    page.drawText('Scan to check this certificate', {
      x: MARGIN,
      y: MARGIN + 26,
      size: 9,
      font: regular,
      color: MUTED,
    });
    page.drawText(facts.verifyUrl, {
      x: MARGIN,
      y: MARGIN + 12,
      size: 8,
      font: regular,
      color: MUTED,
    });

    // `Buffer.from` because `save()` returns a `Uint8Array` and `StoragePort`
    // takes a `Buffer`. The copy is a view over the same memory, not a
    // duplicate of the bytes.
    return Buffer.from(await doc.save());
  }

  /**
   * The QR symbol, as filled squares.
   *
   * ONE RECTANGLE PER DARK MODULE, which is the thing to know before
   * "optimising" this: a vector square per module is what makes the symbol
   * resolution independent, so it rasterises crisply at whatever DPI the
   * printer has. An image would be a raster at one fixed size and is the
   * classic way a QR that scans on screen fails off paper.
   *
   * The quiet zone is drawn as white rather than left transparent, because the
   * standard requires four modules of LIGHT border and a transparent border
   * over coloured paper is not light.
   */
  private drawQr(
    page: ReturnType<PDFDocument['addPage']>,
    payload: string,
    x: number,
    y: number,
  ): void {
    const symbol = encodeQr(payload);
    const total = symbol.size + QUIET_ZONE * 2;
    const module = QR_SIZE / total;

    page.drawRectangle({
      x,
      y,
      width: QR_SIZE,
      height: QR_SIZE,
      color: rgb(1, 1, 1),
    });

    for (let row = 0; row < symbol.size; row += 1) {
      for (let column = 0; column < symbol.size; column += 1) {
        if (symbol.modules[row][column] !== 1) continue;
        page.drawRectangle({
          x: x + (column + QUIET_ZONE) * module,
          // PDF's origin is bottom left and a QR's first row is its top, so
          // the row index is flipped. Getting this wrong produces a symbol
          // that is a valid mirror image and scans on nothing.
          y: y + (total - 1 - (row + QUIET_ZONE)) * module,
          width: module,
          height: module,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
}

/**
 * Cut a string to fit a measured width, with an ellipsis.
 *
 * Measured with the real font rather than by counting characters, because
 * Helvetica is proportional and "Nyarugenge" is narrower than "MMMMMMMMMM".
 * A venue name that overflows silently would print over the QR, which is the
 * one element on the page that has to stay readable by a machine.
 */
function truncate(
  value: string,
  font: { widthOfTextAtSize(text: string, size: number): number },
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;

  let cut = value;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}
