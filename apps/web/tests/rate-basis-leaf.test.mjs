/**
 * The catalogue must never import itself back at load time.
 *
 * `data/filler-properties.ts` (part of the catalogue) imports
 * `lib/booking-unit.ts`. `data/search-options.ts` reads the whole catalogue at
 * module load (`ALL_PROPERTIES.filter`, `.some`). So if anything `booking-unit`
 * imports, at value level, reaches `search-options` or `catalogue`, the
 * catalogue is asked for while it is still being built and `next build` dies
 * collecting page data with "Cannot access '…' before initialization". That
 * is how main went red on 2026-10-05: `booking-unit` took `isPerPerson` from
 * `lib/party-price.ts`, which imports `lib/search-params.ts`, which imports
 * `data/search-options.ts`.
 *
 * This walks the real value imports (type only imports are erased by the
 * compiler and cannot close a loop) with the TypeScript parser.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src");
const require = createRequire(import.meta.url);
const ts = require("typescript");

function resolveSpecifier(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = resolve(src, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // a package, outside this app's graph
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts"), resolve(base, "index.tsx")]) {
    if (existsSync(candidate) && !candidate.endsWith("\\") && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

/** The modules a file imports at VALUE level (what survives compilation). */
function valueImports(file) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const out = [];
  for (const node of sf.statements) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause?.isTypeOnly) continue;
      if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        const elements = clause.namedBindings.elements;
        if (elements.length > 0 && elements.every((e) => e.isTypeOnly)) continue;
      }
      out.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (node.isTypeOnly) continue;
      out.push(node.moduleSpecifier.text);
    }
  }
  return out.map((spec) => resolveSpecifier(file, spec)).filter(Boolean);
}

function closure(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of valueImports(file)) stack.push(next);
  }
  return seen;
}

const searchOptions = resolve(src, "data/search-options.ts");
const catalogue = resolve(src, "data/catalogue.ts");

test("the walker sees the loop it guards against (control)", () => {
  // party-price imports search-params, which imports search-options. If this
  // stops holding, the walker went blind and the next test proves nothing.
  const reach = closure(resolve(src, "lib/party-price.ts"));
  assert.ok(reach.has(searchOptions), "control: party-price should reach data/search-options.ts");
});

test("rate-basis imports nothing", () => {
  assert.deepEqual(valueImports(resolve(src, "lib/rate-basis.ts")), []);
  const text = readFileSync(resolve(src, "lib/rate-basis.ts"), "utf8");
  assert.doesNotMatch(text, /^\s*import\s/m);
});

test("booking-unit never reaches the catalogue or the search options", () => {
  const reach = closure(resolve(src, "lib/booking-unit.ts"));
  assert.ok(!reach.has(searchOptions), "lib/booking-unit.ts reaches data/search-options.ts at value level");
  assert.ok(!reach.has(catalogue), "lib/booking-unit.ts reaches data/catalogue.ts at value level");
});
