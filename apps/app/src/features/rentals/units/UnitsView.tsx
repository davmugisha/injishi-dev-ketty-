"use client";

import { Toast, toast } from "@heroui/react";
import type {
  BlockView,
  BrokerFeeTerms,
  RentalPropertyView,
  RentalUnitList,
  RentalUnitView,
  UnitTab,
} from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  FilterSelect,
  FilterTabs,
  formatMoney,
  formatNumber,
  Icon,
  IconAction,
  KpiStrip,
  ListToolbar,
  Money,
  PageContent,
  PageHeader,
  RowActions,
  SearchBar,
  StatusChip,
  UnitCell,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { retireUnit } from "../actions";
import { bedroomsWords, unitStatus } from "../shared";
import { BlocksPanel } from "./BlocksPanel";
import { type UnitFormMode, UnitFormPanel } from "./UnitFormPanel";
import { UnitPanel } from "./UnitPanel";

const TABS: { id: Exclude<UnitTab, "retired">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "occupied", label: "Occupied" },
  { id: "vacant", label: "Vacant" },
  { id: "off_market", label: "Off market" },
];

const ALL_BLOCKS = "all";

export interface UnitsQuery {
  tab: UnitTab;
  blockId: string | null;
  q: string;
}

/**
 * Units (WP 2.3): the figures, the tabs with their counts, a block filter and a search (all kept in the
 * URL), one table that becomes a list on a phone, and a side panel per unit with its photos and video.
 */
export function UnitsView({
  list,
  all,
  blocks,
  properties,
  query,
  canManage,
  open,
  defaultBrokerFee = null,
}: {
  list: RentalUnitList;
  all: RentalUnitView[];
  blocks: BlockView[];
  properties: RentalPropertyView[];
  query: UnitsQuery;
  canManage: boolean;
  open: "add" | "blocks" | null;
  /** The landlord's default broker fee, for a unit switched on for brokers. */
  defaultBrokerFee?: BrokerFeeTerms | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState<UnitFormMode | null>(open === "add" && canManage ? { kind: "add" } : null);
  const [showBlocks, setShowBlocks] = useState(open === "blocks");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<RentalUnitView | null>(null);
  const [search, setSearch] = useState(query.q);
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = selectedId
    ? (all.find((u) => u.id === selectedId) ?? list.units.find((u) => u.id === selectedId) ?? null)
    : null;

  // The `?add=1` / `?blocks=1` a link opened this page with is used once, then dropped from the URL.
  useEffect(() => {
    if (open) router.replace(pathname, { scroll: false });
  }, [open, pathname, router]);

  const go = (next: Partial<UnitsQuery>) => {
    const merged = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.tab !== "all") params.set("tab", merged.tab);
    if (merged.blockId) params.set("block", merged.blockId);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const onSearch = (value: string) => {
    setSearch(value);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => go({ q: value }), 300);
  };

  const priced = all.filter((u) => u.askingRentRwf !== null);
  const vacantRent = all.filter((u) => unitStatus(u) === "vacant").reduce((sum, u) => sum + (u.askingRentRwf ?? 0), 0);
  const occupiedCount = list.counts.occupied ?? 0;
  const unitCount = list.counts.all ?? 0;
  const average =
    priced.length > 0 ? Math.round(priced.reduce((s, u) => s + (u.askingRentRwf ?? 0), 0) / priced.length) : 0;

  const manyBuildings = properties.length > 1;
  const anyBlock = all.some((u) => u.blockId !== null);
  const anyVacantSince = all.some((u) => u.vacantSince !== null);
  const columns = useMemo<DataColumn<RentalUnitView>[]>(
    () => [
      {
        id: "unit",
        header: "Unit",
        isRowHeader: true,
        sortValue: (u) => u.label,
        cell: (u) => <UnitCell label={u.label} secondary={manyBuildings ? u.propertyName : undefined} />,
      },
      {
        id: "block",
        header: "Block",
        sortValue: (u) => u.blockCode ?? "",
        cell: (u) =>
          u.blockCode ? (
            (u.blockName ?? u.blockCode)
          ) : (
            <span className="text-muted">
              <span aria-hidden="true">-</span>
              <span className="sr-only">No block</span>
            </span>
          ),
        hideBelow: "lg",
      },
      {
        id: "bedrooms",
        header: "Bedrooms",
        sortValue: (u) => u.bedrooms ?? -1,
        cell: (u) => bedroomsWords(u.bedrooms) ?? <span className="text-muted">Not said</span>,
      },
      {
        id: "rent",
        header: "Asking rent",
        align: "end",
        sortValue: (u) => u.askingRentRwf ?? -1,
        cell: (u) =>
          u.askingRentRwf !== null ? <Money value={u.askingRentRwf} /> : <span className="text-muted">Not set</span>,
      },
      {
        id: "tenant",
        header: "Tenant",
        sortValue: (u) => u.currentLease?.tenantName ?? "",
        cell: (u) =>
          u.currentLease?.tenantName ?? (
            <span className="text-muted">
              <span aria-hidden="true">-</span>
              <span className="sr-only">No tenant</span>
            </span>
          ),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (u) => unitStatus(u),
        cell: (u) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusChip kind="unit" status={unitStatus(u)} />
            {u.brokerOffer && unitStatus(u) === "vacant" ? (
              <span className="inline-flex text-muted" title="Brokers may offer it">
                <Icon name="Megaphone" className="size-3.5" />
                <span className="sr-only">Brokers may offer it</span>
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "vacant",
        header: "Vacant since",
        sortValue: (u) => u.vacantSince ?? "",
        cell: (u) => (u.vacantSince ? <DateText value={u.vacantSince} /> : <span className="text-muted">-</span>),
        hideBelow: "xl",
      },
    ],
    [manyBuildings],
  );
  // A column every row would leave empty (no blocks yet, nothing vacant since a tenancy) is not shown.
  const shownColumns = columns.filter((c) => (c.id !== "block" || anyBlock) && (c.id !== "vacant" || anyVacantSince));

  const filtered = query.tab !== "all" || query.blockId !== null || query.q !== "";
  const confirmRetire = () => {
    if (!retiring) return;
    const unit = retiring;
    start(async () => {
      const result = await retireUnit(unit.id);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setRetiring(null);
      setSelectedId(null);
      toast.success(`Unit ${unit.label} retired`);
      router.refresh();
    });
  };

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        title="Units"
        actions={
          <>
            <ActionButton icon="LayoutCells" intent="ghost" onPress={() => setShowBlocks(true)}>
              Blocks
            </ActionButton>
            {canManage ? (
              <>
                <ActionButton icon="LayoutList" onPress={() => setForm({ kind: "bulk" })}>
                  Add several
                </ActionButton>
                <ActionButton icon="Plus" intent="primary" onPress={() => setForm({ kind: "add" })}>
                  Add unit
                </ActionButton>
              </>
            ) : null}
          </>
        }
      />

      <KpiStrip
        label="Units at a glance"
        items={[
          {
            id: "occupancy",
            label: "Occupancy",
            value: unitCount > 0 ? Math.round((occupiedCount / unitCount) * 1000) / 10 : 0,
            format: "percent",
            icon: "ChartLine",
            progress: unitCount > 0 ? (occupiedCount / unitCount) * 100 : 0,
            footnote:
              unitCount === 0
                ? "No units yet"
                : `${formatNumber(occupiedCount)} of ${formatNumber(unitCount)} occupied`,
            href: "?tab=occupied",
            isCurrent: query.tab === "occupied",
          },
          {
            id: "vacant",
            label: "Vacant",
            value: list.counts.vacant ?? 0,
            format: "count",
            icon: "FolderHouse",
            status: (list.counts.vacant ?? 0) > 0 ? "warning" : undefined,
            footnote:
              unitCount === 0
                ? "No units yet"
                : vacantRent > 0
                  ? `${formatMoney(vacantRent)} a month unlet`
                  : (list.counts.vacant ?? 0) > 0
                    ? "Free to let"
                    : "All let",
            href: "?tab=vacant",
            isCurrent: query.tab === "vacant",
          },
          {
            id: "rent",
            label: "Average asking rent",
            value: average,
            icon: "Wallet",
            footnote:
              priced.length === 0
                ? "No asking rent set yet"
                : priced.length < all.length
                  ? `${formatNumber(priced.length)} of ${formatNumber(all.length)} units priced`
                  : `Across ${formatNumber(priced.length)} ${priced.length === 1 ? "unit" : "units"}`,
          },
        ]}
      />

      <ListToolbar
        tabs={
          <FilterTabs
            label="Units by status"
            name="Status"
            tabs={TABS.map((t) => ({ ...t, count: list.counts[t.id] ?? 0 }))}
            selectedKey={query.tab === "retired" ? "all" : query.tab}
            onSelectionChange={(key) => go({ tab: key as UnitTab })}
          />
        }
      >
        <SearchBar label="Search units" value={search} onChange={onSearch} placeholder="Unit, tenant or block" />
        {blocks.length > 0 ? (
          <FilterSelect
            label="Block"
            options={[{ id: ALL_BLOCKS, label: "All blocks" }, ...blocks.map((b) => ({ id: b.id, label: b.name }))]}
            value={query.blockId ?? ALL_BLOCKS}
            onChange={(v) => go({ blockId: v === ALL_BLOCKS ? null : v })}
          />
        ) : null}
      </ListToolbar>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable
          label="Units"
          rows={list.units}
          rowKey={(u) => u.id}
          columns={shownColumns}
          defaultSort={{ column: "unit", direction: "ascending" }}
          onRowAction={(u) => setSelectedId(u.id)}
          rowActions={
            canManage
              ? (u) => (
                  <RowActions>
                    <IconAction
                      icon="PencilToSquare"
                      label={`Edit unit ${u.label}`}
                      onPress={() => setForm({ kind: "edit", unit: u })}
                    />
                    <IconAction
                      icon="TrashBin"
                      label={`Retire unit ${u.label}`}
                      intent="danger"
                      disabledReason={u.currentLease ? "A lease holds it" : null}
                      onPress={() => setRetiring(u)}
                    />
                  </RowActions>
                )
              : undefined
          }
          mobile={{
            title: (u) => u.label,
            description: (u) =>
              [
                u.blockName ?? u.blockCode,
                bedroomsWords(u.bedrooms),
                u.currentLease?.tenantName,
                u.askingRentRwf ? formatMoney(u.askingRentRwf) : null,
              ]
                .filter(Boolean)
                .join(" · ") || u.propertyName,
            trailing: (u) => <StatusChip kind="unit" status={unitStatus(u)} />,
          }}
          empty={
            filtered ? (
              <EmptyBlock
                icon="Magnifier"
                title="No unit matches"
                description="Try another tab, block or search."
                action={
                  <ActionButton
                    icon="Xmark"
                    onPress={() => {
                      setSearch("");
                      go({ tab: "all", blockId: null, q: "" });
                    }}
                  >
                    Clear filters
                  </ActionButton>
                }
              />
            ) : (
              <EmptyBlock
                icon="FolderHouse"
                title="No units yet"
                description="Add each unit you rent out, or several at once."
                action={
                  canManage ? (
                    <ActionButton icon="Plus" intent="primary" onPress={() => setForm({ kind: "add" })}>
                      Add unit
                    </ActionButton>
                  ) : undefined
                }
              />
            )
          }
        />
      </div>

      {selected ? (
        <UnitPanel
          key={selected.id}
          unit={selected}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setSelectedId(null);
            setForm({ kind: "edit", unit: selected });
          }}
          onRetire={() => setRetiring(selected)}
        />
      ) : null}
      {form ? (
        <UnitFormPanel
          key={form.kind === "edit" ? form.unit.id : form.kind}
          mode={form}
          blocks={blocks}
          properties={properties}
          defaultBrokerFee={defaultBrokerFee}
          onClose={() => setForm(null)}
          onSaved={(unit) => {
            // A new or edited unit opens in its panel, with its photos and video.
            if (unit) setSelectedId(unit.id);
          }}
        />
      ) : null}
      {showBlocks ? (
        <BlocksPanel
          blocks={blocks}
          properties={properties}
          canManage={canManage}
          onClose={() => setShowBlocks(false)}
        />
      ) : null}
      <ConfirmDialog
        isOpen={retiring !== null}
        onOpenChange={(o) => (o ? undefined : setRetiring(null))}
        title={`Retire unit ${retiring?.label ?? ""}?`}
        confirmLabel="Retire unit"
        confirmIcon="TrashBin"
        intent="danger"
        isPending={pending && retiring !== null}
        onConfirm={confirmRetire}
      >
        It stays on file for the leases it had, but can no longer be let or listed. This can't be undone.
      </ConfirmDialog>
    </PageContent>
  );
}
