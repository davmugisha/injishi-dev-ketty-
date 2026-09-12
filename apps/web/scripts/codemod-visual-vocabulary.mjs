/**
 * codemod-visual-vocabulary.mjs — ADR-027's rollout steps 3 and 4, applied.
 *
 *   node scripts/codemod-visual-vocabulary.mjs --dry
 *   node scripts/codemod-visual-vocabulary.mjs
 *
 * ADR-027 was accepted on 2026-08-29 and specifies every mapping below in a
 * table. Its rollout never ran in this checkout: the tokens it needed were
 * authored in a repository that was deleted before they crossed the mirror, so
 * `text-2xs` and `max-w-page` resolved to nothing here and migrating onto them
 * would have silently unstyled the app. ADR-034 task 4 emitted them; this
 * applies the migration they were emitted for.
 *
 * NOTHING HERE IS A NEW DECISION. Every row is transcribed from ADR-027 §3
 * (the 164 hand-typed sizes and the step each snaps to) and §4 (the 31 widths
 * and the six names that absorb them). Where a value is absent from those
 * tables the file is left alone and reported, because a mapping this codemod
 * invented would be a design decision made by a script.
 *
 * SCOPE. String literals and template-literal chunks, the same surface the lint
 * rules read — ADR-027 §8 explains why a `className`-only pass would miss most
 * of the codebase. Word boundaries are respected, so `text-[13px]` inside
 * `md:text-[13px]` migrates and `max-w-[46ch]` does not match the width table
 * at all.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

/**
 * `--src <dir>` points this at a second app.
 *
 * ADR-027 scoped itself to `apps/web` — *"the app with the most surface, the
 * most donor material, and the only consumer of `@injishi/ui`, so it is the
 * honest test of whether the standard holds"* — and left the other apps to
 * their own pass, noting that once the tokens are emitted *"the later pass for
 * those three apps then has nothing left to author."* This flag is that pass:
 * the tables are the same tables, because the vocabulary is the same
 * vocabulary. Nothing about the mapping is web-specific.
 */
const srcFlag = process.argv.indexOf('--src');
const SRC = srcFlag === -1 ? join(ROOT, 'src') : join(process.cwd(), process.argv[srcFlag + 1]);

/** ADR-027 §3. Hand-typed size -> named step. */
const TYPE = {
  '9px': '2xs', '10px': '2xs', '11px': '2xs', '0.625rem': '2xs',
  '12px': 'xs',
  '13px': 'sm', '14px': 'sm',
  '15px': 'base', '16px': 'base',
  '17px': 'lg', '18px': 'lg',
  '19px': 'xl', '20px': 'xl', '21px': 'xl', '22px': 'xl',
  '24px': '2xl', '26px': '2xl',
  '28px': '3xl', '30px': '3xl',
  '32px': 'display-sm', '34px': 'display-sm',
  '40px': 'display-md', '44px': 'display-md',
  '56px': 'display-lg',
  // `apps/app`'s own half-pixel values, added when the pass reached that app.
  // Not new decisions: the same eleven steps, the same nearest-step rule
  // ADR-027 §3 applied, over values ADR-027 never saw because it measured
  // `apps/web` only. 10.5 and 11.5 land on `2xs` (11), 12.5 on `xs` (12) —
  // 0.5 nearer than `sm` — and 13.5 on `sm` (14).
  '10.5px': '2xs', '11.5px': '2xs',
  '12.5px': 'xs',
  '13.5px': 'sm',
};

/** ADR-027 §4, the "Absorbs" column. Hand-typed width -> container name. */
const WIDTH_PX = {
  '1120px': 'page',
  '840px': 'wide', '820px': 'wide', '760px': 'wide',
  '720px': 'read', '640px': 'read', '630px': 'read',
  '560px': 'narrow', '520px': 'narrow',
  '440px': 'form', '420px': 'form',
  '400px': 'tile', '370px': 'tile', '310px': 'tile', '300px': 'tile', '260px': 'tile',
  // `apps/app`'s own widths, by the same absorb rule: 1000px is a page shell,
  // 860 and 900 are wide bands, 280 and 320 are tiles.
  '1000px': 'page',
  '900px': 'wide', '860px': 'wide',
  '320px': 'tile', '280px': 'tile',
};

/** ADR-027 §4, the same column, for the stock steps it folds in. */
const WIDTH_STOCK = {
  '6xl': 'page', '5xl': 'page',
  '4xl': 'wide', '3xl': 'wide',
  '2xl': 'read',
  xl: 'narrow', lg: 'narrow',
  md: 'form',
  sm: 'tile', xs: 'tile',
};

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
      continue;
    }
    if (['.ts', '.tsx'].includes(extname(path))) yield path;
  }
}

const counts = { type: 0, widthPx: 0, widthStock: 0 };
const unmapped = new Map();
const touched = [];

for (const path of walk(SRC)) {
  // ADR-027 Exceptions 1: a brand mark's colour is its owner's fact.
  if (path.endsWith('marks.tsx')) continue;

  const source = readFileSync(path, 'utf8');
  let out = source;

  // --- §3, the type scale -------------------------------------------------
  out = out.replace(/\btext-\[([0-9.]+(?:px|rem))\]/g, (whole, value) => {
    const step = TYPE[value];
    if (!step) {
      unmapped.set(`text-[${value}]`, (unmapped.get(`text-[${value}]`) ?? 0) + 1);
      return whole;
    }
    counts.type += 1;
    return `text-${step}`;
  });

  // --- §4, the containers -------------------------------------------------
  // A `ch`, `%`, `vw` or `min()`/`calc()` value never reaches the table: it is
  // a reading measure or a relationship, and ADR-027 keeps both.
  out = out.replace(/\bmax-w-\[([0-9.]+px)\]/g, (whole, value) => {
    const name = WIDTH_PX[value];
    if (!name) {
      unmapped.set(`max-w-[${value}]`, (unmapped.get(`max-w-[${value}]`) ?? 0) + 1);
      return whole;
    }
    counts.widthPx += 1;
    return `max-w-${name}`;
  });

  out = out.replace(/\bmax-w-(3xs|2xs|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/g, (whole, step) => {
    const name = WIDTH_STOCK[step];
    if (!name) {
      unmapped.set(whole, (unmapped.get(whole) ?? 0) + 1);
      return whole;
    }
    counts.widthStock += 1;
    return `max-w-${name}`;
  });

  if (out !== source) {
    touched.push(path);
    if (!DRY) writeFileSync(path, out);
  }
}

console.log(`  type steps      ${counts.type}`);
console.log(`  widths (px)     ${counts.widthPx}`);
console.log(`  widths (stock)  ${counts.widthStock}`);
console.log(`  files           ${touched.length}`);
if (unmapped.size) {
  console.log('\n  NOT MAPPED — absent from ADR-027 and left for a person:');
  for (const [what, n] of [...unmapped].sort((a, b) => b[1] - a[1])) console.log(`    ${what}  x${n}`);
}
console.log(DRY ? '\n  --dry: nothing written' : `\n  wrote ${touched.length} files`);
