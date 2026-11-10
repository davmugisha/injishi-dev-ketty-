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
import { useTranslations } from "next-intl";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { HBar } from "./shared";

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
  const t = useTranslations("officials.queue");
  const router = useRouter();
  const queueLabel: Record<QueueId, string> = { verification: t("verification"), approval: t("approval"), tax: t("tax") };
  const columns: DataColumn<QueueCase>[] = [
    {
      id: "case",
      header: t("business"),
      isRowHeader: true,
      sortValue: (c) => c.business,
      cell: (c) => <PersonCell name={c.business} secondary={`${c.ref ?? c.id} · ${c.place}`} />,
    },
    {
      id: "type",
      header: t("type"),
      hideBelow: "lg",
      sortValue: (c) => c.type,
      cell: (c) => (
        <span className="flex flex-col">
          <span>{c.type}</span>
          <span className="text-xs text-muted">{c.typeDetail}</span>
        </span>
      ),
    },
    { id: "queue", header: t("queue"), sortValue: (c) => c.queue, cell: (c) => queueLabel[c.queue] },
    {
      id: "age",
      header: t("waiting"),
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
      header: t("status"),
      cell: (c) => (
        <StatusChip tone={c.statusTone === "accent" ? "info" : (c.statusTone ?? "default")}>{c.status}</StatusChip>
      ),
    },
    {
      id: "who",
      header: t("verifiedBy"),
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
              {t("openNext")}
            </ActionLink>
          ) : null
        }
      />
      <DataTable
        label={t("cases")}
        noun={{ one: t("case"), many: t("casePlural") }}
        rows={cases}
        rowKey={(c) => c.id}
        columns={columns}
        columnToggle
        defaultSort={{ column: "age", direction: "descending" }}
        search={{ placeholder: t("search"), text: (c) => `${c.business} ${c.ref ?? ""} ${c.place}` }}
        filters={
          held.length > 1
            ? [
                {
                  id: "queue",
                  name: t("queue"),
                  options: [
                    { id: "all", label: t("all") },
                    ...held.map((q) => ({
                      id: q,
                      label: queueLabel[q],
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
              <IconAction icon="ChevronRight" label={t("openCase", { business: c.business })} onPress={() => open(c)} />
            </RowActions>
          ) : null
        }
        mobile={{
          title: (c) => c.business,
          description: (c) => `${queueLabel[c.queue]} · ${c.age} · ${c.place}`,
          trailing: (c) => (
            <StatusChip tone={c.statusTone === "accent" ? "info" : (c.statusTone ?? "default")}>{c.status}</StatusChip>
          ),
        }}
        empty={
          <EmptyBlock
            icon="CircleCheck"
            title={held.length > 0 ? t("nothingWaits") : t("noQueue")}
          />
        }
      />
    </PageContent>
  );
}
