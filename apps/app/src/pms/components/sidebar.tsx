"use client";

/**
 * The PMS sidebar: identity (workspace → property → person), the primary CTA,
 * and the role-adaptive nav.
 *
 * The three switchers stack in scope order, widest first. The property switcher
 * hides itself for a single-property org and for anyone who cannot cross
 * properties (blueprint §3.1).
 *
 * **The two switchers are the shared `DropdownMenu` and `Avatar`** (2026-09-12).
 * Each used to be a ghost `Button` repainted by inline styles, over a popover
 * drawn from an inline style object, closed by a `pointerdown` listener of its
 * own and knowing nothing about Escape, the arrow keys or where focus went.
 * Radix brings all of that. The mark is the workspace's initials on its own
 * swatch through `Avatar`, where it was a blank disc, and the rows are
 * `menuitemradio`s, so the open one is announced as checked rather than only
 * drawn with a tick.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@injishi/ui";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { workspaces as demoWorkspaces } from "../data/demo";
import type { PropertyKey, WorkspaceRef } from "../data/types";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useNavCounts } from "../data/nav-counts";
import { useSignOut } from "../data/sign-out";
import { leafFor, navFor, screenSegment, workspaceHome, type NavSection } from "../lib/nav";
import { navContextOf } from "../lib/nav-context";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { Icon } from "./icon";
import { BranchSwitcher } from "./branch-switcher";

/**
 * A switcher's trigger is the menu's own button, styled here, rather than the
 * shared `Button`. That one is HeroUI's, and HeroUI paints its `h-10` from an
 * unlayered rule no `h-auto` utility can beat; a two line row needs its
 * height. `rounded` is a control's corner, not a card's.
 */
const SWITCH_TRIGGER =
  "flex w-full cursor-pointer items-center gap-3 rounded border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A menu row. The shared item's own focus style is a fill tint that measures
 * about 1.05:1 on this app's panel, so a keyboard user could not see which
 * row they were on; the inset ring is the one the trigger wears.
 */
const SWITCH_ROW =
  "gap-2.5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** A menu's eyebrow, in the sidebar's own uppercase step. */
const SWITCH_LABEL =
  "pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground";

/** As wide as the row that opened it, whatever width the drawer has today. */
const SWITCH_MENU: React.CSSProperties = {
  width: "var(--radix-dropdown-menu-trigger-width)",
};

/** "Amahoro Hospitality Group" becomes "AH"; a one word name keeps one letter. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The ink for a mark drawn on an identity swatch.
 *
 * The swatch is DATA, not a theme role — ui-registry.md records it as the one
 * colour literal this app still carries — so its foreground cannot be a role
 * chosen in advance. It is whichever of two FIXED inks contrasts more with
 * whatever colour arrived: `--accent-ink`, the app's dark ink (ink-950 in
 * both themes), or `--white`, the design tokens' fixed white. Not `--on-fill`:
 * pms-tokens.css defines that in `.light` only, so in the dark theme it is no
 * value at all and the initials would inherit the row's text colour. Anything
 * that is not a hex colour gets the dark ink, which is what the
 * `var(--accent)` fallback swatch wants.
 */
function inkOn(swatch: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(swatch.trim())?.[1];
  if (!hex) return "var(--accent-ink)";
  const channel = (at: number) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // WCAG contrast against each ink: ink-950 (#042330) has a relative
  // luminance of 0.0144, white of 1.
  const againstDark = (luminance + 0.05) / (0.0144 + 0.05);
  const againstLight = (1 + 0.05) / (luminance + 0.05);
  return againstDark >= againstLight ? "var(--accent-ink)" : "var(--white)";
}

/** A workspace's or a property's mark: initials, or an icon, on its own swatch. */
function SwitchMark({
  swatch,
  small,
  className,
  children,
}: {
  swatch: string;
  /** The menu row's size; the trigger's is the default. */
  small?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // Decorative: the name it abbreviates sits right beside it, and a row read
  // out as "AH Amahoro Hospitality Group" starts with a word nobody said.
  return (
    <Avatar aria-hidden className={cn("shrink-0", small ? "size-7" : "size-9", className)}>
      <AvatarFallback
        className={cn("font-bold", small ? "text-2xs" : "text-xs")}
        style={{ background: swatch, color: inkOn(swatch) }}
      >
        {children}
      </AvatarFallback>
    </Avatar>
  );
}

export function Sidebar() {
  const pms = usePms();
  const { state, dispatch, host, me } = pms;
  const { openCheckIn, navOpen, setNavOpen } = usePmsUi();
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

  const isHost = state.ws === "host";
  // The workspace this screen acts in, from the address bar (ADR-018).
  const workspaceId = useWorkspaceId();
  const capability = useCapability();

  /*
   * What the switcher offers: the workspaces this person actually holds.
   *
   * It used to offer `demoWorkspaces`, a fixed list of one entry per KIND. That
   * could not show an owner their second hotel, because both are `host` and the
   * list had one row for `host`. The grants carry an id each, so two hotels are
   * two rows and each row is its own address.
   *
   * The demo fixtures stay as the fallback for the moment before the API
   * answers, and only for that. They carry no id, so nothing built from them
   * can be routed to under `/w/` — which is the honest outcome, since there is
   * no workspace behind them.
   */
  const switcherWorkspaces: WorkspaceRef[] = useMemo(() => {
    if (!state.grants || state.grants.length === 0) return demoWorkspaces;
    return state.grants.map((g) => {
      // Colour and the one-line descriptor are presentation, and they follow
      // the KIND. Two hotels share a colour; they are told apart by their name.
      const skin = demoWorkspaces.find((d) => d.key === g.key);
      return {
        key: g.key,
        name: g.label,
        role: skin?.role ?? g.label,
        sq: skin?.sq ?? "var(--accent)",
        workspaceId: g.workspaceId,
      };
    });
  }, [state.grants]);

  // Which row is on. By ID first, because two rows can share a kind and only
  // the address tells them apart.
  const current =
    switcherWorkspaces.find(
      (w) => workspaceId !== null && w.workspaceId === workspaceId,
    ) ??
    switcherWorkspaces.find((w) => w.key === state.ws) ??
    switcherWorkspaces[0];

  // The radio group's value: the address where there is one, the kind for a
  // demo fixture that has none. Two hotels are two addresses.
  const workspaceValue = (w: WorkspaceRef) => w.workspaceId ?? w.key;

  // Pills for a hotel's requests and rooms to clean, counted from the lists
  // Today and Room status already read; nothing for another kind of workspace.
  const counts = useNavCounts(isHost ? workspaceId : null);
  const sections: NavSection[] = navFor(navContextOf(pms, workspaceId, counts));
  // The leaf this screen belongs to. A record is lit through the leaf that
  // grants it, so a stay keeps Reservations active (ADR-044, D-d). Matching
  // the href prefix alone left no leaf active on `/stays/*`.
  const activeKey = leafFor(sections, screenSegment(pathname))?.item.key;

  // The standalone demo's fixture card only. A live workspace shows the branch
  // switcher below, which reads coverage from the grant: `property.switch` is
  // gone, because seeing a branch is not a permission (ADR-054 AC-S4).
  const canSwitchProperty = isHost && capability.can("listing.manage");
  // A workspace the server answered for shows ITS properties; the fixture card
  // below is only for the standalone demo with no API behind it (2026-09-13).
  const liveWorkspace = Boolean(state.grants && state.grants.length > 0 && workspaceId);

  const propertyMeta = (key: PropertyKey) => {
    const p = state.db[key];
    return `${p.rooms.length} rooms · ${p.departments.length} departments`;
  };

  return (
    /* Sizing and placement live in pms-tokens.css (`.pms-sidebar`), not here:
       below 1024px this aside leaves the flex row and becomes an off-canvas
       drawer, and an inline `width` would outrank the media query that moves
       it. `data-open` is what that rule keys off. */
    <aside
      ref={asideRef}
      className="pms-sidebar"
      data-open={navOpen ? "true" : "false"}
      tabIndex={-1}
    >
      <div style={{ padding: "2px 6px 12px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shared/img/injishi-extended.svg"
          alt="Injishi"
          width={80}
          height={24}
          style={{
            height: 24,
            width: 80,
            display: "block",
            filter: state.theme === "dark" ? "brightness(0) invert(1)" : "none",
          }}
        />
      </div>

      {/* ── Workspace switcher ─────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger
          // The fill is already the sidebar's hover tint, so hover shows a border.
          className={cn(SWITCH_TRIGGER, "border-transparent bg-sidebar-accent hover:border-border")}
        >
          <SwitchMark swatch={current.sq}>{initialsOf(current.name)}</SwitchMark>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-sidebar-primary-foreground">
              {current.name}
            </span>
            <span className="block truncate text-xs text-sidebar-foreground">
              {current.role}
            </span>
          </span>
          <Icon name="chevrons-up-down" size={15} color="var(--sb-muted)" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" style={SWITCH_MENU}>
          <DropdownMenuLabel className={SWITCH_LABEL}>Switch workspace</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={workspaceValue(current)}
            onValueChange={(value) => {
              // On by ADDRESS, not by kind: with two hotels open in two tabs,
              // "the host one" is not an answer.
              const next = switcherWorkspaces.find((w) => workspaceValue(w) === value);
              if (!next || next === current) return;
              /*
               * Switch straight through (ADR-035, D-b).
               *
               * A gate used to stand here and ask for a six digit code, which
               * it then compared to a fixed string compiled into this bundle.
               * It called nothing and refused nobody. The REAL step up is the
               * one on web: `resolveDestination` withholds every destination
               * until the emailed code is accepted, and `WorkspaceBoundary`
               * sends an unstepped session back to it. Anyone who reached this
               * switcher has already presented that code.
               *
               * The route change is the switch (ADR-017, D-f); the dispatch
               * only keeps the store's cached copy in step for the tick before
               * the new workspace's layout resolves the id out of the address
               * bar. `WorkspaceGuard` refuses each request on its own merits
               * either way.
               */
              dispatch({
                type: "setWorkspace",
                ws: next.key,
                workspaceId: next.workspaceId ?? null,
              });
              router.push(workspaceHome(next.key, next.workspaceId ?? null));
            }}
          >
            {switcherWorkspaces.map((w) => (
              <DropdownMenuRadioItem
                key={workspaceValue(w)}
                value={workspaceValue(w)}
                className={SWITCH_ROW}
              >
                <SwitchMark swatch={w.sq} small>
                  {initialsOf(w.name)}
                </SwitchMark>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {w.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{w.role}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Branch switcher (ADR-054) ──────────────────────────────────── */}
      {liveWorkspace && workspaceId && (
        <BranchSwitcher workspaceId={workspaceId} canSetUp={capability.can("listing.manage")} />
      )}
      {!liveWorkspace && canSwitchProperty && host && (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(SWITCH_TRIGGER, "mt-2 border-border hover:bg-hover")}>
            <SwitchMark swatch={host.sq} small>
              <Icon name="building-2" size={14} strokeWidth={2} />
            </SwitchMark>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-sidebar-primary-foreground">
                {host.name}
              </span>
              <span className="block truncate text-xs text-sidebar-foreground">
                {propertyMeta(host.key)}
              </span>
            </span>
            <Icon name="chevron-down" size={14} color="var(--sb-muted)" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" style={SWITCH_MENU}>
            <DropdownMenuLabel className={SWITCH_LABEL}>Switch property</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={host.key}
              onValueChange={(key) => {
                if (key !== host.key) dispatch({ type: "setProperty", prop: key as PropertyKey });
              }}
            >
              {(["hotel", "guesthouse"] as PropertyKey[]).map((key) => {
                const p = state.db[key];
                return (
                  <DropdownMenuRadioItem key={key} value={key} className={SWITCH_ROW}>
                    <SwitchMark swatch={p.sq} small>
                      <Icon name="building-2" size={13} strokeWidth={2} />
                    </SwitchMark>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {propertyMeta(key)}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* ── Primary CTA ────────────────────────────────────────────────── */}
      {isHost && (
        <Button variant="ghost"
          onClick={() => openCheckIn(null)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginTop: 12,
            background: "var(--accent)",
            color: "var(--accent-ink)",
            border: "none",
            borderRadius: "var(--radius-surface)",
            padding: "11px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "var(--shadow-cta)",
          }}
        >
          <Icon name="user-plus" size={18} />
          New walk-in
        </Button>
      )}

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          paddingBottom: 8,
        }}
        aria-label="Sections"
      >
        {sections.map((sec) => (
          <div key={sec.label}>
            <div
              style={{
                padding: "12px 15px 4px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--sb-muted)",
              }}
            >
              {sec.label}
            </div>
            {sec.items.map((it) => {
              const on = it.key === activeKey;
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  /* On the drawer, picking a screen is also the gesture that
                     dismisses the nav — leaving it open over the screen it just
                     opened is the thing that makes a mobile nav feel broken.
                     A no-op above 1024px, where the drawer is never open. */
                  onClick={() => setNavOpen(false)}
                  aria-current={on ? "page" : undefined}
                  /* Touch sizing lives in CSS (pms-tokens.css, `pointer: coarse`)
                     rather than here: inline styles outrank a media query, so a
                     min-height set below would apply on the desktop shell too. */
                  className="pms-navitem"
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 11,
                    border: "none",
                    borderRadius: on ? 999 : 16,
                    padding: "8px 15px",
                    fontSize: 13.5,
                    fontWeight: on ? 700 : 500,
                    color: on ? "var(--sb-afg)" : "var(--sb-fg)",
                    background: on ? "var(--sb-abg)" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  <Icon name={it.icon} size={18} color={on ? "var(--accent-text)" : "var(--sb-muted)"} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                  {it.count != null && (
                    <span
                      className="pms-num"
                      style={{
                        marginLeft: "auto",
                        borderRadius: 999,
                        padding: "1px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        background: "var(--sb-hover)",
                        color: "var(--sb-muted)",
                      }}
                    >
                      {it.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Who you are here ───────────────────────────────────────────── */}
      {/*
        A "View as" role picker used to sit here (ADR-035, D-c). It offered
        every role in the demo roster and dispatched `setRole`, which the
        session reducer refuses the moment the API has answered: your role
        in a workspace is a fact of the grant, not a costume. So it was a
        control that advertised itself and always said no.
      
        What is left is the statement of who you are and what you hold
        here, and the way out. To see another role's surface, sign in as
        somebody who holds it — every role has a seeded account (ADR-035, D-d).

        THE SIGN OUT SITS HERE because this is the only block in the shell
        that is about the PERSON rather than the property. Until it existed
        this app had no way out at all: an operator finishing a shift on a
        shared front desk machine had to close the browser and hope.
      */}
      <div style={{ borderTop: "1px solid var(--sb-hover)", paddingTop: 8 }}>
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: 10,
            borderRadius: "var(--radius-surface)",
            padding: "8px 10px",
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              flex: "0 0 auto",
              borderRadius: 99,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11.5,
              fontWeight: 700,
              color: "var(--accent-foreground)",
            }}
          >
            {me.ini}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--sb-afg)" }}>
              {me.name}
            </span>
            <span style={{ display: "block", fontSize: 11, color: "var(--sb-muted)" }}>{me.title}</span>
          </span>
          <Button
            variant="ghost"
            onClick={signOut}
            /* `pending`, not `disabled`: signing out is a document navigation,
               so the press is followed by a second or two of nothing. The
               button used to go dead with only a `cursor: wait` to say why,
               which on a shared front-desk machine is where somebody walks
               away believing they have signed out. */
            pending={signingOut}
            /* An icon with no text is not a label. The action is destructive
               enough that it has to be named to a screen reader even while it
               renders as a glyph. */
            aria-label={signingOut ? "Signing out" : "Sign out"}
            title={signingOut ? "Signing out…" : "Sign out"}
            style={{
              display: "flex",
              flex: "0 0 auto",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "none",
              borderRadius: "var(--radius-surface)",
              padding: 6,
              color: "var(--sb-muted)",
              cursor: signingOut ? "wait" : "pointer",
            }}
          >
            <Icon name="log-out" size={16} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
