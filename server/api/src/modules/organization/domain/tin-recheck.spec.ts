import { describe, expect, it } from 'vitest';

import {
  TIN_RECHECK_CEILING,
  nextTinRecheckAt,
  tinRecheckDue,
  tinRecheckStalled,
} from './tin-recheck';

/**
 * ADR-053, AC-R5: a `pending` RRA check is retried on a backoff and stops at a
 * ceiling. These pin the table itself, because a wrong wait is invisible in
 * production until a business has been left waiting a day it was never meant to.
 */
describe('TIN recheck backoff', () => {
  const t0 = new Date('2026-09-12T08:00:00Z');
  const minutes = (m: number): Date => new Date(t0.getTime() + m * 60_000);

  it.each([
    [1, 5],
    [2, 30],
    [3, 120],
    [4, 360],
    [5, 1440],
  ])('after %i attempt(s) the next is due %i minutes later', (attempts, wait) => {
    expect(nextTinRecheckAt(attempts, t0)?.toISOString()).toBe(
      minutes(wait).toISOString(),
    );
    expect(tinRecheckDue(attempts, t0, minutes(wait - 1))).toBe(false);
    expect(tinRecheckDue(attempts, t0, minutes(wait))).toBe(true);
  });

  it('stops at six attempts and surfaces rather than retrying', () => {
    expect(TIN_RECHECK_CEILING).toBe(6);
    expect(tinRecheckStalled(5)).toBe(false);
    expect(tinRecheckStalled(6)).toBe(true);
    expect(nextTinRecheckAt(6, t0)).toBeNull();
    // Never due again, however long it has waited. A human decides from here.
    expect(tinRecheckDue(6, t0, minutes(60 * 24 * 365))).toBe(false);
  });

  it('re checks straight away a business that reached submitted with no attempt', () => {
    expect(tinRecheckDue(0, null, t0)).toBe(true);
  });
});
