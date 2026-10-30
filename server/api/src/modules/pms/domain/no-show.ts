import { cancellationRefund, type CancellationRefund, type CancellationTier } from '@injishi/contracts';

/**
 * What a no-show refunds (interface real-data, frontdesk leaf).
 *
 * A no-show is a cancellation that happened after the window closed: the guest
 * did not cancel in time, so the money follows the tier the booking locked,
 * read as a guest cancelling after check-in time. That is the `after` percent
 * of `CANCELLATION_TIERS` (nothing on `flexible`, half on `moderate`), decided
 * by `cancellationRefund`, the one function every refund here goes through;
 * nothing new is decided about money.
 *
 * ONE function for the quote and the command. The desk's board shows this
 * before the press (`FrontDeskBoardService`) and `markNoShow` moves exactly
 * this, so the number on the confirm card is the number refunded.
 *
 * The rule is reworded for the desk, which reads it: the platform's sentence
 * says "Cancelled less than …", and nobody cancelled.
 */
export function noShowRefund(input: {
  /** What was captured for the booking, or null when no payment was taken. */
  capturedRwf: number | null;
  tier: CancellationTier | null;
  nonRefundable: boolean;
  /** Hours from now to the stay's start; clamped to "after the window" here. */
  hoursBeforeCheckIn: number;
}): CancellationRefund {
  if (input.capturedRwf == null) {
    return { percent: 0, refundRwf: 0, forfeitRwf: 0, rule: 'No payment was taken for this booking, so nothing moves.' };
  }
  const late = cancellationRefund({
    party: 'guest',
    status: 'confirmed',
    tier: input.tier,
    nonRefundable: input.nonRefundable,
    // What was captured, never a recomputation at today's rate.
    grossRwf: input.capturedRwf,
    // After the window by definition: the guest never arrived.
    hoursBeforeCheckIn: Math.min(-1, input.hoursBeforeCheckIn),
  });
  const tier = (input.tier ?? 'flexible').replace(/_/g, ' ');
  const rule = input.nonRefundable
    ? 'A no-show on the non-refundable rate: nothing is refunded.'
    : `A no-show counts as a cancellation after the ${tier} tier's window: ${late.percent}% refunded.`;
  return { ...late, rule };
}
