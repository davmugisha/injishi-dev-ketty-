"use client";

import {
  ArrowRightFromSquare,
  Bars,
  Box,
  ChartColumn,
  ChevronsExpandVertical,
  Clock,
  Cup,
  House,
  LayoutCells,
  Person,
  Sliders,
  Tag,
  Xmark,
} from "@gravity-ui/icons";
import { Toast } from "@heroui/react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { OwnershipInbox } from "@/features/owner/OwnershipInbox";
import { signOut } from "@/lib/auth-actions";
import type { PosOutlet } from "@/server/pos";
import { stationKindsAction } from "./actions";
import { type StationKind, stationsName } from "./outlet-type";
import { PaymentUpdates } from "./payment-updates";
import { POS_BOARDS, type PosBoard } from "./pos-boards";
import { initialsOf, usePosMe } from "./pos-me";
import "./pos-fonts.css";
import "./pos-theme.css";

type Icon = ComponentType<{ className?: string; width?: number; height?: number }>;

/** Station kinds per outlet, read once per page load of the app (they change only in Setup). */
const KINDS = new Map<string, Promise<StationKind[] | null>>();
function useStationKinds(outletId: string): Set<StationKind> | null {
  const [kinds, setKinds] = useState<Set<StationKind> | null>(null);
  useEffect(() => {
    if (!outletId) return setKinds(null);
    let live = true;
    if (!KINDS.has(outletId))
      KINDS.set(
        outletId,
        stationKindsAction(outletId).catch(() => null),
      );
    KINDS.get(outletId)?.then((k) => live && setKinds(k ? new Set(k) : null));
    return () => {
      live = false;
    };
  }, [outletId]);
  return kinds;
}

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
 * While the screen a pill opens is still on its way, the pill shows a small turning mark: the current screen stays
 * in place (never a grey placeholder) and the person sees their press was taken. `data-pending` names the state.
 */
function NavPending({ rail }: { rail: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      data-pending={pending}
      aria-hidden="true"
      className={`pos-spinner ${pending ? "" : "invisible"} ${rail ? "absolute top-1 right-1 xl:static" : "ml-auto"}`}
    />
  );
}

/**
 * The one frame of every POS screen (all but the kitchen display, which is a wall screen of its own), in the Injishi
 * UI kit's taste: a grey frame holding the sidebar (brand, the outlet card, the screens this person's permissions
 * open as grey pills with a white pill for the current one, and who is signed in, with Sign out) and one rounded
 * panel with the screen's title, its own actions and its content.
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
  const [switching, startSwitching] = useTransition();
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
  // "Kitchen and bar" becomes "Kitchen" or "Bar" when the outlet has only one of them.
  const stationKinds = useStationKinds(outletId);
  const labelOf = (n: (typeof NAV)[number]) => (n.board === "PosStations" ? stationsName(stationKinds) : n.label);
  const withOutlet = (path: string) => `${path}${outletId ? `?outlet=${outletId}` : ""}`;
  const go = (value: string) =>
    startSwitching(() => {
      if (!value) return router.push(switchHref);
      router.push(`${switchHref}${switchHref.includes("?") ? "&" : "?"}outlet=${value}`);
    });
  const leave = () => startLeaving(() => signOut());
  const outletName = outlet?.name ?? "All outlets";

  const outletSelect = (
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
  );

  /** `rail` is the slim tablet sidebar: icons only, the words kept for screen readers and tooltips. */
  const sidebar = (rail: boolean) => {
    const words = rail ? "sr-only xl:not-sr-only" : "";
    return (
      <nav aria-label="Point of sale" className="flex h-full flex-col overflow-y-auto px-4 pt-5 pb-4 xl:px-5">
        <div className={`flex min-h-10 items-center gap-2 px-1 ${rail ? "justify-center xl:justify-start" : ""}`}>
          {/* biome-ignore lint/performance/noImgElement: a small brand mark needs no image optimisation */}
          <img
            src="/brand/injishi-mark.png"
            alt=""
            width={34}
            height={34}
            className={`size-[34px] shrink-0 rounded-[10px] ${rail ? "xl:hidden" : "hidden"}`}
          />
          <div className={`min-w-0 ${words}`}>
            {/* biome-ignore lint/performance/noImgElement: the brand wordmark is a small static SVG */}
            <img
              src="/brand/injishi-logo-green.svg"
              alt="Injishi"
              width={116}
              height={35}
              className="h-[30px] w-auto"
            />
            <p className="mt-1 pl-0.5 text-[12px] text-muted">Bar &amp; Restaurant POS</p>
          </div>
        </div>

        <div
          data-ui="outlet-card"
          className={`pos-side-card relative mt-5 flex items-center gap-3 ${
            rail ? "hidden xl:flex xl:h-[63px] xl:pr-3 xl:pl-3.5" : "h-[63px] pr-3 pl-3.5"
          }`}
        >
          <span className="pos-tile size-[37px] text-[16px]" aria-hidden="true">
            {outletName.trim().charAt(0).toUpperCase() || "O"}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14.5px] text-foreground">{outletName}</span>
            <span className="mt-[3px] block truncate text-[12.5px] text-muted">
              {outlet ? (outlet.branchName ?? "Outlet") : "Every outlet you cover"}
            </span>
          </span>
          {outlets.length > 1 ? (
            <>
              {switching ? (
                <span className="pos-spinner" aria-hidden="true" />
              ) : (
                <ChevronsExpandVertical width={16} height={16} className="shrink-0 text-muted" />
              )}
              {outletSelect}
            </>
          ) : null}
        </div>

        <div className={`mt-4 h-px bg-separator ${rail ? "mx-auto w-8 xl:mx-0 xl:w-auto" : ""}`} />

        {GROUPS.map((g) => {
          const items = allowed.filter((n) => n.group === g.key);
          if (!items.length) return null;
          return (
            <section key={g.key} className={`mt-5 flex flex-col gap-1 ${rail ? "items-center xl:items-stretch" : ""}`}>
              <p className={`pos-section pb-1 ${words}`}>{g.label}</p>
              {items.map((n) => {
                const ItemIcon = n.icon;
                const current = n.board === board;
                return (
                  <Link
                    key={n.board}
                    href={withOutlet(POS_BOARDS[n.board].href)}
                    aria-current={current ? "page" : undefined}
                    title={rail ? labelOf(n) : undefined}
                    onClick={() => setOpen(false)}
                    className={`pos-pill ${rail ? "w-11 justify-center px-0 xl:w-full xl:justify-start xl:pr-3.5 xl:pl-3" : "w-full"}`}
                  >
                    <ItemIcon width={17} height={17} />
                    <span className={`truncate ${words}`}>{labelOf(n)}</span>
                    <NavPending rail={rail} />
                  </Link>
                );
              })}
            </section>
          );
        })}

        <span className="min-h-4 flex-1" />

        {me ? (
          <div className={`border-t border-separator pt-4 ${rail ? "-mx-1 xl:mx-0" : ""}`}>
            <div
              data-ui="user-card"
              className={`flex items-center gap-3 rounded-[14px] px-1.5 ${rail ? "flex-col xl:flex-row" : ""}`}
            >
              <span className="pos-avatar size-[38px] text-[13px]" aria-hidden="true">
                {initialsOf(me.name)}
              </span>
              <div className={`min-w-0 flex-1 leading-tight ${words}`}>
                <p className="truncate text-[14.5px] text-foreground">{me.name}</p>
                <p className="mt-[3px] truncate text-[12.5px] text-muted">{me.role}</p>
              </div>
              <button
                type="button"
                aria-label="Sign out"
                title="Sign out (switch user)"
                disabled={leaving}
                onClick={leave}
                className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                {leaving ? (
                  <span className="pos-spinner" aria-hidden="true" />
                ) : (
                  <ArrowRightFromSquare width={17} height={17} />
                )}
              </button>
            </div>
          </div>
        ) : null}
      </nav>
    );
  };

  return (
    <div className="pos-ui relative flex h-full">
      <aside data-ui="pos-sidebar" className="hidden shrink-0 md:block md:w-[84px] xl:w-[272px]">
        {sidebar(true)}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside
            data-ui="pos-sidebar"
            className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] bg-[var(--pos-side)] shadow-xl"
          >
            <button
              type="button"
              aria-label="Close menu"
              ref={closeButton}
              className="absolute top-4 right-3 z-10 flex size-9 items-center justify-center rounded-[10px] text-muted hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              <Xmark width={18} height={18} />
            </button>
            {sidebar(false)}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pos-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header
            data-ui="pos-topbar"
            className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 md:px-7 md:pt-6 md:pb-5"
          >
            <button
              ref={burger}
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              className="flex size-10 items-center justify-center rounded-[10px] border border-[var(--pos-ctl-border)] bg-surface text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:bg-[#fbfbfb] md:hidden"
              onClick={() => setOpen(true)}
            >
              <Bars width={18} height={18} />
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate text-[22px] leading-7 font-bold tracking-[-0.025em] md:text-[26px] md:leading-8">
                {title}
              </h1>
              {subtitle ? <p className="mt-0.5 truncate text-[13.5px] text-muted">{subtitle}</p> : null}
            </div>
            {/* On a tablet the sidebar is an icon rail with no room for the outlet card, so the picker sits here. */}
            {outlets.length > 1 ? (
              <div className="relative hidden h-10 max-w-[200px] items-center gap-2 rounded-[10px] border border-[var(--pos-ctl-border)] bg-surface pr-8 pl-2 text-[13.5px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.05)] md:flex xl:hidden">
                <span className="pos-tile size-6 text-[11px]" aria-hidden="true">
                  {outletName.trim().charAt(0).toUpperCase() || "O"}
                </span>
                <span className="truncate">{outletName}</span>
                <ChevronsExpandVertical width={14} height={14} className="absolute right-2.5 text-muted" />
                {outletSelect}
              </div>
            ) : null}
            {actions ? <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">{actions}</div> : null}
          </header>
          {/* A request to make this person an owner, on whatever screen they are on (decided in its own dialog). */}
          <OwnershipInbox />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
      {/* The waiter's live news: a payment on one of their bills that the cashier confirmed, on every screen. */}
      {/* `waiter`: only for someone who takes orders but not payment; for cashiers the cards stay as they were. */}
      {outletId && can.includes("pos.sell") ? (
        <PaymentUpdates outletId={outletId} outlets={outlets} waiter={!can.includes("pos.checkout")} />
      ) : null}
      {/* Every action on these screens answers in a toast (success, or the API's own reason for a refusal). */}
      <Toast.Provider placement="bottom" />
    </div>
  );
}
