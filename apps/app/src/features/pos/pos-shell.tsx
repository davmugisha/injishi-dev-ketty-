"use client";

import {
  ArrowRightFromSquare,
  Bars,
  Box,
  ChartColumn,
  ChevronDown,
  Clock,
  Cup,
  House,
  LayoutCells,
  MapPin,
  Person,
  Sliders,
  Tag,
  Xmark,
} from "@gravity-ui/icons";
import { Toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { signOut } from "@/lib/auth-actions";
import type { PosOutlet } from "@/server/pos";
import { POS_BOARDS, type PosBoard } from "./pos-boards";
import { initialsOf, usePosMe } from "./pos-me";

type Icon = ComponentType<{ className?: string; width?: number; height?: number }>;

/** Each screen, where it sits in the sidebar and the permissions any one of which opens it (the API still decides). */
const NAV: { board: PosBoard; label: string; icon: Icon; any: string[]; group: "run" | "manage" | "configure" }[] = [
  { board: "PosDashboard", label: "Dashboard", icon: House, any: ["shift.review", "money.view"], group: "manage" },
  {
    board: "PosFloor",
    label: "Floor and tables",
    icon: LayoutCells,
    any: ["pos.sell", "table.manage", "pos.checkout"],
    group: "run",
  },
  { board: "PosStations", label: "Kitchen and bar", icon: Cup, any: ["kitchen.work", "pos.sell"], group: "run" },
  { board: "PosShift", label: "Cashier desk", icon: Clock, any: ["register.operate", "shift.review"], group: "run" },
  {
    board: "PosCustomers",
    label: "Customers",
    icon: Person,
    any: ["customer.view", "customer.manage"],
    group: "run",
  },
  {
    board: "PosMenu",
    label: "Menu",
    icon: Tag,
    any: ["pos.sell", "pos.checkout", "menu.manage"],
    group: "manage",
  },
  { board: "PosStock", label: "Stock", icon: Box, any: ["stock.manage", "shift.review"], group: "manage" },
  { board: "PosReports", label: "Reports", icon: ChartColumn, any: ["shift.review", "money.view"], group: "manage" },
  { board: "PosSetup", label: "Setup", icon: Sliders, any: ["outlet.manage"], group: "configure" },
];

const GROUPS: { key: "run" | "manage" | "configure"; label: string }[] = [
  { key: "manage", label: "Overview" },
  { key: "run", label: "Service" },
  { key: "configure", label: "Configure" },
];

/**
 * The one frame of every POS screen (all but the kitchen display, which is a wall screen of its own): a sidebar with
 * the brand, the outlet, the screens this person's permissions open and who is signed in (with Sign out), and a
 * header with the screen's title and its own actions.
 *
 * A desk gets the full sidebar; a tablet a slim icon rail, so the till and the floor keep their width; a phone a
 * drawer behind a menu button, so nothing is ever squeezed.
 */
export function PosShell({
  board,
  title,
  subtitle,
  outlet,
  outlets,
  outletId,
  switchHref,
  allOutlets,
  can,
  actions,
  children,
}: {
  board: PosBoard;
  title: string;
  subtitle?: string;
  outlet: { name: string; branchName: string | null } | null;
  outlets: PosOutlet[];
  /** The outlet the sidebar links carry (`?outlet=`); empty when every outlet is in view. */
  outletId: string;
  /** Where the outlet picker goes: the current screen's path (with any other query already in it). */
  switchHref: string;
  /** Offer "All outlets" (the dashboard and the reports can total several). */
  allOutlets?: boolean;
  can: string[];
  /** Controls for the right of the header. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const me = usePosMe();
  const [open, setOpen] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const burger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Closing the drawer returns the keyboard to the button that opened it.
      burger.current?.focus();
    };
  }, [open]);

  const allowed = NAV.filter((n) => n.board === board || n.any.some((p) => can.includes(p)));
  const withOutlet = (path: string) => `${path}${outletId ? `?outlet=${outletId}` : ""}`;
  const go = (value: string) => {
    if (!value) return router.push(switchHref);
    router.push(`${switchHref}${switchHref.includes("?") ? "&" : "?"}outlet=${value}`);
  };
  const leave = () => startLeaving(() => signOut());

  /** `rail` is the slim tablet sidebar: icons only, the words kept for screen readers and tooltips. */
  const sidebar = (rail: boolean) => {
    const words = rail ? "sr-only xl:not-sr-only" : "";
    return (
      <nav aria-label="Point of sale" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
        <div className={`flex items-center gap-2.5 px-1 ${rail ? "justify-center xl:justify-start" : ""}`}>
          {/* biome-ignore lint/performance/noImgElement: a 36px brand mark needs no image optimisation */}
          <img src="/brand/injishi-mark.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-xl" />
          <div className={`min-w-0 ${words}`}>
            <p className="text-[16px] leading-5 font-bold tracking-tight">Injishi</p>
            <p className="text-[11px] font-medium text-muted">Bar &amp; Restaurant POS</p>
          </div>
        </div>

        <div className={rail ? "hidden xl:block" : ""}>
          <p className="px-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Outlet</p>
          <div className="relative flex items-center gap-2.5 rounded-2xl border border-separator bg-background/60 p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
              <MapPin width={18} height={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-4 font-semibold">{outlet?.name ?? "All outlets"}</p>
              <p className="truncate text-[11px] text-muted">{outlet?.branchName ?? "Every outlet you cover"}</p>
            </div>
            {outlets.length > 1 ? (
              <>
                <ChevronDown width={16} height={16} className="shrink-0 text-muted" />
                <select
                  aria-label="Outlet"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={outletId}
                  onChange={(e) => go(e.target.value)}
                >
                  {allOutlets ? <option value="">All outlets</option> : null}
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.branchName ? ` · ${o.branchName}` : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
        </div>

        {GROUPS.map((g) => {
          const items = allowed.filter((n) => n.group === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key} className="flex flex-col gap-1">
              <p className={`px-1 pb-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase ${words}`}>
                {g.label}
              </p>
              {items.map((n) => {
                const ItemIcon = n.icon;
                const current = n.board === board;
                return (
                  <Link
                    key={n.board}
                    href={withOutlet(POS_BOARDS[n.board].href)}
                    aria-current={current ? "page" : undefined}
                    title={rail ? n.label : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors ${
                      rail ? "justify-center xl:justify-start" : ""
                    } ${
                      current
                        ? "bg-accent text-accent-foreground shadow-[0_6px_16px_-8px_var(--accent)]"
                        : "text-foreground/80 hover:bg-default hover:text-foreground"
                    }`}
                  >
                    <ItemIcon width={19} height={19} className="shrink-0" />
                    <span className={`truncate ${words}`}>{n.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}

        <span className="flex-1" />

        {me ? (
          <div
            data-ui="user-card"
            className={`flex items-center gap-2.5 rounded-2xl border border-separator bg-background/60 p-2.5 ${
              rail ? "flex-col xl:flex-row" : ""
            }`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-soft-foreground">
              {initialsOf(me.name)}
            </span>
            <div className={`min-w-0 flex-1 ${words}`}>
              <p className="truncate text-[13px] leading-4 font-semibold">{me.name}</p>
              <p className="truncate text-[11px] text-muted">{me.role}</p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out (switch user)"
              disabled={leaving}
              onClick={leave}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <ArrowRightFromSquare width={17} height={17} />
            </button>
          </div>
        ) : null}
      </nav>
    );
  };

  return (
    <div className="relative flex h-full bg-background">
      <aside
        data-ui="pos-sidebar"
        className="hidden shrink-0 border-r border-separator bg-surface md:block md:w-[84px] xl:w-64"
      >
        {sidebar(true)}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <aside
            data-ui="pos-sidebar"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-separator bg-surface shadow-xl"
          >
            <button
              type="button"
              aria-label="Close menu"
              ref={closeButton}
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-default"
              onClick={() => setOpen(false)}
            >
              <Xmark width={18} height={18} />
            </button>
            {sidebar(false)}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header data-ui="pos-topbar" className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 md:px-6 md:pt-5">
          <button
            ref={burger}
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            className="flex size-10 items-center justify-center rounded-xl border border-separator bg-surface text-foreground hover:bg-default md:hidden"
            onClick={() => setOpen(true)}
          >
            <Bars width={18} height={18} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-[22px] leading-7 font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="truncate text-[13px] text-muted">{subtitle}</p> : null}
          </div>
          {/* On a tablet the sidebar is an icon rail with no room for the outlet card, so the picker sits here. */}
          {outlets.length > 1 ? (
            <label className="relative hidden h-10 max-w-[170px] items-center gap-2 rounded-xl border border-separator bg-surface pr-8 pl-3 text-[13px] font-medium md:flex xl:hidden">
              <MapPin width={16} height={16} className="shrink-0 text-accent" />
              <span className="truncate">{outlet?.name ?? "All outlets"}</span>
              <ChevronDown width={14} height={14} className="absolute right-3 text-muted" />
              <select
                aria-label="Outlet"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={outletId}
                onChange={(e) => go(e.target.value)}
              >
                {allOutlets ? <option value="">All outlets</option> : null}
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.branchName ? ` · ${o.branchName}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {actions ? <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">{actions}</div> : null}
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
      {/* Every action on these screens answers in a toast (success, or the API's own reason for a refusal). */}
      <Toast.Provider placement="bottom" />
    </div>
  );
}
