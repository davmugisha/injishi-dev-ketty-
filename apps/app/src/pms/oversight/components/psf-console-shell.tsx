"use client";

/**
 * The PSF officer console's frame (2026-10-19).
 *
 * Who is acting, at which level, over which place, and the four things the
 * console does: the Overview (the report), the Queue (the job), Decisions
 * (what was decided) and Businesses (the register).
 *
 * THE PLACE SWITCHER. A district officer covers one district and sees it
 * named. A province officer (Kigali City) and a national officer cover many:
 * the switcher narrows every screen to one province or one district inside
 * the region, and the choice rides in the url (`?district=103`), so a link to
 * a district's queue is a link to that district's queue.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Banknote, Building2, ChevronDown, ClipboardCheck, Inbox, LayoutDashboard, LogOut, MapPin, ScrollText, Shapes } from "lucide-react";

import type { PsfOfficerScope } from "@injishi/contracts";
import { Toaster } from "../../legacy-ui";

import { API_BASE, getJson } from "../../data/api";
import { useSignOut } from "../../data/sign-out";
import { initials } from "../../lib/format";
import { useShownToasts, type QueuedToast } from "../../lib/toast-queue";
import { fetchPsfScope, fetchPsfSummaryIn, type PsfArea } from "../data/psf-console";
import { CONSOLE_BASE } from "../lib/nav";
import { useOfficerAccess } from "./officer-boundary";

/** WorkspaceShell portal paths (same chrome as /officer). */
export const PSF_CONSOLE = {
  overview: `/psf/report`,
  queue: `/psf`,
  decisions: `/psf/decisions`,
  businesses: `/psf/register`,
  subtypes: `/psf/subtypes`,
  fees: `/psf/fees`,
} as const;

interface ConsoleCtx {
  scope: PsfOfficerScope | null;
  area: PsfArea;
  /** The place the screen is narrowed to, in words: "Gasabo district", "Kigali City". */
  areaLabel: string;
  setArea: (next: PsfArea) => void;
  /** Ask the nav's queue count again, after a decision. */
  refreshCount: () => void;
}
const Ctx = createContext<ConsoleCtx | null>(null);

export function usePsfConsole(): ConsoleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePsfConsole outside PsfConsoleShell");
  return ctx;
}

const LEVEL_LABEL: Record<PsfOfficerScope["level"], string> = {
  country: "National",
  province: "Province",
  district: "District",
  sector: "Sector",
  cell: "Cell",
  village: "Village",
};

function readArea(params: URLSearchParams): PsfArea {
  const d = Number(params.get("district"));
  const p = Number(params.get("province"));
  return { ...(d > 0 ? { district: d } : {}), ...(p > 0 && !(d > 0) ? { province: p } : {}) };
}

export function PsfConsoleShell({
  title,
  lede,
  toasts: queued = [],
  actions,
  children,
  /** When true, only provide console context (for WorkspaceShell pages). */
  embedded = false,
}: {
  title: string;
  lede?: string;
  toasts?: readonly QueuedToast[];
  actions?: ReactNode;
  children: ReactNode;
  embedded?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { signOut, signingOut } = useSignOut();
  const access = useOfficerAccess();
  const grant = access?.membership ?? null;
  /** KYB registration desk for the same posting (district dual-hat). */
  const holdsRegistration = (access?.consoles ?? []).some((c) => c === "verifier" || c === "approver");
  const toasts = useShownToasts(queued);

  const [scope, setScope] = useState<PsfOfficerScope | null>(null);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  /** The signed-in person — not the government body on the grant. */
  const [actor, setActor] = useState<{ name: string; email: string | null }>({
    name: "Membership officer",
    email: null,
  });
  const area = useMemo(() => readArea(new URLSearchParams(params.toString())), [params]);
  const me = { name: actor.name, ini: initials(actor.name) };

  useEffect(() => {
    void fetchPsfScope().then((r) => r.outcome === "ok" && setScope(r.data));
  }, []);
  useEffect(() => {
    void fetchPsfSummaryIn(area).then((r) => r.outcome === "ok" && setWaiting(r.data.waiting));
  }, [area, tick]);
  useEffect(() => {
    let live = true;
    void (async () => {
      // Better Auth session first (has users.name from the seed); profile as fallback.
      try {
        const res = await fetch(`${API_BASE}/api/auth/get-session`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const body = (await res.json()) as { user?: { name?: string | null; email?: string | null } } | null;
          const name = body?.user?.name?.trim();
          const email = body?.user?.email?.trim() ?? null;
          if (live && name) {
            setActor({ name, email });
            return;
          }
        }
      } catch {
        // Fall through to profile.
      }
      const profile = await getJson<{ fullName?: string | null; email?: string | null }>("/me/profile");
      if (!live || profile.outcome !== "ok") return;
      const name = profile.data.fullName?.trim();
      if (name) setActor({ name, email: profile.data.email?.trim() ?? null });
    })();
    return () => {
      live = false;
    };
  }, []);

  const setArea = useCallback(
    (next: PsfArea) => {
      const p = new URLSearchParams(params.toString());
      p.delete("district");
      p.delete("province");
      p.delete("cursor");
      if (next.district) p.set("district", String(next.district));
      else if (next.province) p.set("province", String(next.province));
      const s = p.toString();
      router.replace(`${pathname}${s ? `?${s}` : ""}`);
    },
    [params, pathname, router],
  );

  const districts = scope?.provinces.flatMap((p) => p.districts.map((d) => ({ ...d, province: p }))) ?? [];
  const areaLabel = area.district
    ? `${districts.find((d) => d.id === area.district)?.name ?? "This"} district`
    : area.province
      ? (scope?.provinces.find((p) => p.id === area.province)?.name ?? "This province")
      : (scope?.label ?? grant?.scopeLabel ?? "Your region");

  const query = params.toString() ? `?${new URLSearchParams([...params.entries()].filter(([k]) => k === "district" || k === "province")).toString()}` : "";
  const nav = [
    { href: PSF_CONSOLE.overview, label: "Overview", icon: LayoutDashboard, count: null },
    { href: PSF_CONSOLE.queue, label: "Membership", icon: Inbox, count: waiting },
    // Dual-hat: open KYB registrations in the WorkspaceShell portal (same as /officer/delegated).
    ...(holdsRegistration
      ? [{ href: "/officer", label: "Registrations", icon: ClipboardCheck, count: null as number | null }]
      : []),
    { href: PSF_CONSOLE.decisions, label: "Decisions", icon: ScrollText, count: null },
    { href: PSF_CONSOLE.businesses, label: "Businesses", icon: Building2, count: null },
    { href: PSF_CONSOLE.subtypes, label: "Subtypes", icon: Shapes, count: null },
    { href: PSF_CONSOLE.fees, label: "Fees", icon: Banknote, count: null },
  ];
  const ctx: ConsoleCtx = { scope, area, areaLabel, setArea, refreshCount: () => setTick((t) => t + 1) };
  const many = scope ? scope.level !== "district" || districts.length > 1 : false;

  const placeSwitcher =
    scope && many ? (
      <label className="relative inline-flex items-center">
        <span className="sr-only">Narrow to a place</span>
        <MapPin size={15} aria-hidden className="pointer-events-none absolute left-3 text-muted-foreground" />
        <select
          value={area.district ? `d:${area.district}` : area.province ? `p:${area.province}` : ""}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(":");
            setArea(kind === "d" ? { district: Number(id) } : kind === "p" ? { province: Number(id) } : {});
          }}
          className="h-9 appearance-none rounded border border-input bg-card pl-8 pr-9 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All of {scope.label}</option>
          {scope.provinces.map((p) =>
            scope.level === "country" ? (
              <optgroup key={p.id} label={p.name}>
                <option value={`p:${p.id}`}>All of {p.name}</option>
                {p.districts.map((d) => (
                  <option key={d.id} value={`d:${d.id}`}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              p.districts.map((d) => (
                <option key={d.id} value={`d:${d.id}`}>
                  {d.name}
                </option>
              ))
            ),
          )}
        </select>
        <ChevronDown size={15} aria-hidden className="pointer-events-none absolute right-3 text-muted-foreground" />
      </label>
    ) : null;

  if (embedded) {
    return (
      <Ctx.Provider value={ctx}>
        <div className="flex flex-col gap-4">
          {(actions || placeSwitcher) && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions}
              {placeSwitcher}
            </div>
          )}
          {children}
        </div>
        <Toaster toasts={toasts} />
      </Ctx.Provider>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="pms-root light flex-col bg-background text-foreground lg:flex-row">
        <a href="#psf-console-content" className="pms-skip">
          Skip to content
        </a>

        {/* ── The rail ───────────────────────────────────────────── */}
        <aside className="flex shrink-0 flex-col gap-5 border-b border-line px-4 py-4 lg:h-full lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-5">
          <div className="flex items-center gap-3 px-1">
            <span className="flex size-9 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm">
              <BadgeCheck size={20} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">Private Sector Federation</p>
              <p className="text-xs text-muted-foreground">Membership console</p>
            </div>
          </div>

          <div className="overflow-hidden rounded border border-line bg-card shadow-sm">
            <div className="flex items-start gap-3 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {me.ini}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-snug text-ink">{me.name}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {scope?.title ?? grant?.title ?? "PSF membership officer"}
                  {actor.email ? <span className="block truncate font-normal opacity-80">{actor.email}</span> : null}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-hover/50 py-1.5 pl-3 pr-1.5">
              <MapPin size={13} aria-hidden className="shrink-0 text-accent-text" />
              <p className="min-w-0 flex-1 truncate text-xs" title={scope ? `${LEVEL_LABEL[scope.level]} · ${scope.label}` : undefined}>
                <span className="font-semibold text-accent-text">{scope ? LEVEL_LABEL[scope.level] : "…"}</span>
                <span className="text-muted-foreground"> · {scope?.label ?? grant?.scopeLabel ?? ""}</span>
              </p>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                aria-label="Sign out"
                title="Sign out"
                className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <LogOut size={15} aria-hidden />
              </button>
            </div>
          </div>

          <nav aria-label="Membership console" className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col lg:overflow-visible">
            {nav.map((item) => {
              // An application's page belongs to the list it was opened from.
              const from = pathname.includes("/membership/applications/") ? (params.get("from") ?? "queue") : null;
              const on = from ? item.href.endsWith(`/membership/${from}`) : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${query}`}
                  aria-current={on ? "page" : undefined}
                  className={[
                    "flex shrink-0 items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
                    on ? "bg-accent-soft font-semibold text-accent-text" : "font-medium text-muted-foreground hover:bg-hover hover:text-foreground",
                  ].join(" ")}
                >
                  <item.icon size={17} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.count ? (
                    <span className="pms-num min-w-5 rounded-full bg-primary px-1.5 py-px text-center text-2xs font-bold text-primary-foreground">{item.count}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <p className="mt-auto hidden px-1 text-2xs leading-relaxed text-faint lg:block">
            Applications come from the public PSF form on Injishi. A business follows its own by docID.
          </p>
        </aside>

        {/* ── The work ───────────────────────────────────────────── */}
        {/* `.pms-root` is a viewport-high box that never scrolls, so the work does. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-line bg-background/85 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="min-w-0">
              <h1 className="pms-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin size={14} aria-hidden /> {areaLabel}
                {lede ? <span className="hidden sm:inline">· {lede}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {placeSwitcher}
            </div>
          </header>
          <main id="psf-console-content" className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>

        <Toaster toasts={toasts} />
      </div>
    </Ctx.Provider>
  );
}
