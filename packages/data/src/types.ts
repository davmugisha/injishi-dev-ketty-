import type { BoardId } from "./screens.ts";

export type { BoardId };

/** People who can sign in (one persona = one person in one role). */
export type PersonaId =
  | "owner"
  | "manager"
  | "frontdesk"
  | "finance"
  | "hr"
  | "store"
  | "residence"
  | "housekeeper"
  | "supervisor"
  | "technician"
  | "waiter"
  | "outlet"
  | "guest"
  | "resident"
  | "broker"
  | "officer"
  | "psf"
  | "ops";

/** Personas whose home is the desktop workspace (sidebar app shell). */
export type WorkspacePersonaId =
  | "owner"
  | "manager"
  | "frontdesk"
  | "finance"
  | "hr"
  | "store"
  | "residence"
  | "outlet"
  | "broker"
  | "officer"
  | "psf"
  | "ops";

/** Phone apps (portrait, bottom tab bar). */
export type PhoneAppId = "housekeeper" | "supervisor" | "technician" | "resident" | "guest";

/** Where a screen renders. */
export type Surface = "workspace" | "phone" | "tablet" | "public" | "auth" | "component";

/** Ownership area of a screen (one implementation leaf + one fixtures file per area). */
export type AreaId =
  | "platform"
  | "shared"
  | "owner"
  | "commercial"
  | "operations"
  | "frontdesk"
  | "stays"
  | "finance"
  | "accounting"
  | "people"
  | "payroll"
  | "staff"
  | "outlets"
  | "stock"
  | "residence"
  | "resident"
  | "guest"
  | "market"
  | "public"
  | "oversight"
  | "admin"
  | "platformops";

/** Name of an icon exported by @gravity-ui/icons (PascalCase), e.g. "House". */
export type IconName = string;

export type StatusTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/**
 * Status pill in a workspace top bar: the outlined gate pill ("GT Bank production not verified") or a soft chip
 * with an icon or a status dot ("Ishyamba kiosk last seen 09:12"). Screens whose pill follows their own state
 * replace it while mounted with `<TopbarStatus slot={i}>` (apps/app/src/components/shell/TopbarStatus.tsx).
 */
export interface TopbarStatus {
  kind: "gate" | "chip";
  label: string;
  icon?: IconName;
  /** Status dot before the label (chips). */
  dot?: StatusTone;
  /** Chip colour (chips; default "default"). */
  tone?: StatusTone;
  /** Screen the pill links to. */
  board?: BoardId | null;
}

export interface TopbarConfig {
  /** Placeholder of the ⌘K search trigger. */
  search: string;
  /** Status pills shown in the top bar, left to right, in the board's default state (most boards have 0 or 1). */
  pills: TopbarStatus[];
  notifications: number;
  /** Whether the assistant shortcut is shown. */
  assistant: boolean;
}

export interface ScreenEntry {
  board: BoardId;
  /** Canvas title of the artboard. */
  title: string;
  /** Document title of the board. */
  pageTitle: string;
  /** Next.js route pattern, e.g. "/reservations/[id]". */
  route: string;
  /** Concrete link target for this screen. */
  href: string;
  surface: Surface;
  /** The artboard's size on the design canvas (CSS px). */
  frame: { width: number; height: number };
  /** Canvas page the board sits on. */
  section: string;
  area: AreaId;
  /** Persona the board was designed for; null = public. */
  persona: PersonaId | null;
  topbar?: TopbarConfig;
  /** Phone screens: which app's tab bar, and which tab is current. */
  phoneApp?: PhoneAppId;
  tabCurrent?: BoardId | null;
}

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  board: BoardId;
  chip?: string;
  /** Chip rendered as an alert (danger) count. */
  alert?: boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export interface PhoneTab {
  board: BoardId;
  icon: IconName;
  label: string;
}

/** A document stored in the embedded database. Every fixture item carries a stable id. */
export interface Doc {
  id: string;
}

/** Fixtures of one area: collection name → documents. Collection names are "<area>.<thing>". */
export type FixtureSet = Record<string, readonly Doc[]>;
