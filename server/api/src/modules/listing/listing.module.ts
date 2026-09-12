import { Module } from '@nestjs/common';

import { ListingService } from './application/listing.service';
import { ListingRepository } from './infrastructure/listing.repository';

/**
 * Layering: domain/ (entities, rules) - application/ (use cases) -
 * infrastructure/ (persistence, adapters). Never import another domain module
 * directly; communicate via events or application services.
 *
 * Exports **only** ListingService. BookingModule needs the Room type (rate,
 * mode, capacity) to price and validate a booking and gets it via
 * `ListingService.findBookableRoomType()`; ListingRepository stays private to
 * this module, so no other module can be coupled to the inventory tables' shape.
 */
@Module({
  providers: [ListingRepository, ListingService],
  exports: [ListingService],
})
export class ListingModule {}
