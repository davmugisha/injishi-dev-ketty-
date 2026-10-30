/**
 * What a mock can honestly tell from an image without reading it.
 *
 * There is no OCR and no face matching here, and pretending otherwise would be
 * the worst kind of mock. A provider's verdict is decided by the register row
 * the document names and by a few checks a mock CAN make:
 *
 * - An image under 2 KB is unreadable: nothing a camera produces is that small.
 * - A selfie byte for byte the same as the document photo is not a face match.
 * - A DEMO image names who it shows. The console's document images
 *   (`/__mock/documents/...`) carry a marker in a PNG text chunk:
 *   `INJISHI-DEMO-PASSPORT:<number>` on a passport photo page,
 *   `INJISHI-DEMO-NID:<sixteen digits>` on a National ID card front (the marker
 *   the API's in-process mock already reads), and `INJISHI-DEMO-FACE:<number>`
 *   on a selfie. A selfie that names someone other than the document's holder
 *   fails the face match, which is how impersonation is demonstrated.
 *
 * A camera photo carries no marker, so it never lands on a seeded person by
 * chance: a passport read from one is made up from its bytes, and its selfie
 * matches.
 */

export const MIN_IMAGE_BYTES = 2048;

// A marker ends at the first character that cannot be part of a number: the
// console writes a space after it, because the PNG chunk's checksum bytes
// follow the text directly and may read as letters.
const PASSPORT = /INJISHI-DEMO-PASSPORT:([A-Z0-9]{5,20})(?![A-Z0-9])/;
const NATIONAL_ID = /INJISHI-DEMO-NID:(\d{16})/;
const FACE = /INJISHI-DEMO-FACE:([A-Z0-9]{5,20})(?![A-Z0-9])/;

function text(bytes: Buffer): string {
  return bytes.toString('latin1');
}

export function passportMarker(bytes: Buffer): string | null {
  return PASSPORT.exec(text(bytes))?.[1] ?? null;
}

export function nationalIdMarker(bytes: Buffer): string | null {
  return NATIONAL_ID.exec(text(bytes))?.[1] ?? null;
}

export function faceMarker(bytes: Buffer): string | null {
  return FACE.exec(text(bytes))?.[1] ?? null;
}

export type FaceVerdict = 'match' | 'mismatch' | 'unreadable';

/**
 * Whether a selfie shows the holder of a document, as far as a mock can say.
 * `forceMismatch` is the register row's own scenario.
 */
export function compareFace(input: {
  selfie: Buffer;
  documentNumber: string;
  documentImage?: Buffer;
  forceMismatch?: boolean;
}): FaceVerdict {
  if (input.selfie.length < MIN_IMAGE_BYTES) return 'unreadable';
  if (input.documentImage && input.documentImage.equals(input.selfie)) return 'mismatch';
  const named = faceMarker(input.selfie);
  if (named && named.toUpperCase() !== input.documentNumber.toUpperCase()) return 'mismatch';
  if (input.forceMismatch) return 'mismatch';
  return 'match';
}

/** A decoded base64 image, or null when the string is not base64 at all. */
export function decodeImage(data: unknown): Buffer | null {
  if (typeof data !== 'string' || data.length === 0) return null;
  // A data URL is accepted too, since browsers and SDKs both send them.
  const body = data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(body)) return null;
  return Buffer.from(body, 'base64');
}
