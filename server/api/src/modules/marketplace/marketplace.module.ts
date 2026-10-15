import { Module } from '@nestjs/common';

import { ListingModule } from '../listing/listing.module';
import { MarketplaceService } from './application/marketplace.service';
import { MarketplaceRepository } from './infrastructure/marketplace.repository';

/**
 * The interface marketplace and the guest's web account (real-data leaf 1.3.2). Depends on
 * `ListingModule` for the one rule of what is public; owns the marketplace cards, saved lists,
 * consent history and the account's contact details.
 */
@Module({
  imports: [ListingModule],
  providers: [MarketplaceService, MarketplaceRepository],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
