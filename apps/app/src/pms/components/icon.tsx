"use client";

/**
 * Icon set for the PMS.
 *
 * The design handoff names icons in lucide's kebab vocabulary. The map is
 * explicit (rather than a dynamic `lucide[name]` lookup) so the bundler can
 * tree-shake to just these — a front desk on a slow connection pays for what it
 * uses.
 */

import {
  ArrowLeft,
  BedDouble,
  Bell,
  BellRing,
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CornerDownRight,
  CreditCard,
  FileText,
  Flag,
  Gift,
  Globe,
  GripVertical,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  MessageSquare,
  Moon,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
  Briefcase,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Coins,
  Eye,
  GitFork,
  Heart,
  Inbox,
  MapPin,
  Menu,
  ScrollText,
  UserRound,
  ListChecks,
  Phone,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "arrow-left": ArrowLeft,
  "bed-double": BedDouble,
  bell: Bell,
  "bell-ring": BellRing,
  "book-marked": BookMarked,
  "book-open": BookOpen,
  "building-2": Building2,
  "calendar-days": CalendarDays,
  camera: Camera,
  check: Check,
  "chevron-down": ChevronDown,
  "chevrons-up-down": ChevronsUpDown,
  "corner-down-right": CornerDownRight,
  "credit-card": CreditCard,
  "file-text": FileText,
  flag: Flag,
  gift: Gift,
  globe: Globe,
  "grip-vertical": GripVertical,
  "layout-dashboard": LayoutDashboard,
  "layout-grid": LayoutGrid,
  /* A refusal is a closed door, not an alarm — see `app-shell.tsx`. */
  lock: Lock,
  "log-out": LogOut,
  "message-square": MessageSquare,
  moon: Moon,
  receipt: Receipt,
  search: Search,
  settings: Settings,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  sun: Sun,
  "trending-up": TrendingUp,
  "user-plus": UserPlus,
  users: Users,
  wallet: Wallet,
  wrench: Wrench,
  x: X,
  briefcase: Briefcase,
  "chart-column": ChartColumn,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  coins: Coins,
  eye: Eye,
  "git-fork": GitFork,
  heart: Heart,
  inbox: Inbox,
  "map-pin": MapPin,
  menu: Menu,
  "scroll-text": ScrollText,
  "user-round": UserRound,
  "list-checks": ListChecks,
  phone: Phone,
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  color,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const Cmp = ICONS[name] ?? CornerDownRight;
  return (
    <span style={{ display: "flex", color }} aria-hidden="true">
      <Cmp size={size} strokeWidth={strokeWidth} />
    </span>
  );
}
