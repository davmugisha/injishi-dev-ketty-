import {
  Activity,
  Briefcase,
  Building,
  ChartColumn,
  Flag,
  Languages,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
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

/** Route guards hide what a role cannot reach (Super Admin sees everything). */
export function roleCanSee(role: StaffRole, item: NavItem): boolean {
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
