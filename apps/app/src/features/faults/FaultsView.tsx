"use client";

import { Toast } from "@heroui/react";
import {
  FAULT_CATEGORY_LABEL,
  FAULT_TAB_LABEL,
  type FaultListItem,
  type FaultListPage,
  type FaultTab,
  FaultTab as FaultTabSchema,
  type OperatorTeamMember,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  EmptyBlock,
  Icon,
  PageContent,
  StatusChip,
  UnitCell,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { raiseFault } from "./actions";
import { FaultPanel } from "./FaultPanel";
import { ReportFaultDialog } from "./ReportFaultDialog";
import { ageWords, BOARD_COLUMNS } from "./shared";

export type FaultListTab = FaultTab | "all";

export interface FaultsQuery {
  tab: FaultListTab;
  unitId: string | null;
  q: string;
  page: number;
}

const ALL_UNITS = "all";

/** The fault's first photo as a small thumbnail (with how many there are), or a wrench without photos. */
function PhotoMark({ url, count }: { url: string | null; count: number }) {
  if (count === 0 || !url) {
    return (
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-default text-muted"
        aria-hidden="true"
      >
        <Icon name={count > 0 ? "Camera" : "Wrench"} />
      </span>
    );
  }
  return (
    <span className="relative flex size-10 shrink-0" title={count === 1 ? "1 photo" : `${count} photos`}>
      {/* A short-lived read of the stored photo: not an optimisable static image. */}
      {/* biome-ignore lint/performance/noImgElement: signed storage URL */}
      <img src={url} alt="" loading="lazy" className="size-10 rounded-lg bg-default object-cover" />
      {count > 1 ? (
        <span className="absolute -right-1 -bottom-1 rounded-full bg-surface px-1 text-xs font-medium text-foreground tabular shadow-sm">
          {count}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Faults (P4): the tabs a fault moves through with their counts, a unit filter and a search (kept in the
 * URL), one table that becomes a list on a phone, and a side panel per fault with its
 * photos, timeline, moves, assignment, replies and paying the fixer.
 */
export function FaultsView({
  list,
  query,
  units,
  openId,
  team,
  today,
  canPay,
  canReply,
}: {
  list: FaultListPage;
  query: FaultsQuery;
  units: { id: string; label: string }[];
  openId: string | null;
  team: OperatorTeamMember[] | null;
  today: string;
  canPay: boolean;
  canReply: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query.q);
  const [selected, setSelected] = useState<string | null>(openId);
  const [raising, setRaising] = useState(false);
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (next: Partial<FaultsQuery>) => {
    const merged = { ...query, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.tab !== "all") params.set("tab", merged.tab);
    if (merged.unitId) params.set("unit", merged.unitId);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const onSearch = (value: string) => {
    setSearch(value);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => go({ q: value }), 300);
  };

  const total = Object.values(list.counts).reduce((s, n) => s + (n ?? 0), 0);
  const tabs = [
    { id: "all", label: "All", count: total },
    ...FaultTabSchema.options.map((t) => ({ id: t, label: FAULT_TAB_LABEL[t], count: list.counts[t] ?? 0 })),
  ];

  const manyBuildings = new Set(list.items.map((f) => f.propertyName)).size > 1;
  const columns = useMemo<DataColumn<FaultListItem>[]>(
    () => [
      {
        id: "fault",
        header: "Fault",
        isRowHeader: true,
        sortValue: (f) => f.title,
        cell: (f) => (
          <div className="flex min-w-0 items-center gap-3">
            <PhotoMark url={f.thumbUrl} count={f.photoCount} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{f.title}</span>
              <span className="truncate text-xs text-muted">
                {[f.reference, f.category ? FAULT_CATEGORY_LABEL[f.category] : null].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "unit",
        header: "Unit",
        sortValue: (f) => f.unitLabel,
        cell: (f) =>
          f.unitLabel ? (
            <UnitCell label={f.unitLabel} secondary={manyBuildings ? (f.propertyName ?? undefined) : undefined} />
          ) : (
            <span className="text-muted">-</span>
          ),
      },
      {
        id: "tenant",
        header: "Tenant",
        hideBelow: "lg",
        sortValue: (f) => f.tenantName,
        cell: (f) => f.tenantName ?? <span className="text-muted">Vacant</span>,
      },
      {
        id: "status",
        header: "Status",
        sortValue: (f) => BOARD_COLUMNS.indexOf(f.status),
        cell: (f) => <StatusChip kind="fault" status={f.status} />,
      },
      {
        id: "age",
        header: "Reported",
        align: "end",
        sortValue: (f) => f.reportedAt,
        cell: (f) => (
          <span className="whitespace-nowrap text-sm text-muted tabular">{ageWords(f.reportedAt, today)}</span>
        ),
      },
    ],
    [manyBuildings, today],
  );

  const raiseButton =
    units.length > 0 ? (
      <ActionButton icon="Plus" intent="primary" onPress={() => setRaising(true)}>
        Report a fault
      </ActionButton>
    ) : null;

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <AreaHeader actions={raiseButton} />

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable
          label="Faults"
          noun={{ one: "fault", many: "faults" }}
          rows={list.items}
          rowKey={(f) => f.id}
          columns={columns}
          onRowAction={(f) => setSelected(f.id)}
          search={{ placeholder: "Fault, unit or tenant", value: search, onChange: onSearch }}
          filters={[
            {
              id: "stage",
              name: "Stage",
              options: tabs,
              value: query.tab,
              onChange: (key) => go({ tab: key as FaultListTab }),
            },
            ...(units.length > 1
              ? [
                  {
                    id: "unit",
                    name: "Unit",
                    icon: "FolderHouse" as const,
                    options: [{ id: ALL_UNITS, label: "All" }, ...units],
                    value: query.unitId ?? ALL_UNITS,
                    onChange: (v: string) => go({ unitId: v === ALL_UNITS ? null : v }),
                  },
                ]
              : []),
          ]}
          onClearFilters={() => {
            setSearch("");
            go({ tab: "all", q: "", unitId: null });
          }}
          pages={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: (page) => go({ page }) }}
          mobile={{
            leading: (f) => <PhotoMark url={f.thumbUrl} count={f.photoCount} />,
            title: (f) => f.title,
            description: (f) =>
              [f.unitLabel ? `Unit ${f.unitLabel}` : null, f.tenantName, ageWords(f.reportedAt, today)]
                .filter(Boolean)
                .join(" · "),
            trailing: (f) => <StatusChip kind="fault" status={f.status} />,
          }}
          empty={<EmptyBlock icon="Wrench" title="No faults reported" action={raiseButton ?? undefined} />}
        />
      </div>

      {selected ? (
        <FaultPanel
          key={selected}
          faultId={selected}
          team={team}
          canPay={canPay}
          canReply={canReply}
          onClose={() => {
            setSelected(null);
            if (openId) go({});
          }}
        />
      ) : null}
      {raising ? (
        <ReportFaultDialog
          title="Report a fault"
          units={units}
          create={async (draft) => {
            const r = await raiseFault(draft);
            return r.ok ? { ok: true, value: { id: r.value.id, reference: r.value.reference } } : r;
          }}
          photoRoute={(id) => `/api/rentals/forms/faults/${id}/photos`}
          onClose={() => setRaising(false)}
          onSaved={(id) => {
            setRaising(false);
            setSelected(id);
          }}
        />
      ) : null}
    </PageContent>
  );
}
