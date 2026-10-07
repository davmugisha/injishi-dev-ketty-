/**
 * derive-palette.mjs — generates `src/theme/palette.ts` from the HeroUI roles
 * in `@injishi/design-tokens` (packages/design-tokens/src/heroui.ts).
 *
 * Run by hand, output committed:
 *
 *   node scripts/derive-palette.mjs           # write src/theme/palette.ts
 *   node scripts/derive-palette.mjs --check    # fail if the file is stale
 *
 * `--check` is the first half of this app's `lint` script (ADR-031 child "the
 * palette gate"), so `pnpm lint` — here and from the repo root — fails on a
 * stale palette. That is the enforcement ADR-030's AC-10 was missing.
 *
 * ADR-030 child "the React Native palette" owns every decision below.
 *
 * Why a build-time conversion. The token package authors its roles in
 * `oklch()`, which React Native's colour parser does not dependably accept
 * across the platforms and versions this app targets. Converting once here
 * costs nothing at runtime, turns a token change into a reviewable diff, and
 * means a wrong conversion shows up in a pull request rather than on a device.
 *
 * Three things this script gets right that a hand conversion does not:
 *
 *  1. The lightness is a PERCENTAGE. `oklch(65.00% 0.1100 208.00)` is L = 0.65
 *     in the OKLab maths, not 65. Feeding the percentage straight in blows out
 *     every colour and still emits a valid hex string, so it is asserted.
 *  2. Out-of-gamut roles are gamut MAPPED, not clipped. `success` is
 *     `oklch(73.29% 0.1974 145.31)` and that chroma at that hue is outside
 *     sRGB; clipping the channels yields a colour the browser does not render
 *     for the same token, which would silently invalidate every contrast
 *     measurement taken against the web. Chroma is reduced with lightness and
 *     hue held, in the CSS Color 4 manner, and every mapped role is reported.
 *  3. The four local corrections (`success600`, `warning600`, `danger600` and
 *     `domainResidence`) are hand-pinned HERE with their measurement asserted,
 *     rather than eyeballed into the output file.
 *
 * Re-running on unchanged tokens must produce no diff. That is AC-10, and it
 * is what makes the generated file trustworthy.
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The colour maths lives beside this file so it can be imported by a test.
// Everything there is a pure function; everything here reads the token package,
// the filesystem and argv. See `scripts/color-math.mjs`.
import {
  alphaHex,
  contrast,
  gamutMap,
  hex,
  over,
  parseOklch,
  round2,
  toBytes,
} from './color-math.mjs';

const require = createRequire(import.meta.url);
const { herouiLight, herouiDark, herouiFixed, herouiAliases } = require('@injishi/design-tokens');

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'theme', 'palette.ts');

/** The order the schemes are emitted, measured and reported in. */
const SCHEMES = ['light', 'dark'];

/* ------------------------------------------------------------------ tokens */

const mapped = [];

/** One authored-looking `oklch()` string, the form the token package writes. */
const oklchOf = (L, C, H) => `oklch(${(L * 100).toFixed(2)}% ${C.toFixed(4)} ${H.toFixed(2)})`;

/** Resolve one role name to `{ oklch, L, C, H, bytes }`, following aliases. */
function role(scheme, name, seen = new Set()) {
  const table = scheme === 'dark' ? herouiDark : herouiLight;
  if (herouiAliases[name] && !(name in table)) {
    if (seen.has(name)) throw new Error(`alias cycle at "${name}"`);
    seen.add(name);
    return role(scheme, herouiAliases[name], seen);
  }
  const raw = table[name] ?? herouiFixed[name];
  if (raw === undefined) throw new Error(`no HeroUI role "${name}"`);

  // Two authored values are not oklch and pass through untouched; `black` is a
  // CSS variable reference with no meaning in RN and resolves to `ink`.
  if (raw === 'transparent') return { oklch: 'transparent', literal: 'transparent' };
  if (raw === 'var(--ink)') return role(scheme, 'ink', seen);
  if (raw.startsWith('#')) {
    const b = [1, 3, 5].map((i) => parseInt(raw.slice(i, i + 2), 16));
    return { oklch: raw, literal: raw.toUpperCase(), bytes: b };
  }

  const authored = parseOklch(raw, `role "${name}" (${scheme})`);
  const { L, C, H } = authored;
  const oklch = raw;

  const { rgb, mappedTo } = gamutMap(L, C, H);
  if (mappedTo !== null) mapped.push({ scheme, name, from: C, to: mappedTo, raw: oklch });
  return { oklch, L, C, H, bytes: toBytes(rgb) };
}


/** A role with its lightness moved. Chroma and hue are the token's, untouched. */
function roleAtL(scheme, name, L) {
  const base = role(scheme, name);
  const { rgb, mappedTo } = gamutMap(L, base.C, base.H);
  if (mappedTo !== null) mapped.push({ scheme, name: `${name}@L${L}`, from: base.C, to: mappedTo, raw: base.oklch });
  return { ...base, L, bytes: toBytes(rgb), oklch: oklchOf(L, base.C, base.H) };
}

/* --------------------------------------------------- the local corrections */

/**
 * Badge tint alpha. The status and Residence tints have no HeroUI role, so they
 * are the hue itself at low alpha, emitted as eight-digit `#RRGGBBAA` — a form
 * React Native accepts on both platforms, and one that keeps every value in the
 * generated file the same kind of thing.
 */
const TINT_ALPHA = { light: 0.14, dark: 0.16 };

/**
 * The status hues have no text-safe step, and neither does `info`.
 *
 * `success` is `oklch(73.29% 0.1935 150.81)` — a FILL lightness paired with a
 * near-ink foreground. As badge ink on its own tint it falls far below 4.5:1.
 * So four darker (light scheme) / lighter (dark scheme) steps are pinned here,
 * hue and chroma held, lightness moved only as far as the floor requires — the
 * rule ADR-025 established for its own five corrections.
 *
 * Each is measured against the ground it is actually used on: the tint fill
 * composited over `surfaceTertiary`, which is the darkest light surface and the
 * lightest dark one, and therefore the worst case in both schemes. The measured
 * ratio is asserted below and written into the generated file's comments.
 *
 * These four belong upstream in the token package next to `accentText`, which
 * ADR-025 authored for exactly this reason. Until they are, they live here.
 */
const TEXT_STEPS = {
  light: { success: 0.47, warning: 0.505, danger: 0.47, info: 0.485 },
  dark: { success: 0.71, warning: 0.75, danger: 0.705, info: 0.745 },
};

const AA_TEXT = 4.5;

/* ----------------------------------------------------------- the key set */

/**
 * The `Palette` key set is EXACTLY what `tokens.ts` exported before this file
 * existed, so every screen keeps compiling. Each key names the HeroUI role it
 * now reads, per the ADR-030 child's role-mapping tables.
 */
function build(scheme) {
  const r = (name) => role(scheme, name);
  const status = (name) => roleAtL(scheme, name, TEXT_STEPS[scheme][name]);
  const a = TINT_ALPHA[scheme];
  const tint = (name) => {
    const base = name === 'info' ? residence : r(name);
    return { bytes: over(base.bytes, a, r('surfaceTertiary').bytes), value: alphaHex(base.bytes, a), of: base };
  };
  // Residence is one key doing two jobs — the badge FILL and the badge INK —
  // so `info` is pinned at its text-safe lightness and both uses read it.
  const residence = status('info');

  const entry = (key, note, resolved) => ({
    key,
    note,
    value: resolved.value ?? hex(resolved.bytes),
    oklch: resolved.oklch ?? resolved.of?.oklch,
    bytes: resolved.bytes,
  });

  return [
    ['/* Brand ramp — retiring. These were the ink ramp wearing brand names; ADR-030 maps them onto neutral roles and nothing new may use them. */'],
    entry('brand900', 'foreground', r('foreground')),
    entry('brand700', 'foregroundHover', r('foregroundHover')),
    entry('brand500', 'muted', r('muted')),
    entry('brand300', 'border', r('border')),
    entry('brand200', 'separator', r('separator')),
    entry('brand100', 'surfaceSecondary', r('surfaceSecondary')),

    ['/* Status hues. The *500 keys are the FILL roles; the *600 keys are the pinned text steps. */'],
    entry('success600', `success at L ${(TEXT_STEPS[scheme].success * 100).toFixed(2)}% — text step, see TEXT_STEPS`, status('success')),
    entry('success500', 'success', r('success')),
    entry('warning600', `warning at L ${(TEXT_STEPS[scheme].warning * 100).toFixed(2)}% — text step, see TEXT_STEPS`, status('warning')),
    entry('warning500', 'warning', r('warning')),
    entry('danger600', `danger at L ${(TEXT_STEPS[scheme].danger * 100).toFixed(2)}% — text step, see TEXT_STEPS`, status('danger')),
    entry('danger500', 'danger', r('danger')),

    ['/* Domains. Teal for Hospitality, violet for Residence — the one hue clear of accent 208, success 145, warning 67 and danger 20. */'],
    entry('domainHospitality', 'accent', r('accent')),
    entry('domainResidence', `info at L ${(TEXT_STEPS[scheme].info * 100).toFixed(2)}% — fill AND ink, see TEXT_STEPS`, residence),

    ['/* Grounds and surfaces. The three surface roles are one step apart in dark (ADR-019). */'],
    entry('bgApp', 'background', r('background')),
    entry('bgTint', 'surfaceSecondary', r('surfaceSecondary')),
    entry('surface1', 'surface', r('surface')),
    entry('surface2', 'surfaceSecondary', r('surfaceSecondary')),
    entry('surface3', 'surfaceTertiary', r('surfaceTertiary')),
    entry('surfaceSunken', 'background', r('background')),
    entry('surfaceInverse', 'foreground', r('foreground')),
    entry('elevate1', 'surfaceSecondary', r('surfaceSecondary')),
    entry('elevate2', 'surfaceTertiary', r('surfaceTertiary')),

    ['/* Text. */'],
    entry('textStrong', 'foreground', r('foreground')),
    entry('textBody', 'foreground — HeroUI has one body step, not two', r('foreground')),
    entry('textMuted', 'muted', r('muted')),
    entry('textSubtle', 'muted — collapses onto muted', r('muted')),
    entry('textOnBrand', 'accentForeground — snow on the green accent fill (ADR-068); never pure white', r('accentForeground')),
    entry('textLink', 'accentText — the accent hue authored for use as text', r('accentText')),

    ["/* Foregrounds for a SOLID status fill. Each is HeroUI's own answer for its own fill; none is white. */"],
    entry('textOnSuccess', 'successForeground — near-ink at the success hue. White on this fill measures ~2:1', r('successForeground')),
    entry('textOnWarning', 'warningForeground — near-ink at the warning hue', r('warningForeground')),
    entry('textOnDanger', 'dangerForeground — near-WHITE here, because the danger fill is the one dark enough to carry it (ADR-025 #2 moved it to L 58 for exactly this)', r('dangerForeground')),

    ['/* Borders and controls. */'],
    entry('borderSubtle', 'separator', r('separator')),
    entry('borderDefault', 'border — decorative hairline, 1.24:1, and that is allowed', r('border')),
    entry('borderStrong', 'fieldOutline — the control boundary that meets 3:1', r('fieldOutline')),
    entry('borderBrand', 'accent', r('accent')),
    entry('action', 'primary -> foreground — the solid neutral button', r('primary')),
    entry('actionHover', 'primaryHover -> foregroundHover — RN has no hover; this is the pressed step', r('primaryHover')),
    entry('actionActive', 'foregroundHover', r('foregroundHover')),
    entry('actionSubtle', 'surfaceSecondary', r('surfaceSecondary')),
    entry('pressInk', 'ink — the fixed near-black; the press highlight on a fill whose label is lighter than it, so a press darkens away from the label (ADR-068)', r('ink')),
    entry('focusRing', 'focus', r('focus')),

    [`/* Tint fills — the hue at ${a} alpha, eight-digit #RRGGBBAA. */`],
    entry('success100', `success at ${a} alpha`, tint('success')),
    entry('warning100', `warning at ${a} alpha`, tint('warning')),
    entry('danger100', `danger at ${a} alpha`, tint('danger')),
    entry('neutral100', 'default', r('default')),
    entry('neutral200', 'surfaceTertiary', r('surfaceTertiary')),
    entry('neutral400', 'muted', r('muted')),
    entry('neutral500', 'muted', r('muted')),
    entry('neutral600', 'muted', r('muted')),
    entry('domainHospitality100', 'surfaceSecondary', r('surfaceSecondary')),
    entry('domainResidence100', `domainResidence at ${a} alpha`, tint('info')),
  ];
}

/* ------------------------------------------------------------- assertions */

const failures = [];
const measurements = {};

function measure(scheme, rows) {
  const get = (key) => rows.find((row) => row.key === key);
  const ground = role(scheme, 'surfaceTertiary').bytes;
  const a = TINT_ALPHA[scheme];

  // Each pinned text step against the tint it is drawn on, which is the ground
  // it actually has to survive — a badge ink never sits on the bare surface.
  for (const [ink, fill] of [
    ['success600', 'success500'],
    ['warning600', 'warning500'],
    ['danger600', 'danger500'],
  ]) {
    const composited = over(get(fill).bytes, a, ground);
    const ratio = contrast(get(ink).bytes, composited);
    measurements[`${scheme}/${ink}`] = ratio;
    if (ratio < AA_TEXT) failures.push(`${scheme} ${ink} on ${fill} tint: ${round2(ratio)} < ${AA_TEXT}:1`);
  }

  // Residence reads its own hue as ink on its own tint.
  const residenceTint = over(get('domainResidence').bytes, a, ground);
  const residenceRatio = contrast(get('domainResidence').bytes, residenceTint);
  measurements[`${scheme}/domainResidence`] = residenceRatio;
  if (residenceRatio < AA_TEXT) failures.push(`${scheme} domainResidence on its own tint: ${round2(residenceRatio)} < ${AA_TEXT}:1`);

  // Body text and the muted step on the darkest (light) / lightest (dark) ground.
  for (const key of ['textStrong', 'textBody', 'textMuted', 'textSubtle', 'textLink']) {
    const ratio = contrast(get(key).bytes, ground);
    measurements[`${scheme}/${key}`] = ratio;
    if (ratio < AA_TEXT) failures.push(`${scheme} ${key} on surfaceTertiary: ${round2(ratio)} < ${AA_TEXT}:1`);
  }

  // A solid status badge is a fill with text on it, so 4.5:1 binds on each.
  // These three replaced a hardcoded '#FFFFFF' in `badge.tsx` and `button.tsx`
  // that nothing measured — and white on the success fill is about 2:1, so the
  // literal was not merely unmeasured, it was failing.
  for (const [ink, fill] of [
    ['textOnSuccess', 'success500'],
    ['textOnWarning', 'warning500'],
    ['textOnDanger', 'danger500'],
  ]) {
    const ratio = contrast(get(ink).bytes, get(fill).bytes);
    measurements[`${scheme}/${ink}`] = ratio;
    if (ratio < AA_TEXT) failures.push(`${scheme} ${ink} on ${fill}: ${round2(ratio)} < ${AA_TEXT}:1`);
  }

  // Nothing drawn on an accent fill may be white, and what is drawn must pass.
  const onAccent = contrast(get('textOnBrand').bytes, get('domainHospitality').bytes);
  measurements[`${scheme}/textOnBrand`] = onAccent;
  if (onAccent < AA_TEXT) failures.push(`${scheme} textOnBrand on accent: ${round2(onAccent)} < ${AA_TEXT}:1`);
  if (hex(get('textOnBrand').bytes) === '#FFFFFF') failures.push(`${scheme} textOnBrand is white`);

  // The solid neutral button and the solid Residence badge both take `bgApp`.
  for (const fill of ['action', 'domainResidence']) {
    const ratio = contrast(get('bgApp').bytes, get(fill).bytes);
    measurements[`${scheme}/bgApp on ${fill}`] = ratio;
    if (ratio < AA_TEXT) failures.push(`${scheme} bgApp on ${fill}: ${round2(ratio)} < ${AA_TEXT}:1`);
  }

  // Control boundaries are 3:1, not 4.5:1 (WCAG 1.4.11).
  const outline = contrast(get('borderStrong').bytes, ground);
  measurements[`${scheme}/borderStrong`] = outline;
  if (outline < 3) failures.push(`${scheme} borderStrong on surfaceTertiary: ${round2(outline)} < 3:1`);
}

/* ------------------------------------------------------------------ emit */

function render(scheme, rows, first) {
  const lines = [];
  for (const row of rows) {
    if (Array.isArray(row)) {
      lines.push('', `  ${row[0]}`);
      continue;
    }
    const source = row.oklch ? ` ${row.oklch}` : '';
    lines.push(`  ${row.key}: '${row.value}', // ${row.note} —${source}`);
  }
  const type = first ? '' : ': Palette';
  const suffix = first ? ' as const' : '';
  return `const ${scheme}${type} = {${lines.join('\n')}\n}${suffix};`;
}

const rows = Object.fromEntries(SCHEMES.map((s) => [s, build(s)]));
for (const scheme of SCHEMES) measure(scheme, rows[scheme]);

const report = [...new Set(mapped.map((m) => `${m.scheme} ${m.name}: chroma ${m.from.toFixed(4)} -> ${m.to.toFixed(4)}  (${m.raw})`))];

const file = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by \`scripts/derive-palette.mjs\` from the HeroUI roles in
 * \`@injishi/design-tokens\`. To change a colour, change the token and re-run
 * the script; re-running it on unchanged tokens produces no diff (AC-10).
 *
 * This is the green HeroUI palette the rest of the platform already renders,
 * converted from \`oklch()\` to hex once, at build time, because React Native's
 * colour parser does not dependably accept \`oklch()\`. Out-of-gamut roles were
 * gamut-mapped by reducing chroma with lightness and hue held, so a value here
 * is the closest in-gamut colour to what a browser paints for the same token —
 * never a clipped approximation of it.
 *
 * The key set is the one \`tokens.ts\` has always exported, so no screen had to
 * change. Each key's comment names the HeroUI role it reads and the \`oklch()\`
 * string it came from, so any value here traces back to its source in one step.
 * ADR-030 child "the React Native palette" owns the mapping and retires the
 * \`brand*\` and \`neutral*\` keys once every call site has moved.
 *
 * Measured, every scheme, against \`surfaceTertiary\` — the darkest light
 * surface and the lightest dark one, and therefore the worst case in each:
 *
${SCHEMES.map((s) =>
  [
    ` *   ${s}:`,
    ...['textBody', 'textMuted', 'textLink', 'success600', 'warning600', 'danger600', 'domainResidence', 'textOnBrand', 'borderStrong']
      .map((k) => ` *     ${k.padEnd(17)} ${round2(measurements[`${s}/${k}`])}`),
  ].join('\n'),
).join('\n')}
 *
 * \`textOnBrand\` is snow, the ink the design system puts on its accent. ADR-068
 * set the accent fill at L 0.54 so that snow measures ${round2(measurements['light/textOnBrand'])} on it; anything
 * drawn on an accent fill takes this value, and nothing else does.
 */

export type ColorScheme = 'light' | 'dark';

/** Light scheme. */
${render('light', rows.light, true)}

/** Every palette key resolves to a color string; both schemes share the shape. */
export type Palette = { [K in keyof typeof light]: string };

/** Dark scheme. Same key set by construction. */
${render('dark', rows.dark, false)}


export const palettes: Record<ColorScheme, Palette> = { light, dark };
`;

/* ------------------------------------------------------------------- run */

for (const line of report) console.log(`gamut-mapped  ${line}`);
if (!report.length) console.log('gamut-mapped  (none)');
console.log('');
for (const [k, v] of Object.entries(measurements)) console.log(`measured      ${k.padEnd(34)} ${round2(v)}`);
console.log('');

if (failures.length) {
  for (const f of failures) console.error(`FAIL  ${f}`);
  process.exit(1);
}

const check = process.argv.includes('--check');
// Line endings are not drift: a Windows checkout with core.autocrlf holds CRLF
// while the script emits LF, and a byte comparison called that STALE.
const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : null;
if (check) {
  if (existing !== file) {
    // This runs as the first half of `pnpm lint`, so a failure here is one of
    // two very different things and the message is the only thing that tells
    // them apart. Say plainly that this is not a lint error and name the fix.
    console.error('');
    console.error('FAIL  src/theme/palette.ts is STALE. This is not a lint error.');
    console.error('      The committed palette no longer matches the HeroUI roles in');
    console.error('      @injishi/design-tokens. Regenerate it and commit the diff:');
    console.error('');
    console.error('        node scripts/derive-palette.mjs');
    console.error('');
    process.exit(1);
  }
  console.log('ok    src/theme/palette.ts is up to date');
} else if (existing === file) {
  console.log('ok    src/theme/palette.ts unchanged');
} else {
  writeFileSync(OUT, file);
  console.log(`ok    wrote ${OUT}`);
}
