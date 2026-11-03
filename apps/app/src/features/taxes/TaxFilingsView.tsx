"use client";

import { Toast } from "@heroui/react";
import { LEASE_FILING_KIND_LABEL, type LeaseFilingView } from "@injishi/contracts";
import {
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  formatDay,
  IconAction,
  PageContent,
  PersonCell,
  RowActions,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { leaseHref } from "../leases/shared";
import { MarkFiledDialog } from "./TaxDialogs";

const statusOf = (f: LeaseFilingView) => (f.status === "pending" && f.late ? "overdue" : f.status);

/**
 * Lease copies owed to RRA (2026-10-30): each signed lease is filed within 15 days. One table, the ones
 * still owed first; a row opens its lease, and Mark filed records the filing with its proof.
 */
export function TaxFilingsView({ filings, canManage }: { filings: LeaseFilingView[]; canManage: boolean }) {
  const router = useRouter();
  const [filing, setFiling] = useState<LeaseFilingView | null>(null);
  const filingColumns: DataColumn<LeaseFilingView>[] = [
    {
      id: "lease",
      header: "Lease",
      isRowHeader: true,
      sortValue: (f) => f.leaseReference,
      cell: (f) => <PersonCell name={f.tenantName} secondary={`${f.leaseReference} · Unit ${f.unitLabel}`} />,
    },
    { id: "kind", header: "What", hideBelow: "lg", cell: (f) => LEASE_FILING_KIND_LABEL[f.kind] },
    {
      id: "due",
      header: "Due",
      sortValue: (f) => f.dueOn,
      cell: (f) => (
        <span className="flex flex-col">
          <DateText value={f.dueOn} />
          {f.status === "pending" && f.daysLeft !== null ? (
            <span className={f.late ? "text-xs text-danger" : "text-xs text-muted"}>
              {f.late ? `${Math.abs(f.daysLeft)} days late` : f.daysLeft === 0 ? "Today" : `${f.daysLeft} days left`}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (f) => statusOf(f),
      cell: (f) => <StatusChip kind="filing" status={statusOf(f)} />,
    },
    {
      id: "filed",
      header: "Filed",
      hideBelow: "lg",
      cell: (f) =>
        f.filedOn ? (
          <span className="flex flex-col">
            <DateText value={f.filedOn} />
            {f.reference ? <span className="text-xs text-muted">{f.reference}</span> : null}
            {f.proofUrl ? (
              <a
                href={f.proofUrl}
                download={`${f.leaseReference}-rra-proof`}
                target="_blank"
                rel="noopener"
                className="text-xs text-accent hover:underline"
              >
                Proof
              </a>
            ) : null}
          </span>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
  ];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <AreaHeader />
      <DataTable
        label="Lease copies for RRA"
        noun={{ one: "lease copy", many: "lease copies" }}
        rows={filings}
        rowKey={(f) => f.id}
        columns={filingColumns}
        search={{
          placeholder: "Tenant, unit or lease",
          text: (f) => `${f.tenantName} ${f.unitLabel} ${f.leaseReference}`,
        }}
        filters={[
          {
            id: "status",
            name: "Status",
            options: [
              { id: "all", label: "All" },
              { id: "overdue", label: "Late", count: filings.filter((f) => statusOf(f) === "overdue").length },
              { id: "pending", label: "To file", count: filings.filter((f) => statusOf(f) === "pending").length },
              { id: "filed", label: "Filed", count: filings.filter((f) => f.status === "filed").length },
            ],
            match: (f, v) => statusOf(f) === v,
          },
        ]}
        onRowAction={(f) => router.push(leaseHref(f.leaseId))}
        rowActions={(f) =>
          f.status !== "pending" || !canManage ? null : (
            <RowActions>
              <IconAction icon="FileCheck" label={`Mark ${f.leaseReference} filed`} onPress={() => setFiling(f)} />
            </RowActions>
          )
        }
        mobile={{
          title: (f) => `${f.leaseReference} · ${f.tenantName}`,
          description: (f) =>
            f.status === "filed" && f.filedOn ? `Filed ${formatDay(f.filedOn)}` : `Due ${formatDay(f.dueOn)}`,
          trailing: (f) => <StatusChip kind="filing" status={statusOf(f)} />,
        }}
        empty={<EmptyBlock icon="FileText" title="No lease copies owed" />}
      />
      {filing ? <MarkFiledDialog filing={filing} onClose={() => setFiling(null)} /> : null}
    </PageContent>
  );
}
