import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rentForMonth, rentHistory } from './rent-history.mjs';

// A fixed month to reason from. The generator takes `today` as an argument
// precisely so a test never has to wait for the calendar.
const TODAY = { year: 2026, month0: 8 }; // September 2026

/** The offset in months of a `YYYY-MM-01` period from `TODAY`. */
function offsetOf(period) {
  const [y, m] = period.split('-').map(Number);
  return (y * 12 + (m - 1)) - (TODAY.year * 12 + TODAY.month0);
}

const LEASES = [
  { id: 'lease-didier', rent: 300_000, startMonth: -18 },
  { id: 'lease-aline', rent: 320_000, startMonth: -8 },
  { id: 'lease-esther', rent: 290_000, startMonth: -26, endMonth: -3 },
  { id: 'lease-olive', rent: 310_000, startMonth: -2 },
  { id: 'lease-fresh', rent: 280_000, startMonth: -1 },
];

const rows = rentHistory(LEASES, TODAY, { idFor: (n) => `id-${n}` });
const forLease = (id) => rows.filter((r) => r.lease === id);

test('a tenancy is charged for every month it ran, up to the newest generated month', () => {
  const didier = forLease('lease-didier');
  const offsets = didier.map((r) => offsetOf(r.period)).sort((a, b) => a - b);
  // -18 through -2 inclusive. Counted from the range, not typed in.
  const expected = [];
  for (let o = -18; o <= -2; o += 1) expected.push(o);
  assert.deepEqual(offsets, expected);
});

test('a tenancy older than the window starts at the window edge', () => {
  const esther = forLease('lease-esther');
  const oldest = Math.min(...esther.map((r) => offsetOf(r.period)));
  assert.equal(oldest, -24, 'default monthsBack is 24, so a 26 month tenancy is clipped');

  const shorter = rentHistory([LEASES[2]], TODAY, { monthsBack: 6 });
  assert.equal(Math.min(...shorter.map((r) => offsetOf(r.period))), -6);
});

test('an ended tenancy stops owing rent at its own end, not at the window edge', () => {
  const offsets = forLease('lease-esther').map((r) => offsetOf(r.period));
  assert.equal(Math.max(...offsets), -3);
});

test('nothing is generated for last month or this month', () => {
  // The two months `seed-demo-portfolio.mjs` authors by hand carry the whole
  // narrative. A generated row there would collide on
  // `rent_charges_lease_period_uk` and, worse, could win.
  const trespassers = rows.filter((r) => offsetOf(r.period) > -2);
  assert.deepEqual(trespassers, []);
});

test('a tenancy that began inside the two hand-written months contributes nothing', () => {
  assert.deepEqual(forLease('lease-fresh'), []);
});

test('a tenancy that began exactly at the newest generated month gets that one month', () => {
  const olive = forLease('lease-olive');
  assert.equal(olive.length, 1);
  assert.equal(offsetOf(olive[0].period), -2);
});

test('no lease is charged twice for one month', () => {
  const pairs = rows.map((r) => `${r.lease}@${r.period}`);
  assert.equal(new Set(pairs).size, pairs.length);
});

test('every row carries a distinct id', () => {
  const ids = rows.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, rows.length);
});

test('every generated month is settled in full', () => {
  for (const row of rows) {
    assert.equal(row.status, 'paid', `${row.lease}@${row.period}`);
    assert.equal(row.paid, row.amount, `${row.lease}@${row.period}`);
    assert.ok(row.paidAt instanceof Date && !Number.isNaN(row.paidAt.getTime()));
  }
});

test('rent is paid inside the month it covers, on or around the due date', () => {
  for (const row of rows) {
    assert.equal(row.due.slice(0, 7), row.period.slice(0, 7));
    assert.equal(row.paidAt.toISOString().slice(0, 7), row.period.slice(0, 7));
    const day = Number(row.paidAt.toISOString().slice(8, 10));
    assert.ok(day >= 1 && day <= 9, `paid on day ${day}`);
  }
});

test('rent stepped up once, and the older rent is a round figure', () => {
  const didier = forLease('lease-didier');
  const recent = didier.filter((r) => offsetOf(r.period) > -12);
  const older = didier.filter((r) => offsetOf(r.period) <= -12);
  assert.ok(recent.length > 0 && older.length > 0, 'the fixture must span the step');
  for (const r of recent) assert.equal(r.amount, 300_000);
  for (const r of older) {
    assert.ok(r.amount < 300_000, 'the older months cost less');
    assert.equal(r.amount % 10_000, 0, 'a landlord does not raise rent by 24,600');
  }
  // The rule itself, measured rather than transcribed.
  assert.equal(rentForMonth(300_000, -12), Math.round((300_000 * 0.92) / 10_000) * 10_000);
  assert.equal(rentForMonth(300_000, -11), 300_000);
});

test('the same inputs produce the same rows, so a re-run of the seed is a no-op', () => {
  const again = rentHistory(LEASES, TODAY, { idFor: (n) => `id-${n}` });
  assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(rows)));
});

test('the generator refuses to author the current month', () => {
  assert.throws(() => rentHistory(LEASES, TODAY, { newestOffset: 0 }), /newestOffset/);
});

test('the fixture actually exercises the thing under test', () => {
  // A generator that returned [] would pass several assertions above. This is
  // the control that says it did not.
  assert.ok(rows.length >= 40, `only ${rows.length} rows generated`);
  assert.equal(new Set(rows.map((r) => r.lease)).size, 3 + 1, 'didier, aline, esther and olive');
});
