"use client";

import {
  type BrokerFeeRecordStatus,
  brokerFeeWords,
  type LandlordPlacementList,
  type LandlordPlacementView,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  FilterTabs,
  formatLocalPhone,
  IconAction,
  KpiStrip,
  ListToolbar,
  Money,
  PageContent,
  PageHeader,
  PersonCell,
  RowActions,
  SearchBar,
  Stars,
  StatusChip,
  TextLink,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { leaseHref } from "../../leases/shared";
import { canMessagePlacement, placementMessageHref } from "../../messages/links";

export type BrokersShow = "open" | "leased" | "all";

const TABS: { id: BrokersShow; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "leased", label: "Leased" },
];

const FEE_CHIP: Record<BrokerFeeRecordStatus, { tone: "warning" | "success" | "default"; label: string }> = {
  owed: { tone: "warning", label: "Owed" },
  paid: { tone: "success", label: "Paid" },
  void: { tone: "default", label: "Void" },
};

const inTab = (p: LandlordPlacementView, show: BrokersShow): boolean =>
  show === "all" ? true : show === "open" ? p.status === "initiated" : p.lease !== null;

const dash = (
  <span className="text-muted">
    <span aria-hidden="true">-</span>
    <span className="sr-only">None</span>
  </span>
);

/**
 * Brokers on the landlord's side (2026-10-25): each broker who said they have a tenant for one of your
 * units, the lease it became, and the fee the lease records (owed until you mark it paid; paid outside
 * Injishi). The tab and search are kept in the URL.
 */
export function BrokersView({ list, show, q }: { list: LandlordPlacementList; show: BrokersShow; q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);

  // The tab goes in the URL; the search filters what is here, and rides along when the tab changes.
  const go = (next: { show: BrokersShow }) => {
    const params = new URLSearchParams();
    const s = next.show;
    const term = search;
    if (s !== "all") params.set("show", s);
    if (term.trim()) params.set("q", term.trim());
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const needle = search.trim().toLowerCase();
  const matches = (p: LandlordPlacementView) =>
    !needle ||
    [p.broker.name, p.broker.phone, p.unit?.label, p.tenantName, p.lease?.tenantName, p.lease?.reference]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle));
  const rows = list.placements.filter((p) => inTab(p, show) && matches(p));
  const open = list.placements.filter((p) => p.status === "initiated").length;

  const columns = useMemo<DataColumn<LandlordPlacementView>[]>(
    () => [
      {
        id: "broker",
        header: "Broker",
        isRowHeader: true,
        sortValue: (p) => p.broker.name ?? "",
        cell: (p) => (
          <PersonCell
            name={p.broker.name ?? "Broker"}
            secondary={
              p.broker.ratingAverage !== null && p.broker.ratingCount > 0 ? (
                <span className="flex items-center gap-1">
                  <Stars value={Math.round(p.broker.ratingAverage)} size="size-3" />
                  <span className="tabular">{p.broker.ratingAverage.toFixed(1)}</span>
                </span>
              ) : p.broker.phone ? (
                formatLocalPhone(p.broker.phone)
              ) : undefined
            }
          />
        ),
      },
      {
        id: "unit",
        header: "Unit",
        sortValue: (p) => p.unit?.label ?? "",
        cell: (p) => (p.unit ? p.unit.label : dash),
      },
      {
        id: "tenant",
        header: "Tenant",
        sortValue: (p) => p.lease?.tenantName ?? p.tenantName ?? "",
        cell: (p) => p.lease?.tenantName ?? p.tenantName ?? dash,
      },
      {
        id: "started",
        header: "Started",
        sortValue: (p) => p.startedAt,
        cell: (p) => <DateText value={p.startedAt} />,
        hideBelow: "lg",
      },
      {
        id: "lease",
        header: "Lease",
        sortValue: (p) => p.lease?.reference ?? "",
        cell: (p) => (p.lease ? <TextLink href={leaseHref(p.lease.id)}>{p.lease.reference}</TextLink> : dash),
        hideBelow: "lg",
      },
      {
        id: "fee",
        header: "Fee",
        align: "end",
        sortValue: (p) => p.fee?.amountRwf ?? -1,
        cell: (p) =>
          p.fee ? (
            <span className="flex items-center justify-end gap-2">
              <Money value={p.fee.amountRwf} />
              <StatusChip tone={FEE_CHIP[p.fee.status].tone}>{FEE_CHIP[p.fee.status].label}</StatusChip>
            </span>
          ) : p.terms ? (
            <span className="text-muted">{brokerFeeWords(p.terms)}</span>
          ) : (
            dash
          ),
      },
    ],
    [],
  );

  return (
    <PageContent>
      <PageHeader title="Brokers" />
      <KpiStrip
        label="Broker fees"
        items={[
          {
            id: "owed",
            label: "Fees owed",
            value: list.owedRwf,
            icon: "Wallet",
            status: list.owedRwf > 0 ? "warning" : undefined,
          },
          { id: "paid", label: "Fees paid", value: list.paidRwf, icon: "CircleCheck" },
          { id: "open", label: "Open placements", value: open, format: "count", icon: "Persons" },
        ]}
      />
      <ListToolbar
        tabs={
          <FilterTabs
            label="Placements"
            name="Status"
            tabs={TABS.map((t) => ({ ...t, count: list.placements.filter((p) => inTab(p, t.id)).length }))}
            selectedKey={show}
            onSelectionChange={(key) => go({ show: key as BrokersShow })}
          />
        }
      >
        <SearchBar label="Search placements" value={search} onChange={setSearch} placeholder="Broker, unit or tenant" />
      </ListToolbar>
      <DataTable
        label="Placements"
        rows={rows}
        rowKey={(p) => p.id}
        columns={columns}
        defaultSort={{ column: "started", direction: "descending" }}
        onRowAction={(p) => (p.lease ? router.push(leaseHref(p.lease.id)) : undefined)}
        rowActions={(p) =>
          p.lease || canMessagePlacement(p.status) ? (
            <RowActions>
              {canMessagePlacement(p.status) ? (
                <ActionButton
                  size="sm"
                  icon="Comments"
                  aria-label={`Message ${p.broker.name ?? "the broker"}`}
                  onPress={() => router.push(placementMessageHref(p.id))}
                >
                  Message
                </ActionButton>
              ) : null}
              {p.lease ? (
                <IconAction
                  icon="FileText"
                  label="Open the lease"
                  onPress={() => router.push(leaseHref((p.lease as { id: string }).id))}
                />
              ) : null}
            </RowActions>
          ) : null
        }
        mobile={{
          title: (p) => p.broker.name ?? "Broker",
          description: (p) =>
            [p.unit ? `Unit ${p.unit.label}` : null, p.lease?.tenantName ?? p.tenantName, p.lease?.reference]
              .filter(Boolean)
              .join(" · "),
          trailing: (p) =>
            p.fee ? (
              <span className="flex flex-col items-end gap-1">
                <Money value={p.fee.amountRwf} className="font-medium" />
                <StatusChip tone={FEE_CHIP[p.fee.status].tone}>{FEE_CHIP[p.fee.status].label}</StatusChip>
              </span>
            ) : null,
        }}
        empty={
          <EmptyBlock
            icon="Persons"
            title={list.placements.length === 0 ? "No brokers yet" : "Nothing matches"}
            description={
              list.placements.length === 0
                ? "Open a unit to brokers from its form. When one has a tenant, it shows here."
                : "Try another tab or search."
            }
            action={
              list.placements.length === 0 ? (
                <ActionLink href={screenHref("Units")} icon="FolderHouse">
                  Open units
                </ActionLink>
              ) : undefined
            }
          />
        }
      />
    </PageContent>
  );
}
