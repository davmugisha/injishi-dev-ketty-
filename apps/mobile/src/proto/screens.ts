// The prototype's 99 screens as routes: the registry every screen navigates with. Generated once from
// .unlazy/proto-ui/routes.json (the contract's route table); when the contract changes, change both.
// Pure data and functions, type imports only, so screens, the launcher and `node --test` all read it.

import type { Href } from "expo-router";

/** The seven phone apps, each a folder under `src/app`. */
export type AppKey = "guest" | "housekeeper" | "supervisor" | "technician" | "resident" | "manager" | "desk";

/** The app a prototype screen belongs to; `shared` screens serve several apps. */
export type ScreenApp = AppKey | "shared";

/**
 * Where a screen sits (PLAN.md, Routes): `root` and `modal` in the root Stack; `tab` the index of a tab
 * folder; `tabstack` inside a tab's own Stack (the tab bar stays); `stack` and `sheet` in the app's
 * outer Stack (no tab bar); `state` has no route of its own: a screen in a forced state, path + params.
 */
export type ScreenKind = "root" | "modal" | "tab" | "tabstack" | "stack" | "sheet" | "state";

export type ScreenId =
  | "shared-signin"
  | "shared-verify"
  | "shared-switcher"
  | "shared-notifs"
  | "shared-outbox"
  | "shared-account"
  | "shared-delete"
  | "shared-help"
  | "shared-loading"
  | "shared-empty"
  | "shared-error"
  | "shared-testmoney"
  | "guest-home-before"
  | "guest-home-stay"
  | "guest-home-after"
  | "guest-explore"
  | "guest-explore-map"
  | "guest-property"
  | "guest-dates"
  | "guest-checkout"
  | "guest-pay-wait"
  | "guest-booked"
  | "guest-trips"
  | "guest-saved"
  | "guest-me"
  | "guest-inbox"
  | "guest-chat"
  | "guest-requests"
  | "guest-prearrival"
  | "guest-key"
  | "guest-key-open"
  | "guest-order"
  | "guest-order-status"
  | "guest-bill"
  | "guest-bill-pay"
  | "guest-review"
  | "guest-claim"
  | "guest-claimed"
  | "guest-extras"
  | "guest-refund"
  | "hk-clockin"
  | "hk-today"
  | "hk-rooms"
  | "hk-task"
  | "hk-task-done"
  | "hk-found"
  | "hk-report"
  | "hk-report-saved"
  | "hk-schedule"
  | "hk-leave"
  | "hk-me"
  | "hk-pin"
  | "hk-hours"
  | "sup-floor"
  | "sup-room"
  | "sup-queue"
  | "sup-inspect"
  | "sup-return"
  | "sup-team"
  | "tech-jobs"
  | "tech-job"
  | "tech-resolve"
  | "tech-scan"
  | "tech-asset"
  | "res-home"
  | "res-pay"
  | "res-pay-confirm"
  | "res-pay-wait"
  | "res-receipt"
  | "res-payments"
  | "res-requests"
  | "res-repair-new"
  | "res-emergency"
  | "res-repair"
  | "res-building"
  | "res-visitor"
  | "res-household"
  | "res-me"
  | "res-lease"
  | "res-renewal"
  | "res-movein"
  | "res-moveout"
  | "mgr-today"
  | "mgr-approvals"
  | "mgr-approval"
  | "mgr-inbox"
  | "mgr-flash"
  | "mgr-me"
  | "desk-today"
  | "desk-arrival"
  | "desk-checkin"
  | "desk-checkin-room"
  | "desk-walkin"
  | "desk-walkin-pay"
  | "desk-paid"
  | "desk-rooms"
  | "desk-checkout"
  | "desk-money"
  | "desk-me";

export interface ScreenDef {
  readonly id: ScreenId;
  readonly app: ScreenApp;
  /** The prototype's title for the screen. */
  readonly title: string;
  /** The URL path; `[segment]`s are filled by `href`. A `state` screen's is its screen's path. */
  readonly path: string;
  readonly kind: ScreenKind;
  /** The tab folder of a `tab` or `tabstack` screen. */
  readonly tab: string | null;
  /** The prototype's defaults: `href` adds them, a screen falls back to them when the URL has none. */
  readonly params: Readonly<Record<string, string>>;
  /** A sheet or modal: the screen the prototype draws it over. */
  readonly over: ScreenId | null;
  /** A `state` screen: the screen shown in that state. */
  readonly of: ScreenId | null;
  /** The same screen mounted in another app: its path there, and its tab folder (null: the outer Stack). */
  readonly alt: Readonly<Partial<Record<AppKey, readonly [path: string, tab: string | null]>>>;
}

export interface TabDef {
  /** The folder under `src/app/<app>/(tabs)/`, which is also the tab's route name. */
  readonly folder: string;
  readonly label: string;
  /** A kit icon name. */
  readonly icon: string;
  /** The prototype screen the tab opens. */
  readonly screen: ScreenId;
}

/** The apps in the prototype's order. */
export const APP_KEYS = [
  "guest",
  "housekeeper",
  "supervisor",
  "technician",
  "resident",
  "manager",
  "desk",
] as const satisfies readonly AppKey[];

export const APP_LABELS: Readonly<Record<ScreenApp, string>> = {
  shared: "Shared",
  guest: "Guest",
  housekeeper: "Housekeeper",
  supervisor: "Supervisor",
  technician: "Technician",
  resident: "Resident",
  manager: "Manager",
  desk: "Front desk",
};

/** Each app's tab bar, in order (prototype `TABS`). */
export const APP_TABS = {
  guest: [
    { folder: "(home)", label: "Home", icon: "House", screen: "guest-home-stay" },
    { folder: "explore", label: "Explore", icon: "Magnifier", screen: "guest-explore" },
    { folder: "trips", label: "Trips", icon: "Suitcase", screen: "guest-trips" },
    { folder: "inbox", label: "Inbox", icon: "Comments", screen: "guest-inbox" },
    { folder: "me", label: "Me", icon: "Person", screen: "guest-me" },
  ],
  housekeeper: [
    { folder: "(today)", label: "Today", icon: "House", screen: "hk-today" },
    { folder: "rooms", label: "Rooms", icon: "LayoutCells", screen: "hk-rooms" },
    { folder: "schedule", label: "Schedule", icon: "Calendar", screen: "hk-schedule" },
    { folder: "me", label: "Me", icon: "Person", screen: "hk-me" },
  ],
  supervisor: [
    { folder: "(floor)", label: "Floor", icon: "LayoutCells", screen: "sup-floor" },
    { folder: "inspect", label: "Inspect", icon: "CheckDouble", screen: "sup-queue" },
    { folder: "team", label: "Team", icon: "Persons", screen: "sup-team" },
    { folder: "me", label: "Me", icon: "Person", screen: "hk-me" },
  ],
  technician: [
    { folder: "(jobs)", label: "Jobs", icon: "Wrench", screen: "tech-jobs" },
    { folder: "scan", label: "Scan", icon: "QrCode", screen: "tech-scan" },
    { folder: "schedule", label: "Schedule", icon: "Calendar", screen: "hk-schedule" },
    { folder: "me", label: "Me", icon: "Person", screen: "hk-me" },
  ],
  resident: [
    { folder: "(home)", label: "Home", icon: "House", screen: "res-home" },
    { folder: "pay", label: "Pay", icon: "Wallet", screen: "res-pay" },
    { folder: "requests", label: "Requests", icon: "Wrench", screen: "res-requests" },
    { folder: "building", label: "Building", icon: "Persons", screen: "res-building" },
    { folder: "me", label: "Me", icon: "Person", screen: "res-me" },
  ],
  manager: [
    { folder: "(today)", label: "Today", icon: "ChartColumn", screen: "mgr-today" },
    { folder: "approvals", label: "Approvals", icon: "CheckDouble", screen: "mgr-approvals" },
    { folder: "inbox", label: "Inbox", icon: "Comments", screen: "mgr-inbox" },
    { folder: "me", label: "Me", icon: "Person", screen: "mgr-me" },
  ],
  desk: [
    { folder: "(today)", label: "Today", icon: "House", screen: "desk-today" },
    { folder: "rooms", label: "Tents", icon: "LayoutCells", screen: "desk-rooms" },
    { folder: "walk-in", label: "Walk-in", icon: "Plus", screen: "desk-walkin" },
    { folder: "money", label: "Money", icon: "Wallet", screen: "desk-money" },
    { folder: "me", label: "Me", icon: "Person", screen: "desk-me" },
  ],
} as const satisfies Record<AppKey, readonly TabDef[]>;

/** The tab folders of one app, e.g. `TabFolder<"guest">` is `"(home)" | "explore" | …`. */
export type TabFolder<A extends AppKey> = (typeof APP_TABS)[A][number]["folder"];

/** What `use<App>TabBadges()` returns: a count, or `true` for a dot, per tab folder. */
export type TabBadges<A extends AppKey> = Partial<Record<TabFolder<A>, number | true>>;

const TABLE = {
  "shared-signin": {
    id: "shared-signin",
    app: "shared",
    title: "Sign in",
    path: "/sign-in",
    kind: "root",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "shared-verify": {
    id: "shared-verify",
    app: "shared",
    title: "Enter the emailed code",
    path: "/verify",
    kind: "root",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "shared-switcher": {
    id: "shared-switcher",
    app: "shared",
    title: "Switch place or role (X1)",
    path: "/switcher",
    kind: "modal",
    tab: null,
    params: {},
    over: "sup-floor",
    of: null,
    alt: {},
  },
  "shared-notifs": {
    id: "shared-notifs",
    app: "shared",
    title: "Staff inbox (X2)",
    path: "/housekeeper/notifications",
    kind: "tabstack",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: { supervisor: ["/supervisor/notifications", "(floor)"], technician: ["/technician/notifications", "(jobs)"] },
  },
  "shared-outbox": {
    id: "shared-outbox",
    app: "shared",
    title: "Outbox: saved on this phone (X3)",
    path: "/housekeeper/outbox",
    kind: "tabstack",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: { supervisor: ["/supervisor/outbox", "(floor)"], technician: ["/technician/outbox", "(jobs)"], desk: ["/desk/me/outbox", "me"] },
  },
  "shared-account": {
    id: "shared-account",
    app: "shared",
    title: "Account and privacy (X5)",
    path: "/guest/me/account",
    kind: "tabstack",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: {
      resident: ["/resident/me/account", "me"],
      manager: ["/manager/me/account", "me"],
      desk: ["/desk/me/account", "me"],
    },
  },
  "shared-delete": {
    id: "shared-delete",
    app: "shared",
    title: "Delete account",
    path: "/delete-account",
    kind: "root",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "shared-help": {
    id: "shared-help",
    app: "shared",
    title: "Help and support (X6)",
    path: "/guest/me/help",
    kind: "tabstack",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: { resident: ["/resident/me/help", "me"], manager: ["/manager/me/help", "me"], desk: ["/desk/me/help", "me"] },
  },
  "shared-loading": {
    id: "shared-loading",
    app: "shared",
    title: "State · loading",
    path: "/guest",
    kind: "state",
    tab: null,
    params: { proto: "loading" },
    over: null,
    of: "guest-home-stay",
    alt: {},
  },
  "shared-empty": {
    id: "shared-empty",
    app: "shared",
    title: "State · empty",
    path: "/guest/trips",
    kind: "state",
    tab: null,
    params: { proto: "empty" },
    over: null,
    of: "guest-trips",
    alt: {},
  },
  "shared-error": {
    id: "shared-error",
    app: "shared",
    title: "State · error",
    path: "/resident/pay",
    kind: "state",
    tab: null,
    params: { proto: "error" },
    over: null,
    of: "res-pay",
    alt: {},
  },
  "shared-testmoney": {
    id: "shared-testmoney",
    app: "shared",
    title: "State · test money",
    path: "/test-money",
    kind: "modal",
    tab: null,
    params: {},
    over: "guest-home-stay",
    of: null,
    alt: {},
  },
  "guest-home-before": {
    id: "guest-home-before",
    app: "guest",
    title: "Home · before the stay",
    path: "/guest",
    kind: "tab",
    tab: "(home)",
    params: { phase: "before" },
    over: null,
    of: null,
    alt: {},
  },
  "guest-home-stay": {
    id: "guest-home-stay",
    app: "guest",
    title: "Home · during the stay",
    path: "/guest",
    kind: "tab",
    tab: "(home)",
    params: { phase: "stay" },
    over: null,
    of: null,
    alt: {},
  },
  "guest-home-after": {
    id: "guest-home-after",
    app: "guest",
    title: "Home · after the stay",
    path: "/guest",
    kind: "tab",
    tab: "(home)",
    params: { phase: "after" },
    over: null,
    of: null,
    alt: {},
  },
  "guest-explore": {
    id: "guest-explore",
    app: "guest",
    title: "Explore stays",
    path: "/guest/explore",
    kind: "tab",
    tab: "explore",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-explore-map": {
    id: "guest-explore-map",
    app: "guest",
    title: "Explore · map",
    path: "/guest/explore/map",
    kind: "tabstack",
    tab: "explore",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-property": {
    id: "guest-property",
    app: "guest",
    title: "Property page",
    path: "/guest/property/[slug]",
    kind: "stack",
    tab: null,
    params: { slug: "isangano-lakeside-hotel" },
    over: null,
    of: null,
    alt: {},
  },
  "guest-dates": {
    id: "guest-dates",
    app: "guest",
    title: "Dates and guests",
    path: "/guest/dates",
    kind: "sheet",
    tab: null,
    params: {},
    over: "guest-property",
    of: null,
    alt: {},
  },
  "guest-checkout": {
    id: "guest-checkout",
    app: "guest",
    title: "Confirm and pay",
    path: "/guest/checkout",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-pay-wait": {
    id: "guest-pay-wait",
    app: "guest",
    title: "Waiting for MoMo approval",
    path: "/guest/pay-wait",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-booked": {
    id: "guest-booked",
    app: "guest",
    title: "Booking confirmed",
    path: "/guest/booked",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-trips": {
    id: "guest-trips",
    app: "guest",
    title: "Trips",
    path: "/guest/trips",
    kind: "tab",
    tab: "trips",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-saved": {
    id: "guest-saved",
    app: "guest",
    title: "Saved",
    path: "/guest/trips/saved",
    kind: "tabstack",
    tab: "trips",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-me": {
    id: "guest-me",
    app: "guest",
    title: "Me",
    path: "/guest/me",
    kind: "tab",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-inbox": {
    id: "guest-inbox",
    app: "guest",
    title: "Inbox",
    path: "/guest/inbox",
    kind: "tab",
    tab: "inbox",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-chat": {
    id: "guest-chat",
    app: "guest",
    title: "Chat with the front desk",
    path: "/guest/chat",
    kind: "stack",
    tab: null,
    params: { thread: "front-desk" },
    over: null,
    of: null,
    alt: {},
  },
  "guest-requests": {
    id: "guest-requests",
    app: "guest",
    title: "Requests",
    path: "/guest/requests",
    kind: "tabstack",
    tab: "(home)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-prearrival": {
    id: "guest-prearrival",
    app: "guest",
    title: "Pre-arrival check-in · ID",
    path: "/guest/prearrival",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-key": {
    id: "guest-key",
    app: "guest",
    title: "Digital key",
    path: "/guest/key",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-key-open": {
    id: "guest-key-open",
    app: "guest",
    title: "Door unlocked",
    path: "/guest/key-open",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-order": {
    id: "guest-order",
    app: "guest",
    title: "Order to your room",
    path: "/guest/order",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-order-status": {
    id: "guest-order-status",
    app: "guest",
    title: "Order status",
    path: "/guest/order-status",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-bill": {
    id: "guest-bill",
    app: "guest",
    title: "Bill",
    path: "/guest/bill",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-bill-pay": {
    id: "guest-bill-pay",
    app: "guest",
    title: "Pay the bill",
    path: "/guest/bill-pay",
    kind: "sheet",
    tab: null,
    params: {},
    over: "guest-bill",
    of: null,
    alt: {},
  },
  "guest-review": {
    id: "guest-review",
    app: "guest",
    title: "Review and points",
    path: "/guest/review",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-claim": {
    id: "guest-claim",
    app: "guest",
    title: "Scan the desk QR (G4)",
    path: "/guest/claim",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-claimed": {
    id: "guest-claimed",
    app: "guest",
    title: "Walk-in stay added",
    path: "/guest/claimed",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-extras": {
    id: "guest-extras",
    app: "guest",
    title: "Extras and offers (G5)",
    path: "/guest/extras",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "guest-refund": {
    id: "guest-refund",
    app: "guest",
    title: "Change or cancel (G6)",
    path: "/guest/refund",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "hk-clockin": {
    id: "hk-clockin",
    app: "housekeeper",
    title: "Clock in",
    path: "/housekeeper",
    kind: "tab",
    tab: "(today)",
    params: { phase: "before-shift" },
    over: null,
    of: null,
    alt: {},
  },
  "hk-today": {
    id: "hk-today",
    app: "housekeeper",
    title: "Today",
    path: "/housekeeper",
    kind: "tab",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "hk-rooms": {
    id: "hk-rooms",
    app: "housekeeper",
    title: "My rooms",
    path: "/housekeeper/rooms",
    kind: "tab",
    tab: "rooms",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "hk-task": {
    id: "hk-task",
    app: "housekeeper",
    title: "Room task · offline",
    path: "/housekeeper/rooms/task",
    kind: "tabstack",
    tab: "rooms",
    params: { room: "204" },
    over: null,
    of: null,
    alt: {},
  },
  "hk-task-done": {
    id: "hk-task-done",
    app: "housekeeper",
    title: "Room clean",
    path: "/housekeeper/rooms/task-done",
    kind: "tabstack",
    tab: "rooms",
    params: { room: "204" },
    over: null,
    of: null,
    alt: {},
  },
  "hk-found": {
    id: "hk-found",
    app: "housekeeper",
    title: "Found an item",
    path: "/housekeeper/found",
    kind: "sheet",
    tab: null,
    params: { room: "204" },
    over: "hk-task",
    of: null,
    alt: {},
  },
  "hk-report": {
    id: "hk-report",
    app: "housekeeper",
    title: "Report a problem · no signal",
    path: "/housekeeper/report",
    kind: "tabstack",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "hk-report-saved": {
    id: "hk-report-saved",
    app: "housekeeper",
    title: "Report saved on phone",
    path: "/housekeeper/report-saved",
    kind: "tabstack",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "hk-schedule": {
    id: "hk-schedule",
    app: "housekeeper",
    title: "Schedule and leave",
    path: "/housekeeper/schedule",
    kind: "tab",
    tab: "schedule",
    params: {},
    over: null,
    of: null,
    alt: { technician: ["/technician/schedule", "schedule"] },
  },
  "hk-leave": {
    id: "hk-leave",
    app: "housekeeper",
    title: "Ask for leave",
    path: "/housekeeper/leave",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: { technician: ["/technician/leave", null] },
  },
  "hk-me": {
    id: "hk-me",
    app: "housekeeper",
    title: "Me",
    path: "/housekeeper/me",
    kind: "tab",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: { supervisor: ["/supervisor/me", "me"], technician: ["/technician/me", "me"] },
  },
  "hk-pin": {
    id: "hk-pin",
    app: "housekeeper",
    title: "Payslip PIN",
    path: "/housekeeper/pin",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: { supervisor: ["/supervisor/pin", null], technician: ["/technician/pin", null] },
  },
  "hk-hours": {
    id: "hk-hours",
    app: "housekeeper",
    title: "Hours, pay, claims and loans",
    path: "/housekeeper/me/hours",
    kind: "tabstack",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: { supervisor: ["/supervisor/me/hours", "me"], technician: ["/technician/me/hours", "me"] },
  },
  "sup-floor": {
    id: "sup-floor",
    app: "supervisor",
    title: "Floor board",
    path: "/supervisor",
    kind: "tab",
    tab: "(floor)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "sup-room": {
    id: "sup-room",
    app: "supervisor",
    title: "Room sheet · rush or reassign",
    path: "/supervisor/room",
    kind: "sheet",
    tab: null,
    params: { room: "206" },
    over: "sup-floor",
    of: null,
    alt: {},
  },
  "sup-queue": {
    id: "sup-queue",
    app: "supervisor",
    title: "Inspection queue",
    path: "/supervisor/inspect",
    kind: "tab",
    tab: "inspect",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "sup-inspect": {
    id: "sup-inspect",
    app: "supervisor",
    title: "Inspect a room",
    path: "/supervisor/inspect/room",
    kind: "tabstack",
    tab: "inspect",
    params: { room: "201" },
    over: null,
    of: null,
    alt: {},
  },
  "sup-return": {
    id: "sup-return",
    app: "supervisor",
    title: "Room returned",
    path: "/supervisor/inspect/returned",
    kind: "tabstack",
    tab: "inspect",
    params: { room: "201" },
    over: null,
    of: null,
    alt: {},
  },
  "sup-team": {
    id: "sup-team",
    app: "supervisor",
    title: "My team today",
    path: "/supervisor/team",
    kind: "tab",
    tab: "team",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "tech-jobs": {
    id: "tech-jobs",
    app: "technician",
    title: "My jobs",
    path: "/technician",
    kind: "tab",
    tab: "(jobs)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "tech-job": {
    id: "tech-job",
    app: "technician",
    title: "Work order",
    path: "/technician/job",
    kind: "tabstack",
    tab: "(jobs)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "tech-resolve": {
    id: "tech-resolve",
    app: "technician",
    title: "Resolve and ask to release",
    path: "/technician/resolve",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "tech-scan": {
    id: "tech-scan",
    app: "technician",
    title: "Scan a tag",
    path: "/technician/scan",
    kind: "tab",
    tab: "scan",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "tech-asset": {
    id: "tech-asset",
    app: "technician",
    title: "Asset history",
    path: "/technician/scan/asset",
    kind: "tabstack",
    tab: "scan",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-home": {
    id: "res-home",
    app: "resident",
    title: "Home",
    path: "/resident",
    kind: "tab",
    tab: "(home)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-pay": {
    id: "res-pay",
    app: "resident",
    title: "Pay rent",
    path: "/resident/pay",
    kind: "tab",
    tab: "pay",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-pay-confirm": {
    id: "res-pay-confirm",
    app: "resident",
    title: "Confirm payment",
    path: "/resident/pay-confirm",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-pay-wait": {
    id: "res-pay-wait",
    app: "resident",
    title: "Waiting for MoMo approval",
    path: "/resident/pay-wait",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-receipt": {
    id: "res-receipt",
    app: "resident",
    title: "Payment receipt",
    path: "/resident/receipt",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-payments": {
    id: "res-payments",
    app: "resident",
    title: "Payments and statements (R1)",
    path: "/resident/pay/history",
    kind: "tabstack",
    tab: "pay",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-requests": {
    id: "res-requests",
    app: "resident",
    title: "Requests",
    path: "/resident/requests",
    kind: "tab",
    tab: "requests",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-repair-new": {
    id: "res-repair-new",
    app: "resident",
    title: "Request a repair",
    path: "/resident/repair-new",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-emergency": {
    id: "res-emergency",
    app: "resident",
    title: "Emergency repair (R2)",
    path: "/resident/emergency",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-repair": {
    id: "res-repair",
    app: "resident",
    title: "Repair thread",
    path: "/resident/repair",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-building": {
    id: "res-building",
    app: "resident",
    title: "Building (R3)",
    path: "/resident/building",
    kind: "tab",
    tab: "building",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-visitor": {
    id: "res-visitor",
    app: "resident",
    title: "Visitor code",
    path: "/resident/visitor",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-household": {
    id: "res-household",
    app: "resident",
    title: "Household",
    path: "/resident/household",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-me": {
    id: "res-me",
    app: "resident",
    title: "Me",
    path: "/resident/me",
    kind: "tab",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-lease": {
    id: "res-lease",
    app: "resident",
    title: "My lease",
    path: "/resident/lease",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-renewal": {
    id: "res-renewal",
    app: "resident",
    title: "Renewal offer",
    path: "/resident/renewal",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-movein": {
    id: "res-movein",
    app: "resident",
    title: "Move-in journey (R4)",
    path: "/resident/move-in",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "res-moveout": {
    id: "res-moveout",
    app: "resident",
    title: "Move-out and deposit (R5)",
    path: "/resident/move-out",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "mgr-today": {
    id: "mgr-today",
    app: "manager",
    title: "Today",
    path: "/manager",
    kind: "tab",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "mgr-approvals": {
    id: "mgr-approvals",
    app: "manager",
    title: "Approvals",
    path: "/manager/approvals",
    kind: "tab",
    tab: "approvals",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "mgr-approval": {
    id: "mgr-approval",
    app: "manager",
    title: "Approval detail · refund",
    path: "/manager/approval",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "mgr-inbox": {
    id: "mgr-inbox",
    app: "manager",
    title: "Inbox and alerts",
    path: "/manager/inbox",
    kind: "tab",
    tab: "inbox",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "mgr-flash": {
    id: "mgr-flash",
    app: "manager",
    title: "Flash report",
    path: "/manager/flash",
    kind: "tabstack",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "mgr-me": {
    id: "mgr-me",
    app: "manager",
    title: "Me",
    path: "/manager/me",
    kind: "tab",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-today": {
    id: "desk-today",
    app: "desk",
    title: "Today at the lodge",
    path: "/desk",
    kind: "tab",
    tab: "(today)",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-arrival": {
    id: "desk-arrival",
    app: "desk",
    title: "Arriving guest",
    path: "/desk/arrival",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-checkin": {
    id: "desk-checkin",
    app: "desk",
    title: "Check-in · ID photo",
    path: "/desk/check-in",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-checkin-room": {
    id: "desk-checkin-room",
    app: "desk",
    title: "Check-in · tent and guest QR",
    path: "/desk/check-in-room",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-walkin": {
    id: "desk-walkin",
    app: "desk",
    title: "Walk-in booking",
    path: "/desk/walk-in",
    kind: "tab",
    tab: "walk-in",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-walkin-pay": {
    id: "desk-walkin-pay",
    app: "desk",
    title: "Waiting for MoMo",
    path: "/desk/walk-in-pay",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-paid": {
    id: "desk-paid",
    app: "desk",
    title: "Paid · fiscal receipt",
    path: "/desk/paid",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-rooms": {
    id: "desk-rooms",
    app: "desk",
    title: "Tent rack",
    path: "/desk/rooms",
    kind: "tab",
    tab: "rooms",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-checkout": {
    id: "desk-checkout",
    app: "desk",
    title: "Check-out",
    path: "/desk/check-out",
    kind: "stack",
    tab: null,
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-money": {
    id: "desk-money",
    app: "desk",
    title: "Money and shift close",
    path: "/desk/money",
    kind: "tab",
    tab: "money",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
  "desk-me": {
    id: "desk-me",
    app: "desk",
    title: "Me",
    path: "/desk/me",
    kind: "tab",
    tab: "me",
    params: {},
    over: null,
    of: null,
    alt: {},
  },
} as const satisfies Record<ScreenId, ScreenDef>;

/** Every prototype screen, by id, in the prototype's order. */
export const SCREENS: Readonly<Record<ScreenId, ScreenDef>> = TABLE;

/** The ids in the prototype's order. */
export const SCREEN_IDS = Object.keys(TABLE) as readonly ScreenId[];

/** A screen's default params with their literal keys: `DefaultParams<"hk-task">` is `{ room: "204" }`. */
export type DefaultParams<Id extends ScreenId> = (typeof TABLE)[Id]["params"];

/** The path an app starts on: its first tab. */
export function appHome(app: AppKey): Href {
  return `/${app}` as Href;
}

/** The app a path is inside (`/supervisor/notifications` is supervisor), or null for a root path. */
export function surfaceOf(pathname: string): AppKey | null {
  const first = pathname.split(/[/?#]/)[1] ?? "";
  return (APP_KEYS as readonly string[]).includes(first) ? (first as AppKey) : null;
}

/**
 * Where a prototype screen lives, for `router.push`, `router.navigate` and `<Link>`:
 * `href("hk-task", { room: "305" })` is `/housekeeper/rooms/task?room=305`. The screen's default
 * params come first and `params` override them; `[segment]`s are filled, the rest become the query.
 * With `opts.app`, a shared screen opens at that app's own path (`alt`) when it has one, so it keeps
 * that app's tab bar: `href("shared-account", undefined, { app: useSurface() })`.
 */
export function href(
  id: ScreenId,
  params?: Readonly<Record<string, string | number | undefined>>,
  opts?: { app?: AppKey },
): Href {
  const screen = SCREENS[id];
  const alt = opts?.app ? screen.alt[opts.app] : undefined;
  const values = new Map<string, string>();
  for (const [key, value] of Object.entries({ ...screen.params, ...params })) {
    if (value !== undefined && `${value}` !== "") values.set(key, String(value));
  }
  const pathname = (alt ? alt[0] : screen.path).replace(/\[(?:\.\.\.)?(\w+)\]/g, (_match, name: string) => {
    const value = values.get(name) ?? "";
    values.delete(name);
    return encodeURIComponent(value);
  });
  const query = [...values].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  return (query ? `${pathname}?${query}` : pathname) as Href;
}
