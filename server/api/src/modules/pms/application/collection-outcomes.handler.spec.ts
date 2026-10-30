import { describe, expect, it, type Mock, vi } from 'vitest';

import type { CollectionOutcome, PaymentOutcomes } from '../../payments/application/payment-outcomes';
import type { RefundsOwedService } from '../../payments/application/refunds-owed.service';
import type { RegistrationFees } from '../domain/registration-fees';
import type { BookingRepository } from '../infrastructure/booking.repository';
import type { PaymentAttemptRepository } from '../infrastructure/payment-attempt.repository';
import type { BookingNotificationsService } from './booking-notifications.service';
import { CollectionOutcomesHandler } from './collection-outcomes.handler';

/** What two people deciding about a collection does to what it paid for (073-gtbank-payments AC-20, AC-21). */
describe('CollectionOutcomesHandler', () => {
  const confirmed: CollectionOutcome = {
    transactionId: 't-1',
    idempotencyKey: 'ws-1:booking-capture:tok',
    reference: 'INJREF',
    operation: 'escrow_capture',
    status: 'confirmed_received',
    workspaceId: 'ws-1',
    amountRwf: 100_000,
  };

  function build(attempt: Record<string, unknown> | null, opts: { claimed?: boolean } = {}): {
    handler: CollectionOutcomesHandler;
    refunds: { prepareCollection: Mock; owe: Mock };
    bookings: { escrowExistsForCaptureKey: Mock; cancelForReversal: Mock };
    notifications: { notify: Mock };
    registrations: { reopenFeeAfterReversal: Mock };
  } {
    const refunds = {
      prepareCollection: vi.fn().mockResolvedValue({ collection: { id: 't-1' } }),
      owe: vi.fn().mockResolvedValue({ row: { id: 'd-1' }, created: true }),
    };
    const bookings = {
      escrowExistsForCaptureKey: vi.fn().mockResolvedValue(opts.claimed ?? false),
      cancelForReversal: vi.fn().mockResolvedValue({ id: 'b-1', reference: 'BK-AAAA-BBBB' }),
    };
    const notifications = { notify: vi.fn().mockResolvedValue(undefined) };
    const registrations = { reopenFeeAfterReversal: vi.fn().mockResolvedValue(true) };
    const handler = new CollectionOutcomesHandler(
      { onCollection: vi.fn() } as unknown as PaymentOutcomes,
      { findByKey: vi.fn().mockResolvedValue(attempt) } as unknown as PaymentAttemptRepository,
      bookings as unknown as BookingRepository,
      refunds as unknown as RefundsOwedService,
      notifications as unknown as BookingNotificationsService,
      registrations as unknown as RegistrationFees,
    );
    return { handler, refunds, bookings, notifications, registrations };
  }

  it('owes the money back in full when the attempt it paid for already ended', async () => {
    const { handler, refunds } = build({ purpose: 'booking', state: 'refused', adapterRef: null });
    await handler.handle(confirmed);
    expect(refunds.owe).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: 'refund:ws-1:booking-capture:tok', amountRwf: 100_000, operation: 'refund' }),
    );
  });

  it('owes the money back when the capture failed before any attempt was written and no booking stands on it', async () => {
    const { handler, refunds, bookings } = build(null);
    await handler.handle(confirmed);
    expect(bookings.escrowExistsForCaptureKey).toHaveBeenCalledWith('ws-1:booking-capture:tok');
    expect(refunds.owe).toHaveBeenCalledTimes(1);
  });

  it('leaves a waiting attempt with a provider reference to its poll and the sweep', async () => {
    const { handler, refunds } = build({ purpose: 'booking', state: 'prompting', adapterRef: 'mock_escrow_capture_x' });
    await handler.handle(confirmed);
    expect(refunds.owe).not.toHaveBeenCalled();
  });

  it('owes nothing when a booking already stands on the money', async () => {
    const { handler, refunds } = build({ purpose: 'booking', state: 'refused', adapterRef: 'x' }, { claimed: true });
    await handler.handle(confirmed);
    expect(refunds.owe).not.toHaveBeenCalled();
  });

  it('cancels a booking a reversal paid for and tells the property', async () => {
    const { handler, bookings, notifications } = build({ purpose: 'booking', state: 'confirmed', bookingId: 'b-1' });
    await handler.handle({ ...confirmed, status: 'cancel_service' });
    expect(bookings.cancelForReversal).toHaveBeenCalledWith('b-1');
    expect(notifications.notify).toHaveBeenCalledWith('b-1', 'host_payment_reversed');
  });

  it('reopens a registration fee a reversal paid for', async () => {
    const { handler, registrations } = build({ purpose: 'registration_fee', state: 'confirmed', subscriptionInvoiceId: 'inv-1' });
    await handler.handle({ ...confirmed, status: 'cancel_service' });
    expect(registrations.reopenFeeAfterReversal).toHaveBeenCalledWith('inv-1');
  });
});
