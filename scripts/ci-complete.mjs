#!/usr/bin/env node
/**
 * The aggregating verdict branch protection requires.
 *
 * ADR-048 AC-1. Every other CI job is selected by changed path, and a job that
 * is skipped reports NO status at all. Requiring those jobs individually would
 * therefore block every pull request that legitimately skipped one. So one job
 * always runs, depends on all of them, and reports the verdict here.
 *
 * `skipped` is a pass. That is the entire point of path filtering: nothing the
 * job covers changed. `failure` and `cancelled` are not passes.
 *
 * Reads the `needs` context as JSON from CI_NEEDS, so the workflow stays two
 * lines and this logic is something you can run and read on its own.
 *
 * Usage:  CI_NEEDS='{"lint":{"result":"success"}}' node scripts/ci-complete.mjs
 */
const raw = process.env.CI_NEEDS;

if (!raw) {
  console.error('CI_NEEDS is not set. Without it this job would pass while checking nothing,');
  console.error('which is the one thing an aggregating check must never do.');
  process.exit(1);
}

let needs;
try {
  needs = JSON.parse(raw);
} catch (error) {
  console.error(`CI_NEEDS is not valid JSON: ${error.message}`);
  process.exit(1);
}

const entries = Object.entries(needs);
if (entries.length === 0) {
  console.error('CI_NEEDS is empty: this job depends on nothing, so it proves nothing.');
  process.exit(1);
}

const failed = [];
const width = Math.max(...entries.map(([job]) => job.length));

for (const [job, info] of entries) {
  const result = info?.result ?? 'unknown';
  console.log(`${job.padEnd(width)}  ${result}`);
  if (result !== 'success' && result !== 'skipped') failed.push(`${job} (${result})`);
}

console.log('');

if (failed.length > 0) {
  console.error(`ci-complete FAILS. ${failed.length} job(s) did not pass: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`ci-complete passes: ${entries.length} job(s), none failed.`);
console.log('A skipped job is a pass. It means nothing it covers changed.');
