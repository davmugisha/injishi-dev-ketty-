import type {
  BookableRoom,
  PropertyCard,
  PropertyDetail,
  RoomTypeSummary,
  SitemapProperty,
} from '@injishi/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { StorageService } from '../../storage/application/storage.service';
import {
  PHOTO_SIGNED_URL_TTL_SECONDS,
  isPhotoId,
  photoRouteUrl,
} from '../domain/photo-route';
import {
  ListingRepository,
  type PublicPropertyRecord,
} from '../infrastructure/listing.repository';

/**
 * The API's public origin, which photo route URLs are built on. Provided by
 * `ListingModule` from `BETTER_AUTH_URL`; see `apiPublicOrigin`.
 */
export const API_PUBLIC_ORIGIN = Symbol('API_PUBLIC_ORIGIN');

/**
 * The Room type as another module sees it: enough to price and validate a
 * commitment against, and nothing more. This is the module's published shape —
 * the Drizzle row type stays behind the repository, so a schema change here
 * does not ripple into BookingModule.
 */
export interface BookableRoomType extends RoomTypeSummary {
  propertyId: string;
  workspaceId: string;
}

/**
 * Application service for the public listing read path (F-B15 / FL06).
 * Public browse — no auth required (the sign-in gate fires at booking).
 *
 * This is also ListingModule's **only** outward-facing surface: other modules
 * (BookingModule) depend on this service, never on ListingRepository, per the
 * architecture.md invariant "modules communicate via events or application
 * services". The repository stays internal to this module.
 */
@Injectable()
export class ListingService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly storage: StorageService,
    @Inject(API_PUBLIC_ORIGIN) private readonly origin: string,
  ) {}

  async getPublishedProperty(propertyId: string): Promise<PropertyDetail> {
    const property = await this.listings.findPublishedProperty(propertyId);
    if (!property) {
      // Unpublished, residence-only, or unknown all read as absent (FL06 §5C).
      throw new NotFoundException('Property not found.');
    }
    return this.toWire(property);
  }

  /** Every publicly sellable property's address, for the sitemap (AC-I9). */
  async sitemapProperties(): Promise<SitemapProperty[]> {
    const rows = await this.listings.findSitemapProperties();
    return rows.map((r) => ({
      slug: r.slug,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Every publicly sellable property with a public address, for discovery. Its
   * photographs leave as photo route URLs, as the detail read's do.
   */
  async listPublishedProperties(): Promise<PropertyCard[]> {
    const cards = await this.listings.findPublishedCards();
    return cards.map(({ photoIds, ...card }) => ({
      ...card,
      photos: photoIds.map((id) => photoRouteUrl(this.origin, id)),
    }));
  }

  /** The same property, addressed by its public slug rather than its uuid. */
  async getPublishedPropertyBySlug(slug: string): Promise<PropertyDetail> {
    const property = await this.listings.findPublishedPropertyBySlug(slug);
    if (!property) {
      throw new NotFoundException('Property not found.');
    }
    return this.toWire(property);
  }

  /**
   * Where one public photograph can be read right now: a signed URL, valid for a
   * few minutes, for the photo route to redirect to (ADR-053, owner ruling of
   * 2026-09-13).
   *
   * One 404 for every refusal: an id that is not a uuid, a photograph that does
   * not exist, and one whose property is not publicly visible. Telling them apart
   * would let a stranger probe for other businesses' unpublished inventory, the
   * same reason `getBookableRoom` collapses its four cases.
   */
  async publicPhotoUrl(photoId: string): Promise<string> {
    const objectKey = isPhotoId(photoId)
      ? await this.listings.findPublicPhotoKey(photoId)
      : null;
    if (!objectKey) {
      throw new NotFoundException();
    }
    return this.storage.signedUrl(objectKey, PHOTO_SIGNED_URL_TTL_SECONDS);
  }

  /**
   * One bookable room and the property it belongs to — what the checkout reads.
   *
   * A 404 here covers four different facts on purpose: no such room type, an
   * inactive one, an unpublished property, and a residence unit. To a stranger
   * guessing ids they are the same answer, and telling them apart is an
   * enumeration surface over other people's unpublished inventory.
   */
  async getBookableRoom(roomTypeId: string): Promise<BookableRoom> {
    const room = await this.listings.findBookableRoom(roomTypeId);
    if (!room) {
      throw new NotFoundException('That room is no longer offered.');
    }
    // Residence inventory is never bookable as a stay (FL06 §5C), which is the
    // fourth fact the 404 above covers — and which this method did not actually
    // check until 2026-09-16. `BookingService.create` has always refused a
    // non-hospitality room type, so the two answers disagreed: this read priced
    // a residence unit and reported a `bookingMode` for it, and the confirm that
    // followed was refused with "That room type is not bookable." A hand-edited
    // `/book?roomType=<residence id>` therefore reached a fully priced checkout
    // form that could never complete. One rule decides bookability, and it is
    // the domain — not the `booking_mode` column, which a residence row should
    // not be carrying in the first place (see `seed-content.mjs`).
    if (room.roomType.domain !== 'hospitality') {
      throw new NotFoundException('That room is no longer offered.');
    }
    const { coverPhotoId, ...property } = room.property;
    return {
      property: {
        ...property,
        photo: coverPhotoId ? photoRouteUrl(this.origin, coverPhotoId) : null,
      },
      roomType: room.roomType,
    };
  }

  /**
   * The Room type a booking is being made against (F-B05: one per Booking in
   * v1). Returns null when it does not exist, is not `active`, or its property
   * is not publicly visible (unpublished, or its business not active); the caller
   * decides which 4xx that is, since "unknown room type" reads differently on
   * the booking path than on the browse path.
   */
  async findBookableRoomType(
    roomTypeId: string,
  ): Promise<BookableRoomType | null> {
    return this.listings.findRoomTypeForBooking(roomTypeId);
  }

  /** Photograph ids become their stable public URLs; nothing else changes. */
  private toWire(record: PublicPropertyRecord): PropertyDetail {
    const { photoIds, ...property } = record;
    return {
      ...property,
      photos: photoIds.map((id) => photoRouteUrl(this.origin, id)),
    };
  }
}
