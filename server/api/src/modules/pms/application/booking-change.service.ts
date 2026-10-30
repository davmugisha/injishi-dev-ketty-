import {
  instrumentProblem,
  type ReservationChangeAsk,
  type ReservationChangeForm,
  type ReservationChangeQuote,
  type ReservationChangeRequest,
  type ReservationChangeResult,
} from '@injishi/contracts';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ListingService } from '../../listing/application/listing.service';
import { PaymentSeam } from '../../pay/domain/payment-seam';
import { type ChangeSubject, type ChangeTarget, changeProblems, priceChange } from '../domain/booking-change';
import { localToday } from '../domain/pricing';
import { BookingChangeRepository, type ChangeableBooking } from '../infrastructure/booking-change.repository';
import { BookingNotificationsService } from './booking-notifications.service';
import { PaymentAttemptService } from './payment-attempt.service';

/** Payment states in which the guest's money is still held for the stay. */
const HELD = new Set(['captured', 'refunded_partial', 'refund_pending']);

/** A room type with no stated capacity is not unlimited (review 3.7). */
const DEFAULT_CAPACITY = 2;

/**
 * The desk changes a confirmed reservation (2026-10-30, the owner's decisions): its dates, its room type,
 * its number of guests. Never the guest's details.
 *
 * A change reprices the stay (`priceChange`). Costing more, the desk chooses each time: `bill` puts the
 * difference on the guest's bill, which the night audit's room charges and the check-in credit of what was
 * paid make add up on their own; `momo` asks the guest to pay it now and the change applies once they have.
 * Costing less, the difference stays on the bill as credit, and what is left at check out is refunded.
 */
@Injectable()
export class BookingChangeService {
  constructor(
    private readonly changes: BookingChangeRepository,
    private readonly listings: ListingService,
    private readonly attempts: PaymentAttemptService,
    private readonly seam: PaymentSeam,
    private readonly notifications: BookingNotificationsService,
  ) {}

  /** The stay as it stands, and the room types it may move to: what the desk's change form starts from. */
  async form(ws: ScopedWorkspace, bookingId: string): Promise<ReservationChangeForm> {
    const booking = await this.changeable(ws, bookingId, { anyStatus: true });
    const ids = await this.changes.roomTypeIdsOf(booking.propertyId);
    const types = (await Promise.all(ids.map((id) => this.listings.findBookableRoomType(id)))).filter(
      (rt): rt is NonNullable<typeof rt> => !!rt && rt.workspaceId === ws.workspaceId && rt.domain === 'hospitality',
    );
    const problems =
      booking.status === 'confirmed'
        ? this.standing(booking)
        : [booking.status === 'pending_approval' ? 'Approve or decline this request first; a request is not changed.' : 'Only a confirmed reservation can be changed.'];
    return {
      reference: booking.reference,
      current: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomTypeId: booking.roomTypeId,
        adults: booking.adults,
        children: booking.children,
      },
      roomTypes: types.map((rt) => ({
        id: rt.id,
        name: rt.name,
        capacity: rt.capacity ?? DEFAULT_CAPACITY,
        maxAdults: rt.maxAdults ?? null,
        maxChildren: rt.maxChildren ?? null,
        nightlyRateRwf: rt.nightlyRateRwf ?? null,
        priceBasis: rt.priceBasis ?? null,
      })),
      problems,
    };
  }

  /** What a change would cost and whether it can be made, before anything moves. */
  async quote(ws: ScopedWorkspace, bookingId: string, ask: ReservationChangeAsk): Promise<ReservationChangeQuote> {
    const booking = await this.changeable(ws, bookingId);
    const target = await this.target(ws, ask.roomTypeId);
    const price = priceChange(this.subject(booking), target, ask);
    const problems = [...this.standing(booking), ...changeProblems(this.subject(booking), target, ask, localToday())];
    const available = problems.length
      ? false
      : await this.changes.available(ask.roomTypeId, ask.checkIn, ask.checkOut, bookingId);
    if (!problems.length && !available) problems.push(SOLD_OUT);
    return {
      nights: price.nights,
      fromNightlyRwf: price.fromNightlyRwf,
      toNightlyRwf: price.toNightlyRwf,
      paidRoomRwf: price.paidRoomRwf,
      newRoomRwf: price.newRoomRwf,
      differenceRwf: price.differenceRwf,
      settlements:
        price.differenceRwf > 0
          ? this.seam.isOffFor('booking')
            ? ['bill']
            : ['bill', 'momo']
          : [price.differenceRwf < 0 ? 'credit' : 'none'],
      available,
      problems,
    };
  }

  /** Make the change: at once, or once the guest's MoMo payment of the difference lands. */
  async change(
    ws: ScopedWorkspace,
    bookingId: string,
    body: ReservationChangeRequest,
    actorUserId: string,
  ): Promise<ReservationChangeResult> {
    const booking = await this.changeable(ws, bookingId);
    const target = await this.target(ws, body.roomTypeId);
    const ask: ReservationChangeAsk = {
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      roomTypeId: body.roomTypeId,
      adults: body.adults,
      children: body.children,
    };
    const subject = this.subject(booking);
    const problems = [...this.standing(booking), ...changeProblems(subject, target, ask, localToday())];
    if (problems.length) throw new UnprocessableEntityException(problems[0]);
    const price = priceChange(subject, target, ask);
    const from = {
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomTypeId: booking.roomTypeId,
      adults: booking.adults,
      children: booking.children,
      lockedNightlyRwf: booking.lockedNightlyRwf,
    };
    const base = { bookingId, workspaceId: booking.workspaceId, from, ask, price, actorUserId };

    if (price.differenceRwf > 0 && body.settlement === 'momo') {
      if (this.seam.isOffFor('booking')) {
        throw new UnprocessableEntityException('Mobile money is switched off here. Put the difference on the bill.');
      }
      const { instrument, attemptToken } = body;
      if (!instrument || !attemptToken) {
        throw new UnprocessableEntityException('Give the guest’s mobile money number to ask them to pay.');
      }
      if (instrument.kind !== 'mobile_money') {
        throw new UnprocessableEntityException('A change is paid by mobile money.');
      }
      const fault = instrumentProblem(instrument) ?? this.seam.ruleProblem(price.differenceRwf, instrument);
      if (fault) throw new UnprocessableEntityException(fault);
      if (!(await this.changes.available(ask.roomTypeId, ask.checkIn, ask.checkOut, bookingId))) {
        throw new ConflictException(SOLD_OUT);
      }
      let changeId: string;
      try {
        changeId = await this.changes.createAwaiting(base);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException('A payment request for another change is already out. Wait for it, or let it run out.');
        }
        throw error;
      }
      const attempt = await this.attempts.beginForBookingChange({
        changeId,
        bookingId,
        reference: booking.reference,
        workspaceId: booking.workspaceId,
        payerUserId: booking.guestUserId ?? actorUserId,
        amountRwf: price.differenceRwf,
        instrument,
        attemptToken,
      });
      const now = await this.changes.findChange(changeId);
      if (now?.status === 'applied') await this.notifications.notifyChange(bookingId, changeId);
      return {
        changeId,
        status: (now?.status ?? 'awaiting_payment') as ReservationChangeResult['status'],
        settlement: 'momo',
        differenceRwf: price.differenceRwf,
        attempt,
      };
    }

    if (price.differenceRwf > 0 && body.settlement !== 'bill') {
      throw new UnprocessableEntityException('This change costs more: put the difference on the bill, or ask the guest to pay it by MoMo.');
    }
    const settlement = price.differenceRwf > 0 ? 'bill' : price.differenceRwf < 0 ? 'credit' : 'none';
    const outcome = await this.changes.apply({ ...base, settlement });
    if (outcome.kind === 'sold_out') throw new ConflictException(SOLD_OUT);
    if (outcome.kind === 'stale') throw new ConflictException(STALE);
    await this.notifications.notifyChange(bookingId, outcome.changeId);
    return { changeId: outcome.changeId, status: 'applied', settlement, differenceRwf: price.differenceRwf, attempt: null };
  }

  /** The desk's poll of a MoMo request for a change. Applied the moment the money lands. */
  async poll(ws: ScopedWorkspace, bookingId: string, attemptToken: string): Promise<ReservationChangeResult> {
    await this.changeable(ws, bookingId, { anyStatus: true });
    const attempt = await this.attempts.pollBookingChange(attemptToken, ws.workspaceId);
    const change = await this.changes.findChange(attempt.changeId);
    if (!change || change.bookingId !== bookingId) throw new NotFoundException('No such payment request.');
    if (change.status === 'applied') await this.notifications.notifyChange(bookingId, change.id);
    const status = {
      attemptToken: attempt.attemptToken,
      state: attempt.state,
      network: attempt.network,
      payerMasked: attempt.payerMasked,
      amountRwf: attempt.amountRwf,
      expiresAt: attempt.expiresAt,
      failureReason: attempt.failureReason,
    };
    return {
      changeId: change.id,
      status: change.status as ReservationChangeResult['status'],
      settlement: change.settlement as ReservationChangeResult['settlement'],
      differenceRwf: Number(change.differenceRwf),
      attempt: status,
    };
  }

  /** The booking, in this workspace and branch; a booking outside it is a 404, never a 403. */
  private async changeable(ws: ScopedWorkspace, bookingId: string, opts: { anyStatus?: boolean } = {}): Promise<ChangeableBooking> {
    const booking = await this.changes.find(bookingId);
    if (!booking || booking.workspaceId !== ws.workspaceId) throw new NotFoundException('Reservation not found.');
    assertInBranchScope(ws, booking.propertyId);
    if (!opts.anyStatus && booking.status !== 'confirmed') {
      throw new ConflictException(
        booking.status === 'pending_approval'
          ? 'Approve or decline this request first; a request is not changed.'
          : 'Only a confirmed reservation can be changed.',
      );
    }
    return booking;
  }

  /** Why this booking cannot change at all, whatever is asked. */
  private standing(b: ChangeableBooking): string[] {
    if (b.completed) return ['This stay is over.'];
    if (b.stays > 0) return ['The guest has checked in. Change the stay from the bill and the room rack instead.'];
    if (!b.paymentStatus || !HELD.has(b.paymentStatus)) return ['This booking holds no payment to change against.'];
    return [];
  }

  private subject(b: ChangeableBooking): ChangeSubject {
    return {
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      roomTypeId: b.roomTypeId,
      adults: b.adults,
      children: b.children,
      lockedNightlyRwf: b.lockedNightlyRwf,
      priceBasis: b.priceBasis,
      paidRoomRwf: b.paidRoomRwf,
      refundRwf: b.refundRwf,
    };
  }

  /** The room type it moves to, priced as a new booking of it is, and in this workspace. */
  private async target(ws: ScopedWorkspace, roomTypeId: string): Promise<ChangeTarget> {
    const rt = await this.listings.findBookableRoomType(roomTypeId);
    if (!rt || rt.workspaceId !== ws.workspaceId || rt.domain !== 'hospitality') {
      throw new NotFoundException('That room type is not offered here.');
    }
    assertInBranchScope(ws, rt.propertyId);
    if (rt.nightlyRateRwf == null) throw new UnprocessableEntityException('That room type has no price yet.');
    return {
      id: rt.id,
      nightlyRateRwf: rt.nightlyRateRwf,
      singleGuestPriceRwf: rt.singleGuestPriceRwf ?? null,
      priceBasis: rt.priceBasis ?? null,
      capacity: rt.capacity ?? DEFAULT_CAPACITY,
      maxAdults: rt.maxAdults ?? null,
      maxChildren: rt.maxChildren ?? null,
      minStay: rt.minStay ?? null,
    };
  }
}

const SOLD_OUT = 'That room type has no room free for every night of the new dates.';
const STALE = 'This reservation changed a moment ago. Open it again to see where it stands.';

/** Postgres `unique_violation`, raised directly or wrapped by the query builder (its `cause`). */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown): string | undefined => (typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined);
  return code(error) === '23505' || code((error as { cause?: unknown } | null)?.cause) === '23505';
}
