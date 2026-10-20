import { cancellationRefund } from '@injishi/contracts';

import { noShowRefund } from './no-show';

/**
 * A no-show refunds what a cancellation after the window would, on the tier the
 * booking locked, and the desk reads why in its own words. The board's quote and
 * the command both call this, so pinning it pins the number on the confirm card.
 */
describe('noShowRefund', () => {
  it('is the late cancellation of the locked tier, however early the press', () => {
    for (const tier of ['flexible', 'moderate', 'limited', 'firm'] as const) {
      // A press before the stay's start hour on the arrival day is still after the window.
      const got = noShowRefund({ capturedRwf: 100_000, tier, nonRefundable: false, hoursBeforeCheckIn: 3 });
      const late = cancellationRefund({
        party: 'guest',
        status: 'confirmed',
        tier,
        nonRefundable: false,
        grossRwf: 100_000,
        hoursBeforeCheckIn: -1,
      });
      expect(got).toMatchObject({ percent: late.percent, refundRwf: late.refundRwf, forfeitRwf: late.forfeitRwf });
      expect(got.refundRwf + got.forfeitRwf).toBe(100_000);
    }
  });

  it('keeps half on moderate and names the tier, not a cancellation nobody made', () => {
    const got = noShowRefund({ capturedRwf: 100_000, tier: 'moderate', nonRefundable: false, hoursBeforeCheckIn: -20 });
    expect(got).toMatchObject({ refundRwf: 50_000, forfeitRwf: 50_000 });
    expect(got.rule).toBe("A no-show counts as a cancellation after the moderate tier's window: 50% refunded.");
  });

  it('refunds nothing on the non-refundable rate', () => {
    expect(noShowRefund({ capturedRwf: 80_000, tier: 'flexible', nonRefundable: true, hoursBeforeCheckIn: -5 })).toMatchObject({
      refundRwf: 0,
      forfeitRwf: 80_000,
      rule: 'A no-show on the non-refundable rate: nothing is refunded.',
    });
  });

  it('moves nothing when no payment was taken', () => {
    expect(noShowRefund({ capturedRwf: null, tier: 'moderate', nonRefundable: false, hoursBeforeCheckIn: -5 })).toEqual({
      percent: 0,
      refundRwf: 0,
      forfeitRwf: 0,
      rule: 'No payment was taken for this booking, so nothing moves.',
    });
  });
});
