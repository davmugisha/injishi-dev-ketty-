import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from '../../modules/auth/auth.module';
import { BookingModule } from '../../modules/booking/booking.module';
import { GeographyModule } from '../../modules/geography/geography.module';
import { ListingSetupModule } from '../../modules/listing-setup/listing-setup.module';
import { ListingModule } from '../../modules/listing/listing.module';
import { OperationsModule } from '../../modules/operations/operations.module';
import { OrganizationModule } from '../../modules/organization/organization.module';
import { StorageModule } from '../../modules/storage/storage.module';
import { UserModule } from '../../modules/user/user.module';
import { TwoFactorService } from '../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../shared/auth/workspace.service';
import { BookingDecisionsController } from './bookings/booking-decisions.controller';
import { BookingsController } from './bookings/bookings.controller';
import { DemoPersonasController } from './demo/personas.controller';
import { EbmOauthController } from './ebm/ebm-oauth.controller';
import { GeographyController } from './geography/geography.controller';
import { HealthController } from './health/health.controller';
import { MeController } from './me/me.controller';
import { TwoFactorController } from './me/two-factor.controller';
import { AvailabilityController } from './properties/availability.controller';
import {
  BookableController,
  PropertiesController,
} from './properties/properties.controller';
import { InventoryController } from './inventory/inventory.controller';
import { OpsAmenitiesController } from './ops/amenities.controller';
import { OpsDepartmentsController } from './ops/departments.controller';
import { OpsEbmController } from './ops/ebm.controller';
import { OpsTeamController } from './ops/team.controller';
import { OpsFoliosController } from './ops/folios.controller';
import { OpsHousekeepingController } from './ops/housekeeping.controller';
import { OpsOutletPartiesController } from './ops/outlet-parties.controller';
import { OpsOutletsController } from './ops/outlets.controller';
import {
  OpsRraController,
  OpsServiceCatalogController,
  OpsServiceOrdersController,
} from './ops/service-catalog.controller';
import {
  OpsReservationsController,
  OpsRoomAssignmentsController,
} from './ops/reservations.controller';
import { OpsRevenueController } from './ops/revenue.controller';
import {
  OpsDepositsController,
  OpsLeasesController,
  OpsRentRollController,
  OpsTicketsController,
} from './ops/residence.controller';
import { OpsRoomsController } from './ops/rooms.controller';
import { OpsThreadsController } from './ops/threads.controller';
import { OpsStaysController } from './ops/stays.controller';
import { OversightController } from './oversight/oversight.controller';
import { PlatformController } from './platform/platform.controller';
import { OrgClaimsController } from './registrations/org-claims.controller';
import { RegistrationsController } from './registrations/registrations.controller';
import { UploadsController } from './uploads/uploads.controller';
import { SupportModule } from './support/support.module';
import { TrainingPublicModule } from './training/training.module';
import { WaitlistModule } from './waitlist/waitlist.module';

/**
 * Public API (/api/v1). Controllers here compose application services from the
 * domain modules; they never reach into a module's internals.
 *
 * AuthModule is imported so SessionGuard can resolve AUTH_INSTANCE on the
 * guarded routes (POST /bookings — the commitment step, FL03).
 */
@Module({
  imports: [
    // Registered here, where the guard is used, and applied per route (review
    // 2.2): only controllers that opt in with `@UseGuards(UserThrottlerGuard)`
    // are limited. The `money` bucket is for routes whose every call is a real
    // provider charge.
    ThrottlerModule.forRoot([{ name: 'money', ttl: 60_000, limit: 5 }]),
    AuthModule,
    GeographyModule,
    ListingModule,
    ListingSetupModule,
    BookingModule,
    OperationsModule,
    OrganizationModule,
    StorageModule,
    UserModule,
    // POST /support/tickets, the public support intake; limits and caps are
    // in its own folder.
    SupportModule,
    // POST /waitlist/signups and the unsubscribe route, the pre-launch
    // waitlist (ADR-048). Deleted whole at launch.
    WaitlistModule,
    // ADR-049. Its catalogue routes are the only unguarded READS this module
    // adds: `/training` must render with no cookie at all (AC-1), and
    // `/api/v1/verify/:token` must answer a stranger holding a printed
    // certificate.
    TrainingPublicModule,
  ],
  controllers: [
    HealthController,
    // Which platform this is, for every client before sign in (ADR-043).
    PlatformController,
    GeographyController,
    PropertiesController,
    // The checkout's one read: a room type plus the property it belongs to.
    BookableController,
    // What is left to sell, per night (ADR-047 wave E).
    AvailabilityController,
    BookingsController,
    // The host's approve and decline, behind WorkspaceGuard (ADR-053, AC-A5).
    BookingDecisionsController,
    RegistrationsController,
    // The owner claim: the end an OBO registration could never reach (ADR-053).
    OrgClaimsController,
    UploadsController,
    InventoryController,
    OpsReservationsController,
    OpsRoomAssignmentsController,
    OpsRoomsController,
    OpsDepartmentsController,
    // Outlets and who runs them (ADR-050 slice 4).
    OpsOutletsController,
    OpsOutletPartiesController,
    OpsTeamController,
    OpsFoliosController,
    OpsRevenueController,
    OpsHousekeepingController,
    OpsServiceCatalogController,
    OpsServiceOrdersController,
    OpsRraController,
    OpsStaysController,
    OpsThreadsController,
    OpsLeasesController,
    OpsRentRollController,
    OpsTicketsController,
    OpsDepositsController,
    OpsAmenitiesController,
    // RRA EBM account (ADR-041): the operator's setup screen, and the
    // provider's consent redirect back to it.
    OpsEbmController,
    EbmOauthController,
    OversightController,
    MeController,
    TwoFactorController,
    // Answers only in a demo process; 404 everywhere else (AC-S10, ADR-043).
    DemoPersonasController,
  ],
  // WorkspaceService is the one resolver of "which workspaces does this user
  // hold" (Spec 0004). WorkspaceGuard depends on it; DatabaseModule is @Global
  // so DRIZZLE resolves without importing it here.
  providers: [WorkspaceService, TwoFactorService],
})
export class PublicApiModule {}
