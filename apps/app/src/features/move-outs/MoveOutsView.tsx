"use client";

import { Toast } from "@heroui/react";
import {
  canSettleDeposit,
  MOVE_OUT_REASON_LABEL,
  MOVE_OUT_TAB_LABEL,
  type MoveOutList,
  type MoveOutRow,
  type MoveOutTab,
  MoveOutTab as MoveOutTabSchema,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  FilterTabs,
  formatDay,
  IconAction,
  Money,
  PageContent,
  PageHeader,
  RowActions,
  SearchBar,
  StatusChip,
  UnitCell,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AcknowledgeDialog, RecordMoveOutDialog, SettleDepositPanel } from "./MoveOutDialogs";

type Open = { kind: "ack" | "moveout" | "settle"; row: MoveOutRow } | null;

/** "In 12 days", "Today", "3 days ago". */
export function daysLeftWords(n: number | null): string {
  if (n === null) return "";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 0) return `In ${n} days`;
  return n === -1 ? "Yesterday" : `${-n} days ago`;
}

const EMPTY: Record<MoveOutTab, string> = {
  to_acknowledge: "No notice waits for you.",
  moving_soon: "Nobody is moving out soon.",
  moved_out: "No deposit waits to be settled.",
  settled: "No settled move-outs yet.",
};

/**
 * Move-outs (WP 1.7): one toolbar row with the tabs and a search, then a list of leases with the days
 * left. Acknowledge a notice, record the move out, and settle the deposit from each row.
 */
export function MoveOutsView({
  list,
  q,
  today,
  canManage,
  canSettle,
}: {
  list: MoveOutList;
  q: string;
  today: string;
  canManage: boolean;
  canSettle: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  const [open, setOpen] = useState<Open>(null);
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (tab: MoveOutTab, query: string) => {
    const params = new URLSearchParams();
    if (tab !== "to_acknowledge") params.set("tab", tab);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const tabs = MoveOutTabSchema.options.map((t) => ({
    id: t,
    label: MOVE_OUT_TAB_LABEL[t],
    count: list.counts[t] ?? 0,
  }));
  const manyBuildings = new Set(list.items.map((r) => r.propertyName)).size > 1;

  const when = (r: MoveOutRow) =>
    r.endedOn ? `Moved out ${formatDay(r.endedOn)}` : `${formatDay(r.movingOutOn)} · ${daysLeftWords(r.daysLeft)}`;

  const columns: DataColumn<MoveOutRow>[] = [
    {
      id: "tenant",
      header: "Tenant",
      isRowHeader: true,
      sortValue: (r) => r.tenantName,
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.tenantName}</span>
          <span className="truncate text-xs text-muted">
            {[r.reference, r.notice ? MOVE_OUT_REASON_LABEL[r.notice.reasonCode] : "Lease end"].join(" · ")}
          </span>
        </div>
      ),
    },
    {
      id: "unit",
      header: "Unit",
      sortValue: (r) => r.unitLabel,
      cell: (r) => <UnitCell label={r.unitLabel} secondary={manyBuildings ? r.propertyName : undefined} />,
    },
    {
      id: "when",
      header: list.tab === "moved_out" || list.tab === "settled" ? "Moved out" : "Moving out",
      sortValue: (r) => r.endedOn ?? r.movingOutOn,
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-sm tabular">{formatDay(r.endedOn ?? r.movingOutOn, "long")}</span>
          {r.endedOn ? null : (
            <span className={r.daysLeft !== null && r.daysLeft < 0 ? "text-xs text-danger" : "text-xs text-muted"}>
              {daysLeftWords(r.daysLeft)}
              {r.notice?.isShortNotice ? " · short notice" : ""}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "deposit",
      header: "Deposit",
      align: "end",
      hideBelow: "lg",
      sortValue: (r) => r.deposit?.paidRwf ?? 0,
      cell: (r) =>
        r.deposit ? (
          <div className="flex flex-col items-end gap-1">
            <Money value={r.deposit.paidRwf} />
            {r.deposit.refundStatus === "waiting" ? (
              <span className="text-xs text-warning">Refund waiting</span>
            ) : r.deposit.tenantDisputedAt ? (
              <StatusChip kind="deposit" status="disputed" />
            ) : null}
          </div>
        ) : (
          <span className="text-muted">None</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.notice && !r.endedOn ? (
          <StatusChip kind="notice" status={r.notice.status} />
        ) : r.deposit ? (
          <StatusChip kind="deposit" status={r.deposit.tenantDisputedAt ? "disputed" : r.deposit.status} />
        ) : (
          <StatusChip kind="lease" status={r.leaseStatus} />
        ),
    },
  ];

  const actions = (r: MoveOutRow) => {
    const settleable = r.deposit && canSettleDeposit(r.deposit, r.leaseStatus);
    return (
      <RowActions>
        {r.tab === "to_acknowledge" && canManage ? (
          <IconAction icon="CircleCheck" label="Acknowledge" onPress={() => setOpen({ kind: "ack", row: r })} />
        ) : null}
        {r.leaseStatus === "ending" && canManage ? (
          <IconAction
            icon="ArrowRightFromSquare"
            label="Record move out"
            onPress={() => setOpen({ kind: "moveout", row: r })}
          />
        ) : null}
        {r.tab === "moved_out" && canSettle ? (
          <IconAction
            icon="Vault"
            label="Settle deposit"
            disabledReason={settleable ? null : "A refund is waiting on your phone"}
            onPress={() => setOpen({ kind: "settle", row: r })}
          />
        ) : null}
        <IconAction
          icon="ArrowUpRightFromSquare"
          label="Open lease"
          onPress={() => router.push(`/leases/${r.leaseId}`)}
        />
      </RowActions>
    );
  };

  const empty = q ? (
    <EmptyBlock
      icon="Magnifier"
      title="No move-out matches"
      description="Try another search."
      action={
        <ActionButton
          icon="Xmark"
          onPress={() => {
            setSearch("");
            go(list.tab, "");
          }}
        >
          Clear search
        </ActionButton>
      }
    />
  ) : (
    <EmptyBlock
      icon="ArrowRightFromSquare"
      title={EMPTY[list.tab]}
      description="A notice from a tenant shows here. One that came by letter is recorded on the lease."
      action={
        <ActionButton icon="FileText" onPress={() => router.push("/leases?tab=active")}>
          Open active leases
        </ActionButton>
      }
    />
  );

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader title="Move-outs" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Move-outs by stage"
          tabs={tabs}
          selectedKey={list.tab}
          onSelectionChange={(k) => go(k as MoveOutTab, search)}
        />
        <SearchBar
          label="Search move-outs"
          value={search}
          onChange={(v) => {
            setSearch(v);
            if (typing.current) clearTimeout(typing.current);
            typing.current = setTimeout(() => go(list.tab, v), 300);
          }}
          placeholder="Tenant, unit or reference"
        />
      </div>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable
          label="Move-outs"
          rows={list.items}
          rowKey={(r) => r.leaseId}
          columns={columns}
          rowActions={actions}
          onRowAction={(r) => router.push(`/leases/${r.leaseId}`)}
          mobile={{
            title: (r) => r.tenantName,
            description: (r) => `Unit ${r.unitLabel} · ${when(r)}`,
            trailing: (r) =>
              r.notice && !r.endedOn ? (
                <StatusChip kind="notice" status={r.notice.status} />
              ) : r.deposit ? (
                <StatusChip kind="deposit" status={r.deposit.tenantDisputedAt ? "disputed" : r.deposit.status} />
              ) : null,
          }}
          empty={empty}
        />
      </div>

      {open?.kind === "ack" && open.row.notice ? (
        <AcknowledgeDialog
          leaseId={open.row.leaseId}
          tenantName={open.row.tenantName}
          moveOutOn={open.row.notice.moveOutOn}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open?.kind === "moveout" ? (
        <RecordMoveOutDialog
          leaseId={open.row.leaseId}
          tenantName={open.row.tenantName}
          startDate={open.row.startDate}
          today={today}
          suggested={open.row.movingOutOn}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open?.kind === "settle" && open.row.deposit ? (
        <SettleDepositPanel
          deposit={open.row.deposit}
          tenantName={open.row.tenantName}
          tenantPhone={null}
          endedOn={open.row.endedOn}
          today={today}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </PageContent>
  );
}
