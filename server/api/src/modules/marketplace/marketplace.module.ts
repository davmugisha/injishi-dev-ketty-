import { Module } from '@nestjs/common';

import { ListingModule } from '../listing/listing.module';
import { StorageModule } from '../storage/storage.module';
import { ExploreService } from './application/explore.service';
import { MarketplaceService } from './application/marketplace.service';
import { ExploreRepository } from './infrastructure/explore.repository';
import { MarketplaceRepository } from './infrastructure/marketplace.repository';

/**
 * The interface marketplace and the guest's web account (real-data leaf 1.3.2). Depends on
 * `ListingModule` for the one rule of what is public; owns the marketplace cards, saved lists,
 * consent history and the account's contact details.
 *
 * Also the guest's explore read (mobile spec 0005, D-an): search, places and the property page over
 * the same public rule (`PUBLICLY_VISIBLE`, exported by the listing repository so the two cannot
 * drift), and unit photographs through `StorageService`.
 */
@Module({
  imports: [ListingModule, StorageModule],
  providers: [MarketplaceService, MarketplaceRepository, ExploreService, ExploreRepository],
  exports: [MarketplaceService, ExploreService],
})
export class MarketplaceModule {}
