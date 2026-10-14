#!/usr/bin/env node
/**
 * Snapshot the new interface's fixtures (`packages/data`) as JSON for the interface demo seed.
 *
 *   node scripts/export-interface-fixtures.mjs           rewrite seed-interface/fixtures.generated.json
 *   node scripts/export-interface-fixtures.mjs --check   fail when the snapshot disagrees with packages/data
 *
 * Why a snapshot rather than an import: the API image installs production dependencies only and runs
 * plain Node, and Node refuses to strip TypeScript under node_modules. `seed-interface.mjs` therefore
 * reads this JSON, which ships inside `server/api/scripts`. `packages/data` stays the one source; this
 * file is its generated output, like the design tokens' stylesheets, and `--check` keeps the two equal.
 *
 * Needs Node 22.18 or later (type stripping on by default); mise.toml pins 22.23.2.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataSrc = path.resolve(here, '..', '..', '..', 'packages', 'data', 'src');
const target = path.join(here, 'seed-interface', 'fixtures.generated.json');

const { allCollections } = await import(pathToFileURL(path.join(dataSrc, 'fixtures', 'index.ts')).href);
const { personas } = await import(pathToFileURL(path.join(dataSrc, 'personas.ts')).href);

const people = Object.values(personas).map((p) => ({
  id: p.id,
  name: p.name,
  email: p.email,
  phone: p.phone,
  role: p.role,
  org: p.org,
}));
const collections = allCollections();
const names = Object.keys(collections).sort();

// One collection per line: a fixture edit shows up as a one-line diff.
const text = [
  '{',
  `"generatedBy": "scripts/export-interface-fixtures.mjs from packages/data (do not edit)",`,
  `"personas": ${JSON.stringify(people)},`,
  '"collections": {',
  names.map((n) => `${JSON.stringify(n)}: ${JSON.stringify(collections[n])}`).join(',\n'),
  '}',
  '}',
  '',
].join('\n');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  } catch {}
  if (current !== text) {
    console.error(
      'seed-interface/fixtures.generated.json is stale: run node server/api/scripts/export-interface-fixtures.mjs',
    );
    process.exit(1);
  }
  console.log(`FIXTURE SNAPSHOT CURRENT (${names.length} collections, ${people.length} personas)`);
} else {
  writeFileSync(target, text);
  console.log(`Wrote ${path.relative(process.cwd(), target)}: ${names.length} collections, ${people.length} personas.`);
}
