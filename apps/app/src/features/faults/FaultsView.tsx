"use client";

import { Card, Toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  FAULT_CATEGORY_LABEL,
  FAULT_STATUS_LABEL,
  FAULT_TAB_LABEL,
  type FaultListItem,
  type FaultListPage,
  type FaultTab,
  FaultTab as FaultTabSchema,
  type OperatorTeamMember,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  FilterSelect,
  FilterTabs,
  formatNumber,
  Icon,
  ListToolbar,
  PageContent,
  PageHeader,
  SearchBar,
  StatusChip,
  UnitCell,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useMemo, useRef, useState, useTransition } from "react";
import { raiseFault } from "./actions";
import { FaultPanel } from "./FaultPanel";
import { ReportFaultDialog } from "./ReportFaultDialog";
import { ageWords, BOARD_COLUMNS } from "./shared";

export type FaultListTab = FaultTab | "all";

export interface FaultsQuery {
  tab: FaultListTab;
  unitId: string | null;
  q: string;
  page: number;
  view: "list" | "board";
}

const ALL_UNITS = "all";

/** The fault's first photo as a small thumbnail (with how many there are), or a wrench without photos. */
function PhotoMark({ url, count }: { url: string | null; count: number }) {
  if (count === 0 || !url) {
    return (
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-default text-muted"
        aria-hidden="true"
      >
        <Icon name={count > 0 ? "Camera" : "Wrench"} />
      </span>
    );
  }
  return (
    <span className="relative flex size-10 shrink-0" title={count === 1 ? "1 photo" : `${count} photos`}>
      {/* A short-lived read of the stored photo: not an optimisable static image. */}
      {/* biome-ignore lint/performance/noImgElement: signed storage URL */}
      <img src={url} alt="" loading="lazy" className="size-10 rounded-lg bg-default object-cover" />
      {count > 1 ? (
        <span className="absolute -right-1 -bottom-1 rounded-full bg-surface px-1 text-xs font-medium text-foreground tabular shadow-sm">
          {count}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Faults (P4): the tabs a fault moves through with their counts, a unit filter and a search (kept in the
 * URL), a table that becomes a list on a phone or a board by state, and a side panel per fault with its
 * photos, timeline, moves, assignment, replies and paying the fixer.
 */
export function FaultsView({
  list,
  query,
  units,
  openId,
  team,
  today,
  canPay,
  canReply,
}: {
  list: FaultListPage;
  query: FaultsQuery;
  units: { id: string; label: string }[];
  openId: string | null;
  team: OperatorTeamMember[] | null;
  today: string;
  canPay: boolean;
  canReply: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query.q);
  const [selected, setSelected] = useState<string | null>(openId);
  const [raising, setRaising] = useState(false);
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (next: Partial<FaultsQuery>) => {
    const merged = { ...query, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.view === "board") params.set("view", "board");
    else if (merged.tab !== "all") params.set("tab", merged.tab);
    if (merged.unitId) params.set("unit", merged.unitId);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const onSearch = (value: string) => {
    setSearch(value);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => go({ q: value }), 300);
  };

  const total = Object.values(list.counts).reduce((s, n) => s + (n ?? 0), 0);
  const tabs = [
    { id: "all", label: "All", count: total },
    ...FaultTabSchema.options.map((t) => ({ id: t, label: FAULT_TAB_LABEL[t], count: list.counts[t] ?? 0 })),
  ];

  const manyBuildings = new Set(list.items.map((f) => f.propertyName)).size > 1;
  const columns = useMemo<DataColumn<FaultListItem>[]>(
    () => [
      {
        id: "fault",
        header: "Fault",
        isRowHeader: true,
        sortValue: (f) => f.title,
        cell: (f) => (
          <div className="flex min-w-0 items-center gap-3">
            <PhotoMark url={f.thumbUrl} count={f.photoCount} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{f.title}</span>
              <span className="truncate text-xs text-muted">
                {[f.reference, f.category ? FAULT_CATEGORY_LABEL[f.category] : null].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "unit",
        header: "Unit",
        sortValue: (f) => f.unitLabel,
        cell: (f) =>
          f.unitLabel ? (
            <UnitCell label={f.unitLabel} secondary={manyBuildings ? (f.propertyName ?? undefined) : undefined} />
          ) : (
            <span className="text-muted">-</span>
          ),
      },
      {
        id: "tenant",
        header: "Tenant",
        hideBelow: "lg",
        sortValue: (f) => f.tenantName,
        cell: (f) => f.tenantName ?? <span className="text-muted">Vacant</span>,
      },
      {
        id: "status",
        header: "Status",
        sortValue: (f) => BOARD_COLUMNS.indexOf(f.status),
        cell: (f) => <StatusChip kind="fault" status={f.status} />,
      },
      {
        id: "age",
        header: "Reported",
        align: "end",
        sortValue: (f) => f.reportedAt,
        cell: (f) => (
          <span className="whitespace-nowrap text-sm text-muted tabular">{ageWords(f.reportedAt, today)}</span>
        ),
      },
    ],
    [manyBuildings, today],
  );

  const filtered = query.tab !== "all" || query.q !== "" || query.unitId !== null;
  const pages = Math.max(1, Math.ceil(list.total / Math.max(1, list.pageSize)));
  const raiseButton =
    units.length > 0 ? (
      <ActionButton icon="Plus" intent="primary" onPress={() => setRaising(true)}>
        Report a fault
      </ActionButton>
    ) : null;
  const empty = filtered ? (
    <EmptyBlock
      icon="Magnifier"
      title="No fault matches"
      description="Try another tab, unit or search."
      action={
        <ActionButton
          icon="Xmark"
          onPress={() => {
            setSearch("");
            go({ tab: "all", q: "", unitId: null });
          }}
        >
          Clear filters
        </ActionButton>
      }
    />
  ) : (
    <EmptyBlock
      icon="Wrench"
      title="No faults reported"
      description="Tenants report faults from their home page. You can write one down too."
      action={raiseButton ?? undefined}
    />
  );

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader title="Faults" actions={raiseButton} />

      <ListToolbar
        tabs={
          query.view === "list" ? (
            <FilterTabs
              label="Faults by stage"
              tabs={tabs}
              selectedKey={query.tab}
              onSelectionChange={(key) => go({ tab: key as FaultListTab })}
            />
          ) : undefined
        }
      >
        <SearchBar label="Search faults" value={search} onChange={onSearch} placeholder="Fault, unit or tenant" />
        {units.length > 1 ? (
          <FilterSelect
            label="Unit"
            options={[{ id: ALL_UNITS, label: "All units" }, ...units]}
            value={query.unitId ?? ALL_UNITS}
            onChange={(v) => go({ unitId: v === ALL_UNITS ? null : v })}
          />
        ) : null}
        <Segment
          aria-label="Show as"
          selectedKey={query.view}
          onSelectionChange={(k) => go({ view: k === "board" ? "board" : "list", tab: "all" })}
          className="shrink-0"
        >
          <Segment.Item id="list" aria-label="List">
            <Icon name="LayoutList" />
          </Segment.Item>
          <Segment.Item id="board" aria-label="Board">
            <Icon name="LayoutColumns" />
          </Segment.Item>
        </Segment>
      </ListToolbar>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        {query.view === "board" ? (
          <Board items={list.items} today={today} onOpen={setSelected} empty={empty} />
        ) : (
          <DataTable
            label="Faults"
            rows={list.items}
            rowKey={(f) => f.id}
            columns={columns}
            onRowAction={(f) => setSelected(f.id)}
            mobile={{
              leading: (f) => <PhotoMark url={f.thumbUrl} count={f.photoCount} />,
              title: (f) => f.title,
              description: (f) =>
                [f.unitLabel ? `Unit ${f.unitLabel}` : null, f.tenantName, ageWords(f.reportedAt, today)]
                  .filter(Boolean)
                  .join(" · "),
              trailing: (f) => <StatusChip kind="fault" status={f.status} />,
            }}
            empty={empty}
          />
        )}
      </div>

      {pages > 1 && query.view === "list" ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted tabular">
            Page {formatNumber(list.page)} of {formatNumber(pages)} · {formatNumber(list.total)} faults
          </span>
          <div className="flex gap-2">
            <ActionButton
              icon="ChevronLeft"
              size="sm"
              isDisabled={list.page <= 1}
              onPress={() => go({ page: list.page - 1 })}
            >
              Previous
            </ActionButton>
            <ActionButton
              icon="ChevronRight"
              iconPlacement="end"
              size="sm"
              isDisabled={list.page >= pages}
              onPress={() => go({ page: list.page + 1 })}
            >
              Next
            </ActionButton>
          </div>
        </nav>
      ) : null}

      {selected ? (
        <FaultPanel
          key={selected}
          faultId={selected}
          team={team}
          canPay={canPay}
          canReply={canReply}
          onClose={() => {
            setSelected(null);
            if (openId) go({});
          }}
        />
      ) : null}
      {raising ? (
        <ReportFaultDialog
          title="Report a fault"
          description="Write down a fault a tenant phoned in or one you found. The tenant is told."
          units={units}
          create={async (draft) => {
            const r = await raiseFault(draft);
            return r.ok ? { ok: true, value: { id: r.value.id, reference: r.value.reference } } : r;
          }}
          photoRoute={(id) => `/api/rentals/forms/faults/${id}/photos`}
          onClose={() => setRaising(false)}
          onSaved={(id) => {
            setRaising(false);
            setSelected(id);
          }}
        />
      ) : null}
    </PageContent>
  );
}

/** The faults still being worked, in a column per state, oldest report first. */
function Board({
  items,
  today,
  onOpen,
  empty,
}: {
  items: FaultListItem[];
  today: string;
  onOpen: (id: string) => void;
  empty: ReactNode;
}) {
  const open = items.filter((f) => BOARD_COLUMNS.includes(f.status));
  if (open.length === 0) return <>{empty}</>;
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
      {BOARD_COLUMNS.map((status) => {
        const here = open.filter((f) => f.status === status).sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
        return (
          <section
            key={status}
            aria-label={FAULT_STATUS_LABEL[status]}
            className="flex w-64 shrink-0 snap-start flex-col gap-2 rounded-2xl bg-default/60 p-2 md:w-auto"
          >
            <header className="flex items-center justify-between px-1.5 pt-1">
              <span className="text-sm font-semibold">{FAULT_STATUS_LABEL[status]}</span>
              <span className="text-xs text-muted tabular">{here.length}</span>
            </header>
            {here.length === 0 ? <p className="px-1.5 pb-2 text-xs text-muted">Nothing here</p> : null}
            {here.map((f) => (
              <Card key={f.id} className="p-0">
                <button
                  type="button"
                  onClick={() => onOpen(f.id)}
                  className="flex w-full flex-col gap-1.5 rounded-[inherit] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="line-clamp-2 text-sm font-medium">{f.title}</span>
                  <span className="text-xs text-muted">
                    {[f.unitLabel ? `Unit ${f.unitLabel}` : null, f.tenantName].filter(Boolean).join(" · ")}
                  </span>
                  <span className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="tabular">{ageWords(f.reportedAt, today)}</span>
                    <span className="flex items-center gap-2">
                      {f.photoCount > 0 ? (
                        <span className="flex items-center gap-1">
                          <Icon name="Camera" className="size-3.5" />
                          {f.photoCount}
                        </span>
                      ) : null}
                      {f.assigneeName ? (
                        <span className="flex items-center gap-1">
                          <Icon name="PersonWorker" className="size-3.5" />
                          {f.assigneeName}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </Card>
            ))}
          </section>
        );
      })}
    </div>
  );
}
