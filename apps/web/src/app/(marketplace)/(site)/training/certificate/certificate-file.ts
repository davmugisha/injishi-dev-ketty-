import { TRAINING_COURSE, TRAINING_QUESTION_COUNT } from "@/data/training";
import type { TrainingCertificate } from "@/lib/training-store";

/**
 * The certificate as a FILE the holder keeps, built as an SVG.
 *
 * WHY A FILE AT ALL, when the page can already print. Printing is the reliable
 * route and stays the primary one, but "save as PDF" is three dialogs deep on a
 * phone and produces nothing at all on a device with no printer driver. A host
 * in Musanze who has just passed the course should be able to press one button
 * and have the certificate on their device. That is what this is for.
 *
 * WHY SVG rather than a PDF or a PNG. A PDF writer is a dependency this
 * prototype may not add, and a canvas PNG is a fixed number of pixels that goes
 * soft the moment somebody projects it. An SVG is a text file the browser
 * writes itself, opens in every browser and image viewer, scales to a wall, and
 * — this is the part that matters for a certificate — carries its own text, so
 * the serial in it can be selected and searched rather than read off a picture.
 *
 * THERE IS NOT A COLOUR LITERAL IN THIS FILE, and that is a constraint rather
 * than an accident. A standalone file cannot resolve `var(--ink)`: it has left
 * the document that defines it. So the four colours are RESOLVED FROM THE LIVE
 * PAGE by the caller and passed in — see `certificate-screen.tsx` — which means
 * the downloaded file carries whatever the token package currently says, and
 * regenerating the palette moves it. Hardcoding `#042330` here would have been
 * a fifth definition of the brand's ink that no contrast measurement covers and
 * that `injishi/no-raw-color-classes` exists to refuse.
 *
 * THE LAYOUT MIRRORS `certificate-document.tsx` — the same crest, the same
 * award block, the same registry foot, the same footnote — because a downloaded
 * certificate that looks like a different document from the one on screen makes
 * a person wonder which of the two is real. It does not SHARE the markup: SVG
 * has no flow layout, so every line here is placed against a fixed baseline,
 * and pretending the two could be one component would mean writing the screen
 * as absolute coordinates too.
 */

const MODULE = TRAINING_COURSE.modules[0];

/** A4 landscape at 96dpi, so one SVG user unit is one CSS pixel on a sheet. */
const WIDTH = 1123;
const HEIGHT = 794;

/**
 * The four colours the document is drawn in, resolved from the live page.
 *
 * The names match the CSS custom properties in `certificate.module.css` so that
 * the two can be read side by side.
 */
export interface CertificateInk {
  paper: string;
  ink: string;
  rule: string;
  seal: string;
}

export interface CertificateFileInput {
  certificate: TrainingCertificate;
  holder: string;
  /** The issue date, already formatted — the screen and the file agree on it. */
  issuedOn: string;
  ink: CertificateInk;
}

/**
 * XML-escape a value that came from a person.
 *
 * The holder's name and the delivery address are typed on the enrolment form,
 * so `Mukamana & Fils` and an address with an `&` in it both reach this
 * function. Unescaped, either produces an SVG the browser refuses to open —
 * which is a broken download rather than a broken page, and therefore the kind
 * of failure nobody notices until a demonstration.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The type size for the holder's name.
 *
 * SVG does not wrap, so a long name would run off both edges of the sheet at a
 * fixed size. `textLength` was tried and is worse: it squeezes a long name into
 * the same width as a short one, which reads as a rendering fault rather than a
 * long name. Stepping the size down at two lengths keeps the letterforms in
 * proportion and keeps every certificate looking like the same document.
 */
function holderSize(holder: string): number {
  if (holder.length > 34) return 44;
  if (holder.length > 24) return 56;
  return 68;
}

/** One `<text>` line, centred on the sheet's axis. */
function line(
  y: number,
  content: string,
  attrs: Record<string, string | number>,
): string {
  const rendered = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle" ${rendered}>${xml(content)}</text>`;
}

/**
 * The certificate as SVG source.
 *
 * Exported separately from the download so it can be built and inspected
 * without a browser — the failure this avoids is a file that only turns out to
 * be malformed once somebody has pressed the button in front of a room.
 */
export function certificateSvg(input: CertificateFileInput): string {
  const { certificate, holder, issuedOn, ink } = input;

  const serif = "Spectral, Georgia, 'Times New Roman', serif";
  const sans = "Figtree, Helvetica, Arial, sans-serif";

  const sealCentre = { x: WIDTH / 2, y: 626 };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${xml(
    `Certificate of completion for ${holder}, serial ${certificate.serial}`,
  )}">
  <title>${xml(`Injishi Software Training certificate — ${holder}`)}</title>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${ink.paper}"/>
  <rect x="14" y="14" width="${WIDTH - 28}" height="${HEIGHT - 28}" fill="none" stroke="${ink.rule}" stroke-width="1"/>
  <rect x="26" y="26" width="${WIDTH - 52}" height="${HEIGHT - 52}" fill="none" stroke="${ink.seal}" stroke-width="2"/>

  ${line(96, "Injishi · Rwanda", {
    fill: ink.ink,
    "font-family": sans,
    "font-size": 17,
    "font-weight": 700,
    "letter-spacing": 6,
  })}

  ${line(176, "Certificate of Completion", {
    fill: ink.ink,
    "font-family": serif,
    "font-size": 52,
  })}
  ${line(228, "This is to certify that", {
    fill: ink.rule,
    "font-family": sans,
    "font-size": 20,
  })}
  ${line(312, holder, {
    fill: ink.ink,
    "font-family": serif,
    "font-size": holderSize(holder),
    "font-weight": 600,
  })}
  <line x1="${WIDTH / 2 - 240}" y1="344" x2="${WIDTH / 2 + 240}" y2="344" stroke="${ink.rule}" stroke-width="1"/>
  ${line(392, "has completed every lesson and question set of the module", {
    fill: ink.rule,
    "font-family": sans,
    "font-size": 20,
  })}
  ${line(444, MODULE.title, {
    fill: ink.ink,
    "font-family": serif,
    "font-size": 36,
    "font-weight": 600,
  })}
  ${line(
    482,
    `${TRAINING_COURSE.title} · ${MODULE.lessons.length} lessons · ${TRAINING_QUESTION_COUNT} marked questions`,
    { fill: ink.rule, "font-family": sans, "font-size": 18 },
  )}
  ${line(524, `Awarded with a mark of ${certificate.score}%`, {
    fill: ink.ink,
    "font-family": sans,
    "font-size": 21,
    "font-weight": 700,
  })}

  <circle cx="${sealCentre.x}" cy="${sealCentre.y}" r="58" fill="none" stroke="${ink.seal}" stroke-width="3"/>
  <circle cx="${sealCentre.x}" cy="${sealCentre.y}" r="50" fill="none" stroke="${ink.seal}" stroke-width="1"/>
  ${line(sealCentre.y - 18, "Injishi", {
    fill: ink.ink,
    "font-family": sans,
    "font-size": 13,
    "font-weight": 700,
    "letter-spacing": 2.5,
  })}
  ${line(sealCentre.y + 14, "IST", {
    fill: ink.seal,
    "font-family": serif,
    "font-size": 30,
    "font-weight": 700,
  })}
  ${line(sealCentre.y + 36, "Training", {
    fill: ink.ink,
    "font-family": sans,
    "font-size": 13,
    "font-weight": 700,
    "letter-spacing": 2.5,
  })}

  <text x="72" y="606" fill="${ink.rule}" font-family="${sans}" font-size="13" font-weight="700" letter-spacing="2.2">DATE OF ISSUE</text>
  <text x="72" y="634" fill="${ink.ink}" font-family="${sans}" font-size="21" font-weight="700">${xml(issuedOn)}</text>

  <text x="${WIDTH - 72}" y="606" text-anchor="end" fill="${ink.rule}" font-family="${sans}" font-size="13" font-weight="700" letter-spacing="2.2">CERTIFICATE SERIAL</text>
  <text x="${WIDTH - 72}" y="634" text-anchor="end" fill="${ink.ink}" font-family="${sans}" font-size="21" font-weight="700">${xml(certificate.serial)}</text>

  ${line(
    716,
    `Demonstration certificate, issued by a prototype of the Injishi platform and delivered by e-mail to ${certificate.emailedTo}.`,
    { fill: ink.rule, "font-family": sans, "font-size": 15 },
  )}
  ${line(
    738,
    "The course is not accredited and this document is not a recognised qualification.",
    { fill: ink.rule, "font-family": sans, "font-size": 15 },
  )}
</svg>`;
}

/**
 * The file name the certificate lands on the holder's device as.
 *
 * The serial is in it on purpose: a person who takes the course, clears the
 * demo and takes it again ends up with two files, and `certificate.svg` twice
 * means the second silently becomes `certificate (1).svg` with no way to tell
 * which is which.
 */
export function certificateFileName(certificate: TrainingCertificate): string {
  return `injishi-training-certificate-${certificate.serial}.svg`;
}
