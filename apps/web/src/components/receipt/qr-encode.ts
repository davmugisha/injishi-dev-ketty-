/**
 * A QR Code encoder, written here because nothing in this workspace ships one.
 *
 * WHY THIS FILE EXISTS AT ALL. Clause 7.24.7 of the RRA's "Technical
 * Specification of CIS for VSDC" requires a QR code on every receipt, carrying
 * `invoice_date#time#sdc number#sdc_receipt_number#internal_data#receipt_signature`.
 * A tax officer holds a phone against the paper and expects the string back.
 * Printing that string as text instead is not a smaller version of the
 * requirement, it is a different document — so the payload has to be really
 * encoded, and no dependency in `apps/web` could do it.
 *
 * WHY NOT ADD ONE. Two reasons, in order. The receipt has to render the same
 * bits on a server, in a browser and in a print preview, and a self-contained
 * pure function is the only version of that with nothing to configure. And this
 * leaf owns three directories; a dependency is a change to `package.json` and
 * the lockfile, which it does not own, in a tree several agents are editing at
 * once.
 *
 * WHAT IT IMPLEMENTS. ISO/IEC 18004 byte mode at error-correction level M
 * (~15% recovery), versions 1 to 40, with the mask chosen by the standard's own
 * penalty rules. Level M rather than L because a receipt is printed on thermal
 * paper that creases, smudges and fades, and rather than Q or H because those
 * cost modules — a denser symbol on 80mm paper is the failure mode that
 * actually happens.
 *
 * HOW IT IS KNOWN TO BE RIGHT. Not by reading it. The module matrix this
 * produces was compared bit for bit against `segno`, an independent reference
 * encoder, across every version, and the rendered symbols were decoded back to
 * their input with OpenCV. Both are recorded in the leaf report. A hand-written
 * encoder that is nearly right produces a symbol that scans on a good phone in
 * good light and fails on the audit, which is the worst possible outcome, so
 * "it looked fine" was never the standard here.
 *
 * Everything below is the specification's own vocabulary. The numeric tables
 * are ISO/IEC 18004 tables and are not derivable; they are transcribed.
 */

/** Galois field GF(256) modulo the QR primitive polynomial x^8+x^4+x^3+x^2+1. */
const GF_PRIMITIVE = 0x11d;

/** Discrete log and antilog tables for GF(256), built once at module load. */
const { exp: GF_EXP, log: GF_LOG } = (() => {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= GF_PRIMITIVE;
  }
  // The second half repeats the first so that `exp[a + b]` needs no modulus.
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
  return { exp, log };
})();

/** Field multiplication. Zero is special-cased: it has no logarithm. */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/**
 * The Reed-Solomon generator polynomial of the given degree, coefficients
 * highest power first: (x - a^0)(x - a^1)...(x - a^(degree-1)).
 */
function generatorPolynomial(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** The `degree` error-correction codewords for one block of data codewords. */
function errorCorrectionFor(data: number[], degree: number): number[] {
  const generator = generatorPolynomial(degree);
  const remainder = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < degree; i += 1) {
        remainder[i] ^= gfMul(generator[i + 1], factor);
      }
    }
  }
  return remainder;
}

/**
 * ISO/IEC 18004 table 9, error-correction level M only.
 *
 * Per version: how many error-correction codewords each block carries, then the
 * block groups as `[blockCount, dataCodewordsPerBlock]`. A version with two
 * groups splits its blocks into a shorter and a longer kind, and the difference
 * is always exactly one codeword.
 *
 * Only level M is transcribed. Carrying all four levels would be four times the
 * table for a receipt that will only ever be printed at one of them, and a
 * table nothing reads is a table nothing checks.
 */
const EC_BLOCKS_M: ReadonlyArray<readonly [number, ReadonlyArray<readonly [number, number]>]> = [
  [10, [[1, 16]]],
  [16, [[1, 28]]],
  [26, [[1, 44]]],
  [18, [[2, 32]]],
  [24, [[2, 43]]],
  [16, [[4, 27]]],
  [18, [[4, 31]]],
  [22, [[2, 38], [2, 39]]],
  [22, [[3, 36], [2, 37]]],
  [26, [[4, 43], [1, 44]]],
  [30, [[1, 50], [4, 51]]],
  [22, [[6, 36], [2, 37]]],
  [22, [[8, 37], [1, 38]]],
  [24, [[4, 40], [5, 41]]],
  [24, [[5, 41], [5, 42]]],
  [28, [[7, 45], [3, 46]]],
  [28, [[10, 46], [1, 47]]],
  [26, [[9, 43], [4, 44]]],
  [26, [[3, 44], [11, 45]]],
  [26, [[3, 41], [13, 42]]],
  [26, [[17, 42]]],
  [28, [[17, 46]]],
  [28, [[4, 47], [14, 48]]],
  [28, [[6, 45], [14, 46]]],
  [28, [[8, 47], [13, 48]]],
  [28, [[19, 46], [4, 47]]],
  [28, [[22, 45], [3, 46]]],
  [28, [[3, 45], [23, 46]]],
  [28, [[21, 45], [7, 46]]],
  [28, [[19, 47], [10, 48]]],
  [28, [[2, 46], [29, 47]]],
  [28, [[10, 46], [23, 47]]],
  [28, [[14, 46], [21, 47]]],
  [28, [[14, 46], [23, 47]]],
  [28, [[12, 47], [26, 48]]],
  [28, [[6, 47], [34, 48]]],
  [28, [[29, 46], [14, 47]]],
  [28, [[13, 46], [32, 47]]],
  [28, [[40, 47], [7, 48]]],
  [28, [[18, 47], [31, 48]]],
];

/**
 * ISO/IEC 18004 table E.1: the row and column centres of the alignment
 * patterns, per version. Version 1 has none. Every combination of two centres
 * is a pattern except the three that would sit on a finder pattern.
 */
const ALIGNMENT_CENTRES: ReadonlyArray<readonly number[]> = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

/** Total data codewords a version holds at level M. */
function dataCapacity(version: number): number {
  const [, groups] = EC_BLOCKS_M[version - 1];
  return groups.reduce((sum, [blocks, size]) => sum + blocks * size, 0);
}

/**
 * The smallest version that fits `byteLength` bytes in byte mode at level M.
 *
 * The header costs 4 bits of mode indicator plus a character count that widens
 * from 8 to 16 bits at version 10, which is why the comparison is in bits and
 * not in bytes: a payload that fits version 9 by one byte does not necessarily
 * fit version 10's own header.
 */
function smallestVersion(byteLength: number): number {
  for (let version = 1; version <= 40; version += 1) {
    const countBits = version < 10 ? 8 : 16;
    const needed = 4 + countBits + byteLength * 8;
    if (needed <= dataCapacity(version) * 8) return version;
  }
  throw new Error(
    `${byteLength} bytes is beyond the 2331-byte ceiling of a byte-mode QR ` +
      "symbol at level M; a clause 7.24.7 payload is never this long, so this " +
      "is a data fault, not a size choice",
  );
}

/** Accumulates a bit stream, most significant bit first, into whole bytes. */
class BitBuffer {
  private readonly bits: number[] = [];

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) this.bits.push((value >>> i) & 1);
  }

  get length(): number {
    return this.bits.length;
  }

  /** Zero-padded to a whole number of bytes. */
  toBytes(): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (this.bits[i + j] ?? 0);
      bytes.push(byte);
    }
    return bytes;
  }
}

/**
 * The data codewords for one payload: mode, length, data, terminator, padding.
 *
 * The pad bytes alternate 0xEC and 0x11 because the standard says so — they are
 * a fixed pattern rather than zeros so that an unfilled symbol still carries
 * module transitions for a scanner to lock onto.
 */
function dataCodewords(bytes: Uint8Array, version: number): number[] {
  const capacity = dataCapacity(version);
  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // byte mode
  buffer.put(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) buffer.put(byte, 8);

  // Terminator: up to four zero bits, fewer if the symbol is nearly full.
  buffer.put(0, Math.min(4, capacity * 8 - buffer.length));
  // Then to a byte boundary.
  if (buffer.length % 8 !== 0) buffer.put(0, 8 - (buffer.length % 8));

  const codewords = buffer.toBytes();
  for (let i = 0; codewords.length < capacity; i += 1) {
    codewords.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return codewords;
}

/**
 * Split the data into blocks, compute each block's error correction, then
 * interleave both — data codewords first, one from each block in turn, then the
 * error-correction codewords the same way.
 *
 * The interleaving is what makes level M mean anything on paper. A thumbprint
 * or a fold damages a contiguous REGION of the symbol; interleaving spreads
 * that region across every block, so no single block loses more than it can
 * recover. Written in the block order, one smudge would destroy one block
 * completely and the symbol with it.
 */
function interleave(codewords: number[], version: number): number[] {
  const [ecPerBlock, groups] = EC_BLOCKS_M[version - 1];

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const [blockCount, blockSize] of groups) {
    for (let i = 0; i < blockCount; i += 1) {
      const block = codewords.slice(offset, offset + blockSize);
      offset += blockSize;
      dataBlocks.push(block);
      ecBlocks.push(errorCorrectionFor(block, ecPerBlock));
    }
  }

  const out: number[] = [];
  const longestData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < longestData; i += 1) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

/** A module that is not part of the payload: finder, timing, format, version. */
type Cell = 0 | 1 | null;

/** Places the fixed patterns and marks every function module as reserved. */
function functionPatterns(version: number): { modules: Cell[][]; reserved: boolean[][] } {
  const size = version * 4 + 17;
  const modules: Cell[][] = Array.from({ length: size }, () =>
    new Array<Cell>(size).fill(null),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const set = (row: number, col: number, value: 0 | 1) => {
    modules[row][col] = value;
    reserved[row][col] = true;
  };

  // Three finder patterns, each with its one-module separator.
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ]) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const inRing =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row, col, inRing || inCore ? 1 : 0);
      }
    }
  }

  // Timing patterns: the alternating row and column at index 6.
  for (let i = 8; i < size - 8; i += 1) {
    const value: 0 | 1 = i % 2 === 0 ? 1 : 0;
    set(6, i, value);
    set(i, 6, value);
  }

  // Alignment patterns, at every pairing of centres except the three that
  // would overlap a finder pattern.
  const centres = ALIGNMENT_CENTRES[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      const onFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === size - 7) ||
        (row === size - 7 && col === 6);
      if (onFinder) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const ring = Math.max(Math.abs(r), Math.abs(c));
          set(row + r, col + c, ring === 1 ? 0 : 1);
        }
      }
    }
  }

  // The dark module, always set, immediately above the bottom-left finder.
  set(size - 8, 8, 1);

  // Reserve the format information strips; their value depends on the mask and
  // is written after one is chosen.
  for (let i = 0; i < 9; i += 1) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // Version 7 and up carry an 18-bit version block beside two finders.
  if (version >= 7) {
    const bits = versionInformation(version);
    for (let i = 0; i < 18; i += 1) {
      const bit: 0 | 1 = ((bits >> i) & 1) as 0 | 1;
      const row = Math.floor(i / 3);
      const col = i % 3;
      set(size - 11 + col, row, bit);
      set(row, size - 11 + col, bit);
    }
  }

  return { modules, reserved };
}

/** BCH(18,6) version information, generator 0x1F25 (ISO/IEC 18004 D.2). */
function versionInformation(version: number): number {
  let remainder = version << 12;
  for (let i = 0; i < 6; i += 1) {
    if (remainder & (1 << (17 - i))) remainder ^= 0x1f25 << (5 - i);
  }
  return (version << 12) | remainder;
}

/**
 * BCH(15,5) format information for level M and the given mask, masked with
 * 0x5412 (ISO/IEC 18004 C.1).
 *
 * The XOR is not decoration: without it the all-zero format would be a legal
 * pattern, and a symbol whose format strip is blank cannot be told from one
 * that was never printed.
 */
function formatInformation(mask: number): number {
  const LEVEL_M = 0b00;
  const data = (LEVEL_M << 3) | mask;
  let remainder = data << 10;
  for (let i = 0; i < 5; i += 1) {
    if (remainder & (1 << (14 - i))) remainder ^= 0x537 << (4 - i);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

/** The eight mask conditions of ISO/IEC 18004 table 10. */
const MASK_CONDITIONS: ReadonlyArray<(row: number, col: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * Write the interleaved codewords along the standard's zigzag: two columns at a
 * time from the bottom-right, upwards then downwards, skipping reserved
 * modules and the whole of column 6, which is the vertical timing pattern.
 */
function placeCodewords(
  modules: Cell[][],
  reserved: boolean[][],
  codewords: number[],
): void {
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the timing pattern; the pairing shifts left past it.
    const rightColumn = right <= 6 ? right - 1 : right;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const col of [rightColumn, rightColumn - 1]) {
        if (reserved[row][col]) continue;
        const byte = codewords[bitIndex >> 3] ?? 0;
        const bit = (byte >> (7 - (bitIndex & 7))) & 1;
        modules[row][col] = bit as 0 | 1;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

/** ISO/IEC 18004 table 11: the four penalty rules a good mask minimises. */
function penalty(modules: ReadonlyArray<ReadonlyArray<0 | 1>>): number {
  const size = modules.length;
  let score = 0;

  // N1 — runs of five or more identical modules in a row or column.
  for (let i = 0; i < size; i += 1) {
    for (const read of [
      (j: number) => modules[i][j],
      (j: number) => modules[j][i],
    ]) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        if (read(j) === read(j - 1)) {
          run += 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
        }
      }
    }
  }

  // N2 — every 2x2 block of one colour.
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = modules[r][c];
      if (modules[r][c + 1] === v && modules[r + 1][c] === v && modules[r + 1][c + 1] === v) {
        score += 3;
      }
    }
  }

  // N3 — the 1:1:3:1:1 finder-like sequence with four light modules on one
  // side, in any row or column. A scanner locks onto that ratio to find the
  // three finder patterns, so a false one inside the data is what makes a
  // symbol read as the wrong size, or not read at all.
  //
  // Both orientations are counted, and the run of four light modules must be
  // INSIDE the symbol: the quiet zone around the code is light too, but the
  // rule as written scans the symbol, and letting the edge stand in for the run
  // is a house variation that changes which mask wins for no stated reason.
  const BEFORE = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const AFTER = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (line: ReadonlyArray<0 | 1>, at: number, pattern: number[]): boolean =>
    pattern.every((bit, k) => line[at + k] === bit);

  for (let i = 0; i < size; i += 1) {
    const row: (0 | 1)[] = [];
    const col: (0 | 1)[] = [];
    for (let j = 0; j < size; j += 1) {
      row.push(modules[i][j]);
      col.push(modules[j][i]);
    }
    for (const line of [row, col]) {
      for (let at = 0; at + 11 <= size; at += 1) {
        if (matches(line, at, BEFORE) || matches(line, at, AFTER)) score += 40;
      }
    }
  }

  // N4 — how far the proportion of dark modules strays from half.
  let dark = 0;
  for (const row of modules) for (const cell of row) dark += cell;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Write the 15 format bits for a chosen mask into both format strips.
 *
 * THE BIT ORDER IS NOT SYMMETRIC AND IS EASY TO GET BACKWARDS. Bit 14 is the
 * most significant, and the strips run from it downwards:
 *
 *   copy 1: `(8,0)…(8,5)` carry bits 14…9, `(8,7)` bit 8, `(8,8)` bit 7,
 *           `(7,8)` bit 6, then `(0,8)…(5,8)` carry bits 0…5.
 *   copy 2: `(size-1,8)…(size-7,8)` carry bits 14…8, then
 *           `(8,size-8)…(8,size-1)` carry bits 7…0.
 *
 * The dark module at `(size-8, 8)` sits between the two halves of copy 2 and
 * belongs to neither; it is written by `functionPatterns` and must survive.
 *
 * Writing these ascending instead of descending produces a symbol that is
 * correct in every other respect — right codewords, right mask, right error
 * correction — and that no scanner will read, because the first thing a decoder
 * does is take the format bits and they say the wrong mask. That is exactly the
 * fault this encoder had until the matrix was compared against a reference, and
 * it is why the comparison is part of the work rather than an afterthought.
 */
function writeFormat(modules: Cell[][], mask: number): void {
  const size = modules.length;
  const bits = formatInformation(mask);
  const bitAt = (i: number): 0 | 1 => ((bits >> i) & 1) as 0 | 1;

  // Copy one, around the top-left finder.
  for (let i = 0; i <= 5; i += 1) modules[8][i] = bitAt(14 - i);
  modules[8][7] = bitAt(8);
  modules[8][8] = bitAt(7);
  modules[7][8] = bitAt(6);
  for (let row = 0; row <= 5; row += 1) modules[row][8] = bitAt(row);

  // Copy two, split between the other two finders, so a symbol with one
  // damaged corner can still be read.
  for (let i = 0; i <= 6; i += 1) modules[size - 1 - i][8] = bitAt(14 - i);
  for (let i = 0; i <= 7; i += 1) modules[8][size - 8 + i] = bitAt(7 - i);
}

/** A finished symbol: `modules[row][col]`, 1 dark, plus its version. */
export interface QrSymbol {
  size: number;
  version: number;
  modules: ReadonlyArray<ReadonlyArray<0 | 1>>;
}

/**
 * Encode `text` as a QR symbol at error-correction level M.
 *
 * UTF-8 rather than ISO-8859-1: the payload of clause 7.24.7 is ASCII by
 * construction, and every scanner reads a byte-mode symbol as UTF-8 when it is
 * valid UTF-8, so the two agree on every input this ever sees and only UTF-8
 * survives a value that turns out not to be ASCII after all.
 */
export function encodeQr(text: string): QrSymbol {
  if (text.length === 0) {
    throw new Error("a QR symbol cannot encode an empty payload");
  }
  const bytes = new TextEncoder().encode(text);
  const version = smallestVersion(bytes.length);
  const codewords = interleave(dataCodewords(bytes, version), version);

  // Every mask is applied to a fresh copy and scored; the standard picks the
  // lowest penalty. Doing this properly costs eight builds of a small matrix
  // and buys a symbol that does not confuse a scanner with a false finder.
  let best: { modules: (0 | 1)[][]; score: number; mask: number } | null = null;

  for (let mask = 0; mask < 8; mask += 1) {
    const { modules, reserved } = functionPatterns(version);
    placeCodewords(modules, reserved, codewords);

    const condition = MASK_CONDITIONS[mask];
    const size = modules.length;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        // The mask inverts DATA modules only; a masked function pattern would
        // stop being a function pattern.
        if (reserved[r][c]) continue;
        if (condition(r, c)) modules[r][c] = (modules[r][c] === 1 ? 0 : 1) as 0 | 1;
      }
    }
    writeFormat(modules, mask);

    const solid = modules as (0 | 1)[][];
    const score = penalty(solid);
    if (best === null || score < best.score) best = { modules: solid, score, mask };
  }

  // `best` is assigned on the first of eight iterations; the check is for the
  // type checker, not for a case that can happen.
  if (best === null) throw new Error("no mask was evaluated");

  return { size: best.modules.length, version, modules: best.modules };
}
