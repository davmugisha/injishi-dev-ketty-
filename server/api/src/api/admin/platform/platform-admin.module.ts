import { Module } from '@nestjs/common';

import { AdminSharedModule } from '../admin-shared.module';
import { AdminAnalyticsController } from './analytics/analytics.controller';
import { AdminAnalyticsService } from './analytics/analytics.service';
import { AdminAnnouncementsController } from './announcements/announcements.controller';
import { AdminAnnouncementsService } from './announcements/announcements.service';
import { AdminEnvironmentsController } from './environments/environments.controller';
import { AdminEnvironmentsService } from './environments/environments.service';
import { PlatformHealthSnapshotService } from './health-snapshots.service';
import { AdminLocalizationController } from './localization/localization.controller';
import { AdminLocalizationService } from './localization/localization.service';
import { AdminOverviewController } from './overview/overview.controller';
import { AdminOverviewService } from './overview/overview.service';
import { AdminSystemHealthController } from './system-health/system-health.controller';
import { AdminSystemHealthService } from './system-health/system-health.service';

/**
 * The six PLATFORM sections of the admin console — Overview, System health,
 * Environments, Analytics, Announcements and Localization (INTERFACE.md §§1,
 * 9, 10, 12, 13, 14).
 *
 * One module, one name, imported by `admin-api.module.ts` and nothing else.
 * The four area leaves each export exactly one `<Area>AdminModule` so no two of
 * them ever edit the same file — which is the only reason four people can wire
 * fourteen sections at once without a merge conflict on every commit.
 *
 * `AuthModule` is imported so `SessionGuard` can resolve `AUTH_INSTANCE`; the
 * guard is declared on every controller here and would fail at boot without it.
 * `WorkspaceService` is provided because `StaffGuard` depends on it — it is the
 * ONE reader of `admin_users`, the same one `/api/v1/me/staff` calls, so the
 * console and the API can never be told different things about who is staff.
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without an import.
 *
 * `PlatformHealthSnapshotService` is provided ONCE and injected by three
 * services. Overview, System health and Environments all show adapter or queue
 * health, and three copies of "newest row per adapter" is how three screens end
 * up disagreeing about whether the payment seam is up.
 */
@Module({
  imports: [AdminSharedModule],
  controllers: [
    AdminOverviewController,
    AdminSystemHealthController,
    AdminEnvironmentsController,
    AdminAnalyticsController,
    AdminAnnouncementsController,
    AdminLocalizationController,
  ],
  providers: [
    PlatformHealthSnapshotService,
    AdminOverviewService,
    AdminSystemHealthService,
    AdminEnvironmentsService,
    AdminAnalyticsService,
    AdminAnnouncementsService,
    AdminLocalizationService,
  ],
})
export class PlatformAdminModule {}
