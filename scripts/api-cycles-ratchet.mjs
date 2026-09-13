#!/usr/bin/env node
/**
 * The API import cycle ratchet.
 *
 * ADR-052 AC-5 says a NEW import cycle in the API fails the run. The job used
 * to run bare `madge --circular`, which exits 1 on ANY cycle, and the API
 * already had cycles when the job was written (the drizzle schema files import
 * each other's tables, `booking.service` and `payment-attempt.service` import
 * each other). So the job could never pass, and a job that can never pass says
 * nothing about the change in front of it.
 *
 * This compares the cycles madge finds against `.github/api-cycles-baseline.json`:
 *
 *   - a cycle not in the baseline fails the run and is named
 *   - a baselined cycle that has gone passes, and is reported so the baseline
 *     can shrink in the commit that removed it
 *
 * A cycle is compared by its members in rotation order, not by where madge
 * happened to start printing it, so `a > b > c` and `b > c > a` are one cycle.
 *
 * Usage:
 *   node scripts/api-cycles-ratchet.mjs                    check against the baseline
 *   node scripts/api-cycles-ratchet.mjs --update           rewrite the baseline to current
 *   node scripts/api-cycles-ratchet.mjs --baseline <file>  check against another file
 *
 * `--update` is for the commit that REMOVES a cycle. Never run it to make a
 * failing run pass: that is the one move this check exists to prevent.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = join(REPO_ROOT, 'server', 'api');
const DEFAULT_BASELINE = join(REPO_ROOT, '.github', 'api-cycles-baseline.json');

const args = process.argv.slice(2);
const update = args.includes('--update');
const baselineAt = args.includes('--baseline') ? resolve(args[args.indexOf('--baseline') + 1] ?? '') : DEFAULT_BASELINE;

/** madge's CLI, run through node directly so no platform shim or shell is involved. */
function madgeCycles() {
  const require = createRequire(join(API_DIR, 'package.json'));
  const pkgPath = require.resolve('madge/package.json');
  const cli = join(dirname(pkgPath), JSON.parse(readFileSync(pkgPath, 'utf8')).bin.madge);
  const result = spawnSync(process.execPath, [cli, '--circular', '--extensions', 'ts', '--json', 'src'], {
    cwd: API_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  // madge exits 1 when it finds cycles, which is expected here. Anything that
  // is not a JSON array is a crash, and a crash must never read as "no cycles".
  const start = result.stdout.indexOf('[');
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.slice(start));
  } catch {
    console.error('madge did not return a cycle list. Its output was:');
    console.error((result.stdout + result.stderr).slice(0, 2000));
    process.exit(2);
  }
  if (start < 0 || !Array.isArray(parsed)) {
    console.error('madge did not return a cycle list.');
    process.exit(2);
  }
  return parsed;
}

/** One stable key per cycle: normalise separators, rotate to start at the smallest member. */
function keyOf(cycle) {
  const members = cycle.map((file) => file.replaceAll('\\', '/'));
  let best = 0;
  for (let i = 1; i < members.length; i++) if (members[i] < members[best]) best = i;
  return [...members.slice(best), ...members.slice(0, best)].join(' > ');
}

const current = [...new Set(madgeCycles().map(keyOf))].sort();

if (update) {
  const body = {
    '//': 'Import cycles the API had when the ADR-052 AC-5 ratchet was adopted. A cycle NOT listed here fails CI.',
    '//how': 'Regenerate with: node scripts/api-cycles-ratchet.mjs --update',
    '//when': 'Update this in the commit that REMOVES a cycle, never to make a failing run pass.',
    cycles: current,
  };
  writeFileSync(baselineAt, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`baseline written: ${current.length} cycle(s) in ${baselineAt}`);
  process.exit(0);
}

if (!existsSync(baselineAt)) {
  console.error(`No baseline at ${baselineAt}. Create it with: node scripts/api-cycles-ratchet.mjs --update`);
  process.exit(1);
}
const baseline = new Set(JSON.parse(readFileSync(baselineAt, 'utf8')).cycles ?? []);

const added = current.filter((key) => !baseline.has(key));
const removed = [...baseline].filter((key) => !current.includes(key));

for (const key of removed) console.log(`gone (shrink the baseline): ${key}`);

if (added.length > 0) {
  console.error(`${added.length} new import cycle(s) in server/api:`);
  for (const key of added) console.error(`  ${key}`);
  console.error('Break the cycle. Do not add it to the baseline.');
  process.exit(1);
}

console.log(`api cycles ratchet passed: ${current.length} known, 0 new, ${removed.length} gone`);
