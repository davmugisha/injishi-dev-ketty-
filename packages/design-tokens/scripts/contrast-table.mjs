/**
 * contrast-table.mjs — the contrast table of spec 0002 (mobile design system),
 * measured over the package's own palette.
 *
 * The emitter calls `measure()` before it writes anything and refuses to write
 * when a pair is under its floor (AC-2). Every pair is measured in light and in
 * dark, each the worse of the two paintings (`color.mjs`).
 *
 *   text roles      on every ground text sits on                    4.5:1
 *   fill labels     on their own fill                               4.5:1
 *   soft labels     on their soft tint, composited over `surface`   4.5:1
 *   boundaries      on `background` and `surface`                   3:1
 *   border, separator, scrollbar, pressed                           exempt
 *
 * `pressed` is the phone's press highlight, the foreground at 8% over the
 * element. Spec 0002 listed "the pressed colour's edge" at 3:1, which an 8%
 * highlight cannot reach (1.17:1 light, 1.23:1 dark); it is state feedback,
 * not a boundary, and the owner exempted it on 2026-10-28.
 *
 * SOFT LABELS ARE DERIVED, AND THE TWO PLATFORMS DERIVE THEM DIFFERENTLY. The
 * web reads `@heroui/styles` (vibrant palette off); the phone reads
 * `heroui-native` with its vibrant sheet, which `global.css` imports. Each
 * derivation is restated below from the library it comes from, so a pair is
 * measured as each platform actually paints it. Where a derivation fails, the
 * palette authors an override (`herouiSoftLabels`), and the override is what
 * both platforms then draw.
 */
import { contrast, mix } from './color.mjs';

const TEXT_ROLES = ['foreground', 'muted', 'accentText', 'dangerText', 'successText', 'warningText', 'info'];
const TEXT_GROUNDS = ['background', 'surface', 'surfaceSecondary', 'surfaceTertiary', 'default', 'fieldBackground'];
const FILLS = ['accent', 'danger', 'success', 'warning'];
const BOUNDARIES = ['focus', 'fieldBorder'];
const BOUNDARY_GROUNDS = ['background', 'surface'];

/**
 * The soft tint and its label, per platform and theme: [fill %, tone %, fg %].
 * Percentages are CSS `color-mix` arguments, so a pair summing past 100 is
 * scaled down by `mix()`, exactly as the browser does.
 *
 * web:    @heroui/styles 3.2 dist/themes/default/variables.css
 * native: heroui-native 1.0 lib/module/styles/theme.css (fills) and
 *         theme-vibrant.css (labels, 92/8 for every tone)
 */
const SOFT = {
  web: {
    light: { accent: [15, 70, 30], danger: [15, 70, 40], warning: [15, 80, 70], success: [15, 80, 60] },
    // accent 15, not the library's 12: the save overrides the dark tint
    // (`herouiMixes.dark.accentSoft`), so 15% is what the web paints.
    dark: { accent: [15, 80, 30], danger: [15, 80, 30], warning: [12, 80, 30], success: [12, 80, 30] },
  },
  native: {
    light: { accent: [15, 92, 8], danger: [15, 92, 8], warning: [15, 92, 8], success: [15, 92, 8], info: [15, 92, 8] },
    dark: { accent: [15, 92, 8], danger: [15, 92, 8], warning: [15, 92, 8], success: [15, 92, 8], info: [15, 92, 8] },
  },
};

/** `warning` -> `warningSoftForeground`, the override role's key. */
const softKey = (tone) => `${tone}SoftForeground`;

/**
 * Measure every pair. `palette` is `{ light, dark, softLabels }`, each theme a
 * role map of OKLCH strings (aliases already resolved by the caller).
 * Returns one row per pair: `{ theme, kind, fg, on, ratio, floor, ok }`.
 */
export function measure({ light, dark, softLabels = { light: {}, dark: {} } }) {
  const rows = [];
  const push = (theme, kind, fg, on, ratio, floor) =>
    rows.push({ theme, kind, fg, on, ratio, floor, ok: ratio >= floor });

  for (const [theme, p] of [['light', light], ['dark', dark]]) {
    for (const role of TEXT_ROLES) {
      for (const ground of TEXT_GROUNDS) {
        push(theme, 'text', role, ground, contrast(p[role], p[ground]), 4.5);
      }
    }
    for (const fill of FILLS) {
      const label = `${fill}Foreground`;
      push(theme, 'fill label', label, fill, contrast(p[label], p[fill]), 4.5);
    }
    for (const [platform, byTheme] of Object.entries(SOFT)) {
      for (const [tone, [fillPct, tonePct, fgPct]] of Object.entries(byTheme[theme])) {
        const base = p[tone];
        const tint = mix(base, fillPct, 'transparent');
        const override = softLabels[theme]?.[softKey(tone)];
        const label = override ?? mix(base, tonePct, p.foreground, fgPct);
        const name = `${tone}-soft-foreground${override ? '' : ` (${platform} mix)`}`;
        push(theme, `soft label, ${platform}`, name, `${tone}-soft over surface`, contrast(label, tint, p.surface), 4.5);
      }
      // `default-soft` is the default fill at 50% with its own label, on both.
      const tint = mix(p.default, 50, 'transparent');
      push(theme, `soft label, ${platform}`, 'defaultForeground', 'default-soft over surface', contrast(p.defaultForeground, tint, p.surface), 4.5);
    }
    for (const role of BOUNDARIES) {
      for (const ground of BOUNDARY_GROUNDS) {
        push(theme, 'boundary', role, ground, contrast(p[role], p[ground]), 3);
      }
    }
  }
  return rows;
}

/**
 * One platform's own soft label derivation for a tone: the CSS `color-mix` it
 * draws, and the value it resolves to over this palette. The emitter restates
 * it where a light override must not leak into dark.
 */
export function softDerivation(platform, theme, tone, palette) {
  const [, tonePct, fgPct] = SOFT[platform][theme][tone];
  return {
    css: `color-mix(in oklab, var(--${tone}) ${tonePct}%, var(--foreground) ${fgPct}%)`,
    value: mix(palette[tone], tonePct, palette.foreground, fgPct),
  };
}

/** The soft tint of a tone on the phone: the tone at its fill percentage. */
export function softTint(platform, theme, tone, palette) {
  return mix(palette[tone], SOFT[platform][theme][tone][0], 'transparent');
}

/** One line per row, for a report or a refusal. */
export const formatRow = (r) =>
  `${r.ok ? 'ok  ' : 'FAIL'}  ${r.theme.padEnd(5)}  ${r.fg} on ${r.on}: ${r.ratio.toFixed(2)}:1 (floor ${r.floor}:1)`;
