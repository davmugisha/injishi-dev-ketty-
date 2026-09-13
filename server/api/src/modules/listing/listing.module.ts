import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageModule } from '../storage/storage.module';
import {
  API_PUBLIC_ORIGIN,
  ListingService,
} from './application/listing.service';
import { apiPublicOrigin } from './domain/photo-route';
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
 *
 * `StorageModule` is imported for `StorageService.signedUrl`, which the public
 * photo route redirects to (ADR-053). The origin photo URLs are built on is read
 * once, here, from the same variable Better Auth builds its links on.
 */
@Module({
  imports: [StorageModule],
  providers: [
    ListingRepository,
    ListingService,
    {
      provide: API_PUBLIC_ORIGIN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): string =>
        apiPublicOrigin({
          BETTER_AUTH_URL: config.get<string>('BETTER_AUTH_URL'),
          PORT: config.get<string>('PORT'),
        }),
    },
  ],
  exports: [ListingService],
})
export class ListingModule {}
