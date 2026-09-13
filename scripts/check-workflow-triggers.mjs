#!/usr/bin/env node
/**
 * Refuse a workflow that could put branch code on the deploy runner.
 *
 * ADR-052 AC-17b. The control that matters in that ADR's security model is the
 * first row of its table: branch code never reaches the VPS. Branch protection
 * gives that control no teeth on its own, because a same repo pull request runs
 * the workflow YAML FROM ITS OWN BRANCH, and this project requires zero
 * approvals. So a pull request that adds `runs-on: injishi-vps` to a
 * `pull_request` triggered job would reach the runner before anyone merged it.
 *
 * Two things close that. A CODEOWNERS entry on `.github/workflows/**` makes a
 * workflow file the one path that cannot change without an approval, and this
 * check fails the run outright. Both are required, because CODEOWNERS governs
 * merging and this governs what happens before a merge.
 *
 * The rule enforced here is deliberately STRICTER than "no pull_request job
 * names the label", and stricter in the safe direction: a workflow file that
 * names the deploy runner at all may not be triggered by a pull request at all.
 * That needs no YAML parser, so there is no parser to disagree with GitHub's,
 * and it can only ever over reject. A deploy workflow has no honest reason to
 * carry a pull request trigger.
 *
 * It also refuses `pull_request_target` anywhere. That trigger runs with the
 * base repository's secrets against a pull request's code, which is the classic
 * way a fork or a branch reaches credentials it was never meant to see. Nothing
 * in this repository needs it.
 *
 * Usage:  node scripts/check-workflow-triggers.mjs
 * Exits 0 when every workflow is safe, 1 otherwise, naming each file.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_DIR = join(REPO_ROOT, '.github', 'workflows');

/** The self hosted runner label. A job naming this runs ON the production VPS. */
const DEPLOY_LABEL = 'injishi-vps';

/**
 * Extract the top level `on:` block.
 *
 * Top level keys sit at column zero, so the block runs from the `on:` line to
 * the next line that starts with a non space, non comment character. Handles
 * both the block form and the inline `on: [push, pull_request]` form.
 *
 * Returns the block text, or null when there is no `on:` key at all, which is
 * itself reported: a workflow with no trigger this check can find is a workflow
 * this check cannot vouch for.
 */
function triggerBlock(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => /^(on|'on'|"on"):/.test(line));
  if (start === -1) return null;

  const block = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    if (/^[^\s#]/.test(line)) break; // the next top level key
    block.push(line);
  }
  // Strip comments so a comment mentioning a trigger cannot fail the check.
  return block.map((line) => line.replace(/#.*$/, '')).join('\n');
}

if (!existsSync(WORKFLOW_DIR)) {
  console.log(`No ${WORKFLOW_DIR}, nothing to check.`);
  process.exit(0);
}

const files = readdirSync(WORKFLOW_DIR).filter((file) => /\.ya?ml$/.test(file)).sort();
if (files.length === 0) {
  console.log('No workflow files, nothing to check.');
  process.exit(0);
}

const failures = [];

for (const file of files) {
  const path = join(WORKFLOW_DIR, file);
  const source = readFileSync(path, 'utf8');
  const withoutComments = source.split(/\r?\n/).map((line) => line.replace(/#.*$/, '')).join('\n');

  const namesDeployRunner = withoutComments.includes(DEPLOY_LABEL);
  const block = triggerBlock(source);

  if (block === null) {
    failures.push(`${file}: no top level \`on:\` key found, so its triggers cannot be checked.`);
    continue;
  }

  const pullRequestTriggered = /\bpull_request\b/.test(block);
  const pullRequestTarget = /\bpull_request_target\b/.test(withoutComments);

  if (pullRequestTarget) {
    failures.push(
      `${file}: uses \`pull_request_target\`, which runs with this repository's secrets against a ` +
        `pull request's code. Nothing here needs it (ADR-052 security model).`,
    );
  }

  if (namesDeployRunner && pullRequestTriggered) {
    failures.push(
      `${file}: names the deploy runner \`${DEPLOY_LABEL}\` AND is triggered by a pull request. ` +
        `A pull request runs the workflow file from its own branch, so this would put unmerged ` +
        `branch code on the production VPS (ADR-052 AC-17, AC-17b).`,
    );
  }

  const mark = namesDeployRunner ? 'deploy ' : 'hosted ';
  console.log(`ok ${mark} ${file}`);
}

console.log('');
console.log(`${files.length} workflow file(s) checked.`);

if (failures.length > 0) {
  console.error('');
  console.error('Workflow trigger check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('');
  console.error('A workflow that names the deploy runner may only be triggered by `push`,');
  console.error('`workflow_run`, `workflow_dispatch` or `schedule`, never by a pull request.');
  process.exit(1);
}
