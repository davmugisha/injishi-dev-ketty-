import type {
  BookableRoom,
  PropertyCard,
  PropertyDetail,
  RoomTypeSummary,
} from '@injishi/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { ListingRepository } from '../infrastructure/listing.repository';

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
  constructor(private readonly listings: ListingRepository) {}

  async getPublishedProperty(propertyId: string): Promise<PropertyDetail> {
    const property = await this.listings.findPublishedProperty(propertyId);
    if (!property) {
      // Unpublished, residence-only, or unknown all read as absent (FL06 §5C).
      throw new NotFoundException('Property not found.');
    }
    return property;
  }

  /** Every published property with a public address, for discovery. */
  listPublishedProperties(): Promise<PropertyCard[]> {
    return this.listings.findPublishedCards();
  }

  /** The same property, addressed by its public slug rather than its uuid. */
  async getPublishedPropertyBySlug(slug: string): Promise<PropertyDetail> {
    const property = await this.listings.findPublishedPropertyBySlug(slug);
    if (!property) {
      throw new NotFoundException('Property not found.');
    }
    return property;
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
    return room;
  }

  /**
   * The Room type a booking is being made against (F-B05: one per Booking in
   * v1). Returns null when it does not exist or is not `active`; the caller
   * decides which 4xx that is, since "unknown room type" reads differently on
   * the booking path than on the browse path.
   */
  async findBookableRoomType(
    roomTypeId: string,
  ): Promise<BookableRoomType | null> {
    return this.listings.findRoomTypeForBooking(roomTypeId);
  }
}
