"use client";

/**
 * The authenticated shell: sidebar + topbar, as real React.
 *
 * Replaces public/shared/js/injishi-web-shell.js, which built this markup as
 * HTML strings and swapped it into the DOM (`outerHTML =`) after hydration —
 * and scripts/canonicalize-shell.mjs, which pre-baked that same output into
 * every page so the swap would not shift the layout. Rendering it here makes
 * the server HTML correct by construction, so both are deleted.
 *
 * Markup is a faithful port: same classes, ids and aria, so the build-time
 * sheet (gen-app-css.mjs) and the token layer style it unchanged.
 *
 * WHAT MOVE 4 CHANGED (ADR-018). Routes are plain paths, so the nav reads an
 * href rather than composing `/<workspace>-<key>`. The workspace switcher is
 * gone: there is one Personal workspace per person and Broker stayed in the
 * operator app, so it offered nothing. And the notifications dropdown became a
 * LINK to the inbox, because notifications stopped being a second destination
 * (AC-11) — one stream, one place, filtered.
 *
 * Interactivity: collapse and the mobile drawer lived in the deleted shell
 * script and are state below. The theme toggle binds through <ThemeToggle/>,
 * mounted in the layout, which delegates off `document` — so keep
 * `data-theme-toggle` on the button.
 *
 * NO DEAD CONTROLS IN THE CHROME. The topbar carried two: a `data-stub` Search
 * that swallowed every press (nothing reads `data-stub`) and an "EN" button
 * that flipped its own label and announced a language change no string ever
 * made. Search now goes to the search that exists; the language button is gone
 * until Paraglide (F-A20) gives it something to do.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@injishi/web-ui";
import { useSignOutAndLeave } from "@/components/auth/sign-out";
import { fetchMyThreads } from "@/data/inbox";
import { apiFetch } from "@/lib/api";
import { displayNameFrom, initialsFrom } from "@/lib/avatar";
import { useSessionUser, type SessionState } from "@/lib/session";
import { Icon } from "./icon";
import { NAV, PERSONAL, PRIMARY_CTA, resolveRoute } from "@/lib/app-nav";

/** The bell is ambient, so it asks less often than an open conversation does. */
const BELL_POLL_MS = 30_000;

/**
 * The bell, and it is a link.
 *
 * It used to open a dropdown listing notifications, which made notifications a
 * second place to read your mail. Move 4 collapsed messages and notifications
 * into one stream (D-g, AC-11), so the bell now goes where that stream lives.
 *
 * THE COUNT IS REAL: the sum of `unreadCount` across `GET /me/threads`, which
 * the server computes from `thread_reads` at read time. Asked once on mount,
 * again while the page is visible, and again on navigation — so a reply from
 * the front desk lights the bell on whatever screen the guest is on, and
 * opening a thread clears it on the way back rather than half a minute later.
 *
 * IT DEGRADES SILENTLY, in both directions. Only an `ok` answer moves the
 * number, so a failure or an expired session leaves the bell with no badge
 * rather than an error or a guess — the shell wraps every signed-in screen, and
 * a broken chrome takes all of them with it. Nothing here is awaited before the
 * shell renders, for the same reason.
 */
function useUnread(pathname: string): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const refresh = () => {
      void fetchMyThreads().then((result) => {
        if (result.status === "ok") {
          setUnread(result.data.reduce((sum, t) => sum + t.unreadCount, 0));
        }
      });
    };
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, BELL_POLL_MS);
    return () => window.clearInterval(timer);
  }, [pathname]);
  return unread;
}

/**
 * Whether this person rents a home through Injishi (`GET /me/context`, its tenancies), so the sidebar
 * offers My lease only to a tenant (2026-10-30). Quietly false until, or unless, the context answers.
 */
function useRentsAHome(): boolean {
  const [rents, setRents] = useState(false);
  useEffect(() => {
    void apiFetch<{ tenancies?: unknown[] }>("/api/v1/me/context").then((result) => {
      if (result.status === "ok") setRents((result.data.tenancies?.length ?? 0) > 0);
    });
  }, []);
  return rents;
}

function NotificationsLink({ unread }: { unread: number }) {
  const label =
    unread > 0
      ? `Inbox — ${unread} unread message${unread === 1 ? "" : "s"}`
      : "Inbox — messages and notifications";

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <a href="/inbox" aria-label={label}>
        <Icon name="bell" className="h-5 w-5" />
        {/* `aria-hidden`: the count is already in the link's own label, and
            read twice it sounds like two different numbers. */}
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold leading-none text-accent-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </a>
    </Button>
  );
}

/**
 * Who the shell says you are.
 *
 * Three states, and the render honours all three. Until the session answers we
 * know nothing, and the only honest thing to show is a placeholder — putting a
 * name there, whether a fixture or the last user seen, is exactly the bug this
 * replaced, where everyone was greeted as someone else until the round-trip
 * finished. `unknown` is kept separate from `pending` because a signed-out
 * visitor is not loading, and a skeleton that pulses forever says otherwise.
 */
type ShellIdentity =
  | { state: "pending" }
  | { state: "known"; name: string; initials: string }
  | { state: "unknown" };

function shellIdentity({ status, user }: SessionState): ShellIdentity {
  if (status === "loading") return { state: "pending" };
  if (status !== "authenticated") return { state: "unknown" };
  return {
    state: "known",
    name: displayNameFrom(user?.name, user?.email),
    initials: initialsFrom(user?.name, user?.email),
  };
}

const identityName = (me: ShellIdentity) => (me.state === "known" ? me.name : "");
const identityInitials = (me: ShellIdentity) =>
  me.state === "known" ? me.initials : "";

/** The name slot: a pulse while asking, a plain statement once we know. */
function IdentityName({ me, width }: { me: ShellIdentity; width: number }) {
  if (me.state === "known") return <>{me.name}</>;
  if (me.state === "unknown") {
    return <span className="font-normal opacity-60">Not signed in</span>;
  }
  return (
    <span
      aria-hidden
      className="block animate-pulse rounded bg-current opacity-20"
      style={{ width, height: "0.7em" }}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  // The route IS the shell state, and every route here is a plain path
  // (ADR-018, D-f), so no page declares its own shell props.
  const pathname = usePathname() ?? "";
  const { active, title, mainClass } = resolveRoute(pathname);
  // One session lookup for the whole shell: the name beside the avatar and the
  // sign-out control are the same fact asked once.
  const session = useSessionUser();
  const me = shellIdentity(session);
  const { signingOut, signOutAndLeave } = useSignOutAndLeave(session.signOut);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = useUnread(pathname);
  const rentsAHome = useRentsAHome();
  // My home only for a tenant; the inbox item carries the bell's own unread count.
  const sections = NAV.filter((section) => section.label !== "My home" || rentsAHome).map((section) => ({
    ...section,
    items: section.items.map((item) => (item.href === "/inbox" && unread > 0 ? { ...item, count: unread } : item)),
  }));

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="app-canvas flex h-screen">
      <aside
        id="sidebar"
        data-workspace="personal"
        className={`fixed inset-y-0 left-0 z-40 ${
          mobileOpen ? "flex" : "hidden"
        } w-72 shrink-0 flex-col transition-[width] duration-200 lg:static lg:flex${
          collapsed ? " collapsed" : ""
        }`}
        aria-label="Workspace navigation"
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <a href="/" className="flex items-center gap-2" aria-label="Injishi — home">
            <span className="sb-logo-short hidden h-8 w-8 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/shared/img/injishi-short.svg" alt="" className="h-8 w-auto dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/shared/img/injishi-short-white.svg"
                alt=""
                className="hidden h-8 w-auto dark:block"
              />
            </span>
            <span className="sb-label">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/shared/img/injishi-extended.svg"
                alt="Injishi"
                className="h-7 w-auto dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/shared/img/injishi-extended-white.svg"
                alt="Injishi"
                className="hidden h-7 w-auto dark:block"
              />
            </span>
          </a>
        </div>

        <div className="px-3">
          {/* Who you are, not a switcher. There is one Personal workspace per
              person and Broker lives in the operator app, so a control offering
              to switch would offer nothing (ADR-018, move 4, step 8). */}
          <div className="sb-switch">
            <span
              id="ws-avatar"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card font-display text-sm font-bold ${PERSONAL.tone}`}
            >
              {identityInitials(me)}
            </span>
            <span className="sb-label min-w-0 grow">
              <span id="ws-name" className="block truncate text-sm font-semibold">
                <IdentityName me={me} width={96} />
              </span>
              <span id="ws-kind" className="block truncate text-xs" style={{ color: "var(--sb-muted)" }}>
                {session.user?.email ?? PERSONAL.kindLabel}
              </span>
            </span>
          </div>
          {/* The shared primary Button, not a `.sb-cta` rule of its own: the
              sidebar's main action is the same control as the marketplace
              header's (ADR-037 call 3). `.sb-cta` only carries the margin and
              the collapsed state now. */}
          <Button asChild variant="primary" fullWidth className="sb-cta justify-start gap-3">
            <a href={PRIMARY_CTA.href}>
              <Icon name={PRIMARY_CTA.icon} className="h-4.5 w-4.5 shrink-0" />
              <span className="sb-label">{PRIMARY_CTA.label}</span>
            </a>
          </Button>
        </div>

        <nav className="mt-3 grow scrollbar overflow-y-auto px-3 pb-4" aria-label="Sections">
          {sections.map((section) => (
            <div key={section.label} className="mb-3">
              <p className="px-3 pb-1 pt-2 text-2xs font-bold uppercase text-muted-foreground sb-label tracking-widest">
                {section.label}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.href === active;
                  return (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className={`nav-item${isActive ? " nav-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                        <span className="sb-label">{item.label}</span>
                        {item.count ? <span className="sb-label sb-count">{item.count}</span> : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div
          className="shrink-0 space-y-1 border-t p-3"
          style={{ borderColor: "var(--sb-border)" }}
        >
          {/* Explore stays is the sidebar's own button at the top; it is not repeated here. */}
          <a href="/support" className="nav-item">
            <Icon name="circle-help" className="h-5 w-5 shrink-0" />
            <span className="sb-label">Support</span>
          </a>
          {/* This was `<a href="/sign-in">`, which signed nobody out: it walked
              somebody to a screen that would have let them straight back in,
              session intact. It is the same sign-out the header menu performs
              (`useSignOutAndLeave`), pending state and acknowledgement included. */}
          <Button
            variant="ghost"
            shape="square"
            className="nav-item h-auto w-full justify-start px-0 font-normal"
            aria-label={signingOut ? "Signing out" : "Sign out"}
            pending={signingOut}
            onClick={signOutAndLeave}
          >
            <Icon name="log-out" className="h-5 w-5 shrink-0" />
            <span className="sb-label">{signingOut ? "Signing out…" : "Sign out"}</span>
          </Button>
          {/* `.nav-item` is kept and the button box dropped (`h-auto`,
              `shape="square"`, no padding of its own): this control has to sit
              in the sidebar's nav rhythm, not read as a button parked in it. */}
          <Button
            variant="ghost"
            shape="square"
            id="collapse-btn"
            className="nav-item h-auto w-full justify-start px-0 font-normal"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <Icon name="panel-left" className="h-5 w-5 shrink-0" />
            <span className="sb-label">Collapse</span>
          </Button>
        </div>
      </aside>

      <div
        id="sidebar-backdrop"
        className={`fixed inset-0 z-30 ${mobileOpen ? "" : "hidden "}bg-ink/60 backdrop-blur-sm lg:!hidden`}
        onClick={() => setMobileOpen(false)}
      />

      <div className="app-panel flex min-w-0 grow flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            id="sidebar-open"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1
              id="page-title"
              className="font-display text-lg font-bold leading-tight tracking-tight"
            >
              {title}
            </h1>
            {/* The person's name was printed under every page title; the sidebar and the avatar already
                say who is signed in, so the title stands alone. */}
          </div>
          <span className="grow" />
          {/* It was a `data-stub` button that swallowed every press in silence.
              Nothing reads `data-stub`, and nothing was ever going to: a control
              that does nothing is worse than no control. It goes where the search
              that exists lives, and says which search that is. */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden min-w-52 justify-start gap-2 bg-card text-muted-foreground lg:inline-flex"
          >
            <a href="/explore">
              <Icon name="search" className="h-4 w-4" />
              Search stays
            </a>
          </Button>

          <NotificationsLink unread={unread} />

          {/* The "EN" button is GONE, not restyled. It flipped its own label to
              "RW" and announced "Kinyarwanda active" while swapping no strings
              at all (see `app-behaviors.tsx`) — a control that lies about the
              language of the page it is on. It comes back with Paraglide
              (F-A20), wired to something real. */}
          <Button variant="ghost" size="icon" data-theme-toggle aria-label="Toggle dark mode">
            <Icon name="moon" className="h-5 w-5 dark:hidden" />
            <Icon name="sun" className="hidden h-5 w-5 dark:block" />
          </Button>
          <a
            href="/account"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-accent-foreground"
            aria-label={identityName(me) ? `Account — ${identityName(me)}` : "Account"}
          >
            {identityInitials(me)}
          </a>
        </header>

        <main id="content" className={mainClass}>
          {children}
        </main>
      </div>

      </div>
    </>
  );
}
