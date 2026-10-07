"use client";

/**
 * The PMS sidebar, per the Sidebar board (2026-10-07): the business card with
 * the branch scope, a role-aware list of destinations, Settings in the footer,
 * and who is signed in.
 *
 * THE LIST IS THE GRANT'S. `navFor` decides every door from the permissions the
 * server resolved; this file only arranges them. Two arrangements come from the
 * board:
 *
 *  - **The home comes first.** "A role's sidebar: its home item first, then the
 *    rest in group order." Which door is home is `homeFor`'s (ADR-069 D-f), so
 *    an accountant's list starts with Finance and an HR officer's with People.
 *  - **Group labels earn their place only in a long list.** More than six
 *    destinations are shown under Front desk, Operations and Business; a role
 *    with a handful reads them as one list.
 *
 * A destination that merges screens (Housekeeping, Settings) shows its lenses
 * under it while it is open, as the board does for Finance and Reservations.
 *
 * New reservation and Walk-in moved to the top bar, beside each other, "where
 * the desk looks for actions" (the Navigation board's renames).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ORG_ROLE_LABEL } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import {
  BookMarked,
  BellRing,
  Briefcase,
  Building2,
  CalendarDays,
  ChartColumn,
  Coins,
  ConciergeBell,
  ContactRound,
  CornerDownRight,
  FileText,
  Globe,
  Handshake,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  MoonStar,
  Receipt,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "../data/capability";
import { useNavCounts } from "../data/nav-counts";
import { useSignOut } from "../data/sign-out";
import type { WorkspaceKey } from "../data/types";
import { homeEntryKey } from "../lib/home";
import { activeEntry, navFor, workspaceHome, type NavItem, type NavLens, type NavSection } from "../lib/nav";
import { navContextOf } from "../lib/nav-context";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { BranchSwitcher, type SwitchableWorkspace } from "./branch-switcher";

/**
 * The icon each destination names, Lucide 1.23.0 as the board draws them,
 * imported one by one so the bundle carries only these.
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  "book-marked": BookMarked,
  "bell-ring": BellRing,
  briefcase: Briefcase,
  "building-2": Building2,
  "calendar-days": CalendarDays,
  "chart-column": ChartColumn,
  coins: Coins,
  "concierge-bell": ConciergeBell,
  "contact-round": ContactRound,
  "file-text": FileText,
  globe: Globe,
  handshake: Handshake,
  "layout-dashboard": LayoutDashboard,
  "list-checks": ListChecks,
  "log-out": LogOut,
  "message-square": MessageSquare,
  "moon-star": MoonStar,
  receipt: Receipt,
  settings: Settings,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  "user-round": UserRound,
  users: Users,
  wallet: Wallet,
  wrench: Wrench,
};

/**
 * Pills that ask for a decision are drawn hot (the board's accent pill):
 * requests waiting for a yes or no. A count of work in hand (rooms to clean,
 * arrivals to check in) is drawn quiet.
 */
const HOT_PILLS: ReadonlySet<string> = new Set(["reservations", "inbox"]);

/** What each pill counts, for a screen reader, which hears the number alone otherwise. */
const PILL_MEANING: Record<string, string> = {
  reservations: "booking requests to decide",
  "front-desk": "arrivals still to check in",
  housekeeping: "rooms to clean",
  services: "open orders",
  inbox: "unread",
};

/** The kind of a workspace, in words, for the workspace rows of the card's menu. */
const KIND_LABEL: Record<WorkspaceKey, string> = {
  host: "Hotel",
  landlord: "Residence",
  broker: "Broker",
};

/** A destination's row. Pill shaped, the icon leading, as the board draws it. */
const LINK =
  "flex h-10 w-full items-center gap-3 rounded-full pl-3 pr-2.5 text-sm no-underline transition-colors";
/** A lens under an open destination: indented on a rule, a step smaller. */
const SUB_LINK =
  "ml-5 flex h-8 items-center rounded-r-full pl-5 pr-2.5 text-sm no-underline transition-colors";

/** The raised pill of the screen in view (the board's `aria-current` row). */
const CURRENT_STYLE: React.CSSProperties = {
  background: "var(--card)",
  boxShadow: "var(--surface-shadow)",
  color: "var(--sb-afg)",
};

function NavIcon({ name, on }: { name: string; on: boolean }) {
  const Glyph = NAV_ICONS[name] ?? CornerDownRight;
  return (
    <Glyph
      aria-hidden
      className="size-5 shrink-0"
      strokeWidth={1.8}
      style={{ color: on ? "var(--accent-text)" : "var(--sb-muted)" }}
    />
  );
}

function Pill({ item }: { item: NavItem }) {
  if (item.count == null) return null;
  const hot = HOT_PILLS.has(item.key);
  return (
    <span
      className="pms-num inline-flex h-5 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold"
      style={{
        minWidth: 22,
        background: hot ? "var(--accent)" : "var(--sb-hover)",
        color: hot ? "var(--accent-ink)" : "var(--sb-afg)",
      }}
    >
      <span aria-hidden>{item.count}</span>
      <span className="sr-only">
        , {item.count} {PILL_MEANING[item.key] ?? ""}
      </span>
    </span>
  );
}

/**
 * The lenses shown under an open destination. One lens that is the
 * destination's own address is the destination: listing it again says nothing.
 */
function visibleLenses(item: NavItem): NavLens[] {
  const lenses = item.lenses ?? [];
  if (lenses.length === 1 && lenses[0].href === item.href) return [];
  return lenses;
}

function Destination({
  item,
  open,
  lens,
  onNavigate,
}: {
  item: NavItem;
  /** This destination holds the screen in view. */
  open: boolean;
  /** The lens in view, when it is one of this destination's. */
  lens: NavLens | null;
  onNavigate: () => void;
}) {
  const subs = open ? visibleLenses(item) : [];
  // The row is the page when it IS the screen; when a lens of it is, the row is
  // open (bold, accent icon) and the lens carries `aria-current`.
  const current = open && (lens === null || subs.length === 0);
  return (
    <>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={cn(
          LINK,
          "pms-navitem",
          current ? "font-semibold" : open ? "font-semibold text-sidebar-primary-foreground" : "font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
        style={current ? CURRENT_STYLE : undefined}
      >
        <NavIcon name={item.icon} on={open} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.horizon ? (
          <span
            className="inline-flex h-5 shrink-0 items-center rounded-full border border-border px-2 text-2xs font-semibold text-muted-foreground"
            title="Horizon: designed for later, not in v1"
          >
            Horizon
          </span>
        ) : null}
        <Pill item={item} />
      </Link>
      {subs.map((sub) => {
        const on = lens?.key === sub.key;
        return (
          <Link
            key={sub.key}
            href={sub.href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={cn(
              SUB_LINK,
              "pms-navitem",
              on ? "rounded-full font-semibold" : "font-medium text-sidebar-foreground hover:bg-sidebar-accent",
            )}
            style={on ? CURRENT_STYLE : { boxShadow: "inset 1px 0 0 var(--line2)" }}
          >
            <span className="truncate">{sub.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const pms = usePms();
  const { state, dispatch, me } = pms;
  const { navOpen, setNavOpen } = usePmsUi();
  const { signOut, signingOut } = useSignOut();
  const pathname = usePathname();
  const router = useRouter();

  /*
   * Focus follows the drawer.
   *
   * Opening an overlay without moving focus leaves a keyboard or screen-reader
   * user still on the topbar, tabbing through a nav they were never told
   * appeared; closing it without giving focus back drops them at the top of the
   * document. The aside takes focus on open and hands it back to the handle on
   * close. Above 1024px the drawer never opens, so neither branch runs.
   */
  const asideRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (navOpen) asideRef.current?.focus();
    else if (wasOpen.current) document.getElementById("pms-nav-toggle")?.focus();
    wasOpen.current = navOpen;
  }, [navOpen]);

  // The workspace this screen acts in, from the address bar (ADR-018).
  const workspaceId = useWorkspaceId();
  const grant = state.grants?.find((g) => g.workspaceId === workspaceId) ?? null;

  // Pills for a hotel's requests, arrivals and rooms to clean, counted from the
  // lists the Dashboard and Room status already read; nothing for another kind.
  const counts = useNavCounts(state.ws === "host" ? workspaceId : null);
  const sections: NavSection[] = navFor(navContextOf(pms, workspaceId, counts));
  const active = activeEntry(sections, pathname);

  /*
   * The board's arrangement: the home first and unlabelled, then the groups,
   * labelled only when the list is long. Computed from the sections `navFor`
   * built, never from a role.
   */
  const body = sections.filter((s) => s.placement !== "footer");
  const footer = sections.filter((s) => s.placement === "footer").flatMap((s) => s.items);
  const all = body.flatMap((s) => s.items);
  const homeKey = grant ? homeEntryKey(grant, sections) : null;
  const homeItem = all.find((i) => i.key === homeKey) ?? null;
  const rest = (items: NavItem[]) => items.filter((i) => i !== homeItem);
  const groups: { label: string; items: NavItem[] }[] =
    all.length > 6
      ? [
          ...(homeItem ? [{ label: "", items: [homeItem] }] : []),
          ...body.map((s) => ({ label: s.label, items: rest(s.items) })).filter((g) => g.items.length > 0),
        ]
      : [{ label: "", items: homeItem ? [homeItem, ...rest(all)] : all }];

  // The workspaces this person holds, for the card's menu. Two hotels are two
  // rows: each is its own address.
  const workspaces: SwitchableWorkspace[] = (state.grants ?? [])
    .filter((g): g is typeof g & { workspaceId: string } => typeof g.workspaceId === "string")
    .map((g) => ({ workspaceId: g.workspaceId, name: g.label, kind: KIND_LABEL[g.key] }));

  const businessName = grant?.label ?? "Your workspace";
  const home = workspaceHome(state.ws, workspaceId);
  const roleLabel = grant?.role ? ORG_ROLE_LABEL[grant.role] : state.ws === "broker" ? "Broker" : me.title;
  const close = () => setNavOpen(false);

  return (
    /* Sizing and placement live in pms-tokens.css (`.pms-sidebar`), not here:
       below 1024px this aside leaves the flex row and becomes an off-canvas
       drawer, and an inline `width` would outrank the media query that moves
       it. `data-open` is what that rule keys off. */
    <aside
      ref={asideRef}
      className="pms-sidebar gap-4"
      data-open={navOpen ? "true" : "false"}
      tabIndex={-1}
      aria-label="Workspace"
    >
      <div className="flex flex-col gap-4">
        <Link href={home} onClick={close} className="flex items-center px-2.5 py-1" aria-label="Injishi, go to your home screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shared/img/injishi-extended.svg"
            alt=""
            width={80}
            height={24}
            style={{
              height: 24,
              width: 80,
              display: "block",
              filter: state.theme === "dark" ? "brightness(0) invert(1)" : "none",
            }}
          />
        </Link>

        {grant && workspaceId ? (
          <BranchSwitcher
            workspaceId={workspaceId}
            businessName={businessName}
            canSetUp={grant.permissions.includes("listing.manage")}
            workspaces={workspaces}
            onSwitchWorkspace={(nextId) => {
              const next = state.grants?.find((g) => g.workspaceId === nextId);
              if (!next) return;
              /*
               * The route change is the switch (ADR-017, D-f); the dispatch
               * only keeps the store's cached copy in step for the tick before
               * the new workspace's layout resolves the id out of the address
               * bar. The bare address opens that person's home there.
               * `WorkspaceGuard` refuses each request on its own merits.
               */
              dispatch({ type: "setWorkspace", ws: next.key, workspaceId: nextId });
              router.push(workspaceHome(next.key, nextId));
            }}
          />
        ) : null}
      </div>

      {/* ── Destinations ───────────────────────────────────────────────── */}
      <nav aria-label="Main" className="-mx-1 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-1 py-1">
        {groups.map((group, index) => (
          <div key={group.label || `home-${index}`} className="flex flex-col gap-0.5">
            {group.label ? (
              <div className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
            ) : null}
            {group.items.map((item) => (
              <Destination
                key={item.key}
                item={item}
                open={active?.item.key === item.key}
                lens={active?.item.key === item.key ? active.lens : null}
                onNavigate={close}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Footer: Settings, then who you are here ───────────────────────── */}
      <div className="flex flex-col gap-3">
        {footer.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {footer.map((item) => (
              <Destination
                key={item.key}
                item={item}
                open={active?.item.key === item.key}
                lens={active?.item.key === item.key ? active.lens : null}
                onNavigate={close}
              />
            ))}
          </div>
        ) : null}

        {/*
          Who you are here, and the way out (ADR-035, D-c). The role is the
          grant's, worded by the contracts' own labels; to see another role's
          surface, sign in as somebody who holds it. THE SIGN OUT SITS HERE
          because this is the only block in the shell about the PERSON rather
          than the property: an operator finishing a shift on a shared front
          desk machine needs a way out.
        */}
        <div className="flex items-center gap-3 border-t border-line pl-2.5 pr-1 pt-3">
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {me.ini}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{me.name}</span>
            {roleLabel ? <span className="truncate text-xs text-muted-foreground">{roleLabel}</span> : null}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            shape="rounded"
            onClick={signOut}
            /* `pending`, not `disabled`: signing out is a document navigation,
               so the press is followed by a second or two of nothing, and a
               button gone dead with no reason is where somebody walks away
               believing they have signed out. */
            pending={signingOut}
            aria-label={signingOut ? "Signing out" : "Sign out"}
            title={signingOut ? "Signing out…" : "Sign out"}
            className="shrink-0 text-muted-foreground"
          >
            <LogOut aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
