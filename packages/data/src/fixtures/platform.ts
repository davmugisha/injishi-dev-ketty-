import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Fixtures for the platform screens built with the foundation: prototype hub (Main),
 * Owner · business health (OwnerHome) and Staff · my tasks (StaffToday).
 * Values are lifted verbatim from the artifact boards.
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

export interface HubRole {
  id: string;
  group: "operator" | "devices" | "guests" | "external";
  name: string;
  persona: string;
  initials: string;
  avatarTone: Tone;
  status: string;
  statusTone: Tone;
  device: string;
  deviceIcon: IconName;
  lands: string;
  board: BoardId;
  links: { label: string; board: BoardId }[];
}

export interface HubGroup {
  id: HubRole["group"];
  title: string;
  desc: string;
  order: number;
}

export interface OwnerKpi {
  id: string;
  label: string;
  /** Numeric value, formatted with `format` (Intl.NumberFormat options). */
  value: number;
  format: {
    style?: "decimal" | "currency" | "percent";
    currency?: string;
    notation?: "standard" | "compact";
    maximumFractionDigits?: number;
  };
  trend: string;
  trendTone: Tone;
  trendIcon: IconName;
  foot: string;
  board: BoardId;
}

export interface OwnerDecision {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  chip: string;
  chipTone: Tone;
  board: BoardId;
}

export interface RevenueDay {
  id: string;
  label: string;
  rooms: number;
  fb: number;
}

export interface OwnerProperty {
  id: string;
  initials: string;
  name: string;
  kind: string;
  entity: string;
  tin: string;
  occupancy: string;
  occupancyValue: number;
  adr: string;
  exceptions: string;
  exceptionsTone: Tone;
  fiscal: string;
  fiscalTone: Tone;
  board: BoardId;
}

export interface OwnerInsight {
  id: string;
  icon: IconName;
  title: string;
  evidence: string;
  board: BoardId;
}

export interface ComplianceEvent {
  id: string;
  status: "warning" | "default" | "current" | "success";
  icon: IconName;
  title: string;
  detail: string;
  board: BoardId;
}

export interface HousekeepingTask {
  id: string;
  room: string;
  kind: string;
  kindTone: Tone;
  note: string;
  flag: string | null;
  status: "waiting" | "active" | "done";
}

export interface HousekeepingDone {
  id: string;
  room: string;
  kind: string;
  when: string;
  state: string;
  stateTone: Tone;
}

const roles: HubRole[] = [
  {
    id: "owner",
    group: "operator",
    name: "Owner",
    persona: "Didier Mugenzi · owner",
    initials: "DM",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "Desktop and phone",
    deviceIcon: "Display",
    lands:
      "Business health and the decisions only the owner can make: pay runs, refunds above the limit, fiscal setup, invitations.",
    board: "OwnerHome",
    links: [
      { label: "Approvals", board: "Approvals" },
      { label: "Team & roles", board: "TeamRoles" },
    ],
  },
  {
    id: "manager",
    group: "operator",
    name: "General manager",
    persona: "Aline Uwase · manager",
    initials: "AU",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Today’s operation: movements, bottlenecks, escalations, staffing, plus rates, revenue and sales.",
    board: "ManagerToday",
    links: [
      { label: "Housekeeping", board: "HousekeepingBoard" },
      { label: "Revenue", board: "Revenue" },
    ],
  },
  {
    id: "frontdesk",
    group: "operator",
    name: "Front desk",
    persona: "Eric Habimana · receptionist",
    initials: "EH",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "Desk workstation",
    deviceIcon: "Display",
    lands:
      "Arrivals, in-house and departures with no money reports: check in, assign rooms, take desk payments, answer guests.",
    board: "FrontDeskToday",
    links: [
      { label: "Check-in", board: "CheckIn" },
      { label: "Room rack", board: "RoomRack" },
    ],
  },
  {
    id: "finance",
    group: "operator",
    name: "Finance",
    persona: "Grace Uwera · accountant",
    initials: "GU",
    avatarTone: "warning",
    status: "Proposed role",
    statusTone: "warning",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Reconciliation exceptions first: unverified payments, held fiscal receipts, open folios, shift closes.",
    board: "FinanceHome",
    links: [
      { label: "Shift close", board: "ShiftClose" },
      { label: "Fiscal receipts", board: "FiscalReceipts" },
    ],
  },
  {
    id: "hr",
    group: "operator",
    name: "HR & payroll",
    persona: "Diane Ingabire · HR officer",
    initials: "DI",
    avatarTone: "warning",
    status: "Proposed role",
    statusTone: "warning",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Who is in, leave to decide, roster gaps and the pay run draft that the owner confirms.",
    board: "PeopleHome",
    links: [
      { label: "Pay run", board: "PayRun" },
      { label: "Roster", board: "Roster" },
    ],
  },
  {
    id: "store",
    group: "operator",
    name: "Storekeeper",
    persona: "Patrick Nshimiyimana · stores",
    initials: "PN",
    avatarTone: "warning",
    status: "Proposed role",
    statusTone: "warning",
    device: "Desktop or tablet",
    deviceIcon: "Boxes3",
    lands: "Reorder alerts, deliveries to receive, requisitions to fill and stock variances by store.",
    board: "StoreHome",
    links: [
      { label: "Goods receipt", board: "GoodsReceipt" },
      { label: "Recipes", board: "Recipes" },
    ],
  },
  {
    id: "residence",
    group: "operator",
    name: "Residence manager",
    persona: "Solange Uwimana · residence mode",
    initials: "SU",
    avatarTone: "default",
    status: "Residence mode",
    statusTone: "default",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Vacancy, arrears, rent due and notices. Leases and deposits, never hotel stays.",
    board: "ResidenceHome",
    links: [
      { label: "Units", board: "Units" },
      { label: "Rentals", board: "ResidenceHome" },
    ],
  },
  {
    id: "housekeeper",
    group: "devices",
    name: "Housekeeper",
    persona: "Jeanne Nyiraneza · housekeeper",
    initials: "JN",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "Phone",
    deviceIcon: "Smartphone",
    lands: "Only her assigned rooms, in order, with one tap to mark clean or report a problem.",
    board: "StaffToday",
    links: [
      { label: "Room task", board: "StaffTask" },
      { label: "Me", board: "StaffMe" },
    ],
  },
  {
    id: "supervisor",
    group: "devices",
    name: "Housekeeping supervisor",
    persona: "Inspection on the floor",
    initials: "HS",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "Phone",
    deviceIcon: "Smartphone",
    lands: "Inspects cleaned rooms and releases them to the front desk, or sends them back with a reason.",
    board: "InspectRoom",
    links: [{ label: "Board", board: "HousekeepingBoard" }],
  },
  {
    id: "technician",
    group: "devices",
    name: "Maintenance technician",
    persona: "Jean-Paul Niyonsaba · staff",
    initials: "JP",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "Phone",
    deviceIcon: "Smartphone",
    lands: "Work orders with photos, parts and the out-of-service block to lift when done.",
    board: "TechWorkOrders",
    links: [{ label: "Maintenance", board: "Maintenance" }],
  },
  {
    id: "waiter",
    group: "devices",
    name: "Waiter and cashier",
    persona: "Claudine Mukamana · outlet staff",
    initials: "CM",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "POS tablet",
    deviceIcon: "Display",
    lands: "Tables, tickets, split bills and tenders, charged to the right merchant and TIN.",
    board: "POS",
    links: [
      { label: "Split bill", board: "POSPayment" },
      { label: "Kitchen", board: "KitchenDisplay" },
    ],
  },
  {
    id: "outlet",
    group: "devices",
    name: "Outlet supervisor",
    persona: "Orders, voids and X/Z",
    initials: "OS",
    avatarTone: "accent",
    status: "Exists",
    statusTone: "accent",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "The live order board, void approvals and the outlet’s fiscal reports.",
    board: "OutletOrders",
    links: [{ label: "Menus", board: "OutletsMenus" }],
  },
  {
    id: "kiosk",
    group: "devices",
    name: "Clock-in kiosk",
    persona: "Shared device at staff entrance",
    initials: "CK",
    avatarTone: "default",
    status: "Shared device",
    statusTone: "default",
    device: "Tablet",
    deviceIcon: "Display",
    lands: "Clock in or out with a PIN or staff QR. No other data on screen.",
    board: "AttendanceKiosk",
    links: [],
  },
  {
    id: "guest",
    group: "guests",
    name: "Hotel guest",
    persona: "Sarah Kimani · guest",
    initials: "SK",
    avatarTone: "success",
    status: "Guest app",
    statusTone: "default",
    device: "Phone",
    deviceIcon: "Smartphone",
    lands: "Trip and arrival guide, pre-arrival check-in, digital key, requests, live bill and receipts.",
    board: "GuestTrip",
    links: [
      { label: "Digital key", board: "GuestKey" },
      { label: "Bill", board: "GuestFolio" },
    ],
  },
  {
    id: "qr",
    group: "guests",
    name: "In-room ordering",
    persona: "Guest via room QR",
    initials: "QR",
    avatarTone: "success",
    status: "Guest app",
    statusTone: "default",
    device: "Phone",
    deviceIcon: "QrCode",
    lands: "Menu, basket and order tracking, tied to the active stay so it can charge to the room.",
    board: "QROrder",
    links: [],
  },
  {
    id: "resident",
    group: "guests",
    name: "Resident",
    persona: "Olivier Habineza · tenant",
    initials: "OH",
    avatarTone: "success",
    status: "Resident portal",
    statusTone: "default",
    device: "Phone",
    deviceIcon: "Smartphone",
    lands: "Rent due and receipts, deposit held, maintenance requests, visitors and lease documents.",
    board: "TenantHome",
    links: [{ label: "My home", board: "TenantHome" }],
  },
  {
    id: "visitor",
    group: "guests",
    name: "Marketplace visitor",
    persona: "Anyone searching stays or homes",
    initials: "MV",
    avatarTone: "default",
    status: "Public",
    statusTone: "default",
    device: "Web",
    deviceIcon: "Globe",
    lands: "Search, property pages with verified business details, and checkout with honest payment states.",
    board: "MarketExplore",
    links: [
      { label: "Property", board: "MarketProperty" },
      { label: "Checkout", board: "MarketCheckout" },
    ],
  },
  {
    id: "broker",
    group: "guests",
    name: "Broker",
    persona: "Emmanuel Twagira · residence broker",
    initials: "ET",
    avatarTone: "default",
    status: "Broker workspace",
    statusTone: "default",
    device: "Web and phone",
    deviceIcon: "Briefcase",
    lands: "Leads, placements and earnings, plus contact reveals paid with credits.",
    board: "BrokerWork",
    links: [{ label: "Directory", board: "BrokerDirectory" }],
  },
  {
    id: "officer",
    group: "external",
    name: "District officer",
    persona: "Alice Mukeshimana · scoped officer",
    initials: "AM",
    avatarTone: "default",
    status: "External · scoped",
    statusTone: "info",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Verification and approval queues inside one assigned mandate, with two-person review.",
    board: "OfficerHome",
    links: [
      { label: "Case", board: "OfficerCase" },
      { label: "Delegated data", board: "DelegatedReports" },
    ],
  },
  {
    id: "district",
    group: "external",
    name: "District administrator",
    persona: "Bodies and officer scopes",
    initials: "DA",
    avatarTone: "default",
    status: "External · scoped",
    statusTone: "info",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Registers government bodies and assigns officers to a jurisdiction and permission set.",
    board: "DistrictAdmin",
    links: [],
  },
  {
    id: "psf",
    group: "external",
    name: "PSF and Chamber staff",
    persona: "Membership applications",
    initials: "PS",
    avatarTone: "default",
    status: "External · scoped",
    statusTone: "info",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Membership applications submitted by businesses, decided by the institution, never by Injishi.",
    board: "PsfConsole",
    links: [],
  },
  {
    id: "ops",
    group: "external",
    name: "Injishi operations",
    persona: "Kevin Mugisha · platform staff",
    initials: "KM",
    avatarTone: "accent",
    status: "Platform staff",
    statusTone: "default",
    device: "Desktop",
    deviceIcon: "Display",
    lands: "Control tower for tenants, KYB, money ledger, integration health, support and audit.",
    board: "AdminHome",
    links: [
      { label: "Money", board: "AdminMoney" },
      { label: "Health", board: "AdminHealth" },
    ],
  },
  {
    id: "assistant",
    group: "external",
    name: "Support assistant",
    persona: "Injishi-native, permission-scoped",
    initials: "AI",
    avatarTone: "accent",
    status: "Assistant",
    statusTone: "default",
    device: "In every workspace",
    deviceIcon: "Comments",
    lands:
      "Answers from Injishi help and the asker’s own data, proposes actions for a person to approve, hands off to support.",
    board: "Assistant",
    links: [{ label: "Usage", board: "AssistantUsage" }],
  },
];

const groups: HubGroup[] = [
  {
    id: "operator",
    title: "Operator Workspaces",
    desc: "Desktop-first. Navigation and data follow each role’s permissions.",
    order: 1,
  },
  {
    id: "devices",
    title: "Staff Devices",
    desc: "Task-first, touch-sized and tolerant of weak connections.",
    order: 2,
  },
  {
    id: "guests",
    title: "Guests, Residents and the Public",
    desc: "Mobile web first. Clear states for every payment, key and document.",
    order: 3,
  },
  {
    id: "external",
    title: "Institutions and Injishi Staff",
    desc: "Separate permission universes. Nobody here belongs to a business’s team.",
    order: 4,
  },
];

const kpis: OwnerKpi[] = [
  {
    id: "occupancy",
    label: "Occupancy tonight",
    value: 0.78,
    format: { style: "percent" },
    trend: "6 pts",
    trendTone: "success",
    trendIcon: "ArrowUpRight",
    foot: "47 of 60 rooms and tents",
    board: "Reports",
  },
  {
    id: "adr",
    label: "ADR",
    value: 118400,
    format: { style: "currency", currency: "RWF" },
    trend: "2.1%",
    trendTone: "danger",
    trendIcon: "ArrowDownRight",
    foot: "Average daily rate, hotel and lodge",
    board: "Reports",
  },
  {
    id: "revpar",
    label: "RevPAR",
    value: 92350,
    format: { style: "currency", currency: "RWF" },
    trend: "5.4%",
    trendTone: "success",
    trendIcon: "ArrowUpRight",
    foot: "Same night last week",
    board: "Reports",
  },
  {
    id: "collections",
    label: "Verified collections",
    value: 7900000,
    format: { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 1 },
    trend: "today",
    trendTone: "default",
    trendIcon: "Check",
    foot: "Confirmed by GT Bank or MoMo provider",
    board: "FinanceHome",
  },
  {
    id: "unsettled",
    label: "Unsettled and receivables",
    value: 6200000,
    format: { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 1 },
    trend: "9 items",
    trendTone: "danger",
    trendIcon: "TriangleExclamation",
    foot: "Open folios, unverified payments, city ledger",
    board: "FinanceHome",
  },
];

const decisions: OwnerDecision[] = [
  {
    id: "payrun-oct",
    icon: "Persons",
    title: "Confirm October pay run",
    desc: "Prepared by Diane Ingabire · 48 staff · RWF 19.8M net",
    chip: "Confirm by 22 Oct",
    chipTone: "default",
    board: "Approvals",
  },
  {
    id: "refund-bk-20418",
    icon: "ArrowUturnCcwLeft",
    title: "Refund RWF 480,000, above your RWF 300,000 limit",
    desc: "BK-20418 · Volcano view group · cancellation tier 2",
    chip: "Guest waiting",
    chipTone: "warning",
    board: "Approvals",
  },
  {
    id: "rate-deluxe",
    icon: "Tag",
    title: "Publish Deluxe Lake View rate change",
    desc: "Revenue suggests RWF 152,000 for 24–26 Oct · Aline reviewed",
    chip: "Expires 18:00",
    chipTone: "warning",
    board: "Approvals",
  },
  {
    id: "invite-grace",
    icon: "PersonPlus",
    title: "Invite Grace Uwera as Finance",
    desc: "Finance is a proposed role · access starts only after you approve",
    chip: "New role",
    chipTone: "warning",
    board: "Approvals",
  },
];

const revenueDays: RevenueDay[] = [
  [52, 14],
  [48, 12],
  [55, 16],
  [61, 18],
  [70, 22],
  [74, 20],
  [58, 15],
  [50, 13],
  [54, 15],
  [60, 17],
  [66, 19],
  [72, 24],
  [76, 21],
  [63, 12],
].map(([rooms, fb], i) => {
  const d = new Date(Date.UTC(2026, 8, 29 + i));
  const label = i === 13 ? "Today" : `${d.getUTCDate()} ${["Sep", "Oct"][d.getUTCMonth() - 8]}`;
  return { id: `d${String(i + 1).padStart(2, "0")}`, label, rooms, fb };
});

const properties: OwnerProperty[] = [
  {
    id: "isangano",
    initials: "IL",
    name: "Isangano Lakeside Hotel",
    kind: "Hotel · Rubavu · 42 rooms",
    entity: "Amahoro Hospitality Ltd",
    tin: "TIN 102 345 678",
    occupancy: "80% tonight",
    occupancyValue: 80,
    adr: "RWF 124,600",
    exceptions: "5 open",
    exceptionsTone: "warning",
    fiscal: "3 pending over 2h",
    fiscalTone: "warning",
    board: "FrontDeskToday",
  },
  {
    id: "ishyamba",
    initials: "IF",
    name: "Ishyamba Forest Lodge",
    kind: "Lodge · Nyamagabe · 18 tents",
    entity: "Amahoro Hospitality Ltd",
    tin: "TIN 102 345 678",
    occupancy: "72% tonight",
    occupancyValue: 72,
    adr: "RWF 104,300",
    exceptions: "1 open",
    exceptionsTone: "default",
    fiscal: "All issued",
    fiscalTone: "success",
    board: "FrontDeskToday",
  },
  {
    id: "kacyiru",
    initials: "KC",
    name: "Kacyiru Court Residences",
    kind: "Residence · Gasabo · 24 units",
    entity: "Amahoro Residences Ltd",
    tin: "TIN 102 345 990",
    occupancy: "22 of 24 leased",
    occupancyValue: 92,
    adr: "Not nightly",
    exceptions: "3 in arrears",
    exceptionsTone: "warning",
    fiscal: "Rules not verified",
    fiscalTone: "warning",
    board: "ResidenceHome",
  },
];

const insights: OwnerInsight[] = [
  {
    id: "turnaround",
    icon: "BroomMotion",
    title: "Rooms 204 and 211 took over three hours to turn four times this week",
    evidence: "9 checkout tasks · median 3 h 20 min against a 90 min target",
    board: "HousekeepingBoard",
  },
  {
    id: "umurage",
    icon: "Briefcase",
    title: "Umurage Consulting is 62 days past due on RWF 2.1M",
    evidence: "3 invoices on the city ledger · credit limit RWF 2.5M",
    board: "AccountsReceivable",
  },
  {
    id: "tilapia",
    icon: "Cherry",
    title: "Isangano Terrace ran out of tilapia twice on Friday",
    evidence: "Stock reached zero at 19:40 and 20:15 · reorder point not set",
    board: "StoreHome",
  },
];

const compliance: ComplianceEvent[] = [
  {
    id: "licence",
    status: "warning",
    icon: "Clock",
    title: "Ishyamba tourism licence expires in 34 days",
    detail: "Renewal documents not uploaded yet",
    board: "Compliance",
  },
  {
    id: "vsdc",
    status: "warning",
    icon: "FileExclamation",
    title: "3 fiscal receipts pending at the VSDC for over 2 hours",
    detail: "Retrying with the same request ID · no duplicates issued",
    board: "FiscalReceipts",
  },
  {
    id: "gtbank",
    status: "default",
    icon: "Lock",
    title: "GT Bank production access not verified",
    detail: "Sandbox connected · contract and VPN details still with the bank",
    board: "Integrations",
  },
  {
    id: "psf",
    status: "current",
    icon: "PaperPlane",
    title: "PSF membership application sent",
    detail: "Awaiting PSF’s decision · submitted 3 Oct",
    board: "Compliance",
  },
];

const tasks: HousekeepingTask[] = [
  {
    id: "204",
    room: "204",
    kind: "Checkout",
    kindTone: "accent",
    note: "Arrival at 14:00 · Deluxe Lake View · 2 adults",
    flag: "Due 12:00",
    status: "waiting",
  },
  {
    id: "211",
    room: "211",
    kind: "Checkout",
    kindTone: "accent",
    note: "Guest left at 09:40 · extra bed to remove",
    flag: "Due 13:00",
    status: "waiting",
  },
  {
    id: "206",
    room: "206",
    kind: "Stayover",
    kindTone: "default",
    note: "Do not disturb until 11:00 · towels only",
    flag: null,
    status: "waiting",
  },
  {
    id: "209",
    room: "209",
    kind: "Deep clean",
    kindTone: "info",
    note: "Monthly · curtains and mattress turn",
    flag: null,
    status: "waiting",
  },
];

const done: HousekeepingDone[] = [
  {
    id: "201",
    room: "201",
    kind: "Checkout",
    when: "Cleaned 08:15 · inspected 08:40",
    state: "Inspected",
    stateTone: "success",
  },
  { id: "203", room: "203", kind: "Stayover", when: "Cleaned 09:05", state: "Clean", stateTone: "success" },
  {
    id: "207",
    room: "207",
    kind: "Checkout",
    when: "Cleaned 09:50 · waiting for inspection",
    state: "Clean",
    stateTone: "success",
  },
];

export const fixtures = {
  "platform.hubGroups": groups,
  "platform.hubRoles": roles,
  "platform.ownerKpis": kpis,
  "platform.ownerDecisions": decisions,
  "platform.revenueDays": revenueDays,
  "platform.ownerProperties": properties,
  "platform.ownerInsights": insights,
  "platform.ownerCompliance": compliance,
  "platform.housekeepingTasks": tasks,
  "platform.housekeepingDone": done,
} satisfies FixtureSet;
