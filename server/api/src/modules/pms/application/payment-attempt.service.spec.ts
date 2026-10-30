import { describe, expect, it, type Mock, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import type { ListingService } from '../../listing/application/listing.service';
import type { GuestOrderingService } from '../../outlets/application/guest-ordering.service';
import type { OrderPaymentService } from '../../outlets/application/order-payment.service';
import type { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import type { PaymentTransactionsRepository } from '../../payments/infrastructure/payment-transactions.repository';
import {
  PaymentUnavailableError,
  type PaymentPort,
  type PaymentReceipt,
} from '../../payments/domain/payment-port';
import type {
  PaymentAttemptRepository,
  PaymentAttemptRow,
} from '../infrastructure/payment-attempt.repository';
import { SoldOutAfterCaptureError, type BookingService } from './booking.service';
import { PaymentAttemptService } from './payment-attempt.service';
import type { RegistrationFees } from '../domain/registration-fees';

/**
 * The wait between "we asked" and "they paid" (ADR-047 D-j).
 *
 * These pin the four things that decide whether a guest gets a room, gets their
 * money back, or is left holding neither — which is the whole risk of putting a
 * payment on a rail that answers later.
 */
describe('PaymentAttemptService', () => {
  const GUEST = '66666666-6666-6666-6666-666666666666';
  const WORKSPACE = '55555555-5555-5555-5555-555555555555';

  const row: PaymentAttemptRow = {
    id: 'attempt-1',
    attemptToken: 'tok-1',
    idempotencyKey: `${WORKSPACE}:booking-capture:tok-1`,
    guestUserId: GUEST,
    workspaceId: WORKSPACE,
    state: 'prompting',
    purpose: 'booking',
    serviceOrderId: null,
    subscriptionInvoiceId: null,
    roomTypeId: '44444444-4444-4444-4444-444444444444',
    checkIn: '2026-11-02',
    checkOut: '2026-11-05',
    guests: 2,
    nonRefundable: false,
    attemptFingerprint: 'abc123',
    amountRwf: 94_500,
    adapterRef: 'mock_escrow_capture_tok-1',
    network: 'mtn_momo',
    payerMasked: '078•••456',
    // Comfortably in the future unless a test says otherwise.
    expiresAt: new Date(Date.now() + 120_000),
    bookingId: null,
    failureReason: null,
    createdAt: new Date(Date.now() - 30_000),
  };

  const settled: PaymentReceipt = {
    adapterRef: row.adapterRef!,
    mode: 'mock',
    replayed: false,
    amountRwf: 94_500,
    currency: 'RWF',
    occurredAt: new Date(),
    settlement: 'settled',
  };

  function build(
    overrides: {
      row?: PaymentAttemptRow | null;
      fetch?: PaymentReceipt | null;
      fetchThrows?: Error;
      roomTypeMissing?: boolean;
      claimWins?: boolean;
      feeOutcome?: 'settled' | 'already_settled' | 'not_payable';
      unsettledFees?: PaymentAttemptRow[];
    } = {},
  ): {
    service: PaymentAttemptService;
    attempts: {
      findForGuest: Mock;
      findByKey: Mock;
      markConfirmed: Mock;
      markEnded: Mock;
      findPrompting: Mock;
      claimConfirmed: Mock;
      markDuplicateFee: Mock;
      findUnsettledFees: Mock;
    };
    compensations: { enqueue: Mock };
    bookings: { writeBooking: Mock; settledForAttempt: Mock };
    orderPayments: { settle: Mock; fail: Mock; attach: Mock };
    payments: { fetchTransaction: Mock };
    transactions: { linkAttempt: Mock; markExpired: Mock; markParked: Mock };
    registrations: { orgOfRegistrationInvoice: Mock; settleFeeFromPayment: Mock };
  } {
    const attempts = {
      findForGuest: vi
        .fn()
        .mockResolvedValue(overrides.row === undefined ? row : overrides.row),
      findByKey: vi.fn().mockResolvedValue(null),
      markConfirmed: vi.fn().mockResolvedValue(undefined),
      // True: this caller's guarded update ended the attempt.
      markEnded: vi.fn().mockResolvedValue(true),
      findPrompting: vi.fn().mockResolvedValue([]),
      record: vi.fn().mockResolvedValue(undefined),
      claimConfirmed: vi.fn().mockResolvedValue(overrides.claimWins ?? true),
      markDuplicateFee: vi.fn().mockResolvedValue(true),
      findUnsettledFees: vi.fn().mockResolvedValue(overrides.unsettledFees ?? []),
    };

    const payments = {
      fetchTransaction: overrides.fetchThrows
        ? vi.fn().mockRejectedValue(overrides.fetchThrows)
        : vi
            .fn()
            .mockResolvedValue(
              overrides.fetch === undefined ? settled : overrides.fetch,
            ),
    };

    const listings = {
      findBookableRoomType: vi.fn().mockResolvedValue(
        overrides.roomTypeMissing
          ? null
          : {
              id: row.roomTypeId,
              workspaceId: WORKSPACE,
              propertyId: 'p1',
              name: 'Standard',
              domain: 'hospitality',
              capacity: 2,
              roomCount: 2,
              nightlyRateRwf: 45_000,
              bookingMode: 'instant_book',
              approvalPolicy: null,
              cancellationTier: 'flexible',
              nonrefundableEligible: false,
              minStay: null,
            },
      ),
    };

    const bookings = {
      writeBooking: vi
        .fn()
        .mockResolvedValue({ id: 'booking-1', reference: 'BK-ABC123' }),
      settledForAttempt: vi
        .fn()
        .mockResolvedValue({ id: 'booking-1', reference: 'BK-ABC123' }),
    };

    const compensations = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const orderPayments = {
      settle: vi.fn().mockResolvedValue({ kind: 'settled', replayed: false, emissionId: null, wake: false }),
      fail: vi.fn().mockResolvedValue(true),
      attach: vi.fn().mockResolvedValue(undefined),
    };
    const guestOrders = { detail: vi.fn() };
    const transactions = {
      linkAttempt: vi.fn().mockResolvedValue(undefined),
      markExpired: vi.fn().mockResolvedValue(undefined),
      markParked: vi.fn().mockResolvedValue(undefined),
    };
    const registrations = {
      orgOfRegistrationInvoice: vi.fn().mockResolvedValue('org-1'),
      settleFeeFromPayment: vi.fn().mockResolvedValue(overrides.feeOutcome ?? 'settled'),
    };

    const service = new PaymentAttemptService(
      attempts as unknown as PaymentAttemptRepository,
      listings as unknown as ListingService,
      bookings as unknown as BookingService,
      compensations as unknown as PaymentCompensationService,
      payments as unknown as PaymentPort,
      orderPayments as unknown as OrderPaymentService,
      guestOrders as unknown as GuestOrderingService,
      transactions as unknown as PaymentTransactionsRepository,
      registrations as unknown as RegistrationFees,
    );

    return { service, attempts, compensations, bookings, orderPayments, payments, transactions, registrations };
  }

  it('refuses an attempt token that is not the caller’s', async () => {
    const { service } = build({ row: null });
    // The repository scopes by guest, so a guessed token finds nothing — and
    // "not yours" and "does not exist" are deliberately the same answer.
    await expect(service.poll('tok-1', GUEST)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('writes the booking when the provider says the money landed', async () => {
    const { service, bookings, attempts } = build();

    const status = await service.poll('tok-1', GUEST);

    expect(status.state).toBe('confirmed');
    expect(bookings.writeBooking).toHaveBeenCalledTimes(1);
    expect(attempts.markConfirmed).toHaveBeenCalledWith('attempt-1', 'booking-1');

    // The stay comes off the ATTEMPT ROW, never from a client: by now the
    // browser may be closed, and this is the path a provider callback takes.
    const written = bookings.writeBooking.mock.calls[0][0];
    expect(written.input.checkIn).toBe('2026-11-02');
    expect(written.input.guests).toBe(2);
    expect(written.idempotencyKey).toBe(row.idempotencyKey);
  });

  it('stays prompting while the customer has not answered', async () => {
    const { service, bookings, compensations } = build({
      fetch: { ...settled, settlement: 'pending' },
    });

    const status = await service.poll('tok-1', GUEST);

    expect(status.state).toBe('prompting');
    expect(bookings.writeBooking).not.toHaveBeenCalled();
    // Still live: nothing is voided while the prompt has time left on it.
    expect(compensations.enqueue).not.toHaveBeenCalled();
  });

  /**
   * The obligation `apps/mobile` states as "unknown is the default, not an
   * error". An outage is not an answer, and treating one as a refusal would
   * tell a guest their payment failed while it was quietly settling.
   */
  it('leaves the attempt alone when the provider cannot be reached', async () => {
    const { service, attempts } = build({
      fetchThrows: new PaymentUnavailableError('gateway down', 'k'),
    });

    const status = await service.poll('tok-1', GUEST);

    expect(status.state).toBe('prompting');
    expect(attempts.markEnded).not.toHaveBeenCalled();
  });

  it('ends and voids a prompt nobody answered in time', async () => {
    const { service, attempts, compensations } = build({
      row: { ...row, expiresAt: new Date(Date.now() - 1_000) },
      fetch: { ...settled, settlement: 'pending' },
    });

    const status = await service.poll('tok-1', GUEST);

    expect(status.state).toBe('expired');
    expect(attempts.markEnded).toHaveBeenCalledWith(
      'attempt-1',
      'expired',
      expect.stringContaining('Nothing has been charged'),
    );

    // The money must not stay taken. The void runs on the capture's derived
    // key, so a repeat is a replay rather than a second reversal.
    const [job] = compensations.enqueue.mock.calls[0];
    expect(job.kind).toBe('void-pending');
    expect(job.originalRef).toBe(row.adapterRef);
  });

  it('refunds rather than books when the room went away mid-approval', async () => {
    const { service, attempts, bookings, compensations } = build({
      roomTypeMissing: true,
    });

    const status = await service.poll('tok-1', GUEST);

    expect(bookings.writeBooking).not.toHaveBeenCalled();
    expect(status.state).toBe('refused');
    expect(attempts.markEnded).toHaveBeenCalledWith(
      'attempt-1',
      'refused',
      expect.stringContaining('refunded in full'),
    );
    expect(compensations.enqueue).toHaveBeenCalledTimes(1);
  });

  it('ends an attempt the provider has no record of', async () => {
    const { service, attempts } = build({ fetch: null });

    const status = await service.poll('tok-1', GUEST);

    expect(status.state).toBe('refused');
    expect(attempts.markEnded).toHaveBeenCalled();
  });

  it('answers an already-finished attempt from its own rows, without re-asking', async () => {
    const { service, bookings, payments } = build({
      row: { ...row, state: 'confirmed', bookingId: 'booking-1' },
    });

    const status = await service.poll('tok-1', GUEST);

    // Safe to poll in a loop: a settled attempt does not re-run the provider
    // call or try to write the booking a second time.
    expect(status.state).toBe('confirmed');
    expect(bookings.writeBooking).not.toHaveBeenCalled();
    expect(payments.fetchTransaction).not.toHaveBeenCalled();
  });

  /* --- Booking audit regressions, 2026-09-13 ------------------------------ */

  it('returns the booking on a REPOLL of a confirmed attempt, not booking: null', async () => {
    const { service, bookings } = build({
      row: { ...row, state: 'confirmed', bookingId: 'booking-1' },
    });

    const status = await service.poll('tok-1', GUEST);

    expect(status.booking?.reference).toBe('BK-ABC123');
    // Read by the capture key and scoped to the guest, like the replay read.
    expect(bookings.settledForAttempt).toHaveBeenCalledWith(row.idempotencyKey, GUEST);
  });

  it('asks the provider BEFORE the clock: approved in time but polled late still books', async () => {
    const { service, bookings, compensations } = build({
      row: { ...row, expiresAt: new Date(Date.now() - 60_000) },
    });

    const status = await service.poll('tok-1', GUEST);

    expect(status.state).toBe('confirmed');
    expect(bookings.writeBooking).toHaveBeenCalledTimes(1);
    // The money that paid for the booking is never voided.
    expect(compensations.enqueue).not.toHaveBeenCalled();
  });

  it('keeps a late poll waiting, not refused, when the provider cannot be reached', async () => {
    const { service, attempts } = build({
      row: { ...row, expiresAt: new Date(Date.now() - 60_000) },
      fetchThrows: new PaymentUnavailableError('gateway down', 'k'),
    });

    expect((await service.poll('tok-1', GUEST)).state).toBe('prompting');
    expect(attempts.markEnded).not.toHaveBeenCalled();
  });

  it('tells the loser of a race they were refunded, and answers instead of throwing', async () => {
    const { service, attempts, bookings, compensations } = build();
    bookings.writeBooking.mockRejectedValue(
      new SoldOutAfterCaptureError('No rooms of that type are available for those dates.'),
    );

    const status = await service.poll('tok-1', GUEST);

    expect(status.state).toBe('refused');
    expect(status.failureReason).toContain('refunded in full');
    expect(attempts.markEnded).toHaveBeenCalledWith('attempt-1', 'refused', expect.stringContaining('refunded in full'));
    // `writeBooking` already refunded on the refund key; a void as well would
    // reverse the same money twice.
    expect(compensations.enqueue).not.toHaveBeenCalled();
  });

  it('queues no void when another caller already ended the attempt', async () => {
    const { service, attempts, compensations } = build({
      row: { ...row, expiresAt: new Date(Date.now() - 1_000) },
      fetch: { ...settled, settlement: 'pending' },
    });
    attempts.markEnded.mockResolvedValue(false);
    attempts.findByKey.mockResolvedValue({ ...row, state: 'expired', failureReason: 'already ended' });

    const status = await service.poll('tok-1', GUEST);

    expect(compensations.enqueue).not.toHaveBeenCalled();
    expect(status.state).toBe('expired');
    expect(status.failureReason).toBe('already ended');
  });

  it('leaves a hold alone while its capture is still being asked for', async () => {
    const { service, attempts, payments } = build({
      row: { ...row, adapterRef: null, createdAt: new Date() },
    });

    expect((await service.poll('tok-1', GUEST)).state).toBe('prompting');
    expect(payments.fetchTransaction).not.toHaveBeenCalled();
    expect(attempts.markEnded).not.toHaveBeenCalled();
  });

  describe('the sweep', () => {
    it('completes a settled prompt nobody is polling (the closed tab)', async () => {
      const { service, attempts, bookings } = build();
      attempts.findPrompting.mockResolvedValue([row]);

      await expect(service.sweep(new Date())).resolves.toBe(1);
      expect(bookings.writeBooking).toHaveBeenCalledTimes(1);
      expect(attempts.markConfirmed).toHaveBeenCalledWith('attempt-1', 'booking-1');
    });

    it('gives a just-expired pending prompt a grace before voiding it', async () => {
      const { service, attempts, compensations } = build({
        fetch: { ...settled, settlement: 'pending' },
      });
      attempts.findPrompting.mockResolvedValue([{ ...row, expiresAt: new Date(Date.now() - 5_000) }]);

      await expect(service.sweep(new Date())).resolves.toBe(0);
      expect(compensations.enqueue).not.toHaveBeenCalled();
    });

    it('voids a pending prompt once the grace is over', async () => {
      const { service, attempts, compensations } = build({
        fetch: { ...settled, settlement: 'pending' },
      });
      attempts.findPrompting.mockResolvedValue([{ ...row, expiresAt: new Date(Date.now() - 120_000) }]);

      await expect(service.sweep(new Date())).resolves.toBe(1);
      expect(compensations.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'void-pending' }));
    });
  });

  it('never reports the payer’s whole number', async () => {
    const { service } = build();
    const status = await service.poll('tok-1', GUEST);
    expect(status.payerMasked).toBe('078•••456');
    expect(JSON.stringify(status)).not.toContain('788123456');
  });

  it('keeps sweeping when one attempt cannot be expired', async () => {
    const { service, attempts, compensations } = build({
      fetch: { ...settled, settlement: 'pending' },
    });
    const overdue = new Date(Date.now() - 120_000);
    attempts.findPrompting.mockResolvedValue([
      { ...row, id: 'a1', expiresAt: overdue },
      { ...row, id: 'a2', expiresAt: overdue },
    ]);
    compensations.enqueue
      .mockRejectedValueOnce(new Error('redis is down'))
      .mockResolvedValue(undefined);

    // Each row is somebody's money in limbo; one bad one must not strand the
    // rest of the batch.
    await expect(service.sweep(new Date())).resolves.toBe(1);
  });

  /**
   * ADR-050 D-n, amended: a pay now order waits on the same table, poll and
   * sweep a booking does, and completion branches on the attempt's purpose.
   */
  describe('a pay now order', () => {
    const ORDER = '77777777-7777-7777-7777-777777777777';
    const orderRow: PaymentAttemptRow = {
      ...row,
      idempotencyKey: `${WORKSPACE}:order-capture:tok-1`,
      purpose: 'service_order',
      serviceOrderId: ORDER,
      roomTypeId: null,
      checkIn: null,
      checkOut: null,
      guests: null,
      amountRwf: 4_720,
    };

    it('settles the order, not a booking, when the money lands', async () => {
      const { service, bookings, orderPayments, attempts } = build({ row: orderRow });
      const status = await service.pollOrder('tok-1', GUEST);

      expect(status.state).toBe('confirmed');
      expect(bookings.writeBooking).not.toHaveBeenCalled();
      expect(orderPayments.settle).toHaveBeenCalledWith(ORDER, {
        method: '06',
        markedByUserId: null,
        paymentAttemptId: orderRow.id,
      });
      expect(attempts.markConfirmed).toHaveBeenCalledWith(orderRow.id, null);
    });

    it('fails the order when nobody answers the prompt in time', async () => {
      const { service, orderPayments } = build({
        row: { ...orderRow, expiresAt: new Date(Date.now() - 1_000) },
        fetch: { ...settled, settlement: 'pending' },
      });
      const status = await service.pollOrder('tok-1', GUEST);

      expect(status.state).toBe('expired');
      expect(orderPayments.fail).toHaveBeenCalledWith(ORDER, expect.any(String));
      expect(orderPayments.settle).not.toHaveBeenCalled();
    });

    it('gives the money back when the order was cancelled while approving', async () => {
      const { service, orderPayments, compensations } = build({ row: orderRow });
      orderPayments.settle.mockResolvedValue({ kind: 'not_pending', status: 'cancelled' });

      const status = await service.pollOrder('tok-1', GUEST);

      expect(status.state).toBe('refused');
      expect(compensations.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'void-pending', originalRef: orderRow.adapterRef }),
      );
    });

    it('leaves the order waiting when the provider cannot be reached', async () => {
      const { service, orderPayments } = build({
        row: orderRow,
        fetchThrows: new PaymentUnavailableError('timeout', orderRow.idempotencyKey),
      });
      const status = await service.pollOrder('tok-1', GUEST);

      expect(status.state).toBe('prompting');
      expect(orderPayments.fail).not.toHaveBeenCalled();
      expect(orderPayments.settle).not.toHaveBeenCalled();
    });

    it('asks the repository for an ORDER attempt, so a booking token finds nothing here', async () => {
      const { service, attempts } = build({ row: null });
      await expect(service.pollOrder('tok-1', GUEST)).rejects.toBeInstanceOf(NotFoundException);
      expect(attempts.findForGuest).toHaveBeenCalledWith('tok-1', GUEST, 'service_order');
    });
  });

  /**
   * The registration fee (073-gtbank-payments AC-6a, AC-9a, AC-16). The fee is
   * a payment attempt like a booking's; what differs is what a settled one
   * completes, and that it is claimed BEFORE the registration is settled.
   */
  describe('registration fee', () => {
    const feeRow: PaymentAttemptRow = {
      ...row,
      purpose: 'registration_fee',
      idempotencyKey: `${WORKSPACE}:registration-fee:tok-fee`,
      attemptToken: 'tok-fee',
      subscriptionInvoiceId: 'invoice-1',
      roomTypeId: null,
      checkIn: null,
      checkOut: null,
      guests: null,
    };

    it('settles the registration once a settled fee is claimed', async () => {
      const { service, attempts, registrations, compensations } = build({ row: feeRow });

      const { status } = await service.pollRegistrationFee('tok-fee', GUEST);

      expect(status.state).toBe('confirmed');
      expect(attempts.claimConfirmed).toHaveBeenCalledWith('attempt-1');
      expect(registrations.orgOfRegistrationInvoice).toHaveBeenCalledWith('invoice-1');
      expect(registrations.settleFeeFromPayment).toHaveBeenCalledWith('org-1');
      expect(compensations.enqueue).not.toHaveBeenCalled();
    });

    it('lets only the caller that claimed the attempt settle the registration', async () => {
      const { service, attempts, registrations } = build({ row: feeRow, claimWins: false });
      attempts.findByKey.mockResolvedValue({ ...feeRow, state: 'confirmed' });

      const { status } = await service.pollRegistrationFee('tok-fee', GUEST);

      // The loser reads the winner's answer and settles nothing, so it can
      // never mistake the registration it watched settle for a second payment.
      expect(status.state).toBe('confirmed');
      expect(registrations.settleFeeFromPayment).not.toHaveBeenCalled();
    });

    it('refunds a fee that paid for an invoice already paid, on its own derived key', async () => {
      const { service, attempts, compensations } = build({ row: feeRow, feeOutcome: 'already_settled' });

      const { status } = await service.pollRegistrationFee('tok-fee', GUEST);

      expect(status.state).toBe('refused');
      expect(status.failureReason).toMatch(/already paid/);
      expect(attempts.markDuplicateFee).toHaveBeenCalledWith('attempt-1', expect.stringMatching(/already paid/));
      const [job] = compensations.enqueue.mock.calls[0];
      expect(job.kind).toBe('refund');
      expect(job.idempotencyKey).toBe(`fee-duplicate:${feeRow.idempotencyKey}`);
      expect(job.idempotencyKey).not.toBe(feeRow.idempotencyKey);
      expect(job.amountRwf).toBe(feeRow.amountRwf);
    });

    it('marks the bank row expired when a fee prompt goes unanswered', async () => {
      const { service, transactions } = build({
        row: { ...feeRow, expiresAt: new Date(Date.now() - 1_000) },
        fetch: { ...settled, settlement: 'pending' },
      });

      const { status } = await service.pollRegistrationFee('tok-fee', GUEST);

      expect(status.state).toBe('expired');
      expect(transactions.markExpired).toHaveBeenCalledWith(feeRow.idempotencyKey);
    });

    it('settles again a fee claimed but interrupted before its registration settled', async () => {
      const claimed = { ...feeRow, state: 'confirmed' as const };
      const { service, registrations } = build({ unsettledFees: [claimed] });

      await service.sweep();

      expect(registrations.settleFeeFromPayment).toHaveBeenCalledWith('org-1');
    });

    it('answers 404 for a token that is not the registrant’s', async () => {
      const { service } = build({ row: null });
      await expect(service.pollRegistrationFee('tok-fee', GUEST)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
