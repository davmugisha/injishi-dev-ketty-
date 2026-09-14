#!/usr/bin/env node
/**
 * A Next app's tsconfig may include generated types from `.next/` only.
 *
 * `next build` and `next dev` append their distDir's `types/**` to `include`.
 * Every scratch build run with `NEXT_DIST_DIR` (AGENTS.md § Commands) therefore
 * left a line behind, and the lines were committed: nine in web, six in app,
 * three in admin (platform audit 2026-09-14, H4). A listed folder that goes
 * stale — routes deleted since it was built — breaks `tsc --noEmit` for
 * everybody who still has it on disk, which is how `apps/admin` failed its
 * typecheck with nothing wrong in its source.
 *
 * `**` never matches a dot-folder, so removing the line is enough: nothing else
 * reaches a scratch build's types. Put the tsconfig back after a scratch build;
 * this check is what fails when nobody did.
 *
 *   node scripts/check-tsconfig-includes.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsDir = path.join(root, 'apps');
const ALLOWED = '.next/types/**/*.ts';

const failures = [];
let checked = 0;
for (const app of readdirSync(appsDir)) {
  const dir = path.join(appsDir, app);
  const hasNext = ['ts', 'mjs', 'js'].some((ext) => existsSync(path.join(dir, `next.config.${ext}`)));
  if (!hasNext) continue;
  const tsconfig = JSON.parse(readFileSync(path.join(dir, 'tsconfig.json'), 'utf8'));
  checked++;
  for (const entry of tsconfig.include ?? []) {
    if (entry.startsWith('.next') && entry !== ALLOWED) {
      failures.push(`apps/${app}/tsconfig.json includes "${entry}"`);
    }
  }
}

if (checked === 0) {
  console.error('No Next app found under apps/: the check reached nothing.');
  process.exit(1);
}
if (failures.length > 0) {
  console.error('Scratch build types are listed in a tsconfig (only ".next/types/**/*.ts" may be):');
  for (const f of failures) console.error(`  ${f}`);
  console.error('Remove those lines; a NEXT_DIST_DIR build adds one and it must not be committed.');
  process.exit(1);
}
console.log(`tsconfig includes ok: ${checked} Next apps list only ${ALLOWED}`);
