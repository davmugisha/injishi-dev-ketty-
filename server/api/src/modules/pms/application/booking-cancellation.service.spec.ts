import { describe, expect, it, type Mock, vi } from 'vitest';

import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { PaymentUnavailableError, type PaymentPort } from '../../payments/domain/payment-port';
import type { BookingRepository, CancellableBooking } from '../infrastructure/booking.repository';
import { BookingCancellationService, hoursUntilCheckIn } from './booking-cancellation.service';
import type { BookingNotificationsService } from './booking-notifications.service';
import { everyBranch } from '../../../shared/auth/branch-scope.fixture';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { BookingRefunds } from './booking-refunds';

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
    propertyId: 'prop-1',
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

  function recorded(input: { outcome: string | null; refundRwf: number | null }): {
    id: string;
    reference: string;
    paymentStatus: string | null;
    refundRwf: number | null;
  } {
    return { id: 'b', reference: 'r', paymentStatus: input.outcome, refundRwf: input.refundRwf };
  }

  function build(
    row: CancellableBooking | null,
    opts: {
      providerDown?: boolean;
      recorded?: boolean;
      plan?: { oweTx: Mock; announce: Mock };
      changePayments?: { escrowId: string; amountRwf: number; adapterRef: string | null; workspaceId: string; idempotencyKey: string }[];
    } = {},
  ): {
    service: BookingCancellationService;
    repo: { findForCancellation: Mock; recordCancellation: Mock; recordNoShow: Mock };
    payments: { releaseEscrow: Mock; refund: Mock };
    notifications: { notify: Mock };
    refunds: { plan: Mock };
    changes: { takeChangePayments: Mock };
    compensations: { enqueue: Mock };
  } {
    const repo = {
      findForCancellation: vi.fn().mockResolvedValue(row),
      // The ledger echoes what it was asked to record, as the real one does
      // when no refund is owed (a payment from before the bank record).
      recordCancellation: vi.fn(async (input: { outcome: string; refundRwf: number }) =>
        opts.recorded === false ? null : recorded(input),
      ),
      recordNoShow: vi.fn(async (input: { outcome: string | null; refundRwf: number | null }) =>
        opts.recorded === false ? null : recorded(input),
      ),
    };
    const fail = (): Promise<never> => Promise.reject(new PaymentUnavailableError('down', 'k'));
    const payments = {
      releaseEscrow: vi.fn(opts.providerDown ? fail : () => Promise.resolve({})),
      refund: vi.fn(opts.providerDown ? fail : () => Promise.resolve({})),
    };
    const notifications = { notify: vi.fn().mockResolvedValue(undefined) };
    // 073 AC-13: by default no bank record stands behind these payments, so the
    // provider path runs; `plan` makes the refund owed instead.
    const refunds = { plan: vi.fn().mockResolvedValue(opts.plan ?? null) };
    // MoMo payments of desk changes (0120): none unless a test hands some in.
    const changes = { takeChangePayments: vi.fn().mockResolvedValue(opts.changePayments ?? []) };
    const compensations = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new BookingCancellationService(
      repo as unknown as BookingRepository,
      payments as unknown as PaymentPort,
      notifications as unknown as BookingNotificationsService,
      refunds as unknown as BookingRefunds,
      changes as never,
      compensations as never,
    );
    return { service, repo, payments, notifications, refunds, changes, compensations };
  }

  it('refunds a flexible booking in full, through the provider, before recording it', async () => {
    const { service, repo, payments } = build(booking());
    const order: string[] = [];
    payments.releaseEscrow.mockImplementation(async () => {
      order.push('provider');
      return {};
    });
    repo.recordCancellation.mockImplementation(async (input: { outcome: string; refundRwf: number }) => {
      order.push('ledger');
      return recorded(input);
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

    const result = await service.cancelByHost('88888888-8888-8888-8888-888888888888', {
      workspaceId: '55555555-5555-5555-5555-555555555555',
      branchScope: everyBranch('prop-1'),
    });

    expect(result).toMatchObject({ cancelledBy: 'host', refundRwf: 100_000 });
    expect(payments.releaseEscrow).toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith(expect.any(String), 'cancelled');
    expect(notifications.notify).not.toHaveBeenCalledWith(expect.any(String), 'host_guest_cancelled');
  });

  it('answers 404 and moves no money when the booking is in another workspace', async () => {
    const { service, payments } = build(booking());

    await expect(
      service.cancelByHost('88888888-8888-8888-8888-888888888888', {
        workspaceId: '66666666-6666-6666-6666-666666666666',
        branchScope: everyBranch('prop-1'),
      }),
    ).rejects.toThrow(NotFoundException);
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
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

  const desk = (): Pick<ScopedWorkspace, 'workspaceId' | 'branchScope'> => ({
    workspaceId: '55555555-5555-5555-5555-555555555555',
    branchScope: everyBranch('prop-1'),
  });

  it('uses the guest tier when the desk cancels at the guest request and keeps its reason', async () => {
    const { service, repo, payments } = build(booking({ tier: 'moderate', checkIn: daysAhead(2) }));
    const result = await service.cancelAtGuestRequest('b', desk(), 'Guest changed plans');
    expect(result).toMatchObject({ cancelledBy: 'guest', refundRwf: 50_000 });
    expect(payments.refund).toHaveBeenCalledWith(expect.objectContaining({ amountRwf: 50_000 }));
    expect(repo.recordCancellation).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Guest changed plans' }));
  });

  it('cancels now with the refund owed in the same write, and never calls the provider (073 AC-13)', async () => {
    const plan = { oweTx: vi.fn(), announce: vi.fn().mockResolvedValue(undefined) };
    const { service, repo, payments, refunds } = build(booking(), { plan });
    repo.recordCancellation.mockResolvedValue({ id: 'b', reference: 'r', paymentStatus: 'refund_pending', refundRwf: 100_000 });

    const result = await service.cancelByGuest('bk-abcd-1234', GUEST);

    expect(payments.releaseEscrow).not.toHaveBeenCalled();
    expect(payments.refund).not.toHaveBeenCalled();
    expect(refunds.plan).toHaveBeenCalledWith(expect.objectContaining({ operation: 'escrow_release_guest' }));
    expect(repo.recordCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ owe: plan.oweTx, refundRwf: 100_000, outcome: 'refunded_full' }),
    );
    expect(plan.announce).toHaveBeenCalled();
    expect(result).toMatchObject({ paymentStatus: 'refund_pending', escrowStatus: 'refund_pending', refundRwf: 100_000 });
  });

  it('refunds a no-show on the locked late tier before recording the operator and reason', async () => {
    const { service, repo, payments } = build(booking({ tier: 'moderate', checkIn: daysAhead(-1) }));
    const order: string[] = [];
    payments.refund.mockImplementation(async () => { order.push('provider'); return {}; });
    repo.recordNoShow.mockImplementation(async (input: { outcome: string | null; refundRwf: number | null }) => {
      order.push('ledger');
      return recorded(input);
    });

    const result = await service.markNoShow('b', desk(), { byUserId: GUEST, reason: 'Did not arrive' });

    expect(result).toMatchObject({ refundRwf: 50_000, forfeitRwf: 50_000 });
    expect(order).toEqual(['provider', 'ledger']);
    expect(payments.refund).toHaveBeenCalledWith(expect.objectContaining({
      amountRwf: 50_000, idempotencyKey: 'cancel-refund:ws:booking-capture:tok',
    }));
    expect(repo.recordNoShow).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'refunded_partial', refundRwf: 50_000, byUserId: GUEST, reason: 'Did not arrive',
    }));
  });

  it('records a no-show with no payment without inventing a money outcome', async () => {
    const { service, repo, payments } = build(booking({
      checkIn: daysAhead(-1), escrowId: null, escrowStatus: null, escrowAmountRwf: null, paymentStatus: null,
    }));
    expect(await service.markNoShow('b', desk(), { byUserId: GUEST, reason: null }))
      .toMatchObject({ refundRwf: 0, forfeitRwf: 0 });
    expect(repo.recordNoShow).toHaveBeenCalledWith(expect.objectContaining({ outcome: null, refundRwf: null }));
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
    expect(payments.refund).not.toHaveBeenCalled();
  });

  it('uses one provider refund key when cancellation and no-show compete for the same booking', async () => {
    const { service, payments } = build(booking({ tier: 'moderate', checkIn: daysAhead(-1) }));
    await service.markNoShow('b', desk(), { byUserId: GUEST, reason: null });
    await service.cancelAtGuestRequest('b', desk(), 'Guest called');
    const keys = payments.refund.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
  });

  it('refuses future, arrived, pending and already recorded no-shows before moving money', async () => {
    for (const over of [
      { checkIn: daysAhead(2) },
      { checkIn: daysAhead(-1), stays: 1 },
      { checkIn: daysAhead(-1), status: 'pending_approval' as const },
      { checkIn: daysAhead(-1), status: 'no_show' as const },
    ]) {
      const { service, repo, payments } = build(booking(over));
      await expect(service.markNoShow('b', desk(), { byUserId: GUEST, reason: null }))
        .rejects.toBeInstanceOf(ConflictException);
      expect(repo.recordNoShow).not.toHaveBeenCalled();
      expect(payments.releaseEscrow).not.toHaveBeenCalled();
      expect(payments.refund).not.toHaveBeenCalled();
    }
  });

  it('does not record a no-show if its refund cannot be confirmed', async () => {
    const { service, repo } = build(booking({ tier: 'moderate', checkIn: daysAhead(-1) }), { providerDown: true });
    await expect(service.markNoShow('b', desk(), { byUserId: GUEST, reason: null }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.recordNoShow).not.toHaveBeenCalled();
  });

  it('answers 404 for a no-show outside the covered branch and moves no money', async () => {
    const { service, repo, payments } = build(booking({ checkIn: daysAhead(-1) }));
    await expect(service.markNoShow('b', { ...desk(), branchScope: everyBranch('prop-2') }, { byUserId: GUEST, reason: null }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repo.recordNoShow).not.toHaveBeenCalled();
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
    expect(payments.refund).not.toHaveBeenCalled();
  });
  it('refunds a change paid by MoMo in full when the booking is cancelled (0120)', async () => {
    const { service, compensations } = build(booking(), {
      changePayments: [
        { escrowId: 'e-2', amountRwf: 60_000, adapterRef: 'momo-2', workspaceId: 'ws-1', idempotencyKey: 'ws-1:booking-change:c-1:t-1' },
      ],
    });
    await service.cancelByGuest('bk-abcd-1234', GUEST);
    expect(compensations.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'refund',
        amountRwf: 60_000,
        originalRef: 'momo-2',
        idempotencyKey: 'refund:ws-1:booking-change:c-1:t-1',
      }),
    );
  });
});
