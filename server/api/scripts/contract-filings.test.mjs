import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FILING_WINDOW_DAYS,
  GREEN_HILLS_FILING_PLAN,
  contractFilings,
  filingEntries,
} from './contract-filings.mjs';

const DAY_MS = 864e5;
const NOW = new Date('2026-09-21T09:00:00.000Z');
const days = (d) => d * DAY_MS;

/**
 * The eleven Green Hills leases, signed five days before each tenancy began,
 * which is what both seeds write on the lease row.
 */
const LEASES = Object.fromEntries(
  [
    ['a1', -19], ['a2', -19], ['b1', -19], ['b2', -19], ['c1', -19],
    ['didier', -18], ['aline', -8], ['patrick', -14],
    ['olive', -2], ['jeanpaul', -23], ['esther', -26],
  ].map(([key, monthsAgo]) => [
    key,
    {
      id: `lease-${key}`,
      signedAt: new Date(Date.UTC(2026, 8 + monthsAgo, 1) - 5 * DAY_MS),
    },
  ]),
);

const rows = contractFilings(filingEntries(GREEN_HILLS_FILING_PLAN, LEASES, NOW), {
  idFor: (n) => `filing-${n}`,
});

test('every Green Hills lease carries exactly one contract filing', () => {
  assert.equal(rows.length, Object.keys(LEASES).length);
  const leaseIds = rows.map((r) => r.lease_id);
  assert.equal(new Set(leaseIds).size, leaseIds.length);
  assert.deepEqual(
    [...leaseIds].sort(),
    Object.values(LEASES).map((l) => l.id).sort(),
  );
});

test('the lens opens on all three states, not on one repeated', () => {
  const seen = new Set(rows.map((r) => r.status));
  assert.deepEqual([...seen].sort(), ['failed', 'filed', 'pending']);
  // And the exceptions are exceptions: one of each, the rest filed.
  const count = (s) => rows.filter((r) => r.status === s).length;
  assert.equal(count('pending'), 1);
  assert.equal(count('failed'), 1);
  assert.equal(count('filed'), rows.length - 2);
});

test('the deadline is the clock start plus the window, on every row', () => {
  for (const row of rows) {
    assert.equal(
      row.due_by.getTime() - row.clock_start_at.getTime(),
      days(FILING_WINDOW_DAYS),
      row.lease_id,
    );
  }
  assert.equal(FILING_WINDOW_DAYS, 15, 'F-R10 §6 names fifteen days');
});

test('nothing claims to have been filed after its own deadline', () => {
  for (const row of rows.filter((r) => r.status === 'filed')) {
    assert.ok(row.updated_at <= row.due_by, `${row.lease_id} filed after its deadline`);
    assert.ok(row.updated_at >= row.clock_start_at, `${row.lease_id} filed before it was signed`);
  }
});

test('the refusals fire: a filed row that missed the window is not writable', () => {
  // The negative control for the assertion above. Without this, "no row filed
  // late" could mean the generator simply cannot express one.
  assert.throws(
    () =>
      contractFilings([
        { lease: 'x', clockStartAt: NOW, status: 'filed', filedAfterDays: FILING_WINDOW_DAYS + 1 },
      ]),
    /missed filing/,
  );
  // And one inside the window is writable, so the refusal is about lateness.
  assert.equal(
    contractFilings([
      { lease: 'x', clockStartAt: NOW, status: 'filed', filedAfterDays: FILING_WINDOW_DAYS },
    ])[0].status,
    'filed',
  );
});

test('a failure always says why, and has been tried', () => {
  const failed = rows.filter((r) => r.status === 'failed');
  for (const row of failed) {
    assert.ok((row.failure_reason ?? '').trim().length > 20, 'a reason a landlord can act on');
    assert.ok(row.attempts >= 1);
  }
  assert.throws(
    () => contractFilings([{ lease: 'x', clockStartAt: NOW, status: 'failed' }]),
    /never silently dropped/,
  );
  assert.throws(
    () => contractFilings([{ lease: 'x', clockStartAt: NOW, status: 'failed', failureReason: '   ' }]),
    /never silently dropped/,
  );
});

test('a pending filing carries no failure reason', () => {
  for (const row of rows.filter((r) => r.status === 'pending')) {
    assert.equal(row.failure_reason, null);
  }
  assert.throws(
    () =>
      contractFilings([
        { lease: 'x', clockStartAt: NOW, status: 'pending', failureReason: 'nope' },
      ]),
    /has not failed/,
  );
});

test('the one filing in flight is genuinely in flight, not silently overdue', () => {
  const [pending] = rows.filter((r) => r.status === 'pending');
  assert.ok(pending.due_by > NOW, 'its deadline has not passed');
  assert.ok(pending.clock_start_at <= NOW, 'and its clock has started');
});

test('the failed filing is past its deadline, which is why it needs the landlord', () => {
  const [failed] = rows.filter((r) => r.status === 'failed');
  assert.ok(failed.due_by < NOW);
});

test('no row claims a live filing channel', () => {
  // There is no RRA contract adapter in this repository (F-R10 §11, O-4).
  for (const row of rows) assert.equal(row.adapter_mode, 'mock');
  assert.throws(() => contractFilings([], { adapterMode: 'live' }), /no live filing channel/);
});

test('a lease nothing plans to file is refused rather than skipped', () => {
  const extra = { ...LEASES, stranger: { id: 'lease-stranger', startDate: NOW } };
  assert.throws(() => filingEntries(GREEN_HILLS_FILING_PLAN, extra, NOW), /has no contract filing/);
  const short = { ...LEASES };
  delete short.olive;
  assert.throws(() => filingEntries(GREEN_HILLS_FILING_PLAN, short, NOW), /is not a lease here/);
});

test('a filing dated at signing is dated at the signature, never guessed', () => {
  for (const entry of GREEN_HILLS_FILING_PLAN.filter((e) => e.clockStart.kind === 'atSigning')) {
    const row = rows.find((r) => r.lease_id === LEASES[entry.key].id);
    assert.equal(row.clock_start_at.getTime(), LEASES[entry.key].signedAt.getTime(), entry.key);
  }
});

test('a lease with no signature cannot be filed from one', () => {
  const unsigned = { ...LEASES, didier: { id: 'lease-didier', signedAt: null } };
  assert.throws(() => filingEntries(GREEN_HILLS_FILING_PLAN, unsigned, NOW), /clock starts at signing/);
});

test('an unknown status is refused', () => {
  assert.throws(
    () => contractFilings([{ lease: 'x', clockStartAt: NOW, status: 'submitted' }]),
    /not a filing_status/,
  );
});

test('the clock starts at a real instant or not at all', () => {
  assert.throws(
    () => contractFilings([{ lease: 'x', clockStartAt: '2026-01-01', status: 'pending' }]),
    /clockStartAt must be a Date/,
  );
});
