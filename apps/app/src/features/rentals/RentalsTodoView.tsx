"use client";

import { Avatar, Chip } from "@heroui/react";
import type { RentalsAttentionItem, RentalsAttentionKind } from "@injishi/contracts";
import {
  ActionLink,
  type DataColumn,
  DataTable,
  EmptyBlock,
  Icon,
  type IconKey,
  Money,
  PageContent,
  toneColor,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { ATTENTION_HREF, ATTENTION_ICON } from "./shared";

/** The verb on each row: what pressing it does. */
const VERB: Record<RentalsAttentionKind, string> = {
  setup_incomplete: "Continue",
  no_payout_account: "Add",
  overdue_rent: "See who",
  leases_to_sign: "Sign",
  ready_to_start: "Start",
  notices_to_acknowledge: "Review",
  filings_due: "File",
  waiting_for_tenant: "View",
};

const PRIORITY: Record<
  RentalsAttentionItem["tone"],
  { label: string; rank: number; color: "danger" | "warning" | "default" }
> = {
  danger: { label: "Late", rank: 0, color: "danger" },
  warning: { label: "Soon", rank: 1, color: "warning" },
  info: { label: "Waiting", rank: 2, color: "default" },
};

/** What needs the landlord, one row each with its next step (2026-10-30). The API's summary, nothing typed in. */
export function RentalsTodoView({ items }: { items: RentalsAttentionItem[] }) {
  const router = useRouter();
  const columns: DataColumn<RentalsAttentionItem>[] = [
    {
      id: "what",
      header: "To do",
      isRowHeader: true,
      sortValue: (i) => i.title,
      cell: (i) => (
        <span className="flex items-center gap-3">
          <Avatar size="sm" variant="soft" color={toneColor(i.tone)} className="shrink-0">
            <Avatar.Fallback>
              <Icon name={ATTENTION_ICON[i.kind] as IconKey} />
            </Avatar.Fallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{i.title}</span>
            {i.detail ? <span className="text-xs text-muted">{i.detail}</span> : null}
          </span>
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      sortValue: (i) => i.amountRwf ?? -1,
      cell: (i) => (i.amountRwf !== null ? <Money value={i.amountRwf} /> : <span className="text-muted">-</span>),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (i) => PRIORITY[i.tone].rank,
      cell: (i) => (
        <Chip size="sm" variant="soft" color={PRIORITY[i.tone].color}>
          {PRIORITY[i.tone].label}
        </Chip>
      ),
    },
  ];
  return (
    <PageContent>
      <AreaHeader />
      <DataTable
        label="To do"
        noun={{ one: "item", many: "items" }}
        rows={items}
        rowKey={(i) => i.kind}
        columns={columns}
        defaultSort={{ column: "priority", direction: "ascending" }}
        filters={[
          {
            id: "priority",
            name: "Priority",
            options: [
              { id: "all", label: "All" },
              { id: "danger", label: "Late" },
              { id: "warning", label: "Soon" },
              { id: "info", label: "Waiting" },
            ],
            match: (i, v) => i.tone === v,
          },
        ]}
        onRowAction={(i) => {
          const link = ATTENTION_HREF[i.kind];
          if (link) router.push(link.href);
        }}
        rowActions={(i) => {
          const link = ATTENTION_HREF[i.kind];
          return link ? (
            <ActionLink href={link.href} size="sm" aria-label={link.label}>
              {VERB[i.kind]}
            </ActionLink>
          ) : null;
        }}
        mobile={{
          title: (i) => i.title,
          description: (i) => i.detail,
          trailing: (i) => (
            <Chip size="sm" variant="soft" color={PRIORITY[i.tone].color}>
              {PRIORITY[i.tone].label}
            </Chip>
          ),
        }}
        empty={<EmptyBlock icon="CircleCheck" title="Nothing needs you right now" />}
      />
    </PageContent>
  );
}
