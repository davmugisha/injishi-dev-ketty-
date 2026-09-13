import type {
  BookableRoom,
  PropertyCard,
  PropertyDetail,
  RoomTypeSummary,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, exists, isNotNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  amenities,
  districts,
  listings,
  outletParties,
  outletTenancies,
  outlets,
  properties,
  propertyAmenities,
  roomTypes,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { buildFacilities } from '../domain/facilities';

const operatorParty = alias(outletParties, 'operator_party');

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
        workspaceId: properties.workspaceId,
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

    const [types, facilities] = await Promise.all([
      this.findRoomTypes(propertyId),
      this.findFacilities(row.id, row.workspaceId),
    ]);

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
      facilities,
    };
  }

  /**
   * What the property offers, amenities and outlets deduped into one list
   * (ADR-050 D-k, AC-16).
   *
   * Visibility is decided HERE, in the query, because this read is public: only
   * active, guest visible outlets at this property, and an outlet run from
   * another workspace (a tenant, D-l) only while a tenancy for this property is
   * `active` (AC-18). Ending the tenancy removes it with no other write.
   */
  async findFacilities(
    propertyId: string,
    propertyWorkspaceId: string,
  ): Promise<PropertyDetail['facilities']> {
    const [amenityRows, outletRows] = await Promise.all([
      this.db
        .select({
          code: amenities.code,
          label: amenities.labelEn,
          category: amenities.category,
        })
        .from(propertyAmenities)
        .innerJoin(amenities, eq(amenities.code, propertyAmenities.amenityCode))
        .where(
          and(
            eq(propertyAmenities.propertyId, propertyId),
            eq(amenities.active, true),
          ),
        )
        .orderBy(sql`${amenities.category} NULLS LAST`, asc(amenities.labelEn)),
      this.db
        .select({
          id: outlets.id,
          name: outlets.name,
          outletKind: outlets.outletKind,
          orderingAccess: outlets.orderingAccess,
          hours: outlets.hours,
          amenityCode: outlets.amenityCode,
          relationshipType: outlets.relationshipType,
          operatorLegalName: operatorParty.legalName,
          sortOrder: outlets.sortOrder,
        })
        .from(outlets)
        .leftJoin(operatorParty, eq(operatorParty.id, outlets.operatorPartyId))
        .where(
          and(
            eq(outlets.propertyId, propertyId),
            eq(outlets.status, 'active'),
            eq(outlets.guestVisible, true),
            or(
              eq(outlets.workspaceId, propertyWorkspaceId),
              exists(
                this.db
                  .select({ one: sql`1` })
                  .from(outletTenancies)
                  .where(
                    and(
                      eq(outletTenancies.outletId, outlets.id),
                      eq(outletTenancies.hostPropertyId, propertyId),
                      eq(outletTenancies.status, 'active'),
                    ),
                  ),
              ),
            ),
          ),
        )
        .orderBy(asc(outlets.sortOrder), asc(outlets.name)),
    ]);

    return buildFacilities(amenityRows, outletRows);
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
   * Every published property with a public address, as discovery lists them
   * (booking audit, 2026-09-13). Same visibility rule as the detail reads: a
   * listing that is not `published` is absent. Bounded, and ordered by name so
   * the list is stable between requests.
   */
  async findPublishedCards(limit = 500): Promise<PropertyCard[]> {
    const rows = await this.db
      .select({
        id: properties.id,
        slug: properties.slug,
        name: properties.name,
        description: properties.description,
        districtName: districts.name,
        photoObjectKeys: properties.photoObjectKeys,
        fromNightlyRateRwf: sql<number | null>`min(${roomTypes.basePriceRwf}) filter (where ${roomTypes.status} = 'active' and ${roomTypes.domain} = 'hospitality')`,
        maxGuests: sql<number | null>`max(${roomTypes.capacity}) filter (where ${roomTypes.status} = 'active')`,
        roomTypeCount: sql<number>`count(${roomTypes.id}) filter (where ${roomTypes.status} = 'active')::int`,
      })
      .from(properties)
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .leftJoin(roomTypes, eq(roomTypes.propertyId, properties.id))
      .where(and(eq(listings.status, 'published'), isNotNull(properties.slug)))
      .groupBy(properties.id, districts.name)
      .orderBy(asc(properties.name))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug as string,
      name: row.name,
      description: row.description ?? null,
      districtName: row.districtName ?? null,
      photos: Array.isArray(row.photoObjectKeys) ? (row.photoObjectKeys as string[]).slice(0, 5) : [],
      // Aggregates over bigint come back as strings from pg.
      fromNightlyRateRwf: row.fromNightlyRateRwf === null ? null : Number(row.fromNightlyRateRwf),
      maxGuests: row.maxGuests === null ? null : Number(row.maxGuests),
      roomTypeCount: Number(row.roomTypeCount),
    }));
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
