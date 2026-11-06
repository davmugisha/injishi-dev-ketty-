import type { Domain } from '@injishi/contracts';

/**
 * The routes an existing business may lose to slice G, reviewed by name
 * (ADR-076 G19, A-13).
 *
 * The switch on backfill gave each business the products it could reach by
 * domain, so a route of a product its domain never ran was reachable before
 * only because nothing checked the product. The route snapshot accepts a lost
 * route only when its controller is listed here for the business's domain AND
 * the guard refused it by entitlement. Any other loss fails.
 *
 * A list, not a rule: a rule ("every product outside the backfill") let a
 * wrong gate through as deliberate, when the shared tickets board was gated on
 * Residence alone and hotels lost their work orders. A controller joins this
 * list in a reviewed change, never by being gated on a product.
 *
 * Test support only: nothing in the server imports it.
 */
export const DELIBERATE_LOSSES: Readonly<Record<Domain, ReadonlySet<string>>> = {
  // A hotel never ran Residence: the landlord's rentals and their guest
  // registrations. Not payouts and payout accounts (Pay), the broker routes
  // (Marketplace) or the tickets board (PMS or Residence): a hotel holds those.
  hospitality: new Set([
    'OpsUnitsController',
    'OpsBlocksController',
    'OpsRentalPropertiesController',
    'OpsRentalsController',
    'OpsRentalsOverviewController',
    'OpsLeasesController',
    'OpsRentController',
    'OpsMoveOutsController',
    'OpsFaultsController',
    'OpsExpensesController',
    'OpsTaxesController',
    'OpsFilingsController',
    'OpsTenantsController',
    'OpsUnitMediaController',
    'OpsLeaseMessagesController',
    'OpsGuestsController',
  ]),
  // A landlord never ran PMS, Outlets or POS.
  residence: new Set([
    // PMS.
    'OpsReservationsController',
    'OpsRoomAssignmentsController',
    'OpsFrontDeskController',
    'OpsStaysController',
    'OpsFoliosController',
    'OpsRoomsController',
    'OpsHousekeepingController',
    'OpsHousekeepingBoardController',
    'OpsFoundItemsController',
    // Outlets.
    'OpsOutletsController',
    'OpsOutletPartiesController',
    'OpsServiceCatalogController',
    'OpsServiceOrdersController',
    // POS.
    'OpsPosController',
    'OpsPosKitchenController',
    'OpsPosOrdersController',
    'OpsPosPaymentsController',
    'OpsPosShiftsController',
  ]),
  // A PSF business (the PSF path, `enterprise`) ran no product: it lists nothing, has no rooms, leases,
  // tills or staff on Injishi, and the backfill gives it its account alone. So every route of a product is
  // a loss it may take, written out per product (2026-11-06, when the slice was ported onto PSF's domain).
  enterprise: new Set([
    // HR.
    'OpsAttendanceController',
    'OpsAttendanceRequestsController',
    'OpsAttendanceSettingsController',
    'OpsContractsController',
    'OpsDisciplinaryActionsController',
    'OpsDocumentRequestsController',
    'OpsDocumentsController',
    'OpsEmployeeKioskPinController',
    'OpsEmployeesController',
    'OpsHrController',
    'OpsHrTimeSettingsController',
    'OpsHrWorkforceController',
    'OpsLeaveAllocationsController',
    'OpsLeaveController',
    'OpsLeaveTypesController',
    'OpsLeaveViewsController',
    'OpsLoansController',
    'OpsOrgChartController',
    'OpsPayAccountsController',
    'OpsPayAdjustmentsController',
    'OpsPayClaimsController',
    'OpsPayComponentsController',
    'OpsPayFilesController',
    'OpsPayRunsController',
    'OpsPayStructuresController',
    'OpsPayrollController',
    'OpsPayslipsController',
    'OpsPoliciesController',
    'OpsRestrictedPeriodsController',
    'OpsRosterController',
    'OpsRosterCoverController',
    'OpsRotationAssignmentsController',
    'OpsRotationPatternsController',
    'OpsShiftRequestsController',
    'OpsShiftTemplatesController',
    'OpsStaffAnnouncementsController',
    // Marketplace.
    'OpsLeaseBrokersController',
    'OpsPlacementMessagesController',
    // Outlets.
    'OpsOutletPartiesController',
    'OpsOutletsController',
    'OpsServiceCatalogController',
    'OpsServiceOrdersController',
    // Pay.
    'OpsPayoutAccountsController',
    'OpsPayoutsController',
    // PMS.
    'OpsFoliosController',
    'OpsFoundItemsController',
    'OpsFrontDeskController',
    'OpsHousekeepingBoardController',
    'OpsHousekeepingController',
    'OpsReservationsController',
    'OpsRoomAssignmentsController',
    'OpsRoomsController',
    'OpsStaysController',
    // PMS or Residence.
    'OpsTicketsController',
    // PMS, Residence or Outlets.
    'InventoryController',
    'OpsAmenitiesController',
    // POS.
    'OpsPosController',
    'OpsPosKitchenController',
    'OpsPosOrdersController',
    'OpsPosPaymentsController',
    'OpsPosShiftsController',
    // Residence.
    'OpsBlocksController',
    'OpsExpensesController',
    'OpsFaultsController',
    'OpsFilingsController',
    'OpsGuestsController',
    'OpsLeaseMessagesController',
    'OpsLeasesController',
    'OpsMoveOutsController',
    'OpsRentController',
    'OpsRentalPropertiesController',
    'OpsRentalsController',
    'OpsRentalsOverviewController',
    'OpsTaxesController',
    'OpsTenantsController',
    'OpsUnitMediaController',
    'OpsUnitsController',
  ]),
};
