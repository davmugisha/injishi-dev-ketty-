import type { BoardId } from "./types.ts";

/**
 * What each screen requires of a real person (ADR-076 G14).
 *
 * The registry beside this (`screens.ts`) is generated from the design canvas,
 * and its generator is not in this repository, so the requirement lives here,
 * keyed by board and typed as a record over every board: a screen added to the
 * registry without a line here fails the typecheck.
 *
 * - `family`: which grant family opens it. `public` needs nobody; `self`, any
 *   signed in person; `business`, a business workspace; `broker`, a broker
 *   workspace; `staff` and `oversight`, the Injishi staff and government grant
 *   families, which are never mixed with business roles (ADR-074).
 * - `product`: a business screen's product, which must be on for the business
 *   (at the branch in view) in the person's `grants`.
 * - `anyPermission`: a business screen opens for a person holding one of these,
 *   under the NEW names `grants` carries (`pms.stay.checkin`). Each list mirrors
 *   what the API route behind the screen declares, so the screen and its data
 *   refuse the same people. Absent means the product alone decides: a screen
 *   with no route behind it yet, or one about the person's own records.
 *
 * An affordance, like every client check: the API is the boundary. A demo
 * persona is judged by its story (`canAccess`), and only on the demo.
 */
export type ScreenFamily = "public" | "self" | "business" | "broker" | "staff" | "oversight";

/** The products a business screen can name (`ProductId` in @injishi/contracts, less `admin` and `membership`). */
export type ScreenProduct =
  | "account"
  | "marketplace"
  | "pms"
  | "outlets"
  | "pos"
  | "residence"
  | "hr"
  | "finance"
  | "pay";

export interface ScreenRequires {
  family: ScreenFamily;
  product?: ScreenProduct;
  anyPermission?: readonly string[];
}

const PUBLIC: ScreenRequires = { family: "public" };
const SELF: ScreenRequires = { family: "self" };
const business = (product: ScreenProduct, anyPermission?: readonly string[]): ScreenRequires =>
  anyPermission ? { family: "business", product, anyPermission } : { family: "business", product };

/** The owner's lock (`team.manage`): the screens only a business's owner works. */
const OWNER = ["account.team.manage"];
const MONEY = ["finance.money.view"];
const DESK = [
  "pms.reservation.approve",
  "pms.reservation.assign",
  "pms.stay.checkin",
  "pms.stay.checkout",
  "finance.money.view",
];
const RESERVATIONS = ["pms.reservation.approve", "pms.reservation.assign", "pms.stay.checkin", "finance.money.view"];
const LISTINGS = ["property.listing.manage"];
const HOUSEKEEPING = ["pms.housekeeping.set", "pms.task.assign"];
const STAFF_PHONE = ["pms.housekeeping.set", "pms.task.assign", "pms.ticket.advance"];
const PEOPLE = ["hr.people.view", "hr.people.manage", "hr.payroll.run"];
const PAY_RUN = ["hr.payroll.draft", "hr.payroll.run"];
const RESIDENCE = [
  "residence.lease.manage",
  "residence.rent.record",
  "residence.deposit.return",
  "residence.unit.manage",
  "finance.money.view",
];
const OUTLET_BACK_OFFICE = ["outlets.menu.manage", "outlets.outlet.manage"];
/** What the rentals profile, setup and buildings routes declare: anyone who works the rentals or their money. */
const RENTALS_READ = [
  "residence.lease.manage",
  "residence.unit.manage",
  "property.listing.manage",
  "finance.money.view",
  "residence.rent.record",
  "residence.deposit.return",
  "pay.payout.manage",
  "residence.lease.sign",
];
/** What the leases routes declare for a read. */
const LEASES_READ = [
  "residence.lease.manage",
  "residence.rent.record",
  "finance.money.view",
  "residence.deposit.return",
];

export const SCREEN_REQUIRES: Readonly<Record<BoardId, ScreenRequires>> = {
  // Public: the marketing site, sign-in, the marketplace, training and the kiosk.
  Main: PUBLIC,
  SignIn: PUBLIC,
  InviteAccept: PUBLIC,
  LeaseInvite: PUBLIC,
  Register: PUBLIC,
  StatesGallery: PUBLIC,
  AttendanceKiosk: PUBLIC,
  MarketExplore: PUBLIC,
  MarketProperty: PUBLIC,
  MarketCheckout: PUBLIC,
  PublicHost: PUBLIC,
  PublicHelp: PUBLIC,
  Training: PUBLIC,

  // Any signed in person (the shared boards).
  Account: SELF,
  Notifications: SELF,
  // Me: every signed-in person's own HR, read through their own file (`/me/work`).
  MyHr: SELF,
  GlobalSearch: SELF,
  Assistant: SELF,
  AccessDenied: SELF,

  // The owner's screens, under Account. Plan, settings and the audit log are
  // the owner's until slice X adds `plan.view` and `business.view`.
  Onboarding: business("account", ["account.team.manage", "property.listing.manage"]),
  BusinessSwitcher: business("account"),
  OwnerHome: business("account", MONEY),
  Approvals: business("pms", ["pms.reservation.approve"]),
  Reports: business("finance", MONEY),
  Compliance: business("account", ["property.listing.manage", "finance.money.view"]),
  TeamRoles: business("account", OWNER),
  PlanBilling: business("account", OWNER),
  SettingsBusiness: business("account", ["account.team.manage", "property.listing.manage"]),
  SettingsPolicies: business("account", LISTINGS),
  Integrations: business("account", ["fiscal.ebm.manage"]),
  AuditLog: business("account", OWNER),

  // PMS: the front desk.
  FrontDeskToday: business("pms", DESK),
  CheckIn: business("pms", ["pms.stay.checkin"]),
  WalkIn: business("pms", ["pms.stay.checkin"]),
  RoomRack: business("pms", [
    "pms.stay.checkin",
    "pms.housekeeping.set",
    "pms.reservation.assign",
    "property.listing.manage",
  ]),
  Reservations: business("pms", RESERVATIONS),
  // The stays calendar (2026-10-30) reads the reservations the desk works.
  StaysCalendar: business("pms", RESERVATIONS),
  ReservationDetail: business("pms", RESERVATIONS),
  StayFolio: business("pms", ["pms.folio.charge", "pms.folio.payment", "pms.folio.close", "finance.money.view"]),
  Checkout: business("pms", ["pms.stay.checkout"]),
  Messages: business("pms", ["communications.message.send"]),
  Guests: business("pms", ["pms.stay.checkin", "pms.reservation.approve"]),
  OfflineDesk: business("pms", ["pms.stay.checkin"]),

  // PMS: the manager's floor, rates and listings.
  ManagerToday: business("pms", ["finance.money.view", "pms.reservation.approve"]),
  RatesInventory: business("pms", LISTINGS),
  AvailabilityCalendar: business("pms", LISTINGS),
  Listing: business("pms", LISTINGS),
  Packages: business("pms", ["pms.offer.manage", "property.listing.manage"]),
  Groups: business("pms", ["pms.reservation.approve"]),
  SalesEvents: business("pms", ["pms.offer.manage"]),
  Loyalty: business("pms", ["pms.offer.manage"]),
  Channels: business("pms", LISTINGS),
  HousekeepingBoard: business("pms", HOUSEKEEPING),
  Maintenance: business("pms", ["pms.ticket.advance"]),
  LostFound: business("pms", ["pms.lostfound.manage"]),
  Revenue: business("finance", MONEY),
  OutletsMenus: business("outlets", ["outlets.menu.manage", "outlets.outlet.manage", "outlets.order.advance"]),

  // Finance.
  FinanceHome: business("finance", MONEY),
  Folios: business("finance", ["pms.folio.charge", "pms.folio.payment", "pms.folio.close", "finance.money.view"]),
  Payments: business("finance", ["pms.folio.payment", "finance.money.view"]),
  Reconciliation: business("finance", MONEY),
  ShiftClose: business("finance", MONEY),
  NightAudit: business("finance", MONEY),
  FiscalReceipts: business("finance", ["fiscal.ebm.manage", "fiscal.ebm.refund", "finance.money.view"]),
  AccountsReceivable: business("finance", MONEY),
  Commissions: business("finance", MONEY),
  GeneralLedger: business("finance", MONEY),
  TaxSummary: business("finance", MONEY),

  // HR.
  PeopleHome: business("hr", PEOPLE),
  Employees: business("hr", PEOPLE),
  Roster: business("hr", ["hr.roster.manage", "hr.attendance.record", "hr.people.view"]),
  Attendance: business("hr", ["hr.attendance.record", "hr.attendance.approve"]),
  Leave: business("hr", ["hr.leave.approve", "hr.people.manage"]),
  PayRun: business("hr", PAY_RUN),
  PayrollRules: business("hr", PAY_RUN),
  Talent: business("hr", ["hr.people.manage", "hr.people.view"]),
  StaffServices: business("hr", ["hr.people.manage", "hr.people.view"]),
  // `GET /ops/hr/report` asks `people.manage`.
  HrReport: business("hr", ["hr.people.manage"]),

  // The staff phone: rooms and work orders are PMS's; a person's own schedule
  // and profile need no permission, only that HR runs there.
  StaffToday: business("pms", STAFF_PHONE),
  StaffTask: business("pms", STAFF_PHONE),
  StaffReport: business("pms", STAFF_PHONE),
  StaffSchedule: business("hr"),
  StaffMe: business("hr"),
  InspectRoom: business("pms", HOUSEKEEPING),
  TechWorkOrders: business("pms", ["pms.ticket.advance"]),

  // POS and the outlets. POS has no route of its own yet (stage 5); its screens
  // work orders, so they ask for the order permission the board asks for.
  POS: business("pos", ["outlets.order.advance"]),
  POSPayment: business("pos", ["outlets.order.advance"]),
  KitchenDisplay: business("pos", ["outlets.order.advance"]),
  OutletOrders: business("outlets", ["outlets.order.advance"]),
  // The bar and restaurant point of sale (POS spec, phase 1), each mirroring the routes behind it.
  PosFloor: business("pos", ["pos.sale.sell", "pos.table.manage", "pos.sale.checkout"]),
  PosTill: business("pos", ["pos.sale.sell", "pos.sale.checkout"]),
  PosStations: business("pos", ["pos.kitchen.work", "pos.sale.sell", "outlets.outlet.manage"]),
  PosShift: business("pos", ["pos.register.operate", "finance.shift.review"]),
  // The POS back office, customers and venue setup: the same gates each page and the POS sidebar already apply.
  PosDashboard: business("pos", ["finance.shift.review", "finance.money.view"]),
  PosMenu: business("pos", ["pos.sale.sell", "pos.sale.checkout", "outlets.menu.manage"]),
  PosStock: business("pos", ["pos.stock.manage", "finance.shift.review"]),
  PosReports: business("pos", ["finance.shift.review", "finance.money.view"]),
  PosCustomers: business("pos", ["pos.customer.view", "pos.customer.manage"]),
  PosSetup: business("pos", ["outlets.outlet.manage"]),
  // The store room (platform/inventory, stage 5): the outlets' back office.
  StoreHome: business("outlets", OUTLET_BACK_OFFICE),
  PurchaseOrders: business("outlets", OUTLET_BACK_OFFICE),
  GoodsReceipt: business("outlets", OUTLET_BACK_OFFICE),
  StockLedger: business("outlets", OUTLET_BACK_OFFICE),
  Recipes: business("outlets", OUTLET_BACK_OFFICE),

  // Residence.
  ResidenceHome: business("residence", RESIDENCE),
  Leases: business("residence", LEASES_READ),
  MoveOuts: business("residence", ["residence.deposit.return", "residence.lease.manage"]),
  // The rentals rebuild (2026-10), each mirroring the routes behind it, as the landlord's sidebar does
  // (server/rentals/nav.ts). Settings is Residence's, and hides its Getting paid tab while Pay is off;
  // the lease screens hide their broker controls while Marketplace is off.
  Units: business("residence", ["residence.unit.manage", "residence.lease.manage", "finance.money.view"]),
  RentalsSetup: business("residence", RENTALS_READ),
  RentalsSettings: business("residence", [...RENTALS_READ, "account.team.manage"]),
  LeaseNew: business("residence", ["residence.lease.manage"]),
  LeaseRecord: business("residence", LEASES_READ),
  LandlordGuests: business("residence", ["property.guest.register"]),
  Faults: business("residence", ["pms.ticket.advance"]),
  // The landlord's side of the broker network is Marketplace's (owner, 2026-10-30).
  LandlordBrokers: business("marketplace", ["residence.lease.manage", "communications.message.send"]),
  Expenses: business("residence", ["finance.money.view", "residence.expense.manage"]),
  Taxes: business("residence", ["finance.money.view", "residence.tax.manage"]),
  // The landlord's money and planning tabs (2026-11), each mirroring its routes: the calendar and to-do read
  // the rentals overview, rent the rent routes, filings the filings route; payouts are Pay's.
  RentalsCalendar: business("residence", RESIDENCE),
  RentalsTodo: business("residence", RESIDENCE),
  RentPayments: business("residence", ["residence.rent.record", "finance.money.view"]),
  RentPayouts: business("pay", ["finance.money.view", "pay.payout.manage"]),
  TaxFilings: business("residence", ["finance.money.view", "residence.tax.manage", "residence.lease.manage"]),
  LandlordMessages: business("residence", ["communications.message.send"]),

  // A guest's and a resident's own records.
  QROrder: SELF,
  GuestTrip: SELF,
  GuestPreArrival: SELF,
  GuestStay: SELF,
  GuestKey: SELF,
  GuestRequests: SELF,
  GuestFolio: SELF,
  GuestReview: SELF,
  GuestAccount: SELF,
  TenantHome: SELF,
  TenantLeaseHome: SELF,
  TenantRent: SELF,
  TenantGuests: SELF,
  TenantFaults: SELF,
  TenantMoveOut: SELF,
  TenantMessages: SELF,
  TenantLease: SELF,
  TenantCalendar: SELF,
  TenantTodo: SELF,
  TenantCharges: SELF,

  // The other grant families.
  BrokerWork: { family: "broker" },
  BrokerDirectory: { family: "broker" },
  BrokerPlacements: { family: "broker" },
  BrokerMessages: { family: "broker" },
  BrokerEarnings: { family: "broker" },
  BrokerHotels: { family: "broker" },
  BrokerBookings: { family: "broker" },
  BrokerReviews: { family: "broker" },
  BrokerPlan: { family: "broker" },
  OfficerHome: { family: "oversight" },
  OfficerCase: { family: "oversight" },
  OfficerDecisions: { family: "oversight" },
  DistrictAdmin: { family: "oversight" },
  DelegatedReports: { family: "oversight" },
  PsfConsole: { family: "oversight" },
  // The PSF console's pages (the District Manager's and the BDE's), on their oversight seat.
  PsfApplication: { family: "oversight" },
  PsfRegister: { family: "oversight" },
  PsfMoney: { family: "oversight" },
  PsfSetup: { family: "oversight" },
  PsfReport: { family: "oversight" },
  PsfBusiness: { family: "oversight" },
  PsfClaims: { family: "oversight" },
  PsfDecisions: { family: "oversight" },
  PsfSubtypes: { family: "oversight" },
  PsfFees: { family: "oversight" },
  PsfTeam: { family: "oversight" },
  LeaderGuests: { family: "oversight" },
  LeaderReports: { family: "oversight" },
  AdminHome: { family: "staff" },
  AdminBusinesses: { family: "staff" },
  AdminMoney: { family: "staff" },
  AdminHealth: { family: "staff" },
  AdminSupport: { family: "staff" },
  AdminRules: { family: "staff" },
  AdminPeople: { family: "staff" },
  AdminRoles: { family: "staff" },
  AdminBrokerPrices: { family: "staff" },
  AdminPsf: { family: "staff" },
  AdminLeaders: { family: "staff" },
  AdminCoverage: { family: "staff" },
  AdminBrokerPlans: { family: "staff" },
  AdminAudit: { family: "staff" },
  AdminInsights: { family: "staff" },
  AssistantUsage: { family: "staff" },
};

/**
 * Where a person holding several products lands (ADR-076 G14): the first of
 * these products they hold a permission in, and the board each one opens on.
 */
export const PRODUCT_HOME: readonly { product: ScreenProduct; board: BoardId }[] = [
  { product: "pms", board: "FrontDeskToday" },
  { product: "residence", board: "ResidenceHome" },
  { product: "outlets", board: "OutletOrders" },
  { product: "pos", board: "POS" },
  { product: "hr", board: "PeopleHome" },
  { product: "finance", board: "FinanceHome" },
];
