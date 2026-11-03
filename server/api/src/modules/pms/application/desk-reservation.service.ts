import {
  type DeskReservationAsk,
  type DeskReservationQuote,
  type DeskReservationRequest,
  type DeskReservationResult,
  chargedGuests,
  isStayPriceBasis,
  MAX_HORIZON_DAYS,
  nightlyRateFor,
} from '@injishi/contracts';
import { ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { type BookableRoomType, ListingService } from '../../listing/application/listing.service';
import { nightsBetween } from '../domain/booking-change';
import { daysFromToday, localToday } from '../domain/pricing';
import { NoAvailabilityError } from '../infrastructure/booking.repository';
import { DeskReservationRepository } from '../infrastructure/desk-reservation.repository';
import { FolioRepository } from '../infrastructure/folio.repository';
import { FolioService } from './folio.service';
import { RoomAssignmentService } from './room-assignment.service';

/** A room type with no stated capacity is not unlimited (review 3.7). */
const DEFAULT_CAPACITY = 2;
const SOLD_OUT = 'That room type has no room free for every night. Choose other dates or another room type.';

/**
 * THE DESK BOOKS A GUEST FOR ANY DAY FROM TODAY (0124, 2026-10-30).
 *
 * Until now the desk could only check a guest in on the spot; a phone call for Friday had nowhere to go.
 * A desk booking is a confirmed booking like a guest's own, priced by the same stay rules (day prices,
 * long stay discounts, closed nights, shortest and longest stay) and written under the same room type
 * lock, so the desk and the marketplace never sell one room twice. What differs:
 *
 * - **No account.** The guest is a name and a phone (`booking_desk_details`).
 * - **No money online.** A deposit the desk takes goes on the guest's bill (a folio opened for the
 *   booking), and check in carries it.
 * - **The desk may set the price**, with a reason, kept beside the booking.
 * - **A hold** ends on its own: past `holdUntil` the sweep cancels it and the nights are free.
 */
@Injectable()
export class DeskReservationService {
  private readonly log = new Logger(DeskReservationService.name);

  constructor(
    private readonly desk: DeskReservationRepository,
    private readonly listings: ListingService,
    private readonly assignments: RoomAssignmentService,
    private readonly folios: FolioRepository,
    private readonly bills: FolioService,
  ) {}

  /** What it would cost, the rooms free to hold, and why it cannot be booked, if it cannot. */
  async quote(ws: ScopedWorkspace, ask: DeskReservationAsk): Promise<DeskReservationQuote> {
    const roomType = await this.roomType(ws, ask.roomTypeId);
    const priced = await this.price(roomType, ask);
    const available = priced.problems.length ? false : await this.desk.available(ask.roomTypeId, ask.checkIn, ask.checkOut);
    if (!priced.problems.length && !available) priced.problems.push(SOLD_OUT);
    const freeRooms = available ? await this.desk.freeRooms(ask.roomTypeId, ask.checkIn, ask.checkOut) : [];
    return {
      nights: priced.nights,
      nightlyRateRwf: priced.nightlyRateRwf,
      chargedNightlyRwf: priced.chargedNightlyRwf,
      totalRwf: priced.chargedNightlyRwf * priced.nights,
      freeRooms,
      available,
      problems: priced.problems,
    };
  }

  async create(
    ws: ScopedWorkspace,
    body: DeskReservationRequest,
    userId: string,
    idempotencyKey: string,
  ): Promise<DeskReservationResult> {
    const roomType = await this.roomType(ws, body.roomTypeId);
    const priced = await this.price(roomType, body);
    if (priced.problems.length) throw new UnprocessableEntityException(priced.problems[0]);
    if (body.holdUntil && Date.parse(body.holdUntil) <= Date.now()) {
      throw new UnprocessableEntityException('A hold ends in the future.');
    }

    let created: { id: string; reference: string };
    try {
      created = await this.desk.create({
        workspaceId: ws.workspaceId,
        roomTypeId: roomType.id,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        adults: body.adults,
        children: body.children ?? 0,
        lockedNightlyRateRwf: priced.chargedNightlyRwf,
        grossRwf: priced.chargedNightlyRwf * priced.nights,
        cancellationTier: roomType.cancellationTier ?? null,
        bookingMode: roomType.bookingMode ?? 'instant_book',
        channel: body.channel,
        eta: body.eta ?? null,
        note: body.note ?? null,
        guest: {
          fullName: body.guest.fullName,
          phone: body.guest.phone ?? null,
          email: body.guest.email ?? null,
          nationality: body.guest.nationality ?? null,
          documentType: body.guest.documentType ?? null,
          idNumber: body.guest.idNumber ?? null,
        },
        holdUntil: body.holdUntil ? new Date(body.holdUntil) : null,
        rateOverrideReason: body.nightlyRateRwf !== undefined ? (body.rateOverrideReason ?? null) : null,
        createdByUserId: userId,
      });
    } catch (error) {
      if (error instanceof NoAvailabilityError) throw new ConflictException(SOLD_OUT);
      throw error;
    }

    // The room, when the desk chose one. The booking stands either way: a room taken a moment ago leaves
    // it waiting for a room ("No room yet"), and the desk is told why.
    let roomLabel: string | null = null;
    let roomProblem: string | null = null;
    if (body.roomId) {
      try {
        const held = await this.assignments.assign(ws, created.id, { roomId: body.roomId }, userId);
        roomLabel = held.roomLabel ?? null;
      } catch (error) {
        roomProblem = error instanceof Error ? error.message : 'That room could not be held.';
      }
    }

    // A deposit goes on the guest's bill, opened now for the booking; check in binds it to the stay.
    let folioId: string | null = null;
    if (body.deposit) {
      folioId = await this.folios.openForBooking({
        bookingId: created.id,
        workspaceId: ws.workspaceId,
        propertyId: roomType.propertyId,
        guestUserId: null,
      });
      if (!folioId) throw new ConflictException('The bill for this booking could not be opened. Take the deposit at check in.');
      await this.bills.takePayment(
        ws,
        folioId,
        { amountRwf: body.deposit.amountRwf, method: body.deposit.method, reference: body.deposit.reference },
        userId,
        `desk-deposit:${idempotencyKey}`,
      );
    }

    return {
      id: created.id,
      reference: created.reference,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      totalRwf: priced.chargedNightlyRwf * priced.nights,
      roomLabel,
      roomProblem,
      folioId,
    };
  }

  /** Cancel desk holds that ran out (the lifecycle sweep). Never throws. */
  async releaseExpiredHolds(now: Date = new Date()): Promise<number> {
    try {
      const released = await this.desk.releaseExpiredHolds(now);
      for (const b of released) await this.assignments.releaseForBooking(b.id);
      if (released.length) this.log.log(`Released ${released.length} desk holds: ${released.map((b) => b.reference).join(', ')}`);
      return released.length;
    } catch (error) {
      this.log.error(`Desk hold sweep failed: ${String(error)}`);
      return 0;
    }
  }

  private async roomType(ws: ScopedWorkspace, roomTypeId: string): Promise<BookableRoomType> {
    const rt = await this.listings.findBookableRoomType(roomTypeId);
    if (!rt || rt.workspaceId !== ws.workspaceId || rt.domain !== 'hospitality' || !isStayPriceBasis(rt.priceBasis)) {
      throw new NotFoundException('That room type is not offered here.');
    }
    assertInBranchScope(ws, rt.propertyId);
    if (rt.nightlyRateRwf == null) throw new UnprocessableEntityException('That room type has no price yet.');
    return rt;
  }

  /** The stay's price by the same rules a guest's booking follows, and every reason it cannot be made. */
  private async price(
    roomType: BookableRoomType,
    ask: Pick<DeskReservationAsk, 'checkIn' | 'checkOut' | 'adults' | 'children' | 'nightlyRateRwf'>,
  ): Promise<{ nights: number; nightlyRateRwf: number; chargedNightlyRwf: number; problems: string[] }> {
    const problems: string[] = [];
    const nights = nightsBetween(ask.checkIn, ask.checkOut);
    const party = ask.adults + (ask.children ?? 0);
    if (nights <= 0) problems.push('Departure must be after arrival.');
    if (ask.checkIn < localToday()) problems.push('Arrival cannot be in the past.');
    if (daysFromToday(ask.checkIn) > MAX_HORIZON_DAYS) problems.push('Bookings open up to 18 months ahead.');
    const capacity = roomType.capacity ?? DEFAULT_CAPACITY;
    if (party > capacity) problems.push(`${roomType.name} sleeps at most ${capacity}.`);
    if (roomType.maxAdults != null && ask.adults > roomType.maxAdults) {
      problems.push(`${roomType.name} takes at most ${roomType.maxAdults} ${roomType.maxAdults === 1 ? 'adult' : 'adults'}.`);
    }
    if (roomType.maxChildren != null && (ask.children ?? 0) > roomType.maxChildren) {
      problems.push(
        roomType.maxChildren === 0
          ? `${roomType.name} takes no children.`
          : `${roomType.name} takes at most ${roomType.maxChildren} ${roomType.maxChildren === 1 ? 'child' : 'children'}.`,
      );
    }
    if (nights <= 0) return { nights: 0, nightlyRateRwf: 0, chargedNightlyRwf: 0, problems };

    const rate = await this.listings.stayRate(roomType, ask.checkIn, ask.checkOut);
    if (rate.closedOn) problems.push(`${roomType.name} is closed on ${rate.closedOn}.`);
    if (nights < rate.minNights) problems.push(`${roomType.name} takes stays of ${rate.minNights} nights or more.`);
    if (nights > rate.maxNights) problems.push(`Stays are limited to ${rate.maxNights} nights.`);
    // The party's nightly charge: per room (one guest at the one-guest price), or per guest.
    const nightlyRateRwf =
      nightlyRateFor({ ...roomType, nightlyRateRwf: rate.nightlyRateRwf }, party) *
      chargedGuests(roomType.priceBasis, party);
    return {
      nights,
      nightlyRateRwf,
      chargedNightlyRwf: ask.nightlyRateRwf ?? nightlyRateRwf,
      problems,
    };
  }
}
