"use client";

import { Tabs } from "@heroui/react";
import type {
  AdminFailedCharge,
  AdminFailedChargeResponse,
  AdminLedgerResponse,
  AdminLedgerRow,
  AdminPayout,
  AdminPayoutResponse,
  AdminPayoutStatus,
  AdminReconRun,
  AdminReconRunResponse,
} from "@injishi/contracts";
import {
  DateText,
  EmptyBlock,
  formatMoney,
  type GridColumn,
  PageContent,
  PageHeader,
  ServerDataGrid,
  StatusChip,
} from "@injishi/ui";
import NextLink from "next/link";
import type { ReactNode } from "react";
import type { MoneyDesk as MoneyDeskDoc } from "@/server/sources/admin";
import { ALL, ListBar, ListFilter, ListUrlProvider, useListUrl } from "../list/list-kit";
import { MoneyDesk } from "../money-desk";

export type MoneyTab = "desk" | "payouts" | "failed" | "ledger" | "recon";

type MoneyList =
  | { kind: "payouts"; r: AdminPayoutResponse }
  | { kind: "failed"; r: AdminFailedChargeResponse }
  | { kind: "ledger"; r: AdminLedgerResponse }
  | { kind: "recon"; r: AdminReconRunResponse }
  | null;

const TAB_LABEL: Record<MoneyTab, string> = {
  desk: "Needs action",
  payouts: "Payouts",
  failed: "Failed charges",
  ledger: "Ledger",
  recon: "Reconciliation",
};

const PAYOUT: Record<AdminPayoutStatus, { label: string; tone: "success" | "warning" | "danger" | "default" }> = {
  scheduled: { label: "Scheduled", tone: "default" },
  queued: { label: "Queued", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  held: { label: "Held", tone: "danger" },
};

const words = (s: string) => {
  const w = s.replace(/_/g, " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/**
 * Money (2026-11-09, real records): the payment account's queue of what needs a person, then payouts, failed
 * charges, the ledger and reconciliation runs. One tab at a time, in the URL, each a page from the server.
 */
export function MoneyView(props: { tab: MoneyTab; desk: MoneyDeskDoc | null; list: MoneyList }) {
  return (
    <ListUrlProvider>
      <Money {...props} />
    </ListUrlProvider>
  );
}

function Money({ tab, desk, list }: { tab: MoneyTab; desk: MoneyDeskDoc | null; list: MoneyList }) {
  const url = useListUrl();
  return (
    <PageContent>
      <PageHeader
        title="Money"
        description="What the payment account needs from a person, and every payout, charge and ledger entry."
      />
      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => url.set({ tab: String(k) === "desk" ? null : String(k), status: null })}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Money">
            {(Object.keys(TAB_LABEL) as MoneyTab[]).map((t) => (
              <Tabs.Tab key={t} id={t}>
                {TAB_LABEL[t]}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div className="flex flex-col gap-4">
        {tab === "desk" ? (
          desk ? (
            <MoneyDesk desk={desk} />
          ) : (
            <EmptyBlock icon="Wallet" title="The payment account is not readable for your role" />
          )
        ) : null}
        {list?.kind === "payouts" ? <Payouts r={list.r} /> : null}
        {list?.kind === "failed" ? <Failed r={list.r} /> : null}
        {list?.kind === "ledger" ? <Ledger r={list.r} /> : null}
        {list?.kind === "recon" ? <Recon r={list.r} /> : null}
      </div>
    </PageContent>
  );
}

/** One server page of rows, paged in the URL. */
function Paged<T extends object>({
  label,
  r,
  rowKey,
  columns,
  empty,
  mobile,
}: {
  label: string;
  r: { items: T[]; meta: { page: number; pageSize: number; total: number } };
  rowKey: (row: T) => string;
  columns: GridColumn<T>[];
  empty: string;
  mobile: { title: (row: T) => ReactNode; description?: (row: T) => ReactNode };
}) {
  const url = useListUrl();
  return (
    <ServerDataGrid<T>
      label={label}
      rows={r.items}
      rowKey={rowKey}
      isLoading={url.pending}
      columns={columns}
      paging={{
        page: r.meta.page,
        pageSize: r.meta.pageSize,
        total: r.meta.total,
        onPageChange: (page) => url.set({ page: String(page), tab: url.get("tab") }),
      }}
      empty={<EmptyBlock size="sm" icon="Wallet" title={empty} />}
      mobile={mobile}
    />
  );
}

function Payouts({ r }: { r: AdminPayoutResponse }) {
  return (
    <>
      <ListBar keys={["status"]} found={r.meta.total} noun={{ one: "payout", many: "payouts" }}>
        <ListFilter
          param="status"
          name="Status"
          options={[
            { id: ALL, label: "All" },
            ...(Object.keys(PAYOUT) as AdminPayoutStatus[]).map((s) => ({ id: s, label: PAYOUT[s].label })),
          ]}
        />
      </ListBar>
      <Paged<AdminPayout>
        label="Payouts"
        r={r}
        rowKey={(p) => p.id}
        empty="No payouts"
        columns={[
          { id: "when", header: "Created", isRowHeader: true, cell: (p) => <DateText value={p.createdAt} /> },
          {
            id: "amount",
            header: "Amount",
            align: "end",
            cell: (p) => <span className="tabular">{formatMoney(p.amountRwf)}</span>,
          },
          {
            id: "status",
            header: "Status",
            cell: (p) => (
              <span className="flex flex-col items-start gap-0.5">
                <StatusChip tone={PAYOUT[p.status].tone}>{PAYOUT[p.status].label}</StatusChip>
                {p.failureReason ? <span className="text-xs text-danger">{p.failureReason}</span> : null}
              </span>
            ),
          },
          {
            id: "settled",
            header: "Settled",
            align: "end",
            cell: (p) => (p.settledAt ? <DateText value={p.settledAt} /> : <span className="text-muted">—</span>),
          },
        ]}
        mobile={{ title: (p) => formatMoney(p.amountRwf), description: (p) => PAYOUT[p.status].label }}
      />
    </>
  );
}

function Failed({ r }: { r: AdminFailedChargeResponse }) {
  return (
    <Paged<AdminFailedCharge>
      label="Failed charges"
      r={r}
      rowKey={(f) => f.invoiceId}
      empty="No failed charges"
      columns={[
        {
          id: "business",
          header: "Business",
          isRowHeader: true,
          cell: (f) => (
            <NextLink href={`/admin/businesses/${f.orgId}`} className="font-medium hover:underline">
              {f.orgName}
            </NextLink>
          ),
        },
        { id: "kind", header: "For", cell: (f) => words(f.invoiceKind) },
        {
          id: "amount",
          header: "Amount",
          align: "end",
          cell: (f) => <span className="tabular">{formatMoney(f.amountRwf)}</span>,
        },
        { id: "when", header: "Date", align: "end", cell: (f) => <DateText value={f.createdAt} /> },
      ]}
      mobile={{ title: (f) => f.orgName, description: (f) => formatMoney(f.amountRwf) }}
    />
  );
}

function Ledger({ r }: { r: AdminLedgerResponse }) {
  return (
    <Paged<AdminLedgerRow>
      label="Ledger"
      r={r}
      rowKey={(l) => l.id}
      empty="No ledger entries"
      columns={[
        { id: "when", header: "Date", isRowHeader: true, cell: (l) => <DateText value={l.occurredAt} /> },
        {
          id: "what",
          header: "Entry",
          minWidth: 200,
          cell: (l) => (
            <span className="flex min-w-0 flex-col text-sm">
              <span className="truncate">{words(l.kind)}</span>
              {l.memo ? <span className="truncate text-xs text-muted">{l.memo}</span> : null}
            </span>
          ),
        },
        { id: "account", header: "Account", cell: (l) => <span className="font-mono text-xs">{l.accountCode}</span> },
        {
          id: "debit",
          header: "Debit",
          align: "end",
          cell: (l) => (l.direction === "debit" ? <span className="tabular">{formatMoney(l.amountRwf)}</span> : null),
        },
        {
          id: "credit",
          header: "Credit",
          align: "end",
          cell: (l) => (l.direction === "credit" ? <span className="tabular">{formatMoney(l.amountRwf)}</span> : null),
        },
        {
          id: "mode",
          header: "Mode",
          cell: (l) => (
            <StatusChip tone={l.adapterMode === "live" ? "success" : "default"}>
              {l.adapterMode === "live" ? "Live" : "Test"}
            </StatusChip>
          ),
        },
      ]}
      mobile={{
        title: (l) => words(l.kind),
        description: (l) =>
          `${l.direction === "debit" ? "Debit" : "Credit"} ${formatMoney(l.amountRwf)} · ${l.accountCode}`,
      }}
    />
  );
}

function Recon({ r }: { r: AdminReconRunResponse }) {
  return (
    <Paged<AdminReconRun>
      label="Reconciliation runs"
      r={r}
      rowKey={(x) => x.id}
      empty="No reconciliation has run yet"
      columns={[
        { id: "ran", header: "Ran", isRowHeader: true, cell: (x) => <DateText value={x.ranAt} /> },
        {
          id: "window",
          header: "Covers",
          cell: (x) =>
            x.windowStart && x.windowEnd ? (
              <>
                <DateText value={x.windowStart} /> to <DateText value={x.windowEnd} />
              </>
            ) : (
              <span className="text-muted">—</span>
            ),
        },
        { id: "entries", header: "Entries", align: "end", cell: (x) => x.entryCount },
        { id: "matched", header: "Matched", align: "end", cell: (x) => x.matchedCount },
        {
          id: "off",
          header: "Differences",
          align: "end",
          cell: (x) =>
            x.discrepancyCount > 0 ? (
              <StatusChip tone="danger">{x.discrepancyCount}</StatusChip>
            ) : (
              <StatusChip tone="success">None</StatusChip>
            ),
        },
      ]}
      mobile={{
        title: (x) => `${x.matchedCount} of ${x.entryCount} matched`,
        description: (x) => x.ranAt.slice(0, 10),
      }}
    />
  );
}
