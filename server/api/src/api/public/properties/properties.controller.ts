import { BookableRoom, type PropertyCard, PropertyDetail } from '@injishi/contracts';
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { ListingService } from '../../../modules/listing/application/listing.service';
import { PreLaunchGuard } from '../../../shared/pre-launch/pre-launch.guard';

/**
 * Public API for property detail → /api/v1/properties/:id (F-B15).
 * Public browse: no auth (the sign-in gate fires at booking, not before — FL03).
 *
 * `slug/:slug` is the form the MARKETPLACE uses, because `/property/[slug]` is
 * the page strangers read and a uuid is not an address. It is declared ABOVE
 * `:id` deliberately: Nest matches routes in declaration order, and a literal
 * segment registered after a parameter segment is shadowed by it.
 */
// PRE-LAUNCH (ADR-048): answers 404 on the production API host, and passes
// everything through on every other host. The website puts a waitlist in front
// of the marketplace, and leaving the catalogue readable as JSON here would be
// a wall with a door beside it. Removed at launch, per apps/web/WAITLIST-REMOVAL.md.
@UseGuards(PreLaunchGuard)
@Controller({ path: 'properties', version: '1' })
export class PropertiesController {
  constructor(private readonly listings: ListingService) {}

  /**
   * Every published property with a public address, for Explore (booking
   * audit, 2026-09-13). Explore was built only from the web app's own
   * catalogue, so inventory created and published in the operator app could
   * not be found by anyone who did not already hold its link.
   */
  @Get()
  list(): Promise<PropertyCard[]> {
    return this.listings.listPublishedProperties();
  }

  @Get('slug/:slug')
  getBySlug(@Param('slug') slug: string): Promise<PropertyDetail> {
    return this.listings.getPublishedPropertyBySlug(slug);
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PropertyDetail> {
    return this.listings.getPublishedProperty(id);
  }
}

/**
 * The checkout's read → /api/v1/bookable/:roomTypeId.
 *
 * Its own controller rather than a third route on `properties`, because it is
 * keyed by a ROOM TYPE and nesting it under the property would ask the client
 * for an id it should not have to know — which is the whole point of the
 * change. The property comes back joined, so a checkout link carries one id and
 * cannot name a room and a property that disagree.
 *
 * Unauthenticated, like the rest of browse: a guest prices a stay before they
 * sign in, and the gate fires when they press confirm.
 */
// PRE-LAUNCH (ADR-048): answers 404 on the production API host, and passes
// everything through on every other host. The website puts a waitlist in front
// of the marketplace, and leaving the catalogue readable as JSON here would be
// a wall with a door beside it. Removed at launch, per apps/web/WAITLIST-REMOVAL.md.
@UseGuards(PreLaunchGuard)
@Controller({ path: 'bookable', version: '1' })
export class BookableController {
  constructor(private readonly listings: ListingService) {}

  @Get(':roomTypeId')
  get(
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
  ): Promise<BookableRoom> {
    return this.listings.getBookableRoom(roomTypeId);
  }
}
