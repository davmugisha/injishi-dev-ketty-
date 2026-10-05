import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { permissionsForRole, type OrgRole, type Permission } from '@injishi/contracts';

// The controllers are read for their decorator metadata only; nothing is
// instantiated. The session guard and the two-factor service reach the ESM
// `@injishi/auth` package, which ts-jest does not transform, so both are stubbed
// at the module boundary.
jest.mock('../../../shared/auth/two-factor.service', () => ({ TwoFactorService: class {} }));
jest.mock('../../../shared/auth/session.guard', () => ({
  SessionGuard: class {},
  CurrentUser: () => () => undefined,
}));

import {
  REQUIRE_ANY_PERMISSION,
  REQUIRE_PERMISSION,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { OpsAmenitiesController } from './amenities.controller';
import { OpsAttendanceController } from './attendance.controller';
import { OpsDepartmentsController } from './departments.controller';
import { OpsDisciplinaryActionsController } from './disciplinary-actions.controller';
import { OpsDocumentRequestsController } from './document-requests.controller';
import { OpsDocumentsController } from './documents.controller';
import { OpsEmployeesController } from './employees.controller';
import { OpsHrController } from './hr.controller';
import {
  OpsLeaveAllocationsController,
  OpsLeaveController,
  OpsLeaveTypesController,
  OpsLeaveViewsController,
  OpsRestrictedPeriodsController,
} from './leave.controller';
import { OpsListViewsController } from './list-views.controller';
import { OpsOrgChartController } from './org-chart.controller';
import { OpsPayAccountsController } from './pay-accounts.controller';
import { OpsPayRunsController } from './pay-runs.controller';
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
} from './payroll.controller';
import { OpsPoliciesController } from './policies.controller';
import { OpsRosterController, OpsShiftTemplatesController } from './roster.controller';
import { OpsEbmController } from './ebm.controller';
import { OpsFoliosController } from './folios.controller';
import { OpsHousekeepingController } from './housekeeping.controller';
import { OpsOffersController } from './offers.controller';
import { OpsOutletPartiesController } from './outlet-parties.controller';
import { OpsOutletsController } from './outlets.controller';
import { OpsRefundRequestsController } from './refunds.controller';
import { OpsReservationsController, OpsRoomAssignmentsController } from './reservations.controller';
import {
  OpsDepositsController,
  OpsFilingsController,
  OpsLeasesController,
  OpsRentRollController,
  OpsTicketsController,
} from './residence.controller';
import { OpsRevenueController } from './revenue.controller';
import { OpsRoomsController } from './rooms.controller';
import {
  OpsRraController,
  OpsServiceCatalogController,
  OpsServiceOrdersController,
} from './service-catalog.controller';
import { OpsStaffAnnouncementsController } from './staff-announcements.controller';
import { OpsStaysController } from './stays.controller';
import { OpsTeamController } from './team.controller';
import { OpsThreadsController } from './threads.controller';
import {
  OpsAttendanceRequestsController,
  OpsAttendanceSettingsController,
  OpsEmployeeKioskPinController,
  OpsHrTimeSettingsController,
  OpsRotationAssignmentsController,
  OpsRotationPatternsController,
  OpsShiftRequestsController,
} from './time.controller';

/**
 * Every operator READ declares who may make it (platform audit, H1).
 *
 * Until this, a GET under `WorkspaceGuard` with no declaration was open to every
 * member: a housekeeper read the rent roll, and the owner of a business still in
 * the registration pipeline — whose permission set is EMPTY — read everything.
 *
 * Two things are pinned here. First, that no GET on these controllers is left
 * undeclared (the lint rule says the same thing about source; this says it about
 * the metadata Nest actually reads). Second, WHICH roles each read admits, from
 * the role table in `@injishi/contracts`, so that narrowing a read and locking a
 * role out of a screen it uses fails here rather than in the building.
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Ctor = Function;

const CONTROLLERS: Ctor[] = [
  OpsAmenitiesController,
  OpsDepartmentsController,
  OpsEbmController,
  OpsFoliosController,
  OpsHousekeepingController,
  OpsOffersController,
  OpsRefundRequestsController,
  OpsOutletPartiesController,
  OpsOutletsController,
  OpsReservationsController,
  OpsRoomAssignmentsController,
  OpsLeasesController,
  OpsRentRollController,
  OpsFilingsController,
  OpsTicketsController,
  OpsDepositsController,
  OpsRevenueController,
  OpsRoomsController,
  OpsServiceCatalogController,
  OpsServiceOrdersController,
  OpsRraController,
  OpsStaysController,
  OpsTeamController,
  OpsThreadsController,
  OpsEmployeesController,
  OpsShiftTemplatesController,
  OpsRosterController,
  OpsAttendanceController,
  OpsLeaveController,
  OpsLeaveViewsController,
  OpsLeaveTypesController,
  OpsLeaveAllocationsController,
  OpsRestrictedPeriodsController,
  OpsPayRunsController,
  OpsListViewsController,
  OpsHrController,
  OpsPayAccountsController,
  OpsDocumentsController,
  OpsDocumentRequestsController,
  OpsPoliciesController,
  OpsStaffAnnouncementsController,
  OpsDisciplinaryActionsController,
  OpsOrgChartController,
  OpsRotationPatternsController,
  OpsRotationAssignmentsController,
  OpsShiftRequestsController,
  OpsAttendanceRequestsController,
  OpsAttendanceSettingsController,
  OpsEmployeeKioskPinController,
  OpsHrTimeSettingsController,
  OpsPayslipsController,
  OpsPayAdjustmentsController,
  OpsLoansController,
  OpsPayClaimsController,
  OpsPayComponentsController,
  OpsPayStructuresController,
  OpsContractsController,
  OpsPayrollController,
  OpsPayFilesController,
];

interface Read {
  route: string;
  allOf: readonly Permission[];
  anyOf: readonly Permission[];
}

function asList(value: unknown): readonly Permission[] {
  if (value === undefined) return [];
  return (typeof value === 'string' ? [value] : value) as readonly Permission[];
}

function joinPath(base: unknown, sub: unknown): string {
  const parts = [base, sub]
    .map((p) => (typeof p === 'string' ? p : ''))
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

/** Every GET handler on the WorkspaceGuard controllers, with what it declares. */
function reads(): Read[] {
  const found: Read[] = [];
  for (const controller of CONTROLLERS) {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
    if (!guards.includes(WorkspaceGuard)) continue;
    const base = Reflect.getMetadata(PATH_METADATA, controller) as unknown;
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      if (Reflect.getMetadata(METHOD_METADATA, handler) !== RequestMethod.GET) continue;
      // Handler over class, as `Reflector.getAllAndOverride` resolves it.
      const pick = (key: string): readonly Permission[] =>
        asList(Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller));
      found.push({
        route: joinPath(base, Reflect.getMetadata(PATH_METADATA, handler)),
        allOf: pick(REQUIRE_PERMISSION),
        anyOf: pick(REQUIRE_ANY_PERMISSION),
      });
    }
  }
  return found;
}

function admits(read: Read, held: readonly Permission[]): boolean {
  if (!read.allOf.every((p) => held.includes(p))) return false;
  return read.anyOf.length === 0 || read.anyOf.some((p) => held.includes(p));
}

const ROLES: OrgRole[] = ['owner', 'manager', 'receptionist', 'housekeeper'];

/**
 * Which roles each read admits. Derived from the consumers: the operator nav's
 * leaf permissions, every hook in `apps/app/src/pms/data`, the housekeeper
 * phone, the landlord's mobile app and the verify scripts.
 */
const EXPECTED: Record<string, readonly OrgRole[]> = {
  '/ops/amenities': ['owner', 'manager', 'receptionist'],
  '/ops/departments': ['owner', 'manager', 'receptionist'],
  '/ops/departments/:id/members': ['owner', 'manager'],
  '/ops/ebm/connection': ['owner', 'manager'],
  '/ops/ebm/items': ['owner', 'manager'],
  '/ops/ebm/customers': ['owner', 'manager'],
  '/ops/folios': ['owner', 'manager', 'receptionist'],
  '/ops/folios/:id': ['owner', 'manager', 'receptionist'],
  '/ops/housekeeping-tasks': ['owner', 'manager', 'housekeeper'],
  '/ops/outlet-parties': ['owner', 'manager'],
  '/ops/outlets': ['owner', 'manager', 'receptionist'],
  '/ops/reservations': ['owner', 'manager', 'receptionist'],
  // The RECORD read. Exactly the list's consumers: opening one booking by id
  // must never be easier than seeing it on the desk it came from.
  '/ops/reservations/:id': ['owner', 'manager', 'receptionist'],
  '/ops/reservations/:id/assignments': ['owner', 'manager', 'receptionist'],
  '/ops/room-assignments': ['owner', 'manager', 'receptionist'],
  '/ops/leases': ['owner', 'manager'],
  '/ops/rent-roll': ['owner', 'manager'],
  // The Filings lens on Finance (F-R10). The same consumers as the leases it
  // reports on: whether a contract was filed is the business's compliance
  // record, not something the front desk needs.
  '/ops/filings': ['owner', 'manager'],
  '/ops/tickets': ['owner', 'manager', 'housekeeper'],
  '/ops/deposits': ['owner', 'manager'],
  '/ops/revenue': ['owner', 'manager'],
  '/ops/rooms': ['owner', 'manager', 'receptionist', 'housekeeper'],
  '/ops/service-catalog': ['owner', 'manager', 'receptionist'],
  '/ops/service-orders': ['owner', 'manager', 'receptionist'],
  '/ops/rra/classifications': ['owner', 'manager'],
  '/ops/stays': ['owner', 'manager', 'receptionist'],
  // The RECORD read, same consumers as the list, for the same reason.
  '/ops/stays/:id': ['owner', 'manager', 'receptionist'],
  // Guest stay surface (6718d11): the desk re-sends a claim code; managers
  // price offers and decide refund requests.
  '/ops/stays/:id/claim-invite': ['owner', 'manager', 'receptionist'],
  '/ops/offers': ['owner', 'manager'],
  '/ops/refund-requests': ['owner', 'manager'],
  '/ops/team': ['owner'],
  '/ops/team/invitations': ['owner'],
  '/ops/threads': ['owner', 'manager', 'receptionist'],
  '/ops/threads/:id/messages': ['owner', 'manager', 'receptionist'],
  // The HR module (ADR-058, contract 4). A file is read by `people.view` and
  // above, which the desk does not hold; the desk reads the roster and the
  // attendance sheet as roster cards, because it clocks people in.
  '/ops/employees': ['owner', 'manager'],
  // Select all and the export read the same files as the list (058-list-framework).
  '/ops/employees/ids': ['owner', 'manager'],
  '/ops/employees/export.csv': ['owner', 'manager'],
  '/ops/employees/:id': ['owner', 'manager'],
  '/ops/employees/:id/leave-balances': ['owner', 'manager'],
  '/ops/shift-templates': ['owner', 'manager', 'receptionist'],
  '/ops/roster': ['owner', 'manager', 'receptionist'],
  '/ops/attendance': ['owner', 'manager', 'receptionist'],
  '/ops/leave/requests': ['owner', 'manager'],
  '/ops/leave/requests/ids': ['owner', 'manager'],
  // What each colleague earns: the owner's by default (`payroll.run`).
  '/ops/pay-runs': ['owner'],
  '/ops/pay-runs/:id': ['owner'],
  // Saved views of every HR list, declared on the union of the lists' reads and
  // narrowed to the list's own in the service: the desk reads the views of the
  // roster and the attendance sheet it works, and nothing else.
  '/ops/list-views': ['owner', 'manager', 'receptionist'],
  // The people file (058-people-file AC-PF2). The photo is a work field, so it
  // reads like the file. Pay accounts are `people.manage` or `payroll.run`;
  // notes, documents and discipline are `people.manage` alone. All three are
  // the owner's by default, so a manager reads none of them until granted.
  '/ops/employees/:id/photo': ['owner', 'manager'],
  '/ops/employees/:id/pay-accounts': ['owner'],
  '/ops/employees/:id/notes': ['owner'],
  '/ops/employees/:id/notes/:noteId/files/:index': ['owner'],
  '/ops/employees/:id/documents': ['owner'],
  '/ops/documents': ['owner'],
  '/ops/documents/:id/file': ['owner'],
  '/ops/document-requests': ['owner'],
  '/ops/disciplinary-actions': ['owner'],
  '/ops/disciplinary-actions/:id/file': ['owner'],
  // What the whole business shares reads under any HR permission, so the desk
  // (`attendance.record`) reads the house rules and announcements too.
  '/ops/hr/catalog/:kind': ['owner', 'manager', 'receptionist'],
  '/ops/hr/settings': ['owner', 'manager', 'receptionist'],
  '/ops/policies': ['owner', 'manager', 'receptionist'],
  '/ops/policies/:id/files/:index': ['owner', 'manager', 'receptionist'],
  '/ops/staff-announcements': ['owner', 'manager', 'receptionist'],
  '/ops/staff-announcements/:id/files/:index': ['owner', 'manager', 'receptionist'],
  // Roster card fields only, as the file list (AC-PF10).
  '/ops/org-chart': ['owner', 'manager'],
  // Time (058-time). The week grid reads like the roster; the desk reads the
  // rotations it clocks people onto, the policies it punches under, its
  // kiosks and whether a person has a PIN. Requests are decided by those who
  // decide them, and only they list them. The insights are `people.manage`
  // alone (index contract 7), so the owner's by default.
  '/ops/roster/week': ['owner', 'manager', 'receptionist'],
  '/ops/rotation-patterns': ['owner', 'manager', 'receptionist'],
  '/ops/rotation-assignments': ['owner', 'manager'],
  '/ops/shift-requests': ['owner', 'manager'],
  '/ops/shift-requests/ids': ['owner', 'manager'],
  '/ops/attendance-requests': ['owner', 'manager'],
  '/ops/attendance-requests/ids': ['owner', 'manager'],
  '/ops/attendance/policies': ['owner', 'manager', 'receptionist'],
  '/ops/attendance/kiosks': ['owner', 'manager', 'receptionist'],
  '/ops/attendance/insights/late-early': ['owner'],
  '/ops/attendance/insights/monthly': ['owner'],
  '/ops/employees/:id/kiosk-pin': ['owner', 'manager', 'receptionist'],
  // Leave counts days by them, so whoever plans time or decides leave reads them.
  '/ops/hr/holidays': ['owner', 'manager'],
  '/ops/hr/weekly-offs': ['owner', 'manager'],
  // Leave in full (058-leave). A sick note, everybody's balances, the dashboard,
  // the asks for more days and the restricted periods are read by whoever
  // decides leave or keeps the files. A type's name is what every HR screen
  // draws with, so any HR permission reads the types; the national defaults
  // compared with them are `people.manage`'s, the owner's by default.
  '/ops/leave/requests/:id/attachment': ['owner', 'manager'],
  '/ops/leave/balances': ['owner', 'manager'],
  '/ops/leave/dashboard': ['owner', 'manager'],
  '/ops/leave/types': ['owner', 'manager', 'receptionist'],
  '/ops/leave/types/defaults': ['owner'],
  '/ops/leave/allocation-requests': ['owner', 'manager'],
  '/ops/leave/allocation-requests/ids': ['owner', 'manager'],
  '/ops/leave/restricted-periods': ['owner', 'manager'],
  // Payroll in full (058-payroll): every read is `payroll.run`, the owner's by
  // default, because each one says what a named colleague earns or owes. The
  // contracts list is `people.manage` too, which writes contracts.
  '/ops/pay-runs/:id/payslips.pdf': ['owner'],
  '/ops/pay-runs/:id/files': ['owner'],
  '/ops/payslips': ['owner'],
  '/ops/payslips/ids': ['owner'],
  '/ops/payslips/:id/pdf': ['owner'],
  '/ops/pay-adjustments': ['owner'],
  '/ops/loans': ['owner'],
  '/ops/loans/:id': ['owner'],
  '/ops/pay-claims': ['owner'],
  '/ops/pay-claims/ids': ['owner'],
  '/ops/pay-claims/:id/receipt': ['owner'],
  '/ops/pay-components': ['owner'],
  '/ops/pay-structures': ['owner'],
  '/ops/contracts': ['owner'],
  '/ops/payroll/dashboard': ['owner'],
  '/ops/payroll/rules': ['owner'],
  '/ops/pay-files/:id': ['owner'],
};

describe('operator reads (audit H1)', () => {
  const all = reads();

  it('finds the reads it is meant to judge', () => {
    expect(all.map((r) => r.route).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(all.map((r) => [r.route, r] as const))('%s declares a permission', (_route, read) => {
    expect(read.allOf.length + read.anyOf.length).toBeGreaterThan(0);
  });

  it.each(all.map((r) => [r.route, r] as const))(
    '%s is refused to an empty permission set (the registration gate)',
    (_route, read) => {
      expect(admits(read, [])).toBe(false);
    },
  );

  it.each(all.map((r) => [r.route, r] as const))('%s admits exactly its consumers', (route, read) => {
    const admitted = ROLES.filter((role) => admits(read, permissionsForRole(role)));
    expect(admitted).toEqual(EXPECTED[route]);
  });
});
