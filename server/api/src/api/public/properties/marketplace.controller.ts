import { type MarketCatalogue, type MarketPropertyPage, type MarketQuote, MarketQuoteQuery, type MarketRooms } from '@injishi/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';

import { MarketplaceService } from '../../../modules/marketplace/application/marketplace.service';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The interface marketplace's public reads → /api/v1/marketplace/* (real-data leaf 1.3.2).
 *
 * Public browse, no session, exactly like `/properties`: a guest looks before they sign in, and the
 * sign-in gate fires at booking. What is public is `ListingService`'s answer (a published listing of
 * an active business); these routes add the marketplace card on top and list only properties that
 * have one. An unknown, hidden or card-less slug is the same 404.
 */
@Controller({ path: 'marketplace', version: '1' })
export class MarketplaceController {
  constructor(private readonly market: MarketplaceService) {}

  /** Every public property that has a marketplace card, stays and homes together. */
  @Get('listings')
  listings(): Promise<MarketCatalogue> {
    return this.market.catalogue();
  }

  /** Every room card of a public property. */
  @Get('rooms')
  rooms(): Promise<MarketRooms> {
    return this.market.rooms();
  }

  /** What a stay would cost and refund, priced the way the booking service charges. */
  @Get('quote')
  quote(@Query(new ZodValidationPipe(MarketQuoteQuery)) query: MarketQuoteQuery): Promise<MarketQuote> {
    return this.market.quote(query);
  }

  /** One property page by its public slug. */
  @Get('properties/:slug')
  property(@Param('slug') slug: string): Promise<MarketPropertyPage> {
    return this.market.page(slug);
  }
}
