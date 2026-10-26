#!/usr/bin/env node
/**
 * Decide which CI jobs a change needs to run.
 *
 * ADR-052's job matrix selects each job by changed path, and says a build job
 * runs when "that app, or any package it consumes" changes. That second half is
 * the reason this is a script rather than a list of globs in the workflow: the
 * set of packages an app consumes is a fact the manifests already hold, and a
 * hand written copy of it in YAML goes stale the first time somebody adds a
 * dependency. So the dependency graph is READ from the `workspace:*` entries,
 * transitively, and a stale filter is not a thing that can happen.
 *
 * It errs toward running MORE than needed. A path it does not recognise sets
 * every flag, because a skipped job reports success and a skipped job that
 * should have run is the failure mode that matters here.
 *
 * Usage:
 *   node scripts/ci-changes.mjs <base-ref> [head-ref]
 *
 * Writes `name=value` lines to $GITHUB_OUTPUT when set, and always prints a
 * readable summary to the log so a skipped job can be explained afterwards.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { workspaceMembers, REPO_ROOT } from './workspace-members.mjs';

const [baseRef, headRef = 'HEAD'] = process.argv.slice(2);

/**
 * Paths that change what EVERY job would conclude, so any hit runs everything.
 * The lockfile and the workspace globs change resolution; the Node and pnpm
 * pins change the toolchain; the lint plugin changes every lint result; the
 * workflows and these scripts change the checks themselves.
 */
const EVERYTHING = [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package.json',
  'mise.toml',
  'tools/',
  '.github/',
  'scripts/',
];

/** Extensions that mean "source", for the unit test job. */
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
/** Extensions and names that mean "something TypeScript would read". */
const TYPE_EXT = /\.(ts|tsx)$/;
/** Files that change what a lint run concludes even with no source change. */
const LINT_CONFIG = /(^|\/)(eslint\.config\.mjs|tsconfig[^/]*\.json|package\.json)$/;

function changedFiles() {
  if (!baseRef) {
    console.log('No base ref given, so every job runs.');
    return null; // null means "unknown, run everything"
  }
  const result = spawnSync('git', ['diff', '--name-only', `${baseRef}...${headRef}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.log(`git diff ${baseRef}...${headRef} failed, so every job runs.`);
    console.log((result.stderr ?? '').trim());
    return null;
  }
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Build the transitive `workspace:*` dependency closure for each member. */
function dependencyClosure(members) {
  const byName = new Map(members.map((member) => [member.name, member]));
  const directDeps = new Map();

  for (const member of members) {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, member.dir, 'package.json'), 'utf8'));
    const deps = new Set();
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (typeof range === 'string' && range.startsWith('workspace:') && byName.has(name)) deps.add(name);
      }
    }
    directDeps.set(member.name, deps);
  }

  const closure = new Map();
  const resolve = (name, seen = new Set()) => {
    if (closure.has(name)) return closure.get(name);
    if (seen.has(name)) return new Set(); // a cycle resolves to nothing extra
    seen.add(name);
    const all = new Set();
    for (const dep of directDeps.get(name) ?? []) {
      all.add(dep);
      for (const nested of resolve(dep, seen)) all.add(nested);
    }
    closure.set(name, all);
    return all;
  };

  for (const member of members) resolve(member.name);
  return closure;
}

const members = workspaceMembers();
const closure = dependencyClosure(members);
const files = changedFiles();
const runEverything = files === null;

/** Did anything under this member's directory change? */
const touched = new Map(
  members.map((member) => [
    member.name,
    runEverything || files.some((file) => file === member.dir || file.startsWith(`${member.dir}/`)),
  ]),
);

/** Did this member, or anything it consumes, change? */
function affected(name) {
  if (runEverything) return true;
  if (touched.get(name)) return true;
  for (const dep of closure.get(name) ?? []) if (touched.get(dep)) return true;
  return false;
}

const hitsEverything = runEverything || files.some((file) => EVERYTHING.some((prefix) => file === prefix || file.startsWith(prefix)));

const outputs = {
  // The three build jobs, each true when its app or any package it consumes changed.
  build_web: hitsEverything || affected('@injishi/web'),
  build_app: hitsEverything || affected('@injishi/app'),
  build_api: hitsEverything || affected('@injishi/api'),

  // Mobile: its own tree, plus the two packages it shares with the web surfaces.
  mobile: hitsEverything || affected('@injishi/mobile'),

  // The token drift gate, and the API cycle check.
  tokens: hitsEverything || touched.get('@injishi/design-tokens') === true,
  cycles: hitsEverything || touched.get('@injishi/api') === true,

  // The three whole-workspace jobs.
  typecheck: hitsEverything || (files ?? []).some((f) => TYPE_EXT.test(f) || LINT_CONFIG.test(f)),
  lint: hitsEverything || (files ?? []).some((f) => TYPE_EXT.test(f) || LINT_CONFIG.test(f)),
  test_unit: hitsEverything || (files ?? []).some((f) => SOURCE_EXT.test(f)),
};

// `integration.yml` deliberately has no output here. It selects itself with a
// native `paths:` filter on its own trigger, because it is one workflow with
// one question to ask, and a filter it carries itself is a filter you can read
// without opening a second file.

console.log(runEverything ? 'Change set: UNKNOWN, running everything.' : `Change set: ${files.length} file(s).`);
if (files && files.length > 0 && files.length <= 40) for (const file of files) console.log(`  ${file}`);
console.log('');
for (const [job, run] of Object.entries(outputs)) console.log(`${run ? 'RUN ' : 'skip'} ${job}`);

if (process.env.GITHUB_OUTPUT) {
  const lines = Object.entries(outputs).map(([job, run]) => `${job}=${run}`).join('\n');
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines}\n`);
}
