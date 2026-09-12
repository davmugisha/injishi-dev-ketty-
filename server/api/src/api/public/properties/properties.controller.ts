import { BookableRoom, PropertyDetail } from '@injishi/contracts';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { ListingService } from '../../../modules/listing/application/listing.service';

/**
 * Public API for property detail → /api/v1/properties/:id (F-B15).
 * Public browse: no auth (the sign-in gate fires at booking, not before — FL03).
 *
 * `slug/:slug` is the form the MARKETPLACE uses, because `/property/[slug]` is
 * the page strangers read and a uuid is not an address. It is declared ABOVE
 * `:id` deliberately: Nest matches routes in declaration order, and a literal
 * segment registered after a parameter segment is shadowed by it.
 */
@Controller({ path: 'properties', version: '1' })
export class PropertiesController {
  constructor(private readonly listings: ListingService) {}

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
