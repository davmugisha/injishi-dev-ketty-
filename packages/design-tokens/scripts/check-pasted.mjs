/**
 * check-pasted.mjs — fail when apps/app's pasted palette drifts from this one.
 *
 * apps/app does not import the package's sheet. It draws HeroUI Pro's `mouve`
 * theme, and `packages/ui/src/styles/injishi.css` pastes the Injishi values
 * over it, under `mouve`'s own selectors. A paste is a copy, and a copy drifts:
 * until 2026-10-28 it held the 10-26 save's raw values while the web drew the
 * corrected ones. This check is what keeps the two one palette (spec 0002 D-d).
 *
 * Its scope is exactly the colour variables the current save's `css` export
 * defines, per theme: the ones the paste exists to carry. Each must be in the
 * paste, and equal `src/heroui.ts` (through `dist/`) as OKLCH numbers to three
 * decimals, so `95.5%` and `95.50%` agree and a real move does not. App
 * authored values (`--spacing`, `--field-radius`, `--surface-radius`,
 * `--control-radius`, the chart and status roles) are not compared.
 *
 *   node scripts/check-pasted.mjs
 *
 * Run as the third part of `pnpm -F @injishi/design-tokens check`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseColor } from './color.mjs';

const require = createRequire(import.meta.url);
const tokens = require('../dist');
const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const PASTE = join(PKG, '..', 'ui', 'src', 'styles', 'injishi.css');
const PASTE_NAME = 'packages/ui/src/styles/injishi.css';

/** The newest save folder: its name is the save's `updatedAt`. */
const SAVE = readdirSync(join(PKG, 'saves'))
  .filter((name) => /^\d+$/.test(name))
  .sort((a, b) => Number(b) - Number(a))[0];

/**
 * Every top level rule of a stylesheet, `{ light, dark }` per declaration
 * name, by the `mouve` selectors each rule carries. A rule naming both themes
 * applies to both; a theme's own rule wins over it, as later CSS would.
 */
function declarationsByTheme(css) {
  const out = { light: {}, dark: {} };
  const shared = { light: {}, dark: {} };
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selectors, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const light = selectors.includes('mouve-light');
    const dark = selectors.includes('mouve-dark');
    if (!light && !dark) continue;
    const decls = Object.fromEntries(
      [...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
    );
    const target = light && dark ? shared : out;
    if (light) Object.assign(target.light, decls);
    if (dark) Object.assign(target.dark, decls);
  }
  return {
    light: { ...shared.light, ...out.light },
    dark: { ...shared.dark, ...out.dark },
  };
}

/** `surface-secondary` -> `surfaceSecondary`, `chart-1` -> `chart1`. */
const camel = (name) => name.replace(/-([a-z\d])/g, (_, ch) => ch.toUpperCase());

/** OKLCH numbers to three decimals; a hue is moot on a grey. */
function numbers(value) {
  const c = parseColor(value);
  const r = (x) => Math.round(x * 1000) / 1000;
  return [r(c.l), r(c.c), c.c < 0.0005 ? 0 : r(c.h), r(c.alpha)].join(' ');
}

const save = declarationsByTheme(readFileSync(join(PKG, 'saves', SAVE, 'globals.css'), 'utf8'));
const paste = declarationsByTheme(readFileSync(PASTE, 'utf8'));
const palette = { light: tokens.herouiLight, dark: tokens.herouiDark };

const problems = [];
let compared = 0;
for (const theme of ['light', 'dark']) {
  for (const [name, savedValue] of Object.entries(save[theme])) {
    if (!/^oklch\(/i.test(savedValue)) continue;
    const expected = palette[theme][camel(name)];
    if (expected === undefined) {
      problems.push(`${theme} --${name}: the save defines it, src/heroui.ts has no role for it`);
      continue;
    }
    const found = paste[theme][name];
    compared += 1;
    if (found === undefined) {
      problems.push(`${theme} --${name}: missing from the paste (expected ${expected})`);
    } else if (numbers(found) !== numbers(expected)) {
      problems.push(`${theme} --${name}: the paste has ${found}, src/heroui.ts has ${expected}`);
    }
  }
}

if (problems.length) {
  console.error(`FAIL  ${PASTE_NAME} drifted from src/heroui.ts (save ${SAVE})`);
  for (const line of problems) console.error(`      ${line}`);
  console.error('');
  console.error('      Paste the values from src/heroui.ts into that file, under the');
  console.error('      mouve-light and mouve-dark selectors. Never the other way round.');
  console.error('');
  process.exit(1);
}
console.log(`ok    ${PASTE_NAME}: ${compared} colours equal src/heroui.ts (save ${SAVE})`);
