import type { BoardId, IconName, PersonaId, PhoneAppId } from "./types.ts";

/** Every demo sign-in uses this one-time code. */
export const DEMO_OTP = "123456";

export type PersonaGroup = "operator" | "devices" | "guests" | "external";
export type Tone = "accent" | "warning" | "default" | "success" | "danger" | "info";

/** Where a persona works after sign-in. */
export type PersonaApp =
  | { kind: "workspace" }
  | { kind: "phone"; app: PhoneAppId }
  | { kind: "tablet" }
  | { kind: "web" };

export interface Branch {
  id: string;
  name: string;
  meta: string;
  warn?: string;
}

/** Business context shown in the sidebar switcher (from the artifact's BusinessSwitcher board). */
export interface WorkspaceContext {
  kind: "business" | "institution";
  ini: string;
  name: string;
  meta: string;
  role: string;
  rolePhrase?: string;
  proposedRole?: boolean;
  branches: Branch[];
  currentBranch: string;
  canManage?: boolean;
  others: {
    ini: string;
    name: string;
    meta: string;
    count?: string;
    countLabel?: string;
    board: BoardId;
    /** A real business: choosing it switches the session's workspace (`POST /me/active-workspace`) first. */
    workspaceId?: string;
  }[];
  invite: { ini: string; name: string; role: string; board: BoardId } | null;
  /** Institution workspaces show a fixed header instead of the business switcher. */
  sub?: string;
  tone?: Tone;
}

export interface TryItem {
  label: string;
  board: BoardId;
  note: string;
}

export interface Persona {
  id: PersonaId;
  name: string;
  firstName: string;
  initials: string;
  email: string;
  phone: string;
  /** Role label, e.g. "Front desk". */
  role: string;
  /** Short persona line from the hub, e.g. "Eric Habimana · receptionist". */
  tagline: string;
  /** Sign-in card headline, e.g. "Front desk at Isangano Lakeside Hotel". */
  headline: string;
  org: string;
  group: PersonaGroup;
  status: { label: string; tone: Tone };
  device: { label: string; icon: IconName };
  /** What the persona lands on (hub description). */
  lands: string;
  home: BoardId;
  app: PersonaApp;
  avatarTone: Tone;
  /** "What to try" on the sign-in card. */
  tryItems: TryItem[];
  workspace?: WorkspaceContext;
  /** Boards this persona may open beyond its navigation, home and the shared screens. */
  access?: BoardId[];
}

const AHL = { ini: "AH", name: "Amahoro Hospitality Ltd", meta: "Hotel and lodge · 2 branches · TIN 102 345 678" };
const ALL: Branch = { id: "all", name: "All branches", meta: "60 rooms" };
const ISA: Branch = { id: "isa", name: "Isangano Lakeside Hotel", meta: "42 rooms", warn: "EBM delayed" };
const ISH: Branch = { id: "ish", name: "Ishyamba Forest Lodge", meta: "18 tents" };
const KCR = {
  ini: "KC",
  name: "Kacyiru Court Residences",
  meta: "Landlord · 24 units · 3 need you",
  count: "3",
  countLabel: "3 items need you",
  board: "ResidenceHome" as BoardId,
};
const GIS = { ini: "GL", name: "Gisenyi Lodge", meta: "Manager · Main branch only", board: "ManagerToday" as BoardId };

const business = (
  ctx: Omit<WorkspaceContext, "kind" | "ini" | "name" | "meta"> &
    Partial<Pick<WorkspaceContext, "ini" | "name" | "meta">>,
): WorkspaceContext => ({
  kind: "business",
  ...AHL,
  ...ctx,
});

export const personas: Record<PersonaId, Persona> = {
  owner: {
    id: "owner",
    name: "Didier Mugenzi",
    firstName: "Didier",
    initials: "DM",
    email: "didier@app.demo.injishi.com",
    phone: "+250 788 123 456",
    role: "Owner",
    tagline: "Didier Mugenzi · owner",
    headline: "Owner of Amahoro Hospitality Ltd",
    org: "Amahoro Hospitality Ltd",
    group: "operator",
    status: { label: "Exists", tone: "accent" },
    device: { label: "Desktop and phone", icon: "Display" },
    lands:
      "Business health and the decisions only the owner can make: pay runs, refunds above the limit, fiscal setup, invitations.",
    home: "OwnerHome",
    app: { kind: "workspace" },
    avatarTone: "accent",
    tryItems: [
      {
        label: "Approvals",
        board: "Approvals",
        note: "Pay runs, refunds above your limit and role invitations wait here, each with its evidence.",
      },
      {
        label: "Team & roles",
        board: "TeamRoles",
        note: "Invite people and see exactly what each role can do before you grant it.",
      },
      { label: "Reports", board: "Reports", note: "Performance and financial reports across both branches." },
    ],
    workspace: business({
      role: "Owner",
      rolePhrase: "You’re the owner here.",
      branches: [ALL, ISA, ISH],
      currentBranch: "all",
      canManage: true,
      others: [KCR, GIS],
      invite: { ini: "TP", name: "Twagira Property Agency", role: "Broker", board: "BrokerWork" },
    }),
    access: ["BusinessSwitcher", "Onboarding", "Account", "GuestAccount"],
  },
  manager: {
    id: "manager",
    name: "Aline Uwase",
    firstName: "Aline",
    initials: "AU",
    email: "aline@app.demo.injishi.com",
    phone: "+250 788 210 334",
    role: "General manager",
    tagline: "Aline Uwase · manager",
    headline: "General manager at Isangano Lakeside Hotel",
    org: "Amahoro Hospitality Ltd",
    group: "operator",
    status: { label: "Exists", tone: "accent" },
    device: { label: "Desktop", icon: "Display" },
    lands: "Today’s operation: movements, bottlenecks, escalations, staffing, plus rates, revenue and sales.",
    home: "ManagerToday",
    app: { kind: "workspace" },
    avatarTone: "accent",
    tryItems: [
      {
        label: "Housekeeping",
        board: "HousekeepingBoard",
        note: "Every room’s state on one board, shared with the housekeepers’ phones.",
      },
      { label: "Revenue", board: "Revenue", note: "Forecast and pricing suggestions you can accept or reject." },
      { label: "Rates & inventory", board: "RatesInventory", note: "Rate plans and room inventory across channels." },
    ],
    workspace: business({
      role: "General manager",
      rolePhrase: "You’re the general manager here.",
      branches: [ISA, ISH],
      currentBranch: "isa",
      others: [],
      invite: null,
    }),
  },
  frontdesk: {
    id: "frontdesk",
    name: "Eric Habimana",
    firstName: "Eric",
    initials: "EH",
    email: "eric@app.demo.injishi.com",
    phone: "+250 788 330 112",
    role: "Front desk",
    tagline: "Eric Habimana · receptionist",
    headline: "Front desk at Isangano Lakeside Hotel",
    org: "Amahoro Hospitality Ltd",
    group: "operator",
    status: { label: "Exists", tone: "accent" },
    device: { label: "Desk workstation", icon: "Display" },
    lands:
      "Arrivals, in-house and departures with no money reports: check in, assign rooms, take desk payments, answer guests.",
    home: "FrontDeskToday",
    app: { kind: "workspace" },
    avatarTone: "accent",
    tryItems: [
      { label: "Check-in", board: "CheckIn", note: "Assign a room, verify ID and take the deposit in one flow." },
      { label: "Room rack", board: "RoomRack", note: "The tape chart of every room and stay." },
      { label: "Walk-in", board: "WalkIn", note: "Book a guest who arrives without a reservation." },
    ],
    workspace: business({
      role: "Front desk",
      rolePhrase: "You work the front desk here.",
      branches: [ISA],
      currentBranch: "isa",
      others: [],
      invite: null,
    }),
    access: ["AccessDenied"],
  },
  finance: {
    id: "finance",
    name: "Grace Uwera",
    firstName: "Grace",
    initials: "GU",
    email: "grace@app.demo.injishi.com",
    phone: "+250 788 440 908",
    role: "Finance",
    tagline: "Grace Uwera · accountant",
    headline: "Accountant at Amahoro Hospitality Ltd",
    org: "Amahoro Hospitality Ltd",
    group: "operator",
    status: { label: "Proposed role", tone: "warning" },
    device: { label: "Desktop", icon: "Display" },
    lands: "Reconciliation exceptions first: unverified payments, held fiscal receipts, open folios, shift closes.",
    home: "FinanceHome",
    app: { kind: "workspace" },
    avatarTone: "warning",
    tryItems: [
      {
        label: "Shift close",
        board: "ShiftClose",
        note: "Count the till and explain every variance before the shift closes.",
      },
      {
        label: "Fiscal receipts",
        board: "FiscalReceipts",
        note: "EBM / VSDC receipts, including the ones still held.",
      },
      { label: "Reconciliation", board: "Reconciliation", note: "Match bank and mobile-money statements to payments." },
    ],
    workspace: business({
      role: "Finance",
      rolePhrase: "You handle finance here.",
      proposedRole: true,
      branches: [ALL, ISA, ISH],
      currentBranch: "all",
      others: [],
      invite: null,
    }),
  },
  hr: {
    id: "hr",
    name: "Diane Ingabire",
    firstName: "Diane",
    initials: "DI",
    email: "diane@app.demo.injishi.com",
    phone: "+250 788 551 207",
    role: "HR officer",
    tagline: "Diane Ingabire · HR officer",
    headline: "HR officer at Amahoro Hospitality Ltd",
    org: "Amahoro Hospitality Ltd",
    group: "operator",
    status: { label: "Proposed role", tone: "warning" },
    device: { label: "Desktop", icon: "Display" },
    lands: "Who is in, leave to decide, roster gaps and the pay run draft that the owner confirms.",
    home: "PeopleHome",
    app: { kind: "workspace" },
    avatarTone: "warning",
    tryItems: [
      { label: "Pay run", board: "PayRun", note: "Draft the month’s pay run; the owner confirms it." },
      { label: "Roster", board: "Roster", note: "Fill shift gaps across both branches." },
      { label: "Leave", board: "Leave", note: "Decide leave requests with coverage in view." },
    ],
    workspace: business({
      role: "HR officer",
      rolePhrase: "You’re the HR officer here.",
      proposedRole: true,
      branches: [ALL, ISA, ISH],
      currentBranch: "all",
      others: [],
      invite: null,
    }),
  },
  store: {
    id: "store",
    name: "Patrick Nshimiyimana",
    firstName: "Patrick",
    initials: "PN",
    email: "patrick@app.demo.injishi.com",
    phone: "+250 788 662 015",
    role: "Storekeeper",
    tagline: "Patrick Nshimiyimana · stores",
    headline: "Storekeeper at Isangano Lakeside Hotel",
    org: "Amahoro Hospitality Ltd",
    group: "operator",
    status: { label: "Proposed role", tone: "warning" },
    device: { label: "Desktop or tablet", icon: "Boxes3" },
    lands: "Reorder alerts, deliveries to receive, requisitions to fill and stock variances by store.",
    home: "StoreHome",
    app: { kind: "workspace" },
    avatarTone: "warning",
    tryItems: [
      {
        label: "Goods receipt",
        board: "GoodsReceipt",
        note: "Receive a delivery and match it to the order and the invoice.",
      },
      { label: "Recipes", board: "Recipes", note: "Recipe costs and production from stock." },
      { label: "Purchase orders", board: "PurchaseOrders", note: "Requisitions and the orders raised from them." },
    ],
    workspace: business({
      role: "Storekeeper",
      rolePhrase: "You’re the storekeeper here.",
      proposedRole: true,
      branches: [
        { id: "isa", name: "Isangano Lakeside Hotel", meta: "Main store" },
        { id: "ish", name: "Ishyamba Forest Lodge", meta: "Lodge store" },
      ],
      currentBranch: "isa",
      others: [],
      invite: null,
    }),
  },
  // A real landlord: anyone who is an active member of an approved residence business. Not a demo
  // person (no email matches it): the shell takes the account's own name, and the business, its
  // buildings and the navigation come from the API (`/me/context`, `/ops/rentals/summary`).
  landlord: {
    id: "landlord",
    name: "Landlord",
    firstName: "",
    initials: "",
    email: "",
    phone: "",
    role: "Landlord",
    tagline: "Landlord",
    headline: "Landlord",
    org: "",
    group: "operator",
    status: { label: "Landlord", tone: "default" },
    device: { label: "Desktop and phone", icon: "Display" },
    lands: "Units, tenants, rent and what needs you.",
    home: "ResidenceHome",
    app: { kind: "workspace" },
    avatarTone: "accent",
    tryItems: [],
    access: [
      "BusinessSwitcher",
      "Account",
      "TenantHome",
      "TenantLeaseHome",
      "TenantLease",
      "TenantRent",
      "TenantGuests",
      "TenantFaults",
      "TenantMoveOut",
      "TenantMessages",
      "TeamRoles",
    ],
  },
  housekeeper: {
    id: "housekeeper",
    name: "Jeanne Nyiraneza",
    firstName: "Jeanne",
    initials: "JN",
    email: "jeanne@app.demo.injishi.com",
    phone: "+250 788 884 301",
    role: "Housekeeper",
    tagline: "Jeanne Nyiraneza · housekeeper",
    headline: "Housekeeper at Isangano Lakeside Hotel",
    org: "Amahoro Hospitality Ltd",
    group: "devices",
    status: { label: "Exists", tone: "accent" },
    device: { label: "Phone", icon: "Smartphone" },
    lands: "Only her assigned rooms, in order, with one tap to mark clean or report a problem.",
    home: "StaffToday",
    app: { kind: "phone", app: "housekeeper" },
    avatarTone: "accent",
    tryItems: [
      { label: "Room task", board: "StaffTask", note: "Clean a room step by step, then mark it ready for inspection." },
      { label: "Me", board: "StaffMe", note: "Hours, payslips and documents." },
      { label: "Report a problem", board: "StaffReport", note: "Photo, place and urgency in three taps." },
    ],
  },
  supervisor: {
    id: "supervisor",
    name: "Beatrice Mukandori",
    firstName: "Beatrice",
    initials: "BM",
    email: "beatrice@app.demo.injishi.com",
    phone: "+250 788 995 412",
    role: "Housekeeping supervisor",
    tagline: "Inspection on the floor",
    headline: "Housekeeping supervisor at Isangano Lakeside Hotel",
    org: "Amahoro Hospitality Ltd",
    group: "devices",
    status: { label: "Exists", tone: "accent" },
    device: { label: "Phone", icon: "Smartphone" },
    lands: "Inspects cleaned rooms and releases them to the front desk, or sends them back with a reason.",
    home: "InspectRoom",
    app: { kind: "phone", app: "supervisor" },
    avatarTone: "accent",
    tryItems: [
      { label: "Board", board: "HousekeepingBoard", note: "The housekeeping board the front desk also sees." },
    ],
    access: ["HousekeepingBoard"],
  },
  technician: {
    id: "technician",
    name: "Jean-Paul Niyonsaba",
    firstName: "Jean-Paul",
    initials: "JP",
    email: "jeanpaul@app.demo.injishi.com",
    phone: "+250 788 106 523",
    role: "Maintenance technician",
    tagline: "Jean-Paul Niyonsaba · staff",
    headline: "Maintenance technician at Isangano Lakeside Hotel",
    org: "Amahoro Hospitality Ltd",
    group: "devices",
    status: { label: "Exists", tone: "accent" },
    device: { label: "Phone", icon: "Smartphone" },
    lands: "Work orders with photos, parts and the out-of-service block to lift when done.",
    home: "TechWorkOrders",
    app: { kind: "phone", app: "technician" },
    avatarTone: "accent",
    tryItems: [
      { label: "Maintenance", board: "Maintenance", note: "The maintenance board, including predictive checks." },
    ],
    access: ["Maintenance"],
  },
  waiter: {
    id: "waiter",
    name: "Claudine Mukamana",
    firstName: "Claudine",
    initials: "CM",
    email: "claudine@app.demo.injishi.com",
    phone: "+250 788 217 634",
    role: "Waiter and cashier",
    tagline: "Claudine Mukamana · outlet staff",
    headline: "Waiter and cashier at Isangano Terrace",
    org: "Amahoro Hospitality Ltd",
    group: "devices",
    status: { label: "Exists", tone: "accent" },
    device: { label: "POS tablet", icon: "Display" },
    lands: "Tables, tickets, split bills and tenders, charged to the right merchant and TIN.",
    home: "POS",
    app: { kind: "tablet" },
    avatarTone: "accent",
    tryItems: [
      { label: "Split bill", board: "POSPayment", note: "Split a bill and take several tenders." },
      { label: "Kitchen", board: "KitchenDisplay", note: "The kitchen display tickets flow to." },
    ],
  },
  outlet: {
    id: "outlet",
    name: "Joseph Habimana",
    firstName: "Joseph",
    initials: "JH",
    email: "joseph@app.demo.injishi.com",
    phone: "+250 788 328 745",
    role: "Outlet supervisor",
    tagline: "Orders, voids and X/Z",
    headline: "Outlet supervisor at Isangano Lakeside Hotel",
    org: "Amahoro Hospitality Ltd",
    group: "devices",
    status: { label: "Exists", tone: "accent" },
    device: { label: "Desktop", icon: "Display" },
    lands: "The live order board, void approvals and the outlet’s fiscal reports.",
    home: "OutletOrders",
    app: { kind: "workspace" },
    avatarTone: "accent",
    tryItems: [
      { label: "Menus", board: "OutletsMenus", note: "Menus, offers and what is hidden when stock runs out." },
    ],
    workspace: business({
      role: "Outlet supervisor",
      rolePhrase: "You supervise the outlets here.",
      branches: [{ id: "isa", name: "Isangano Lakeside Hotel", meta: "2 outlets" }],
      currentBranch: "isa",
      others: [],
      invite: null,
    }),
    access: ["POS", "KitchenDisplay"],
  },
  guest: {
    id: "guest",
    name: "Sarah Kimani",
    firstName: "Sarah",
    initials: "SK",
    email: "sarah@app.demo.injishi.com",
    phone: "+254 712 345 678",
    role: "Hotel guest",
    tagline: "Sarah Kimani · guest",
    headline: "Guest at Isangano Lakeside Hotel",
    org: "Personal trips",
    group: "guests",
    status: { label: "Guest app", tone: "default" },
    device: { label: "Phone", icon: "Smartphone" },
    lands: "Trip and arrival guide, pre-arrival check-in, digital key, requests, live bill and receipts.",
    home: "GuestTrip",
    app: { kind: "phone", app: "guest" },
    avatarTone: "success",
    tryItems: [
      { label: "Digital key", board: "GuestKey", note: "Unlock room 204 from your phone." },
      { label: "Bill", board: "GuestFolio", note: "The live bill and receipts for your stay." },
      { label: "In-room ordering", board: "QROrder", note: "Order from the room QR menu and charge it to the room." },
      { label: "Trips and account", board: "GuestAccount", note: "Your trips, saved stays and reviews on the web." },
    ],
    access: ["GuestAccount", "MarketCheckout"],
  },
  // A real tenant: someone a landlord's lease names (through the tenant record their account is linked
  // to) once it is out of draft. Not a demo person; the homes come from `/me/context`.
  tenant: {
    id: "tenant",
    name: "Tenant",
    firstName: "",
    initials: "",
    email: "",
    phone: "",
    role: "Tenant",
    tagline: "Tenant",
    headline: "Tenant",
    org: "",
    group: "guests",
    status: { label: "My home", tone: "default" },
    device: { label: "Phone and desktop", icon: "Smartphone" },
    lands: "The homes you rent.",
    home: "TenantHome",
    app: { kind: "workspace" },
    avatarTone: "success",
    tryItems: [],
    access: ["Account"],
  },
  // A real broker: someone with an active `brokers` row (registered with their ID, the fee and a home
  // district). Not a demo person; the homes, plan and placements come from the API (`/ops/broker/*`).
  broker: {
    id: "broker",
    name: "Broker",
    firstName: "",
    initials: "",
    email: "",
    phone: "",
    role: "Broker",
    tagline: "Broker",
    headline: "Broker",
    org: "",
    group: "guests",
    status: { label: "Broker", tone: "default" },
    device: { label: "Web and phone", icon: "Briefcase" },
    lands: "Their homes first, then placements, messages, earnings and the plan.",
    home: "BrokerWork",
    app: { kind: "workspace" },
    avatarTone: "default",
    tryItems: [],
    access: ["Account", "MarketExplore"],
  },
  officer: {
    id: "officer",
    name: "Alice Mukeshimana",
    firstName: "Alice",
    initials: "AM",
    email: "alice@app.demo.injishi.com",
    phone: "+250 788 651 078",
    role: "District officer",
    tagline: "Alice Mukeshimana · scoped officer",
    headline: "District officer and administrator, Rubavu District",
    org: "Rubavu District",
    group: "external",
    status: { label: "External · scoped", tone: "info" },
    device: { label: "Desktop", icon: "Display" },
    lands:
      "Verification and approval queues inside one assigned mandate, with two-person review. Also registers government bodies and assigns officers to a jurisdiction.",
    home: "OfficerHome",
    app: { kind: "workspace" },
    avatarTone: "default",
    tryItems: [
      { label: "Case", board: "OfficerCase", note: "A verification case with its evidence and second reviewer." },
      {
        label: "Delegated data",
        board: "DelegatedReports",
        note: "Only the data the businesses delegated to the district.",
      },
      {
        label: "Bodies & officers",
        board: "DistrictAdmin",
        note: "District administration: bodies and officer scopes.",
      },
    ],
    workspace: {
      kind: "institution",
      ini: "RD",
      name: "Rubavu District",
      meta: "Local government",
      sub: "Business verification mandate",
      role: "District officer",
      branches: [],
      currentBranch: "",
      others: [],
      invite: null,
      tone: "accent",
    },
  },
  psf: {
    id: "psf",
    name: "Josiane Mukamurenzi",
    firstName: "Josiane",
    initials: "JM",
    email: "josiane@app.demo.injishi.com",
    phone: "+250 788 762 189",
    role: "PSF and Chamber staff",
    tagline: "Membership and register",
    headline: "Membership officer, PSF · Chamber of Tourism",
    org: "PSF · Chamber of Tourism",
    group: "external",
    status: { label: "External · scoped", tone: "info" },
    device: { label: "Desktop", icon: "Display" },
    lands: "Membership applications, Injishi business registrations, the member register and reports for the officer's region. District managers decide membership; they also run field verification for registrations in the same district.",
    home: "PsfConsole",
    app: { kind: "workspace" },
    access: [
      "PsfConsole",
      "PsfApplication",
      "PsfRegister",
      "PsfReport",
      "PsfBusiness",
      "PsfClaims",
      "PsfDecisions",
      "PsfSubtypes",
      "PsfFees",
      "OfficerHome",
      "OfficerCase",
      "DelegatedReports",
    ],
    avatarTone: "default",
    tryItems: [
      {
        label: "Overview",
        board: "PsfReport",
        note: "Activity and fees for your region.",
      },
      {
        label: "Applications",
        board: "PsfConsole",
        note: "Decide membership applications with the documents attached.",
      },
      {
        label: "Business registrations",
        board: "OfficerHome",
        note: "Verify businesses registering on Injishi in your district.",
      },
      {
        label: "Register",
        board: "PsfRegister",
        note: "Businesses in your region and their membership standing.",
      },
    ],
    workspace: {
      kind: "institution",
      ini: "CT",
      name: "PSF · Chamber of Tourism",
      meta: "Partner institution",
      sub: "Partner workspace",
      role: "PSF and Chamber staff",
      branches: [],
      currentBranch: "",
      others: [],
      invite: null,
      tone: "accent",
    },
  },
  ops: {
    id: "ops",
    name: "Kevin Mugisha",
    firstName: "Kevin",
    initials: "KM",
    email: "kevin@app.demo.injishi.com",
    phone: "+250 788 873 290",
    role: "Injishi operations",
    tagline: "Kevin Mugisha · platform staff",
    headline: "Support lead, Injishi operations",
    org: "Injishi",
    group: "external",
    status: { label: "Platform staff", tone: "default" },
    device: { label: "Desktop", icon: "Display" },
    lands: "Control tower for tenants, KYB, money ledger, integration health, support and audit.",
    home: "AdminHome",
    app: { kind: "workspace" },
    avatarTone: "accent",
    tryItems: [
      { label: "Money", board: "AdminMoney", note: "The platform money ledger." },
      { label: "Health", board: "AdminHealth", note: "Integration and system health." },
      {
        label: "Assistant usage",
        board: "AssistantUsage",
        note: "How the support assistant is used, with retention rules.",
      },
    ],
    workspace: {
      kind: "institution",
      ini: "IA",
      name: "Injishi admin console",
      meta: "Platform",
      sub: "Support lead · Injishi staff",
      role: "Injishi operations",
      branches: [],
      currentBranch: "",
      others: [],
      invite: null,
      tone: "danger",
    },
  },
};

export const PERSONA_IDS = Object.keys(personas) as PersonaId[];

export const PERSONA_GROUPS: { id: PersonaGroup; title: string; desc: string }[] = [
  {
    id: "operator",
    title: "Operator Workspaces",
    desc: "Desktop-first. Navigation and data follow each role’s permissions.",
  },
  { id: "devices", title: "Staff Devices", desc: "Task-first, touch-sized and tolerant of weak connections." },
  {
    id: "guests",
    title: "Guests, Residents and the Public",
    desc: "Mobile web first. Clear states for every payment, key and document.",
  },
  {
    id: "external",
    title: "Institutions and Injishi Staff",
    desc: "Separate permission universes. Nobody here belongs to a business’s team.",
  },
];

/** Entry points on the sign-in page that need no account. */
export const OPEN_ENTRIES: {
  id: string;
  group: PersonaGroup;
  title: string;
  tagline: string;
  lands: string;
  board: BoardId;
  action: string;
  icon: IconName;
}[] = [
  {
    id: "kiosk",
    group: "devices",
    title: "Clock-in kiosk",
    tagline: "Shared device at staff entrance",
    lands: "Clock in or out with a PIN or staff QR. No other data on screen.",
    board: "AttendanceKiosk",
    action: "Open the kiosk",
    icon: "Display",
  },
  {
    id: "visitor",
    group: "guests",
    title: "Marketplace visitor",
    tagline: "Anyone searching stays or homes",
    lands: "Search, property pages with verified business details, and checkout with honest payment states.",
    board: "MarketExplore",
    action: "Browse without signing in",
    icon: "Globe",
  },
];

export function personaByEmail(email: string): Persona | undefined {
  const e = email.trim().toLowerCase();
  // The landlord and tenant shells have no demo person (no email): nothing matches them.
  if (!e) return undefined;
  return Object.values(personas).find((p) => p.email === e);
}
