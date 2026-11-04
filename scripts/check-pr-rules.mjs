#!/usr/bin/env node
/**
 * The pull request rules: ADR-078 AC-3 and AC-11 to AC-15
 * (injishi.context, dox/adrs/078-delivery-guardrails).
 *
 * Run by the Jenkins job `injishi-pr-rules` (jenkins/pr-rules.Jenkinsfile)
 * every 5 minutes, from its own checkout of `main`. For every open pull request,
 * whatever its base, it reads the pull request through the GitHub API, never its
 * code, and posts two commit statuses on the head commit:
 *
 *   injishi/pr-rules  the delivery rules: a type, the lines that type needs, an
 *                     approved scope issue, removals, baselines and pipeline
 *                     changes stated, a base of main
 *   injishi/review    an approval from someone other than the author, on the
 *                     current head commit
 *
 * Why a job of its own rather than a stage in each build: a fork pull request is
 * built from its TARGET branch's Jenkinsfile, so one aimed at another branch (PR
 * #87 merged into `audric-hr`) is never judged by a stage; a description edit
 * starts no build; and a stage would hold the token in a workspace a fork's code
 * has just written to. This file runs only main's code and reads every pull
 * request as data, so nothing a pull request changes can loosen the rule it is
 * judged by. An edit to this file applies once it is merged.
 *
 * It fails closed (AC-14): an API error, a refused token or a truncated list
 * never passes a pull request, and the run exits non zero so the job is red.
 *
 * Dependency free on purpose: the job runs it with a bare Node image.
 *
 * Usage:
 *   GITHUB_TOKEN=... node scripts/check-pr-rules.mjs             judge and post
 *   GITHUB_TOKEN=... node scripts/check-pr-rules.mjs --dry-run   judge and print only
 *   GITHUB_TOKEN=... node scripts/check-pr-rules.mjs --pr 112    one pull request, open or not
 */
import { pathToFileURL } from 'node:url';

export const REPO = 'hangaasoftwares/injishi';
/** The one person who merges and who approves scope (CONTRIBUTING.md). */
export const OWNER = 'heissshami';
export const APPROVED_LABEL = 'scope: approved';
export const CONTEXT_RULES = 'injishi/pr-rules';
export const CONTEXT_REVIEW = 'injishi/review';

/** GitHub stops listing a pull request's files at 3000; past that, we cannot judge. */
const FILE_LIST_CAP = 3000;
const DESCRIPTION_MAX = 140;
const RECHECK = ' Edit the description: rechecked within 5 min.';

// ── the grammar (AC-15) ─────────────────────────────────────────────────────

/** Every field the rules read, by its lower case name. */
const FIELDS = new Set([
  'type',
  'scope',
  'spec',
  'verify',
  'broken',
  'reproduced',
  'proof',
  'removes',
  'baseline',
  'pipeline',
  'emergency',
  'follow-up',
]);

/** Fields whose value is the first line only; the rest run to the next field. */
const SINGLE_LINE = new Set(['type', 'scope', 'follow-up']);

const FIELD_LINE = /^\s*(?:[-*]\s+)?(?:\*\*)?([A-Za-z][A-Za-z-]*)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*)$/;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s*#{1,6}\s/;
const EMPTY_WORDS = /^(n\/?a|none|tbd|todo|-)\.?$/i;

/**
 * Read the field lines out of a pull request body.
 *
 * Line endings become `\n` and HTML comments go first, so a template's guidance
 * never counts as an answer. Lines inside a fenced code block are skipped. A
 * field line is `Name: value`, optionally after `- ` or `* ` and with `**` around
 * the name; names match without regard to case. A value runs from the colon to
 * the next field line or Markdown heading, so the free text under a heading is
 * never read as the last field's answer, except `Type`, `Scope` and
 * `Follow-up`, which take their first line only. The first occurrence of a name
 * wins.
 *
 * @param {string | null | undefined} body
 * @returns {Record<string, string>} lower case name to trimmed value
 */
export function parseBody(body) {
  const text = String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');
  const fields = {};
  let current = null;
  let fenced = false;
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = FIELD_LINE.exec(line);
    const name = match ? match[1].toLowerCase() : null;
    if (name && FIELDS.has(name)) {
      if (name in fields) {
        current = null; // a repeat: ignored, and so are the lines under it
      } else {
        fields[name] = match[2];
        current = SINGLE_LINE.has(name) ? null : name;
      }
      continue;
    }
    if (HEADING.test(line)) {
      current = null;
      continue;
    }
    if (current) fields[current] += `\n${line}`;
  }
  for (const name of Object.keys(fields)) fields[name] = fields[name].trim();
  return fields;
}

/** Blank, or a placeholder word that says nothing (`n/a`, `none`, `tbd`, `todo`, `-`). */
export function isEmptyValue(value) {
  if (value == null) return true;
  const text = String(value).trim();
  return text === '' || EMPTY_WORDS.test(text);
}

/**
 * An issue reference: `#123` or this repository's issue URL. Anything else
 * (another repository, a pull request URL, prose) is refused.
 *
 * @returns {number | null}
 */
export function parseIssueRef(value) {
  if (isEmptyValue(value)) return null;
  const text = String(value).split('\n')[0].trim();
  const short = /^#(\d+)$/.exec(text);
  if (short) return Number(short[1]);
  const url = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/i.exec(text);
  if (url && `${url[1]}/${url[2]}`.toLowerCase() === REPO.toLowerCase()) return Number(url[3]);
  return null;
}

// ── which files the rules watch ─────────────────────────────────────────────

/** A screen, a route, a controller or module, a product view, a member. */
const PROTECTED = [
  /^apps\/(web|app)\/src\/app\/(.+\/)?(page|route|layout)\.tsx?$/,
  /^apps\/mobile\/src\/app\/(.+\/)?[^/]+\.tsx$/,
  /^server\/api\/src\/(.+\/)?[^/]+\.(controller|module)\.ts$/,
  /^products\/[^/]+\/src\/web\/(.+\/)?[^/]+-view\.tsx$/,
  /^(apps|server|packages|products)\/[^/]+\/package\.json$/,
];

/** What decides a verdict: the pipeline, the checks, their configs. */
const GUARD = [
  /^Jenkinsfile$/,
  /^jenkins\//,
  /^scripts\//,
  /^\.github\//,
  /^tools\//,
  /^(biome\.json|knip\.jsonc|turbo\.json|pnpm-workspace\.yaml|mise\.toml|package\.json)$/,
  /(^|\/)eslint\.config\.mjs$/,
  /(^|\/)vitest[^/]*\.config\.[cm]?[jt]s$/,
];

/** Each has its own rule (baselines, AC-12g) or is only prose (the templates). */
const GUARD_EXEMPT = new Set([
  '.github/lint-baseline.json',
  '.github/api-cycles-baseline.json',
  '.github/knip-baseline.json',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/scope-proposal.md',
]);

export const BASELINES = [
  '.github/lint-baseline.json',
  '.github/api-cycles-baseline.json',
  '.github/knip-baseline.json',
];

const MEMBER_MANIFEST = /^(apps|server|packages|products)\/[^/]+\/package\.json$/;

export function isProtected(path) {
  return PROTECTED.some((pattern) => pattern.test(path));
}

export function isGuard(path) {
  return !GUARD_EXEMPT.has(path) && GUARD.some((pattern) => pattern.test(path));
}

export function isMemberManifest(path) {
  return MEMBER_MANIFEST.test(path);
}

/**
 * What a baseline gained between two versions: a number that rose, a count for
 * a key that did not exist, or a list entry that is new. `//` keys are comments.
 *
 * @returns {string[]} one line per raise, e.g. `@injishi/app.files 3 to 5`
 */
export function baselineRaises(before, after, prefix = '') {
  const raises = [];
  walk(after, before, prefix, raises);
  return raises;
}

function walk(after, before, path, out) {
  if (typeof after === 'number') {
    const was = typeof before === 'number' ? before : 0;
    if (after > was) out.push(`${path} ${was} to ${after}`);
    return;
  }
  if (Array.isArray(after)) {
    const known = new Set(Array.isArray(before) ? before.map(String) : []);
    for (const item of after) {
      if (!known.has(String(item))) out.push(`${path} adds ${String(item).slice(0, 60)}`);
    }
    return;
  }
  if (after && typeof after === 'object') {
    for (const [key, value] of Object.entries(after)) {
      if (key.startsWith('//')) continue;
      const was = before && typeof before === 'object' && !Array.isArray(before) ? before[key] : undefined;
      walk(value, was, path ? `${path}.${key}` : key, out);
    }
  }
}

// ── the verdicts ────────────────────────────────────────────────────────────

const REQUIRED = {
  feature: ['scope', 'spec', 'verify'],
  fix: ['broken', 'reproduced', 'proof'],
  chore: [],
};

const LABELS = {
  scope: 'Scope',
  spec: 'Spec',
  verify: 'Verify',
  broken: 'Broken',
  reproduced: 'Reproduced',
  proof: 'Proof',
};

function firstLine(value) {
  return String(value ?? '').split('\n')[0].trim();
}

function andMore(list) {
  return list.length > 1 ? `${list[0]} and ${list.length - 1} more` : list[0];
}

/** At most 140 characters, the limit GitHub puts on a status description. */
export function clip(text, max = DESCRIPTION_MAX) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 3).trimEnd()}...`;
}

/** The first reason, how many more, and what to do; within 140 characters. */
export function failureDescription(reasons) {
  const more = reasons.length > 1 ? ` (+${reasons.length - 1} more)` : '';
  const room = DESCRIPTION_MAX - more.length - RECHECK.length;
  return `${clip(reasons[0], room)}${more}${RECHECK}`;
}

/**
 * The `injishi/pr-rules` verdict for one pull request, from facts already read.
 *
 * @param {object} facts
 * @param {{ base: string, body: string }} facts.pr
 * @param {{ filename: string, status: string, previous_filename?: string }[]} facts.files
 * @param {{ number: number, exists: boolean, isIssue: boolean, open: boolean, approvedByOwner: boolean, labelActor?: string | null } | null} [facts.scopeIssue]
 * @param {{ number: number, exists: boolean, isIssue: boolean, open: boolean } | null} [facts.followUp]
 * @param {string[]} [facts.baselineRaises] what the change raised in the three baselines
 * @param {string[]} [facts.scriptsChanged] member manifests whose `scripts` changed
 * @returns {{ state: 'success' | 'failure', description: string, reasons: string[] }}
 */
export function judge(facts) {
  const body = parseBody(facts.pr.body);
  const reasons = [];
  const files = facts.files ?? [];

  if (facts.pr.base !== 'main') reasons.push(`The base is ${facts.pr.base}, not main.`);

  // AC-3: an emergency waives every rule but the base.
  if (!isEmptyValue(body.emergency)) {
    reasons.push(...followUpProblems(body, facts.followUp));
    if (reasons.length === 0) {
      return { state: 'success', description: clip(`Emergency: ${firstLine(body.emergency)}`), reasons };
    }
    return { state: 'failure', description: failureDescription(reasons), reasons };
  }

  const type = firstLine(body.type).toLowerCase();
  if (!(type in REQUIRED)) {
    reasons.push(
      isEmptyValue(body.type) ? 'Type: is missing (feature, fix or chore).' : `Type: "${type}" is not feature, fix or chore.`,
    );
  } else {
    for (const name of REQUIRED[type]) {
      if (isEmptyValue(body[name])) reasons.push(`${LABELS[name]}: is empty.`);
    }
  }

  const deleted = files.filter((f) => f.status === 'removed' && isProtected(f.filename)).map((f) => f.filename);
  const added = files.filter((f) => f.status === 'added' && isProtected(f.filename)).map((f) => f.filename);

  // AC-12d to f: a feature, or a change that adds or deletes a screen, route,
  // module, view or member, needs a scope issue the owner approved.
  if (type === 'feature' || deleted.length > 0 || added.length > 0) {
    if (isEmptyValue(body.scope)) {
      if (type !== 'feature') {
        const why = deleted.length > 0 ? `deletes ${andMore(deleted)}` : `adds ${andMore(added)}`;
        reasons.push(`Scope: is needed, the change ${why}.`);
      }
    } else {
      reasons.push(...scopeProblems(body, facts.scopeIssue));
    }
  }
  if (deleted.length > 0 && isEmptyValue(body.removes)) {
    reasons.push(`Removes: is needed, the change deletes ${andMore(deleted)}.`);
  }

  // AC-12g.
  const raised = facts.baselineRaises ?? [];
  if (raised.length > 0 && isEmptyValue(body.baseline)) {
    reasons.push(`Baseline: is needed, ${andMore(raised)}.`);
  }

  // AC-12h.
  const guarded = [
    ...new Set(
      files
        .flatMap((f) => [f.filename, f.previous_filename].filter(Boolean))
        .filter(isGuard)
        .concat(facts.scriptsChanged ?? []),
    ),
  ];
  if (guarded.length > 0 && isEmptyValue(body.pipeline)) {
    reasons.push(`Pipeline: is needed, the change touches ${andMore(guarded)}.`);
  }

  if (reasons.length === 0) {
    const scope = type === 'feature' || deleted.length > 0 || added.length > 0 ? `, scope ${firstLine(body.scope)}` : '';
    return { state: 'success', description: clip(`${type}: every rule holds${scope}.`), reasons };
  }
  return { state: 'failure', description: failureDescription(reasons), reasons };
}

function scopeProblems(body, issue) {
  const ref = parseIssueRef(body.scope);
  if (ref == null) return [`Scope: "${firstLine(body.scope)}" is not #N or this repository's issue URL.`];
  if (!issue || !issue.exists) return [`Scope: #${ref} does not exist in ${REPO}.`];
  if (!issue.isIssue) return [`Scope: #${ref} is a pull request, not an issue.`];
  if (!issue.approvedByOwner) {
    const who = issue.labelActor ? `, it was applied by ${issue.labelActor}` : '';
    return [`Scope: #${ref} has no "${APPROVED_LABEL}" from ${OWNER}${who}.`];
  }
  return [];
}

function followUpProblems(body, issue) {
  const ref = parseIssueRef(body['follow-up']);
  if (ref == null) return ['Follow-up: must name an open issue in this repository (#N).'];
  if (!issue || !issue.exists) return [`Follow-up: #${ref} does not exist.`];
  if (!issue.isIssue) return [`Follow-up: #${ref} is a pull request, not an issue.`];
  if (!issue.open) return [`Follow-up: #${ref} is closed.`];
  return [];
}

/**
 * The `injishi/review` verdict (AC-13): success when a reviewer other than the
 * author has, as their latest deciding review, an approval of the current head.
 * A comment does not replace an approval; a later change request or a dismissal
 * does.
 *
 * @param {{ user?: { login: string } | null, state: string, commit_id: string }[]} reviews oldest first, as the API lists them
 */
export function reviewVerdict(reviews, author, headSha) {
  const latest = new Map();
  for (const review of reviews) {
    const login = review.user?.login;
    if (!login || login === author) continue;
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    latest.set(login, review);
  }
  const short = String(headSha).slice(0, 7);
  const approvers = [...latest.values()]
    .filter((review) => review.state === 'APPROVED' && review.commit_id === headSha)
    .map((review) => review.user.login);
  if (approvers.length > 0) {
    return { state: 'success', description: clip(`Approved on ${short} by ${approvers.join(', ')}.`) };
  }
  return { state: 'pending', description: clip(`Waiting for an approval of ${short} by someone other than ${author}.`) };
}

// ── GitHub ──────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function client(token) {
  async function call(path, { method = 'GET', body } = {}) {
    const url = path.startsWith('https://') ? path : `https://api.github.com${path}`;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'user-agent': 'injishi-pr-rules',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new ApiError(`GitHub could not be reached (${method} ${path}): ${error.message}`, 0);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ApiError(`GitHub answered ${response.status} to ${method} ${path}: ${detail.slice(0, 200)}`, response.status);
    }
    const data = response.status === 204 ? null : await response.json();
    return { data, link: response.headers.get('link') };
  }

  async function paged(path) {
    let next = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
    const all = [];
    while (next) {
      const { data, link } = await call(next);
      if (!Array.isArray(data)) throw new ApiError(`GitHub did not answer ${path} with a list.`, 0);
      all.push(...data);
      next = /<([^>]+)>;\s*rel="next"/.exec(link ?? '')?.[1] ?? null;
    }
    return all;
  }

  /** A file at a commit, or null when it does not exist there. */
  async function fileAt(path, ref) {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    try {
      const { data } = await call(`/repos/${REPO}/contents/${encoded}?ref=${ref}`);
      if (data?.encoding !== 'base64') throw new ApiError(`GitHub did not return ${path} at ${ref} as base64.`, 0);
      return Buffer.from(data.content, 'base64').toString('utf8');
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  return { call, paged, fileAt };
}

async function readIssue(api, number) {
  let issue;
  try {
    ({ data: issue } = await api.call(`/repos/${REPO}/issues/${number}`));
  } catch (error) {
    if (error.status === 404 || error.status === 410) return { number, exists: false, isIssue: false, open: false };
    throw error;
  }
  return {
    number,
    exists: true,
    isIssue: !issue.pull_request,
    open: issue.state === 'open',
    labels: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)),
  };
}

/** Triage collaborators can label too, so who applied the label is what counts. */
async function readScopeIssue(api, number) {
  const issue = await readIssue(api, number);
  if (!issue.exists || !issue.isIssue) return { ...issue, approvedByOwner: false, labelActor: null };
  const events = await api.paged(`/repos/${REPO}/issues/${number}/events`);
  let last = null;
  for (const event of events) {
    if ((event.event === 'labeled' || event.event === 'unlabeled') && event.label?.name === APPROVED_LABEL) last = event;
  }
  const labelled = last?.event === 'labeled' && issue.labels.includes(APPROVED_LABEL);
  return {
    ...issue,
    approvedByOwner: labelled && last.actor?.login === OWNER,
    labelActor: labelled ? (last.actor?.login ?? null) : null,
  };
}

function parseJson(text, path, ref) {
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError(`${path} at ${ref.slice(0, 7)} is not valid JSON: ${error.message}`, 0);
  }
}

/** Every fact `judge` needs about one pull request, read through the API. */
export async function readFacts(api, pr) {
  const files = await api.paged(`/repos/${REPO}/pulls/${pr.number}/files`);
  if (files.length >= FILE_LIST_CAP) {
    throw new ApiError(`the pull request lists ${files.length} files, and GitHub stops at ${FILE_LIST_CAP}, so it cannot be judged.`, 0);
  }
  const body = parseBody(pr.body);
  const head = pr.head.sha;

  const changed = new Set(files.map((f) => f.filename));
  const baselinesTouched = BASELINES.filter((path) => changed.has(path));
  const manifestsTouched = files.filter((f) => f.status === 'modified' && isMemberManifest(f.filename)).map((f) => f.filename);

  let mergeBase = null;
  if (baselinesTouched.length > 0 || manifestsTouched.length > 0) {
    const { data } = await api.call(`/repos/${REPO}/compare/${pr.base.sha}...${head}`);
    mergeBase = data?.merge_base_commit?.sha;
    if (!mergeBase) throw new ApiError('GitHub gave no merge base for this pull request.', 0);
  }

  const raises = [];
  for (const path of baselinesTouched) {
    const before = parseJson(await api.fileAt(path, mergeBase), path, mergeBase);
    const after = parseJson(await api.fileAt(path, head), path, head);
    // Deleting a baseline turns its ratchet off, the largest raise there is.
    if (!after) raises.push(`${path.replace(/^\.github\//, '')} is deleted`);
    else raises.push(...baselineRaises(before, after, path.replace(/^\.github\//, '')));
  }

  const scriptsChanged = [];
  for (const path of manifestsTouched) {
    const before = parseJson(await api.fileAt(path, mergeBase), path, mergeBase);
    const after = parseJson(await api.fileAt(path, head), path, head);
    if (JSON.stringify(before?.scripts ?? {}) !== JSON.stringify(after?.scripts ?? {})) scriptsChanged.push(`${path} scripts`);
  }

  const scopeRef = parseIssueRef(body.scope);
  const followRef = parseIssueRef(body['follow-up']);
  return {
    pr: { base: pr.base.ref, body: pr.body },
    files: files.map((f) => ({ filename: f.filename, status: f.status, previous_filename: f.previous_filename })),
    scopeIssue: scopeRef == null ? null : await readScopeIssue(api, scopeRef),
    followUp: followRef == null ? null : await readIssue(api, followRef),
    baselineRaises: raises,
    scriptsChanged,
  };
}

/** The newest status per context on a commit. */
async function currentStatuses(api, sha) {
  const { data } = await api.call(`/repos/${REPO}/commits/${sha}/statuses?per_page=100`);
  const latest = new Map();
  for (const status of data ?? []) if (!latest.has(status.context)) latest.set(status.context, status);
  return latest;
}

async function publish(api, sha, verdicts, { dryRun }) {
  const current = dryRun ? new Map() : await currentStatuses(api, sha);
  for (const { context, state, description } of verdicts) {
    const now = current.get(context);
    if (now && now.state === state && now.description === description) continue; // AC-11: post only on change
    if (dryRun) continue;
    await api.call(`/repos/${REPO}/statuses/${sha}`, {
      method: 'POST',
      body: {
        state,
        description,
        context,
        ...(process.env.BUILD_URL ? { target_url: process.env.BUILD_URL } : {}),
      },
    });
  }
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const at = argv.indexOf('--pr');
  const only = at >= 0 ? Number(argv[at + 1]) : null;
  if (at >= 0 && !Number.isInteger(only)) {
    console.error('--pr needs a pull request number.');
    return 1;
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is not set. Without it nothing can be judged, and a check that');
    console.error('cannot judge must fail rather than pass (ADR-078 AC-14).');
    return 1;
  }
  const api = client(token);

  const prs = only == null ? await api.paged(`/repos/${REPO}/pulls?state=open`) : [(await api.call(`/repos/${REPO}/pulls/${only}`)).data];
  console.log(`${prs.length} pull request(s) to judge${dryRun ? ' (dry run: nothing is posted)' : ''}.`);

  let unjudged = 0;
  for (const pr of prs) {
    const head = pr.head.sha;
    const title = `#${pr.number} ${pr.user?.login ?? '?'} into ${pr.base.ref} at ${head.slice(0, 7)}`;
    let verdicts;
    try {
      const rules = judge(await readFacts(api, pr));
      const reviews = await api.paged(`/repos/${REPO}/pulls/${pr.number}/reviews`);
      const review = reviewVerdict(reviews, pr.user?.login, head);
      verdicts = [
        { context: CONTEXT_RULES, ...rules },
        { context: CONTEXT_REVIEW, ...review },
      ];
      console.log(`\n${title}`);
      console.log(`  ${CONTEXT_RULES}  ${rules.state}  ${rules.description}`);
      for (const reason of rules.reasons) console.log(`    - ${reason}`);
      console.log(`  ${CONTEXT_REVIEW}  ${review.state}  ${review.description}`);
    } catch (error) {
      unjudged += 1;
      console.error(`\n${title}\n  could not judge: ${error.message}`);
      verdicts = [{ context: CONTEXT_RULES, state: 'failure', description: clip(`Could not judge: ${error.message}`) }];
    }
    try {
      await publish(api, head, verdicts, { dryRun });
    } catch (error) {
      unjudged += 1;
      console.error(`  could not post: ${error.message}`);
    }
  }

  if (unjudged > 0) {
    console.error(`\n${unjudged} pull request(s) could not be judged or posted. This run fails so the job is red (AC-14).`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`The rules job failed: ${error.message}`);
      process.exit(1);
    },
  );
}
