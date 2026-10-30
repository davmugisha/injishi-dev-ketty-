import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

/**
 * Demo document photos and selfies, drawn as PNGs with no dependency.
 *
 * Each image says who it shows in a PNG text chunk (`images.ts` in providers
 * reads it back): `INJISHI-DEMO-PASSPORT:<number>`, `INJISHI-DEMO-NID:<number>`
 * or `INJISHI-DEMO-FACE:<number>`. That marker, not the picture, is what the
 * mock providers verify, so a tester downloads a person's two images from the
 * console and uploads them in the registration wizard. Every image also says,
 * in a second text chunk, that it is not an identity document.
 *
 * The drawing is only shapes (a photo box, text bars, a machine readable
 * band), coloured from the number so two people's images differ at a glance.
 * Light noise keeps every image above the 2 KB a provider reads as a real
 * photo.
 */

type Rgb = readonly [number, number, number];

class Canvas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;

  constructor(width: number, height: number, fill: Rgb) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 3);
    this.rect(0, 0, width, height, fill);
  }

  rect(x: number, y: number, w: number, h: number, colour: Rgb): void {
    for (let row = Math.max(0, y); row < Math.min(this.height, y + h); row += 1) {
      for (let col = Math.max(0, x); col < Math.min(this.width, x + w); col += 1) {
        this.set(col, row, colour);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, colour: Rgb): void {
    for (let row = Math.max(0, cy - ry); row < Math.min(this.height, cy + ry); row += 1) {
      for (let col = Math.max(0, cx - rx); col < Math.min(this.width, cx + rx); col += 1) {
        const dx = (col - cx) / rx;
        const dy = (row - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(col, row, colour);
      }
    }
  }

  /** Light, deterministic grain, so the file is the size of a real photo's thumbnail. */
  grain(seed: Buffer): void {
    let state = seed.readUInt32BE(0) || 1;
    for (let i = 0; i < this.pixels.length; i += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const shift = (state >>> 0) % 9;
      this.pixels[i] = Math.max(0, Math.min(255, this.pixels[i]! + shift - 4));
    }
  }

  private set(x: number, y: number, [r, g, b]: Rgb): void {
    const at = (y * this.width + x) * 3;
    this.pixels[at] = r;
    this.pixels[at + 1] = g;
    this.pixels[at + 2] = b;
  }

  png(texts: Record<string, string>): Buffer {
    const raw = Buffer.alloc((this.width * 3 + 1) * this.height);
    for (let y = 0; y < this.height; y += 1) {
      const rowStart = y * (this.width * 3 + 1);
      raw[rowStart] = 0; // filter: none
      raw.set(this.pixels.subarray(y * this.width * 3, (y + 1) * this.width * 3), rowStart + 1);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8; // bit depth
    header[9] = 2; // colour type: RGB
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      ...Object.entries(texts).map(([key, value]) => chunk('tEXt', Buffer.from(`${key}\0${value}`, 'latin1'))),
      chunk('IDAT', deflateSync(raw, { level: 6 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0, 0);
  return Buffer.concat([length, typed, crc]);
}

function seedOf(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function tint(seed: Buffer, offset: number, base: number, spread: number): Rgb {
  return [base + (seed[offset]! % spread), base + (seed[offset + 1]! % spread), base + (seed[offset + 2]! % spread)];
}

const NOT_A_DOCUMENT = 'Injishi Mock APIs demo image. Not an identity document.';
const INK: Rgb = [40, 44, 52];
const PAPER_LINE: Rgb = [120, 126, 136];

/** A passport's photo page for a seeded or made up passport number. */
export function passportPhotoPage(number: string): Buffer {
  const seed = seedOf(`passport:${number}`);
  const canvas = new Canvas(480, 330, tint(seed, 0, 205, 40));
  canvas.rect(0, 0, 480, 34, tint(seed, 3, 60, 70));
  canvas.rect(24, 58, 128, 164, tint(seed, 6, 150, 60));
  canvas.ellipse(88, 120, 34, 42, tint(seed, 9, 90, 60));
  canvas.rect(52, 168, 72, 54, tint(seed, 9, 90, 60));
  for (let line = 0; line < 6; line += 1) {
    canvas.rect(176, 62 + line * 26, 120 + (seed[12 + line]! % 150), 10, PAPER_LINE);
  }
  // The machine readable zone.
  for (let row = 0; row < 2; row += 1) {
    for (let cell = 0; cell < 40; cell += 1) {
      if (seed[(cell + row * 7) % 32]! % 5 !== 0) canvas.rect(24 + cell * 11, 256 + row * 30, 8, 16, INK);
    }
  }
  canvas.grain(seed);
  return canvas.png({ Comment: `INJISHI-DEMO-PASSPORT:${number} `, Description: NOT_A_DOCUMENT });
}

/** The front of a Rwandan National ID card for a sixteen digit number. */
export function nationalIdFront(nationalId: string): Buffer {
  const seed = seedOf(`nid:${nationalId}`);
  const canvas = new Canvas(480, 300, tint(seed, 0, 210, 35));
  canvas.rect(0, 0, 480, 40, [32, 96, 168]);
  canvas.rect(0, 40, 480, 10, [250, 210, 1]);
  canvas.rect(0, 50, 480, 8, [32, 140, 70]);
  canvas.rect(24, 80, 116, 148, tint(seed, 6, 150, 60));
  canvas.ellipse(82, 134, 32, 40, tint(seed, 9, 90, 60));
  canvas.rect(48, 178, 68, 50, tint(seed, 9, 90, 60));
  for (let line = 0; line < 5; line += 1) {
    canvas.rect(164, 86 + line * 28, 110 + (seed[12 + line]! % 160), 10, PAPER_LINE);
  }
  for (let digit = 0; digit < 16; digit += 1) {
    canvas.rect(164 + digit * 18, 248, 12, 18, INK);
  }
  canvas.grain(seed);
  return canvas.png({ Comment: `INJISHI-DEMO-NID:${nationalId} `, Description: NOT_A_DOCUMENT });
}

/** A selfie of the holder of a document number. */
export function selfie(documentNumber: string): Buffer {
  const seed = seedOf(`face:${documentNumber}`);
  const canvas = new Canvas(320, 400, tint(seed, 0, 170, 70));
  const skin = tint(seed, 9, 90, 60);
  canvas.ellipse(160, 300 + 120, 150, 140, tint(seed, 3, 40, 120));
  canvas.ellipse(160, 170, 78, 100, skin);
  canvas.rect(130, 250, 60, 60, skin);
  canvas.ellipse(130, 150, 10, 7, INK);
  canvas.ellipse(190, 150, 10, 7, INK);
  canvas.rect(140, 215, 40, 6, INK);
  canvas.grain(seed);
  return canvas.png({ Comment: `INJISHI-DEMO-FACE:${documentNumber.toUpperCase()} `, Description: NOT_A_DOCUMENT });
}
