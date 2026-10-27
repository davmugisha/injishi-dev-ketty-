"use client";

import type { BrokerPlacement, BrokerPlacementList } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  type DataColumn,
  DataTable,
  EmptyBlock,
  FilterTabs,
  formatDay,
  formatMoney,
  KpiStrip,
  PageContent,
  PageHeader,
  SearchBar,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { canMessagePlacement, placementMessageHref } from "../messages/links";
import { FeeChip, feeTermsWords, PlacementChip } from "./shared";

type Tab = "open" | "leased" | "all";

/**
 * The tenants a broker said they have (2026-10-25): open placements wait for the landlord to name the
 * broker on a lease; leased ones show the lease and the fee it records.
 */
export function PlacementsView({ data }: { data: BrokerPlacementList }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [search, setSearch] = useState("");
  const all = data.placements;
  const open = all.filter((p) => p.status === "initiated");
  const leased = all.filter((p) => p.status === "converted");
  const rows = useMemo(() => {
    const base = tab === "open" ? open : tab === "leased" ? leased : all;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) =>
      [p.unit?.label, p.unit?.propertyName, p.landlordName, p.tenantName, p.lease?.tenantName, p.lease?.reference]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [tab, search, all, open, leased]);

  const columns: DataColumn<BrokerPlacement>[] = [
    {
      id: "home",
      header: "Home",
      cell: (p) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{p.unit ? `${p.unit.label} · ${p.unit.propertyName}` : "A home"}</span>
          <span className="text-xs text-muted">{[p.landlordName, p.unit?.district].filter(Boolean).join(", ")}</span>
        </span>
      ),
      sortValue: (p) => p.unit?.label,
      isRowHeader: true,
    },
    {
      id: "tenant",
      header: "Tenant",
      cell: (p) => p.lease?.tenantName ?? p.tenantName ?? <span className="text-muted">Not named</span>,
    },
    { id: "started", header: "Started", cell: (p) => formatDay(p.startedAt, "short"), sortValue: (p) => p.startedAt },
    {
      id: "lease",
      header: "Lease",
      cell: (p) =>
        p.lease ? (
          <span className="flex flex-col">
            <span className="tabular">{p.lease.reference}</span>
            <span className="text-xs text-muted">From {formatDay(p.lease.startDate, "short")}</span>
          </span>
        ) : (
          <span className="text-muted">Waiting for the landlord</span>
        ),
      hideBelow: "lg",
    },
    {
      id: "fee",
      header: "Fee",
      align: "end",
      cell: (p) =>
        p.fee ? (
          <span className="flex items-center justify-end gap-2">
            <span className="tabular">{formatMoney(p.fee.amountRwf)}</span>
            <FeeChip status={p.fee.status} />
          </span>
        ) : p.terms ? (
          <span className="text-xs text-muted">{feeTermsWords(p.terms)}</span>
        ) : (
          "-"
        ),
      sortValue: (p) => p.fee?.amountRwf ?? 0,
    },
    { id: "status", header: "Status", cell: (p) => <PlacementChip status={p.status} /> },
  ];

  const owed = all.reduce((s, p) => s + (p.fee?.status === "owed" ? p.fee.amountRwf : 0), 0);

  return (
    <PageContent>
      <PageHeader
        title="Placements"
        actions={
          <ActionLink href={screenHref("BrokerDirectory")} icon="Magnifier">
            Find homes
          </ActionLink>
        }
      />
      <KpiStrip
        label="Placements"
        items={[
          {
            id: "open",
            label: "Open",
            value: open.length,
            format: "count",
            icon: "Persons",
            isCurrent: tab === "open",
          },
          {
            id: "leased",
            label: "Leased",
            value: leased.length,
            format: "count",
            icon: "FileText",
            isCurrent: tab === "leased",
          },
          { id: "owed", label: "Fees owed", value: owed, icon: "Wallet", href: screenHref("BrokerEarnings") },
        ]}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Placements by status"
          name="Status"
          tabs={[
            { id: "open", label: "Open", count: open.length },
            { id: "leased", label: "Leased", count: leased.length },
            { id: "all", label: "All", count: all.length },
          ]}
          selectedKey={tab}
          onSelectionChange={(k) => setTab(k as Tab)}
        />
        <SearchBar
          label="Search placements"
          value={search}
          onChange={setSearch}
          placeholder="Home, landlord or tenant"
        />
      </div>
      <DataTable
        label="Placements"
        rows={rows}
        rowKey={(p) => p.id}
        columns={columns}
        defaultSort={{ column: "started", direction: "descending" }}
        rowActions={(p) =>
          canMessagePlacement(p.status) ? (
            <ActionButton size="sm" icon="Comments" onPress={() => router.push(placementMessageHref(p.id))}>
              Message
            </ActionButton>
          ) : null
        }
        mobile={{
          title: (p) => (p.unit ? `${p.unit.label} · ${p.unit.propertyName}` : "A home"),
          description: (p) => p.lease?.tenantName ?? p.tenantName ?? formatDay(p.startedAt, "short"),
          trailing: (p) => (p.fee ? <FeeChip status={p.fee.status} /> : <PlacementChip status={p.status} />),
        }}
        empty={
          <EmptyBlock
            icon="Persons"
            title={search ? "No placement matches" : tab === "leased" ? "No leases yet" : "No open placements"}
            description={search ? undefined : "Open a home, reveal the landlord and say you have a tenant."}
            action={
              <ActionLink href={screenHref("BrokerDirectory")} icon="Magnifier">
                Find homes
              </ActionLink>
            }
          />
        }
      />
    </PageContent>
  );
}
