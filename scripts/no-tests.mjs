#!/usr/bin/env node
/**
 * The `test` script for a workspace member that has no test suite yet.
 *
 * ADR-052 AC-2b requires every workspace manifest to declare `typecheck`,
 * `lint` and `test`, because `pnpm -r` skips a member with no script SILENTLY.
 * A silent skip is the exact failure that made a green run mean less than it
 * looked like: four members were being skipped and nothing said so.
 *
 * So a member with no tests declares this instead of declaring nothing. The
 * difference is visible: `pnpm -r test` prints a line naming the package rather
 * than passing over it without a word, and the manifest meta check
 * (`.github/scripts/check-workspace-manifests.mjs`) sees a real script.
 *
 * This exits 0. It is a stated absence, not a passing suite. When the package
 * grows tests, replace the script in its manifest with the real runner and
 * delete nothing here, because other packages still point at it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let name = 'this package';
try {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
  if (manifest.name) name = manifest.name;
} catch {
  // Left as the fallback. Naming the package is a nicety; the point of this
  // script is that the line is printed at all.
}

console.log(`${name}: no test suite yet. Declared so \`pnpm -r test\` does not skip it in silence (ADR-052 AC-2b).`);
