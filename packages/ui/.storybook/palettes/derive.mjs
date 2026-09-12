#!/usr/bin/env node
/**
 * Derive a CANDIDATE palette from a HeroUI theme-builder URL, for Storybook
 * only (ADR-045 amendment, decision 11). It never touches the product: the
 * live palette is `packages/design-tokens/src/heroui.ts`, and a candidate that
 * wins review is adopted THERE, by hand, through the ADR-025 procedure.
 *
 *   pnpm --filter @injishi/ui palette:candidate "<builder url>" <name>
 *
 * writes `palettes/<name>.css` (the role overrides, scoped to
 * `[data-palette="<name>"]`) and `palettes/<name>.json` (what the Storybook
 * toolbar lists, plus the measurement report).
 *
 * WHY DERIVE rather than paste: the builder renders client side, so there is
 * nothing to fetch, and pasting its output is exactly what AGENTS.md forbids
 * for the product ("it silently undoes the five WCAG corrections"). The
 * mapping from builder parameters to values is visible in `heroui.ts` itself,
 * which was generated at base 0.01 / chroma 0.11 / hue 208 / lightness 0.65:
 *
 *   - a role at the theme hue with chroma >= 0.05 is ACCENT-family (accent,
 *     focus, accentText): its chroma scales by chroma / 0.11;
 *   - a role at the theme hue below that is NEUTRAL: its chroma scales by
 *     base / 0.01;
 *   - every one of them moves to the new hue;
 *   - a role whose lightness IS the source lightness (the accent fill, and the
 *     dark focus ring that equals it) moves to the new lightness;
 *   - everything else keeps its lightness, and status hues (danger 20,
 *     success 145, warning 67, info 285) and plain white are left alone.
 *
 * Then ADR-025's rule, re-measured rather than assumed: keep hue and chroma,
 * move ONLY lightness, and only as far as the floor requires. Each contrast is
 * the WORST of three renderings, because a chroma beyond sRGB displays
 * differently per device: clipped to sRGB, clipped to Display P3, and the
 * colour as specified.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { herouiLight, herouiDark, herouiFixed } = require("@injishi/design-tokens");

/** The builder parameters `heroui.ts` was generated at (its own header says so). */
const SOURCE = { base: 0.01, chroma: 0.11, hue: 208, lightness: 0.65 };

/** HeroUI's form-radius presets, as its default theme spells `medium`. */
const FORM_RADIUS = {
  none: "0",
  small: "calc(var(--radius) * 0.5)",
  medium: "calc(var(--radius) * 1.5)",
  large: "calc(var(--radius) * 2)",
  full: "9999px",
};

// ---------------------------------------------------------------- arguments
const [url, name] = process.argv.slice(2);
if (!url || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('usage: derive.mjs "<heroui theme builder url>" <kebab-name>');
  process.exit(1);
}
const q = new URL(url).searchParams;
const num = (k) => {
  const v = Number(q.get(k));
  if (!q.has(k) || Number.isNaN(v)) throw new Error(`the url has no numeric "${k}"`);
  return v;
};
const P = {
  base: num("base"),
  chroma: num("chroma"),
  hue: num("hue"),
  lightness: num("lightness"),
  formRadius: q.get("formRadius") ?? "none",
  fontFamily: q.get("fontFamily") ?? "figtree",
};
if (!(P.formRadius in FORM_RADIUS)) throw new Error(`unknown formRadius "${P.formRadius}"`);

// ------------------------------------------------------------- colour maths
const OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/;
const parse = (v) => {
  const m = OKLCH.exec(v);
  return m ? { L: +m[1], C: +m[2], H: +m[3] } : null;
};
const fmt = ({ L, C, H }) => `oklch(${L.toFixed(2)}% ${C.toFixed(4)} ${H.toFixed(2)})`;

/** OKLCH -> linear sRGB, unclipped (Ottosson). */
function linearSrgb({ L, C, H }) {
  const l0 = L / 100, a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (l0 + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (l0 - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (l0 - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const hexToLinear = (hex) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
const dot = (r, v) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
const clip = (v) => v.map((x) => Math.min(1, Math.max(0, x)));
const SRGB_TO_XYZ = [
  [0.4123908, 0.3575843, 0.1804808],
  [0.212639, 0.7151687, 0.0721923],
  [0.0193308, 0.1191948, 0.9505322],
];
const XYZ_TO_P3 = [
  [2.4934969, -0.9313836, -0.4027108],
  [-0.829489, 1.7626641, 0.0236247],
  [0.0358458, -0.0761724, 0.9568845],
];
const P3_Y = [0.2289746, 0.6917385, 0.0792869];

/** Relative luminance under each rendering a real screen might apply. */
function luminances(value) {
  const c = parse(value);
  const lin = c ? linearSrgb(c) : hexToLinear(value);
  const xyz = SRGB_TO_XYZ.map((r) => dot(r, lin));
  const p3 = clip(XYZ_TO_P3.map((r) => dot(r, xyz)));
  return {
    srgb: dot(SRGB_TO_XYZ[1], clip(lin)),
    p3: dot(P3_Y, p3),
    exact: Math.max(0, xyz[1]),
  };
}
const ratio = (y1, y2) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);
/** The worst contrast across the three renderings. */
function contrast(a, b) {
  const A = luminances(a), B = luminances(b);
  return Math.min(ratio(A.srgb, B.srgb), ratio(A.p3, B.p3), ratio(A.exact, B.exact));
}
const outOfSrgb = (v) => {
  const c = parse(v);
  return !!c && linearSrgb(c).some((x) => x < -1e-4 || x > 1 + 1e-4);
};

// ------------------------------------------------------------ the mapping
const isThemeHue = (c) => Math.abs(c.H - SOURCE.hue) < 0.5;
function remap(value) {
  const c = parse(value);
  if (!c || !isThemeHue(c)) return value;
  const accentFamily = c.C >= 0.05;
  return fmt({
    L: Math.abs(c.L - SOURCE.lightness * 100) < 0.01 && accentFamily ? P.lightness * 100 : c.L,
    C: accentFamily ? c.C * (P.chroma / SOURCE.chroma) : c.C * (P.base / SOURCE.base),
    H: P.hue,
  });
}
const mapRoles = (roles) => Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, remap(v)]));
const fixed = mapRoles(herouiFixed);
const light = mapRoles(herouiLight);
const dark = mapRoles(herouiDark);
const themes = { light, dark };

// ------------------------------------------------------------- corrections
/**
 * The pairs ADR-025 measured, each against the ground that is hardest for it.
 * `step` is the direction lightness moves to gain contrast on that ground.
 */
const CHECKS = [
  { theme: "light", role: "focus", on: ["surface", "background"], floor: 3, step: -0.25, why: "focus ring, WCAG 2.4.11" },
  { theme: "light", role: "accentText", on: ["surfaceTertiary", "surface"], floor: 4.5, step: -0.25, why: "teal as text" },
  { theme: "light", role: "muted", on: ["surfaceTertiary"], floor: 4.5, step: -0.25, why: "muted text" },
  { theme: "light", role: "fieldOutline", on: ["surfaceTertiary", "fieldBackground"], floor: 3, step: -0.25, why: "field boundary, WCAG 1.4.11" },
  { theme: "dark", role: "focus", on: ["surfaceTertiary", "surface"], floor: 3, step: 0.25, why: "focus ring, WCAG 2.4.11" },
  { theme: "dark", role: "accentText", on: ["surfaceTertiary", "surface"], floor: 4.5, step: 0.25, why: "teal as text" },
  { theme: "dark", role: "muted", on: ["surfaceTertiary"], floor: 4.5, step: 0.25, why: "muted text" },
  { theme: "dark", role: "fieldOutline", on: ["surfaceTertiary", "fieldBackground"], floor: 3, step: 0.25, why: "field boundary, WCAG 1.4.11" },
];
const worst = (value, grounds, roles) => Math.min(...grounds.map((g) => contrast(value, roles[g])));

const report = [];
for (const chk of CHECKS) {
  const roles = themes[chk.theme];
  const before = roles[chk.role];
  let c = parse(before);
  let measured = worst(before, chk.on, roles);
  const start = measured;
  while (measured < chk.floor && c.L > 0 && c.L < 100) {
    c = { ...c, L: c.L + chk.step };
    measured = worst(fmt(c), chk.on, roles);
  }
  roles[chk.role] = fmt(c);
  report.push({
    theme: chk.theme,
    role: chk.role,
    why: chk.why,
    floor: chk.floor,
    derived: before,
    derivedRatio: +start.toFixed(2),
    shipped: roles[chk.role],
    shippedRatio: +measured.toFixed(2),
    corrected: roles[chk.role] !== before,
  });
}
// The placeholder is held equal to muted, as the builder emits it (ADR-025 #3).
light.fieldPlaceholder = light.muted;
dark.fieldPlaceholder = dark.muted;

// The accent foreground: keep the source's ink if it clears 4.5:1 on the new
// fill in both themes, otherwise take white, otherwise say so and stop.
const WHITE = "oklch(99.11% 0 0)";
for (const [theme, roles] of Object.entries(themes)) {
  const ink = roles.accentForeground;
  const choice = contrast(ink, roles.accent) >= 4.5 ? ink : contrast(WHITE, roles.accent) >= 4.5 ? WHITE : null;
  if (!choice) throw new Error(`${theme}: neither ink nor white reaches 4.5:1 on accent ${roles.accent}`);
  roles.accentForeground = choice;
  report.push({
    theme,
    role: "accentForeground",
    why: "label on the accent fill",
    floor: 4.5,
    derived: ink,
    derivedRatio: +contrast(ink, roles.accent).toFixed(2),
    shipped: choice,
    shippedRatio: +contrast(choice, roles.accent).toFixed(2),
    corrected: choice !== ink,
  });
}

// ------------------------------------------------------------------ output
const kebab = (k) => k.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
const block = (roles) =>
  Object.entries(roles)
    .map(([k, v]) => `  --${kebab(k)}: ${v};`)
    .join("\n");
const sel = `:root[data-palette="${name}"]`;
const css = `/* AUTO-GENERATED by .storybook/palettes/derive.mjs. Do not edit by hand.
 * A CANDIDATE palette for Storybook review only. It is NOT the product palette,
 * which is packages/design-tokens/src/heroui.ts (ADR-045 decision 11).
 *
 * Builder: ${url}
 * Params:  base ${P.base} · chroma ${P.chroma} · hue ${P.hue} · lightness ${P.lightness} · formRadius ${P.formRadius}
 *
 * Specificity: the light block (0,2,0) beats heroui.css's \`.dark\` (0,1,0), so
 * the dark block repeats the selector with \`.dark\` (0,3,0) to win it back. */

${sel} {
${block(fixed)}
${block(light)}
  --field-radius: ${FORM_RADIUS[P.formRadius]};
}

${sel}.dark {
${block(dark)}
}
`;
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(here, { recursive: true });
writeFileSync(join(here, `${name}.css`), css);
const manifest = {
  name,
  title: `Candidate: hue ${P.hue} · chroma ${P.chroma} · L ${P.lightness}`,
  url,
  params: P,
  accentOutOfSrgb: outOfSrgb(light.accent),
  corrections: report,
};
writeFileSync(join(here, `${name}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

// ------------------------------------------------------------------ report
console.log(`wrote palettes/${name}.css and palettes/${name}.json`);
console.log(`accent ${light.accent}${manifest.accentOutOfSrgb ? "  (OUTSIDE sRGB: clipped on ordinary screens)" : ""}`);
if (P.fontFamily.toLowerCase() !== "figtree") {
  console.log(`note: fontFamily "${P.fontFamily}" is ignored; the product face is Figtree.`);
}
for (const r of report) {
  const mark = r.corrected ? "CORRECTED" : "ok       ";
  console.log(
    `${mark} ${r.theme.padEnd(5)} ${r.role.padEnd(16)} ${String(r.derivedRatio).padStart(5)} -> ${String(r.shippedRatio).padStart(5)}:1 (floor ${r.floor})  ${r.shipped}`,
  );
}
