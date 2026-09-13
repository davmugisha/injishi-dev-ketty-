import {
  BookableRoom,
  PropertyDetail,
  type SitemapProperty,
} from '@injishi/contracts';
import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Redirect,
} from '@nestjs/common';

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

  /**
   * Every publicly sellable property's address → web's `/sitemap.xml`
   * (ADR-049, AC-I9). Same visibility rule as the page, so a suspended or
   * unpublished property is in neither. Declared above `:id` for the reason
   * above.
   */
  @Get('sitemap')
  sitemap(): Promise<SitemapProperty[]> {
    return this.listings.sitemapProperties();
  }

  /**
   * One public photograph → a fresh signed URL (ADR-049, owner ruling of
   * 2026-09-13).
   *
   * 302 to a short lived signed URL on the storage host when the photograph's
   * property is publicly visible, and a bare 404 otherwise, including for an id
   * that is not a uuid: a 400 there would tell a prober which ids are shaped
   * right. The redirect is `no-store` because its target expires in minutes;
   * the URL a page holds is this route's, which never does.
   *
   * No bytes pass through the API, so an image costs it one query and a
   * signature, and a suspension cuts every image on the very next request.
   *
   * `Cross-Origin-Resource-Policy: cross-origin` overrides helmet's
   * `same-origin` for this one route. The image is embedded by web, which is a
   * different origin from the API everywhere (`www.` and `api.` in
   * production), and a browser refuses to render a same-origin resource there:
   * every photograph arrived and drew nothing. A public photograph of a public
   * property is exactly the thing any page may embed; the route still refuses
   * one that is not public.
   */
  @Get('photos/:photoId')
  @Header('Cache-Control', 'no-store')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @Redirect()
  async photo(
    @Param('photoId') photoId: string,
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.listings.publicPhotoUrl(photoId);
    return { url, statusCode: 302 };
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
