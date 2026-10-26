#!/usr/bin/env node
/**
 * The ESLint warning ratchet.
 *
 * ADR-052 AC-3. Errors fail the run; warnings are counted per workspace member
 * and compared against `.github/lint-baseline.json`. A count that RISES fails.
 * A count that falls passes and says so.
 *
 * Why a ratchet and not "no warnings allowed": in this project a `warn` is a
 * migration backlog being paid down, and an app's config flips the rule to
 * `error` once its count reaches zero (the idiom ADR-037 set). Failing on
 * warnings would block every pull request on day one. Ignoring them lets the
 * backlog grow with nothing watching. The ratchet is the only policy that
 * matches what the configs already mean.
 *
 * The count comes from `eslint --format json`, never from parsing human
 * readable output, because the human format is not a stable interface and a
 * counter that silently reads zero is worse than no counter at all.
 *
 * Each member is linted through ITS OWN `lint` script, so this file never
 * restates a package's globs or config. Extra arguments are appended by pnpm,
 * which is what puts `--format json` on the end of that package's own eslint
 * invocation.
 *
 * Not every member is on ESLint. The interface `2d32525a` brought in (apps/app,
 * apps/mobile, packages/ui, data and db) came linted by Biome, from the root
 * `biome.json`, and its `lint` scripts run `biome lint .`. A member whose script
 * starts with `biome` is asked for Biome's JSON report instead and counted from
 * its summary, so the same three rules hold for both: an error fails, a missing
 * row fails, a count above its row fails.
 *
 * Usage:
 *   node scripts/lint-ratchet.mjs            check against the baseline
 *   node scripts/lint-ratchet.mjs --update   rewrite the baseline to current
 *
 * `--update` is for the commit that FIXES warnings. Never run it to make a
 * failing run pass: that is the one move this check exists to prevent.
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { workspaceMembers, REPO_ROOT } from './workspace-members.mjs';

const BASELINE_FILE = join(REPO_ROOT, '.github', 'lint-baseline.json');
const update = process.argv.includes('--update');

/** Read the baseline, ignoring `//` keys, which are there to explain the file. */
function readBaseline() {
  if (!existsSync(BASELINE_FILE)) {
    console.error(`No baseline at ${BASELINE_FILE}.`);
    console.error('Create it with:  node scripts/lint-ratchet.mjs --update');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('//')));
}

/** A member whose `lint` script runs Biome rather than ESLint. */
const runsBiome = (member) => /^\s*biome\s/.test(member.scripts.lint);

/**
 * Lint one member and return its error and warning counts.
 *
 * Returns null when the member produced no report at all, which is a failure
 * and not a zero: a lint script that dies before eslint runs (mobile's palette
 * check is chained ahead of eslint, for example) must never be read as clean.
 */
function countFor(member, workDir) {
  const reportFile = join(workDir, `${member.name.replace(/[^a-z0-9]+/gi, '-')}.json`);
  const biome = runsBiome(member);
  const reportArgs = biome
    ? ['--reporter=json', `--reporter-file=${reportFile}`]
    : ['--format', 'json', '--output-file', reportFile];

  // On Windows `pnpm` is a .cmd shim, which Node will not spawn without a
  // shell. A shell then re-splits the argument array on whitespace, so the
  // report path has to be quoted or a temp directory under a user name with a
  // space in it silently becomes two arguments.
  const useShell = process.platform === 'win32';
  const quote = (arg) => (useShell && /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);

  const result = spawnSync(
    'pnpm',
    // No `--` separator: pnpm 10 forwards trailing arguments to the script as
    // they are, and passing `--` makes eslint read the flags after it as FILE
    // PATTERNS ("No files matching the pattern --format were found").
    ['--filter', member.name, '--silent', 'run', 'lint', ...reportArgs].map(quote),
    { cwd: REPO_ROOT, encoding: 'utf8', shell: useShell },
  );

  if (!existsSync(reportFile)) {
    return {
      failed: true,
      reason:
        result.error?.message ??
        `lint produced no JSON report (exit ${result.status}). ` +
          `stderr: ${(result.stderr ?? '').trim().split('\n').slice(-3).join(' | ') || '(none)'}`,
    };
  }

  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  return biome ? countBiomeReport(report) : countEslintReport(report);
}

/**
 * Biome's report carries one summary for the whole run. Its counts are totals
 * even when `--max-diagnostics` stops printing, and only the printed
 * diagnostics are listed. Biome calls this reporter experimental and free to
 * change in a patch release, which is safe only because the root manifest pins
 * Biome exactly: a summary without both counts is a failure, never a zero.
 */
function countBiomeReport(report) {
  const { errors, warnings } = report.summary ?? {};
  if (!Number.isInteger(errors) || !Number.isInteger(warnings)) {
    return { failed: true, reason: 'Biome report has no error and warning counts in its summary.' };
  }
  const errorMessages = (report.diagnostics ?? [])
    .filter((d) => d.severity === 'error' || d.severity === 'fatal')
    .slice(0, 10)
    .map((d) => `${d.location?.path ?? '?'}:${d.location?.start?.line ?? 0}  ${d.category ?? 'error'}  ${d.message}`);
  return { failed: false, errorCount: errors, warningCount: warnings, errorMessages };
}

function countEslintReport(report) {
  let errorCount = 0;
  let warningCount = 0;
  const errorMessages = [];
  for (const file of report) {
    errorCount += file.errorCount ?? 0;
    warningCount += file.warningCount ?? 0;
    for (const message of file.messages ?? []) {
      if (message.severity === 2 && errorMessages.length < 10) {
        errorMessages.push(`${file.filePath}:${message.line ?? 0}  ${message.ruleId ?? 'error'}  ${message.message}`);
      }
    }
  }
  return { failed: false, errorCount, warningCount, errorMessages };
}

const members = workspaceMembers().filter((member) => typeof member.scripts.lint === 'string');
const baseline = update ? {} : readBaseline();
const workDir = mkdtempSync(join(tmpdir(), 'injishi-lint-ratchet-'));

const results = [];
try {
  for (const member of members) {
    process.stdout.write(`linting ${member.name} ... `);
    const count = countFor(member, workDir);
    if (count.failed) {
      console.log('FAILED TO REPORT');
      results.push({ member, broken: count.reason });
      continue;
    }
    console.log(`${count.errorCount} error(s), ${count.warningCount} warning(s)`);
    results.push({ member, ...count });
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log('');

if (update) {
  const broken = results.filter((r) => r.broken);
  if (broken.length > 0) {
    console.error('Refusing to write a baseline while a member cannot be linted:');
    for (const r of broken) console.error(`  ${r.member.name}: ${r.broken}`);
    process.exit(1);
  }
  const counts = Object.fromEntries(results.map((r) => [r.member.name, r.warningCount]));
  const file = {
    '//': 'ESLint or Biome warning counts per workspace member, the ADR-052 AC-3 ratchet baseline.',
    '//how': 'A count that RISES above its entry fails CI. Regenerate with: node scripts/lint-ratchet.mjs --update',
    '//when': 'Update this in the commit that FIXES warnings, never to make a failing run pass.',
    '//zero': 'When a count reaches 0, flip that rule to `error` in the app config and drop the row.',
    '//taken': `Counted from the working tree on ${new Date().toISOString().slice(0, 10)}. A count taken over uncommitted work is a count of something that was never committed, so regenerate on the commit that actually lands.`,
    ...counts,
  };
  writeFileSync(BASELINE_FILE, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${BASELINE_FILE}`);
  for (const [name, value] of Object.entries(counts)) console.log(`  ${name}: ${value}`);
  process.exit(0);
}

const failures = [];

for (const result of results) {
  const { member } = result;

  if (result.broken) {
    failures.push(`${member.name}: could not be linted, so its warnings could not be counted. ${result.broken}`);
    continue;
  }

  if (result.errorCount > 0) {
    failures.push(
      `${member.name}: ${result.errorCount} lint error(s). Errors always fail, ratchet or not.\n` +
        result.errorMessages.map((m) => `      ${m}`).join('\n'),
    );
  }

  const allowed = baseline[member.name];
  if (allowed === undefined) {
    failures.push(
      `${member.name}: no entry in .github/lint-baseline.json. A new member must be added to the ` +
        `baseline in the same change, or its warnings are counted against nothing. ` +
        `Run: node scripts/lint-ratchet.mjs --update`,
    );
    continue;
  }

  if (result.warningCount > allowed) {
    failures.push(
      `${member.name}: ${result.warningCount} warnings, baseline allows ${allowed}. ` +
        `The backlog grew by ${result.warningCount - allowed}. Fix the new warning rather than raising the baseline.`,
    );
  } else if (result.warningCount < allowed) {
    console.log(
      `${member.name}: ${result.warningCount} warnings, down from ${allowed}. ` +
        `Lower the baseline in this commit: node scripts/lint-ratchet.mjs --update` +
        (result.warningCount === 0
          ? `  (it reached zero, so flip that rule to \`error\` in the app config and drop the row)`
          : ''),
    );
  }
}

const stale = Object.keys(baseline).filter((name) => !members.some((member) => member.name === name));
for (const name of stale) {
  console.log(`${name}: in the baseline but no longer a lintable workspace member. Drop the row.`);
}

if (failures.length > 0) {
  console.error('');
  console.error('Lint ratchet failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('');
console.log('Lint ratchet passed: no member is above its baseline and no member has errors.');
