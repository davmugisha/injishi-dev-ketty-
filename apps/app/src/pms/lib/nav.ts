/**
 * The PMS information architecture — grouped by how a property is run, not by
 * how the platform is built (blueprint §3.2).
 *
 * Two things shape what renders:
 *  - the person's role (a receptionist never sees Money or Property admin),
 *  - the property's departments, which are config (F-P01) — so a 2-department
 *    guesthouse gets a shorter nav than a 5-department hotel with no code change.
 *
 * **Both now come from the SERVER** (ADR-035, D-a). The role has come from the
 * grant since ADR-012; the departments used to be read out of `data/demo.ts`,
 * which meant a 622 line fixture decided which sections a real hotel had. They
 * arrive on the same grant row as the role and the permission array, so the
 * three can never be resolved from different reads.
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

import type { DepartmentCategory } from "@injishi/contracts";

// No property, lease or thread type is imported any more, and that absence is
// the change (ADR-035, D-a). This module used to take a `HospitalityProperty`,
// a `ResidenceProperty` and a `BrokerData` — all of them demo fixtures — and
// read the doors out of them. It takes a role, a department list and some
// optional counts now, none of which it can invent.
import type { OrgRole, WorkspaceKey } from "../data/types";

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

/** A pill shows a positive number or nothing. Zero is quiet, absent is quiet. */
function pill(n: number | null | undefined): number | null {
  return typeof n === "number" && n > 0 ? n : null;
}

export function hostNav(
  departments: readonly DepartmentCategory[],
  role: OrgRole,
  base: string,
  counts: NavCounts = {},
): NavSection[] {
  // The USALI category, not the display name. Two hotels spell "Restaurant"
  // and "Dining" for the same thing; `fnb` is what both of them are.
  const has = (d: DepartmentCategory) => departments.includes(d);
  const pending = pill(counts.pendingReservations);
  const hkOpen = pill(counts.housekeepingOpen);
  const ticketsOpen = pill(counts.ticketsOpen);
  const ordersLive = pill(counts.ordersLive);
  const unread = pill(counts.unreadThreads);

  /**
   * The maintenance leaf, which two roles reach and only one department earns.
   *
   * Built once because the housekeeper branch below needs the same item, and a
   * second copy is how the two would drift.
   */
  const maintenance: NavItem[] = has("engineering")
    ? [
        {
          key: "maintenance",
          // The same word and the same screen the residence side already used.
          label: "Maintenance",
          icon: "wrench",
          href: `${base}/maintenance`,
          count: ticketsOpen,
          built: true,
        },
      ]
    : [];

  /*
   * A HOUSEKEEPER's whole surface, and it stops here (ADR-035, D-a).
   *
   * They hold exactly two permissions, `housekeeping.set` and `ticket.advance`,
   * and this is the nav that matches them. Before this branch existed the only
   * role gate in this function was `role !== "receptionist"`, so a housekeeper
   * fell through it and was handed the MANAGER's nav: twelve screens including
   * Finance, Inventory and People, against two permissions.
   *
   * It was invisible in the app because `AppShell` short-circuits a housekeeper
   * to `HousekeeperPhone` and never renders this sidebar. But the nav is not
   * only the sidebar — `allowedSegments(navFor(...))` IS the route guard's
   * whole input, and `CommandBar` reads the same list. So the allowed set said
   * a housekeeper could open Finance, and the only thing standing in the way
   * was a render branch rather than a check. Found by running this function
   * against a real grant for every seeded role.
   *
   * Returning early rather than adding another `role !== ...` to each block: a
   * role whose surface is a short list should say so in one place, not be
   * spelled out as four separate exclusions that the next edit can forget.
   */
  if (role === "housekeeper") {
    return [
      {
        label: "Rooms",
        items: [
          { key: "rooms", label: "Room status", icon: "bed-double", href: `${base}/rooms`, built: true },
          { key: "housekeeping", label: "Housekeeping", icon: "sparkles", href: `${base}/housekeeping`, count: hkOpen, built: true },
          ...maintenance,
        ],
      },
    ];
  }

  const sections: NavSection[] = [
    {
      label: "Front desk",
      items: [
        { key: "today", label: "Today", icon: "layout-dashboard", href: `${base}/today`, built: true },
        { key: "reservations", label: "Reservations", icon: "book-marked", href: `${base}/reservations`, count: pending, built: true, grants: ["stays"] },
        // Was `grid`, `availability` and the rate calendar inside `rooms-rates`:
        // three entries over one question, which is what is sellable, when, at
        // what price. One route, three views (ADR-018, move 5).
        { key: "calendar", label: "Calendar", icon: "calendar-days", href: `${base}/calendar`, built: true },
        { key: "inbox", label: "Inbox", icon: "message-square", href: `${base}/inbox`, count: unread, built: true },
      ],
    },
  ];

  // A receptionist's surface stops at the front desk + taking orders. This gate
  // predates the merge and must survive it: a nav rewrite is exactly where a
  // role boundary gets dropped.
  if (role !== "receptionist") {
    sections.push({
      label: "Rooms",
      items: [
        // Room status is TODAY's operations. Inventory below is setup. The two
        // used to be one word apart, `rooms` and `rooms-rates`, and the names
        // did not say which was which.
        { key: "rooms", label: "Room status", icon: "bed-double", href: `${base}/rooms`, built: true },
        { key: "housekeeping", label: "Housekeeping", icon: "sparkles", href: `${base}/housekeeping`, count: hkOpen, built: true },
        ...maintenance,
      ],
    });
  }

  // Only where a service department exists. The conditional is older than the
  // merge and the merge keeps it: a two department guesthouse gets no Services.
  if (has("fnb") || has("spa_recreation")) {
    sections.push({
      label: "Services",
      items: [
        { key: "services", label: "Services", icon: "bell-ring", href: `${base}/services`, count: ordersLive, built: true },
      ],
    });
  }

  if (role !== "receptionist") {
    sections.push({
      label: "Property",
      items: [
        { key: "inventory", label: "Inventory", icon: "building-2", href: `${base}/inventory`, built: true },
      ],
    });

    // Four leaves used to sit here — bills, payouts, invoices, revenue — and
    // "why is this month short" crossed all four and was answered by none. One
    // route, four lenses, so the question has somewhere to be asked.
    sections.push({
      label: "Money",
      items: [
        { key: "finance", label: "Finance", icon: "receipt", href: `${base}/finance`, built: true },
      ],
    });

    const admin: NavItem[] = [];
    // People is the owner's, because `team.manage` is (ADR-035 follow-up,
    // 2026-09-12). It used to be pushed unconditionally, so a manager saw the
    // leaf, opened it, and `team.tsx` answered with a refusal EmptyState — a
    // door that exists to say no. The permission and the leaf move together.
    if (role === "owner") {
      admin.push({ key: "people", label: "People", icon: "users", href: `${base}/people`, built: true });
    }
    if (role === "owner" || role === "manager") {
      // Owner AND manager, because Integrations is where the RRA EBM account is
      // connected and `ebm.manage` is held by both (ADR-041, D-o). Owner only,
      // this leaf left a manager holding a permission with no door to it.
      // Plan and billing stays the owner's: `Settings` hides that lens from a
      // manager and refuses it by URL.
      admin.push({ key: "settings", label: "Settings", icon: "settings", href: `${base}/settings`, built: true });
    }
    // Only when it holds something. No role reaches here empty today — a
    // housekeeper returns early above and a receptionist never enters this
    // block — so this is a guard against the NEXT leaf becoming conditional,
    // not a live case. A section header with nothing under it reads as a
    // broken screen rather than as an absent power.
    if (admin.length > 0) sections.push({ label: "Property admin", items: admin });
  }

  return sections;
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
  role: OrgRole,
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
    {
      label: "Tenancies",
      items: [
        { key: "rent-roll", label: "Rent roll", icon: "wallet", href: `${base}/rent-roll`, count: overdue, built: true },
        { key: "leases", label: "Leases", icon: "file-text", href: `${base}/leases`, count: awaiting, built: true },
        { key: "move-outs", label: "Move-outs & deposits", icon: "log-out", href: `${base}/move-outs`, count: depositReview, built: true },
      ],
    },
    {
      label: "Property",
      items: [
        { key: "units", label: "Units & rents", icon: "building-2", href: `${base}/units`, built: true },
        { key: "maintenance", label: "Maintenance", icon: "wrench", href: `${base}/maintenance`, count: ticketsOpen, built: true },
        // Was `directory`, the same word the broker uses for the opposite job:
        // this one PUBLISHES your units, theirs browses everyone else's.
        { key: "listing", label: "Listing", icon: "globe", href: `${base}/listing`, built: true },
      ],
    },
    {
      label: "People",
      items: [
        { key: "inbox", label: "Inbox", icon: "message-square", href: `${base}/inbox`, count: tenantUnread, built: true },
        { key: "people", label: "People", icon: "users", href: `${base}/people`, built: true },
      ],
    },
    {
      // `compliance` is gone as a leaf. Half of it is the `filing` lens on the
      // lease it describes (move 3); half is the portfolio monitor, which is a
      // Finance lens. It named a regime rather than something you do.
      label: "Money",
      items: [
        { key: "finance", label: "Finance", icon: "receipt", href: `${base}/finance`, built: true },
      ],
    },
    // Owner and manager, as on the hotel side: Integrations is behind
    // `ebm.manage`, which both hold (ADR-041, D-o).
    ...(role === "owner" || role === "manager"
      ? [
          {
            label: "Business",
            items: [
              { key: "settings", label: "Settings", icon: "settings", href: `${base}/settings`, built: true },
            ],
          },
        ]
      : []),
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
  role: OrgRole;
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
      return hostNav(ctx.departments, ctx.role, base, counts);
    case "landlord":
      return landlordNav(ctx.role, base, counts);
    case "broker":
      return brokerNav(base, counts.placementsAwaiting);
  }
}
