import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from '../../modules/auth/auth.module';
import { BookingModule } from '../../modules/booking/booking.module';
import { GeographyModule } from '../../modules/geography/geography.module';
import { ListingSetupModule } from '../../modules/listing-setup/listing-setup.module';
import { ListingModule } from '../../modules/listing/listing.module';
import { MarketplaceModule } from '../../modules/marketplace/marketplace.module';
import { OperationsModule } from '../../modules/operations/operations.module';
import { OrganizationModule } from '../../modules/organization/organization.module';
import { ListsModule } from '../../modules/lists/lists.module';
import { PeopleModule } from '../../modules/people/people.module';
import { RentalsModule } from '../../modules/rentals/rentals.module';
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
import { GuestsPublicModule } from './guests/guests-public.module';
import { HealthController } from './health/health.controller';
import { MeController } from './me/me.controller';
// Who am I, in one call (blueprint 2.5).
import { MeContextController } from './me/context.controller';
// Rentals, the tenant's side (blueprint 2.4 and 2.5): their tenancies, accepting an invitation.
import { MeLeaseInvitationsController, MeTenanciesController } from './me/tenancies.controller';
import { LeaseInvitationsController } from './lease-invitations/lease-invitations.controller';
import { MeStaysController } from './me/stays.controller';
import { MeWorkController } from './me/work.controller';
import { MeWorkLeaveController } from './me/work-leave.controller';
import { MeWorkPayController } from './me/work-pay.controller';
import { KioskController } from './kiosk/kiosk.controller';
import { TwoFactorController } from './me/two-factor.controller';
// A tenant's password (2026-10-23): offered on a lease invitation, tenants only.
import { PasswordController } from './me/password.controller';
import { AvailabilityController } from './properties/availability.controller';
import { MarketplaceController } from './properties/marketplace.controller';
import {
  MeBusinessesController,
  MeCollectionsController,
  MeConsentsController,
  MeGuestContactController,
  MeSavedController,
  MeTripFactsController,
} from './me/saved.controller';
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
import { OpsHrWorkforceController, OpsRosterCoverController } from './ops/hr-workforce.controller';
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
// The new interface's operations floor (real-data 1.2.3).
import { OpsHousekeepingBoardController } from './ops/housekeeping-board.controller';
// The staff phone (real-data 1.3.3).
import { OpsHousekeepingPhoneController, OpsWorkOrderTimeController } from './ops/staff-phone.controller';
import { MeWorkStaffController } from './me/work-staff.controller';
import { OpsFoundItemsController } from './ops/lost-found.controller';
import { OpsConditionSignalsController, OpsWorkOrdersController } from './ops/work-orders.controller';
import { OpsOutletPartiesController } from './ops/outlet-parties.controller';
import { OpsOutletsController } from './ops/outlets.controller';
import {
  OpsPosController,
  OpsPosKitchenController,
  OpsPosOrdersController,
  OpsPosPaymentsController,
  OpsPosShiftsController,
} from './ops/pos.controller';
import { PosModule } from '../../modules/pos/pos.module';
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
import { BrokersModule } from '../../modules/brokers/brokers.module';
import { MeTenancyBrokerController } from './me/tenancy-broker.controller';
import { OpsLeaseBrokersController } from './ops/rentals/lease-brokers.controller';
import { RegistrationBrokerFeeController } from './registrations/broker-fee.controller';
import { OpsOffersController } from './ops/offers.controller';
import { OpsRefundRequestsController } from './ops/refunds.controller';
import { OpsRevenueController } from './ops/revenue.controller';
import { OpsOwnerDashboardController, OpsReportsController } from './ops/owner-dashboard.controller';
import { OpsCertificatesController } from './ops/certificates.controller';
import { OpsTicketsController } from './ops/residence.controller';
// Rentals (blueprint 2.3): the landlord's profile, getting paid, units, tenants and leases.
import { OpsLeasesController } from './ops/rentals/leases.controller';
import { OpsPayoutAccountsController } from './ops/rentals/payout-accounts.controller';
import { OpsRentalsController } from './ops/rentals/rentals.controller';
import { OpsTenantsController } from './ops/rentals/tenants.controller';
import { OpsBlocksController, OpsUnitsController } from './ops/rentals/units.controller';
// The landlord's home, buildings and unit media (WP 2.2, 2.3).
import { OpsRentalPropertiesController } from './ops/rentals/properties.controller';
import { OpsRentalsOverviewController } from './ops/rentals/rentals-overview.controller';
import { OpsUnitMediaController } from './ops/rentals/unit-media.controller';
// Rent, payouts and the gateway's callbacks (WP 1.6a, 1.6b).
import { OpsPayoutsController } from './ops/rentals/payouts.controller';
import { OpsRentController } from './ops/rentals/rent.controller';
import { PaymentWebhooksController } from './payments/webhooks.controller';
// Faults, expenses and taxes (WP 4.1, 4.3, 4.4).
import { MeTenancyFaultsController } from './me/tenancy-faults.controller';
import { OpsFaultsController } from './ops/rentals/faults.controller';
// Moving out: notices, the moved-out day, deposit settlement (WP 1.7).
import { MeTenancyMoveOutController } from './me/tenancy-move-out.controller';
import { OpsMoveOutsController } from './ops/rentals/move-outs.controller';
// Messages between a landlord and a tenant, and the live line (P3.4).
import { MeTenancyMessagesController } from './me/tenancy-messages.controller';
import { OpsLeaseMessagesController } from './ops/rentals/messages.controller';
// A broker and a landlord about a placement (2026-10-26).
import { OpsBrokerMessagesController } from './ops/broker-messages.controller';
import { OpsPlacementMessagesController } from './ops/rentals/placement-messages.controller';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { OpsExpensesController } from './ops/rentals/expenses.controller';
import { OpsFilingsController, OpsTaxesController } from './ops/rentals/taxes.controller';
import { OpsRoomsController } from './ops/rooms.controller';
import { OpsThreadsController } from './ops/threads.controller';
import { OpsStaysController } from './ops/stays.controller';
// The front desk's day in one read (interface real-data, frontdesk leaf).
import { OpsFrontDeskController } from './ops/front-desk.controller';
import { OpsMessageTemplatesController } from './ops/message-templates.controller';
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
    // The interface marketplace and guest account (real-data 1.3.2).
    MarketplaceModule,
    ListingSetupModule,
    BookingModule,
    OperationsModule,
    // The bar and restaurant point of sale (POS spec, phase 1). Payments are simulated.
    PosModule,
    OrganizationModule,
    // The HR module (ADR-058): files, roster, attendance, leave and pay.
    PeopleModule,
    // Rentals, rebuilt (blueprint 2.2): residence businesses only.
    RentalsModule,
    // Brokers (P5): plans, opted-in homes, reveals, placements, the registration fee.
    BrokersModule,
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
    // P5: a tenant's and a landlord's guests, the local leader's console and
    // reports, and the guest form's reference lists; its own folder.
    GuestsPublicModule,
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
    // The interface marketplace's cards, rooms and property pages (real-data 1.3.2).
    MarketplaceController,
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
    // The point of sale: floor, orders, kitchen and bar, simulated payments, shifts (POS spec, phase 1).
    OpsPosController,
    OpsPosOrdersController,
    OpsPosPaymentsController,
    OpsPosKitchenController,
    OpsPosShiftsController,
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
    // The new interface's HR screens (real-data, people): teams, cover, compensation, checklists, dependants.
    OpsHrWorkforceController,
    OpsRosterCoverController,
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
    // The owner's figures and documents (interface real-data leaf, owner area).
    OpsOwnerDashboardController,
    OpsReportsController,
    OpsCertificatesController,
    OpsHousekeepingController,
    OpsHousekeepingBoardController,
    OpsHousekeepingPhoneController,
    OpsWorkOrderTimeController,
    OpsWorkOrdersController,
    OpsConditionSignalsController,
    OpsFoundItemsController,
    OpsServiceCatalogController,
    OpsServiceOrdersController,
    OpsRraController,
    OpsStaysController,
    OpsFrontDeskController,
    OpsMessageTemplatesController,
    OpsThreadsController,
    OpsTicketsController,
    // Rentals (blueprint 2.3, WP 1.4, 1.5a and 1.5b). Every landlord route
    // answers 404 for a business that is not a residence.
    OpsRentalsController,
    OpsPayoutAccountsController,
    OpsUnitsController,
    OpsBlocksController,
    OpsTenantsController,
    OpsLeasesController,
    OpsRentalsOverviewController,
    OpsRentalPropertiesController,
    OpsUnitMediaController,
    // The rent cycle's routes (WP 1.6a, 1.6b): the roll, recorded payments,
    // reminders, payouts, and the public gateway callback.
    OpsRentController,
    OpsPayoutsController,
    PaymentWebhooksController,
    // The tenant's side (WP 1.5b): the public invitation preview, accepting it,
    // and the tenant's own tenancies behind TenancyGuard.
    LeaseInvitationsController,
    MeLeaseInvitationsController,
    MeTenanciesController,
    // Faults on both sides (WP 4.1): the landlord's board and the tenant's reports.
    OpsFaultsController,
    MeTenancyFaultsController,
    // Moving out on both sides (WP 1.7).
    OpsMoveOutsController,
    MeTenancyMoveOutController,
    OpsLeaseMessagesController,
    MeTenancyMessagesController,
    OpsPlacementMessagesController,
    OpsBrokerMessagesController,
    // Expenses and paying the fixer (WP 4.3).
    OpsExpensesController,
    // Rental income tax and lease filings with RRA (WP 4.4).
    OpsTaxesController,
    OpsFilingsController,
    // Brokers (P5, 2026-10-25): the broker's homes, reveals, placements,
    // earnings, reviews and plan; the landlord's side of a lease's broker;
    // the tenant's rating; the registration fee.
    OpsBrokerController,
    OpsLeaseBrokersController,
    MeTenancyBrokerController,
    RegistrationBrokerFeeController,
    OpsAmenitiesController,
    // RRA EBM account (ADR-041): the operator's setup screen, and the
    // provider's consent redirect back to it.
    OpsEbmController,
    EbmOauthController,
    OversightController,
    MeController,
    MeContextController,
    /*
     * §6.8. The in-house guest's own surface: claim the stay a desk typed,
     * message a department, ask for money back, take an offer. Session guarded
     * only — a stay's workspace is the PROPERTY's, so ownership is what
     * authorizes, proved per route.
     */
    MeStaysController,
    // The guest account (real-data 1.3.2): the heart, named lists, consent, contact, trip facts.
    MeSavedController,
    MeCollectionsController,
    MeConsentsController,
    MeGuestContactController,
    MeTripFactsController,
    MeBusinessesController,
    MeWorkController,
    MeWorkLeaveController,
    MeWorkStaffController,
    MeWorkPayController,
    KioskController,
    TwoFactorController,
    PasswordController,
    // Answers only in a demo process; 404 everywhere else (AC-S10, ADR-043).
    DemoPersonasController,
    DemoCrashController,
  ],
  // WorkspaceService is the one resolver of "which workspaces does this user
  // hold" (Spec 0004). WorkspaceGuard depends on it; DatabaseModule is @Global
  // so DRIZZLE resolves without importing it here.
  providers: [WorkspaceService, TwoFactorService, RealtimeGateway],
})
export class PublicApiModule {}
