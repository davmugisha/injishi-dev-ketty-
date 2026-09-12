/**
 * codemod-text-size.mjs — `<Text size={13}>` becomes `<Text size="sm">`.
 *
 * A one-shot migration, kept in the repository because the mapping it applied
 * is the record of a decision. 758 call sites moved; nobody is going to read a
 * diff that size, so this file is what a reviewer reads instead.
 *
 *   node scripts/codemod-text-size.mjs --dry    # report, change nothing
 *   node scripts/codemod-text-size.mjs
 *
 * WHAT IT CHANGES. Only a `size` attribute holding a NUMERIC LITERAL, on an
 * element named `Text`, resolved from the TypeScript AST rather than by regex.
 * That precision matters in both directions:
 *
 *   - `<Avatar size={38} />` and `<Icon size={20} />` are component dimensions
 *     and a glyph size. They are not type steps and are left alone. A regex
 *     over `size={\d+}` would have rewritten 60 of them.
 *   - `<Text size={lg ? 14 : 12}>` is not a literal. Eleven call sites compute
 *     a size from another measurement; they move to `sizePx` BY HAND, because
 *     each one needs a leading chosen for it and a script cannot choose one.
 *
 * THE MAPPING. Nearest step on `tokens.ts`'s own scale, ties rounding UP:
 *
 *   2xs 11 · xs 12 · sm 14 · md 16 · lg 18 · xl 22 · 2xl 28 · 3xl 36
 *
 * Rounding up on a tie is the same call ADR-027 made for the web scale, and for
 * the same reason: at these sizes the risk worth avoiding is text that is too
 * small to read, not text that is a pixel too large. The largest single move is
 * 13 -> 14 in either direction; every one is under 2px except the deliberate
 * hero at 64, which is left as `sizePx` because the scale tops out at 36 and
 * snapping it would shrink a screen's whole subject by 28 pixels.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['src', 'app'];
const DRY = process.argv.includes('--dry');

/** The scale, from `src/theme/tokens.ts`. Kept here as a literal on purpose: a
 * codemod that imported the scale would silently re-map if the scale moved. */
const SCALE = [
  ['2xs', 11],
  ['xs', 12],
  ['sm', 14],
  ['md', 16],
  ['lg', 18],
  ['xl', 22],
  ['2xl', 28],
  ['3xl', 36],
];

/** Above this, snapping would shrink the text by more than a step's worth. */
const TOO_LARGE = 40;

function nearestStep(px) {
  if (px > TOO_LARGE) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const [name, value] of SCALE) {
    const delta = Math.abs(px - value);
    // `<=` makes a tie pick the LARGER step, since SCALE ascends.
    if (delta <= bestDelta) {
      bestDelta = delta;
      best = name;
    }
  }
  return best;
}

function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      yield* walkFiles(path);
      continue;
    }
    if (extname(path) === '.tsx') yield path;
  }
}

/** The JSX element name an attribute belongs to, or null. */
function ownerName(attribute) {
  const attrs = attribute.parent;
  const element = attrs?.parent;
  const tag = element?.tagName;
  if (!tag) return null;
  if (ts.isIdentifier(tag)) return tag.text;
  if (ts.isPropertyAccessExpression(tag)) return tag.name.text;
  return null;
}

const edits = [];
const skipped = [];
const distribution = new Map();

for (const root of ROOTS) {
  for (const path of walkFiles(join(ROOT, root))) {
    const source = readFileSync(path, 'utf8');
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const replacements = [];

    const visit = (node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(file) === 'size' && ownerName(node) === 'Text') {
        const init = node.initializer;
        if (init && ts.isJsxExpression(init) && init.expression && ts.isNumericLiteral(init.expression)) {
          const px = Number(init.expression.text);
          const step = nearestStep(px);
          if (step === null) {
            skipped.push({ path, px });
          } else {
            replacements.push({ start: init.getStart(file), end: init.getEnd(), text: `"${step}"` });
            distribution.set(`${px} -> ${step}`, (distribution.get(`${px} -> ${step}`) ?? 0) + 1);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);

    if (!replacements.length) continue;
    let out = source;
    for (const r of replacements.sort((a, b) => b.start - a.start)) {
      out = out.slice(0, r.start) + r.text + out.slice(r.end);
    }
    edits.push({ path, count: replacements.length, out });
  }
}

const rows = [...distribution.entries()].sort(
  (a, b) => Number(a[0].split(' ')[0]) - Number(b[0].split(' ')[0]),
);
for (const [move, n] of rows) console.log(`  ${move.padEnd(14)} ${n}`);
console.log(`\n  ${edits.reduce((a, e) => a + e.count, 0)} call sites in ${edits.length} files`);
for (const s of skipped) {
  console.log(`  SKIPPED  ${relative(ROOT, s.path)}  size={${s.px}} — above the scale, move to sizePx by hand`);
}

if (DRY) {
  console.log('\n  --dry: nothing written');
} else {
  for (const edit of edits) writeFileSync(edit.path, edit.out);
  console.log(`\n  wrote ${edits.length} files`);
}
