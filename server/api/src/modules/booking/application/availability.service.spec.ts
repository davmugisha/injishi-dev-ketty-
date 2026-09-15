import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ListingService } from '../../listing/application/listing.service';
import type { BookingRepository } from '../infrastructure/booking.repository';
import { AvailabilityService } from './availability.service';
import { localToday } from '../domain/pricing';

/**
 * What is left to sell (ADR-047 wave E).
 *
 * The interval is the whole correctness of this feature and it is the easy
 * thing to get wrong in either direction: too generous oversells somebody's
 * real hotel, too strict invents a night nobody can ever buy. It is pinned
 * here, along with the two refusals that stop this unauthenticated read being
 * a denial-of-service lever.
 */
describe('AvailabilityService', () => {
  const ROOM_TYPE = '44444444-4444-4444-4444-444444444444';

  function futureDay(daysAhead: number): string {
    const d = new Date(`${localToday()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  }

  function build(
    overrides: {
      nights?: { night: string; freeUnits: number }[];
      roomCount?: number;
      minStay?: number | null;
      domain?: 'hospitality' | 'residence';
    } = {},
  ): {
    service: AvailabilityService;
    freeUnitsByNight: jest.Mock;
    listings: { getBookableRoom: jest.Mock };
  } {
    const freeUnitsByNight = jest
      .fn()
      .mockResolvedValue(overrides.nights ?? []);

    const listings = {
      getBookableRoom: jest.fn().mockResolvedValue({
        property: { id: 'p1', slug: 'x', name: 'X', districtName: null, checkInTime: null, checkOutTime: null, photo: null },
        roomType: {
          id: ROOM_TYPE,
          name: 'Standard',
          domain: overrides.domain ?? 'hospitality',
          capacity: 2,
          roomCount: overrides.roomCount ?? 3,
          nightlyRateRwf: 45_000,
          bookingMode: 'request_to_book',
          approvalPolicy: 'approve_all',
          cancellationTier: 'moderate',
          nonrefundableEligible: true,
          minStay: overrides.minStay === undefined ? null : overrides.minStay,
        },
      }),
    };

    const service = new AvailabilityService(
      { freeUnitsByNight } as unknown as BookingRepository,
      listings as unknown as ListingService,
    );
    return { service, freeUnitsByNight, listings };
  }

  it('asks the repository for the half-open night range it was given', async () => {
    const from = futureDay(10);
    const to = futureDay(13);
    const { service, freeUnitsByNight } = build();

    await service.forRoomType(ROOM_TYPE, from, to);

    // Three nights: the 10th, 11th and 12th. `to` is the morning after the
    // last night, the same shape as a check-out — so the room is free again on
    // that date for the next guest's arrival.
    expect(freeUnitsByNight).toHaveBeenCalledWith(ROOM_TYPE, from, to);
  });

  it('reports a minimum stay of 1 when the host set none', async () => {
    const { service } = build({ minStay: null });
    const result = await service.forRoomType(ROOM_TYPE, futureDay(1), futureDay(2));
    expect(result.minStay).toBe(1);
  });

  it('passes the host’s real minimum stay through untouched', async () => {
    const { service } = build({ minStay: 3 });
    const result = await service.forRoomType(ROOM_TYPE, futureDay(1), futureDay(2));
    expect(result.minStay).toBe(3);
  });

  it('answers nights in the past as sold out rather than asking about them', async () => {
    const { service, freeUnitsByNight } = build({
      nights: [{ night: localToday(), freeUnits: 2 }],
    });

    const result = await service.forRoomType(
      ROOM_TYPE,
      // Two days behind: nothing can be booked there, and the query must not
      // waste a `generate_series` on it either.
      futureDay(-2),
      futureDay(1),
    );

    expect(freeUnitsByNight.mock.calls[0][1]).toBe(localToday());
    expect(result.nights[0]).toEqual({ night: futureDay(-2), freeUnits: 0 });
    expect(result.nights[1]).toEqual({ night: futureDay(-1), freeUnits: 0 });
  });

  it('reports nothing free beyond the booking horizon, whatever the bookings say', async () => {
    const beyond = futureDay(600);
    const { service } = build({ nights: [{ night: beyond, freeUnits: 3 }] });

    const result = await service.forRoomType(ROOM_TYPE, futureDay(599), futureDay(601));

    // The repository says three units are free. Nothing can be SOLD there —
    // `MAX_HORIZON_DAYS` is 540 — so offering it would be a date the API
    // refuses at the last click.
    expect(result.nights.find((n) => n.night === beyond)?.freeUnits).toBe(0);
  });

  it('refuses a window nobody needs, because this read is unauthenticated', async () => {
    const { service } = build();
    await expect(
      service.forRoomType(ROOM_TYPE, futureDay(1), futureDay(5000)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['not a date', 'yesterday', '2026-10-02'],
    ['an impossible date', '2026-02-31', '2026-03-02'],
    ['a reversed range', '2026-10-05', '2026-10-02'],
    ['a zero-night range', '2026-10-05', '2026-10-05'],
  ])('refuses %s', async (_label, from, to) => {
    const { service } = build();
    await expect(service.forRoomType(ROOM_TYPE, from, to)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('treats a residence unit as absent, the same as an unknown room type', async () => {
    const { service } = build({ domain: 'residence' });
    await expect(
      service.forRoomType(ROOM_TYPE, futureDay(1), futureDay(3)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves the room through ListingService, so unpublished inventory stays hidden', async () => {
    const { service, listings } = build();
    await service.forRoomType(ROOM_TYPE, futureDay(1), futureDay(3));

    // `getBookableRoom` is the method that enforces "active room type on a
    // published listing". Reading the room type directly here would have made
    // this route an enumeration surface over other people's draft inventory.
    expect(listings.getBookableRoom).toHaveBeenCalledWith(ROOM_TYPE);
  });
});
