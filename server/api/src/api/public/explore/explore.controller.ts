import {
  type ExplorePage,
  type ExplorePlaces,
  ExplorePlacesQuery,
  ExploreSearchQuery,
  type ExploreSearchResult,
} from '@injishi/contracts';
import { Controller, Get, Param, Query, Res } from '@nestjs/common';

import { ExploreService } from '../../../modules/marketplace/application/explore.service';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/** The minimum of a Fastify reply the photo route touches. */
interface PhotoReply {
  status(code: number): PhotoReply;
  header(key: string, value: string): PhotoReply;
  send(payload?: Buffer | string): PhotoReply;
}

/**
 * Explore → /api/v1/explore/* (mobile spec 0005, feature 23, D-an): the guest's search over stays
 * and homes, the place suggestions, the property page and unit photographs.
 *
 * Public, no session: a traveller looks before they make an account. What is visible is the canonical
 * public rule (a published listing of an active business) plus a public address and not archived,
 * whether or not the property has a marketplace profile; anything else is the same 404. `/marketplace/*`
 * and `/properties*` stay as they are for the web and the operator app.
 */
@Controller({ path: 'explore', version: '1' })
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}

  /** A page of matches, sorted and counted on the server (AC-4 to AC-6). */
  @Get('search')
  search(@Query(new ZodValidationPipe(ExploreSearchQuery)) query: ExploreSearchQuery): Promise<ExploreSearchResult> {
    return this.explore.search(query);
  }

  /** Districts, sectors and properties for two letters or more (AC-5). */
  @Get('places')
  places(@Query(new ZodValidationPipe(ExplorePlacesQuery)) query: ExplorePlacesQuery): Promise<ExplorePlaces> {
    return this.explore.places(query);
  }

  /** One property page, a stay or a home (AC-7). */
  @Get('properties/:slug')
  page(@Param('slug') slug: string): Promise<ExplorePage> {
    return this.explore.page(slug);
  }

  /**
   * One public unit photograph → a fresh signed URL, exactly as `/properties/photos/:photoId` serves a
   * property photograph: a 302 that is `no-store` (ADR-053, D-ay), so a suspension cuts it on the next
   * request; `cross-origin` so a web page may embed it; and the local disk adapter's bytes inline,
   * because a redirect to a `data:` URL draws nothing. `@Res()` without `passthrough`, for the reason
   * `PropertiesController.photo` gives.
   */
  @Get('unit-photos/:photoId')
  async unitPhoto(@Param('photoId') photoId: string, @Res() reply: PhotoReply): Promise<void> {
    const url = await this.explore.unitPhotoUrl(photoId);
    reply.header('Cache-Control', 'no-store').header('Cross-Origin-Resource-Policy', 'cross-origin');
    const inline = /^data:([^;,]+);base64,/.exec(url);
    if (inline) {
      reply.header('Content-Type', inline[1]!).send(Buffer.from(url.slice(inline[0].length), 'base64'));
      return;
    }
    reply.status(302).header('Location', url).send();
  }
}
