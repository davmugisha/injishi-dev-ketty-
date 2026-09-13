import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { PaymentUnavailableError, type PaymentPort } from '../../payments/domain/payment-port';
import type { BookingRepository, CancellableBooking } from '../infrastructure/booking.repository';
import { BookingCancellationService, hoursUntilCheckIn } from './booking-cancellation.service';
import type { BookingNotificationsService } from './booking-notifications.service';

/**
 * Cancellation and refund tiers (F-B11, ADR-051). The provider is told before
 * anything is recorded, the refund is the tier the booking locked, and a second
 * cancellation is a conflict rather than a second refund.
 */
describe('BookingCancellationService', () => {
  const GUEST = '66666666-6666-6666-6666-666666666666';
  const daysAhead = (days: number): string =>
    new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const booking = (over: Partial<CancellableBooking> = {}): CancellableBooking => ({
    bookingId: '88888888-8888-8888-8888-888888888888',
    reference: 'BK-ABCD-1234',
    workspaceId: '55555555-5555-5555-5555-555555555555',
    status: 'confirmed',
    checkIn: daysAhead(40),
    checkOut: daysAhead(42),
    grossRwf: 100_000,
    nonRefundable: false,
    tier: 'flexible',
    paymentStatus: 'captured',
    checkInTime: '14:00:00',
    escrowId: 'e1',
    escrowStatus: 'held',
    adapterRef: 'mock_escrow_capture_k',
    escrowAmountRwf: 100_000,
    idempotencyKey: 'ws:booking-capture:tok',
    stays: 0,
    ...over,
  });

  function build(
    row: CancellableBooking | null,
    opts: { providerDown?: boolean; recorded?: boolean } = {},
  ): {
    service: BookingCancellationService;
    repo: { findForCancellation: jest.Mock; recordCancellation: jest.Mock };
    payments: { releaseEscrow: jest.Mock; refund: jest.Mock };
    notifications: { notify: jest.Mock };
  } {
    const repo = {
      findForCancellation: jest.fn().mockResolvedValue(row),
      recordCancellation: jest
        .fn()
        .mockResolvedValue(opts.recorded === false ? null : { id: row?.bookingId, reference: row?.reference }),
    };
    const fail = (): Promise<never> => Promise.reject(new PaymentUnavailableError('down', 'k'));
    const payments = {
      releaseEscrow: jest.fn(opts.providerDown ? fail : () => Promise.resolve({})),
      refund: jest.fn(opts.providerDown ? fail : () => Promise.resolve({})),
    };
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const service = new BookingCancellationService(
      repo as unknown as BookingRepository,
      payments as unknown as PaymentPort,
      notifications as unknown as BookingNotificationsService,
    );
    return { service, repo, payments, notifications };
  }

  it('refunds a flexible booking in full, through the provider, before recording it', async () => {
    const { service, repo, payments } = build(booking());
    const order: string[] = [];
    payments.releaseEscrow.mockImplementation(async () => {
      order.push('provider');
      return {};
    });
    repo.recordCancellation.mockImplementation(async () => {
      order.push('ledger');
      return { id: 'b', reference: 'r' };
    });

    const result = await service.cancelByGuest('bk-abcd-1234', GUEST);

    expect(order).toEqual(['provider', 'ledger']);
    expect(result).toMatchObject({ refundRwf: 100_000, forfeitRwf: 0, paymentStatus: 'refunded_full' });
    expect(payments.releaseEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ beneficiary: 'guest', amountRwf: 100_000 }),
    );
  });

  it('refunds half of a moderate booking cancelled inside its window, on a derived key', async () => {
    const { service, payments, repo } = build(booking({ tier: 'moderate', checkIn: daysAhead(2), checkOut: daysAhead(4) }));

    const result = await service.cancelByGuest('BK-ABCD-1234', GUEST);

    expect(result.refundRwf).toBe(50_000);
    expect(payments.refund).toHaveBeenCalledWith(
      expect.objectContaining({ amountRwf: 50_000, idempotencyKey: 'cancel-refund:ws:booking-capture:tok' }),
    );
    expect(repo.recordCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'refunded_partial', refundRwf: 50_000, party: 'guest' }),
    );
  });

  it('forfeits a non-refundable booking and moves no money', async () => {
    const { service, payments, repo } = build(booking({ nonRefundable: true }));

    const result = await service.cancelByGuest('BK-ABCD-1234', GUEST);

    expect(result).toMatchObject({ refundRwf: 0, forfeitRwf: 100_000, paymentStatus: 'forfeited' });
    expect(payments.refund).not.toHaveBeenCalled();
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
    expect(repo.recordCancellation).toHaveBeenCalled();
  });

  it('refunds the guest in full when the host cancels, even on the non-refundable rate', async () => {
    const { service, payments, notifications } = build(booking({ nonRefundable: true, tier: 'firm' }));

    const result = await service.cancelByHost('88888888-8888-8888-8888-888888888888');

    expect(result).toMatchObject({ cancelledBy: 'host', refundRwf: 100_000 });
    expect(payments.releaseEscrow).toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith(expect.any(String), 'cancelled');
    expect(notifications.notify).not.toHaveBeenCalledWith(expect.any(String), 'host_guest_cancelled');
  });

  it('tells the property when a guest cancels', async () => {
    const { service, notifications } = build(booking());
    await service.cancelByGuest('BK-ABCD-1234', GUEST);
    expect(notifications.notify).toHaveBeenCalledWith(expect.any(String), 'host_guest_cancelled');
  });

  it('records nothing when the provider does not confirm the refund', async () => {
    const { service, repo } = build(booking(), { providerDown: true });

    await expect(service.cancelByGuest('BK-ABCD-1234', GUEST)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.recordCancellation).not.toHaveBeenCalled();
  });

  it('refuses a second cancellation as a conflict, without a second refund', async () => {
    const { service, payments } = build(booking({ status: 'cancelled', escrowStatus: 'refunded_full' }));

    await expect(service.cancelByGuest('BK-ABCD-1234', GUEST)).rejects.toBeInstanceOf(ConflictException);
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
  });

  it('refuses a booking the guest has already checked in to', async () => {
    const { service } = build(booking({ stays: 1 }));
    await expect(service.cancelByGuest('BK-ABCD-1234', GUEST)).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers a foreign or malformed reference with the same 404', async () => {
    await expect(build(null).service.cancelByGuest('BK-ABCD-1234', GUEST)).rejects.toBeInstanceOf(NotFoundException);
    const { service, repo } = build(booking());
    await expect(service.quoteForGuest('not a reference', GUEST)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findForCancellation).not.toHaveBeenCalled();
  });

  it('quotes what cancelling would refund, and commits nothing', async () => {
    const { service, repo, payments } = build(booking({ tier: 'limited' }));

    const quote = await service.quoteForGuest('BK-ABCD-1234', GUEST);

    expect(quote).toMatchObject({ cancellable: true, percent: 50, refundRwf: 50_000, refusal: null });
    expect(repo.recordCancellation).not.toHaveBeenCalled();
    expect(payments.refund).not.toHaveBeenCalled();
  });

  it('counts hours to check-in from the property check-in time, in Kigali', () => {
    const now = new Date('2026-10-01T12:00:00Z'); // 14:00 in Kigali
    expect(hoursUntilCheckIn({ checkIn: '2026-10-02', checkInTime: '14:00:00' }, now)).toBe(24);
    expect(hoursUntilCheckIn({ checkIn: '2026-10-02', checkInTime: null }, now)).toBe(24);
    expect(hoursUntilCheckIn({ checkIn: '2026-10-02', checkInTime: '12:00' }, now)).toBe(22);
  });
});
