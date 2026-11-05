import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { copyTarget, diffCounts, parseDumpName, planRetention, scrub, stamp } from './backup.mjs';

const POLICY = { keepAllDays: 3, keepDailyDays: 14, keepWeeklyWeeks: 8, minimumToKeep: 6 };
const NOW = new Date(2026, 10, 20, 12, 0, 0); // 20 Nov 2026, noon, local time
const at = (daysAgo, hour = 12) => new Date(2026, 10, 20 - daysAgo, hour, 0, 0);
const b = (daysAgo, hour = 12) => ({ file: `t_${stamp(at(daysAgo, hour))}.dump`, at: at(daysAgo, hour) });

describe('file names', () => {
  test('stamp and parse round-trip', () => {
    const d = new Date(2026, 10, 5, 3, 9, 27);
    assert.equal(stamp(d), '20261105-030927');
    assert.deepEqual(parseDumpName('docker-demo_20261105-030927.dump'), { target: 'docker-demo', at: d });
  });
  test('only this tool\'s own files parse: partial files, checksums and strangers are ignored', () => {
    for (const f of ['docker-demo_20261105-030927.dump.partial', 'docker-demo_20261105-030927.dump.sha256', 'injishi_demo-M0-pre-docker_20261105-030927.dump', 'notes.txt', '../x_20261105-030927.dump', 'UPPER_20261105-030927.dump']) {
      assert.equal(parseDumpName(f), null, f);
    }
  });
});

describe('retention', () => {
  test('keeps everything from the last 3 days', () => {
    const all = [b(0, 1), b(0, 7), b(0, 13), b(1, 1), b(1, 13), b(2, 6), b(2, 18)];
    assert.deepEqual(planRetention(all, NOW, POLICY).remove, []);
  });
  test('beyond 3 days keeps the newest of each day, drops the rest', () => {
    const day5 = [b(5, 1), b(5, 7), b(5, 13), b(5, 19)];
    const recent = [b(0), b(1), b(2), b(3, 12), b(4, 12), b(6, 12)]; // padding past the floor
    const plan = planRetention([...day5, ...recent], NOW, POLICY);
    assert.equal(plan.keep.includes(day5[3].file), true, 'newest of the day stays');
    for (const gone of [day5[0], day5[1], day5[2]]) assert.equal(plan.remove.includes(gone.file), true, 'older ones of that day go');
  });
  test('beyond 14 days keeps one per week, beyond 8 weeks keeps none', () => {
    const lots = [b(0), b(1), b(2), b(3), b(4), b(5)]; // clear the minimum floor with fresh ones
    const sameWeekA = b(20, 9), sameWeekB = b(20, 21), old = b(90, 12);
    const plan = planRetention([...lots, sameWeekA, sameWeekB, old], NOW, POLICY);
    assert.equal(plan.keep.includes(sameWeekB.file), true);
    assert.equal(plan.remove.includes(sameWeekA.file), true);
    assert.equal(plan.remove.includes(old.file), true);
  });
  test('NEVER goes below the minimum, however old everything is', () => {
    const ancient = [b(200), b(201), b(202), b(203), b(204), b(205), b(206), b(207)];
    const plan = planRetention(ancient, NOW, POLICY);
    assert.equal(plan.keep.length, 6);
    assert.deepEqual(plan.keep, ancient.slice(0, 6).map((x) => x.file));
  });
  test('removing nothing when there is nothing', () => {
    assert.deepEqual(planRetention([], NOW, POLICY), { keep: [], remove: [] });
  });
  test('is independent of input order', () => {
    const all = [b(0), b(1), b(5, 1), b(5, 13), b(40), b(41), b(60), b(61), b(62), b(70)];
    const a = planRetention(all, NOW, POLICY);
    const z = planRetention([...all].reverse(), NOW, POLICY);
    assert.deepEqual([...a.keep].sort(), [...z.keep].sort());
  });
});

describe('restore drill helpers', () => {
  test('copyTarget reads schema.table, quoted or not', () => {
    assert.equal(copyTarget('COPY public.pos_orders (id, name) FROM stdin;'), 'public.pos_orders');
    assert.equal(copyTarget('COPY drizzle.__drizzle_migrations (id, hash) FROM stdin;'), 'drizzle.__drizzle_migrations');
    assert.equal(copyTarget('COPY public."Odd Name" (id) FROM stdin;'), 'public.Odd Name');
    assert.equal(copyTarget('-- not a copy'), null);
  });
  test('diffCounts reports a missing table and a changed count, and nothing when equal', () => {
    const expected = new Map([['public.a', 3], ['public.b', 0], ['public.c', 7]]);
    assert.deepEqual(diffCounts(expected, new Map([['public.a', 3], ['public.b', 0], ['public.c', 7]])), []);
    const problems = diffCounts(expected, new Map([['public.a', 2], ['public.b', 0]]));
    assert.equal(problems.length, 2);
    assert.match(problems[0], /public\.a: dump has 3, restore has 2/);
    assert.match(problems[1], /public\.c: missing after restore/);
  });
});

describe('secrets never reach the log', () => {
  test('scrub removes every occurrence of every secret', () => {
    const out = scrub('pg_dump failed: password authentication failed for "hunter2-s3cret"; retry with hunter2-s3cret', ['hunter2-s3cret']);
    assert.equal(out.includes('hunter2'), false);
    assert.equal((out.match(/\*\*\*/g) ?? []).length, 2);
  });
  test('an empty or tiny secret is ignored instead of mangling the text', () => {
    assert.equal(scrub('abc', ['', 'a']), 'abc');
  });
});
