"use client";

import { Bars, BellDot, CircleQuestion, Comments, Magnifier } from "@gravity-ui/icons";
import { Kbd } from "@heroui/react";
import { AppLayout, Navbar, Sidebar } from "@heroui-pro/react";
import { type NavGroup, type Persona, screenByPath, screenHref, type TopbarStatus } from "@injishi/data";
import { Icon, LinkButton } from "@injishi/ui";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { BrandMark } from "../brand";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { TopbarStatusPill, TopbarStatusProvider } from "./TopbarStatus";
import { UserMenu } from "./UserMenu";

function NavMenu({
  groups,
  current,
  idPrefix = "",
}: {
  groups: NavGroup[];
  current: string | undefined;
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
                href={screenHref(item.board)}
                isCurrent={current === item.board}
                textValue={item.label}
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

/** Desktop app shell for operator, institution and Injishi staff workspaces (artifact: .ij-app). */
export function WorkspaceShell({ persona, nav, children }: { persona: Persona; nav: NavGroup[]; children: ReactNode }) {
  const pathname = usePathname();
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
  const pills = (topbar?.pills ?? []).map((p, i) => overrides[i] ?? p);

  // ⌘K / Ctrl+K opens global search, as the artifact's search field advertises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push(screenHref("GlobalSearch"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const header = (
    <Sidebar.Header className="gap-2">
      <NextLink
        href="/"
        className="flex items-center gap-2.5 px-1.5 py-1 text-foreground no-underline"
        aria-label="Injishi prototype hub"
      >
        <BrandMark size={28} />
        <span className="text-[15px] font-semibold" data-sidebar="label">
          Injishi
        </span>
      </NextLink>
      <BusinessSwitcher persona={persona} />
    </Sidebar.Header>
  );

  const sidebar = (
    <>
      <Sidebar aria-label="Workspace navigation">
        {header}
        <Sidebar.Content>
          <NavMenu groups={nav} current={current} />
        </Sidebar.Content>
        <Sidebar.Footer>
          <UserMenu persona={persona} />
        </Sidebar.Footer>
      </Sidebar>
      <Sidebar.Mobile>
        {header}
        <Sidebar.Content>
          <NavMenu groups={nav} current={current} idPrefix="m-" />
        </Sidebar.Content>
        <Sidebar.Footer>
          <UserMenu persona={persona} />
        </Sidebar.Footer>
      </Sidebar.Mobile>
    </>
  );

  const navbar = (
    <Navbar maxWidth="full" className="border-b border-separator">
      <Navbar.Header className="gap-2 px-3 sm:px-5">
        <AppLayout.MenuToggle aria-label="Open navigation">
          <Bars className="size-4" />
        </AppLayout.MenuToggle>
        <LinkButton
          href={screenHref("GlobalSearch")}
          variant="tertiary"
          className="h-9 min-w-0 max-w-[420px] flex-[1_1_260px] justify-start gap-2 rounded-xl px-3 text-[13px] font-normal text-muted"
          aria-label={topbar?.search ?? "Search"}
        >
          <Magnifier className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{topbar?.search ?? "Search…"}</span>
          <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
        </LinkButton>
        <Navbar.Spacer />
        <div className="hidden items-center gap-2 lg:flex" data-topbar-status="">
          {pills.map((p, i) => (
            <TopbarStatusPill key={`${i}-${p.label}`} status={p} />
          ))}
        </div>
        {topbar?.assistant !== false ? (
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
        <LinkButton
          href={screenHref("Notifications")}
          variant="ghost"
          isIconOnly
          aria-label={`Notifications, ${topbar?.notifications ?? 0} unread`}
          title={`Notifications, ${topbar?.notifications ?? 0} unread`}
        >
          <BellDot className="size-4" />
        </LinkButton>
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
      sidebarCollapsible="offcanvas"
      scrollMode="page"
      className="workspace-shell"
    >
      <div className="min-w-0">
        <TopbarStatusProvider value={setOverride}>{children}</TopbarStatusProvider>
      </div>
    </AppLayout>
  );
}
