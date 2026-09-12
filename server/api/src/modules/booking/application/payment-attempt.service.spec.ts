import { NotFoundException } from '@nestjs/common';

import type { ListingService } from '../../listing/application/listing.service';
import type { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import {
  PaymentUnavailableError,
  type PaymentPort,
  type PaymentReceipt,
} from '../../payments/domain/payment-port';
import type {
  PaymentAttemptRepository,
  PaymentAttemptRow,
} from '../infrastructure/payment-attempt.repository';
import type { BookingService } from './booking.service';
import { PaymentAttemptService } from './payment-attempt.service';

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
    } = {},
  ): {
    service: PaymentAttemptService;
    attempts: { findForGuest: jest.Mock; markConfirmed: jest.Mock; markEnded: jest.Mock; findExpired: jest.Mock };
    compensations: { enqueue: jest.Mock };
    bookings: { writeBooking: jest.Mock };
  } {
    const attempts = {
      findForGuest: jest
        .fn()
        .mockResolvedValue(overrides.row === undefined ? row : overrides.row),
      markConfirmed: jest.fn().mockResolvedValue(undefined),
      markEnded: jest.fn().mockResolvedValue(undefined),
      findExpired: jest.fn().mockResolvedValue([]),
      record: jest.fn().mockResolvedValue(undefined),
    };

    const payments = {
      fetchTransaction: overrides.fetchThrows
        ? jest.fn().mockRejectedValue(overrides.fetchThrows)
        : jest
            .fn()
            .mockResolvedValue(
              overrides.fetch === undefined ? settled : overrides.fetch,
            ),
    };

    const listings = {
      findBookableRoomType: jest.fn().mockResolvedValue(
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
      writeBooking: jest
        .fn()
        .mockResolvedValue({ id: 'booking-1', reference: 'BK-ABC123' }),
    };

    const compensations = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const service = new PaymentAttemptService(
      attempts as unknown as PaymentAttemptRepository,
      listings as unknown as ListingService,
      bookings as unknown as BookingService,
      compensations as unknown as PaymentCompensationService,
      payments as unknown as PaymentPort,
    );

    return { service, attempts, compensations, bookings };
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

  it('answers an already-finished attempt from its own row, without re-asking', async () => {
    const { service, bookings } = build({
      row: { ...row, state: 'confirmed', bookingId: 'booking-1' },
    });

    const status = await service.poll('tok-1', GUEST);

    // Safe to poll in a loop: a settled attempt does not re-run the provider
    // call or try to write the booking a second time.
    expect(status.state).toBe('confirmed');
    expect(bookings.writeBooking).not.toHaveBeenCalled();
  });

  it('never reports the payer’s whole number', async () => {
    const { service } = build();
    const status = await service.poll('tok-1', GUEST);
    expect(status.payerMasked).toBe('078•••456');
    expect(JSON.stringify(status)).not.toContain('788123456');
  });

  it('keeps sweeping when one attempt cannot be expired', async () => {
    const { service, attempts, compensations } = build();
    attempts.findExpired.mockResolvedValue([
      { ...row, id: 'a1' },
      { ...row, id: 'a2' },
    ]);
    compensations.enqueue
      .mockRejectedValueOnce(new Error('redis is down'))
      .mockResolvedValue(undefined);

    // Each row is somebody's money in limbo; one bad one must not strand the
    // rest of the batch.
    await expect(service.expireStale(new Date())).resolves.toBe(1);
  });
});
