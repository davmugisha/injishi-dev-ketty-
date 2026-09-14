#!/usr/bin/env node
/**
 * Export the curated catalogue as JSON, for the API to seed from.
 *
 *   node apps/web/scripts/export-catalogue.mjs
 *
 * ## Why this exists
 *
 * `src/data/properties.ts` is thirty fictional demo stays (real, operating
 * Rwandan businesses until they were renamed on 2026-09-14), and
 * `src/data/filler-properties.ts` is twenty-two clearly-marked samples beside them. That is the best inventory content
 * this project has, and until now it existed ONLY as a TypeScript module in a
 * browser bundle — so the marketplace could show a property it could not sell,
 * and the database held two rows while the catalogue showed fifty-five.
 *
 * This is the bridge. It writes `server/api/scripts/data/catalogue.json`, which
 * `seed-catalogue.mjs` turns into orgs, workspaces, properties, room types,
 * rooms and published listings — with the SAME slugs the web pages are
 * addressed by, so `/property/lanternhouse-hotel-kiyovu` and
 * `GET /api/v1/properties/slug/lanternhouse-hotel-kiyovu` are the same property.
 *
 * ## Why it transpiles rather than imports
 *
 * The two data files are TypeScript, and Node cannot import them. Every import
 * they carry is `import type`, so `ts.transpileModule` erases all three and
 * leaves a standalone ES module — no bundler, no loader, no new dependency.
 * If either file ever grows a VALUE import this script fails loudly on the
 * missing specifier, which is the correct failure: the fix is to keep the
 * catalogue free of runtime dependencies, not to add a bundler here.
 *
 * ## What it deliberately does NOT export
 *
 * The editorial half — galleries, amenity lists, "things to know", the source
 * URLs. Those are presentation the marketplace renders from its own files and
 * the operational schema has no columns for. What crosses is what the API has
 * to be able to answer for: identity, address, class, capacity and rate.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const repoRoot = resolve(webRoot, '..', '..');
const dataDir = join(webRoot, 'src', 'data');
const outFile = join(repoRoot, 'server', 'api', 'scripts', 'data', 'catalogue.json');

/** Transpile one TS module to JS and import it as a data: URL. */
async function loadModule(file) {
  const source = readFileSync(join(dataDir, file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      // `isolatedModules` makes the compiler erase every `import type` without
      // needing to resolve it, which is what lets this run with no tsconfig
      // paths and no `@injishi/contracts` build.
      isolatedModules: true,
      verbatimModuleSyntax: false,
    },
    fileName: file,
  });

  if (/^\s*import\s/m.test(outputText)) {
    const leftover = outputText.match(/^\s*import\s.*$/m)?.[0].trim();
    throw new Error(
      `${file} carries a RUNTIME import after type erasure:\n  ${leftover}\n` +
        'The catalogue must stay free of runtime dependencies so it can be ' +
        'exported without a bundler. Move the value behind a type, or inline it.',
    );
  }

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

/**
 * One catalogue row, reduced to what the database can hold.
 *
 * `rooms` is the property's room COUNT from the directory. It becomes the
 * bookable unit count on the single room type each property is seeded with, and
 * it is the denominator the availability hold counts against — so a property
 * with no published room count is seeded with a deliberately small number
 * rather than an invented large one. Overselling somebody's real hotel is worse
 * than underselling it.
 */
function toRow(property, sample) {
  return {
    slug: property.slug,
    name: property.name,
    kind: property.kind,
    district: property.district,
    summary: property.summary,
    addressLines: property.place?.addressLines ?? null,
    latitude: property.place?.latitude ?? null,
    longitude: property.place?.longitude ?? null,
    maxGuests: property.maxGuests,
    bedrooms: property.bedrooms,
    roomCount: property.rooms,
    nightlyRateRwf: property.nightlyRateRwf,
    starClass: property.starClass ?? null,
    operator: property.operator?.name ?? null,
    /**
     * Whether this is one of the fictional entries.
     *
     * It travels because the seed has to mark a sample row IN the row, the way
     * `seed-demo-catalogue.mjs` already marks everything it writes. A fictional
     * business that looks real in a database is the thing nobody can untangle
     * later.
     */
    sample,
  };
}

const { PROPERTIES } = await loadModule('properties.ts');
const { FILLER_PROPERTIES } = await loadModule('filler-properties.ts');

const rows = [
  ...PROPERTIES.map((p) => toRow(p, false)),
  ...FILLER_PROPERTIES.map((p) => toRow(p, true)),
];

// A duplicate slug would fail `properties_slug_uk` at insert time, in the
// middle of a transaction, naming a constraint rather than a file. Catch it
// here where the message can name the property.
const seen = new Map();
for (const row of rows) {
  if (seen.has(row.slug)) {
    throw new Error(
      `Duplicate slug "${row.slug}": "${seen.get(row.slug)}" and "${row.name}". ` +
        'A slug is a public address and two properties cannot share one.',
    );
  }
  seen.set(row.slug, row.name);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  `${JSON.stringify(
    {
      generatedBy: 'apps/web/scripts/export-catalogue.mjs',
      generatedAt: new Date().toISOString().slice(0, 10),
      note: 'Regenerate after editing src/data/properties.ts or filler-properties.ts.',
      properties: rows,
    },
    null,
    2,
  )}\n`,
);

const real = rows.filter((r) => !r.sample).length;
console.log(
  `Wrote ${rows.length} properties (${real} real, ${rows.length - real} sample) to`,
);
console.log(`  ${outFile}`);
console.log(
  `  ${rows.filter((r) => r.nightlyRateRwf !== null).length} carry a nightly rate and will be bookable.`,
);

// `pathToFileURL` is imported for the loader above on Windows paths; referenced
// here so a lint pass does not strip it as unused.
void pathToFileURL;
