"use client";

import type { QueueCase, QueueId } from "@injishi/data/fixtures/oversight";
import {
  ActionLink,
  type DataColumn,
  DataTable,
  EmptyBlock,
  IconAction,
  PageContent,
  PersonCell,
  RowActions,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { HBar } from "./shared";

const QUEUE_LABEL: Record<QueueId, string> = { verification: "Verification", approval: "Approval", tax: "Tax" };

/**
 * The officer's queues (2026-10-30): every case waiting on this officer in one table, oldest due first,
 * with a queue filter (all by default) and a search. A row opens its case. The queues are the API's and
 * follow the officer's grants; a queue they do not hold is not offered.
 */
export function OfficerHomeView({
  cases,
  held,
  firstCaseHref,
}: {
  cases: QueueCase[];
  held: QueueId[];
  /** The oldest case waiting on this officer, or null when nothing waits. */
  firstCaseHref: string | null;
}) {
  const router = useRouter();
  const columns: DataColumn<QueueCase>[] = [
    {
      id: "case",
      header: "Business",
      isRowHeader: true,
      sortValue: (c) => c.business,
      cell: (c) => <PersonCell name={c.business} secondary={`${c.ref ?? c.id} · ${c.place}`} />,
    },
    {
      id: "type",
      header: "Type",
      hideBelow: "lg",
      sortValue: (c) => c.type,
      cell: (c) => (
        <span className="flex flex-col">
          <span>{c.type}</span>
          <span className="text-xs text-muted">{c.typeDetail}</span>
        </span>
      ),
    },
    { id: "queue", header: "Queue", sortValue: (c) => c.queue, cell: (c) => QUEUE_LABEL[c.queue] },
    {
      id: "age",
      header: "Waiting",
      sortValue: (c) => c.slaUsed,
      cell: (c) => (
        <span className="flex min-w-32 flex-col gap-1.5">
          <span className="text-sm tabular">
            {c.age} · <span className="text-muted">{c.sla}</span>
          </span>
          <HBar value={c.slaUsed} label={c.slaLabel} />
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (c) => (
        <StatusChip tone={c.statusTone === "accent" ? "info" : (c.statusTone ?? "default")}>{c.status}</StatusChip>
      ),
    },
    {
      id: "who",
      header: "Verified by",
      hideBelow: "xl",
      defaultHidden: !held.includes("approval"),
      cell: (c) => c.who,
    },
  ];
  const open = (c: QueueCase) => (c.action === "open" && c.href ? router.push(c.href) : undefined);
  return (
    <PageContent>
      <AreaHeader
        actions={
          firstCaseHref ? (
            <ActionLink href={firstCaseHref} icon="ArrowRight" intent="primary">
              Open next case
            </ActionLink>
          ) : null
        }
      />
      <DataTable
        label="Cases"
        noun={{ one: "case", many: "cases" }}
        rows={cases}
        rowKey={(c) => c.id}
        columns={columns}
        columnToggle
        defaultSort={{ column: "age", direction: "descending" }}
        search={{ placeholder: "Business or reference", text: (c) => `${c.business} ${c.ref ?? ""} ${c.place}` }}
        filters={
          held.length > 1
            ? [
                {
                  id: "queue",
                  name: "Queue",
                  options: [
                    { id: "all", label: "All" },
                    ...held.map((q) => ({
                      id: q,
                      label: QUEUE_LABEL[q],
                      count: cases.filter((c) => c.queue === q).length,
                    })),
                  ],
                  match: (c, v) => c.queue === v,
                },
              ]
            : []
        }
        onRowAction={open}
        rowActions={(c) =>
          c.action === "open" && c.href ? (
            <RowActions>
              <IconAction icon="ChevronRight" label={`Open ${c.business}`} onPress={() => open(c)} />
            </RowActions>
          ) : null
        }
        mobile={{
          title: (c) => c.business,
          description: (c) => `${QUEUE_LABEL[c.queue]} · ${c.age} · ${c.place}`,
          trailing: (c) => (
            <StatusChip tone={c.statusTone === "accent" ? "info" : (c.statusTone ?? "default")}>{c.status}</StatusChip>
          ),
        }}
        empty={
          <EmptyBlock
            icon="CircleCheck"
            title={held.length > 0 ? "Nothing waits on you" : "No review queue is delegated to you"}
          />
        }
      />
    </PageContent>
  );
}
