"use client";

/**
 * The operator shell: the floating panel on a tinted canvas gutter that carries
 * the Injishi identity (blueprint §1.8 — keep the skin, fix the IA).
 *
 * A housekeeper is a different user on a different device, so a grant shaped
 * like one (room status and no front desk power, `opensOnPhoneSurface`) renders
 * the phone PWA instead of the desktop shell (blueprint §3.3). No role name
 * decides it (ADR-053, AC-A1). Everyone else gets sidebar + topbar + the screen.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Toaster } from "@injishi/ui";
import { useEffect, useMemo, type ReactNode } from "react";
import { useWorkspaceId } from "../data/capability";
import { allowedSegments, navFor, opensOnPhoneSurface, workspaceHome } from "../lib/nav";
import { navContextOf } from "../lib/nav-context";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { CheckInDrawer } from "./check-in-drawer";
import { CommandBar } from "./command-bar";
import { DemoGuide } from "./demo-guide/demo-guide";
import { HousekeeperPhone } from "./housekeeper-phone";
import { applyTheme } from "../lib/theme";
import { Icon } from "./icon";
import { MockBanner } from "./mock-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useShownToasts } from "../lib/toast-queue";

/**
 * Refused when a role opens a screen its nav does not grant (direct URL).
 *
 * IT IS NOT AN ALARM. This screen used to put a tick inside a red tile — a
 * check mark for a refusal, in the colour the app uses for money going wrong —
 * beside a button labelled "Back to safety", as if the operator had narrowly
 * escaped something. Nobody here has done anything wrong: they opened a screen
 * their role does not include, usually from an old link or somebody else's
 * handover note. A closed padlock on a plain tile says the same fact without
 * the adrenaline.
 */
function Unauthorized({ home }: { home: string }) {
  return (
    <div className="pms-enter" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 440, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: "var(--field)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
          <Icon name="lock" size={26} strokeWidth={1.6} />
        </span>
        <h2 className="pms-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>Not your section</h2>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          This screen isn&apos;t part of your role. If you need it, an owner or manager can add it to your role or department.
        </p>
        <Link href={home} style={{ marginTop: 4, border: "1px solid var(--card-bd)", background: "var(--card)", color: "var(--foreground)", borderRadius: "var(--radius-surface)", padding: "9px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Back to your workspace
        </Link>
      </div>
    </div>
  );
}

/**
 * The toast stack, from the store's queue.
 *
 * The shared `Toaster` replaces this app's own renderer (deleted with
 * `toasts.tsx`), which drew every message as the same ink pill with an 8px dot
 * in a status colour: a failure and a success were the same object, told apart
 * by a dot the size of a full stop. The shared one carries a distinct ICON
 * shape per tone, animates out instead of vanishing, and keeps its live region
 * mounted so the first message is announced.
 */
function ShellToasts() {
  const { state } = usePms();
  return <Toaster toasts={useShownToasts(state.toasts)} />;
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pms = usePms();
  const { state, host } = pms;
  const { navOpen, setNavOpen } = usePmsUi();
  const pathname = usePathname();
  // The workspace this screen acts in, read from the address bar (ADR-018,
  // invariant 1). Every link the nav builds is addressed inside it.
  const workspaceId = useWorkspaceId();
  // `dark` / `light`, the same two names `apps/web` and `apps/admin` use
  // (ADR-036 call 8). They used to be `th-dark` / `th-light`, which is why
  // `@custom-variant dark` could not be declared here and every `dark:` utility
  // in this app silently followed the operating system instead of this switch.
  const themeClass = state.theme === "dark" ? "dark" : "light";

  /*
   * Mirror the theme class onto <html>.
   *
   * Radix portals (Sheet, Dialog, DropdownMenu, Popover, Tooltip) render into
   * document.body — OUTSIDE `.pms-root`. Without this, none of the `--panel` /
   * `--ink` / `--scrim` custom properties reach them and every portalled
   * surface renders transparent. `.pms-root` no longer carries the class: the
   * html element does, and the boot script stamps it before hydration, so a
   * class rendered from server state here would only disagree with it. Since
   * the layout styles are scoped to it.
   */
  //
  // `applyTheme` also WRITES the choice to `localStorage["injishi-theme"]`,
  // the one key the whole origin reads (ADR-037 call 5). The operator app is a
  // zone under web's origin, so a theme kept only in this store was one site
  // with two memories: dark on /trips, light on /w/<id>/today.
  useEffect(() => {
    applyTheme(themeClass);
  }, [themeClass]);

  /*
   * Escape closes the nav drawer.
   *
   * An overlay that covers the whole screen and can only be dismissed by
   * hitting exactly the right strip of scrim is a trap for anyone on a
   * keyboard. Same key that closes the command bar and every sheet.
   */
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // A Radix layer that took the key (the sidebar's switcher menus) marks
      // it handled: that Escape closed a menu, not the drawer the menu sits in.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen, setNavOpen]);

  /*
   * A screen change closes it too. The nav links close it themselves, but the
   * command bar, a breadcrumb and the back button all navigate without going
   * through one, and each of those used to leave the drawer sitting over the
   * screen it had just opened.
   */
  useEffect(() => {
    setNavOpen(false);
  }, [pathname, setNavOpen]);

  // Route-access authz: a grant may open only the screens its own nav grants.
  // This is the enforcement behind the nav hiding — a receptionist typing
  // /host/revenue is refused, not just un-linked.
  // Built once per store change. `navFor` walks every reservation, room,
  // ticket, order and thread for its count pills, and this shell re-renders on
  // every pathname and drawer change, none of which move a count. Computed
  // before the phone surface's early return, so the hooks run in the same order
  // on every render whichever surface a grant opens.
  const navContext = useMemo(() => navContextOf(pms, workspaceId), [pms, workspaceId]);
  const sections = useMemo(() => navFor(navContext), [navContext]);
  const allowed = useMemo(() => allowedSegments(sections), [sections]);

  // The housekeeper surface is its own thing — no desktop chrome.
  if (opensOnPhoneSurface(navContext)) {
    return (
      <div className="pms-root">
        <HousekeeperPhone />
        {/* Above the phone's bottom tab bar on a real handset. */}
        <DemoGuide surface="operator" placement="raised" />
        <ShellToasts />
      </div>
    );
  }

  // The screen segment. Every route this app serves is `/w/<id>/<seg>` now
  // (ADR-018, AC-1), so the segment always sits at the same depth.
  const parts = pathname.split("/").filter(Boolean);
  const seg = parts[2];
  const authorized = !seg || allowed.has(seg);
  const home = workspaceHome(state.ws, workspaceId);

  return (
    <div className="pms-root">
      {/* Keyboard users otherwise tab the whole role nav on every screen before
          reaching the work. Matches the web and admin shells. */}
      <a href="#pms-content" className="pms-skip">
        Skip to content
      </a>
      <Sidebar />
      {/* Below 1024px the sidebar is an overlay, so it needs a way out that is
          not the nav itself. `.pms-scrim` is display:none above that width, so
          the desktop shell never renders a click-blocking layer. */}
      {navOpen && (
        <Button variant="ghost"
          className="pms-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      {/* Gutter, radius and border are `.pms-panel` in pms-tokens.css: on a
          phone the panel drops all three, which is 18px of width back. */}
      <div className="pms-panel">
        <Topbar title={authorized ? title : "Not authorized"} />
        {/* Which screens under this nav are still demo data (ADR-012, AC-12).
            Sits under the topbar so it is read once per screen, not once per
            row, and disappears on its own when the last screen migrates. */}
        <MockBanner sections={sections} />
        <main id="pms-content" className="pms-main">
          {authorized ? children : <Unauthorized home={home} />}
        </main>
      </div>

      <CommandBar />
      {/* Check-in / walk-in is a hospitality-only flow — the drawer reads the
          host property, which the landlord workspace does not have. */}
      {state.ws === "host" && <CheckInDrawer />}
      {/* Who this demo persona is and what to show next. Renders nothing off
          the demo, and nothing for an account the demo has no story for. */}
      <DemoGuide surface="operator" />
      <ShellToasts />
    </div>
  );
}
