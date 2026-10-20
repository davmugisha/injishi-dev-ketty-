import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from '../../modules/auth/auth.module';
import { BookingModule } from '../../modules/booking/booking.module';
import { GeographyModule } from '../../modules/geography/geography.module';
import { ListingSetupModule } from '../../modules/listing-setup/listing-setup.module';
import { ListingModule } from '../../modules/listing/listing.module';
import { OperationsModule } from '../../modules/operations/operations.module';
import { OrganizationModule } from '../../modules/organization/organization.module';
import { ListsModule } from '../../modules/lists/lists.module';
import { PeopleModule } from '../../modules/people/people.module';
import { StorageModule } from '../../modules/storage/storage.module';
import { UserModule } from '../../modules/user/user.module';
import { TwoFactorService } from '../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../shared/auth/workspace.service';
import { BookingDecisionsController } from './bookings/booking-decisions.controller';
import { BookingsController } from './bookings/bookings.controller';
import { DemoCrashController } from './demo/crash.controller';
import { DemoPersonasController } from './demo/personas.controller';
import { EbmOauthController } from './ebm/ebm-oauth.controller';
import { GeographyController } from './geography/geography.controller';
import { HealthController } from './health/health.controller';
import { MeController } from './me/me.controller';
import { MeStaysController } from './me/stays.controller';
import { MeWorkController } from './me/work.controller';
import { MeWorkLeaveController } from './me/work-leave.controller';
import { MeWorkPayController } from './me/work-pay.controller';
import { KioskController } from './kiosk/kiosk.controller';
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
import { OpsRolesController } from './ops/roles.controller';
import { OpsTeamController } from './ops/team.controller';
import { OpsAttendanceController } from './ops/attendance.controller';
import { OpsEmployeesController } from './ops/employees.controller';
import { OpsDisciplinaryActionsController } from './ops/disciplinary-actions.controller';
import { OpsDocumentRequestsController } from './ops/document-requests.controller';
import { OpsDocumentsController } from './ops/documents.controller';
import { OpsHrController } from './ops/hr.controller';
import { OpsOrgChartController } from './ops/org-chart.controller';
import { OpsPayAccountsController } from './ops/pay-accounts.controller';
import { OpsPoliciesController } from './ops/policies.controller';
import { OpsStaffAnnouncementsController } from './ops/staff-announcements.controller';
import { OpsListViewsController } from './ops/list-views.controller';
import {
  OpsLeaveAllocationsController,
  OpsLeaveController,
  OpsLeaveTypesController,
  OpsLeaveViewsController,
  OpsRestrictedPeriodsController,
} from './ops/leave.controller';
import { OpsPayRunsController } from './ops/pay-runs.controller';
import {
  OpsContractsController,
  OpsLoansController,
  OpsPayAdjustmentsController,
  OpsPayClaimsController,
  OpsPayComponentsController,
  OpsPayFilesController,
  OpsPayrollController,
  OpsPayslipsController,
  OpsPayStructuresController,
} from './ops/payroll.controller';
import { OpsRosterController, OpsShiftTemplatesController } from './ops/roster.controller';
import {
  OpsAttendanceRequestsController,
  OpsAttendanceSettingsController,
  OpsEmployeeKioskPinController,
  OpsHrTimeSettingsController,
  OpsRotationAssignmentsController,
  OpsRotationPatternsController,
  OpsShiftRequestsController,
} from './ops/time.controller';
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
import { OpsBrokerController } from './ops/broker.controller';
import { OpsOffersController } from './ops/offers.controller';
import { OpsRefundRequestsController } from './ops/refunds.controller';
import { OpsRevenueController } from './ops/revenue.controller';
import {
  OpsDepositsController,
  OpsFilingsController,
  OpsLeasesController,
  OpsRentRollController,
  OpsTicketsController,
} from './ops/residence.controller';
import { OpsRoomsController } from './ops/rooms.controller';
import { OpsThreadsController } from './ops/threads.controller';
import { OpsStaysController } from './ops/stays.controller';
import { OversightController } from './oversight/oversight.controller';
import { PlatformController } from './platform/platform.controller';
import {
  OversightPsfController,
  PsfMembershipController,
  PsfTiersController,
} from './psf/psf-membership.controller';
import { OrgClaimsController } from './registrations/org-claims.controller';
import { IdentityController } from './me/identity.controller';
import { SelfCheckInController } from './me/self-check-in.controller';
import { RegistrationDraftController } from './registrations/registration-draft.controller';
import { RegistrationsController } from './registrations/registrations.controller';
import { StaffInvitationsController } from './registrations/staff-invitations.controller';
import { UploadsController } from './uploads/uploads.controller';
import { SupportModule } from './support/support.module';
import { AssistantPublicModule } from './assistant/assistant.module';
import { TrainingPublicModule } from './training/training.module';

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
    // The HR module (ADR-058): files, roster, attendance, leave and pay.
    PeopleModule,
    // The list framework (ADR-058 slice 2): saved views and the export log.
    ListsModule,
    StorageModule,
    UserModule,
    // POST /support/tickets, the public support intake; limits and caps are
    // in its own folder.
    SupportModule,
    // /assistant/*, the support assistant (ADR-061); its limits, cookie and
    // model seam are in its own folder and `modules/assistant`.
    AssistantPublicModule,
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
    // The caller's own identity verification (ADR-060).
    IdentityController,
    // A guest's own check-in before arrival (F-B09, ADR-060).
    SelfCheckInController,
    // The registration wizard's answers between steps (ADR-060).
    RegistrationDraftController,
    // The owner claim: the end an OBO registration could never reach (ADR-053).
    OrgClaimsController,
    // Accepting a staff invitation, before the invitee holds the workspace.
    StaffInvitationsController,
    // PSF membership (ADR-056): the tiers, a business's application, and the
    // PSF membership officer's queue.
    PsfTiersController,
    PsfMembershipController,
    OversightPsfController,
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
    OpsRolesController,
    // The HR module (ADR-058, first thread). Every route behind WorkspaceGuard
    // with one of the seven HR permissions.
    OpsEmployeesController,
    // The people file (058-people-file): uploads, catalogs and settings, pay
    // accounts, documents, policies, announcements, discipline, the org chart.
    OpsHrController,
    OpsPayAccountsController,
    OpsDocumentsController,
    OpsDocumentRequestsController,
    OpsPoliciesController,
    OpsStaffAnnouncementsController,
    OpsDisciplinaryActionsController,
    OpsOrgChartController,
    // Saved list views for every list (058-list-framework).
    OpsListViewsController,
    OpsShiftTemplatesController,
    OpsRosterController,
    OpsAttendanceController,
    OpsRotationPatternsController,
    OpsRotationAssignmentsController,
    OpsShiftRequestsController,
    OpsAttendanceRequestsController,
    OpsAttendanceSettingsController,
    OpsEmployeeKioskPinController,
    OpsHrTimeSettingsController,
    OpsLeaveController,
    OpsLeaveViewsController,
    OpsLeaveTypesController,
    OpsLeaveAllocationsController,
    OpsRestrictedPeriodsController,
    OpsPayRunsController,
    OpsPayslipsController,
    OpsPayAdjustmentsController,
    OpsLoansController,
    OpsPayClaimsController,
    OpsPayComponentsController,
    OpsPayStructuresController,
    OpsContractsController,
    OpsPayrollController,
    OpsPayFilesController,
    OpsFoliosController,
    // §6.8. Answering a guest who asked for money back, and the offers a
    // property writes. Both behind `WorkspaceGuard` with their own permissions.
    OpsRefundRequestsController,
    OpsOffersController,
    OpsRevenueController,
    OpsHousekeepingController,
    OpsServiceCatalogController,
    OpsServiceOrdersController,
    OpsRraController,
    OpsStaysController,
    OpsThreadsController,
    OpsLeasesController,
    OpsRentRollController,
    OpsFilingsController,
    OpsTicketsController,
    OpsDepositsController,
    // The broker workspace's directory, reveals, placements and earnings
    // (ADR-038 child 6).
    OpsBrokerController,
    OpsAmenitiesController,
    // RRA EBM account (ADR-041): the operator's setup screen, and the
    // provider's consent redirect back to it.
    OpsEbmController,
    EbmOauthController,
    OversightController,
    MeController,
    /*
     * §6.8. The in-house guest's own surface: claim the stay a desk typed,
     * message a department, ask for money back, take an offer. Session guarded
     * only — a stay's workspace is the PROPERTY's, so ownership is what
     * authorizes, proved per route.
     */
    MeStaysController,
    MeWorkController,
    MeWorkLeaveController,
    MeWorkPayController,
    KioskController,
    TwoFactorController,
    // Answers only in a demo process; 404 everywhere else (AC-S10, ADR-043).
    DemoPersonasController,
    DemoCrashController,
  ],
  // WorkspaceService is the one resolver of "which workspaces does this user
  // hold" (Spec 0004). WorkspaceGuard depends on it; DatabaseModule is @Global
  // so DRIZZLE resolves without importing it here.
  providers: [WorkspaceService, TwoFactorService],
})
export class PublicApiModule {}
