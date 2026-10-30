import { describe, expect, it } from 'vitest';

import type { PaymentPort } from '../../payments/domain/payment-port';
import type { FolioRepository } from '../infrastructure/folio.repository';
import type { MyStayRow } from '../infrastructure/stay-claim.repository';
import type { StayRefundRepository } from '../infrastructure/stay-refund.repository';
import { StayRefundService } from './stay-refund.service';

/**
 * THE ARITHMETIC BETWEEN A STAY ROW AND THE HOUSE RULES (§6.8).
 *
 * `stayRefundAssessment` is pinned in `@injishi/contracts`'s own tests, rule by
 * rule. What is pinned HERE is the translation into it: how many nights were
 * contracted for, how many have actually been slept, which tier applies. Those
 * three numbers decide the answer, they are derived from timestamps rather than
 * stored, and getting one of them wrong moves money in the property's favour
 * without anything looking broken.
 */
describe('StayRefundService: the nights it counts', () => {
  const at = (iso: string): Date => new Date(iso);

  /** The service with its clock pinned, and no repository work reached. */
  function serviceAt(now: string): StayRefundService {
    class Pinned extends StayRefundService {
      protected override now(): Date {
        return at(now);
      }
    }
    return new Pinned(
      {} as unknown as StayRefundRepository,
      {} as unknown as FolioRepository,
      {} as unknown as PaymentPort,
    );
  }

  const stay = (over: Partial<MyStayRow> = {}): MyStayRow => ({
    id: 'stay-1',
    bookingId: 'booking-1',
    bookingReference: 'BK-AAAA-BBBB',
    propertyId: 'property-1',
    propertyName: 'Umurage Guesthouse',
    roomLabel: '204',
    lifecycle: 'open',
    checkInMode: 'staffed',
    entryAt: at('2026-09-10T14:00:00Z'),
    plannedExitAt: at('2026-09-13T11:00:00Z'),
    actualExitAt: null,
    workspaceId: 'workspace-1',
    folioId: 'folio-1',
    balanceRwf: 0,
    paidRwf: 120_000,
    openRefundRequestId: null,
    nonRefundable: false,
    cancellationTier: 'moderate',
    nightlyRateRwf: 40_000,
    checkIn: '2026-09-10',
    checkOut: '2026-09-13',
    ...over,
  });

  it('prices only the nights not yet slept', () => {
    // Two nights in on a three-night stay: one night is unused, and moderate
    // refunds 50% of it after check-in.
    const quote = serviceAt('2026-09-12T20:00:00Z').quote(stay(), 'changed_plans');
    expect(quote.maxRefundRwf).toBe(20_000);
  });

  it('counts nights on the CALENDAR, not in elapsed hours', () => {
    // Arrived 14:00 on the 10th, asking at 16:00 on the 11th: one night slept,
    // which is what a hotel means by a night. Elapsed hours would say 26 and
    // floor to the same 1 here — the difference shows in the closed-stay case
    // below, where 43 hours floors to 1 and the guest actually slept 2.
    const quote = serviceAt('2026-09-11T16:00:00Z').quote(stay(), 'changed_plans');
    expect(quote.maxRefundRwf).toBe(40_000); // two unused nights at 50%
  });

  it('never counts more nights slept than were booked', () => {
    // An overstay does not turn into negative unused nights and a refund.
    const quote = serviceAt('2026-09-20T09:00:00Z').quote(stay(), 'changed_plans');
    expect(quote.maxRefundRwf).toBe(0);
    expect(quote.refusalReason).toBe('nights_already_consumed');
  });

  it('counts a closed stay to its actual departure, not to now', () => {
    // Somebody raising this the morning after checkout must be assessed on the
    // stay they had, not on the days that have passed since.
    //
    // Arrived on the 10th, left on the 12th: TWO nights slept, one of three
    // unused, 50% of it under `moderate`. Counting the 43 elapsed hours would
    // floor to one night and hand this guest a second night's refund for a
    // night they slept in the room.
    const quote = serviceAt('2026-09-13T20:00:00Z').quote(
      stay({ lifecycle: 'closed', actualExitAt: at('2026-09-12T09:00:00Z') }),
      'changed_plans',
    );
    expect(quote.maxRefundRwf).toBe(20_000);
  });

  it('closes the window three days after checkout', () => {
    const quote = serviceAt('2026-09-16T10:00:00Z').quote(
      stay({ lifecycle: 'closed', actualExitAt: at('2026-09-13T09:00:00Z') }),
      'cleanliness',
    );
    expect(quote.refusalReason).toBe('not_reported_during_stay');
  });

  it('reads the booking dates in preference to the planned exit', () => {
    // A planned exit that disagrees with the booking is the desk's typing; the
    // booking is what the guest paid for.
    const quote = serviceAt('2026-09-11T12:00:00Z').quote(
      stay({ plannedExitAt: at('2026-09-11T11:00:00Z') }),
      'changed_plans',
    );
    // Three booked nights, one slept (the 10th to the 11th): two unused at 50%.
    expect(quote.maxRefundRwf).toBe(40_000);
  });

  it('falls back to the planned exit for a walk in, which has no booking', () => {
    const quote = serviceAt('2026-09-11T12:00:00Z').quote(
      stay({
        bookingId: null,
        checkIn: null,
        checkOut: null,
        cancellationTier: null,
        nightlyRateRwf: 30_000,
        paidRwf: 90_000,
      }),
      'changed_plans',
    );
    // No locked tier reads as `flexible`, which refunds nothing after check-in.
    expect(quote.maxRefundRwf).toBe(0);
    expect(quote.refusalReason).toBe('outside_cancellation_window');
  });

  it('reads an unrecognised tier as none rather than throwing at the guest', () => {
    const quote = serviceAt('2026-09-11T12:00:00Z').quote(
      stay({ cancellationTier: 'whatever_somebody_typed' }),
      'changed_plans',
    );
    expect(quote.maxRefundRwf).toBe(0);
  });

  it('refuses a second request while one is still open', () => {
    const quote = serviceAt('2026-09-11T12:00:00Z').quote(
      stay({ openRefundRequestId: 'request-1' }),
      'cleanliness',
    );
    expect(quote.refusal).toMatch(/already have a request/i);
  });

  it('refuses a stay nobody has paid anything on', () => {
    const quote = serviceAt('2026-09-11T12:00:00Z').quote(
      stay({ paidRwf: 0, balanceRwf: 0 }),
      'cleanliness',
    );
    expect(quote.refusal).toMatch(/nothing has been paid/i);
  });

  it('lets a guest who owes money raise a billing query', () => {
    // Paid nothing yet, but there IS a bill. "That charge is wrong" is exactly
    // the thing this person needs to be able to say.
    const quote = serviceAt('2026-09-11T12:00:00Z').quote(
      stay({ paidRwf: 0, balanceRwf: 55_000 }),
      'overcharged',
    );
    expect(quote.refusal).toBeNull();
  });
});
