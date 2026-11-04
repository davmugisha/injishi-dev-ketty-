/**
 * The pure core of scripts/check-pr-rules.mjs: the grammar, the rules and the
 * two verdicts (ADR-078 AC-3, AC-12, AC-13, AC-15). Run by `ci: workflow guard`.
 *
 *   node --test scripts/check-pr-rules.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APPROVED_LABEL,
  OWNER,
  baselineRaises,
  failureDescription,
  isEmptyValue,
  isGuard,
  isProtected,
  judge,
  parseBody,
  parseIssueRef,
  reviewVerdict,
} from './check-pr-rules.mjs';

const approved = (number = 142) => ({ number, exists: true, isIssue: true, open: true, approvedByOwner: true, labelActor: OWNER });
const facts = (body, more = {}) => ({ pr: { base: 'main', body }, files: [], ...more });
const feature = 'Type: feature\nScope: #142\nSpec: ADR-078\nVerify: /check verify, all pass';

describe('the grammar', () => {
  it('reads CRLF bodies, any case, bullets and bold names', () => {
    const body = parseBody('type: Feature\r\n- **Scope:** #142\r\n* Spec: ADR-078\r\n**Verify**: ok');
    assert.equal(body.type, 'Feature');
    assert.equal(body.scope, '#142');
    assert.equal(body.spec, 'ADR-078');
    assert.equal(body.verify, 'ok');
  });

  it('ignores HTML comments, so template guidance never counts', () => {
    const body = parseBody('Type: chore\nScope: <!-- #N of the approved issue -->\n');
    assert.equal(body.scope, '');
  });

  it('skips fields inside a fenced code block', () => {
    const body = parseBody('Type: fix\n```\nScope: #9\n```\n');
    assert.equal(body.scope, undefined);
  });

  it('runs a multi line value to the next field', () => {
    const body = parseBody('Verify: ran it\nall 34 checks pass\nType: feature');
    assert.equal(body.verify, 'ran it\nall 34 checks pass');
    assert.equal(body.type, 'feature');
  });

  it('ends a value at a Markdown heading, so the description is never an answer', () => {
    const body = parseBody('Type: chore\nPipeline:\n\n## What changed and why\n\nA long description.');
    assert.equal(body.pipeline, '');
  });

  it('takes the first line only for Type, Scope and Follow-up', () => {
    const body = parseBody('Type: feature\n\nA long description of the change.');
    assert.equal(body.type, 'feature');
  });

  it('keeps the first occurrence of a name', () => {
    assert.equal(parseBody('Type: fix\nType: chore').type, 'fix');
  });

  it('treats placeholder words as empty', () => {
    for (const word of ['', '  ', 'n/a', 'NA', 'none', 'TBD', 'todo', '-']) assert.equal(isEmptyValue(word), true, word);
    assert.equal(isEmptyValue('ADR-078'), false);
  });

  it('accepts #N and this repository issue URL only', () => {
    assert.equal(parseIssueRef('#142'), 142);
    assert.equal(parseIssueRef('https://github.com/hangaasoftwares/injishi/issues/7'), 7);
    assert.equal(parseIssueRef('https://github.com/someone/else/issues/7'), null);
    assert.equal(parseIssueRef('https://github.com/hangaasoftwares/injishi/pull/7'), null);
    assert.equal(parseIssueRef('issue 7'), null);
  });
});

describe('which files the rules watch', () => {
  it('protects routes, screens, controllers, modules, views and members', () => {
    for (const path of [
      'apps/app/src/app/(app)/finance/page.tsx',
      'apps/web/src/app/page.tsx',
      'apps/web/src/app/api/health/route.ts',
      'apps/mobile/src/app/guest/property/[slug].tsx',
      'apps/mobile/src/app/_layout.tsx',
      'server/api/src/api/public/ops/folios.controller.ts',
      'server/api/src/modules/hr/people.module.ts',
      'products/pms/src/web/commercial/rates-inventory-view.tsx',
      'products/hr/package.json',
    ]) {
      assert.equal(isProtected(path), true, path);
    }
    for (const path of ['apps/app/src/features/pms/pms-mount.tsx', 'products/pms/src/web/commercial/groups-panels.tsx', 'package.json']) {
      assert.equal(isProtected(path), false, path);
    }
  });

  it('guards the pipeline and the checks, not the baselines or templates', () => {
    for (const path of ['Jenkinsfile', 'jenkins/pr-rules.Jenkinsfile', 'scripts/ci-complete.mjs', '.github/CODEOWNERS', 'knip.jsonc', 'package.json', 'apps/web/eslint.config.mjs', 'server/api/vitest.manual.config.mts', 'tools/eslint-rules/index.js']) {
      assert.equal(isGuard(path), true, path);
    }
    for (const path of ['.github/lint-baseline.json', '.github/knip-baseline.json', '.github/pull_request_template.md', 'apps/web/package.json', 'apps/web/src/app/page.tsx']) {
      assert.equal(isGuard(path), false, path);
    }
  });
});

describe('baseline raises', () => {
  it('finds a risen count, a new member with a count, and a new list entry', () => {
    const before = { '//': 'comment', '@injishi/app': 5, cycles: ['a > b'], nested: { '@injishi/web': { files: 1 } } };
    const after = { '//': 'changed comment', '@injishi/app': 6, '@injishi/new': 0, '@injishi/other': 2, cycles: ['a > b', 'c > d'], nested: { '@injishi/web': { files: 1 } } };
    assert.deepEqual(baselineRaises(before, after), ['@injishi/app 5 to 6', '@injishi/other 0 to 2', 'cycles adds c > d']);
  });

  it('finds nothing when counts fall', () => {
    assert.deepEqual(baselineRaises({ '@injishi/app': 5 }, { '@injishi/app': 3 }), []);
  });
});

describe('the pr-rules verdict', () => {
  it('passes a complete feature with an approved scope', () => {
    const verdict = judge(facts(feature, { scopeIssue: approved() }));
    assert.equal(verdict.state, 'success', verdict.reasons.join('; '));
  });

  it('passes a bare chore', () => {
    assert.equal(judge(facts('Type: chore')).state, 'success');
  });

  it('a: fails a base other than main, even in an emergency', () => {
    const verdict = judge({ pr: { base: 'audric-hr', body: 'Emergency: prod down\nFollow-up: #9' }, files: [], followUp: { number: 9, exists: true, isIssue: true, open: true } });
    assert.equal(verdict.state, 'failure');
    assert.match(verdict.reasons[0], /not main/);
  });

  it('b and c: names every missing line, the first in the description', () => {
    const verdict = judge(facts('Type: feature'));
    assert.equal(verdict.state, 'failure');
    assert.deepEqual(verdict.reasons, ['Scope: is empty.', 'Spec: is empty.', 'Verify: is empty.']);
    assert.match(verdict.description, /^Scope: is empty\. \(\+2 more\) Edit the description/);
    assert.ok(verdict.description.length <= 140);
  });

  it('b: fails a missing or unknown type', () => {
    assert.match(judge(facts('Scope: #1')).reasons[0], /Type: is missing/);
    assert.match(judge(facts('Type: refactor')).reasons[0], /is not feature, fix or chore/);
  });

  it('c: a fix needs Broken, Reproduced and Proof', () => {
    assert.deepEqual(judge(facts('Type: fix\nBroken: x\nReproduced: y')).reasons, ['Proof: is empty.']);
  });

  it('d: refuses a scope label a teammate applied', () => {
    const verdict = judge(facts(feature, { scopeIssue: { ...approved(), approvedByOwner: false, labelActor: 'someone' } }));
    assert.match(verdict.reasons[0], new RegExp(`no "${APPROVED_LABEL}" from ${OWNER}, it was applied by someone`));
  });

  it('d: refuses a pull request or another repository as scope', () => {
    assert.match(judge(facts(feature, { scopeIssue: { ...approved(), isIssue: false } })).reasons[0], /is a pull request/);
    assert.match(judge(facts(feature.replace('#142', 'https://github.com/x/y/issues/1'))).reasons[0], /is not #N/);
  });

  it('e: deleting a route needs Removes and an approved scope, whatever the type', () => {
    const files = [{ filename: 'apps/app/src/app/(app)/finance/page.tsx', status: 'removed' }];
    const verdict = judge(facts('Type: chore', { files }));
    assert.deepEqual(verdict.reasons, [
      'Scope: is needed, the change deletes apps/app/src/app/(app)/finance/page.tsx.',
      'Removes: is needed, the change deletes apps/app/src/app/(app)/finance/page.tsx.',
    ]);
    assert.equal(judge(facts('Type: chore\nScope: #142\nRemoves: the old finance page, replaced by the product view', { files, scopeIssue: approved() })).state, 'success');
  });

  it('e: a renamed route is not a deletion', () => {
    const files = [{ filename: 'apps/app/src/app/(app)/money/page.tsx', previous_filename: 'apps/app/src/app/(app)/finance/page.tsx', status: 'renamed' }];
    assert.equal(judge(facts('Type: chore', { files })).state, 'success');
  });

  it('f: a chore that adds a view needs an approved scope', () => {
    const files = [{ filename: 'products/pms/src/web/stays/new-view.tsx', status: 'added' }];
    assert.match(judge(facts('Type: chore', { files })).reasons[0], /Scope: is needed, the change adds/);
  });

  it('g: a raised baseline needs Baseline', () => {
    const verdict = judge(facts('Type: chore', { baselineRaises: ['knip-baseline.json.@injishi/app.files 3 to 4'] }));
    assert.match(verdict.reasons[0], /^Baseline: is needed/);
    assert.equal(judge(facts('Type: chore\nBaseline: the new product adds a member', { baselineRaises: ['x 0 to 1'] })).state, 'success');
  });

  it('h: a change to the pipeline or a member script needs Pipeline', () => {
    assert.match(judge(facts('Type: chore', { files: [{ filename: 'scripts/ci-complete.mjs', status: 'modified' }] })).reasons[0], /^Pipeline: is needed, the change touches scripts\/ci-complete\.mjs/);
    assert.match(judge(facts('Type: chore', { scriptsChanged: ['apps/web/package.json scripts'] })).reasons[0], /apps\/web\/package\.json scripts/);
    assert.equal(judge(facts('Type: chore\nPipeline: adds the dead code job', { files: [{ filename: 'Jenkinsfile', status: 'modified' }] })).state, 'success');
  });

  it('AC-3: an emergency with an open follow up issue passes and waives the rest', () => {
    const verdict = judge(facts('Emergency: production checkout is down\nFollow-up: #9', { followUp: { number: 9, exists: true, isIssue: true, open: true }, files: [{ filename: 'Jenkinsfile', status: 'modified' }] }));
    assert.equal(verdict.state, 'success');
    assert.match(verdict.description, /^Emergency: production checkout is down/);
  });

  it('AC-3: an emergency needs an open issue, not a pull request or a closed one', () => {
    assert.match(judge(facts('Emergency: x')).reasons[0], /Follow-up: must name/);
    assert.match(judge(facts('Emergency: x\nFollow-up: #9', { followUp: { number: 9, exists: true, isIssue: false, open: true } })).reasons[0], /pull request/);
    assert.match(judge(facts('Emergency: x\nFollow-up: #9', { followUp: { number: 9, exists: true, isIssue: true, open: false } })).reasons[0], /closed/);
  });

  it('keeps every failure description within 140 characters', () => {
    const long = 'x'.repeat(400);
    assert.ok(failureDescription([long, 'b', 'c']).length <= 140);
  });
});

describe('the review verdict', () => {
  const head = 'abcdef1234567890';
  it('passes an approval of the head by someone else', () => {
    const verdict = reviewVerdict([{ user: { login: 'kbelyse' }, state: 'APPROVED', commit_id: head }], 'heissshami', head);
    assert.equal(verdict.state, 'success');
    assert.match(verdict.description, /by kbelyse/);
  });

  it('waits when the approval is of an older commit, or by the author', () => {
    assert.equal(reviewVerdict([{ user: { login: 'kbelyse' }, state: 'APPROVED', commit_id: 'old' }], 'heissshami', head).state, 'pending');
    assert.equal(reviewVerdict([{ user: { login: 'heissshami' }, state: 'APPROVED', commit_id: head }], 'heissshami', head).state, 'pending');
  });

  it('a later change request replaces an approval; a comment does not', () => {
    const approve = { user: { login: 'kbelyse' }, state: 'APPROVED', commit_id: head };
    assert.equal(reviewVerdict([approve, { user: { login: 'kbelyse' }, state: 'COMMENTED', commit_id: head }], 'x', head).state, 'success');
    assert.equal(reviewVerdict([approve, { user: { login: 'kbelyse' }, state: 'CHANGES_REQUESTED', commit_id: head }], 'x', head).state, 'pending');
  });
});
