import { BadRequestException, ConflictException } from '@nestjs/common';

import type {
  BookableRoomType,
  ListingService,
} from '../../listing/application/listing.service';
import {
  PaymentDeclinedError,
  PaymentUnavailableError,
  type PaymentPort,
  type PaymentReceipt,
} from '../../payments/domain/payment-port';
import { MockPaymentAdapter } from '../../payments/infrastructure/mock-payment.adapter';
import { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import {
  BookingRepository,
  DuplicateAttemptError,
  NoAvailabilityError,
  type SettledAttempt,
} from '../infrastructure/booking.repository';
import { BookingService } from './booking.service';
import { BookingNotificationsService } from './booking-notifications.service';
import { PaymentAttemptService } from './payment-attempt.service';
import type { EbmSaleTrigger } from '../../ebm/application/ebm-sale-trigger.service';

/**
 * Unit scope: the money ORDERING (ADR-020 A1) around a mocked repository and a
 * mocked seam. This is the part that is easy to get wrong and impossible to see
 * once it is: whether anyone was charged, in what order, and whether the money
 * came back when the booking did not.
 *
 * The transaction itself — the row lock, the authoritative count — is the
 * repository's and needs a DB-backed test (no test-DB harness yet).
 */
describe('BookingService money ordering', () => {
  const ROOM_TYPE_ID = '44444444-4444-4444-4444-444444444444';
  const WORKSPACE_ID = '55555555-5555-5555-5555-555555555555';
  const GUEST_ID = '66666666-6666-6666-6666-666666666666';

  /** Far enough ahead that the "check-in cannot be in the past" rule never fires. */
  const CHECK_IN = futureDay(30);
  const CHECK_OUT = futureDay(32);

  function futureDay(daysAhead: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  }

  const roomType: BookableRoomType = {
    id: ROOM_TYPE_ID,
    propertyId: '77777777-7777-7777-7777-777777777777',
    workspaceId: WORKSPACE_ID,
    name: 'Standard Double',
    domain: 'hospitality',
    capacity: 2,
    roomCount: 2,
    nightlyRateRwf: 45_000,
    bookingMode: 'instant_book',
    approvalPolicy: null,
    cancellationTier: 'flexible',
    nonrefundableEligible: false,
    // ARI (ADR-047 wave E). Null is "the host set none", which every consumer
    // reads as one night rather than inventing a longer minimum.
    minStay: null,
  };

  const receipt: PaymentReceipt = {
    adapterRef: 'mock_escrow_capture_key',
    mode: 'mock',
    replayed: false,
    amountRwf: 94_500,
    currency: 'RWF',
    occurredAt: new Date('2026-08-29T00:00:00Z'),
    settlement: 'settled',
  };

  /**
   * The doubles, typed so the assertions can read `.mock.calls` off them.
   * `jest.Mock` rather than the real interfaces: what these tests check is what
   * was called, in what order, with which key.
   */
  interface Harness {
    service: BookingService;
    ebm: { saleConfirmed: jest.Mock };
    repo: {
      create: jest.Mock;
      findByAttemptKey: jest.Mock;
    };
    payments: {
      mode: 'mock';
      captureEscrow: jest.Mock;
      releaseEscrow: jest.Mock;
      refund: jest.Mock;
      voidPending: jest.Mock;
      payout: jest.Mock;
      chargeRecurring: jest.Mock;
      chargeOneTimeFee: jest.Mock;
      fetchTransaction: jest.Mock;
    };
    listings: { findBookableRoomType: jest.Mock };
    compensations: { enqueue: jest.Mock };
    attempts: {
      claimHold: jest.Mock;
      attachCapture: jest.Mock;
      releaseHold: jest.Mock;
      markBooked: jest.Mock;
      markRefunded: jest.Mock;
      statusOf: jest.Mock;
    };
    order: string[];
  }

  /** The hold: claimed before any capture, released when no money moved. */
  function holdDouble(soldOut: boolean, order: string[]): Harness['attempts'] {
    const hold = { id: 'hold-1', attemptToken: 'tok', adapterRef: null };
    return {
      claimHold: jest.fn(async () => {
        order.push('hold');
        return soldOut ? { kind: 'sold_out' } : { kind: 'held', row: hold };
      }),
      attachCapture: jest.fn(async (row: object, r: PaymentReceipt) => ({ ...row, adapterRef: r.adapterRef })),
      releaseHold: jest.fn().mockResolvedValue(undefined),
      markBooked: jest.fn().mockResolvedValue(undefined),
      markRefunded: jest.fn().mockResolvedValue(undefined),
      statusOf: jest.fn(() => ({ state: 'prompting' })),
    };
  }

  function build(overrides: {
    soldOut?: boolean;
    createRejects?: Error;
    captureRejects?: Error;
    refundRejects?: Error;
    captureReceipt?: PaymentReceipt;
    settledAttempt?: SettledAttempt | null;
    createdStatus?: 'confirmed' | 'pending_approval';
  } = {}): Harness {
    const order: string[] = [];
    const payments = {
      mode: 'mock' as const,
      captureEscrow: overrides.captureRejects
        ? jest.fn().mockRejectedValue(overrides.captureRejects)
        : jest.fn().mockResolvedValue(overrides.captureReceipt ?? receipt),
      releaseEscrow: jest.fn().mockResolvedValue(receipt),
      refund: overrides.refundRejects
        ? jest.fn().mockRejectedValue(overrides.refundRejects)
        : jest.fn().mockResolvedValue({ ...receipt, replayed: true }),
      voidPending: jest.fn().mockResolvedValue(receipt),
      payout: jest.fn(),
      chargeRecurring: jest.fn(),
      chargeOneTimeFee: jest.fn(),
      fetchTransaction: jest.fn().mockResolvedValue(null),
    };

    const repo = {
      findByAttemptKey: jest
        .fn()
        .mockResolvedValue(overrides.settledAttempt ?? null),
      create: overrides.createRejects
        ? jest.fn().mockRejectedValue(overrides.createRejects)
        : jest.fn().mockResolvedValue({
            id: '88888888-8888-8888-8888-888888888888',
            reference: 'BK-ABC123',
            status: overrides.createdStatus ?? 'confirmed',
            paymentStatus: 'captured',
            escrowStatus: 'held',
            approvalExpiresAt: null,
          }),
    };

    const listings = {
      findBookableRoomType: jest.fn().mockResolvedValue(roomType),
    };

    const compensations = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
    };

    const ebm = { saleConfirmed: jest.fn().mockResolvedValue(undefined) };

    // ADR-047 D-j: where a pending capture goes. A recording double, so a test
    // can assert the wait was BEGUN rather than the charge voided.
    const attempts = holdDouble(overrides.soldOut ?? false, order);
    payments.captureEscrow.mockImplementation(async (...args: unknown[]) => {
      order.push('capture');
      if (overrides.captureRejects) throw overrides.captureRejects;
      void args;
      return overrides.captureReceipt ?? receipt;
    });
    const service = new BookingService(
      repo as unknown as BookingRepository,
      listings as unknown as ListingService,
      payments as unknown as PaymentPort,
      compensations as unknown as PaymentCompensationService,
      ebm as unknown as EbmSaleTrigger,
      // ADR-047: the guest is told what happened. A recording double rather
      // than a no-op, so a test can assert WHICH event was raised.
      { notify: jest.fn().mockResolvedValue(undefined) } as unknown as BookingNotificationsService,
      // ADR-047 D-j: where a pending capture goes. These tests are about the
      // money ORDERING and every one of them settles inside the request, so
      // this is never reached — it is here so the graph is complete.
      attempts as unknown as PaymentAttemptService,
    );

    return { service, ebm, repo, payments, listings, compensations, attempts, order };
  }

  /**
   * An MTN number on the MTN rail, so the instrument check passes and each test
   * below exercises the thing it is actually about (ADR-047). The instrument is
   * required on the wire: a booking that does not say who to charge is not a
   * booking anyone can honour.
   */
  const INSTRUMENT = {
    kind: 'mobile_money',
    network: 'mtn_momo',
    msisdn: '788123456',
  } as const;

  /**
   * The booking out of a `create` that settled inside the request.
   *
   * `create` answers a union since ADR-047 D-j — a card settles now, a mobile
   * money prompt does not — so a test that wants the reservation has to say
   * so. This THROWS rather than returning undefined when the outcome was a
   * prompt, so a test can never silently assert against nothing.
   */
  function bookingOf(
    outcome: Awaited<ReturnType<BookingService['create']>>,
  ): Extract<
    Awaited<ReturnType<BookingService['create']>>,
    { status: 'confirmed' }
  >['booking'] {
    if (outcome.status !== 'confirmed') {
      throw new Error(`expected a confirmed booking, got "${outcome.status}"`);
    }
    return outcome.booking;
  }

  const input = {
    roomTypeId: ROOM_TYPE_ID,
    checkIn: CHECK_IN,
    checkOut: CHECK_OUT,
    guests: 2,
    nonRefundable: false,
    instrument: INSTRUMENT,
  };

  it('captures before it writes, and hands the receipt to the transaction', async () => {
    const { service, repo, payments } = build();

    const result = await service.create(input, GUEST_ID);

    expect(payments.captureEscrow).toHaveBeenCalledTimes(1);
    const written = repo.create.mock.calls[0][0];
    expect(written.receipt).toBe(receipt);
    // The escrow row records the adapter that took the money, not a literal.
    expect(written.receipt.mode).toBe('mock');
    expect(written.idempotencyKey).toBe(
      payments.captureEscrow.mock.calls[0][0].idempotencyKey,
    );
    expect(bookingOf(result).reference).toBe('BK-ABC123');
  });

  it('charges the amount the server computed, never one the client sent', async () => {
    const { service, payments } = build();

    await service.create(input, GUEST_ID);

    // 45,000 x 2 nights = 90,000, plus the 5% guest service fee.
    expect(payments.captureEscrow.mock.calls[0][0].amountRwf).toBe(94_500);
  });

  /**
   * F-B13 / ADR-041: an instant-book booking is a sale the moment it is
   * written, so it enters the RRA pipeline then. A request-to-book booking is
   * captured but not yet a sale — the host may decline — so it does not.
   */
  it('records an instant-book booking as a sale for RRA, and a pending request not yet', async () => {
    const instant = build();
    const result = await instant.service.create(input, GUEST_ID);
    expect(instant.ebm.saleConfirmed).toHaveBeenCalledWith(bookingOf(result).id);

    const request = build({ createdStatus: 'pending_approval' });
    await request.service.create(input, GUEST_ID);
    expect(request.ebm.saleConfirmed).not.toHaveBeenCalled();
  });

  it('records nothing for RRA when the booking write fails', async () => {
    const { service, ebm } = build({ createRejects: new Error('database is on fire') });
    await expect(service.create(input, GUEST_ID)).rejects.toThrow();
    expect(ebm.saleConfirmed).not.toHaveBeenCalled();
  });

  /** AC-6: nobody is charged for a room that was already gone. */
  it('refuses a sold-out stay without attempting a capture', async () => {
    const { service, payments, repo } = build({ soldOut: true });

    await expect(service.create(input, GUEST_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(payments.captureEscrow).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  /**
   * AC-5, and the reason the ordering was written down at all: the money is out
   * there and the booking is not.
   */
  it('refunds on its own derived key when the booking write fails, then re-raises', async () => {
    const { service, payments } = build({
      createRejects: new Error('database is on fire'),
    });

    await expect(service.create(input, GUEST_ID)).rejects.toThrow(
      'database is on fire',
    );

    expect(payments.refund).toHaveBeenCalledTimes(1);
    const refund = payments.refund.mock.calls[0][0];
    const capture = payments.captureEscrow.mock.calls[0][0];

    // DERIVED from the capture's key, not equal to it. This assertion used to
    // read `toBe`, which is how the shipped bug survived review: an equal key
    // lets an adapter answer the refund with the capture it should reverse.
    expect(refund.idempotencyKey).not.toBe(capture.idempotencyKey);
    expect(refund.idempotencyKey).toContain(capture.idempotencyKey);

    // Derived rather than random, so retrying the refund replays THIS refund
    // instead of paying out a second time.
    expect(refund.idempotencyKey).toBe(`refund:${capture.idempotencyKey}`);
    expect(refund.originalRef).toBe(receipt.adapterRef);
    expect(refund.amountRwf).toBe(receipt.amountRwf);
  });

  it('refunds and answers 409 when the last unit goes between the hold and the lock', async () => {
    const { service, payments, attempts } = build({
      createRejects: new NoAvailabilityError(),
    });

    await expect(service.create(input, GUEST_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(payments.refund).toHaveBeenCalledTimes(1);
    // The hold records that the guest was refunded, rather than spinning.
    expect(attempts.markRefunded).toHaveBeenCalledTimes(1);
  });

  /* --- The inventory hold (booking audit, 2026-09-13) ----------------------- */

  it('holds a unit BEFORE the capture, so the last room cannot be charged twice', async () => {
    const { service, order } = build();

    await service.create(input, GUEST_ID);

    expect(order.slice(0, 2)).toEqual(['hold', 'capture']);
  });

  it('gives the unit back when the payment is declined', async () => {
    const { service, attempts } = build({
      captureRejects: new PaymentDeclinedError('insufficient funds', 'k'),
    });

    await expect(service.create(input, GUEST_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(attempts.releaseHold).toHaveBeenCalledTimes(1);
    expect(attempts.attachCapture).not.toHaveBeenCalled();
  });

  it('marks the hold booked when a card settles inside the request', async () => {
    const { service, attempts } = build({
      captureReceipt: receipt,
    });

    const result = await service.create(input, GUEST_ID);

    expect(attempts.markBooked).toHaveBeenCalledWith(
      expect.objectContaining({ adapterRef: receipt.adapterRef }),
      bookingOf(result).id,
    );
  });

  /**
   * A failed compensation must not replace the real reason the booking failed.
   * The guest needs to know their booking did not happen; the stuck money is a
   * logged operator problem (ADR-020 A3).
   */
  /**
   * Against the REAL adapter, not a jest double.
   *
   * This is the test that was missing, and its absence hid a shipped bug. Every
   * other test here asserts `payments.refund` was CALLED, which a mock happily
   * confirms whatever the adapter would really have done. The adapter keyed its
   * memory on the idempotency key alone, and the service handed `refund` the
   * capture's own key, so the adapter answered the refund with the capture and
   * reported a replay. No money moved back. The mocks all passed.
   *
   * So this one wires the actual `MockPaymentAdapter` in and checks the thing
   * that matters: after a failed booking write, the refund is a SEPARATE
   * settlement from the capture.
   */
  it('really reverses the capture, against the actual adapter', async () => {
    const adapter = new MockPaymentAdapter();
    const captureSpy = jest.spyOn(adapter, 'captureEscrow');
    const refundSpy = jest.spyOn(adapter, 'refund');

    const repo = {
      findByAttemptKey: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue(new Error('database is on fire')),
    };
    const listings = { findBookableRoomType: jest.fn().mockResolvedValue(roomType) };
    const compensations = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BookingService(
      repo as unknown as BookingRepository,
      listings as unknown as ListingService,
      adapter,
      compensations as unknown as PaymentCompensationService,
      { saleConfirmed: jest.fn() } as unknown as EbmSaleTrigger,
      // ADR-047: the guest is told what happened. A recording double rather
      // than a no-op, so a test can assert WHICH event was raised.
      { notify: jest.fn().mockResolvedValue(undefined) } as unknown as BookingNotificationsService,
      // ADR-047 D-j: where a pending capture goes. These tests are about the
      // money ORDERING and every one of them settles inside the request, so
      // this is never reached — it is here so the graph is complete.
      holdDouble(false, []) as unknown as PaymentAttemptService,
    );

    /*
     * A CARD, deliberately, and not the MTN number the other tests use.
     *
     * This test is about the compensating refund AFTER the money has landed and
     * the write has failed, so the capture has to settle inside the request. A
     * mobile money capture against the real adapter now comes back `pending`
     * (ADR-047 D-j) and returns a prompt to wait on, which never reaches the
     * compensating path — the path this test exists to protect.
     */
    await expect(
      service.create(
        { ...input, instrument: { kind: 'card', token: 'tok_test' } },
        GUEST_ID,
      ),
    ).rejects.toThrow('database is on fire');

    const captured = await captureSpy.mock.results[0].value;
    const refunded = await refundSpy.mock.results[0].value;

    // The refund is its own settlement, on its own key, not the capture handed
    // back. `replayed: true` here would mean the money never came home.
    expect(refunded.replayed).toBe(false);
    expect(refunded.adapterRef).not.toBe(captured.adapterRef);
    expect(refundSpy.mock.calls[0][0].idempotencyKey).not.toBe(
      captureSpy.mock.calls[0][0].idempotencyKey,
    );
    expect(refundSpy.mock.calls[0][0].originalRef).toBe(captured.adapterRef);
  });

  it('still reports the original failure when the compensating refund also fails', async () => {
    const { service } = build({
      createRejects: new Error('database is on fire'),
      refundRejects: new Error('refund endpoint down'),
    });

    await expect(service.create(input, GUEST_ID)).rejects.toThrow(
      'database is on fire',
    );
  });

  it('turns a decline into a 400 and writes nothing', async () => {
    const { service, repo } = build({
      captureRejects: new PaymentDeclinedError('insufficient funds', 'k'),
    });

    await expect(service.create(input, GUEST_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  /**
   * An unreachable gateway must NOT read as a decline. Telling someone their
   * payment was refused when the provider merely timed out sends them to their
   * bank over nothing.
   */
  it('turns an unreachable provider into a 503, not a decline', async () => {
    const { service } = build({
      captureRejects: new PaymentUnavailableError('timeout', 'k'),
    });

    await expect(service.create(input, GUEST_ID)).rejects.toMatchObject({
      status: 503,
    });
  });

  it('never offers the non-refundable rate where the room type is not eligible', async () => {
    const { service, payments } = build();

    const result = await service.create(
      { ...input, nonRefundable: true },
      GUEST_ID,
    );

    expect(bookingOf(result).nonRefundable).toBe(false);
    // And the discount is therefore not applied to what is charged.
    expect(payments.captureEscrow.mock.calls[0][0].amountRwf).toBe(94_500);
  });
  // --- The settlement branch (ADR-020 D-b, AC-4, AC-26) ---------------------

  /**
   * `settled` and `accepted` are not the same word. Every Rwandan mobile money
   * rail answers a capture by pushing a prompt to a handset, so a receipt that
   * says `pending` means a person has not answered yet. Booking a room on that
   * is handing someone a reservation backed by nothing.
   *
   * ADR-020 D-b is UNCHANGED and this still proves it: no booking is written.
   * What changed (ADR-047 D-j) is the ANSWER. This used to throw a 402 and tell
   * the guest to press the button again — a person polling a payment provider
   * by hand — on the screen where their money is. Now the wait is a durable
   * thing they can watch.
   */
  it('writes no booking on an unsettled capture, and hands back a prompt to wait on', async () => {
    const { service, repo } = build({
      captureReceipt: { ...receipt, settlement: 'pending' },
    });

    const outcome = await service.create(input, GUEST_ID);

    expect(outcome.status).toBe('awaiting_payment');
    // The reservation does NOT exist yet. That is the whole of D-b.
    expect(repo.create).not.toHaveBeenCalled();
  });

  /**
   * The charge must not be dropped — and it must not be voided either, not yet.
   *
   * A prompt settles seconds later in the ordinary case, so cancelling it the
   * instant it comes back pending is cancelling almost every successful payment
   * and then undoing that on the retry. The old code did exactly this, which is
   * why the happy path ran the compensation machinery every single time.
   *
   * The attempt row holds it now: `PaymentAttemptService` voids the capture
   * when the prompt actually expires, and the worker sweep catches the ones
   * nobody comes back to poll.
   */
  it('records the attempt rather than immediately voiding a live prompt', async () => {
    const { service, compensations, attempts } = build({
      captureReceipt: { ...receipt, settlement: 'pending' },
    });

    await service.create(input, GUEST_ID);

    expect(attempts.attachCapture).toHaveBeenCalledTimes(1);
    expect(attempts.statusOf).toHaveBeenCalledTimes(1);
    expect(compensations.enqueue).not.toHaveBeenCalled();
  });

  // --- One press, one charge (ADR-020 D-c, AC-12 to AC-14, AC-24, AC-27) ----

  it('scopes the capture key by workspace and by the attempt token', async () => {
    const { service, payments } = build();
    const attemptToken = '99999999-9999-9999-9999-999999999999';

    await service.create({ ...input, attemptToken }, GUEST_ID);

    expect(payments.captureEscrow.mock.calls[0][0].idempotencyKey).toBe(
      `${WORKSPACE_ID}:booking-capture:${attemptToken}`,
    );
  });

  /**
   * A token the client did not send still produces a UNIQUE key, never a null
   * one. A null under a unique index deduplicates nothing, which would disable
   * the whole protection in silence while every screen said it worked.
   */
  it('mints its own token when the client sent none, and keys are still unique', async () => {
    const a = build();
    const b = build();

    await a.service.create(input, GUEST_ID);
    await b.service.create(input, GUEST_ID);

    const keyA = a.payments.captureEscrow.mock.calls[0][0].idempotencyKey;
    const keyB = b.payments.captureEscrow.mock.calls[0][0].idempotencyKey;
    expect(keyA).toEqual(expect.stringContaining(`${WORKSPACE_ID}:booking-capture:`));
    expect(keyA).not.toBe(keyB);
  });

  /**
   * The second press of the same button gets the FIRST press's booking, and is
   * never charged again — checked before the availability pre-check, because
   * the booking the first press made is itself holding the unit and would
   * otherwise refuse the second press as sold out.
   */
  it('answers a repeated press with the first booking and no charge', async () => {
    const { service, payments, repo } = build({
      settledAttempt: {
        id: '88888888-8888-8888-8888-888888888888',
        reference: 'BK-ABC123',
        status: 'confirmed',
        bookingMode: 'instant_book',
        paymentStatus: 'captured',
        escrowStatus: 'held',
        nonRefundable: false,
        lockedCancellationTier: 'flexible',
        lockedNightlyRateRwf: 45_000,
        grossRwf: null,
        attemptFingerprint: null,
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        guests: 2,
        approvalExpiresAt: null,
      },
    });

    const result = await service.create(
      { ...input, attemptToken: '99999999-9999-9999-9999-999999999999' },
      GUEST_ID,
    );

    expect(bookingOf(result).reference).toBe('BK-ABC123');
    // The same number, recomputed from the locked rate rather than re-quoted.
    expect(bookingOf(result).breakdown.grossRwf).toBe(94_500);
    expect(payments.captureEscrow).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  /**
   * The one that mattered most, and that the previous shape got wrong: a
   * duplicate press must NOT reach the compensating path. Refunding here would
   * reverse the charge behind the booking the first press created, while that
   * booking stands and still reads `escrow_status: held`.
   */
  it('never refunds when the duplicate is caught inside the transaction', async () => {
    const settled: SettledAttempt = {
      id: '88888888-8888-8888-8888-888888888888',
      reference: 'BK-ABC123',
      status: 'confirmed',
      bookingMode: 'instant_book',
      paymentStatus: 'captured',
      escrowStatus: 'held',
      nonRefundable: false,
      lockedCancellationTier: 'flexible',
      lockedNightlyRateRwf: 45_000,
      grossRwf: null,
      attemptFingerprint: null,
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      guests: 2,
      approvalExpiresAt: null,
    };

    const { service, payments, repo } = build({
      createRejects: new DuplicateAttemptError('k'),
    });
    // Empty on the way in (the race got past it), populated on the way back.
    repo.findByAttemptKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(settled);

    const result = await service.create(input, GUEST_ID);

    expect(bookingOf(result).reference).toBe('BK-ABC123');
    expect(payments.refund).not.toHaveBeenCalled();
  });

  /**
   * A token that names a booking belonging to someone else is a replayed or
   * guessed value, not the caller's reservation. It is refused rather than
   * answered with a stranger's booking.
   */
  it('refuses rather than surfacing another guest booking on a taken key', async () => {
    const { service, payments, repo } = build({
      createRejects: new DuplicateAttemptError('k'),
    });
    repo.findByAttemptKey.mockResolvedValue(null);

    await expect(service.create(input, GUEST_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(payments.refund).not.toHaveBeenCalled();
  });

  // --- Nothing dropped (ADR-020 D-d, AC-11) --------------------------------

  it('queues the compensating refund when the inline one fails', async () => {
    const { service, compensations } = build({
      createRejects: new Error('database is on fire'),
      refundRejects: new Error('refund endpoint down'),
    });

    await expect(service.create(input, GUEST_ID)).rejects.toThrow(
      'database is on fire',
    );

    const [job] = compensations.enqueue.mock.calls[0];
    expect(job.kind).toBe('refund');
    expect(job.idempotencyKey).toEqual(expect.stringContaining('refund:'));
    expect(job.originalRef).toBe(receipt.adapterRef);
  });
});
