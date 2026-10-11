/**
 * The PMS information architecture — grouped by how a property is run, not by
 * how the platform is built (blueprint §3.2), in the vocabulary a hotel already
 * uses (the Navigation board, 2026-10-07: three groups, sixteen destinations,
 * Settings in the footer, the OPERA renames).
 *
 * Two things shape what renders:
 *  - the permissions the grant carries (a receptionist holds no `money.view`, so
 *    never sees Finance), each entry declaring the permission it needs
 *    (ADR-053), which is the read its screen makes wherever a screen exists,
 *  - the property's departments, which are config (F-P01) — so a 2-department
 *    guesthouse gets a shorter nav than a 5-department hotel with no code change.
 *
 * **Both come from the SERVER** (ADR-035, D-a; ADR-053). The departments used to
 * be read out of `data/demo.ts`, which meant a 622 line fixture decided which
 * sections a real hotel had, and the sections used to branch on the ROLE, a
 * hand copy of the permission table. Both now arrive on the one grant row, so
 * they can never be resolved from different reads and a permission change
 * reaches the nav with no second file edited.
 *
 * **No entry here reads a role name.** The role decides only which door is
 * shown FIRST (`home.ts`, ADR-069 D-f), never which doors exist.
 *
 * COUNT PILLS ARE DIFFERENT, and the difference is the point. A count is an
 * affordance and may be stale or absent; a DESTINATION is a door, and
 * `allowedSegments` below turns the doors into the route guard's whole input.
 * So a destination is decided by the grant, and a count is `null` until a live
 * query has answered. A count that has not loaded shows nothing, which is what
 * it means.
 *
 * Nav hiding is still an affordance and never the control. `WorkspaceGuard`
 * on the API refuses the request.
 */

import { HR_PERMISSIONS, type DepartmentCategory, type Permission } from "@injishi/contracts";

// No property, lease or thread type is imported any more, and that absence is
// the change (ADR-035, D-a). This module used to take a `HospitalityProperty`,
// a `ResidenceProperty` and a `BrokerData` — all of them demo fixtures — and
// read the doors out of them. It takes the grant's permission array, a
// department list and some optional counts now, none of which it can invent.
import type { WorkspaceKey } from "../data/types";

/**
 * Who may open an entry (ADR-053, ADR-055).
 *
 * At most ONE of the three is declared. None declared is a decision, not a gap:
 * such an entry is offered to every member of the workspace, and the outer gate
 * still holds, because a business that is not `active` holds no permissions.
 */
interface NavGate {
  /** The one permission this entry needs. */
  permission?: Permission;
  /**
   * Any ONE of these opens it (ADR-055), for a screen that several
   * capabilities legitimately reach. It is the API's `@RequireAnyPermission`,
   * and an entry declares exactly the set its screen's read declares, so an
   * offered door never meets a refusal. The screen behind such an entry must
   * refuse per action, because reaching it no longer implies holding every
   * power it offers.
   */
  anyPermission?: readonly Permission[];
  /**
   * EVERY one of these is needed. For a destination that is the meeting point
   * of two powers (Revenue: reading the money AND setting the price), where
   * either alone would offer the door to somebody whose job it is not.
   */
  allPermissions?: readonly Permission[];
}

/**
 * One way to look at a destination, with an address of its own (ADR-018, D-c).
 *
 * A destination that merges several existing screens (Housekeeping: Room
 * status, Tasks, Maintenance) has no lens rail of its own to move between them,
 * so the sidebar shows its lenses under it while it is open, as the Sidebar
 * board does for Finance and Reservations. Each lens carries its own gate,
 * because the screens it merges were gated differently.
 */
export interface NavLens extends NavGate {
  key: string;
  label: string;
  href: string;
  /**
   * Other addresses this lens is the place for. Team & roles is reached at
   * Roles, and Invites sits beside it on that screen's rail; both are the one
   * lens in the sidebar.
   */
  activeOn?: readonly string[];
}

export interface NavItem extends NavGate {
  key: string;
  label: string;
  icon: string;
  href: string;
  /** Count pill — omitted when zero so a quiet nav stays quiet. */
  count?: number | null;
  /** False while the screen is still a placeholder. */
  built?: boolean;
  /**
   * Designed for later, not in v1 (the Sidebar board's Horizon chip). The door
   * exists so the shape of the product is visible; what it opens says what is
   * there today.
   */
  horizon?: boolean;
  /**
   * The lenses this grant reaches, in the order the sidebar shows them. An
   * entry that declares NO gate of its own and carries lenses is opened by any
   * of them, and opens on the first one the grant reaches.
   */
  lenses?: NavLens[];
  /**
   * Screen segments this entry opens without a link of their own (ADR-018,
   * move 3).
   *
   * A record page is not a nav leaf: nobody navigates to "stays", they open one
   * stay from the reservation it came from. But screen access in this app has
   * exactly ONE mechanism, the allowed set built from `navFor` (invariant 6), so
   * a record route has to be granted by the entry a person reaches it through
   * rather than by a second check somewhere else. The same holds for an old
   * address that a destination absorbed (`today` under Dashboard, `setup`
   * under Rates & Inventory).
   */
  grants?: readonly string[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
  /**
   * `footer` sits below the scrolling list (Settings, per the Sidebar board).
   * Absent is the body.
   */
  placement?: "footer";
}

/** Screens still awaiting their build, keyed for the placeholder copy. */
export const PLACEHOLDER_COPY: Record<
  string,
  {
    icon: string;
    title: string;
    line: string;
    hint?: string;
    /** The ways to look at it the design gives it, named so the shape is visible. */
    lenses?: readonly string[];
    /** The chip under it. Absent is "Next design pass". */
    status?: string;
  }
> = {
  // The five destinations of the Navigation board with no screen yet. The
  // line is the board's own description of each.
  "front-desk": {
    icon: "concierge-bell",
    title: "Front desk",
    line: "Check-in on one page, the queue for rooms not ready, room moves, and check-out by bill window.",
    hint: "Until it is built, arrivals, departures and requests are on the Dashboard.",
    lenses: ["Arrivals", "In-house", "Departures", "Queue"],
    status: "Not built yet",
  },
  guests: {
    icon: "contact-round",
    title: "Guests",
    line: "A guest profile across stays, with preferences the desk, housekeeping and the restaurant act on, and the property’s own loyalty programme.",
    hint: "It needs a guest read the API does not have yet. Each booking’s guest is on Reservations.",
    lenses: ["Directory", "Stay history", "Loyalty"],
    status: "Horizon",
  },
  "night-audit": {
    icon: "moon-star",
    title: "Night audit",
    line: "End of day. The business date rolls only once the checks are clear.",
    hint: "Today it runs as a server job with no screen: each night it posts every in-house stay’s room charge to its folio.",
    lenses: ["Checks", "No-shows", "Post room and tax", "Cashier", "Roll the date", "Reports"],
    status: "Not built yet",
  },
  sales: {
    icon: "handshake",
    title: "Sales & events",
    line: "The sales pipeline, the function diary and banquet event orders.",
    hint: "Billing for accounts and events will stay on Finance.",
    lenses: ["Accounts", "Leads", "Activities", "Events", "Catering"],
    status: "Horizon",
  },
  reports: {
    icon: "chart-column",
    title: "Reports",
    line: "Occupancy, ADR and RevPAR over time, the trial balance, and the 14-day house forecast.",
    hint: "This month’s takings per department are on Finance, under Revenue.",
    lenses: ["Performance", "Revenue", "Financial", "Forecast", "Housekeeping"],
    status: "Not built yet",
  },
  payouts: {
    icon: "wallet",
    title: "Earnings & payouts",
    line: "What you have earned and when it pays out.",
  },
  invoices: {
    icon: "file-text",
    title: "Tax invoices",
    line: "Every tax invoice, issued automatically at checkout. Nothing to file by hand.",
  },
  "rent-ledger": {
    icon: "wallet",
    title: "Rent ledger",
    line: "Every rent movement across the portfolio, in one running list.",
  },
  filings: {
    icon: "shield-check",
    title: "Filings",
    line: "Rental income declarations and the 15 day clock, across every lease.",
  },
  "rate-plans": {
    icon: "tags",
    title: "Rate plans",
    line: "How a rate follows its parent, and what each one cancels like.",
  },
  amenities: {
    icon: "gift",
    title: "Amenities",
    line: "What a stay here includes, and what costs extra.",
  },
  departments: {
    icon: "building-2",
    title: "Departments",
    line: "Which departments this property runs, and who works in each.",
  },
  invites: {
    icon: "user-plus",
    title: "Invites",
    line: "People asked to join, and who is still to accept.",
  },
  policies: {
    icon: "scroll-text",
    title: "Policies",
    line: "Cancellation, check in times, house rules.",
  },
  plan: {
    icon: "credit-card",
    title: "Plan & billing",
    line: "Your subscription, invoices and payment method.",
  },
  integrations: {
    icon: "plug",
    title: "Integrations",
    line: "The channels, the tax connection and the payment gateway.",
  },
  settings: {
    icon: "settings",
    title: "Property settings",
    line: "Name, address, contact and the details guests see.",
  },
  account: {
    icon: "user-round",
    title: "Account",
    line: "Your profile, ID verification, language, and sign-in.",
  },
};

/**
 * Counts for the pills, when a live source has answered.
 *
 * Every field is optional and every absent field renders no pill. This is what
 * lets a destination exist on the server's say-so while its badge waits for a
 * real query, instead of a fixture supplying a number nobody counted.
 */
export interface NavCounts {
  pendingReservations?: number | null;
  /** Confirmed bookings arriving today that nobody has checked in yet. */
  arrivalsToCheckIn?: number | null;
  housekeepingOpen?: number | null;
  ticketsOpen?: number | null;
  ordersLive?: number | null;
  unreadThreads?: number | null;
}

/**
 * The Staff screen's lenses and the permissions that open each (ADR-058,
 * contract 10), in the order the rail shows them.
 *
 * In this file rather than in the screen because it is the same class of fact
 * as a nav entry's gate: which doors a grant reaches. The People destination is
 * opened by the HR permissions, and the screen offers only the lenses this table
 * lets through, so a grant reaches exactly the lenses whose reads it may make.
 * Each gate is exactly the read its lens makes, so an offered lens never meets a
 * refusal.
 *
 * The people file (058-people-file) adds six. Documents, Discipline and
 * Configuration are `people.manage`'s; the org chart reads like the file list;
 * Policies and Announcements are the whole business's, so any HR permission
 * reads them, the desk included.
 */
export const STAFF_LENSES: readonly {
  key:
    | "overview"
    | "employees"
    | "org-chart"
    | "documents"
    | "discipline"
    | "checklists"
    | "roster"
    | "rotations"
    | "shift-requests"
    | "attendance"
    | "attendance-requests"
    | "kiosks"
    | "leave"
    | "payroll"
    | "time-insights"
    | "policies"
    | "announcements"
    | "time-settings"
    | "configuration";
  label: string;
  /** The route segment under `/staff`; empty for the default lens. */
  segment: string;
  anyPermission: readonly Permission[];
}[] = [
  // What needs somebody today, drawn from the other lenses' own reads: each
  // part of it asks the permission its read needs, so the lens itself opens to
  // every HR permission but the desk's `attendance.record` (see `PEOPLE_DOOR`).
  // First on the rail, and on an address of its own: `/staff` stays Employees.
  {
    key: "overview",
    label: "Overview",
    segment: "overview",
    anyPermission: ["people.view", "people.manage", "roster.manage", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"],
  },
  { key: "employees", label: "Employees", segment: "", anyPermission: ["people.view", "people.manage", "payroll.run"] },
  { key: "org-chart", label: "Org chart", segment: "org-chart", anyPermission: ["people.view", "people.manage", "payroll.run"] },
  { key: "documents", label: "Documents", segment: "documents", anyPermission: ["people.manage"] },
  { key: "discipline", label: "Discipline", segment: "discipline", anyPermission: ["people.manage"] },
  // Joining and leaving: read by whoever reads files, written by `people.manage` inside it.
  { key: "checklists", label: "Checklists", segment: "checklists", anyPermission: ["people.view", "people.manage"] },
  { key: "roster", label: "Roster", segment: "roster", anyPermission: ["roster.manage", "attendance.record", "people.view"] },
  // Time (058-time AC-TM14). Each lens opens on the reads it makes.
  { key: "rotations", label: "Rotations", segment: "rotations", anyPermission: ["roster.manage", "attendance.record"] },
  { key: "shift-requests", label: "Shift requests", segment: "shift-requests", anyPermission: ["roster.manage"] },
  { key: "attendance", label: "Attendance", segment: "attendance", anyPermission: ["attendance.record", "attendance.approve"] },
  { key: "attendance-requests", label: "Attendance requests", segment: "attendance-requests", anyPermission: ["attendance.approve"] },
  { key: "kiosks", label: "Kiosks", segment: "kiosks", anyPermission: ["attendance.record"] },
  // 058-leave: five sections below it; whoever keeps the files reaches balances, periods and types.
  { key: "leave", label: "Leave", segment: "leave", anyPermission: ["leave.approve", "people.manage"] },
  // 058-payroll: nine sections below it; whoever writes contracts reaches the
  // Contracts list. ADR-069 D-e: whoever drafts the pay run (`payroll.draft`,
  // the HR officer) opens it too, on the Overview the draft is built from; the
  // confirm stays `payroll.run`'s inside the screen.
  { key: "payroll", label: "Payroll", segment: "payroll", anyPermission: ["payroll.draft", "payroll.run", "people.manage"] },
  { key: "time-insights", label: "Late and monthly", segment: "time-insights", anyPermission: ["people.manage"] },
  { key: "policies", label: "Policies", segment: "policies", anyPermission: HR_PERMISSIONS },
  { key: "announcements", label: "Announcements", segment: "announcements", anyPermission: HR_PERMISSIONS },
  {
    key: "time-settings",
    label: "Time settings",
    segment: "time-settings",
    anyPermission: ["roster.manage", "attendance.record", "attendance.approve", "people.manage"],
  },
  { key: "configuration", label: "Configuration", segment: "configuration", anyPermission: ["people.manage"] },
];

/** The Staff lenses a grant reaches. */
export function staffLenses(permissions: readonly Permission[]): typeof STAFF_LENSES[number][] {
  return STAFF_LENSES.filter((lens) => lens.anyPermission.some((p) => permissions.includes(p)));
}

/* ── The reads each door declares ───────────────────────────────────────── */

/*
 * Each set below is the declaration of the API read behind a door, the same
 * set `OPS_READ` in `data/ops.ts` mirrors for the client's own requests. They
 * are spelled here rather than imported because that module is a client
 * module and this one is also read on the server (`legacy-redirect.ts`).
 * `home.test.mjs` holds each door against the six default roles, so a drift
 * shows up as a role gaining or losing a door.
 */

/** `GET /ops/reservations` and `/:id` (`OPS_READ.reservations`; ADR-069 D-d). */
const RESERVATIONS_READ: readonly Permission[] = ["reservation.approve", "reservation.assign", "stay.checkin", "money.view"];

/** `GET /ops/room-assignments` (`OPS_READ.roomAssignments`): the room rack's holds. */
const ROOM_PLAN_READ: readonly Permission[] = ["reservation.assign", "reservation.approve", "stay.checkin"];

/** `GET /ops/rooms` (`OPS_READ.rooms`): the state of every room. */
const ROOMS_READ: readonly Permission[] = ["stay.checkin", "housekeeping.set", "reservation.assign", "listing.manage"];

/** `GET /ops/housekeeping-tasks` (`OPS_READ.housekeepingTasks`). */
const TASKS_READ: readonly Permission[] = ["housekeeping.set", "task.assign"];

/**
 * The day's movements: who decides a request, gives a guest a room or checks
 * them in. The operations dashboard is today's arrivals, departures and
 * requests (ADR-069 D-f), and these are the powers that act on them. Not
 * `money.view`: the accountant's first screen is Finance, and an operations
 * board of guests to check in is a door that leads nowhere for them (ADR-069,
 * Consequences: "the role-aware nav must not offer it").
 */
const DAY_MOVEMENTS: readonly Permission[] = ["reservation.approve", "reservation.assign", "stay.checkin"];

/** Who checks a guest in or out: the front office (Front desk, Night audit). */
const FRONT_OFFICE: readonly Permission[] = ["stay.checkin", "stay.checkout"];

/**
 * The People destination: whoever keeps the files, the roster, leave or pay.
 *
 * Every HR permission but `attendance.record`. The desk holds that one alone,
 * because it is at the door when the night shift arrives (ADR-058 contract 4),
 * and the Sidebar board gives the desk no People destination: clocking a shift
 * in is not running HR. The desk keeps the one lens it uses, as a lens of Front
 * desk (`hostNav`).
 */
const PEOPLE_DOOR: readonly Permission[] = HR_PERMISSIONS.filter((p) => p !== "attendance.record");

/** A pill shows a positive number or nothing. Zero is quiet, absent is quiet. */
function pill(n: number | null | undefined): number | null {
  return typeof n === "number" && n > 0 ? n : null;
}

function declaresGate(gate: NavGate): boolean {
  return gate.permission !== undefined || gate.anyPermission !== undefined || gate.allPermissions !== undefined;
}

/** Whether a grant holding `permissions` opens a door with this gate. */
function opens(gate: NavGate, permissions: readonly Permission[]): boolean {
  if (gate.anyPermission !== undefined) return gate.anyPermission.some((p) => permissions.includes(p));
  if (gate.allPermissions !== undefined) return gate.allPermissions.every((p) => permissions.includes(p));
  return gate.permission === undefined || permissions.includes(gate.permission);
}

/**
 * Keep the entries this grant reaches (ADR-053, AC-A1), each with the lenses it
 * reaches.
 *
 * An entry that declares a gate is kept when the grant opens it. One that
 * declares none and carries lenses is kept when any lens is, and opens on the
 * first. One that declares nothing at all is kept for every member of the
 * workspace, and that is the rule rather than an omission.
 */
function reachable(items: readonly NavItem[], permissions: readonly Permission[]): NavItem[] {
  return items.flatMap((item) => {
    const lenses = item.lenses?.filter((lens) => opens(lens, permissions));
    if (declaresGate(item)) {
      return opens(item, permissions) ? [{ ...item, lenses }] : [];
    }
    if (lenses === undefined) return [item];
    if (lenses.length === 0) return [];
    return [{ ...item, href: lenses[0].href, lenses }];
  });
}

/** A section with the entries this grant reaches, or nothing when it reaches none. */
function sectionOf(
  label: string,
  items: readonly NavItem[],
  permissions: readonly Permission[],
  placement?: NavSection["placement"],
): NavSection[] {
  const kept = reachable(items, permissions);
  // A header with nothing under it reads as a broken screen, not as an absent power.
  if (kept.length === 0) return [];
  return [placement ? { label, items: kept, placement } : { label, items: kept }];
}

/**
 * Settings, in the footer (the Navigation board: it "absorbs Team &
 * Departments and PSF membership: administration in one place").
 *
 * The Settings screen keeps its own rail (Property, Branches, Policies, Plan and
 * billing, Integrations). The lenses here are the places that rail does not
 * reach, plus the two ways in, so administration is one door:
 *
 *  - **Property** needs `ebm.manage` as well as `listing.manage`: the Settings
 *    screen offers Integrations on every lens, and Integrations reads the EBM
 *    account (ADR-041, D-o).
 *  - **Integrations** alone is the accountant's way in (ADR-069 D-c: "the nav
 *    should open Settings on Integrations for a grant without
 *    `listing.manage`").
 *  - **Team & roles** is the owner's (`team.manage`, ADR-055). It opens on
 *    Roles; the team and its invitations are lenses beside it on that screen.
 *  - **Departments** is read by `people.view` too (ADR-069 D-d), so the HR
 *    officer opens it read only. A residence portfolio runs none.
 *  - **Memberships** is PSF (ADR-056), gated on the server's `canManage`, never
 *    on a permission: the owner applies at every registration stage.
 */
function settingsItem(base: string, opts: { departments: boolean; psfManage: boolean }): NavItem {
  const lenses: NavLens[] = [
    { key: "property", label: "Property", href: `${base}/settings`, allPermissions: ["ebm.manage", "listing.manage"] },
    { key: "integrations", label: "Integrations", href: `${base}/settings/integrations`, permission: "ebm.manage" },
    {
      key: "team",
      label: "Team & roles",
      href: `${base}/people/roles`,
      permission: "team.manage",
      activeOn: [`${base}/people/invites`],
    },
    ...(opts.departments
      ? [
          {
            key: "departments",
            label: "Departments",
            href: `${base}/people/departments`,
            anyPermission: ["team.manage", "department.manage", "people.view"],
          } satisfies NavLens,
        ]
      : []),
    ...(opts.psfManage
      ? [{ key: "psf-membership", label: "Memberships", href: `${base}/psf-membership` } satisfies NavLens]
      : []),
  ];
  return { key: "settings", label: "Settings", icon: "settings", href: `${base}/settings`, built: true, lenses };
}

/**
 * People (was Staff, ADR-058): everyone who works here, with or without an
 * account. The same in a hotel and a residence business.
 *
 * It opens at `/people`, the HR officer's home (ADR-069 D-f), and grants the
 * HR module's own screens under `/staff`. The four lenses are the Navigation
 * board's, each gated exactly as the Staff rail gates it.
 */
function peopleItem(base: string): NavItem {
  const staffLens = (key: (typeof STAFF_LENSES)[number]["key"], label: string): NavLens => {
    const lens = STAFF_LENSES.find((l) => l.key === key)!;
    return {
      key: `staff-${key}`,
      label,
      href: lens.segment ? `${base}/staff/${lens.segment}` : `${base}/staff`,
      anyPermission: lens.anyPermission,
    };
  };
  return {
    key: "staff",
    label: "People",
    icon: "users",
    href: `${base}/people`,
    built: true,
    anyPermission: PEOPLE_DOOR,
    grants: ["staff"],
    lenses: [
      staffLens("overview", "Overview"),
      staffLens("employees", "Employees"),
      staffLens("roster", "Roster"),
      staffLens("leave", "Leave"),
      staffLens("payroll", "Payroll"),
    ],
  };
}

export function hostNav(
  departments: readonly DepartmentCategory[],
  permissions: readonly Permission[],
  base: string,
  counts: NavCounts = {},
  psfManage = false,
): NavSection[] {
  // The USALI category, not the display name. Two hotels spell "Restaurant"
  // and "Dining" for the same thing; `fnb` is what both of them are.
  const has = (d: DepartmentCategory) => departments.includes(d);
  const holds = (p: Permission) => permissions.includes(p);

  /*
   * A pill names work for whoever does it. The Sidebar board keeps the
   * accountant's Reservations QUIET: they read bookings and decide none, so
   * "requests to decide" is not theirs. Said as the power that answers the
   * request, never as a role.
   */
  const pending = holds("reservation.approve") ? pill(counts.pendingReservations) : null;
  const arrivals = holds("stay.checkin") ? pill(counts.arrivalsToCheckIn) : null;
  const hkOpen = pill(counts.housekeepingOpen);
  const ordersLive = pill(counts.ordersLive);
  const unread = pill(counts.unreadThreads);

  /*
   * A business still in the registration pipeline holds no permission at all,
   * and lands where it always has: the Dashboard, which is the one screen that
   * opens without a power and the one its owner watches the stage from
   * (ADR-069 D-f rule 6). Once the business is active, the Dashboard is the
   * day's movements and asks for a power that acts on them.
   */
  const inPipeline = permissions.length === 0;

  /*
   * The one HR task the desk holds, kept for a grant that has no People door
   * (see `PEOPLE_DOOR`). Whoever reaches People reaches it there.
   */
  const deskAttendance: NavLens[] =
    !opens({ anyPermission: PEOPLE_DOOR }, permissions)
      ? [{ key: "staff-attendance", label: "Staff attendance", href: `${base}/staff/attendance`, permission: "attendance.record" }]
      : [];

  return [
    ...sectionOf(
      "Front desk",
      [
        // Was Today. "Today" stays as its default period; the old address
        // still opens, under this door.
        {
          key: "today",
          label: "Dashboard",
          icon: "layout-dashboard",
          href: `${base}/dashboard`,
          built: true,
          grants: ["today"],
          ...(inPipeline ? {} : { anyPermission: DAY_MOVEMENTS }),
        },
        {
          key: "front-desk",
          label: "Front desk",
          icon: "concierge-bell",
          href: `${base}/front-desk`,
          count: arrivals,
          built: false,
          anyPermission: FRONT_OFFICE,
          lenses: deskAttendance,
        },
        // The list's own read, widened for the accountant (ADR-069 D-d). The
        // screen asks per action, so approve, decline and assign stay the desk's.
        { key: "reservations", label: "Reservations", icon: "book-marked", href: `${base}/reservations`, count: pending, built: true, grants: ["stays"], anyPermission: RESERVATIONS_READ },
        // Was `grid`, `availability` and the rate calendar inside `rooms-rates`:
        // three entries over one question, which is what is sellable, when, at
        // what price. One route, three views (ADR-018, move 5). Gated on the
        // room plan it is drawn from, so the accountant, who reads bookings and
        // not the room plan, is not offered an empty rack.
        { key: "calendar", label: "Calendar", icon: "calendar-days", href: `${base}/calendar`, built: true, anyPermission: ROOM_PLAN_READ },
        // No guest read exists yet (the board marks it Horizon). The profile is
        // built from the bookings and stays the reservations read returns, so
        // the door declares that read: the accountant and the desk reach it,
        // and neither HR nor the housekeeper does (ADR-069 D-c).
        { key: "guests", label: "Guests", icon: "contact-round", href: `${base}/guests`, built: false, horizon: true, anyPermission: RESERVATIONS_READ },
        // Was Inbox: the word guests see on Airbnb and Booking.com. HR is not
        // offered it: the only messaging built is the guest inbox (ADR-069 D-d).
        { key: "inbox", label: "Messages", icon: "message-square", href: `${base}/inbox`, count: unread, built: true, permission: "message.send" },
      ],
      permissions,
    ),
    ...sectionOf(
      "Operations",
      [
        /*
         * Room status, Housekeeping and Maintenance were three leaves under
         * "Rooms". One destination now, opening on the first lens the grant
         * reads, each lens gated on its own screen's read. Room status reads
         * `GET /ops/rooms`, which the desk holds, so the desk sees the rooms it
         * gives out; marking one clean stays `housekeeping.set` inside it.
         * Maintenance only where an engineering department exists.
         */
        {
          key: "housekeeping",
          label: "Housekeeping",
          icon: "sparkles",
          href: `${base}/rooms`,
          count: hkOpen,
          built: true,
          lenses: [
            { key: "rooms", label: "Room status", href: `${base}/rooms`, anyPermission: ROOMS_READ },
            { key: "tasks", label: "Tasks", href: `${base}/housekeeping`, anyPermission: TASKS_READ },
            ...(has("engineering")
              ? [{ key: "maintenance", label: "Maintenance", href: `${base}/maintenance`, permission: "ticket.advance" } satisfies NavLens]
              : []),
          ],
        },
        // Only where a service department exists: a two department guesthouse
        // gets no Services. `order.advance` rather than `menu.manage`, because
        // the destination opens on Orders, which a receptionist works; the Menus
        // lens refuses editing inside the screen (ADR-053, ruled 2026-09-13).
        ...(has("fnb") || has("spa_recreation")
          ? [{ key: "services", label: "Services", icon: "bell-ring", href: `${base}/services`, count: ordersLive, built: true, permission: "order.advance" } satisfies NavItem]
          : []),
        { key: "night-audit", label: "Night audit", icon: "moon-star", href: `${base}/night-audit`, built: false, anyPermission: FRONT_OFFICE },
      ],
      permissions,
    ),
    ...sectionOf(
      "Business",
      [
        // Setup and Inventory merged. The setup checklist moves to the
        // Dashboard until it is done, and its address still opens under here.
        { key: "inventory", label: "Rates & Inventory", icon: "building-2", href: `${base}/inventory`, built: true, permission: "listing.manage", grants: ["setup"] },
        /*
         * The revenue manager's screen (Horizon): forecast, pickup and pricing.
         * What exists today is the takings per department, Finance's Revenue
         * lens, so the door opens there. It needs the money AND the price:
         * revenue management is acting on rates (`listing.manage`) from the
         * figures (`money.view`). Either alone is somebody else's job.
         */
        {
          key: "revenue",
          label: "Revenue",
          icon: "trending-up",
          href: `${base}/finance/revenue`,
          built: false,
          horizon: true,
          allPermissions: ["money.view", "listing.manage"],
        },
        // Selling group and corporate business is pricing packages and
        // negotiated rates, which is the offer power (`offer.manage`).
        { key: "sales", label: "Sales & events", icon: "handshake", href: `${base}/sales`, built: false, horizon: true, permission: "offer.manage" },
        // Bills, payouts, invoices and revenue were four leaves, and "why is
        // this month short" crossed all four and was answered by none. One
        // route, its lenses on the screen.
        { key: "finance", label: "Finance", icon: "receipt", href: `${base}/finance`, built: true, permission: "money.view" },
        // ADR-069 D-c: the money report built today is Finance, Revenue, read
        // on `money.view`; `reports.view` is designed and not in the code, so
        // no permission is invented for it.
        { key: "reports", label: "Reports", icon: "chart-column", href: `${base}/reports`, built: false, permission: "money.view" },
        peopleItem(base),
      ],
      permissions,
    ),
    ...sectionOf("Settings", [settingsItem(base, { departments: true, psfManage })], permissions, "footer"),
  ];
}

/** Counts for the residence pills. Same rule: absent means no pill. */
export interface ResidenceNavCounts {
  rentOverdue?: number | null;
  leasesAwaiting?: number | null;
  ticketsOpen?: number | null;
  tenantUnread?: number | null;
  depositsToReturn?: number | null;
}

export function landlordNav(
  permissions: readonly Permission[],
  base: string,
  counts: ResidenceNavCounts = {},
): NavSection[] {
  const overdue = pill(counts.rentOverdue);
  const awaiting = pill(counts.leasesAwaiting);
  const ticketsOpen = pill(counts.ticketsOpen);
  const tenantUnread = pill(counts.tenantUnread);
  // An ended lease whose deposit has not gone back is still the landlord's job.
  const depositReview = pill(counts.depositsToReturn);

  return [
    ...sectionOf(
      "Tenancies",
      [
        { key: "rent-roll", label: "Rent roll", icon: "wallet", href: `${base}/rent-roll`, count: overdue, built: true },
        { key: "leases", label: "Leases", icon: "file-text", href: `${base}/leases`, count: awaiting, built: true },
        { key: "move-outs", label: "Move-outs & deposits", icon: "log-out", href: `${base}/move-outs`, count: depositReview, built: true },
        { key: "inbox", label: "Messages", icon: "message-square", href: `${base}/inbox`, count: tenantUnread, built: true, permission: "message.send" },
      ],
      permissions,
    ),
    ...sectionOf(
      "Property",
      [
        // `unit.manage` stops being a declared but unenforced permission here:
        // these are exactly the leaves it was written for (ADR-053).
        { key: "setup", label: "Setup", icon: "list-checks", href: `${base}/setup`, built: true, permission: "listing.manage" },
        // Units is the landlord's inventory: the building, unit types, units,
        // photos and publishing. It grants `inventory` so the amenities lens
        // it links to opens under the one screen mechanism (invariant 6).
        { key: "units", label: "Units & rents", icon: "building-2", href: `${base}/units`, built: true, permission: "unit.manage", grants: ["inventory"] },
        { key: "maintenance", label: "Maintenance", icon: "wrench", href: `${base}/maintenance`, count: ticketsOpen, built: true, permission: "ticket.advance" },
        // Was `directory`, the same word the broker uses for the opposite job:
        // this one PUBLISHES your buildings, theirs browses everyone else's.
        // Behind `listing.manage`, not `unit.manage`: it renders the real
        // publish control, and every inventory route it calls declares that
        // permission (2026-09-15). A door the API refuses behind is no door.
        { key: "listing", label: "Listing", icon: "globe", href: `${base}/listing`, built: true, permission: "listing.manage" },
      ],
      permissions,
    ),
    // `compliance` is gone as a leaf. Half of it is the `filing` lens on the
    // lease it describes (move 3); half is the portfolio monitor, which is a
    // Finance lens. It named a regime rather than something you do.
    ...sectionOf(
      "Business",
      [
        { key: "finance", label: "Finance", icon: "receipt", href: `${base}/finance`, built: true, permission: "money.view" },
        // Every business type gets HR (ADR-058): a caretaker or a guard on a
        // residence payroll is on file like a hotel cook.
        peopleItem(base),
      ],
      permissions,
    ),
    // A residence portfolio runs no departments and has no PSF membership.
    ...sectionOf("Settings", [settingsItem(base, { departments: false, psfManage: false })], permissions, "footer"),
  ];
}

/**
 * The broker's surface. A broker has no org and no role picker — the nav is
 * short because the job is: find a unit, reveal the landlord, place a tenant,
 * get paid when the lease activates.
 */
export function brokerNav(base: string, placementsAwaiting?: number | null): NavSection[] {
  const awaiting = pill(placementsAwaiting);
  return [
    {
      label: "Work",
      items: [
        { key: "directory", label: "Directory", icon: "building-2", href: `${base}/directory`, built: true },
        { key: "placements", label: "Placements", icon: "briefcase", href: `${base}/placements`, count: awaiting, built: true },
        { key: "earnings", label: "Earnings", icon: "coins", href: `${base}/earnings`, built: true },
      ],
    },
    {
      label: "Account",
      items: [{ key: "account", label: "Account", icon: "user-round", href: `${base}/account` }],
    },
  ];
}

/* ── Workspace routing ──────────────────────────────────────────────────── */

/**
 * Every operator route lives inside the workspace it acts on (ADR-018, AC-1).
 *
 * The URL used to name a KIND — `/host/today` — so an owner running three
 * hotels had one address for all three and could not keep two open at once.
 * The id is the subject now, and this is the one place the prefix is spelled.
 */
export const WORKSPACE_PREFIX = "/w";

export function workspaceBase(workspaceId: string | null): string {
  return workspaceId ? `${WORKSPACE_PREFIX}/${workspaceId}` : "";
}

/**
 * Where a workspace lands when you switch into it: its own bare address.
 *
 * Which SCREEN that is depends on the person, not the kind (ADR-069 D-f: an
 * accountant opens on Finance, an HR officer on People), and the kind is all a
 * caller of this function has. So it names the workspace and lets
 * `/w/<id>`'s resolver choose the screen through `homeFor`, which reads the
 * grant. One answer, in one place, for every way in: the root, the switcher,
 * the old-address shim and "Back to your workspace".
 *
 * `ws` is kept in the signature because every caller has it and the rule
 * "a workspace with no id is not an address" is stated once here.
 */
export function workspaceHome(
  _ws: WorkspaceKey,
  workspaceId: string | null,
): string {
  const base = workspaceBase(workspaceId);
  // No id is not a screen we can name. Send them to the resolver at the root,
  // which asks the API again rather than guessing.
  return base || "/";
}

/**
 * Which workspace to OPEN when someone holds several.
 *
 * Not the same list as the switcher's display order, and deliberately kept
 * apart from it. The API returns solo workspaces before business ones — that is
 * just the order the two queries are unioned in, so "the first one the server
 * listed" is not an answer anybody would choose. A landlord signing in to the
 * OPERATOR app and landing on somebody else's idea of first is the symptom.
 *
 * So the operator app states its own preference: a business workspace outranks
 * the solo one. Personal used to sit last in this list with a comment explaining
 * why an operator app is the wrong home for it; ADR-018 move 4 acted on that
 * comment and moved it to `apps/web`.
 */
export const WORKSPACE_LANDING_ORDER: readonly WorkspaceKey[] = [
  "host",
  "landlord",
  "broker",
];

/** Rank a workspace kind. An unranked kind sorts last rather than dropping out. */
function landingRank(key: WorkspaceKey): number {
  const rank = WORKSPACE_LANDING_ORDER.indexOf(key);
  return rank === -1 ? WORKSPACE_LANDING_ORDER.length : rank;
}

/**
 * The workspace to open out of the ones this person holds.
 *
 * Returns null for an empty list, so a caller must handle "holds nothing"
 * rather than being handed a default that is not theirs. A key not in the order
 * above still ranks (last), so adding a workspace kind cannot silently make
 * this return null.
 */
export function preferredWorkspace(
  held: readonly WorkspaceKey[],
): WorkspaceKey | null {
  let best: WorkspaceKey | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const key of held) {
    const effective = landingRank(key);
    if (effective < bestRank) {
      bestRank = effective;
      best = key;
    }
  }
  return best;
}

/** The least a workspace must carry to be ranked and addressed. */
export interface AddressableWorkspace {
  key: WorkspaceKey;
  workspaceId: string | null;
}

/**
 * WHICH workspace to open, not which kind (ADR-018, D-m).
 *
 * `preferredWorkspace` above takes and returns a KIND, so an owner holding
 * three hotels gets `"host"` three times and the redirect shim has nothing to
 * redirect to. This is the sibling that answers with an id.
 *
 * Three rules, in order:
 *
 *  1. **Where you last worked wins**, whatever its kind, when you still hold it.
 *     `sessions.active_workspace_id`, written by `POST /me/active-workspace`.
 *  2. Otherwise rank by kind, using the same `WORKSPACE_LANDING_ORDER` as above,
 *     so the two functions can never disagree about which KIND wins.
 *  3. Otherwise take the first the API returned for that kind. Stated out loud
 *     because "the first one" is not a rule anybody should land on silently.
 *
 * RULE 1 USED TO BE RULE 2, and only inside one kind. The draft ranked by kind
 * first, so an owner who runs a hotel and manages a residence landed in the
 * hotel every morning however long they had spent in the residence. Kind ranking
 * earned its place because `personal` was granted to every account and always
 * sorted first on the wire, which made "the first one the server listed"
 * `personal` for literally everybody. Move 4 took Personal out of this app, and
 * the three kinds left are all supply side, so no kind deserves to beat where a
 * person actually was. Ratified 2026-08-28.
 *
 * `activeWorkspaceId` is a hint about ORDER and never about access: it only
 * counts when it names a workspace already in hand, and every route behind it is
 * still refused by `WorkspaceGuard`.
 *
 * A workspace with no id is skipped: it is not addressable under the prefix,
 * so it is not a destination.
 */
export function preferredWorkspaceId(
  held: readonly AddressableWorkspace[],
  activeWorkspaceId: string | null = null,
): string | null {
  const addressable = held.filter(
    (w): w is AddressableWorkspace & { workspaceId: string } =>
      typeof w.workspaceId === "string" && w.workspaceId.length > 0,
  );
  if (addressable.length === 0) return null;

  // Rule 1. Across every kind, not within one: this is the whole change the
  // ratification made.
  const lastUsed =
    activeWorkspaceId !== null
      ? addressable.find((w) => w.workspaceId === activeWorkspaceId)
      : undefined;
  if (lastUsed) return lastUsed.workspaceId;

  // Rule 2. No history to go on, so fall back to what this app is for.
  let bestRank = Number.POSITIVE_INFINITY;
  for (const w of addressable) {
    const rank = landingRank(w.key);
    if (rank < bestRank) bestRank = rank;
  }

  // Rule 3.
  return addressable.find((w) => landingRank(w.key) === bestRank)!.workspaceId;
}

/** Everything the IA needs to decide what a workspace shows. */
export interface NavContext {
  ws: WorkspaceKey;
  /** The workspace every link in this nav is addressed inside. */
  workspaceId: string | null;
  /**
   * The grant's `permissions[]`, resolved by the server (ADR-053, AC-A1). The
   * only input that decides which doors a person reaches; no role is read.
   */
  permissions: readonly Permission[];
  /**
   * From the GRANT (ADR-035, D-a). This is what decides which optional
   * destinations exist, so it must never be derived from a fixture again.
   */
  departments: readonly DepartmentCategory[];
  /**
   * Pill numbers, all optional. A missing count renders no pill, which is the
   * honest state before a live query has answered.
   */
  counts?: NavCounts & ResidenceNavCounts & { placementsAwaiting?: number | null };
  /**
   * The grant's `psfMembership.canManage` (ADR-056): the server's answer to
   * "may this person act on the business's PSF membership". Not a permission,
   * because a business in the registration pipeline holds none and its PSF page
   * must still open.
   */
  psfManage?: boolean;
  /**
   * The person holds a staff file at this business (the grant's `employeeId`,
   * from `GET /me/work`). It opens My work, and it is not a permission for the
   * reason `psfManage` is not: a file is a fact about the person, held by a
   * housekeeper and an accountant alike, and by an owner who is not on the
   * payroll not at all.
   */
  workFile?: boolean;
}

/**
 * Whether this workspace opens on the housekeeper's phone surface (F-P04) instead
 * of the desktop shell.
 *
 * Decided by the grant's permission shape, never by a role name (ADR-053, AC-A1,
 * ruled with the owner on 2026-09-13): a hotel grant that can set room status
 * and holds no front desk power. That is exactly the housekeeper today, and a
 * change to a role's permissions moves its surface with no second edit. A grant
 * at a business that is not `active` holds nothing, so it gets the shell, whose
 * screens word the registration stage.
 */
export function opensOnPhoneSurface(ctx: Pick<NavContext, "ws" | "permissions">): boolean {
  return (
    ctx.ws === "host" &&
    ctx.permissions.includes("housekeeping.set") &&
    !ctx.permissions.includes("reservation.approve") &&
    !ctx.permissions.includes("message.send")
  );
}

/**
 * The screen segment an address opens: the part after `/w/<id>/`, or the first
 * part of a path built before the workspace id was known.
 */
function segmentOf(href: string): string | undefined {
  const parts = href.split("/").filter(Boolean);
  return parts[0] === WORKSPACE_PREFIX.slice(1) ? parts[2] : parts[0];
}

/** Whether an address is a bare screen (`/w/<id>/finance`), not a lens under one. */
function isBareScreen(href: string): boolean {
  const parts = href.split("/").filter(Boolean);
  return parts[0] === WORKSPACE_PREFIX.slice(1) ? parts.length === 3 : parts.length === 1;
}

/**
 * Every screen segment this nav opens.
 *
 * The route guard's whole input. It is the nav's own addresses (each entry's
 * and each lens it reaches) plus the segments those entries grant, and nothing
 * else: one mechanism, as invariant 6 requires. A second list somewhere would
 * be a locked door the day it drifted.
 */
export function allowedSegments(sections: NavSection[]): Set<string> {
  const allowed = new Set<string>();
  const add = (href: string) => {
    const segment = segmentOf(href);
    if (segment) allowed.add(segment);
  };
  for (const section of sections) {
    for (const item of section.items) {
      add(item.href);
      for (const lens of item.lenses ?? []) add(lens.href);
      for (const granted of item.grants ?? []) allowed.add(granted);
    }
  }
  return allowed;
}

/**
 * The entry a screen segment belongs to, and the section that holds it.
 *
 * A record is not a nav entry, but it has a parent: the entry that GRANTS it
 * (ADR-044, D-d). A stay belongs to Reservations because Reservations is what
 * grants `stays`, whatever path the viewer took to reach it. Record breadcrumbs
 * name that entry. No second list.
 *
 * An entry that IS the screen wins over one that opens a lens of it: a bill
 * belongs to Finance, not to Revenue, which opens Finance's revenue lens.
 */
export function leafFor(
  sections: NavSection[],
  segment: string | undefined,
): { section: NavSection; item: NavItem } | null {
  if (!segment) return null;
  const find = (match: (item: NavItem) => boolean) => {
    for (const section of sections) {
      for (const item of section.items) {
        if (match(item)) return { section, item };
      }
    }
    return null;
  };
  return (
    find((item) => isBareScreen(item.href) && segmentOf(item.href) === segment) ??
    find((item) => item.grants?.includes(segment) === true) ??
    find((item) => segmentOf(item.href) === segment) ??
    find((item) => (item.lenses ?? []).some((lens) => segmentOf(lens.href) === segment))
  );
}

/**
 * The entry, and the lens within it, that an address belongs to: what the
 * sidebar lights.
 *
 * By the longest address that contains this one, so `/people/departments`
 * lights Settings, Departments, while `/people` lights People; then by a
 * granted segment, so a stay lights Reservations and an old `/today` lights
 * the Dashboard.
 */
export function activeEntry(
  sections: NavSection[],
  pathname: string,
): { section: NavSection; item: NavItem; lens: NavLens | null } | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const covers = (href: string, deep: boolean) =>
    href.length > 0 && (path === href || (deep && path.startsWith(`${href}/`)));

  /*
   * A lens that is a whole screen (`/staff`, `/rooms`) lights on its own
   * address only: `/staff/attendance` is another lens of the Staff screen, not
   * a page of Employees. A lens beneath a screen (`/staff/leave`) lights on
   * what is under it too (`/staff/leave/types`). An entry lights on anything
   * under its address.
   */
  const candidates: { section: NavSection; item: NavItem; lens: NavLens | null; href: string; deep: boolean }[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      candidates.push({ section, item, lens: null, href: item.href, deep: true });
      for (const lens of item.lenses ?? []) {
        candidates.push({ section, item, lens, href: lens.href, deep: !isBareScreen(lens.href) });
        for (const also of lens.activeOn ?? []) candidates.push({ section, item, lens, href: also, deep: false });
      }
    }
  }
  // Longer wins; on a tie the lens wins, because it says more.
  const best = candidates
    .filter((c) => covers(c.href, c.deep))
    .sort((a, b) => b.href.length - a.href.length || Number(b.lens !== null) - Number(a.lens !== null))[0];
  if (best) return { section: best.section, item: best.item, lens: best.lens };

  const granted = leafFor(sections, segmentOf(path));
  return granted ? { ...granted, lens: null } : null;
}

/**
 * The screen segment of an operator path: `/w/<id>/<segment>/…`.
 *
 * Every route this app serves under a workspace has the same depth (ADR-018,
 * AC-1), so the segment always sits third.
 */
export function screenSegment(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean)[2];
}

/**
 * The one place a workspace turns into a nav. Every consumer — the sidebar, the
 * command bar, the route guard, the home resolver — goes through here, so they
 * can never disagree about what a workspace contains.
 */
export function navFor(ctx: NavContext): NavSection[] {
  // Every link a workspace offers is addressed inside that workspace (ADR-018,
  // AC-1). The base is built once here so no nav builder can spell it its own
  // way, and so a workspace with no id yet produces no half-formed link.
  const base = workspaceBase(ctx.workspaceId);
  const counts = ctx.counts ?? {};
  switch (ctx.ws) {
    case "host":
      return withMyWork(hostNav(ctx.departments, ctx.permissions, base, counts, ctx.psfManage === true), ctx, base);
    case "landlord":
      return withMyWork(landlordNav(ctx.permissions, base, counts), ctx, base);
    case "broker":
      return brokerNav(base, counts.placementsAwaiting);
  }
}

/**
 * The lenses of My work, in the order its rail shows them. In this file for the
 * reason `STAFF_LENSES` is: which doors a person reaches is one table.
 */
export const MY_WORK_LENSES: readonly { key: "today" | "time" | "leave" | "pay"; label: string; segment: string }[] = [
  { key: "today", label: "Today", segment: "" },
  { key: "time", label: "My time", segment: "time" },
  { key: "leave", label: "My leave", segment: "leave" },
  { key: "pay", label: "My pay", segment: "pay" },
];

/**
 * My work: a person's own shifts, hours, leave and payslips, read and asked for
 * through `/me/work` (ADR-058, 058-self-service).
 *
 * In the footer, beside who you are here, because it is about the PERSON and
 * not the property: every other door in this nav is opened by what a role may
 * do to the business, and this one by being on its staff. Whoever holds no
 * file here is not offered it. A business workspace only; a broker has no
 * employer in this app.
 */
function withMyWork(sections: NavSection[], ctx: NavContext, base: string): NavSection[] {
  if (ctx.workFile !== true) return sections;
  const door: NavItem = {
    key: "my-work",
    label: "My work",
    icon: "id-card",
    href: `${base}/my-work`,
    built: true,
    lenses: MY_WORK_LENSES.map((lens) => ({
      key: `my-work-${lens.key}`,
      label: lens.label,
      href: lens.segment ? `${base}/my-work/${lens.segment}` : `${base}/my-work`,
    })),
  };
  // After the body and above Settings: the footer reads the person first and
  // the business second, and no list of doors starts with this one.
  const you: NavSection = { label: "You", items: [door], placement: "footer" };
  const firstFooter = sections.findIndex((s) => s.placement === "footer");
  return firstFooter === -1 ? [...sections, you] : [...sections.slice(0, firstFooter), you, ...sections.slice(firstFooter)];
}
