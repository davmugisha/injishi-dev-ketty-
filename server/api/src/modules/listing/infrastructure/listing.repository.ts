import type {
  BookableRoom,
  PropertyDetail,
  RoomTypeSummary,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';

import {
  districts,
  listings,
  orgs,
  properties,
  propertyPhotos,
  roomTypes,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * **A property is publicly sellable when TWO things are true at once**
 * (ADR-049 contract rule 1, AC-I8).
 *
 * Its listing is `published` AND its owning business is `active`. Neither half
 * stands alone, there is no cached or denormalised third answer, and both are
 * checked on EVERY public read — which is what makes a suspension take effect
 * with no second write, and a reinstatement restore the listing for free.
 *
 * The alternative, flipping listings to `draft` on suspend, was rejected: it
 * states one rule in two places, and reinstatement would then leave the operator
 * to publish again, punishing a business for a suspension that was lifted.
 *
 * A module constant rather than a method, because it is the same two column
 * comparisons on every call.
 */
const PUBLICLY_VISIBLE = and(
  eq(listings.status, 'published'),
  eq(orgs.registrationStatus, 'active'),
);

/**
 * A public property as this repository reads it: the wire shape, except that its
 * photographs are ids rather than URLs.
 *
 * The URL a photograph is served at is built from the API's public origin, which
 * is configuration, so `ListingService` builds it. The repository never returns
 * an object key to a caller that could put one on the wire.
 */
export type PublicPropertyRecord = Omit<PropertyDetail, 'photos'> & {
  /** In the operator's order; the first is the cover. */
  photoIds: string[];
};

/** The checkout's read, with the cover as an id for the same reason. */
export interface BookableRoomRecord {
  property: Omit<BookableRoom['property'], 'photo'> & {
    coverPhotoId: string | null;
  };
  roomType: BookableRoom['roomType'];
}

/**
 * Infrastructure layer: the only place that touches Drizzle for listings.
 * Returns rows shaped to the @injishi/contracts wire types, photographs as ids.
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
  ): Promise<PublicPropertyRecord | null> {
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
      })
      .from(properties)
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      // The owning business, joined so its registration status can be asked about.
      // INNER, not left: a property whose org vanished is not publicly readable.
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .where(and(eq(properties.id, propertyId), PUBLICLY_VISIBLE))
      .limit(1);

    if (!row) return null;

    const [types, photoIds] = await Promise.all([
      this.findRoomTypes(propertyId),
      this.findPhotoIds(propertyId),
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
      photoIds,
      roomTypes: types,
    };
  }

  /**
   * Every publicly sellable property's address, for the sitemap (ADR-049, AC-I9).
   *
   * The SAME predicate as the property page, which is contract rule 1: a
   * suspension removes a property from the sitemap with no second write, and a
   * reinstatement restores it. A published listing always has a slug, because
   * publishing mints it; the null filter only guards a row nothing should write.
   *
   * Capped at the 50,000 URLs one sitemap file may hold. Newest publish first,
   * so if the cap is ever reached it is the oldest addresses that fall off, and
   * that is the day this becomes a sitemap index.
   */
  async findSitemapProperties(): Promise<
    { slug: string; publishedAt: Date | null }[]
  > {
    const rows = await this.db
      .select({ slug: properties.slug, publishedAt: listings.publishedAt })
      .from(properties)
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .where(and(PUBLICLY_VISIBLE, isNotNull(properties.slug)))
      .orderBy(desc(listings.publishedAt), asc(properties.slug))
      .limit(50_000);
    return rows.flatMap((r) =>
      r.slug ? [{ slug: r.slug, publishedAt: r.publishedAt ?? null }] : [],
    );
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
  ): Promise<PublicPropertyRecord | null> {
    const [row] = await this.db
      .select({ id: properties.id })
      .from(properties)
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .where(and(eq(properties.slug, slug), PUBLICLY_VISIBLE))
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
  async findBookableRoom(roomTypeId: string): Promise<BookableRoomRecord | null> {
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
      })
      .from(roomTypes)
      .innerJoin(properties, eq(properties.id, roomTypes.propertyId))
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .where(
        and(
          eq(roomTypes.id, roomTypeId),
          eq(roomTypes.status, 'active'),
          PUBLICLY_VISIBLE,
        ),
      )
      .limit(1);

    if (!row) return null;

    // The cover first. `position` is the operator's order and index 0 is the
    // cover, so the checkout shows the picture they chose for it.
    const [coverPhotoId = null] = await this.findPhotoIds(row.propertyId);

    return {
      property: {
        id: row.propertyId,
        slug: row.propertySlug ?? null,
        name: row.propertyName,
        districtName: row.districtName ?? null,
        checkInTime: row.checkInTime ?? null,
        checkOutTime: row.checkOutTime ?? null,
        coverPhotoId,
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

  /**
   * A property's photograph ids, in the operator's order (ADR-049).
   *
   * Rows now, not a `jsonb` array on `properties`. The cover is position 0, which
   * `property_photos` keeps as a real column rather than as "whichever key
   * happened to be first in the array".
   *
   * IDS, not keys and not signed URLs (owner ruling 2026-09-13). The bucket is
   * private and a signed URL expires, so a page cached for hours would serve dead
   * images. Each id becomes a stable photo route URL, and the route signs afresh
   * on every request after checking the visibility rule (`findPublicPhotoKey`).
   */
  private async findPhotoIds(propertyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: propertyPhotos.id })
      .from(propertyPhotos)
      .where(eq(propertyPhotos.propertyId, propertyId))
      .orderBy(asc(propertyPhotos.position));
    return rows.map((r) => r.id);
  }

  /**
   * The object key behind one public photograph, or null (ADR-049, the photo
   * route).
   *
   * The SAME predicate as every other public read, contract rule 1: the listing
   * `published` AND the owning business `active`. So a photograph of a
   * suspended business, of an unpublished listing, and one that does not exist
   * are all null, and the route cannot tell a stranger which it was.
   */
  async findPublicPhotoKey(photoId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ objectKey: propertyPhotos.objectKey })
      .from(propertyPhotos)
      .innerJoin(properties, eq(properties.id, propertyPhotos.propertyId))
      .innerJoin(listings, eq(listings.propertyId, properties.id))
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .where(and(eq(propertyPhotos.id, photoId), PUBLICLY_VISIBLE))
      .limit(1);
    return row?.objectKey ?? null;
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
