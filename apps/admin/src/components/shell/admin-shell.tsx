"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { RoleLensDialog } from "./role-lens-dialog";
import { OverrideDialog } from "./override-dialog";
import { Toaster } from "@injishi/ui";
import { useAdminUi } from "@/lib/store";

/**
 * The control-tower chrome: sidebar, topbar, shared dialogs, toasts.
 *
 * The staff gate is no longer inside this file. `StaffBoundary` became a server
 * component (ADR-029) and `app/layout.tsx` now composes the two — gate outside,
 * chrome inside — so the chrome is still behind the gate but the decision is
 * taken before any of it exists. A client component cannot host that gate: the
 * check would be back in the browser, painting the sidebar it is meant to
 * withhold.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}

function AdminChrome({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // The shared Toaster takes its list as a prop and knows no store (ADR-040
  // call 3); this selector is the whole of the coupling, and it stays here.
  const toasts = useAdminUi((s) => s.toasts);
  const pathname = usePathname();

  /*
   * Escape closes the nav drawer.
   *
   * Below 1024px the sidebar is an overlay covering the console, and the only
   * way out was a click on the exact strip of scrim beside it. That is a trap
   * for anyone on a keyboard, and Escape is what every other overlay here
   * already answers to.
   */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  /*
   * A section change closes it too. The nav rows close it themselves, but the
   * wordmark, a breadcrumb and the back button all navigate without going
   * through one, and each left the drawer sitting over the section it opened.
   */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="app-canvas flex h-screen">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="app-panel flex min-w-0 grow flex-col">
          <Topbar onMobileOpen={() => setMobileOpen(true)} />
          <main id="content" className="min-h-0 grow scrollbar overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      <RoleLensDialog />
      <OverrideDialog />
      <Toaster toasts={toasts} />
    </>
  );
}
