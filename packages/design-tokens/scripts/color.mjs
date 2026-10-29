/**
 * color.mjs — the colour arithmetic the emitter measures with.
 *
 * Pure functions, no dependency. Every value the package authors is an OKLCH
 * string (`src/heroui.ts`), so this reads OKLCH and hex, mixes in OKLab the way
 * CSS `color-mix(in oklab, …)` does, composites a translucent colour over its
 * ground the way a browser and React Native both do (in gamma encoded sRGB),
 * and measures WCAG 2 contrast.
 *
 * Two paintings of one value. A colour outside sRGB can be painted two ways:
 * the CSS Color 4 gamut map (lightness and hue held, chroma reduced until the
 * colour is within a just noticeable difference of its clip), and a plain
 * per channel clip. Browsers have shipped both. Every ratio here is the WORSE
 * of the two, so a pair that passes passes however it is painted. Inside sRGB
 * the two are the same colour.
 *
 * The hex this module writes for the phone is the gamut mapped painting.
 */

/* ------------------------------------------------------------- parsing */

/** A colour: OKLCH (`l` 0..1, `c`, `h` degrees) plus alpha 0..1. */
export function parseColor(input) {
  const s = String(input).trim();
  if (s.startsWith('#')) return hexToOklch(s);
  const m = s.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i);
  if (!m) throw new Error(`color.mjs: cannot read "${s}" (OKLCH or hex only)`);
  const l = m[2] ? Number(m[1]) / 100 : Number(m[1]);
  const a = m[5] === undefined ? 1 : m[6] ? Number(m[5]) / 100 : Number(m[5]);
  return { l, c: Number(m[3]), h: Number(m[4]), alpha: a };
}

function hexToOklch(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  const alpha = h.length === 8 ? n(6) : 1;
  return { ...labToLch(linearSrgbToOklab(srgbToLinear([n(0), n(2), n(4)]))), alpha };
}

/* ---------------------------------------------------------- conversions */

const toRad = (d) => (d * Math.PI) / 180;

export function lchToLab({ l, c, h }) {
  return { l, a: c * Math.cos(toRad(h)), b: c * Math.sin(toRad(h)) };
}

export function labToLch({ l, a, b }) {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l, c, h: c < 1e-7 ? 0 : h };
}

/** Björn Ottosson's OKLab, the matrices CSS Color 4 publishes. */
function oklabToLinearSrgb({ l, a, b }) {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

function linearSrgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363015887 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

const encode = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const decode = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const srgbToLinear = (rgb) => rgb.map(decode);

/** OKLCH to gamma encoded sRGB, unclipped (channels may leave 0..1). */
function oklchToSrgb(lch) {
  return oklabToLinearSrgb(lchToLab(lch)).map((x) => Math.sign(x) * encode(Math.abs(x)));
}

const clip = (rgb) => rgb.map((x) => Math.min(1, Math.max(0, x)));
const EPS = 1e-6;
const inGamut = (rgb) => rgb.every((x) => x >= -EPS && x <= 1 + EPS);

function deltaEOK(rgbA, rgbB) {
  const a = linearSrgbToOklab(srgbToLinear(clip(rgbA)));
  const b = linearSrgbToOklab(srgbToLinear(clip(rgbB)));
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

/** CSS Color 4 §13.2 gamut mapping to sRGB: binary search on chroma. */
function gamutMap(lch) {
  if (lch.l >= 1) return [1, 1, 1];
  if (lch.l <= 0) return [0, 0, 0];
  const origin = oklchToSrgb(lch);
  if (inGamut(origin)) return clip(origin);
  const JND = 0.02;
  const epsilon = 0.0001;
  let min = 0;
  let max = lch.c;
  let minInGamut = true;
  let clipped = clip(origin);
  if (deltaEOK(clipped, origin) < JND) return clipped;
  while (max - min > epsilon) {
    const chroma = (min + max) / 2;
    const current = oklchToSrgb({ ...lch, c: chroma });
    if (minInGamut && inGamut(current)) {
      min = chroma;
      continue;
    }
    clipped = clip(current);
    const e = deltaEOK(clipped, current);
    if (e < JND) {
      if (JND - e < epsilon) return clipped;
      minInGamut = false;
      min = chroma;
    } else {
      max = chroma;
    }
  }
  return clip(oklchToSrgb({ ...lch, c: min }));
}

/** The two paintings of one colour, as gamma encoded sRGB in 0..1. */
export function paintings(color) {
  const lch = typeof color === 'string' ? parseColor(color) : color;
  return { mapped: gamutMap(lch), clipped: clip(oklchToSrgb(lch)) };
}

/** `#RRGGBB` (or `#RRGGBBAA` when translucent) of the gamut mapped painting. */
export function toHex(color) {
  const lch = typeof color === 'string' ? parseColor(color) : color;
  const byte = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0').toUpperCase();
  const rgb = gamutMap(lch).map(byte).join('');
  return lch.alpha < 1 ? `#${rgb}${byte(lch.alpha)}` : `#${rgb}`;
}

/* --------------------------------------------------------------- mixing */

/**
 * `color-mix(in oklab, a p%, b q%)`, per CSS Color 5: percentages that sum past
 * 100 are scaled down to 100; a sum under 100 becomes the result's alpha.
 * Mixed with premultiplied alpha, so mixing toward `transparent` keeps the hue
 * and lowers the alpha.
 */
export function mix(a, p, b, q = 100 - p) {
  const A = typeof a === 'string' ? (a === 'transparent' ? null : parseColor(a)) : a;
  const B = typeof b === 'string' ? (b === 'transparent' ? null : parseColor(b)) : b;
  const sum = p + q;
  const wa = p / sum;
  const wb = q / sum;
  const alphaScale = sum < 100 ? sum / 100 : 1;
  const la = A ? lchToLab(A) : { l: 0, a: 0, b: 0 };
  const lb = B ? lchToLab(B) : { l: 0, a: 0, b: 0 };
  const aa = A ? A.alpha : 0;
  const ab = B ? B.alpha : 0;
  const alpha = aa * wa + ab * wb;
  if (alpha === 0) return { l: 0, c: 0, h: 0, alpha: 0 };
  const pre = (k) => (la[k] * aa * wa + lb[k] * ab * wb) / alpha;
  return { ...labToLch({ l: pre('l'), a: pre('a'), b: pre('b') }), alpha: alpha * alphaScale };
}

/* ----------------------------------------------------------- contrast */

const luminance = ([r, g, b]) => {
  const [R, G, B] = srgbToLinear([r, g, b]);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

/** Composite a translucent sRGB colour over an opaque one, channel by channel. */
const over = (top, alpha, ground) => top.map((x, i) => x * alpha + ground[i] * (1 - alpha));

/**
 * WCAG 2 contrast of `fg` drawn on `bg`, the worse of the two paintings. Either
 * may be translucent: `bg` is composited over `base` first (a soft tint over
 * the surface it sits on), then `fg` over the result.
 */
export function contrast(fg, bg, base) {
  const F = typeof fg === 'string' ? parseColor(fg) : fg;
  const G = typeof bg === 'string' ? parseColor(bg) : bg;
  const Z = base === undefined ? null : typeof base === 'string' ? parseColor(base) : base;
  let worst = Infinity;
  for (const way of ['mapped', 'clipped']) {
    let ground = paintings(G)[way];
    if (G.alpha < 1) {
      if (!Z) throw new Error('color.mjs: a translucent ground needs a base to sit on');
      ground = over(ground, G.alpha, paintings(Z)[way]);
    }
    const front = F.alpha < 1 ? over(paintings(F)[way], F.alpha, ground) : paintings(F)[way];
    const [hi, lo] = [luminance(front), luminance(ground)].sort((x, y) => y - x);
    worst = Math.min(worst, (hi + 0.05) / (lo + 0.05));
  }
  return worst;
}
