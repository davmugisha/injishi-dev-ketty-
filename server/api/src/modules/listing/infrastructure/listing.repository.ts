import type {
  BookableRoom,
  PropertyDetail,
  RoomTypeSummary,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import {
  districts,
  listings,
  properties,
  roomTypes,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * Infrastructure layer: the only place that touches Drizzle for listings.
 * Returns rows already shaped to the @injishi/contracts wire types.
 */
@Injectable()
export class ListingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Public property detail (F-B15). Only a **published** listing is reachable
   * publicly; an unpublished/draft property reads as absent.
   */
  async findPublishedProperty(
    propertyId: string,
  ): Promise<PropertyDetail | null> {
    const [row] = await this.db
      .select({
        id: properties.id,
        slug: properties.slug,
        name: properties.name,
        description: properties.description,
        districtName: districts.name,
        latitude: properties.latitude,
        longitude: properties.longitude,
        locationPrivacy: properties.locationPrivacy,
        checkInTime: properties.checkInTime,
        checkOutTime: properties.checkOutTime,
        houseRules: properties.houseRules,
        photoObjectKeys: properties.photoObjectKeys,
      })
      .from(properties)
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .where(
        and(eq(properties.id, propertyId), eq(listings.status, 'published')),
      )
      .limit(1);

    if (!row) return null;

    const types = await this.findRoomTypes(propertyId);

    return {
      id: row.id,
      slug: row.slug ?? null,
      name: row.name,
      description: row.description,
      districtName: row.districtName ?? null,
      // numeric columns come back as strings from pg; normalise to number|null.
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      locationPrivacy: row.locationPrivacy,
      checkInTime: row.checkInTime ?? null,
      checkOutTime: row.checkOutTime ?? null,
      houseRules: row.houseRules ?? null,
      photos: Array.isArray(row.photoObjectKeys)
        ? (row.photoObjectKeys as string[])
        : [],
      roomTypes: types,
    };
  }

  /**
   * The published property behind a public slug (F-B15).
   *
   * Same visibility rule and same shape as `findPublishedProperty`; only the
   * key differs. The marketplace addresses a property by the name it trades
   * under, so this is the lookup every public page uses and the uuid form is
   * for internal callers that already hold an id.
   */
  async findPublishedPropertyBySlug(
    slug: string,
  ): Promise<PropertyDetail | null> {
    const [row] = await this.db
      .select({ id: properties.id })
      .from(properties)
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .where(and(eq(properties.slug, slug), eq(listings.status, 'published')))
      .limit(1);

    return row ? this.findPublishedProperty(row.id) : null;
  }

  /**
   * One bookable room type and the property it belongs to, from the room type
   * alone (checkout).
   *
   * The property is JOINED rather than accepted from the caller. A checkout url
   * used to carry both ids and the server trusted them as a pair, so a
   * hand-edited link could price one property's room against another's page.
   * There is no pair to disagree here.
   *
   * `published` is enforced the same way `findPublishedProperty` enforces it,
   * so an unlisted or draft property cannot be reached by guessing a room type
   * id — and an inactive room type reads as absent rather than as unbookable,
   * because the two are the same answer to a stranger.
   */
  async findBookableRoom(roomTypeId: string): Promise<BookableRoom | null> {
    const [row] = await this.db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        domain: roomTypes.domain,
        capacity: roomTypes.capacity,
        roomCount: roomTypes.roomCount,
        nightlyRateRwf: roomTypes.basePriceRwf,
        bookingMode: roomTypes.bookingMode,
        approvalPolicy: roomTypes.approvalPolicy,
        cancellationTier: roomTypes.cancellationTier,
        nonrefundableEligible: roomTypes.nonrefundableEligible,
        minStay: roomTypes.minStay,
        propertyId: properties.id,
        propertySlug: properties.slug,
        propertyName: properties.name,
        districtName: districts.name,
        checkInTime: properties.checkInTime,
        checkOutTime: properties.checkOutTime,
        photoObjectKeys: properties.photoObjectKeys,
      })
      .from(roomTypes)
      .innerJoin(properties, eq(properties.id, roomTypes.propertyId))
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .where(
        and(
          eq(roomTypes.id, roomTypeId),
          eq(roomTypes.status, 'active'),
          eq(listings.status, 'published'),
        ),
      )
      .limit(1);

    if (!row) return null;

    const photos = Array.isArray(row.photoObjectKeys)
      ? (row.photoObjectKeys as string[])
      : [];

    return {
      property: {
        id: row.propertyId,
        slug: row.propertySlug ?? null,
        name: row.propertyName,
        districtName: row.districtName ?? null,
        checkInTime: row.checkInTime ?? null,
        checkOutTime: row.checkOutTime ?? null,
        photo: photos[0] ?? null,
      },
      roomType: {
        id: row.id,
        name: row.name,
        domain: row.domain,
        capacity: row.capacity ?? null,
        roomCount: row.roomCount,
        nightlyRateRwf: row.nightlyRateRwf ?? null,
        bookingMode: row.bookingMode,
        approvalPolicy: row.approvalPolicy,
        cancellationTier: row.cancellationTier,
        nonrefundableEligible: row.nonrefundableEligible,
        minStay: row.minStay ?? null,
      },
    };
  }

  /** Active Room types for a property, cheapest first. */
  async findRoomTypes(propertyId: string): Promise<RoomTypeSummary[]> {
    const rows = await this.db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        domain: roomTypes.domain,
        capacity: roomTypes.capacity,
        roomCount: roomTypes.roomCount,
        nightlyRateRwf: roomTypes.basePriceRwf,
        bookingMode: roomTypes.bookingMode,
        approvalPolicy: roomTypes.approvalPolicy,
        cancellationTier: roomTypes.cancellationTier,
        nonrefundableEligible: roomTypes.nonrefundableEligible,
        minStay: roomTypes.minStay,
      })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.status, 'active'),
        ),
      )
      .orderBy(roomTypes.basePriceRwf);

    return rows.map((r) => ({
      ...r,
      capacity: r.capacity ?? null,
      nightlyRateRwf: r.nightlyRateRwf ?? null,
      minStay: r.minStay ?? null,
    }));
  }

  /** The single Room type a booking is being made against (F-B05: one per Booking in v1). */
  async findRoomTypeForBooking(roomTypeId: string): Promise<
    | (RoomTypeSummary & { propertyId: string; workspaceId: string })
    | null
  > {
    const [row] = await this.db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        domain: roomTypes.domain,
        capacity: roomTypes.capacity,
        roomCount: roomTypes.roomCount,
        nightlyRateRwf: roomTypes.basePriceRwf,
        bookingMode: roomTypes.bookingMode,
        approvalPolicy: roomTypes.approvalPolicy,
        cancellationTier: roomTypes.cancellationTier,
        nonrefundableEligible: roomTypes.nonrefundableEligible,
        minStay: roomTypes.minStay,
        propertyId: roomTypes.propertyId,
        workspaceId: roomTypes.workspaceId,
      })
      .from(roomTypes)
      .where(
        and(eq(roomTypes.id, roomTypeId), eq(roomTypes.status, 'active')),
      )
      .limit(1);

    if (!row) return null;
    return {
      ...row,
      capacity: row.capacity ?? null,
      nightlyRateRwf: row.nightlyRateRwf ?? null,
    };
  }
}
