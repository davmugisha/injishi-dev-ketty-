import {
  Activity,
  Briefcase,
  Building,
  ChartColumn,
  Flag,
  GraduationCap,
  Languages,
  LayoutDashboard,
  ClipboardList,
  Megaphone,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  staffAllows,
  staffPermissionsForRoles,
  type StaffPermission,
} from "@injishi/contracts";

import type { NavGroup, NavItem, NavKey, StaffRole } from "./types";

/**
 * Nav model — admin-prd.md §3, 13 sections (from injishi-admin-shell.js).
 *
 * NO COUNTS, ALERTS OR CHIPS, on purpose. The prototype carried Businesses 7,
 * Finance 5, a red Compliance 5 and a "degraded" chip on System health, all
 * typed in by hand. On a console reading real accounts a staffer cannot tell a
 * typed-in alarm from a real one, and learning to ignore the sidebar's is how
 * the real one gets missed. `NavItem` keeps the fields and the sidebar still
 * draws them; they come back only when the value is read from the platform.
 */
export const NAV: NavGroup[] = [
  {
    group: "Operate",
    items: [
      { key: "overview", label: "Overview", icon: LayoutDashboard, roles: "all" },
      { key: "businesses", label: "Businesses", icon: Building, roles: ["ops", "compliance"] },
      { key: "users", label: "Users", icon: Users, roles: ["ops"] },
      { key: "brokers", label: "Brokers", icon: Briefcase, roles: ["ops"] },
      // ADR-049. In Operate because running a session is day-to-day work, not
      // platform configuration.
      //
      // `roles: ["trainer"]` AND NOTHING ELSE, which makes this the first row
      // in the register that `ops` cannot see. That is deliberate: only
      // `trainer` and `super_admin` hold `training.view`, and `roleCanSee`
      // already lets `super_admin` through every row. A `finance` staffer
      // typing the URL is refused by the API, which is the control; this line
      // is the affordance.
      { key: "training", label: "Training", icon: GraduationCap, roles: ["trainer"] },
    ],
  },
  {
    group: "Money & compliance",
    items: [
      { key: "finance", label: "Finance", icon: Wallet, roles: ["finance"] },
      { key: "compliance", label: "Compliance", icon: ShieldCheck, roles: ["compliance"] },
      { key: "audit", label: "Audit & data protection", icon: ScrollText, roles: ["compliance", "super_admin"] },
    ],
  },
  {
    group: "Platform",
    items: [
      { key: "system-health", label: "System health", icon: Activity, roles: "all" },
      { key: "configuration", label: "Configuration", icon: Settings, roles: ["super_admin"] },
      { key: "environments", label: "Environments & adapters", icon: Server, roles: ["super_admin"] },
      { key: "moderation", label: "Moderation & support", icon: Flag, roles: ["ops"] },
      { key: "announcements", label: "Announcements", icon: Megaphone, roles: ["super_admin"] },
      // ADR-048. Beside Announcements because it is the other thing staff
      // reach for when they are about to tell a lot of people something at
      // once. Deleted at launch along with the section behind it.
      { key: "waitlist", label: "Waitlist", icon: ClipboardList, roles: ["super_admin", "ops"] },
      { key: "analytics", label: "Analytics & insights", icon: ChartColumn, roles: "all" },
      { key: "localization", label: "Localization", icon: Languages, roles: ["super_admin", "ops"] },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

/**
 * Configuration's own screens.
 *
 * A SECOND register rather than more rows in `NAV`, and that is a constraint
 * rather than a preference: the sidebar is keyed by `NavKey`, one key per
 * top-level section, and every row it renders links to `/${key}`. A nested
 * screen has no key of its own to be given, so it is reached from inside the
 * section — the sidebar still highlights Configuration on `/configuration/fees`
 * because it matches on the path prefix.
 *
 * The alternative was a `children` array on `NavItem` and a second level in the
 * sidebar. That is the right shape for a console with several nested screens
 * and the wrong one for a console with a single nested screen, which would then
 * be the only row in the whole nav that expands.
 */
export const CONFIGURATION_SUBNAV: {
  href: string;
  label: string;
  detail: string;
}[] = [
  {
    href: "/configuration",
    label: "Overview",
    detail: "Adapter modes, feature flags and commercial terms",
  },
  {
    href: "/configuration/fees",
    label: "Registration fees",
    detail: "The one-time fee, per accommodation type",
  },
];

/**
 * The permission each console section needs to be reached at all (ADR-049
 * AC-25).
 *
 * THE ONE REGISTER. `section-boundary.tsx` refuses a route from this map and
 * `roleCanSee` below hides a sidebar row from the same map, so the sidebar can
 * never offer a row the route then refuses. The parallel `SCREEN_PERMISSION`
 * map that `apps/app` deleted (Spec 0002, D-e) is the shape to avoid: two
 * registers of one fact drift, and the one that drifts is always the one
 * nothing enforces.
 *
 * Every value here is the permission the API ALREADY declares on that
 * section's controller, never a new invention — the console must not be wider
 * than the boundary, and a console narrower than the boundary is a section a
 * staffer is entitled to and cannot open.
 *
 * Two entries are worth reading twice:
 *
 * `waitlist` borrows `admin.overview.view`, exactly as
 * `waitlist-admin.controller.ts` does, and for the reason recorded there:
 * ADR-048 defined no waitlist permission, and `admin.overview.view` sits in
 * `OBSERVE`, which every PLATFORM staff role holds. So the route admits any
 * platform staffer, which is what the API admits. The sidebar still shows the
 * row to `super_admin` and `ops` only; that narrowing is the affordance the
 * controller already calls an affordance, and narrowing is always safe.
 *
 * `training` is the one row keyed on a `training.*` power rather than an
 * `admin.*` one, which is what makes `trainer` the first staff role that
 * reaches exactly one section. It is also why the three rows this console used
 * to mark `roles: "all"` are NOT reachable by a trainer: `all` meant "all four
 * platform roles" when it was written, and a trainer holds no `admin.*`
 * permission at all (ADR-049 AC-24).
 *
 * ADR-049 says fourteen sections. There are SIXTEEN: `waitlist` arrived with
 * ADR-048 and `training` with ADR-049 itself, both after that sentence was
 * written. The guard covers what is on disk, not what the count says.
 *
 * Nothing has to remember to add the seventeenth row, and that is by
 * construction rather than by discipline: `Record<NavKey, StaffPermission>` is
 * exhaustive, so a new `NavKey` fails the typecheck until it has a permission
 * here, and a section directory added under `app/` with no `NavKey` at all is
 * a `notFound()` from `section-boundary.tsx` on its first visit. Both ends
 * fail closed, which is the only reason this map can be the only register.
 */
export const SECTION_PERMISSION: Readonly<Record<NavKey, StaffPermission>> = {
  overview: "admin.overview.view",
  businesses: "admin.business.view",
  users: "admin.user.view",
  brokers: "admin.broker.view",
  training: "training.view",
  finance: "admin.finance.view",
  compliance: "admin.compliance.view",
  audit: "admin.audit.read",
  "system-health": "admin.system.view",
  configuration: "admin.config.edit",
  environments: "admin.environment.manage",
  moderation: "admin.moderation.act",
  announcements: "admin.announcement.publish",
  waitlist: "admin.overview.view",
  analytics: "admin.analytics.view",
  localization: "admin.localization.edit",
};

/** The label the refusal screen names the section by. One register, again. */
export function sectionLabel(key: NavKey): string {
  return NAV_ITEMS.find((item) => item.key === key)?.label ?? key;
}

/**
 * May this resolved permission set open this section?
 *
 * Takes the permissions the SERVER resolved (`StaffAccess.permissions`), never
 * a role: a client that turns a role into powers holds its own copy of the
 * table and drifts from the server's, which is the bug ADR-012 removed on the
 * org side. `roleCanSee` below is the one place a role is expanded, and it
 * expands it for a SIDEBAR, which is an affordance.
 */
export function sectionAllows(
  permissions: readonly StaffPermission[],
  key: NavKey,
): boolean {
  return staffAllows(permissions, SECTION_PERMISSION[key]);
}

/**
 * Which sidebar rows a role lens draws.
 *
 * TWO tests, and the order matters. The permission decides whether the section
 * can be reached at all, from the same map the route guard reads — so a row
 * that would refuse on click is never drawn. The `roles` list may then narrow
 * further, and only narrow: it is the affordance, and `waitlist` is the one row
 * that uses it (see `SECTION_PERMISSION`).
 *
 * `super_admin` skips the second test because it holds every permission and the
 * lens exists so that it can look at the console as somebody else; it is not
 * skipped on the first, because it passes that one anyway.
 */
export function roleCanSee(role: StaffRole, item: NavItem): boolean {
  if (!sectionAllows(staffPermissionsForRoles([role]), item.key)) return false;
  if (role === "super_admin" || item.roles === "all") return true;
  return item.roles.includes(role);
}

export const STAFF_ROLES: {
  key: StaffRole;
  label: string;
  detail: string;
  icon: "shield" | "life-buoy" | "shield-check" | "wallet";
  swatch: string;
}[] = [
  {
    key: "super_admin",
    label: "Super Admin",
    detail: "Everything · second signer on money & role grants",
    icon: "shield",
    swatch: "bg-ramp-3 text-white",
  },
  {
    key: "ops",
    label: "Ops / Support",
    detail: "Orgs, users, brokers, moderation · never money",
    icon: "life-buoy",
    swatch: "bg-ramp-2 text-white",
  },
  {
    key: "compliance",
    label: "Compliance Officer",
    detail: "EBM, filings, TIN, audit & data-subject rights",
    icon: "shield-check",
    swatch: "bg-ramp-1 text-white",
  },
  {
    key: "finance",
    label: "Finance",
    detail: "Ledger, stuck money · initiates overrides, never alone",
    icon: "wallet",
    swatch: "bg-ramp-4 text-ramp-1",
  },
];

/** The mock world's clock — all prototype data is anchored to this date. */
export const MOCK_TODAY = "Sat 04 Jul 2026 · Africa/Kigali";

export const DISTRICTS: { key: string; label: string; seeding?: boolean }[] = [
  { key: "all", label: "All districts" },
  { key: "gasabo", label: "Gasabo" },
  { key: "kicukiro", label: "Kicukiro" },
  { key: "nyarugenge", label: "Nyarugenge" },
  { key: "musanze", label: "Musanze" },
  { key: "rubavu", label: "Rubavu" },
  { key: "huye", label: "Huye" },
  { key: "nyagatare", label: "Nyagatare", seeding: true },
];
