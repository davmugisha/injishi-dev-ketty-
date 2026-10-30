/**
 * The phone's design vocabulary, as the `native` halves of the five design
 * rules read it (mobile spec 0002, D-z).
 *
 * The web halves read `@injishi/design-tokens`' CSS scale: `text-2xs`,
 * `max-w-read`, `duration-quick`, and grounds that pin a theme block. None of
 * that exists on the phone. Uniwind compiles no named type step, no named
 * width and no named duration, and React Native has no cascade, so a class on
 * a `View` paints that view and nothing inside it. What the phone has instead
 * is the UI kit in `apps/mobile/src/components/ui/`: a type table read by
 * `Text`, sizes named in `metrics.ts` or stepped on `rnSpace`, motion read
 * from `motion.ts`, and the colour roles HeroUI Native and the palette emit.
 * This file is that vocabulary, read from the files that own it wherever a
 * file can be read, so a re-tuned palette changes what the rules allow with no
 * edit here.
 *
 * TWO SOURCES ARE READ, ONE IS WRITTEN DOWN.
 *
 *   - `packages/design-tokens/generated/injishi-native.json`: every palette
 *     role's hex in both themes, which is what lets the ground rule ask "is
 *     this the same colour as the pair?" instead of trusting a list.
 *   - `packages/design-tokens/generated/injishi-native.css`: the `--color-*`
 *     utilities the palette adds to HeroUI's (`accent-text`, `info-soft`,
 *     `pressed`, the soft labels).
 *   - HeroUI Native's own utilities are written down below, from version
 *     1.0.10's `lib/module/styles/theme.css` and its component sheets. They are
 *     a dependency's fixed names, not a fact this repo authors, and the
 *     package's path under `node_modules/.pnpm` carries a hash no rule should
 *     guess at. Re-read both lists on a HeroUI Native upgrade.
 *
 * Either generated file missing reads as empty: the rules still run on HeroUI's
 * names, and the palette's own roles are reported until the package is
 * generated again, which is the loud direction.
 */

import { readFileSync } from 'node:fs';

/** The path a rule is linting, with forward slashes, for the suffix checks below. */
export function filenameOf(context) {
  return (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/');
}

function readGenerated(name) {
  try {
    return readFileSync(new URL(`../../packages/design-tokens/generated/${name}`, import.meta.url), 'utf8');
  } catch {
    return null;
  }
}

/** `{ light: { role: '#RRGGBB[AA]' }, dark: {...} }`. */
const PALETTE = (() => {
  const text = readGenerated('injishi-native.json');
  if (!text) return { light: {}, dark: {} };
  try {
    const json = JSON.parse(text);
    return { light: json.light ?? {}, dark: json.dark ?? {} };
  } catch {
    return { light: {}, dark: {} };
  }
})();

/** The `--color-*` names the palette's `@theme inline` block adds. */
const PALETTE_UTILITIES = (() => {
  const text = readGenerated('injishi-native.css');
  if (!text) return [];
  return [...text.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]);
})();

/** Every `--color-*` HeroUI Native 1.0.10's `theme.css` defines. */
const HEROUI_UTILITIES = [
  'accent', 'accent-foreground', 'accent-hover', 'accent-soft', 'accent-soft-foreground', 'accent-soft-hover',
  'backdrop', 'background', 'background-inverse', 'background-secondary', 'background-tertiary',
  'border', 'border-secondary', 'border-tertiary',
  'danger', 'danger-foreground', 'danger-hover', 'danger-soft', 'danger-soft-foreground', 'danger-soft-hover',
  'default', 'default-foreground', 'default-hover', 'default-soft', 'default-soft-foreground', 'default-soft-hover',
  'field', 'field-border', 'field-border-focus', 'field-border-hover', 'field-focus', 'field-foreground',
  'field-hover', 'field-placeholder',
  'focus', 'foreground', 'link', 'muted', 'overlay', 'overlay-foreground', 'segment', 'segment-foreground',
  'separator', 'separator-secondary', 'separator-tertiary',
  'success', 'success-foreground', 'success-hover', 'success-soft', 'success-soft-foreground', 'success-soft-hover',
  'surface', 'surface-foreground', 'surface-hover', 'surface-secondary', 'surface-secondary-foreground',
  'surface-tertiary', 'surface-tertiary-foreground',
  'warning', 'warning-foreground', 'warning-hover', 'warning-soft', 'warning-soft-foreground', 'warning-soft-hover',
];

/**
 * The grounds HeroUI Native's own components paint, read from version 1.0.10's
 * component sheets (`background-color: var(--color-*)`). `accent-foreground`
 * and `field-placeholder` also appear there, as small marks (a switch's thumb,
 * a caret), never as a surface, so they are not here.
 */
const HEROUI_GROUNDS = [
  'default', 'overlay', 'accent', 'field', 'surface', 'danger', 'separator', 'warning', 'success',
  'danger-soft', 'backdrop', 'accent-soft', 'warning-soft', 'surface-tertiary', 'surface-secondary',
  'success-soft', 'segment',
];

/** Every colour utility the phone can name: HeroUI's plus the palette's. */
export const NATIVE_COLOURS = new Set([...HEROUI_UTILITIES, ...PALETTE_UTILITIES]);

/**
 * The grounds the phone may paint, each with the text role that is its pair.
 *
 * HeroUI's component grounds; `background`, the screen; every soft fill that
 * has a soft label (HeroUI's four plus `default-soft`, and the palette's
 * `info-soft`); and `pressed`, the kit's press layer (D-q). `separator`,
 * `backdrop` and `pressed` are layers, a line, a scrim and a tint, and carry no
 * text, so they have no pair.
 */
export const GROUND_PAIRS = (() => {
  const grounds = new Set([...HEROUI_GROUNDS, 'background', 'pressed']);
  for (const name of NATIVE_COLOURS) {
    if (name.endsWith('-soft') && NATIVE_COLOURS.has(`${name}-foreground`)) grounds.add(name);
  }
  const pairs = new Map();
  for (const ground of grounds) {
    if (ground === 'background') pairs.set(ground, 'foreground');
    else if (NATIVE_COLOURS.has(`${ground}-foreground`)) pairs.set(ground, `${ground}-foreground`);
    else pairs.set(ground, null);
  }
  return pairs;
})();

/**
 * The kit's text tones (D-l) and the palette role each draws in, as
 * `toneRoles` in `apps/mobile/src/components/ui/text.tsx` declares them. The
 * plugin's test reads that file and fails if the two disagree.
 */
export const TONE_ROLES = {
  default: 'foreground',
  muted: 'muted',
  accent: 'accent-text',
  success: 'success-text',
  warning: 'warning-text',
  danger: 'danger-text',
  info: 'info',
  onAccent: 'accent-foreground',
};

/**
 * The text a NEUTRAL ground carries besides its pair: every tone but
 * `onAccent`. D-l chose a status colour's TEXT role as its tone because that
 * role clears 4.5:1 on the neutral grounds, so `bg-surface` under
 * `text-danger-text` is the design, not a mismatch.
 */
const NEUTRAL_TEXT = Object.entries(TONE_ROLES)
  .filter(([tone]) => tone !== 'onAccent')
  .map(([, role]) => role);

/** A utility's palette key: HeroUI calls the field ground `field`, the palette `field-background`. */
function paletteKey(role) {
  return role === 'field' ? 'field-background' : role;
}

function channels(hex) {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex ?? '');
  if (!m) return null;
  const n = (i) => Number.parseInt(m[1].slice(i, i + 2), 16);
  return [n(0), n(2), n(4), m[2] ? Number.parseInt(m[2], 16) : 255];
}

/**
 * Two roles draw the same colour in both themes, within 4 of 255 per channel.
 *
 * The tolerance is for one fact: the save rounds `default-foreground` to
 * `#172520` where `foreground` is `#172522`, two steps of blue apart and the
 * same ink to any eye. A role HeroUI derives at runtime (`accent-soft`'s label)
 * has no hex here and is never "the same" as anything but itself.
 */
export function sameColour(a, b) {
  if (a === b) return true;
  for (const theme of ['light', 'dark']) {
    const x = channels(PALETTE[theme][paletteKey(a)]);
    const y = channels(PALETTE[theme][paletteKey(b)]);
    if (!x || !y) return false;
    if (x[3] !== y[3]) return false;
    if (x.slice(0, 3).some((v, i) => Math.abs(v - y[i]) > 4)) return false;
  }
  return true;
}

/** A neutral ground: its pair is the page's `foreground`, in both themes. */
const NEUTRAL_GROUNDS = new Set(
  [...GROUND_PAIRS].filter(([, pair]) => pair && sameColour(pair, 'foreground')).map(([ground]) => ground),
);

/** The roles that may draw on `ground`. Null for a layer, which carries no text. */
export function textAllowedOn(ground) {
  const pair = GROUND_PAIRS.get(ground);
  if (!pair) return null;
  return NEUTRAL_GROUNDS.has(ground) ? [pair, ...NEUTRAL_TEXT.filter((r) => r !== pair)] : [pair];
}

/** True when `role` may draw on `ground`: one of its roles, or the same colour as one. */
export function agreesWith(ground, role) {
  const allowed = textAllowedOn(ground);
  if (!allowed) return true;
  return allowed.some((r) => r === role || sameColour(r, role));
}

/** `bg-` suffixes that set something other than a colour, or no colour at all. */
const NOT_A_COLOUR = /^(?:transparent|none|inherit|current|auto|cover|contain|fixed|local|scroll|center|top|bottom|left|right|repeat|no-repeat|repeat-[xy]|repeat-round|repeat-space|clip-.+|origin-.+|blend-.+|linear-.+|radial(?:-.+)?|conic(?:-.+)?|gradient-.+|size-.+|position-.+|left-.+|right-.+|top-.+|bottom-.+)$/;

/** The colour a `bg-` suffix names, or null when it names none. Opacity stays on. */
export function backgroundColourOf(suffix) {
  if (!suffix || NOT_A_COLOUR.test(suffix)) return null;
  return suffix;
}

/** Tailwind's own palette names, which are colours but never a role here. */
const RAW_COLOUR = /^(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|\[.+\]|\(.+\))$/;

/** True when a `text-` suffix names a colour (a role or a raw colour), not a size or an alignment. */
export function isTextColour(suffix) {
  return NATIVE_COLOURS.has(suffix) || (RAW_COLOUR.test(suffix) && !/^\[\d/.test(suffix));
}
