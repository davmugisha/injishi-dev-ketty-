"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Eye,
  Globe,
  MapPin,
  Menu,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { Badge, Button } from "@injishi/ui";
import { useEffect, useRef, useState } from "react";
import { DISTRICTS, MOCK_TODAY, NAV_ITEMS } from "@/lib/nav";
import { useAdminUi } from "@/lib/store";
import type { DistrictKey } from "@/lib/types";
import { notBuilt } from "@/lib/not-built";

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open, close]);
  return ref;
}

function DistrictFilter() {
  const [open, setOpen] = useState(false);
  const district = useAdminUi((s) => s.district);
  const setDistrict = useAdminUi((s) => s.setDistrict);
  const toast = useAdminUi((s) => s.toast);
  const ref = useClickOutside(open, () => setOpen(false));

  const current = DISTRICTS.find((d) => d.key === district);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm"
       
        
        aria-expanded={open}
        aria-haspopup="true"
        /* The label is the button's name on a phone, where the text is hidden
           to keep the five topbar actions on one 375px row. */
        aria-label={`Filter by district — ${current?.key === "all" ? "All districts" : current?.label} selected`}
        onClick={() => setOpen((o) => !o)}
      >
        <MapPin className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">
          {current?.key === "all" ? "All districts" : current?.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </Button>
      {open && (
        <div
          className="absolute right-0 top-11 z-50 w-56 rounded-card border border-border bg-background p-2 shadow-2xl"
          role="menu"
          aria-label="Filter by district"
        >
          {DISTRICTS.map((d) => (
            /* A menu ITEM, not a button: it stays raw because HeroUI's Button
               takes no `role`, and a menu's roving focus and arrow keys belong
               to its `Menu` component rather than to a row of buttons. */
            <button
              key={d.key}
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted ${
                d.key === "all" ? "font-semibold" : ""
              }`}
              onClick={() => {
                setDistrict(d.key as DistrictKey);
                setOpen(false);
                // Says what actually follows the filter. It used to claim
                // "every widget follows", when only the overview's density list
                // reads it; a staffer trusting that would read platform-wide
                // numbers elsewhere as one district's.
                toast(
                  d.key === "all"
                    ? "Showing every district again."
                    : `The overview's density list now highlights ${d.label}. Other sections still show every district.`,
                );
              }}
            >
              {d.label}
              {d.seeding && <Badge variant="default">seeding</Badge>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The alerts bell, honest about having nothing to say.
 *
 * It used to open on "3 unread" and three typed-in alarms — a growing
 * dead-letter queue, a money override awaiting signature, an overdue filing —
 * none of them read from anywhere. A staffer cannot tell an invented alarm
 * from a real one, so every invented one teaches them to ignore the bell. No
 * alert feed exists yet, so there is no badge and the panel says so.
 */
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon"
        className="relative"
        aria-label="Alerts"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-5 w-5" aria-hidden />
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] animate-settle-in rounded-card border border-border bg-background p-4 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Alerts
          </p>
          {/* Not "nothing needs you": with no feed behind it, the bell cannot
              know that, and false calm is the other half of a false alarm. */}
          <p className="mt-2 text-sm font-semibold">No alerts are connected yet.</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Alerts from the platform will land here once they are. Until then,
            System health and each section show their own state.
          </p>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  return (
    <Button variant="ghost" size="icon"
     
      
      aria-label="Toggle dark mode"
      onClick={() => {
        const dark = document.documentElement.classList.toggle("dark");
        try {
          localStorage.setItem("injishi-theme", dark ? "dark" : "light");
        } catch {
          /* storage unavailable — theme stays per-page */
        }
      }}
    >
      <Moon className="h-5 w-5 dark:hidden" aria-hidden />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden />
    </Button>
  );
}

function LangToggle() {
  const [lang, setLang] = useState<"EN" | "RW">("EN");
  return (
    <Button variant="ghost" size="sm"
     
      className="hidden sm:inline-flex"
      aria-label={`Switch language — ${lang === "EN" ? "English" : "Kinyarwanda"} active`}
      onClick={() => setLang((l) => (l === "EN" ? "RW" : "EN"))}
    >
      <Globe className="h-4 w-4" aria-hidden />
      <span>{lang}</span>
    </Button>
  );
}

export function Topbar({ onMobileOpen }: { onMobileOpen: () => void }) {
  const pathname = usePathname();
  const viewAs = useAdminUi((s) => s.viewAs);
  const endViewAs = useAdminUi((s) => s.endViewAs);
  const toast = useAdminUi((s) => s.toast);

  const title =
    NAV_ITEMS.find((i) => pathname.startsWith(`/${i.key}`))?.label ?? "Overview";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <Button variant="ghost" size="icon"
         
          id="admin-nav-toggle"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onMobileOpen}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold leading-tight tracking-tight">{title}</h1>
          <span className="money block truncate text-xs text-muted-foreground">{MOCK_TODAY}</span>
        </div>
        <span className="grow" />
        <Button variant="primary"
         
          className="hidden min-w-52 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground lg:inline-flex"
          aria-label="Search orgs, users, money"
          onClick={() => toast(notBuilt("Global search"))}
        >
          <Search className="h-4 w-4" aria-hidden />
          Search
        </Button>
        <DistrictFilter />
        <NotificationsBell />
        <LangToggle />
        <ThemeToggle />
        <Button variant="primary"
         
          className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-bold text-white"
          /* eslint-disable-next-line injishi/no-raw-color-classes --
           * FLAGGED, not blessed. A two-stop gradient needs two RAMP steps and
           * the semantic roles are each a single value, so `var(--accent)` (what
           * the rule suggests) would collapse this to a flat fill. ADR-027 §8
           * closed the raw-ramp loophole precisely because ramps are the route
           * back to brand green, and this avatar is that route. The real fix is
           * a named gradient role in `@injishi/design-tokens`; until the design
           * system owner decides, this is the one site in the console holding a
           * ramp variable and it is recorded here rather than hidden by lowering
           * the rule for the whole app. */
          style={{ background: "linear-gradient(140deg, var(--green-400), var(--green-600))" }}
          aria-label="Account — Samuel Kayitare, Super Admin"
        >
          SK
        </Button>
      </header>

      {/* Impersonation banner (F-A13) — persistent while a view-as session is active */}
      {viewAs && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-warning px-4 py-2 text-sm font-semibold text-warning-foreground sm:px-6"
          role="status"
        >
          <Eye className="h-4 w-4" aria-hidden />
          <span>Viewing as {viewAs}</span>
          {/* No expiry countdown: it was a static "14:59" that never moved,
              and no session exists yet for it to count down. */}
          <span className="text-xs font-normal opacity-90">
            read-only · dual-attributed
          </span>
          <span className="grow" />
          <Button variant="primary" size="sm"
           
            className="bg-white/20 text-warning-foreground hover:bg-white/30"
            onClick={() => {
              endViewAs();
              toast(notBuilt("A view-as support session"));
            }}
          >
            End session
          </Button>
        </div>
      )}
    </>
  );
}
