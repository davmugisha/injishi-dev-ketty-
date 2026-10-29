/**
 * What a video IS, read from its first bytes (rentals, unit video tours):
 * never from its name or the type the client declared, both of which the
 * client chooses. MP4 and QuickTime are ISO base media files (an `ftyp` box
 * first); WebM is Matroska with a `webm` doctype. Anything else answers null
 * and is refused by the caller.
 */
export type SniffedVideoMime = 'video/mp4' | 'video/quicktime' | 'video/webm';

/** ISO base media brands that mean a picture (HEIF) or sound alone (an m4a), not a video. */
const NOT_VIDEO_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1', 'avif', 'M4A ', 'M4B ', 'M4P ']);
/** The EBML header every Matroska and WebM file opens with. */
const EBML_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3];

/** How many leading bytes `sniffVideoMime` needs. */
export const VIDEO_SNIFF_BYTES = 64;

export function sniffVideoMime(head: Buffer): SniffedVideoMime | null {
  if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('latin1');
    if (brand === 'qt  ') return 'video/quicktime';
    if (NOT_VIDEO_BRANDS.has(brand)) return null;
    // `isom`, `mp41`, `mp42`, `avc1`, `M4V `, `3gp4`, `dash`...: they play as mp4.
    return 'video/mp4';
  }
  if (head.length >= 4 && EBML_SIGNATURE.every((byte, i) => head[i] === byte)) {
    // Only a WebM doctype counts; a .mkv is refused.
    return head.subarray(0, Math.min(head.length, VIDEO_SNIFF_BYTES)).includes(Buffer.from('webm', 'latin1'))
      ? 'video/webm'
      : null;
  }
  return null;
}
