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
import { staffAllows, type StaffPermission } from "@injishi/contracts";

import type { NavGroup, NavItem, NavKey, StaffRole } from "./types";

/**
 * Nav model — admin-prd.md §3, 13 sections (from injishi-admin-shell.js).
 *
 * EACH SECTION DECLARES THE PERMISSION ITS READ DECLARES (ADR-053, AC-A3). The
 * sidebar filters on the `permissions[]` the server resolved, and
 * `components/shell/section-boundary.tsx`, mounted by each section's own
 * `layout.tsx`, refuses a section the array lacks (AC-A4), whether it was
 * typed or reached by a link. There is no
 * second staff matrix here any more: the `roles` arrays and `roleCanSee` this
 * replaced never read `StaffPermission`, and had already drifted from
 * `STAFF_ROLE_PERMISSIONS`. Overview, Analytics and System health are not a
 * special "all" case either; they declare the observe permissions every
 * PLATFORM role holds, which a `trainer` does not.
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
      { key: "overview", label: "Overview", icon: LayoutDashboard, permission: "admin.overview.view" },
      { key: "businesses", label: "Businesses", icon: Building, permission: "admin.business.view" },
      { key: "users", label: "Users", icon: Users, permission: "admin.user.view" },
      { key: "brokers", label: "Brokers", icon: Briefcase, permission: "admin.broker.view" },
      // ADR-049 (training). In Operate because running a session is day-to-day
      // work, not platform configuration. `training.view` is held by `trainer`
      // and `super_admin` only, so this is the first row `ops` cannot see, and
      // the only section a trainer, who holds no `admin.*` power, reaches.
      { key: "training", label: "Training", icon: GraduationCap, permission: "training.view" },
    ],
  },
  {
    group: "Money & compliance",
    items: [
      { key: "finance", label: "Finance", icon: Wallet, permission: "admin.finance.view" },
      { key: "compliance", label: "Compliance", icon: ShieldCheck, permission: "admin.compliance.view" },
      { key: "audit", label: "Audit & data protection", icon: ScrollText, permission: "admin.audit.read" },
    ],
  },
  {
    group: "Platform",
    items: [
      { key: "system-health", label: "System health", icon: Activity, permission: "admin.system.view" },
      { key: "configuration", label: "Configuration", icon: Settings, permission: "admin.config.view" },
      { key: "environments", label: "Environments & adapters", icon: Server, permission: "admin.environment.view" },
      { key: "moderation", label: "Moderation & support", icon: Flag, permission: "admin.moderation.view" },
      { key: "announcements", label: "Announcements", icon: Megaphone, permission: "admin.announcement.view" },
      // ADR-048. Beside Announcements because it is the other thing staff reach
      // for when they are about to tell a lot of people something at once. It
      // borrows `admin.overview.view`, exactly as `waitlist-admin.controller.ts`
      // does: ADR-048 defined no waitlist permission. Deleted at launch along
      // with the section behind it.
      { key: "waitlist", label: "Waitlist", icon: ClipboardList, permission: "admin.overview.view" },
      { key: "analytics", label: "Analytics & insights", icon: ChartColumn, permission: "admin.analytics.view" },
      { key: "localization", label: "Localization", icon: Languages, permission: "admin.localization.view" },
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
  {
    href: "/configuration/psf-tiers",
    label: "PSF tiers",
    detail: "What a business can apply for to join PSF",
  },
  {
    href: "/configuration/psf-sectors",
    label: "PSF sectors",
    detail: "PSF's clusters and the associations businesses join",
  },
  {
    href: "/configuration/government-bodies",
    label: "Government bodies",
    detail: "The institutions officers are appointed from",
  },
];

/**
 * May a staffer holding these permissions see this section? The one predicate
 * the sidebar and every section's layout call, so the two cannot disagree.
 *
 * The permissions are the server's answer from `GET /api/v1/me/staff`, never
 * resolved here from a role: a console that turns a role into powers holds its
 * own copy of the table, which is the bug this replaced. Neither the sidebar
 * nor the section refusal is the boundary; `StaffGuard` refuses every
 * `/api/v1/admin/*` call on its own.
 */
export function staffCanSee(
  permissions: readonly StaffPermission[],
  item: Pick<NavItem, "permission">,
): boolean {
  return staffAllows(permissions, item.permission);
}

/** The nav entry for a section key. Every key in `NavKey` has exactly one. */
export function navItemFor(key: NavKey): NavItem {
  const item = NAV_ITEMS.find((i) => i.key === key);
  if (!item) throw new Error(`No nav entry for section "${key}".`);
  return item;
}

/**
 * May this resolved permission set open this section? What
 * `section-boundary.tsx` asks on every navigation into a section (each section's
 * `layout.tsx` mounts it with its own key), through the same `permission` the
 * sidebar filters on, so the sidebar can never offer a row the route refuses.
 */
export function sectionAllows(
  permissions: readonly StaffPermission[],
  key: NavKey,
): boolean {
  return staffCanSee(permissions, navItemFor(key));
}

/** The label the refusal screen names the section by. One register, again. */
export function sectionLabel(key: NavKey): string {
  return navItemFor(key).label;
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
