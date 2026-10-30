import { describe, expect, it, type Mock, vi } from 'vitest';

import type { DisbursementOutcome, PaymentOutcomes } from '../../pay/application/payment-outcomes';
import type { RefundLedgerRepository } from '../infrastructure/refund-ledger.repository';
import type { BookingNotificationsService } from './booking-notifications.service';
import { guestRefundStatus } from './guest-refunds.service';
import { RefundOutcomesHandler } from './refund-outcomes.handler';

/**
 * What a refund's outcome does to a booking and its payer
 * (073-gtbank-payments AC-12, AC-12a, AC-13, AC-18), and the four words a payer
 * reads.
 */
describe('RefundOutcomesHandler', () => {
  function outcome(over: Partial<DisbursementOutcome>): DisbursementOutcome {
    return {
      transactionId: 'd-1',
      idempotencyKey: 'k',
      reference: 'INJREF',
      operation: 'escrow_release_guest',
      status: 'successful',
      workspaceId: 'ws-1',
      bookingId: 'b-1',
      originalTransactionId: 'c-1',
      amountRwf: 100_000,
      failureReason: null,
      payerUserId: 'u-1',
      ...over,
    };
  }

  function build(): {
    handler: RefundOutcomesHandler;
    ledger: { settleRefunded: Mock; reopenRefund: Mock };
    notifications: { notifyRefund: Mock };
    subscribed: Mock;
  } {
    const subscribed = vi.fn();
    const ledger = {
      settleRefunded: vi.fn().mockResolvedValue('refunded_full'),
      reopenRefund: vi.fn().mockResolvedValue(true),
    };
    const notifications = { notifyRefund: vi.fn().mockResolvedValue(undefined) };
    const handler = new RefundOutcomesHandler(
      { onDisbursement: subscribed } as unknown as PaymentOutcomes,
      ledger as unknown as RefundLedgerRepository,
      notifications as unknown as BookingNotificationsService,
    );
    return { handler, ledger, notifications, subscribed };
  }

  it('subscribes to the payments module on start', () => {
    const { handler, subscribed } = build();
    handler.onModuleInit();
    expect(subscribed).toHaveBeenCalledTimes(1);
  });

  it('settles the booking only when the bank paid', async () => {
    const { handler, ledger, notifications } = build();
    await handler.handle(outcome({ status: 'successful' }));
    expect(ledger.settleRefunded).toHaveBeenCalledWith('b-1');
    expect(notifications.notifyRefund).not.toHaveBeenCalled();
  });

  it('asks the payer for details, and tells them a refused or over-limit refund is delayed', async () => {
    const { handler, notifications, ledger } = build();
    await handler.handle(outcome({ status: 'needs_details' }));
    await handler.handle(outcome({ status: 'failed', transactionId: 'd-2' }));
    await handler.handle(outcome({ status: 'over_limit', transactionId: 'd-3' }));
    expect(notifications.notifyRefund.mock.calls).toEqual([
      ['d-1', 'refund_details_needed'],
      ['d-2', 'refund_delayed'],
      ['d-3', 'refund_delayed'],
    ]);
    expect(ledger.settleRefunded).not.toHaveBeenCalled();
  });

  it('owes a refund again when the bank sends it back (AC-18)', async () => {
    const { handler, ledger } = build();
    await handler.handle(outcome({ status: 'reversed' }));
    expect(ledger.reopenRefund).toHaveBeenCalledWith('b-1');
  });

  it('leaves a host release or a payout alone: they are not a guest refund', async () => {
    const { handler, ledger, notifications } = build();
    await handler.handle(outcome({ operation: 'escrow_release_host' }));
    await handler.handle(outcome({ operation: 'payout', status: 'failed' }));
    expect(ledger.settleRefunded).not.toHaveBeenCalled();
    expect(notifications.notifyRefund).not.toHaveBeenCalled();
  });
});

describe('guestRefundStatus (AC-12a)', () => {
  it.each([
    [{ status: 'queued', queueReason: 'awaiting_dispatch' }, 'processing'],
    [{ status: 'queued', queueReason: 'insufficient_funds' }, 'processing'],
    [{ status: 'queued', queueReason: 'provider_unavailable' }, 'processing'],
    [{ status: 'sending', queueReason: null }, 'processing'],
    [{ status: 'pending', queueReason: null }, 'processing'],
    [{ status: 'unknown', queueReason: null }, 'processing'],
    [{ status: 'queued', queueReason: 'payee_details_missing' }, 'needs_details'],
    [{ status: 'queued', queueReason: 'over_limit' }, 'delayed'],
    [{ status: 'failed', queueReason: null }, 'delayed'],
    [{ status: 'reversed', queueReason: null }, 'delayed'],
    [{ status: 'successful', queueReason: null }, 'paid'],
  ])('%j reads %s', (row, word) => {
    expect(guestRefundStatus(row)).toBe(word);
  });
});
