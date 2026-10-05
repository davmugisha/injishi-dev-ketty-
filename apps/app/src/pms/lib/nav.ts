/**
 * The PMS information architecture — grouped by how a property is run, not by
 * how the platform is built (blueprint §3.2).
 *
 * Two things shape what renders:
 *  - the permissions the grant carries (a receptionist holds no `money.view`, so
 *    never sees Money), each leaf declaring the one it needs (ADR-053),
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
 * COUNT PILLS ARE DIFFERENT, and the difference is the point. A count is an
 * affordance and may be stale or absent; a SECTION is a door, and
 * `allowedSegments` below turns the doors into the route guard's whole input.
 * So a section is decided by the grant, and a count is `null` until a live
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

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  href: string;
  /** Count pill — omitted when zero so a quiet nav stays quiet. */
  count?: number | null;
  /** False while the screen is still a placeholder. */
  built?: boolean;
  /**
   * The permission this leaf gates, or absent when it gates none (ADR-053,
   * AC-A1). Absent is a decision, not a gap: such a leaf is offered to every
   * member of the workspace. The outer gate still holds, because a business
   * that is not `active` holds no permissions and its app is closed anyway.
   */
  permission?: Permission;
  /**
   * Any ONE of these opens the leaf (ADR-055), for a screen that several
   * capabilities legitimately reach.
   *
   * It exists because moving Departments under Team & Departments would
   * otherwise have taken it away from a manager. Under Services the leaf was
   * gated on `order.advance`; here the obvious gate is `team.manage`, which is
   * the owner's alone — so a manager who may edit departments
   * (`department.manage`) would have lost the only door to them. The API already
   * has this shape as `@RequireAnyPermission`; this is the nav's half of it.
   *
   * A leaf declares this OR `permission`, never both. The screen behind such a
   * leaf must refuse per lens, because reaching it no longer implies holding
   * every power it offers.
   */
  anyPermission?: readonly Permission[];
  /**
   * Object routes this leaf opens (ADR-018, move 3).
   *
   * A record page is not a nav leaf: nobody navigates to "stays", they open one
   * stay from the reservation it came from. But screen access in this app has
   * exactly ONE mechanism, the allowed set built from `navFor` (invariant 6), so
   * a record route has to be granted by the leaf a person reaches it through
   * rather than by a second check somewhere else.
   *
   * Reservations grants `stays` because that is where a stay is linked from: a
   * stay does not exist until someone arrives, so the booking is the way in.
   */
  grants?: readonly string[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Screens still awaiting their design pass, keyed for the placeholder copy. */
export const PLACEHOLDER_COPY: Record<string, { icon: string; title: string; line: string; hint?: string }> = {
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
 * lets a section exist on the server's say-so while its badge waits for a real
 * query, instead of a fixture supplying a number nobody counted.
 */
export interface NavCounts {
  pendingReservations?: number | null;
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
 * as a nav leaf's gate: which doors a grant reaches. The leaf below is opened by
 * ANY of the seven HR permissions, and the screen offers only the lenses this
 * table lets through, so a receptionist who clocks people in reaches Staff and
 * sees Roster and Attendance, never Employees or Payroll. Each gate is exactly
 * the read its lens makes, so an offered lens never meets a refusal.
 *
 * The people file (058-people-file) adds six. Documents, Discipline and
 * Configuration are `people.manage`'s; the org chart reads like the file list;
 * Policies and Announcements are the whole business's, so any HR permission
 * reads them, the desk included.
 */
export const STAFF_LENSES: readonly {
  key:
    | "employees"
    | "org-chart"
    | "documents"
    | "discipline"
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
  { key: "employees", label: "Employees", segment: "", anyPermission: ["people.view", "people.manage", "payroll.run"] },
  { key: "org-chart", label: "Org chart", segment: "org-chart", anyPermission: ["people.view", "people.manage", "payroll.run"] },
  { key: "documents", label: "Documents", segment: "documents", anyPermission: ["people.manage"] },
  { key: "discipline", label: "Discipline", segment: "discipline", anyPermission: ["people.manage"] },
  { key: "roster", label: "Roster", segment: "roster", anyPermission: ["roster.manage", "attendance.record", "people.view"] },
  // Time (058-time AC-TM14). Each lens opens on the reads it makes.
  { key: "rotations", label: "Rotations", segment: "rotations", anyPermission: ["roster.manage", "attendance.record"] },
  { key: "shift-requests", label: "Shift requests", segment: "shift-requests", anyPermission: ["roster.manage"] },
  { key: "attendance", label: "Attendance", segment: "attendance", anyPermission: ["attendance.record", "attendance.approve"] },
  { key: "attendance-requests", label: "Attendance requests", segment: "attendance-requests", anyPermission: ["attendance.approve"] },
  { key: "kiosks", label: "Kiosks", segment: "kiosks", anyPermission: ["attendance.record"] },
  { key: "leave", label: "Leave", segment: "leave", anyPermission: ["leave.approve"] },
  { key: "payroll", label: "Payroll", segment: "payroll", anyPermission: ["payroll.run"] },
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

/** Every HR permission: any one of them opens the Staff leaf. The contracts' list, so the API's reads agree. */
const STAFF_PERMISSIONS: readonly Permission[] = HR_PERMISSIONS;

/** The Staff leaf, the same in a hotel and a residence business (ADR-058). */
function staffLeaf(base: string): NavItem {
  return { key: "staff", label: "Staff", icon: "id-card", href: `${base}/staff`, built: true, anyPermission: STAFF_PERMISSIONS };
}

/** A pill shows a positive number or nothing. Zero is quiet, absent is quiet. */
function pill(n: number | null | undefined): number | null {
  return typeof n === "number" && n > 0 ? n : null;
}

/**
 * Keep the leaves this grant reaches (ADR-053, AC-A1).
 *
 * A leaf that declares a permission is kept when the grant holds it. A leaf that
 * declares NONE is kept for every member of the workspace, and that is the rule
 * rather than an omission: Today, Calendar and the tenancy lists gate no
 * capability, and inventing a permission for each would refuse nobody.
 *
 * No branch in this file reads a role name any more. The role used to decide
 * People, Settings and the receptionist's and housekeeper's surfaces, as hand
 * mirrors of `team.manage`, `ebm.manage` and the rest, so a permission change
 * had to be made twice and the second edit was the one that got forgotten. The
 * permission array is the server's answer, already resolved; this only reads it.
 */
function reachable(
  items: readonly NavItem[],
  permissions: readonly Permission[],
): NavItem[] {
  return items.filter((item) => {
    if (item.anyPermission !== undefined)
      return item.anyPermission.some((p) => permissions.includes(p));
    return item.permission === undefined || permissions.includes(item.permission);
  });
}

/** A section with the leaves this grant reaches, or nothing when it reaches none. */
function sectionOf(
  label: string,
  items: readonly NavItem[],
  permissions: readonly Permission[],
): NavSection[] {
  const kept = reachable(items, permissions);
  // A header with nothing under it reads as a broken screen, not as an absent power.
  return kept.length > 0 ? [{ label, items: kept }] : [];
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
  const pending = pill(counts.pendingReservations);
  const hkOpen = pill(counts.housekeepingOpen);
  const ticketsOpen = pill(counts.ticketsOpen);
  const ordersLive = pill(counts.ordersLive);
  const unread = pill(counts.unreadThreads);

  return [
    ...sectionOf(
      "Front desk",
      [
        { key: "today", label: "Today", icon: "layout-dashboard", href: `${base}/today`, built: true },
        { key: "reservations", label: "Reservations", icon: "book-marked", href: `${base}/reservations`, count: pending, built: true, grants: ["stays"], permission: "reservation.approve" },
        // Was `grid`, `availability` and the rate calendar inside `rooms-rates`:
        // three entries over one question, which is what is sellable, when, at
        // what price. One route, three views (ADR-018, move 5).
        { key: "calendar", label: "Calendar", icon: "calendar-days", href: `${base}/calendar`, built: true },
        { key: "inbox", label: "Inbox", icon: "message-square", href: `${base}/inbox`, count: unread, built: true, permission: "message.send" },
      ],
      permissions,
    ),
    ...sectionOf(
      "Rooms",
      [
        // Room status is TODAY's operations. Inventory below is setup. The two
        // used to be one word apart, `rooms` and `rooms-rates`, and the names
        // did not say which was which.
        { key: "rooms", label: "Room status", icon: "bed-double", href: `${base}/rooms`, built: true, permission: "housekeeping.set" },
        { key: "housekeeping", label: "Housekeeping", icon: "sparkles", href: `${base}/housekeeping`, count: hkOpen, built: true, permission: "housekeeping.set" },
        // Only where an engineering department exists, and to whoever advances a
        // ticket: the owner, the manager and the housekeeper, exactly the three
        // roles the old branches let through.
        ...(has("engineering")
          ? [{ key: "maintenance", label: "Maintenance", icon: "wrench", href: `${base}/maintenance`, count: ticketsOpen, built: true, permission: "ticket.advance" } satisfies NavItem]
          : []),
      ],
      permissions,
    ),
    // Only where a service department exists: a two department guesthouse gets
    // no Services. `order.advance` rather than `menu.manage`, because the leaf
    // opens on Live orders, which a receptionist works; the Menu lens refuses
    // editing inside the screen (ADR-053, ruled 2026-09-13).
    ...(has("fnb") || has("spa_recreation")
      ? sectionOf(
          "Services",
          [{ key: "services", label: "Services", icon: "bell-ring", href: `${base}/services`, count: ordersLive, built: true, permission: "order.advance" }],
          permissions,
        )
      : []),
    ...sectionOf(
      "Property",
      [
        // The setup checklist an approved business lands on (2026-09-13). It
        // opens nothing of its own: every step links to the leaf that edits it,
        // so it is gated like Inventory and adds no second door.
        { key: "setup", label: "Setup", icon: "list-checks", href: `${base}/setup`, built: true, permission: "listing.manage" },
        { key: "inventory", label: "Inventory", icon: "building-2", href: `${base}/inventory`, built: true, permission: "listing.manage" },
      ],
      permissions,
    ),
    // Four leaves used to sit here — bills, payouts, invoices, revenue — and
    // "why is this month short" crossed all four and was answered by none. One
    // route, four lenses, so the question has somewhere to be asked.
    ...sectionOf(
      "Money",
      [{ key: "finance", label: "Finance", icon: "receipt", href: `${base}/finance`, built: true, permission: "money.view" }],
      permissions,
    ),
    // The HR module (ADR-058): everyone who works here, with or without an
    // account, their shifts, attendance, leave and pay. Beside Team &
    // Departments rather than inside it, because that screen is about who holds
    // an ACCOUNT and what it may do, and most of a hotel's staff never sign in.
    ...sectionOf("People", [staffLeaf(base)], permissions),
    ...sectionOf(
      "Property admin",
      [
        // **Team & Departments**, not People (ADR-055). Departments used to sit
        // under Services, which read as "the restaurant's settings": a department
        // is where revenue is reported and where an order routes, so a hotel
        // with no restaurant had nowhere to see its own departments at all.
        // **Reached by EITHER power**, which the move made necessary: under
        // Services the leaf was gated on `order.advance`, so a manager could
        // open Departments. `team.manage` alone is the owner's, so gating it
        // there would have taken departments away from the very role that may
        // edit them. The screen refuses per lens instead: the roster and Roles
        // ask for `team.manage` inside.
        { key: "people", label: "Team & Departments", icon: "users", href: `${base}/people`, built: true, anyPermission: ["team.manage", "department.manage"] },
        // Settings is behind `ebm.manage`, because Integrations is where the RRA
        // EBM account is connected (ADR-041, D-o). Plan and billing stays the
        // owner's: `Settings` hides that lens and refuses it by URL.
        { key: "settings", label: "Settings", icon: "settings", href: `${base}/settings`, built: true, permission: "ebm.manage" },
        // PSF membership (ADR-056). Gated on the server's `canManage`, never on
        // a permission: the owner applies at every registration stage, and a
        // business in the pipeline holds no permission at all. It carries none,
        // so `sectionOf` keeps it once it is in the list.
        ...(psfManage
          ? [{ key: "psf-membership", label: "PSF membership", icon: "badge-check", href: `${base}/psf-membership`, built: true } satisfies NavItem]
          : []),
      ],
      permissions,
    ),
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
    ...sectionOf(
      "People",
      [
        { key: "inbox", label: "Inbox", icon: "message-square", href: `${base}/inbox`, count: tenantUnread, built: true, permission: "message.send" },
        // A residence portfolio runs no departments, so this leaf keeps the
        // shorter name; the screen behind it offers Team, Roles and Invites and
        // omits the Departments lens rather than opening it empty.
        { key: "people", label: "Team & roles", icon: "users", href: `${base}/people`, built: true, permission: "team.manage" },
        // Every business type gets HR (ADR-058): a caretaker or a guard on a
        // residence payroll is on file like a hotel cook.
        staffLeaf(base),
      ],
      permissions,
    ),
    // `compliance` is gone as a leaf. Half of it is the `filing` lens on the
    // lease it describes (move 3); half is the portfolio monitor, which is a
    // Finance lens. It named a regime rather than something you do.
    ...sectionOf(
      "Money",
      [{ key: "finance", label: "Finance", icon: "receipt", href: `${base}/finance`, built: true, permission: "money.view" }],
      permissions,
    ),
    // Integrations is behind `ebm.manage`, as on the hotel side (ADR-041, D-o).
    ...sectionOf(
      "Business",
      [{ key: "settings", label: "Settings", icon: "settings", href: `${base}/settings`, built: true, permission: "ebm.manage" }],
      permissions,
    ),
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

/** The screen each workspace opens on, inside its own address. */
const WORKSPACE_LANDING_SCREEN: Record<WorkspaceKey, string> = {
  host: "/today",
  landlord: "/rent-roll",
  broker: "/directory",
};

/**
 * Where a workspace lands when you switch into it.
 *
 * A function of the RESOLVED workspace rather than a map keyed by segment
 * (ADR-017, D-b). The old map could only answer "a host lands on Today"; this
 * answers "THIS host lands on THIS Today", which is the whole point of the id.
 *
 * Every workspace this app serves is addressable, because the two that were not
 * — the government consoles — left for their own app (ADR-018, move 2), and
 * Personal left for the marketplace app (move 4).
 */
export function workspaceHome(
  ws: WorkspaceKey,
  workspaceId: string | null,
): string {
  const base = workspaceBase(workspaceId);
  // No id is not a screen we can name. Send them to the resolver at the root,
  // which asks the API again rather than guessing.
  if (!base) return "/";
  return `${base}${WORKSPACE_LANDING_SCREEN[ws]}`;
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
   * only input that decides which leaves a person reaches; no role is read.
   */
  permissions: readonly Permission[];
  /**
   * From the GRANT (ADR-035, D-a). This is what decides which optional
   * sections exist, so it must never be derived from a fixture again.
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
 * Every screen segment this nav opens.
 *
 * The route guard's whole input. It is the nav's own hrefs plus the object
 * routes those leaves grant, and nothing else: one mechanism, as invariant 6
 * requires. A second list somewhere would be a locked door the day it drifted.
 */
export function allowedSegments(sections: NavSection[]): Set<string> {
  const allowed = new Set<string>();
  for (const section of sections) {
    for (const item of section.items) {
      const last = item.href.split("/").pop();
      if (last) allowed.add(last);
      for (const granted of item.grants ?? []) allowed.add(granted);
    }
  }
  return allowed;
}

/**
 * The leaf a screen segment belongs to, and the section that holds it.
 *
 * A record is not a nav leaf, but it has a parent: the leaf that GRANTS it
 * (ADR-044, D-d). A stay belongs to Reservations because Reservations is what
 * grants `stays`, whatever path the viewer took to reach it. The sidebar marks
 * that leaf active and the record's breadcrumb names it, so both read the same
 * answer from the same model `allowedSegments` reads. No second list.
 */
export function leafFor(
  sections: NavSection[],
  segment: string | undefined,
): { section: NavSection; item: NavItem } | null {
  if (!segment) return null;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href.split("/").pop() === segment) return { section, item };
    }
  }
  for (const section of sections) {
    for (const item of section.items) {
      if (item.grants?.includes(segment)) return { section, item };
    }
  }
  return null;
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
 * command bar, the route guard — goes through here, so they can never disagree
 * about what a workspace contains.
 */
export function navFor(ctx: NavContext): NavSection[] {
  // Every link a workspace offers is addressed inside that workspace (ADR-018,
  // AC-1). The base is built once here so no nav builder can spell it its own
  // way, and so a workspace with no id yet produces no half-formed link.
  const base = workspaceBase(ctx.workspaceId);
  const counts = ctx.counts ?? {};
  switch (ctx.ws) {
    case "host":
      return hostNav(ctx.departments, ctx.permissions, base, counts, ctx.psfManage === true);
    case "landlord":
      return landlordNav(ctx.permissions, base, counts);
    case "broker":
      return brokerNav(base, counts.placementsAwaiting);
  }
}
