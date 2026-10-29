import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { MailerModule } from '../mailer/mailer.module';
import { GuestHousekeepingService } from './application/guest-housekeeping.service';
import { GuestRegistryService } from './application/guest-registry.service';
import { GuestReportsService } from './application/guest-reports.service';
import { GuestRoutingService } from './application/guest-routing.service';
import { HotelGuestFilingService } from './application/hotel-guest-filing.service';
import { LeaderConsoleService } from './application/leader-console.service';
import { GuestNotifier } from './infrastructure/guest-notifier';
import { GuestRegistryRepository } from './infrastructure/guest-registry.repository';
import { GuestRoutingProcessor } from './infrastructure/guest-routing.processor';

/**
 * Guests and local leaders (P5): registering a guest (a tenant for their
 * lease, a landlord for their own guests), routing it along the leader chain,
 * the leader's console and reports, and the hourly hand-over and the 12 month
 * purge (worker only). Admin's appointments use `GuestRoutingService` to hand
 * waiting guests to a new post and release an ended one.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named;
 * the mail goes through `MailerModule`'s port.
 */
@Module({
  imports: [MailerModule],
  providers: [
    GuestRegistryRepository,
    GuestNotifier,
    GuestRoutingService,
    GuestRegistryService,
    LeaderConsoleService,
    GuestReportsService,
    GuestHousekeepingService,
    HotelGuestFilingService,
    ...(isWorkerProcess() ? [GuestRoutingProcessor] : []),
  ],
  exports: [GuestNotifier, GuestRoutingService, GuestRegistryService, LeaderConsoleService, GuestReportsService, GuestHousekeepingService, HotelGuestFilingService],
})
export class GuestsModule {}
