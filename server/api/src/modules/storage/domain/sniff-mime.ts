/**
 * What a file IS, read from its first bytes (ADR-058, 058-people-file security
 * model): never from its name, and never from the type the client declared,
 * both of which the client chooses.
 *
 * Only the formats an HR upload may be. Anything else answers null and is
 * refused by the caller.
 */
export type SniffedMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** ISO base media brands that mean a HEIF image (`heic`, `heix`, `mif1`, `msf1`, `heim`, `heis`). */
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1']);

export function sniffMime(body: Buffer): SniffedMime | null {
  if (body.length >= 5 && body.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
  if (body.length >= 8 && PNG_SIGNATURE.every((byte, i) => body[i] === byte)) return 'image/png';
  if (
    body.length >= 12 &&
    body.subarray(0, 4).toString('latin1') === 'RIFF' &&
    body.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (body.length >= 12 && body.subarray(4, 8).toString('latin1') === 'ftyp') {
    if (HEIF_BRANDS.has(body.subarray(8, 12).toString('latin1'))) return 'image/heic';
  }
  return null;
}

/** The document formats a request names (`DocumentFormat`), as the mime the bytes sniff to. */
export const DOCUMENT_FORMAT_MIME: Readonly<Record<'pdf' | 'jpg' | 'png' | 'heic', SniffedMime>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};
