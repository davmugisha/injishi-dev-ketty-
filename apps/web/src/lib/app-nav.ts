/**
 * The authenticated shell's nav model (ADR-018, move 4).
 *
 * PLAIN PATHS, NOT `/w/[id]` (D-f). There is exactly one Personal workspace per
 * person — the database guarantees it with a partial unique index — so an id in
 * the URL here would name nothing that could not be derived. The operator app is
 * the opposite case and keeps the prefix: an owner runs three hotels and needs
 * three addresses.
 *
 * ONE WORKSPACE HERE, ON PURPOSE. Broker used to sit beside Personal in this
 * file. It is a supply side job and it stays in `apps/app` under `/w/[ws]/`
 * (move 4, step 8). It is written down because a reader will ask, and because
 * leaving it unsaid invites someone to move it back "for consistency".
 *
 * The routes were `/<workspace>-<key>`, which is how the original capture encoded
 * them. Nothing behind those prefixes ever shipped, so this is a rename of dead
 * addresses rather than a migration.
 */

/**
 * NOTE: no identity here, deliberately.
 *
 * This config used to carry `name`, `avatar` and `sub` as the literal strings of
 * a fixture person, ported from the capture. The shell rendered them, and the
 * real user overwrote them once the session resolved — so every signed-in
 * visitor saw someone else's name first, and any re-render brought it back.
 *
 * Who the user is comes from the session and only from the session (see
 * `useSessionUser` in lib/session.ts). What a SCREEN is stays here.
 */
export interface NavItem {
  /** The route this item owns. A plain path, and the whole address. */
  href: string;
  label: string;
  icon: string;
  /** Count pill — omitted when absent so a quiet nav stays quiet. */
  count?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Personal is one person's own side of both domains: the stays they book and the
 * home they rent. `personalNav` in the operator app already said so in a comment
 * — "it is the same person and the same inbox" — while the route tree handed
 * that person four inboxes. This is that comment, finally true.
 */
export const NAV: NavSection[] = [
  {
    label: "My stays",
    items: [
      // `/stay` is the ONE stay a person is checked into right now, and
      // `/trips` every stay they have booked. Without this item the shell
      // resolved `/stay` to nothing: a blank topbar and no highlighted row.
      { href: "/stay", label: "My stay", icon: "door-open" },
      { href: "/trips", label: "Trips", icon: "map-pin" },
      { href: "/saved", label: "Saved", icon: "heart" },
    ],
  },
  {
    label: "My home",
    items: [{ href: "/lease", label: "My lease", icon: "file-text" }],
  },
  {
    // The spine. ONE inbox and ONE account, not one of each per workspace
    // (D-g, AC-11). Messages and notifications are one stream with a filter,
    // because a person does not think of them as two places.
    label: "You",
    items: [
      { href: "/inbox", label: "Inbox", icon: "inbox" },
      { href: "/account", label: "Account", icon: "user-round" },
    ],
  },
];

/** The one action worth a dedicated button above the nav. */
export const PRIMARY_CTA = {
  label: "Explore stays",
  icon: "search",
  href: "/explore",
} as const;

/** Where a signed-in person lands when they have nowhere else in mind. */
export const HOME = "/trips";

/**
 * How this one workspace presents itself in the chrome.
 *
 * There is no switcher any more, because there is nothing to switch to: one
 * Personal workspace per person, and Broker stayed in the operator app. What is
 * left is a label saying which side of the product you are on, which still
 * matters to a person who is a host in one app and a guest in this one.
 */
export const PERSONAL = {
  kindLabel: "Personal · Guest & Tenant",
  shortLabel: "Personal",
  /** Avatar swatch; a token class, never a raw colour. */
  tone: "bg-primary text-primary-foreground",
} as const;

/**
 * Almost every screen is a plain vertical scroll container. The exception is the
 * inbox, whose thread list and conversation sit side by side and each scroll on
 * their own — so its `<main>` is a flex row that does NOT scroll.
 */
const DEFAULT_MAIN = "min-h-0 grow overflow-y-auto";

/**
 * Titles for shell routes that are RECORDS rather than sections.
 *
 * A receipt is reached from a trip or a stay, never from the nav, so it has no
 * `NavItem` to borrow a label from, and the topbar printed an empty heading
 * over it. These name the page without highlighting a row, because a receipt
 * belongs to no one section of the nav.
 */
const RECORD_TITLE: Record<string, string> = {
  "/receipt": "Receipt",
};

/** The last resort, so the topbar is never blank on a route nobody listed. */
const FALLBACK_TITLE = "Personal";
const MAIN_CLASS: Record<string, string> = {
  "/inbox": "flex min-h-0 grow",
};

/**
 * Resolve the shell's state from the route.
 *
 * The URL stays the single source of truth, so no page declares its own shell
 * props. A nested address such as `/inbox/<threadId>` resolves to its parent,
 * because a record is not a different section of the app. A record with no
 * parent in the nav (`/receipt/<ref>`) takes its title from `RECORD_TITLE`,
 * and anything else from `FALLBACK_TITLE`: the title is never empty.
 */
export function resolveRoute(pathname: string): {
  active: string;
  title: string;
  mainClass: string;
} {
  const item = NAV.flatMap((section) => section.items).find(
    (candidate) =>
      pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
  );
  const active = item?.href ?? "";
  const record = Object.keys(RECORD_TITLE).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return {
    active,
    title: item?.label ?? (record ? RECORD_TITLE[record] : FALLBACK_TITLE),
    mainClass: MAIN_CLASS[active] ?? DEFAULT_MAIN,
  };
}
