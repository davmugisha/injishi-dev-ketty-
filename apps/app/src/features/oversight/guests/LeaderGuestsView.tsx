"use client";

import {
  guestHostLines,
  ID_KIND_LABEL,
  type LeaderGuest,
  type LeaderGuestPage,
  tidyPlaceName,
} from "@injishi/contracts";
import { type DataColumn, DataTable, EmptyBlock, IconAction, PageContent, SearchBar } from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { DownloadMenu } from "./DownloadMenu";
import { AREA_KEYS, GUEST_FILTER_KEYS, GuestFilters, withFlag } from "./GuestFilters";
import { GuestPanel } from "./GuestPanel";
import { ChainDots, dayTime, GuestStatusChip, phoneWords, stayRange } from "./parts";

const nightsWords = (n: number): string => (n === 0 ? "Same day" : n === 1 ? "1 night" : `${n} nights`);

/** Where the guest stays: the place, then who hosted them there (the room, the tenant and unit, the landlord). */
function HostCell({ guest }: { guest: LeaderGuest }) {
  const lines = guestHostLines(guest);
  return (
    <div className="flex min-w-0 flex-col text-sm">
      <span className="truncate">{lines.place}</span>
      {lines.detail ? <span className="truncate text-xs text-muted">{lines.detail}</span> : null}
    </div>
  );
}

/** The guest's name, with the nationality and its flag under it (and the phone, for local government). */
function GuestCell({ guest, dgie }: { guest: LeaderGuest; dgie: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {guest.seenByMe ? null : (
        <span aria-hidden="true" className="block shrink-0 rounded-full bg-accent" style={{ width: 8, height: 8 }} />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{guest.fullName}</span>
        <span className="truncate text-xs text-muted">
          {withFlag(guest.nationality, guest.nationalityName)}
          {dgie || !guest.phone ? "" : ` · ${phoneWords(guest.phone)}`}
        </span>
      </div>
    </div>
  );
}

/**
 * The local leader's guest list (P5, 2026-11-02): every guest in their area in one table, filtered on the
 * server from one toolbar row (status, when they arrived, who was here on a day, who leaves, length of stay,
 * type of place, nationality, area, relationship) kept in the address, so the table and every download are
 * the same view and a view can be shared. Local government sees Rwandan and foreign guests; DGIE only those
 * from abroad, with the passport in place of the relationship. A row opens the guest in a side panel, which
 * marks it seen; Flag asks for a note there. The API decides the area: nothing here widens it.
 */
export function LeaderGuestsView({
  page,
  openGuest,
  today,
  downloads,
}: {
  page: LeaderGuestPage;
  /** A guest named in the address (`?guest=`, from the email), opened on arrival. */
  openGuest: LeaderGuest | null;
  today: string;
  downloads: { xlsx: string; pdf: string; csv: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<LeaderGuest | null>(openGuest);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dgie = page.audience === "dgie";

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("guest");
    if (!("page" in changes)) next.delete("page");
    if ("q" in changes && !changes.q) setSearch("");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const { counts, filters } = page;
  const wide = filters.sectors.length > 0 || filters.cells.length > 0 || filters.villages.length > 0;
  const stay = page.tab === "arriving" && page.when === "later" ? "later" : page.tab;
  const filtered =
    Boolean(params.get("q")) || stay !== "all" || [...GUEST_FILTER_KEYS, ...AREA_KEYS].some((k) => params.get(k));

  const guestColumn: DataColumn<LeaderGuest> = {
    id: "guest",
    header: "Guest",
    isRowHeader: true,
    sortValue: (g) => g.fullName,
    cell: (g) => <GuestCell guest={g} dgie={dgie} />,
  };
  const stayColumn: DataColumn<LeaderGuest> = {
    id: "dates",
    header: "Stay",
    sortValue: (g) => g.arrivalOn,
    cell: (g) => (
      <div className="flex flex-col text-sm">
        <span className="whitespace-nowrap tabular">{stayRange(g.arrivalOn, g.departureOn)}</span>
        <span className="text-xs text-muted">
          {nightsWords(g.nights)}
          {g.checkedInAt ? ` · in ${dayTime(g.checkedInAt)}` : ""}
        </span>
      </div>
    ),
  };
  const placeColumn: DataColumn<LeaderGuest> = {
    id: "placeType",
    header: "Type of place",
    sortValue: (g) => g.place.kindLabel,
    cell: (g) => <span className="text-sm">{g.place.kindLabel}</span>,
  };
  const hostColumn: DataColumn<LeaderGuest> = {
    id: "host",
    header: "Host",
    sortValue: (g) => g.place.name,
    cell: (g) => <HostCell guest={g} />,
  };
  const areaColumn: DataColumn<LeaderGuest> = {
    id: "area",
    header: "Village",
    hideBelow: "xl",
    sortValue: (g) => g.home.villageName ?? "",
    cell: (g) => (
      <div className="flex min-w-0 flex-col text-sm">
        <span className="truncate">{g.home.villageName ? tidyPlaceName(g.home.villageName) : "-"}</span>
        {g.home.cellName ? (
          <span className="truncate text-xs text-muted">{tidyPlaceName(g.home.cellName)} cell</span>
        ) : null}
      </div>
    ),
  };
  const statusColumn: DataColumn<LeaderGuest> = {
    id: "status",
    header: "Status",
    cell: (g) => <GuestStatusChip guest={g} />,
  };
  const documentColumn: DataColumn<LeaderGuest> = {
    id: "document",
    header: "Document",
    hideBelow: "lg",
    sortValue: (g) => g.idNumber ?? "",
    cell: (g) => (
      <div className="flex min-w-0 flex-col text-sm">
        <span className="truncate tabular">{g.idNumber ?? "Not given"}</span>
        {g.idKind ? <span className="truncate text-xs text-muted">{ID_KIND_LABEL[g.idKind]}</span> : null}
      </div>
    ),
  };

  const columns: DataColumn<LeaderGuest>[] = dgie
    ? [guestColumn, documentColumn, stayColumn, placeColumn, hostColumn, ...(wide ? [areaColumn] : []), statusColumn]
    : [
        guestColumn,
        stayColumn,
        placeColumn,
        hostColumn,
        ...(wide ? [areaColumn] : []),
        { id: "chain", header: "Shared with", hideBelow: "xl", cell: (g) => <ChainDots chain={g.chain} /> },
        statusColumn,
      ];

  return (
    <PageContent>
      <AreaHeader
        actions={
          <DownloadMenu
            files={[
              {
                id: "xlsx",
                label: "Excel (.xlsx)",
                description: dgie
                  ? "Summary, then each guest with passport and stay"
                  : "Summary, then Rwandan and foreign guests",
                href: downloads.xlsx,
                icon: "LayoutCells",
              },
              {
                id: "pdf",
                label: "PDF",
                description: "To print: the counts, then the list",
                href: downloads.pdf,
                icon: "FileArrowDown",
              },
              { id: "csv", label: "CSV", description: "For another system", href: downloads.csv, icon: "FileText" },
            ]}
          />
        }
      />
      <GuestFilters
        mode="list"
        params={params}
        go={go}
        today={today}
        audience={page.audience}
        scopes={page.scopes}
        filters={filters}
        nationalities={filters.nationalities ?? []}
        relationships={filters.relationships ?? []}
        status={{
          value: stay,
          options: [
            { id: "all", label: "All" },
            { id: "arriving", label: "Arriving in 7 days", count: counts.arriving },
            { id: "later", label: "Arriving later", count: counts.later },
            { id: "staying", label: "Staying now", count: counts.staying },
            { id: "left", label: "Left", count: counts.left },
            { id: "flagged", label: "Flagged", count: counts.flagged },
          ],
          onChange: (k) =>
            k === "later" ? go({ tab: "arriving", when: "later" }) : go({ tab: k === "all" ? null : k, when: null }),
        }}
        leading={
          <SearchBar
            label="Search guests"
            placeholder={dgie ? "Name, phone or passport" : "Name, phone or ID"}
            value={search}
            onChange={(v) => {
              setSearch(v);
              if (typing.current) clearTimeout(typing.current);
              typing.current = setTimeout(() => go({ q: v.trim() || null }), 350);
            }}
            className="md:w-52"
          />
        }
      />
      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable<LeaderGuest>
          label={dgie ? "Foreign guests" : "Guests"}
          noun={{ one: "guest", many: "guests" }}
          rows={page.guests}
          rowKey={(g) => g.id}
          onRowAction={setOpen}
          pages={{
            page: page.page,
            pageSize: page.pageSize,
            total: page.total,
            onPageChange: (p) => go({ page: String(p) }),
          }}
          empty={
            filtered ? (
              <EmptyBlock icon="Magnifier" title="No guests match these filters" />
            ) : (
              <EmptyBlock
                icon="PersonPlus"
                title={dgie ? "No guests from abroad in your area yet" : "No guests in your area yet"}
              />
            )
          }
          columns={columns}
          rowActions={(g) => <IconAction icon="Eye" label={`Open ${g.fullName}`} onPress={() => setOpen(g)} />}
          mobile={{
            title: (g) => g.fullName,
            description: (g) =>
              `${withFlag(g.nationality, g.nationalityName)} · ${stayRange(g.arrivalOn, g.departureOn)} · ${g.place.kindLabel}, ${g.place.name}`,
            trailing: (g) => <GuestStatusChip guest={g} />,
          }}
        />
      </div>
      {open ? <GuestPanel guest={open} onClose={() => setOpen(null)} /> : null}
    </PageContent>
  );
}
