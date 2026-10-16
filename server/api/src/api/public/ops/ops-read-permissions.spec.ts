import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { OrgRole, permissionsForRole, type Permission } from '@injishi/contracts';

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
import { OpsHrWorkforceController, OpsRosterCoverController } from './hr-workforce.controller';
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
import { OpsFrontDeskController } from './front-desk.controller';
import { OpsHousekeepingController } from './housekeeping.controller';
import { OpsHousekeepingBoardController } from './housekeeping-board.controller';
import { OpsFoundItemsController } from './lost-found.controller';
import { OpsConditionSignalsController, OpsWorkOrdersController } from './work-orders.controller';
import { OpsMessageTemplatesController } from './message-templates.controller';
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
import { OpsCertificatesController } from './certificates.controller';
import { OpsOwnerDashboardController, OpsReportsController } from './owner-dashboard.controller';
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
  OpsFrontDeskController,
  OpsHousekeepingController,
  OpsHousekeepingBoardController,
  OpsWorkOrdersController,
  OpsConditionSignalsController,
  OpsFoundItemsController,
  OpsMessageTemplatesController,
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
  OpsOwnerDashboardController,
  OpsReportsController,
  OpsCertificatesController,
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
  OpsHrWorkforceController,
  OpsRosterCoverController,
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

const METHOD_NAME: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

/** Every GET handler on the WorkspaceGuard controllers, with what it declares. */
function reads(): Read[] {
  return handlers(CONTROLLERS, [RequestMethod.GET]).map(({ read }) => read);
}

/** Every handler of these methods on these controllers, keyed `METHOD /path`. */
function handlers(
  controllers: readonly Ctor[],
  methods: readonly RequestMethod[],
): { key: string; read: Read }[] {
  const found: { key: string; read: Read }[] = [];
  for (const controller of controllers) {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
    if (!guards.includes(WorkspaceGuard)) continue;
    const base = Reflect.getMetadata(PATH_METADATA, controller) as unknown;
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
      if (!methods.includes(method)) continue;
      // Handler over class, as `Reflector.getAllAndOverride` resolves it.
      const pick = (key: string): readonly Permission[] =>
        asList(Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller));
      const route = joinPath(base, Reflect.getMetadata(PATH_METADATA, handler));
      found.push({
        key: `${METHOD_NAME[method] ?? String(method)} ${route}`,
        read: {
          route,
          allOf: pick(REQUIRE_PERMISSION),
          anyOf: pick(REQUIRE_ANY_PERMISSION),
        },
      });
    }
  }
  return found;
}

function admits(read: Read, held: readonly Permission[]): boolean {
  if (!read.allOf.every((p) => held.includes(p))) return false;
  return read.anyOf.length === 0 || read.anyOf.some((p) => held.includes(p));
}

/**
 * Every role the model has, in its own order, so a role added to `OrgRole`
 * is judged here the day it lands rather than the day somebody remembers it.
 * `finance` and `hr` are ADR-069 D-a.
 */
const ROLES: readonly OrgRole[] = OrgRole.options;

/**
 * Which roles each read admits. Derived from the consumers: the operator nav's
 * leaf permissions, every hook in `apps/app/src/pms/data`, the housekeeper
 * phone, the landlord's mobile app and the verify scripts.
 *
 * ADR-069 D-c traces every sidebar destination of `finance` and `hr` to
 * these reads. `finance` reads the money (bills, revenue, refund requests,
 * the EBM account, a residence's rent ledger) and the stays a bill hangs on,
 * and `hr` every HR read its seven permissions reach. Neither reads the
 * other's, the guest inbox, or the team (`team.manage` is the owner's).
 */
const EXPECTED: Record<string, readonly OrgRole[]> = {
  '/ops/amenities': ['owner', 'manager', 'receptionist'],
  '/ops/departments': ['owner', 'manager', 'receptionist', 'finance', 'hr'],
  '/ops/departments/:id/members': ['owner', 'manager', 'hr'],
  '/ops/ebm/connection': ['owner', 'manager', 'finance'],
  '/ops/ebm/items': ['owner', 'manager', 'finance'],
  '/ops/ebm/customers': ['owner', 'manager', 'finance'],
  '/ops/folios': ['owner', 'manager', 'receptionist', 'finance'],
  '/ops/folios/:id': ['owner', 'manager', 'receptionist', 'finance'],
  // The desk's day in one read (interface real-data): the reservations list's
  // readers, because it summarises the same bookings; a bill balance in it is
  // null unless the caller also reads bills.
  '/ops/front-desk': ['owner', 'manager', 'receptionist', 'finance'],
  '/ops/housekeeping-tasks': ['owner', 'manager', 'housekeeper'],
  // The housekeeping board (real-data 1.2.3): the same consumers as the queue it widens.
  '/ops/housekeeping/board': ['owner', 'manager', 'housekeeper'],
  // The hotel's work orders and condition signals: the Maintenance leaf's consumers (`ticket.advance`).
  '/ops/work-orders': ['owner', 'manager', 'housekeeper'],
  '/ops/work-orders/:id': ['owner', 'manager', 'housekeeper'],
  '/ops/condition-signals': ['owner', 'manager', 'housekeeper'],
  // The lost and found register (`lostfound.manage`): the desk takes claims and hands items back.
  '/ops/found-items': ['owner', 'manager', 'receptionist'],
  '/ops/found-items/:id': ['owner', 'manager', 'receptionist'],
  // Reply templates are only ever put in a draft the desk then sends, so they
  // read like the inbox they serve.
  '/ops/message-templates': ['owner', 'manager', 'receptionist'],
  '/ops/outlet-parties': ['owner', 'manager'],
  '/ops/outlets': ['owner', 'manager', 'receptionist'],
  '/ops/reservations': ['owner', 'manager', 'receptionist', 'finance'],
  // The RECORD read. Exactly the list's consumers: opening one booking by id
  // must never be easier than seeing it on the desk it came from.
  '/ops/reservations/:id': ['owner', 'manager', 'receptionist', 'finance'],
  // ADR-069 D-d: the two reservation reads also admit `money.view`, so the
  // accountant opens Reservations without taking a desk write. The room
  // assignment reads below did not widen: finance sees bookings, not the room
  // plan.
  '/ops/reservations/:id/assignments': ['owner', 'manager', 'receptionist'],
  '/ops/room-assignments': ['owner', 'manager', 'receptionist'],
  '/ops/leases': ['owner', 'manager'],
  '/ops/rent-roll': ['owner', 'manager', 'finance'],
  // The Filings lens on Finance (F-R10). The same consumers as the leases it
  // reports on: whether a contract was filed is the business's compliance
  // record, not something the front desk needs.
  '/ops/filings': ['owner', 'manager', 'finance'],
  '/ops/tickets': ['owner', 'manager', 'housekeeper'],
  '/ops/deposits': ['owner', 'manager', 'finance'],
  '/ops/revenue': ['owner', 'manager', 'finance'],
  // The owner's figures: what the business earned and holds, read on money.view like the month above.
  '/ops/revenue/daily': ['owner', 'manager', 'finance'],
  '/ops/dashboard/owner': ['owner', 'manager', 'finance'],
  '/ops/reports/performance': ['owner', 'manager', 'finance'],
  // Licences on file: listing.manage (what a listing rests on) or money.view (fiscal standing).
  '/ops/certificates': ['owner', 'manager', 'finance'],
  '/ops/rooms': ['owner', 'manager', 'receptionist', 'housekeeper'],
  '/ops/service-catalog': ['owner', 'manager', 'receptionist'],
  '/ops/service-orders': ['owner', 'manager', 'receptionist'],
  '/ops/rra/classifications': ['owner', 'manager'],
  '/ops/stays': ['owner', 'manager', 'receptionist', 'finance'],
  // The RECORD read, same consumers as the list, for the same reason.
  '/ops/stays/:id': ['owner', 'manager', 'receptionist', 'finance'],
  // Guest stay surface (6718d11): the desk re-sends a claim code; managers
  // price offers and decide refund requests.
  '/ops/stays/:id/claim-invite': ['owner', 'manager', 'receptionist'],
  '/ops/offers': ['owner', 'manager'],
  '/ops/refund-requests': ['owner', 'manager', 'finance'],
  '/ops/team': ['owner'],
  '/ops/team/invitations': ['owner'],
  '/ops/threads': ['owner', 'manager', 'receptionist'],
  '/ops/threads/:id/messages': ['owner', 'manager', 'receptionist'],
  // The HR module (ADR-058, contract 4). A file is read by `people.view` and
  // above, which the desk does not hold; the desk reads the roster and the
  // attendance sheet as roster cards, because it clocks people in.
  '/ops/employees': ['owner', 'manager', 'hr'],
  // Select all and the export read the same files as the list (058-list-framework).
  '/ops/employees/ids': ['owner', 'manager', 'hr'],
  '/ops/employees/export.csv': ['owner', 'manager', 'hr'],
  '/ops/employees/:id': ['owner', 'manager', 'hr'],
  '/ops/employees/:id/leave-balances': ['owner', 'manager', 'hr'],
  '/ops/shift-templates': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/roster': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/attendance': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/leave/requests': ['owner', 'manager', 'hr'],
  '/ops/leave/requests/ids': ['owner', 'manager', 'hr'],
  // What each colleague earns. A draft read admits `payroll.draft` or
  // `payroll.run` (ADR-069 D-e): the owner, and `hr`, who drafts the month.
  '/ops/pay-runs': ['owner', 'hr'],
  '/ops/pay-runs/:id': ['owner', 'hr'],
  // Saved views of every HR list, declared on the union of the lists' reads and
  // narrowed to the list's own in the service: the desk reads the views of the
  // roster and the attendance sheet it works, and nothing else.
  // The owner's Reports views (`owner.reports`, money.view) admit finance as well.
  '/ops/list-views': ['owner', 'manager', 'receptionist', 'finance', 'hr'],
  // The people file (058-people-file AC-PF2). The photo is a work field, so it
  // reads like the file. Pay accounts are `people.manage` or `payroll.run`;
  // notes, documents and discipline are `people.manage` alone. All three are
  // the owner's by default, so a manager reads none of them until granted.
  '/ops/employees/:id/photo': ['owner', 'manager', 'hr'],
  '/ops/employees/:id/pay-accounts': ['owner', 'hr'],
  '/ops/employees/:id/notes': ['owner', 'hr'],
  '/ops/employees/:id/notes/:noteId/files/:index': ['owner', 'hr'],
  '/ops/employees/:id/documents': ['owner', 'hr'],
  '/ops/documents': ['owner', 'hr'],
  '/ops/documents/:id/file': ['owner', 'hr'],
  '/ops/document-requests': ['owner', 'hr'],
  '/ops/disciplinary-actions': ['owner', 'hr'],
  '/ops/disciplinary-actions/:id/file': ['owner', 'hr'],
  // What the whole business shares reads under any HR permission, so the desk
  // (`attendance.record`) reads the house rules and announcements too.
  '/ops/hr/catalog/:kind': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/hr/settings': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/policies': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/policies/:id/files/:index': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/staff-announcements': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/staff-announcements/:id/files/:index': ['owner', 'manager', 'receptionist', 'hr'],
  // Roster card fields only, as the file list (AC-PF10).
  '/ops/org-chart': ['owner', 'manager', 'hr'],
  // The new interface's HR screens (real-data, people). Teams and grades are work
  // fields, read under any HR permission as a leave type's name is; cover reads
  // like the roster; what a contract pays and where pay goes reads like the
  // contracts list; papers, departures and family are `people.manage` alone.
  '/ops/hr/teams': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/roster/cover': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/hr/compensation': ['owner', 'hr'],
  '/ops/hr/expiring-documents': ['owner', 'hr'],
  '/ops/hr/checklists': ['owner', 'hr'],
  '/ops/hr/dependants': ['owner', 'hr'],
  // Time (058-time). The week grid reads like the roster; the desk reads the
  // rotations it clocks people onto, the policies it punches under, its
  // kiosks and whether a person has a PIN. Requests are decided by those who
  // decide them, and only they list them. The insights are `people.manage`
  // alone (index contract 7), so the owner's by default.
  '/ops/roster/week': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/rotation-patterns': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/rotation-assignments': ['owner', 'manager', 'hr'],
  '/ops/shift-requests': ['owner', 'manager', 'hr'],
  '/ops/shift-requests/ids': ['owner', 'manager', 'hr'],
  '/ops/attendance-requests': ['owner', 'manager', 'hr'],
  '/ops/attendance-requests/ids': ['owner', 'manager', 'hr'],
  '/ops/attendance/policies': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/attendance/kiosks': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/attendance/insights/late-early': ['owner', 'hr'],
  '/ops/attendance/insights/monthly': ['owner', 'hr'],
  '/ops/employees/:id/kiosk-pin': ['owner', 'manager', 'receptionist', 'hr'],
  // Leave counts days by them, so whoever plans time or decides leave reads them.
  '/ops/hr/holidays': ['owner', 'manager', 'hr'],
  '/ops/hr/weekly-offs': ['owner', 'manager', 'hr'],
  // Leave in full (058-leave). A sick note, everybody's balances, the dashboard,
  // the asks for more days and the restricted periods are read by whoever
  // decides leave or keeps the files. A type's name is what every HR screen
  // draws with, so any HR permission reads the types; the national defaults
  // compared with them are `people.manage`'s, the owner's by default.
  '/ops/leave/requests/:id/attachment': ['owner', 'manager', 'hr'],
  '/ops/leave/balances': ['owner', 'manager', 'hr'],
  '/ops/leave/dashboard': ['owner', 'manager', 'hr'],
  '/ops/leave/types': ['owner', 'manager', 'receptionist', 'hr'],
  '/ops/leave/types/defaults': ['owner', 'hr'],
  '/ops/leave/allocation-requests': ['owner', 'manager', 'hr'],
  '/ops/leave/allocation-requests/ids': ['owner', 'manager', 'hr'],
  '/ops/leave/restricted-periods': ['owner', 'manager', 'hr'],
  // Payroll in full (058-payroll): every read is `payroll.run`, the owner's by
  // default, because each one says what a named colleague earns or owes. The
  // contracts list is `people.manage` too, which writes contracts, so `hr`
  // reads it. The dashboard and the rules are what a draft is created from and
  // computed by, so they admit `payroll.draft` too (ADR-069 D-e); a confirmed
  // run's payslips, files and declarations stay the owner's.
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
  '/ops/contracts': ['owner', 'hr'],
  '/ops/payroll/dashboard': ['owner', 'hr'],
  '/ops/payroll/rules': ['owner', 'hr'],
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

/**
 * The pay run, drafted and confirmed (ADR-069 D-e).
 *
 * The reads above pin who may LOOK at a run; this pins who may build one and
 * who may sign it, on every route of the controller. A draft route admits
 * `payroll.draft` OR `payroll.run`; the confirm, and everything a confirmed
 * run produces, admits `payroll.run` alone. Judged against bare grants as well
 * as the default roles, because ADR-055 lets a business hand either permission
 * to any role: a role granted `payroll.run` before the split must still
 * prepare the month it confirms (AC-5), and `payroll.draft` alone must never
 * reach the confirm.
 */
describe('pay runs: drafted by payroll.draft, confirmed by payroll.run (ADR-069 D-e)', () => {
  const routes = handlers(
    [OpsPayRunsController, OpsPayrollController],
    [RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE],
  ).filter(({ key }) => key.includes('/ops/pay-runs') || key.includes('/ops/payroll/'));

  const DRAFTING = [
    'GET /ops/pay-runs',
    'POST /ops/pay-runs',
    'GET /ops/pay-runs/:id',
    'POST /ops/pay-runs/:id/recompute',
    'POST /ops/pay-runs/:id/hold',
    'GET /ops/payroll/dashboard',
    'GET /ops/payroll/rules',
  ];
  const CONFIRMING = [
    'POST /ops/pay-runs/:id/confirm',
    'GET /ops/pay-runs/:id/payslips.pdf',
    'GET /ops/pay-runs/:id/files',
    'POST /ops/pay-runs/:id/exports',
    'POST /ops/pay-runs/:id/declarations',
  ];

  it('judges every route of the pay run', () => {
    expect(routes.map((r) => r.key).sort()).toEqual([...DRAFTING, ...CONFIRMING].sort());
  });

  it.each(routes.map((r) => [r.key, r.read] as const))('%s', (key, read) => {
    const drafting = DRAFTING.includes(key);
    // A bare grant of either permission, as an ADR-055 override can make one.
    expect(admits(read, ['payroll.draft'])).toBe(drafting);
    expect(admits(read, ['payroll.run'])).toBe(true);
    // The default roles: the owner does both, hr drafts and never signs.
    const admitted = ROLES.filter((role) => admits(read, permissionsForRole(role)));
    expect(admitted).toEqual(drafting ? ['owner', 'hr'] : ['owner']);
  });
});
