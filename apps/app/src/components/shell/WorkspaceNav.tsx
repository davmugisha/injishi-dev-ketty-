"use client";

import { type NavGroup, navHref, navPlace, screenByPath } from "@injishi/data";
import { AreaTabs, ErrorBlock, PageContent, PageHeader } from "@injishi/ui";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, use } from "react";

const NavContext = createContext<NavGroup[]>([]);

/** The sidebar of this workspace, for the page headers that name their area and show its tabs. */
export function WorkspaceNavProvider({ groups, children }: { groups: NavGroup[]; children: ReactNode }) {
  return <NavContext value={groups}>{children}</NavContext>;
}

/** The sidebar item this page belongs to, and the tab it is, from the person's own sidebar. */
export function useArea() {
  const groups = use(NavContext);
  const pathname = usePathname();
  const board = screenByPath(pathname)?.board;
  const place = navPlace(groups, board);
  return { place, pathname };
}

/**
 * The header of a page in a sidebar area: the area's name as the title, the page's actions, and the
 * area's pages as tabs (Units, Leases, Faults, Move-outs). The same on every role. A page outside any
 * area names itself with `title`.
 */
export function AreaHeader({
  title,
  eyebrow,
  description,
  actions,
  size,
}: {
  /** @default the sidebar item's label */
  title?: ReactNode;
  eyebrow?: ReactNode;
  /** A short status, never an explanation of the page. */
  description?: ReactNode;
  actions?: ReactNode;
  size?: "hello" | "title";
}) {
  const { place, pathname } = useArea();
  const tabs = place?.item.tabs ?? [];
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title ?? place?.item.label ?? ""}
      description={description}
      actions={actions}
      size={size}
      tabs={
        tabs.length > 1 ? (
          <AreaTabs
            label={place?.item.label ?? "Pages"}
            selectedId={place?.tab?.id ?? null}
            tabs={tabs.map((t) => ({
              id: t.id,
              label: t.label,
              href: navHref(t.board, pathname),
              count: t.chip ? Number(t.chip) : undefined,
            }))}
          />
        ) : undefined
      }
    />
  );
}

/** A page of an area that failed to load: its header and tabs stay, with what failed and a Retry. */
export function AreaError({
  heading,
  title,
  onRetry,
}: {
  /** The page's name, when it is in no sidebar area. */
  heading?: string;
  title: string;
  onRetry: () => void;
}) {
  const { place } = useArea();
  return (
    <PageContent>
      <AreaHeader title={place ? undefined : heading} />
      <ErrorBlock title={title} onRetry={onRetry} />
    </PageContent>
  );
}
