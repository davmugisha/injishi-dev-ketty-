/**
 * check-dist.mjs — the local replacement for the deleted `pnpm vendor:check`.
 *
 * `vendor/` used to be a build-output mirror of a repo that no longer exists,
 * and `vendor:check` failed the build when the mirror drifted from its source.
 * Since [ADR-034] this directory IS the source, so the drift worth catching is
 * the opposite one: a hand edit to `dist/` that `src/` cannot reproduce.
 *
 * The check builds `src/` into a scratch directory and compares every emitted
 * byte against the committed `dist/`. It fails on any difference, in either
 * direction — a `dist/` edited by hand, and a `src/` edited without rebuilding,
 * are the same defect from here and both produce a package whose types and
 * values disagree with its source.
 *
 *   node scripts/check-dist.mjs
 *
 * Run as the first half of `pnpm -F @injishi/design-tokens check`.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(PKG, 'dist');

const scratch = mkdtempSync(join(tmpdir(), 'injishi-tokens-'));

try {
  const tsc = require.resolve('typescript/bin/tsc');
  const built = spawnSync(process.execPath, [tsc, '-p', join(PKG, 'tsconfig.json'), '--outDir', scratch], {
    cwd: PKG,
    encoding: 'utf8',
  });
  if (built.status !== 0) {
    process.stderr.write(built.stdout ?? '');
    process.stderr.write(built.stderr ?? '');
    console.error('FAIL  src/ does not compile. Nothing to compare.');
    process.exit(1);
  }

  const fresh = new Set(readdirSync(scratch));
  const committed = new Set(existsSync(DIST) ? readdirSync(DIST) : []);
  const failures = [];

  for (const name of committed) if (!fresh.has(name)) failures.push(`${name}: in dist/, not emitted by a build`);
  for (const name of fresh) if (!committed.has(name)) failures.push(`${name}: emitted by a build, missing from dist/`);

  for (const name of [...fresh].filter((n) => committed.has(n)).sort()) {
    // A declaration map records the absolute path it was built at, so compare
    // its `mappings` rather than its bytes: the positions are the fact, the
    // build directory is not.
    if (name.endsWith('.map')) {
      const a = JSON.parse(readFileSync(join(DIST, name), 'utf8'));
      const b = JSON.parse(readFileSync(join(scratch, name), 'utf8'));
      if (a.mappings !== b.mappings) failures.push(`${name}: source positions differ`);
      continue;
    }
    const a = readFileSync(join(DIST, name));
    const b = readFileSync(join(scratch, name));
    if (!a.equals(b)) failures.push(`${name}: ${a.length} bytes committed, ${b.length} bytes built`);
  }

  if (failures.length) {
    console.error('');
    console.error('FAIL  dist/ is not what src/ builds.');
    for (const f of failures) console.error(`      ${f}`);
    console.error('');
    console.error('      dist/ is a build output, not a place to edit. Change src/*.ts and run:');
    console.error('');
    console.error('        pnpm -F @injishi/design-tokens build');
    console.error('');
    process.exit(1);
  }

  console.log(`ok    dist/ matches a fresh build of src/ (${committed.size} files)`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
