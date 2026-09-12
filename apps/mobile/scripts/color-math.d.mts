/**
 * Types for `color-math.mjs`.
 *
 * The module itself is plain JavaScript because `derive-palette.mjs` runs it
 * under bare `node` with no build step. This declaration exists so the palette
 * test can import it under `strict` without `allowJs`, and so the shapes the
 * generator relies on are written down somewhere a reader can find them.
 *
 * An RGB triple is linear sRGB in 0..1 unless the name says `bytes`, which is
 * gamma-encoded 0..255 — the two are not interchangeable and mixing them is the
 * easiest mistake to make in here.
 */

/** Linear sRGB, 0..1 per channel. May fall outside the range before mapping. */
export type Rgb = number[];

/** Gamma-encoded sRGB, 0..255 per channel. What React Native paints. */
export type Bytes = number[];

/** OKLab: lightness, then the two opponent axes. */
export type Lab = number[];

export function lchToLab(L: number, C: number, H: number): Lab;
export function labToLinear(lab: Lab): Rgb;
export function linearToLab(rgb: Rgb): Lab;

export function inGamut(rgb: Rgb): boolean;
export function clip(rgb: Rgb): Rgb;
export function deltaEOK(a: Lab, b: Lab): number;

/**
 * CSS Color 4 gamut mapping. `mappedTo` is the chroma the search settled on, or
 * `null` when the colour was already in gamut and nothing moved.
 */
export function gamutMap(L: number, C: number, H: number): { rgb: Rgb; mappedTo: number | null };

export function encode(c: number): number;
export function toBytes(rgb: Rgb): Bytes;
export function hex(bytes: Bytes): string;
export function alphaHex(bytes: Bytes, a: number): string;
export function fromHex(value: string): Bytes;

export const OKLCH: RegExp;

/**
 * Parse one authored `oklch()` string. `L` comes back as 0..1, divided from the
 * authored percentage. Throws when the string is not `oklch()` or the lightness
 * lands outside 0..1; `label` names the role in the message.
 */
export function parseOklch(raw: string, label?: string): { L: number; C: number; H: number };

export function luminance(b: Bytes): number;

/** The WCAG 2.x ratio between two byte triples. */
export function contrast(a: Bytes, b: Bytes): number;

/** Source-over composite in gamma-encoded sRGB. */
export function over(fg: Bytes, a: number, bg: Bytes): Bytes;

export function round2(n: number): string;
