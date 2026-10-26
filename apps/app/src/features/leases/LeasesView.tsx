"use client";

import type { LeaseCounts, LeaseListItem, LeaseListPage, LeaseTab } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  FilterTabs,
  formatMoney,
  formatNumber,
  IconAction,
  type IconKey,
  ListToolbar,
  Money,
  PageContent,
  PageHeader,
  PersonCell,
  RowActions,
  SearchBar,
  StatusChip,
  UnitCell,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { LEASE_TABS, leaseHref, TAB_LABEL } from "./shared";

export type LeaseListTab = LeaseTab | "all";

export interface LeasesQuery {
  tab: LeaseListTab;
  q: string;
  page: number;
}

/** Tabs always shown; the others appear once something is under them, or while chosen. */
const ALWAYS_TABS: readonly LeaseTab[] = ["to_sign", "active"];

/** The one step the landlord can take on a lease from the list, as the record opens it (`?open=`). */
function nextStep(
  lease: LeaseListItem,
  today: string,
  can: { manage: boolean; sign: boolean; record: boolean },
): { icon: IconKey; label: string; open: string; disabledReason?: string } | null {
  switch (lease.status) {
    case "draft":
      return can.sign ? { icon: "PencilToSquare", label: "Review and sign", open: "sign" } : null;
    case "pending_signature":
      return can.manage ? { icon: "PaperPlane", label: "Resend the invitation", open: "resend" } : null;
    case "signed":
      if (!can.manage) return null;
      return lease.startDate > today
        ? { icon: "CirclePlay", label: "Start the tenancy", open: "start", disabledReason: "Not before its start date" }
        : { icon: "CirclePlay", label: "Start the tenancy", open: "start" };
    case "active":
    case "ending":
      return can.record ? { icon: "Bell", label: "Send a reminder", open: "remind" } : null;
    default:
      return null;
  }
}

/**
 * Leases (WP 2.4): the tabs a lease lives through with their counts, a search, one table that becomes a
 * list on a phone, and the next step on each row. The tab, the search and the page are the URL's.
 */
export function LeasesView({
  list,
  counts,
  query,
  today,
  canManage,
  canSign,
  canRecord,
}: {
  list: LeaseListPage;
  counts: LeaseCounts;
  query: LeasesQuery;
  today: string;
  canManage: boolean;
  canSign: boolean;
  canRecord: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query.q);
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (next: Partial<LeasesQuery>) => {
    const merged = { ...query, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.tab !== "all") params.set("tab", merged.tab);
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

  const tabs = [
    { id: "all", label: "All", count: counts.total },
    ...LEASE_TABS.filter((t) => ALWAYS_TABS.includes(t) || (counts.counts[t] ?? 0) > 0 || query.tab === t).map((t) => ({
      id: t,
      label: TAB_LABEL[t],
      count: counts.counts[t] ?? 0,
    })),
  ];

  const manyBuildings = new Set(list.items.map((l) => l.unit.propertyName)).size > 1;
  const columns = useMemo<DataColumn<LeaseListItem>[]>(
    () => [
      {
        id: "tenant",
        header: "Tenant",
        isRowHeader: true,
        sortValue: (l) => l.tenant.fullName,
        cell: (l) => <PersonCell name={l.tenant.fullName} secondary={l.tenant.email ?? "No email yet"} />,
      },
      {
        id: "unit",
        header: "Unit",
        sortValue: (l) => l.unit.label,
        cell: (l) => (
          <UnitCell
            label={l.unit.label}
            secondary={manyBuildings ? `${l.reference} · ${l.unit.propertyName}` : l.reference}
          />
        ),
      },
      {
        id: "term",
        header: "Term",
        sortValue: (l) => l.startDate,
        cell: (l) => (
          <span className="whitespace-nowrap tabular">
            <DateText value={l.startDate} /> to <DateText value={l.endDate} />
          </span>
        ),
      },
      {
        id: "rent",
        header: "Rent",
        align: "end",
        sortValue: (l) => l.monthlyRentRwf,
        cell: (l) => <Money value={l.monthlyRentRwf} />,
      },
      {
        id: "status",
        header: "Status",
        sortValue: (l) => l.status,
        cell: (l) => <StatusChip kind="lease" status={l.status} />,
      },
    ],
    [manyBuildings],
  );

  // The next step is each row's first action (its tooltip says it), not a column repeating the status.
  const shownColumns = columns;
  const filtered = query.tab !== "all" || query.q !== "";
  const pages = Math.max(1, Math.ceil(list.total / Math.max(1, list.pageSize)));
  const can = { manage: canManage, sign: canSign, record: canRecord };

  return (
    <PageContent>
      <PageHeader
        title="Leases"
        actions={
          canManage ? (
            <ActionLink href={screenHref("LeaseNew")} icon="Plus" intent="primary">
              New lease
            </ActionLink>
          ) : null
        }
      />

      <ListToolbar
        tabs={
          <FilterTabs
            label="Leases by stage"
            tabs={tabs}
            selectedKey={query.tab}
            onSelectionChange={(key) => go({ tab: key as LeaseListTab })}
          />
        }
      >
        <SearchBar label="Search leases" value={search} onChange={onSearch} placeholder="Tenant, unit or reference" />
      </ListToolbar>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={pending}>
        <DataTable
          label="Leases"
          rows={list.items}
          rowKey={(l) => l.id}
          columns={shownColumns}
          onRowAction={(l) => router.push(leaseHref(l.id))}
          rowActions={(l) => {
            const step = nextStep(l, today, can);
            return (
              <RowActions>
                {step ? (
                  <IconAction
                    icon={step.icon}
                    label={step.label}
                    disabledReason={step.disabledReason}
                    onPress={() => router.push(`${leaseHref(l.id)}?open=${step.open}`)}
                  />
                ) : null}
                <IconAction
                  icon="ChevronRight"
                  label={`Open lease ${l.reference}`}
                  onPress={() => router.push(leaseHref(l.id))}
                />
              </RowActions>
            );
          }}
          mobile={{
            title: (l) => l.tenant.fullName,
            description: (l) => [l.unit.label, l.reference, formatMoney(l.monthlyRentRwf)].join(" · "),
            trailing: (l) => <StatusChip kind="lease" status={l.status} />,
          }}
          empty={
            filtered ? (
              <EmptyBlock
                icon="Magnifier"
                title="No lease matches"
                description="Try another tab or search."
                action={
                  <ActionButton
                    icon="Xmark"
                    onPress={() => {
                      setSearch("");
                      go({ tab: "all", q: "" });
                    }}
                  >
                    Clear filters
                  </ActionButton>
                }
              />
            ) : (
              <EmptyBlock
                icon="FileText"
                title="No leases yet"
                description="Draft one for a vacant unit. The tenant reads and signs it online."
                action={
                  canManage ? (
                    <ActionLink href={screenHref("LeaseNew")} icon="Plus" intent="primary">
                      New lease
                    </ActionLink>
                  ) : undefined
                }
              />
            )
          }
        />
      </div>

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted tabular">
            Page {formatNumber(list.page)} of {formatNumber(pages)} · {formatNumber(list.total)} leases
          </span>
          <div className="flex gap-2">
            <ActionButton
              icon="ChevronLeft"
              size="sm"
              isDisabled={list.page <= 1}
              onPress={() => go({ page: list.page - 1 })}
            >
              Previous
            </ActionButton>
            <ActionButton
              icon="ChevronRight"
              iconPlacement="end"
              size="sm"
              isDisabled={list.page >= pages}
              onPress={() => go({ page: list.page + 1 })}
            >
              Next
            </ActionButton>
          </div>
        </nav>
      ) : null}
    </PageContent>
  );
}
