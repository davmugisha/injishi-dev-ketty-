#!/usr/bin/env node
/**
 * The dead code ratchet: ADR-078 AC-16 to AC-19 (injishi.context,
 * dox/adrs/078-delivery-guardrails).
 *
 * Code that stopped being reached (a screen replaced, a module nothing imports
 * any more, a package nobody uses) stays in the tree with nothing to say so.
 * knip finds it; this counts it per workspace member and compares the counts
 * with `.github/knip-baseline.json`. A count that RISES fails. A count that falls
 * passes and says so. The same idiom as scripts/lint-ratchet.mjs (ADR-052 AC-3):
 * the backlog is paid down, never allowed to grow.
 *
 * Three things are counted, from knip's JSON report:
 *   files         a file nothing reaches
 *   exports       an export nothing imports (knip's `exports` and `nsExports`;
 *                 never types, enum members or class members)
 *   dependencies  a package nothing uses (`dependencies` plus `devDependencies`)
 * A finding outside every member (scripts/, tools/, the root manifest) lands in
 * the `(root)` row. A report whose shape this does not recognise fails the run:
 * a counter that silently reads zero is worse than none.
 *
 * The baseline read is the one in this checkout, which on a pull request build
 * is the pull request merged with main. A pull request that raises a row must
 * say why in its description (`Baseline:`), which the rules job enforces
 * (ADR-078 AC-12g), so editing the baseline is never a quiet way to pass.
 *
 * The knip config is `knip.jsonc` and may not use `ignore`, `ignoreFiles` or
 * `ignoreIssues`, anywhere (AC-18): each hides findings by path, which is the
 * loophole this ratchet exists to close. A false positive is settled with an
 * entry, a project, a plugin setting or an `ignoreDependencies` style option,
 * each with its reason in a comment beside it.
 *
 * Usage:
 *   node scripts/dead-code-ratchet.mjs                       check against the baseline
 *   node scripts/dead-code-ratchet.mjs --update              rewrite the baseline to the counts
 *   node scripts/dead-code-ratchet.mjs --counts-out <file>   also write the counts, in the
 *                                                            baseline's shape (CI's artifact)
 *   node scripts/dead-code-ratchet.mjs --report <file>       count a saved knip JSON report
 *                                                            instead of running knip
 *
 * `--update` is for the commit that REMOVES dead code. The first baseline is
 * taken from a main build's knip-counts.json, never from a laptop: a laptop
 * without the HeroUI Pro token, or on Windows, counts differently (AC-19).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { REPO_ROOT, workspaceMembers } from './workspace-members.mjs';

const BASELINE = join(REPO_ROOT, '.github', 'knip-baseline.json');
const CONFIG = join(REPO_ROOT, 'knip.jsonc');
const ROOT_ROW = '(root)';
const KINDS = ['files', 'exports', 'dependencies'];
const FORBIDDEN_KEYS = ['ignore', 'ignoreFiles', 'ignoreIssues'];

const argv = process.argv.slice(2);
const update = argv.includes('--update');
const countsOut = valueOf('--counts-out');
const savedReport = valueOf('--report');

function valueOf(flag) {
  const at = argv.indexOf(flag);
  if (at < 0) return null;
  const value = argv[at + 1];
  if (!value || value.startsWith('--')) fail(`${flag} needs a file path.`);
  return value;
}

function fail(message) {
  console.error(`dead-code ratchet FAILS. ${message}`);
  process.exit(1);
}

// ── the config may not hide findings by path (AC-18) ────────────────────────

/** JSON with comments and trailing commas, as knip itself reads knip.jsonc. */
function parseJsonc(text, file) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inString) {
      out += char;
      if (char === '\\') {
        out += next ?? '';
        i += 1;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
    } else if (char === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 1;
    } else {
      out += char;
    }
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  } catch (error) {
    fail(`${file} is not valid JSON with comments: ${error.message}`);
  }
}

function checkConfig() {
  for (const other of ['knip.json', '.knip.json', '.knip.jsonc', 'knip.ts', 'knip.js', 'knip.config.ts', 'knip.config.js']) {
    if (existsSync(join(REPO_ROOT, other))) fail(`${other} exists. The one knip config is knip.jsonc (ADR-078 AC-16).`);
  }
  if (!existsSync(CONFIG)) fail('knip.jsonc is missing (ADR-078 AC-16).');
  const config = parseJsonc(readFileSync(CONFIG, 'utf8'), 'knip.jsonc');
  const found = [];
  for (const key of FORBIDDEN_KEYS) if (key in config) found.push(key);
  for (const [name, workspace] of Object.entries(config.workspaces ?? {})) {
    for (const key of FORBIDDEN_KEYS) if (workspace && key in workspace) found.push(`workspaces["${name}"].${key}`);
  }
  if (found.length > 0) {
    fail(
      `knip.jsonc uses ${found.join(', ')}. Each hides findings by path, the loophole this ratchet closes ` +
        '(ADR-078 AC-18). Settle a false positive with an entry, a project, a plugin setting or an ' +
        'ignoreDependencies style option, with its reason in a comment.',
    );
  }
}

// ── the report ──────────────────────────────────────────────────────────────

function runKnip() {
  // knip is a root devDependency, so it sits in the root node_modules. Its
  // package.json is not in its `exports`, so it is read by path, not resolved.
  const manifestPath = join(REPO_ROOT, 'node_modules', 'knip', 'package.json');
  if (!existsSync(manifestPath)) fail('knip is not installed. Run pnpm install at the repository root.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.knip;
  if (!entry) fail('knip\'s package.json names no `knip` binary.');
  const bin = join(dirname(manifestPath), entry);
  // The report goes to a file, so the configuration hints knip prints on stdout
  // can never be read as part of it.
  const out = join(mkdtempSync(join(tmpdir(), 'knip-')), 'report.json');
  const run = spawnSync(
    process.execPath,
    [bin, '--reporter', 'json', '--output-file', `json=${out}`, '--no-exit-code', '--no-progress'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  if (run.error) fail(`knip did not run: ${run.error.message}`);
  if (run.stdout.trim()) console.log(run.stdout.trim());
  if (run.status !== 0) {
    console.error(run.stderr);
    fail(`knip exited ${run.status}. With --no-exit-code that means it crashed, not that it found something.`);
  }
  if (!existsSync(out)) fail('knip wrote no report file.');
  const text = readFileSync(out, 'utf8');
  rmSync(dirname(out), { recursive: true, force: true });
  return text;
}

function parseReport(text) {
  const start = text.indexOf('{');
  if (start < 0) fail('knip printed no JSON report.');
  let report;
  try {
    report = JSON.parse(text.slice(start));
  } catch (error) {
    fail(`knip's report is not JSON: ${error.message}`);
  }
  if (!report || !Array.isArray(report.issues)) {
    fail('knip\'s report has no `issues` list. Its shape changed; teach this script the new one rather than reading zero.');
  }
  return report;
}

const normalise = (path) => path.replace(/\\/g, '/').replace(/^\.\//, '');

/** `files` is a top level list in some knip versions and a per issue list in others. */
function count(report) {
  const members = workspaceMembers();
  const rowOf = (path) => {
    const file = normalise(path);
    const member = members.find((m) => file === m.dir || file.startsWith(`${m.dir}/`));
    return member ? member.name : ROOT_ROW;
  };
  const counts = {};
  for (const member of members) counts[member.name] = { files: 0, exports: 0, dependencies: 0 };
  counts[ROOT_ROW] = { files: 0, exports: 0, dependencies: 0 };

  const list = (value, field, file) => {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    fail(`knip's report has ${field} for ${file} as ${typeof value}, not a list. Its shape changed.`);
  };

  if (report.files !== undefined) {
    if (!Array.isArray(report.files)) fail('knip\'s report has a top level `files` that is not a list.');
    for (const file of report.files) counts[rowOf(typeof file === 'string' ? file : file.file ?? file.name)].files += 1;
  }
  for (const issue of report.issues) {
    if (!issue || typeof issue.file !== 'string') fail('knip\'s report has an issue with no `file`. Its shape changed.');
    const row = counts[rowOf(issue.file)];
    if (report.files === undefined) row.files += list(issue.files, 'files', issue.file).length;
    row.exports += list(issue.exports, 'exports', issue.file).length + list(issue.nsExports, 'nsExports', issue.file).length;
    row.dependencies += list(issue.dependencies, 'dependencies', issue.file).length + list(issue.devDependencies, 'devDependencies', issue.file).length;
  }
  return counts;
}

// ── the comparison ──────────────────────────────────────────────────────────

function readBaseline() {
  if (!existsSync(BASELINE)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch (error) {
    fail(`.github/knip-baseline.json is not valid JSON: ${error.message}`);
  }
}

function asBaseline(counts, previous) {
  const out = {};
  for (const [key, value] of Object.entries(previous ?? {})) if (key.startsWith('//')) out[key] = value;
  if (!previous) {
    out['//'] = 'Dead code per workspace member, the ADR-078 AC-17 ratchet baseline: files nothing reaches, exports nothing imports, packages nothing uses (knip).';
    out['//how'] = 'A count that RISES fails CI. Regenerate with: node scripts/dead-code-ratchet.mjs --update';
    out['//when'] = 'Update this in the commit that REMOVES dead code. A pull request that raises a row says why in its Baseline: line (ADR-078 AC-12g).';
  }
  for (const [name, row] of Object.entries(counts)) out[name] = row;
  return out;
}

const counts = (() => {
  checkConfig();
  return count(parseReport(savedReport ? readFileSync(savedReport, 'utf8') : runKnip()));
})();

const width = Math.max(...Object.keys(counts).map((name) => name.length));
console.log(`${'member'.padEnd(width)}  ${KINDS.map((k) => k.padStart(14)).join('')}`);
for (const [name, row] of Object.entries(counts)) {
  console.log(`${name.padEnd(width)}  ${KINDS.map((k) => String(row[k]).padStart(14)).join('')}`);
}
console.log('');

const previous = readBaseline();

if (countsOut) {
  const path = join(REPO_ROOT, countsOut);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(asBaseline(counts, previous), null, 2)}\n`);
  console.log(`Counts written to ${relative(REPO_ROOT, path).replace(/\\/g, '/')}.`);
}

if (update) {
  writeFileSync(BASELINE, `${JSON.stringify(asBaseline(counts, previous), null, 2)}\n`);
  console.log('Baseline rewritten. Commit it with the change that removed the dead code.');
  process.exit(0);
}

if (!previous) {
  // The first landing (AC-19). The first baseline is taken from a main build's
  // knip-counts.json, so a build must be able to run before one exists. A pull
  // request that deletes the file later needs a Baseline: line (AC-12g), so this
  // is not a way out once it exists.
  console.log('NOTICE: .github/knip-baseline.json does not exist yet, so there is nothing to compare against');
  console.log('and this run passes. Take the first baseline from a main build\'s knip-counts.json (ADR-078 AC-19).');
  process.exit(0);
}

const rose = [];
const fell = [];
for (const [name, row] of Object.entries(counts)) {
  const base = previous[name];
  if (!base || typeof base !== 'object') {
    rose.push(`${name} has no row in .github/knip-baseline.json`);
    continue;
  }
  for (const kind of KINDS) {
    const was = base[kind];
    if (typeof was !== 'number') rose.push(`${name}.${kind} has no count in the baseline`);
    else if (row[kind] > was) rose.push(`${name}.${kind} rose ${was} to ${row[kind]}`);
    else if (row[kind] < was) fell.push(`${name}.${kind} fell ${was} to ${row[kind]}`);
  }
}
const stale = Object.keys(previous).filter((key) => !key.startsWith('//') && !(key in counts));

for (const line of fell) console.log(`fell   ${line}`);
for (const name of stale) console.log(`stale  ${name} is in the baseline but is no workspace member; drop it with --update.`);
if (fell.length > 0) console.log('Lower the baseline in this change: node scripts/dead-code-ratchet.mjs --update');

if (rose.length > 0) {
  for (const line of rose) console.error(`ROSE   ${line}`);
  fail(
    `${rose.length} count(s) rose. Delete the dead code, or wire it up if it should be live. If the rise is ` +
      'right (a new member, code moving between members, a knip upgrade), raise the row and say why in the ' +
      'pull request\'s Baseline: line.',
  );
}
console.log('dead-code ratchet passes: no count rose.');
