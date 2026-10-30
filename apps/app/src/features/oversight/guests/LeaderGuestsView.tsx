"use client";

import { type LeaderGuest, type LeaderGuestPage, tidyPlaceName } from "@injishi/contracts";
import {
  ActionLink,
  DataTable,
  EmptyBlock,
  IconAction,
  PageContent,
  PersonCell,
  StatusDot,
  type TableFilter,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { GuestPanel } from "./GuestPanel";
import { ChainDots, GuestStatusChip, phoneWords, stayRange } from "./parts";

/**
 * The local leader's guest list (P5, 2026-10-30): every guest in their area in one table, with a stay
 * filter (all by default), the place inside their post, where guests come from, and a search, all in the
 * address so the API filters the list and the CSV alike. A row opens the guest in a side panel, which
 * marks it seen; Flag asks for a note there. The API decides the area: nothing here widens it.
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
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("guest");
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const { counts, filters } = page;
  const wide = filters.sectors.length > 0 || filters.cells.length > 0 || filters.villages.length > 0;
  const nationality = params.get("nationality");
  const origin = params.get("origin");
  const stay = page.tab === "arriving" && page.when === "later" ? "later" : page.tab;
  const place = params.get("villageId")
    ? `v:${params.get("villageId")}`
    : params.get("cellId")
      ? `c:${params.get("cellId")}`
      : params.get("sectorId")
        ? `s:${params.get("sectorId")}`
        : "all";

  const tableFilters: TableFilter<LeaderGuest>[] = [
    {
      id: "stay",
      name: "Stay",
      options: [
        { id: "all", label: "All" },
        { id: "arriving", label: "Arriving in 7 days", count: counts.arriving },
        { id: "later", label: "Arriving later", count: counts.later },
        { id: "staying", label: "Staying now", count: counts.staying },
        { id: "left", label: "Left", count: counts.left },
        { id: "flagged", label: "Flagged", count: counts.flagged },
      ],
      value: stay,
      onChange: (k) =>
        k === "later" ? go({ tab: "arriving", when: "later" }) : go({ tab: k === "all" ? null : k, when: null }),
    },
    ...(wide
      ? [
          {
            id: "place",
            name: "Place",
            icon: "MapPin" as const,
            options: [
              { id: "all", label: "All" },
              ...filters.sectors.map((x) => ({ id: `s:${x.id}`, label: `${tidyPlaceName(x.name)} sector` })),
              ...filters.cells.map((x) => ({ id: `c:${x.id}`, label: `${tidyPlaceName(x.name)} cell` })),
              ...filters.villages.map((x) => ({ id: `v:${x.id}`, label: `${tidyPlaceName(x.name)} village` })),
            ],
            value: place,
            onChange: (k: string) =>
              go({
                sectorId: k.startsWith("s:") ? k.slice(2) : null,
                cellId: k.startsWith("c:") ? k.slice(2) : null,
                villageId: k.startsWith("v:") ? k.slice(2) : null,
              }),
          },
        ]
      : []),
    {
      id: "from",
      name: "From",
      icon: "Globe",
      options: [
        { id: "all", label: "All" },
        { id: "nationals", label: "Rwanda" },
        { id: "international", label: "Abroad" },
        ...(filters.nationalities ?? [])
          .filter((n) => n.code !== "RW")
          .map((n) => ({ id: `nat:${n.code}`, label: n.name, count: n.count })),
      ],
      value: nationality ? `nat:${nationality}` : (origin ?? "all"),
      onChange: (k) =>
        k.startsWith("nat:")
          ? go({ nationality: k.slice(4), origin: null })
          : go({ origin: k === "all" ? null : k, nationality: null }),
    },
  ];

  return (
    <PageContent>
      <AreaHeader />
      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable<LeaderGuest>
          label="Guests"
          noun={{ one: "guest", many: "guests" }}
          rows={page.guests}
          rowKey={(g) => g.id}
          onRowAction={setOpen}
          search={{
            placeholder: "Name, phone or ID",
            value: search,
            onChange: (v) => {
              setSearch(v);
              if (typing.current) clearTimeout(typing.current);
              typing.current = setTimeout(() => go({ q: v.trim() || null }), 350);
            },
          }}
          filters={tableFilters}
          onClearFilters={() => {
            setSearch("");
            go({
              q: null,
              tab: null,
              when: null,
              sectorId: null,
              cellId: null,
              villageId: null,
              origin: null,
              nationality: null,
            });
          }}
          toolbarEnd={
            <ActionLink href={exportHref} icon="ArrowDownToLine" size="sm" prefetch={false}>
              Export CSV
            </ActionLink>
          }
          pages={{
            page: page.page,
            pageSize: page.pageSize,
            total: page.total,
            onPageChange: (p) => go({ page: String(p) }),
          }}
          empty={<EmptyBlock icon="PersonPlus" title="No guests in your area yet" />}
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
              header: "Dates",
              sortValue: (g) => g.arrivalOn,
              cell: (g) => (
                <div className="flex flex-col text-sm">
                  <span className="whitespace-nowrap tabular">{stayRange(g.arrivalOn, g.departureOn)}</span>
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
                        <span className="truncate">{g.home.villageName ? tidyPlaceName(g.home.villageName) : "-"}</span>
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
              header: "Shared with",
              hideBelow: "xl",
              cell: (g) => <ChainDots chain={g.chain} />,
            },
            { id: "status", header: "Status", cell: (g) => <GuestStatusChip guest={g} /> },
          ]}
          rowActions={(g) => <IconAction icon="Eye" label={`Open ${g.fullName}`} onPress={() => setOpen(g)} />}
          mobile={{
            title: (g) => g.fullName,
            description: (g) => `${stayRange(g.arrivalOn, g.departureOn)} · ${g.host.name}`,
            trailing: (g) => <GuestStatusChip guest={g} />,
          }}
        />
      </div>
      {open ? <GuestPanel guest={open} onClose={() => setOpen(null)} /> : null}
    </PageContent>
  );
}
