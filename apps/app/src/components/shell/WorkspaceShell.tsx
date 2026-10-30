"use client";

import { Bars, BellDot, CircleQuestion, Comments, Magnifier } from "@gravity-ui/icons";
import { Kbd } from "@heroui/react";
import { AppLayout, Navbar, Sidebar, useSidebar } from "@heroui-pro/react";
import {
  type BoardId,
  homeHref,
  type NavGroup,
  navHref,
  navPlace,
  type Persona,
  RENTALS_SEARCH,
  screenByPath,
  screenHref,
  type TopbarStatus,
} from "@injishi/data";
import { ActionLink, EmptyBlock, Icon, IconAction, LinkButton, PageContent } from "@injishi/ui";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { sampleCollectionsByBoard } from "@/lib/coverage.generated";
import { BrandMark } from "../brand";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { QuickSearch } from "./QuickSearch";
import { openToRealPeople } from "@/lib/real-screens";
import { SampleDataPill } from "./SampleData";
import { TopbarStatusPill, TopbarStatusProvider } from "./TopbarStatus";
import { UserMenu } from "./UserMenu";
import { WorkspaceNavProvider } from "./WorkspaceNav";

function NavMenu({
  groups,
  current,
  pathname,
  idPrefix = "",
}: {
  groups: NavGroup[];
  current: BoardId | undefined;
  pathname: string;
  idPrefix?: string;
}) {
  return (
    <>
      {groups.map((group, gi) => (
        <Sidebar.Group key={`${group.label ?? "main"}-${gi}`}>
          {group.label ? <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel> : null}
          <Sidebar.Menu aria-label={group.label ?? "Main"}>
            {group.items.map((item) => (
              <Sidebar.MenuItem
                key={item.id}
                id={`${idPrefix}${item.id}`}
                href={item.href ?? navHref(item.board, pathname)}
                isCurrent={
                  item.href
                    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                    : current === item.board || navPlace([group], current)?.item === item
                }
                textValue={item.label}
                tooltip={item.chip ? `${item.label} · ${item.chip}` : item.label}
              >
                <Sidebar.MenuIcon>
                  <Icon name={item.icon} />
                </Sidebar.MenuIcon>
                <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
                {item.chip ? (
                  <Sidebar.MenuChip
                    className={item.alert ? "font-semibold text-danger" : "font-semibold"}
                    aria-label={item.alert ? `${item.chip} need attention` : `${item.chip} items`}
                  >
                    {item.chip}
                  </Sidebar.MenuChip>
                ) : null}
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      ))}
    </>
  );
}

/**
 * People whose every screen reads their own records from the API (landlords, tenants, brokers, local
 * leaders and officers). Their top bar shows only what is real for them: no sample pills, no hotel search,
 * no assistant or notification counts drawn from the prototype's fixtures.
 */
const LIVE_PERSONAS = new Set<string>(["landlord", "tenant", "broker", "officer", "ops"]);
/** Personas whose screens must never draw sample data: a fixture-backed screen says it is not ready. */
const REAL_DATA_ONLY = new Set<string>(["officer", "ops", "psf"]);
const LIVE_SECTIONS = new Set<string>(["rentals", "tenant"]);

const SIDEBAR_KEY = "injishi.sidebar";

/** The sidebar's open state, remembered in this browser. */
function useRememberedSidebar(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_KEY) === "collapsed") setOpen(false);
    } catch {
      // Storage can be blocked; the sidebar then starts open.
    }
  }, []);
  const change = useCallback((next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(SIDEBAR_KEY, next ? "open" : "collapsed");
    } catch {
      // Not remembered, still toggled.
    }
  }, []);
  return [open, change];
}

/**
 * Collapse to an icon rail, or expand again: one icon button that always sits at the top of the sidebar
 * (beside the logo, or alone at the top of the rail), with ⌘B / Ctrl+B from anywhere. Not on a phone,
 * where the sidebar is a sheet.
 */
function CollapseToggle() {
  const { isOpen, toggleSidebar, isMobile } = useSidebar();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);
  if (isMobile) return null;
  return (
    <IconAction
      icon="LayoutSideContentLeft"
      label={isOpen ? "Collapse sidebar (⌘B)" : "Expand sidebar (⌘B)"}
      onPress={toggleSidebar}
      size="md"
      className="sidebar__collapse-btn size-9 shrink-0"
    />
  );
}

/** Desktop app shell for operator, institution and Injishi staff workspaces (artifact: .ij-app). */
export function WorkspaceShell({
  persona,
  nav,
  altNav,
  live: liveWorkspace = false,
  demo = false,
  children,
}: {
  persona: Persona;
  /**
   * The signed-in person is one of the demo's own people (2026-10-30). Only they see the registry's sample
   * pills, the "Sample data" chip and the fixture-backed search, assistant and notification count; a real
   * person sees what their own records say, whatever the database is marked.
   */
  demo?: boolean;
  nav: NavGroup[];
  /** Every screen of this workspace reads real records (a stay business): no sample pills or search. */
  live?: boolean;
  /** Another sidebar for the pages under `prefix` (a landlord reading their own home as a tenant). */
  altNav?: { prefix: string; nav: NavGroup[] } | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const groups = altNav && (pathname === altNav.prefix || pathname.startsWith(`${altNav.prefix}/`)) ? altNav.nav : nav;
  const router = useRouter();
  const screen = screenByPath(pathname);
  const topbar = screen?.topbar;
  const current = screen?.board;
  // A screen whose pill follows its own state replaces the registry's pill with <TopbarStatus slot={i}>.
  const [overrides, setOverrides] = useState<Record<number, TopbarStatus>>({});
  const setOverride = useCallback((slot: number, status: TopbarStatus | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (status) next[slot] = status;
      else delete next[slot];
      return next;
    });
  }, []);
  const live = liveWorkspace || LIVE_PERSONAS.has(persona.id) || LIVE_SECTIONS.has(screen?.section ?? "");
  // The top bar's demo furniture (registry pills, sample chip, fixture search, assistant, counts).
  const samples = demo && !live;
  // Otherwise a screen shows only the pills it sets itself (<TopbarStatus>), never the registry's samples.
  const pills = samples ? (topbar?.pills ?? []).map((p, i) => overrides[i] ?? p) : Object.values(overrides);
  // The lists a live workspace can search: only its own, through its own sidebar.
  const searchable =
    live &&
    groups.some((g) =>
      g.items.some((i) =>
        [i.board, ...(i.tabs ?? []).map((t) => t.board)].some((b) => ["Leases", "Units", "Faults"].includes(b)),
      ),
    );
  const [sidebarOpen, setSidebarOpen] = useRememberedSidebar();

  // ⌘K / Ctrl+K opens global search, as the artifact's search field advertises. A live workspace's
  // quick search listens for it itself.
  useEffect(() => {
    if (!samples) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push(screenHref("GlobalSearch"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, samples]);

  const header = (
    <Sidebar.Header className="gap-2">
      <div className="flex items-center gap-1 in-[.sidebar[data-state=collapsed]]:flex-col-reverse in-[.sidebar[data-state=collapsed]]:gap-2">
        <NextLink
          // The person's own home: `/` is the marketplace on another host.
          href={homeHref(persona.id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1 text-foreground no-underline in-[.sidebar[data-state=collapsed]]:flex-none"
          aria-label="Injishi home"
        >
          <BrandMark size={28} />
          <span className="text-base font-semibold" data-sidebar="label">
            Injishi
          </span>
        </NextLink>
        <CollapseToggle />
      </div>
      <BusinessSwitcher persona={persona} />
    </Sidebar.Header>
  );

  const sidebar = (
    <>
      <Sidebar aria-label="Workspace navigation">
        {header}
        <Sidebar.Content>
          <NavMenu groups={groups} current={current} pathname={pathname} />
        </Sidebar.Content>
        <Sidebar.Footer className="gap-1">
          {/* Help is hidden for brokers for now (2026-10-27). */}
          {live && !searchable && persona.id !== "broker" ? (
            <LinkButton
              href={screenHref("PublicHelp")}
              variant="ghost"
              aria-label="Help"
              className="w-full justify-start gap-2.5 px-2.5 text-sm font-normal text-muted"
            >
              <Icon name="LifeRing" className="size-4 shrink-0" />
              <span data-sidebar="label">Help</span>
            </LinkButton>
          ) : null}
          <UserMenu persona={persona} />
        </Sidebar.Footer>
      </Sidebar>
      <Sidebar.Mobile>
        {header}
        <Sidebar.Content>
          <NavMenu groups={groups} current={current} pathname={pathname} idPrefix="m-" />
        </Sidebar.Content>
        <Sidebar.Footer>
          <UserMenu persona={persona} />
        </Sidebar.Footer>
      </Sidebar.Mobile>
    </>
  );

  const navbar = (
    // A live workspace with nothing to search has nothing for a top bar on a wide screen: the page starts
    // at the top and Help sits in the sidebar. Phones keep it for the menu button.
    <Navbar
      maxWidth="full"
      className={live && !searchable ? "border-b border-separator lg:hidden" : "border-b border-separator"}
    >
      <Navbar.Header className="gap-2 px-3 sm:px-5">
        <AppLayout.MenuToggle aria-label="Open navigation">
          <Bars className="size-4" />
        </AppLayout.MenuToggle>
        {searchable ? (
          <QuickSearch groups={groups} placeholder={RENTALS_SEARCH.replace(/…$/, "")} />
        ) : !samples ? null : (
          <LinkButton
            href={screenHref("GlobalSearch")}
            variant="tertiary"
            className="h-9 min-w-0 max-w-md flex-[1_1_260px] justify-start gap-2 rounded-xl px-3 text-sm font-normal text-muted"
            aria-label={topbar?.search ?? "Search"}
          >
            <Magnifier className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{topbar?.search ?? "Search…"}</span>
            <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
          </LinkButton>
        )}
        <Navbar.Spacer />
        {samples ? <SampleDataPill board={current} /> : null}
        <div className="hidden items-center gap-2 lg:flex" data-topbar-status="">
          {pills.map((p, i) => (
            <TopbarStatusPill key={`${i}-${p.label}`} status={p} />
          ))}
        </div>
        {samples && topbar?.assistant !== false ? (
          <LinkButton
            href={screenHref("Assistant")}
            variant="ghost"
            isIconOnly
            aria-label="Ask the Injishi assistant"
            title="Ask the Injishi assistant"
          >
            <Comments className="size-4" />
          </LinkButton>
        ) : null}
        {!samples ? null : (
          <LinkButton
            href={screenHref("Notifications")}
            variant="ghost"
            isIconOnly
            aria-label={`Notifications, ${topbar?.notifications ?? 0} unread`}
            title={`Notifications, ${topbar?.notifications ?? 0} unread`}
          >
            <BellDot className="size-4" />
          </LinkButton>
        )}
        <LinkButton href={screenHref("PublicHelp")} variant="ghost" isIconOnly aria-label="Help" title="Help">
          <CircleQuestion className="size-4" />
        </LinkButton>
      </Navbar.Header>
    </Navbar>
  );

  return (
    <AppLayout
      sidebar={sidebar}
      navbar={navbar}
      sidebarVariant="inset"
      sidebarCollapsible="icon"
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      scrollMode="page"
      className="workspace-shell"
    >
      <div className="min-w-0">
        <WorkspaceNavProvider groups={groups}>
          <TopbarStatusProvider value={setOverride}>
            {current &&
            (REAL_DATA_ONLY.has(persona.id)
              ? (sampleCollectionsByBoard[current] ?? 0) > 0
              : // A live screen (a rentals or stay business's) reads its own records.
                !demo && !live && !openToRealPeople(current)) ? (
              <PageContent>
                <EmptyBlock
                  icon="Database"
                  title="This screen is not connected to Injishi's records yet"
                  description="It would show sample figures, so it is closed until it reads real data."
                  action={
                    <ActionLink href={homeHref(persona.id)} icon="ArrowLeft">
                      Back
                    </ActionLink>
                  }
                />
              </PageContent>
            ) : (
              children
            )}
          </TopbarStatusProvider>
        </WorkspaceNavProvider>
      </div>
    </AppLayout>
  );
}
