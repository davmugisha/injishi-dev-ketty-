"use client";

import type { BrokerPlacement, BrokerPlacementList } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  type DataColumn,
  DataTable,
  EmptyBlock,
  formatDay,
  formatMoney,
  IconAction,
  PageContent,
  RowActions,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { canMessagePlacement, placementMessageHref } from "../messages/links";
import { FeeChip, feeTermsWords, PlacementChip } from "./shared";

/**
 * The tenants a broker said they have (2026-10-25): open placements wait for the landlord to name the
 * broker on a lease; leased ones show the lease and the fee it records.
 */
export function PlacementsView({ data }: { data: BrokerPlacementList }) {
  const router = useRouter();
  const all = data.placements;
  const count = (status: BrokerPlacement["status"]) => all.filter((p) => p.status === status).length;

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
    { id: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <PlacementChip status={p.status} /> },
  ];

  return (
    <PageContent>
      <AreaHeader
        actions={
          <ActionLink href={screenHref("BrokerDirectory")} icon="Magnifier">
            Find homes
          </ActionLink>
        }
      />
      <DataTable
        label="Placements"
        rows={all}
        rowKey={(p) => p.id}
        noun={{ one: "placement", many: "placements" }}
        search={{
          placeholder: "Home, landlord or tenant",
          text: (p) =>
            [p.unit?.label, p.unit?.propertyName, p.landlordName, p.tenantName, p.lease?.tenantName, p.lease?.reference]
              .filter(Boolean)
              .join(" "),
        }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All", count: all.length },
              { id: "initiated", label: "Open", count: count("initiated") },
              { id: "converted", label: "Leased", count: count("converted") },
              { id: "abandoned", label: "Closed", count: count("abandoned") + count("unavailable") },
            ],
            match: (p, v) =>
              v === "abandoned" ? p.status === "abandoned" || p.status === "unavailable" : p.status === v,
          },
        ]}
        columns={columns}
        defaultSort={{ column: "started", direction: "descending" }}
        rowActions={(p) =>
          canMessagePlacement(p.status) ? (
            <RowActions>
              <IconAction
                icon="Comments"
                label={`Message the landlord of ${p.unit?.label ?? "this home"}`}
                onPress={() => router.push(placementMessageHref(p.id))}
              />
            </RowActions>
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
            title="No placements yet"
            description="Open a home, reveal the landlord and say you have a tenant."
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
