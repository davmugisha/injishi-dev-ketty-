import {
  brokerCommissionFor,
  computeBreakdown,
  instrumentProblem,
  nightlyRateFor,
  stayNightlyRateRwf,
  type BrokerBookingGroup,
  type BrokerDeal,
  type BrokerRoomOffer,
  type CreateBrokerBookingRequest,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PaymentSeam } from '../../pay/domain/payment-seam';
import { termsFromColumns } from '../../brokers/domain/broker-deal-rules';
import { DEFAULT_CAPACITY, MAX_HORIZON_DAYS, MAX_NIGHTS, daysFromToday, isCalendarDate, localToday, nightsBetween } from '../domain/pricing';
import {
  BrokerGroupRepository,
  type BrokerRoomTypeRow,
  type DealFacts,
  type GroupBookingRow,
  type GroupRoomLine,
  type GroupRow,
} from '../infrastructure/broker-group.repository';
import type { PaymentAttemptRow } from '../infrastructure/payment-attempt.repository';
import { PaymentAttemptRepository } from '../infrastructure/payment-attempt.repository';
import { BrokerGroupPaymentRefused, PaymentAttemptService } from './payment-attempt.service';

/**
 * Who is booking and under which deal: resolved by the brokers module from the broker's own workspace and
 * a deal that is running with this hotel. This service never trusts a broker or a deal id from a request.
 */
export interface BrokerBookingContext {
  brokerId: string;
  brokerUserId: string;
  deal: BrokerDeal;
}

/**
 * A broker's bookings at a hotel (0125, phase 2). Under a running deal a broker books one room or many,
 * a guest's name on every room. Each room is priced exactly as a guest's own booking would be (the room
 * type's rate, the party, the nights; `computeBreakdown`), and confirmed at once when it is free.
 *
 * Paid at the hotel, the bookings are written now and carry no payment: the desk collects it, as from a
 * walk in. Paid by MoMo, one Request to Pay covers the group (`PaymentAttemptService.beginForBrokerGroup`)
 * and the bookings are written only when it lands, each with its own share in escrow; sold out meanwhile,
 * the whole payment is refunded and nothing is booked.
 */
@Injectable()
export class BrokerGroupBookingService {
  constructor(
    private readonly groups: BrokerGroupRepository,
    private readonly attempts: PaymentAttemptService,
    private readonly attemptRows: PaymentAttemptRepository,
    private readonly seam: PaymentSeam,
  ) {}

  /** What can be booked at the deal's hotel for these dates, at what rate, and how many of each are free. */
  async offer(ctx: BrokerBookingContext, checkIn: string, checkOut: string): Promise<BrokerRoomOffer> {
    const nights = this.checkDates(checkIn, checkOut);
    const types = await this.groups.roomTypesOf(ctx.deal.hotel.orgId);
    const roomTypes = await Promise.all(
      types.map(async (t) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity ?? DEFAULT_CAPACITY,
        maxAdults: t.maxAdults,
        maxChildren: t.maxChildren,
        priceBasis: t.priceBasis,
        nightlyRateRwf: t.nightlyRateRwf ?? 0,
        singleGuestPriceRwf: t.singleGuestPriceRwf,
        minStay: t.minStay,
        freeRooms: await this.groups.freeRooms(t.id, checkIn, checkOut),
      })),
    );
    return {
      hotel: { orgId: ctx.deal.hotel.orgId, name: ctx.deal.hotel.name },
      deal: ctx.deal,
      checkIn,
      checkOut,
      nights,
      roomTypes,
    };
  }

  async create(ctx: BrokerBookingContext, body: CreateBrokerBookingRequest): Promise<BrokerBookingGroup> {
    const nights = this.checkDates(body.checkIn, body.checkOut);
    const types = new Map((await this.groups.roomTypesOf(ctx.deal.hotel.orgId)).map((t) => [t.id, t]));

    const lines: GroupRoomLine[] = body.rooms.map((room, i) => this.price(types.get(room.roomTypeId), room, nights, i));
    const workspaces = new Set(lines.map((l) => types.get(l.roomTypeId)?.workspaceId));
    if (workspaces.size !== 1) {
      throw new BadRequestException('Book the rooms of one property at a time.');
    }
    const workspaceId = [...workspaces][0] as string;

    // Free enough rooms of each type before anything is written or asked for. The write checks again under
    // the lock; this is what lets a broker hear "sold out" before their phone rings.
    for (const typeId of new Set(lines.map((l) => l.roomTypeId))) {
      const wanted = lines.filter((l) => l.roomTypeId === typeId).length;
      const free = await this.groups.freeRooms(typeId, body.checkIn, body.checkOut);
      if (free < wanted) {
        const name = types.get(typeId)?.name ?? 'That room';
        throw new ConflictException(
          free === 0
            ? `${name} is fully booked for those dates.`
            : `Only ${free} ${name} ${free === 1 ? 'room is' : 'rooms are'} free for those dates.`,
        );
      }
    }

    const totalRwf = lines.reduce((s, l) => s + l.grossRwf, 0);
    if (body.payment.method === 'momo') {
      const fault = instrumentProblem(body.payment.instrument) ?? this.seam.ruleProblem(totalRwf, body.payment.instrument);
      if (fault) throw new BadRequestException(fault);
    }

    const group = await this.groups.insertGroup({
      brokerId: ctx.brokerId,
      dealId: ctx.deal.id,
      orgId: ctx.deal.hotel.orgId,
      workspaceId,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      payment: body.payment.method,
      status: 'awaiting_payment',
      totalRwf,
      contactPhone: body.contactPhone,
      note: body.note?.trim() || null,
      rooms: lines,
      createdByUserId: ctx.brokerUserId,
    });

    if (body.payment.method === 'at_hotel') {
      const outcome = await this.groups.writeBookings(group, null);
      if (outcome.kind === 'sold_out') {
        const reason = `${outcome.roomTypeName} was booked by someone else a moment ago. Nothing was booked.`;
        await this.groups.markFailed(group.id, reason);
        throw new ConflictException(reason);
      }
    } else {
      try {
        await this.attempts.beginForBrokerGroup({
          group,
          payerUserId: ctx.brokerUserId,
          instrument: body.payment.instrument,
          attemptToken: body.payment.attemptToken,
        });
      } catch (err) {
        // A refusal is an answer, shown on the group; anything else is the caller's to hear.
        if (!(err instanceof BrokerGroupPaymentRefused)) throw err;
      }
    }
    return this.mustRead(ctx.brokerId, group.id);
  }

  async list(brokerId: string): Promise<BrokerBookingGroup[]> {
    return this.present(await this.groups.groupsOfBroker(brokerId));
  }

  /** One group; while its MoMo prompt is out, the provider is asked where it got to. */
  async get(brokerId: string, groupId: string): Promise<BrokerBookingGroup> {
    const group = await this.groups.group(groupId);
    if (!group || group.brokerId !== brokerId) throw new NotFoundException('There is no such booking.');
    if (group.status === 'awaiting_payment') {
      const attempt = (await this.attemptRows.latestForBrokerGroups([group.id])).get(group.id);
      if (attempt?.state === 'prompting') await this.attempts.pollBrokerGroup(attempt);
    }
    return this.mustRead(brokerId, groupId);
  }

  // ---------------------------------------------------------------------------------------------------------

  private async mustRead(brokerId: string, groupId: string): Promise<BrokerBookingGroup> {
    const group = await this.groups.group(groupId);
    if (!group || group.brokerId !== brokerId) throw new NotFoundException('There is no such booking.');
    const [presented] = await this.present([group]);
    if (!presented) throw new NotFoundException('There is no such booking.');
    return presented;
  }

  private async present(groups: GroupRow[]): Promise<BrokerBookingGroup[]> {
    const ids = groups.map((g) => g.id);
    const [bookings, attempts, deals] = await Promise.all([
      this.groups.bookingsOf(ids),
      this.attemptRows.latestForBrokerGroups(ids),
      this.groups.dealFacts([...new Set(groups.map((g) => g.dealId))]),
    ]);
    return groups.map((g) => presentGroup(g, bookings.get(g.id) ?? [], attempts.get(g.id) ?? null, deals.get(g.dealId) ?? null));
  }

  /** The dates a broker books, by the same rules as a guest: real, ahead, not too long, not too far. */
  private checkDates(checkIn: string, checkOut: string): number {
    if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut)) {
      throw new BadRequestException('Check-in and check-out must be real dates.');
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights <= 0) throw new BadRequestException('Check-out must be after check-in.');
    if (nights > MAX_NIGHTS) throw new BadRequestException(`Stays are limited to ${MAX_NIGHTS} nights.`);
    if (checkIn < localToday()) throw new BadRequestException('Check-in cannot be in the past.');
    if (daysFromToday(checkIn) > MAX_HORIZON_DAYS) throw new BadRequestException('Bookings open up to 18 months ahead.');
    return nights;
  }

  /** One room, priced the way a guest's own booking of it is. */
  private price(
    type: BrokerRoomTypeRow | undefined,
    room: CreateBrokerBookingRequest['rooms'][number],
    nights: number,
    index: number,
  ): GroupRoomLine {
    const which = `Room ${index + 1}`;
    if (!type || type.nightlyRateRwf == null || !type.bookingMode) {
      throw new BadRequestException(`${which}: that room type is not bookable at this hotel.`);
    }
    if (type.minStay != null && nights < type.minStay) {
      throw new BadRequestException(`${which}: ${type.name} needs at least ${type.minStay} nights.`);
    }
    const guests = room.adults + room.children;
    const capacity = type.capacity ?? DEFAULT_CAPACITY;
    if (guests > capacity) throw new BadRequestException(`${which}: ${type.name} sleeps at most ${capacity}.`);
    if (type.maxAdults != null && room.adults > type.maxAdults) {
      throw new BadRequestException(`${which}: ${type.name} takes at most ${type.maxAdults} adults.`);
    }
    if (type.maxChildren != null && room.children > type.maxChildren) {
      throw new BadRequestException(`${which}: ${type.name} takes at most ${type.maxChildren} children.`);
    }
    const rate = nightlyRateFor(
      { nightlyRateRwf: type.nightlyRateRwf, singleGuestPriceRwf: type.singleGuestPriceRwf, priceBasis: type.priceBasis },
      guests,
    );
    const breakdown = computeBreakdown({
      nightlyRateRwf: rate,
      nights,
      nonRefundable: false,
      guests,
      priceBasis: type.priceBasis as Parameters<typeof computeBreakdown>[0]['priceBasis'],
    });
    return {
      roomTypeId: type.id,
      roomTypeName: type.name,
      guestName: room.guestName.trim(),
      guestPhone: room.guestPhone?.trim() || null,
      adults: room.adults,
      children: room.children,
      lockedNightlyRwf: stayNightlyRateRwf(breakdown),
      grossRwf: breakdown.grossRwf,
      bookingMode: type.bookingMode,
      cancellationTier: type.cancellationTier,
    };
  }
}

function presentGroup(
  g: GroupRow,
  written: GroupBookingRow[],
  attempt: PaymentAttemptRow | null,
  deal: DealFacts | null,
): BrokerBookingGroup {
  // Bookings were written in the order of the rooms; pair each room with the next booking of its type.
  const pool = [...written];
  const rooms = g.rooms.map((line) => {
    const i = pool.findIndex((b) => b.roomTypeId === line.roomTypeId && (b.guestName ?? '') === line.guestName);
    const booking = i >= 0 ? pool.splice(i, 1)[0] : undefined;
    return {
      roomTypeId: line.roomTypeId,
      roomTypeName: line.roomTypeName,
      guestName: line.guestName,
      guestPhone: line.guestPhone,
      adults: line.adults,
      children: line.children,
      grossRwf: line.grossRwf,
      booking: booking ? { id: booking.id, reference: booking.reference, status: booking.status } : null,
    };
  });
  const commission = deal
    ? brokerCommissionFor(termsFromColumns(deal), g.totalRwf, g.rooms.length)
    : { commissionRwf: 0, brokerRwf: 0, injishiRwf: 0, note: null };
  return {
    id: g.id,
    reference: g.reference,
    hotel: { orgId: g.orgId, name: deal?.hotelName ?? 'The hotel' },
    dealId: g.dealId,
    checkIn: g.checkIn,
    checkOut: g.checkOut,
    nights: nightsBetween(g.checkIn, g.checkOut),
    payment: g.payment,
    status: g.status,
    totalRwf: g.totalRwf,
    commission,
    contactPhone: g.contactPhone,
    note: g.note,
    rooms,
    failureReason: g.failureReason,
    createdAt: g.createdAt.toISOString(),
    attempt:
      g.payment === 'momo' && attempt
        ? {
            attemptToken: attempt.attemptToken,
            state: attempt.state,
            payerMasked: attempt.payerMasked,
            expiresAt: attempt.expiresAt.toISOString(),
            failureReason: attempt.failureReason,
          }
        : null,
  };
}
