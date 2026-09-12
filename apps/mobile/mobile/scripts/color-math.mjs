/**
 * color-math.mjs — the pure colour maths behind `derive-palette.mjs`.
 *
 * Split out of the generator so it can be imported and tested. The generator
 * itself reads `import.meta.url` to find the token package and the output file,
 * which is exactly the kind of module-level side effect a test cannot import;
 * everything here is a pure function of its arguments and imports nothing.
 *
 * Three properties in this file are the ones ADR-031's test strategy asks to be
 * held honest, because each fails in a way that still looks like success:
 *
 *  1. `parseOklch` reads the lightness as a PERCENTAGE. `oklch(65.00% ...)` is
 *     L = 0.65, not 65. Feeding the percentage straight in blows out every
 *     colour and still emits a valid hex string.
 *  2. `gamutMap` reduces chroma with lightness and hue held, in the CSS Color 4
 *     manner. Clipping the channels instead yields a colour a browser does not
 *     paint for the same token, which silently invalidates every contrast
 *     measurement taken against the web.
 *  3. `contrast` is the WCAG 2.x ratio over `over()`-composited bytes, which is
 *     how the badge inks are measured — on the tint they are actually drawn on,
 *     never on the bare surface.
 *
 * ADR-030 child "the React Native palette" owns the decisions; this file only
 * holds the arithmetic.
 */

/* ------------------------------------------------------------------ OKLab */

// OKLab <-> linear sRGB, the matrices from the OKLab specification.
const LMS_FROM_LAB = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];
const RGB_FROM_LMS = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];
const LAB_FROM_LMS = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const LMS_FROM_RGB = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

const mul = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

/** OKLCh -> OKLab. Hue is degrees. */
export const lchToLab = (L, C, H) => [
  L,
  C * Math.cos((H * Math.PI) / 180),
  C * Math.sin((H * Math.PI) / 180),
];

/** OKLab -> linear sRGB (may fall outside 0..1). */
export function labToLinear(lab) {
  const [l, m, s] = mul(LMS_FROM_LAB, lab);
  return mul(RGB_FROM_LMS, [l ** 3, m ** 3, s ** 3]);
}

/** linear sRGB -> OKLab. Used only by the gamut mapper's error metric. */
export function linearToLab(rgb) {
  const lms = mul(LMS_FROM_RGB, rgb);
  return mul(
    LAB_FROM_LMS,
    lms.map((v) => Math.cbrt(v)),
  );
}

const EPSILON = 1e-5;
export const inGamut = (rgb) => rgb.every((v) => v >= -EPSILON && v <= 1 + EPSILON);
export const clip = (rgb) => rgb.map((v) => Math.min(1, Math.max(0, v)));
export const deltaEOK = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * CSS Color 4 gamut mapping: hold lightness and hue, binary-search chroma down
 * until the clipped result is within one just-noticeable difference of the
 * unclipped one. Returns the linear sRGB triple and whether chroma had to move.
 */
export function gamutMap(L, C, H) {
  if (L >= 1) return { rgb: [1, 1, 1], mappedTo: null };
  if (L <= 0) return { rgb: [0, 0, 0], mappedTo: null };

  const exact = labToLinear(lchToLab(L, C, H));
  if (inGamut(exact)) return { rgb: clip(exact), mappedTo: null };

  const JND = 0.02;
  let lo = 0;
  let hi = C;
  let best = clip(exact);
  while (hi - lo > 1e-5) {
    const mid = (lo + hi) / 2;
    const current = labToLinear(lchToLab(L, mid, H));
    if (inGamut(current)) {
      lo = mid;
      best = clip(current);
      continue;
    }
    const clipped = clip(current);
    if (deltaEOK(linearToLab(clipped), lchToLab(L, mid, H)) < JND) {
      lo = mid;
      best = clipped;
    } else {
      hi = mid;
    }
  }
  return { rgb: best, mappedTo: lo };
}

/* ------------------------------------------------------------------ bytes */

export const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const toBytes = (rgb) => rgb.map((v) => Math.round(encode(v) * 255));
export const hex = (bytes) =>
  '#' + bytes.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
export const alphaHex = (bytes, a) =>
  hex(bytes) +
  Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

/** `#RRGGBB` -> the three bytes. The inverse of `hex`, for reading a palette. */
export const fromHex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

/* -------------------------------------------------------------- oklch text */

export const OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/**
 * Parse one authored `oklch()` string.
 *
 * The lightness is a PERCENTAGE and is divided here, once, before anything else
 * touches it. `label` names the role in the thrown message, because the caller
 * knows which role and scheme failed and this does not.
 */
export function parseOklch(raw, label = 'colour') {
  const m = OKLCH.exec(raw);
  if (!m) throw new Error(`${label} is not oklch(): ${raw}`);
  const L = Number(m[1]) / 100; // percentage FIRST, or every colour blows out
  const C = Number(m[2]);
  const H = Number(m[3]);
  if (!(L >= 0 && L <= 1)) throw new Error(`${label} has L=${L} outside 0..1`);
  return { L, C, H };
}

/* ---------------------------------------------------------------- contrast */

const channel = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
export const luminance = (b) => 0.2126 * channel(b[0]) + 0.7152 * channel(b[1]) + 0.0722 * channel(b[2]);

/** The WCAG 2.x ratio between two gamma-encoded sRGB byte triples. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over composite in gamma-encoded sRGB, which is what RN paints. */
export const over = (fg, a, bg) => fg.map((v, i) => Math.round(a * v + (1 - a) * bg[i]));

export const round2 = (n) => `${Math.round(n * 100) / 100}:1`;
