"use client";

import { Card } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { type LeaderGuest, type LeaderGuestPage, tidyPlaceName } from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  DataTable,
  EmptyBlock,
  FilterTabs,
  formatDay,
  formatNumber,
  IconAction,
  KpiStrip,
  PageContent,
  PageHeader,
  PersonCell,
  SearchBar,
  StatusDot,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GuestFilters } from "./GuestFilters";
import { GuestPanel } from "./GuestPanel";
import { ChainDots, GuestStatusChip, phoneWords, ScopeLine } from "./parts";

/** The tabs of the console, Reports last (it is its own page). */
const TAB_LABEL = { arriving: "Arriving", staying: "Staying now", left: "Left", flagged: "Flagged" } as const;

const EMPTY: Record<string, { title: string; description: string }> = {
  arriving: {
    title: "Nobody arriving in the next 7 days",
    description: "Guests show here before they come.",
  },
  later: { title: "Nobody arriving later", description: "Guests due more than a week ahead show here." },
  staying: {
    title: "Nobody staying now",
    description: "From the day a guest arrives to the day they leave.",
  },
  left: { title: "No guests have left yet", description: "Guests who left in the last 12 months show here." },
  flagged: { title: "No flagged guests", description: "Flagged guests show here with the note." },
};

/**
 * The local leader's guest list (P5): the guests in their area by tab (Arriving in the next 7 days,
 * Staying now, Left, Flagged) with counts, narrowed by sector, cell or village when the post covers more
 * than one, searchable, and exported as CSV. A row opens the guest in a side panel, which marks it seen;
 * Flag asks for a note. The API decides the area: nothing here widens it.
 */
export function LeaderGuestsView({
  page,
  openGuest,
  exportHref,
}: {
  page: LeaderGuestPage;
  /** A guest named in the address (`?guest=`, from the email), opened on arrival. */
  openGuest: LeaderGuest | null;
  exportHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<LeaderGuest | null>(openGuest);

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("guest");
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { counts, filters } = page;
  const wide = filters.sectors.length > 0 || filters.cells.length > 0 || filters.villages.length > 0;
  const sectorId = params.get("sectorId");
  const cellId = params.get("cellId");
  const villageId = params.get("villageId");
  const origin = params.get("origin");
  const nationality = params.get("nationality");
  const nationalities = filters.nationalities ?? [];
  // The area the figures cover: the place chosen under Area, else the leader's own post.
  const chosen =
    filters.villages.find((v) => String(v.id) === villageId)?.name ??
    filters.cells.find((c) => String(c.id) === cellId)?.name ??
    filters.sectors.find((x) => String(x.id) === sectorId)?.name;
  const areaWords = chosen ? tidyPlaceName(chosen) : (page.scopes[0]?.area ?? "your area");
  const areaShort = areaWords.split(",")[0];
  // The API filters the page, its counts and the CSV by the same choices.
  const guests = page.guests;
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const emptyKey = page.tab === "arriving" && page.when === "later" ? "later" : page.tab;
  const narrowed = Boolean(sectorId || cellId || villageId || params.get("q") || origin || nationality);

  return (
    <PageContent>
      <PageHeader
        title="Guests in your area"
        description={<ScopeLine scopes={page.scopes} />}
        actions={
          <ActionLink href={exportHref} icon="ArrowDownToLine" prefetch={false}>
            Export CSV
          </ActionLink>
        }
      />

      <KpiStrip
        label={`Guests in ${areaWords}`}
        items={[
          {
            id: "arriving",
            label: "Arriving in 7 days",
            value: counts.arriving,
            format: "count",
            icon: "Calendar",
            spark: counts.arrivingByDay?.length ? counts.arrivingByDay : undefined,
            footnote: counts.later > 0 ? `${formatNumber(counts.later)} more later` : `None later in ${areaShort}`,
            href: "/officer/guests?tab=arriving",
            isCurrent: page.tab === "arriving",
          },
          {
            id: "staying",
            label: "Staying now",
            value: counts.staying,
            format: "count",
            icon: "House",
            spark: counts.stayingByDay?.length ? counts.stayingByDay : undefined,
            footnote:
              counts.staying > 0
                ? `${formatNumber(counts.staying - (counts.stayingForeign ?? 0))} Rwandan · ${formatNumber(counts.stayingForeign ?? 0)} foreign`
                : `Nobody in ${areaShort} today`,
            href: "/officer/guests?tab=staying",
            isCurrent: page.tab === "staying",
          },
          {
            id: "unseen",
            label: "Not opened yet",
            value: counts.unseen,
            format: "count",
            icon: "Eye",
            status: counts.unseen > 0 ? "warning" : undefined,
            progress:
              (counts.current ?? 0) > 0 ? (((counts.current ?? 0) - counts.unseen) / (counts.current ?? 1)) * 100 : 100,
            footnote:
              (counts.current ?? 0) > 0
                ? `${formatNumber((counts.current ?? 0) - counts.unseen)} of ${formatNumber(counts.current ?? 0)} opened`
                : "Nothing to open",
          },
          {
            id: "flagged",
            label: "Flagged",
            value: counts.flagged,
            format: "count",
            icon: "Flag",
            status: counts.flagged > 0 ? "danger" : undefined,
            footnote: counts.flagged > 0 ? "Need a closer look" : "None flagged",
            href: "/officer/guests?tab=flagged",
            isCurrent: page.tab === "flagged",
          },
        ]}
      />

      <Card className="min-w-0 gap-4 p-4">
        {/* The lists, then their filters, in one card. Reports have their own page in the sidebar. */}
        <FilterTabs
          label="Guests"
          selectedKey={page.tab}
          onSelectionChange={(key) => go({ tab: key, when: null })}
          tabs={[
            { id: "arriving", label: TAB_LABEL.arriving, count: counts.arriving },
            { id: "staying", label: TAB_LABEL.staying, count: counts.staying },
            { id: "left", label: TAB_LABEL.left, count: counts.left },
            { id: "flagged", label: TAB_LABEL.flagged, count: counts.flagged },
          ]}
        />
        <GuestFilters
          params={params}
          go={go}
          scopes={page.scopes}
          filters={filters}
          nationalities={nationalities}
          leading={
            page.tab === "arriving" ? (
              <Segment
                aria-label="When they arrive"
                size="sm"
                selectedKey={page.when}
                onSelectionChange={(k) => go({ when: String(k) === "later" ? "later" : null })}
              >
                <Segment.Item id="soon">Next 7 days</Segment.Item>
                <Segment.Item id="later">
                  Later<span className="tabular"> {formatNumber(counts.later)}</span>
                </Segment.Item>
              </Segment>
            ) : null
          }
          trailing={
            <SearchBar
              label="Search guests"
              placeholder="Name, phone or ID"
              defaultValue={params.get("q") ?? ""}
              onSubmit={(q) => go({ q: q.trim() || null })}
            />
          }
        />

        <DataTable<LeaderGuest>
          label={TAB_LABEL[page.tab]}
          rows={guests}
          rowKey={(g) => g.id}
          onRowAction={setOpen}
          empty={
            <EmptyBlock
              icon={page.tab === "flagged" ? "Flag" : "PersonPlus"}
              title={narrowed ? "No guests match" : EMPTY[emptyKey].title}
              description={
                narrowed ? "Clear the search or the place to see everyone in your area." : EMPTY[emptyKey].description
              }
              action={
                narrowed ? (
                  <ActionButton
                    icon="Xmark"
                    onPress={() =>
                      go({ q: null, sectorId: null, cellId: null, villageId: null, origin: null, nationality: null })
                    }
                  >
                    Clear filters
                  </ActionButton>
                ) : undefined
              }
            />
          }
          columns={[
            {
              id: "guest",
              header: "Guest",
              isRowHeader: true,
              sortValue: (g) => g.fullName,
              cell: (g) => (
                <div className="flex min-w-0 items-center gap-2">
                  {g.seenByMe ? null : <StatusDot tone="accent" className="shrink-0" />}
                  <PersonCell name={g.fullName} secondary={`${g.nationalityName} · ${phoneWords(g.phone)}`} />
                </div>
              ),
            },
            {
              id: "dates",
              header: page.tab === "left" ? "Stayed" : "Dates",
              sortValue: (g) => g.arrivalOn,
              cell: (g) => (
                <div className="flex flex-col text-sm">
                  <span className="tabular">
                    {formatDay(g.arrivalOn, "weekday")} to {formatDay(g.departureOn, "weekday")}
                  </span>
                  <span className="text-xs text-muted">
                    {g.nights === 0 ? "Same day" : g.nights === 1 ? "1 night" : `${g.nights} nights`}
                  </span>
                </div>
              ),
            },
            {
              id: "host",
              header: "Staying with",
              sortValue: (g) => g.host.name,
              cell: (g) => (
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="truncate">{g.host.name}</span>
                  <span className="truncate text-xs text-muted">
                    {g.home.unitLabel ? `Unit ${g.home.unitLabel}, ${g.home.propertyName}` : g.home.propertyName}
                  </span>
                </div>
              ),
            },
            ...(wide
              ? [
                  {
                    id: "area",
                    header: "Village",
                    hideBelow: "lg" as const,
                    sortValue: (g: LeaderGuest) => g.home.villageName ?? "",
                    cell: (g: LeaderGuest) => (
                      <div className="flex min-w-0 flex-col text-sm">
                        <span className="truncate">
                          {g.home.villageName ? tidyPlaceName(g.home.villageName) : "No village on record"}
                        </span>
                        {g.home.cellName ? (
                          <span className="truncate text-xs text-muted">{tidyPlaceName(g.home.cellName)} cell</span>
                        ) : null}
                      </div>
                    ),
                  },
                ]
              : []),
            {
              id: "chain",
              header: "Chain",
              hideBelow: "xl",
              cell: (g) => <ChainDots chain={g.chain} />,
            },
            { id: "status", header: "Status", cell: (g) => <GuestStatusChip guest={g} /> },
          ]}
          rowActions={(g) => <IconAction icon="Eye" label={`Open ${g.fullName}`} onPress={() => setOpen(g)} />}
          mobile={{
            title: (g) => g.fullName,
            description: (g) =>
              `${formatDay(g.arrivalOn, "weekday")} to ${formatDay(g.departureOn, "weekday")} · ${g.host.name}`,
            trailing: (g) => <GuestStatusChip guest={g} />,
          }}
        />

        {pages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span className="tabular">
              {formatNumber((page.page - 1) * page.pageSize + 1)} to{" "}
              {formatNumber(Math.min(page.total, page.page * page.pageSize))} of {formatNumber(page.total)}
            </span>
            <div className="flex gap-2">
              <ActionButton
                size="sm"
                icon="ChevronLeft"
                isDisabled={page.page <= 1}
                onPress={() => go({ page: String(page.page - 1) })}
              >
                Previous
              </ActionButton>
              <ActionButton
                size="sm"
                icon="ChevronRight"
                iconPlacement="end"
                isDisabled={page.page >= pages}
                onPress={() => go({ page: String(page.page + 1) })}
              >
                Next
              </ActionButton>
            </div>
          </div>
        ) : null}
      </Card>

      {open ? <GuestPanel guest={open} onClose={() => setOpen(null)} /> : null}
    </PageContent>
  );
}
