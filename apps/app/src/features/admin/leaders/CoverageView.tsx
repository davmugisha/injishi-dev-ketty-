"use client";

import type { LeaderCoverage } from "@injishi/contracts";
import {
  ActionLink,
  DataTable,
  EmptyBlock,
  FilterTabs,
  formatDay,
  formatNumber,
  IconAction,
  KpiStrip,
  ListToolbar,
  PageContent,
  PageHeader,
  SectionCard,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Gap = LeaderCoverage["uncovered"][number];

/** The appointment form, opened on the leaders page with this role and place. */
function appointHref(g: Pick<Gap, "role" | "provinceId" | "districtId" | "sectorId" | "cellId" | "villageId">): string {
  const q = new URLSearchParams({ appoint: g.role });
  for (const [k, v] of Object.entries({
    aProvinceId: g.provinceId,
    aDistrictId: g.districtId,
    aSectorId: g.sectorId,
    aCellId: g.cellId,
    aVillageId: g.villageId,
  })) {
    if (v) q.set(k, String(v));
  }
  return `/admin/leaders?${q}`;
}

const PER_LEVEL: Record<Gap["level"], [string, string]> = {
  village: ["village", "villages"],
  cell: ["cell", "cells"],
  sector: ["sector", "sectors"],
  district: ["district", "districts"],
};

/**
 * Coverage (P5): for each local leader role, how many areas with rented homes have someone in the post
 * (and how many in all Rwanda); the areas with homes and nobody in the post, each with Appoint; the
 * guests waiting for a leader; and the leaders who have guests and never opened one. Downloads as CSV.
 */
export function CoverageView({ coverage, canAppoint }: { coverage: LeaderCoverage; canAppoint: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "waiting">("all");
  const keyOf = (g: Pick<Gap, "role" | "districtId" | "sectorId" | "cellId" | "villageId">) =>
    `${g.role}-${g.districtId}-${g.sectorId}-${g.cellId}-${g.villageId}`;
  const since = new Map(coverage.waiting.map((w) => [keyOf(w), w.oldestArrival]));
  const waitingGaps = coverage.uncovered.filter((g) => g.waitingReports > 0);
  const gaps = tab === "waiting" ? waitingGaps : coverage.uncovered;
  return (
    <PageContent>
      <PageHeader
        title="Coverage"
        description={`As of ${formatDay(coverage.generatedAt, "long")}`}
        actions={
          <>
            <ActionLink href="/admin/leaders" icon="Persons">
              Leaders and officers
            </ActionLink>
            <ActionLink href="/api/admin/leaders/coverage.csv" icon="ArrowDownToLine" prefetch={false}>
              CSV
            </ActionLink>
          </>
        }
      />

      <KpiStrip
        label="Areas with rented homes and someone in the post"
        items={coverage.roles.map((r) => ({
          id: r.role,
          label: r.roleLabel.replace(" (Umudugudu)", ""),
          value: r.withHomes.covered,
          format: "count" as const,
          progress: r.withHomes.areas > 0 ? Math.round((r.withHomes.covered / r.withHomes.areas) * 100) : 0,
          status: r.withHomes.areas > r.withHomes.covered ? ("warning" as const) : undefined,
          footnote: `of ${formatNumber(r.withHomes.areas)} ${PER_LEVEL[r.level][r.withHomes.areas === 1 ? 0 : 1]} with homes`,
        }))}
      />

      <SectionCard title="Posts to fill" contentClassName="gap-3">
        <ListToolbar
          tabs={
            <FilterTabs
              label="Posts to fill"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(k === "waiting" ? "waiting" : "all")}
              tabs={[
                { id: "all", label: "Areas with homes", count: coverage.uncovered.length },
                { id: "waiting", label: "Guests waiting", count: waitingGaps.length },
              ]}
            />
          }
        />
        <DataTable<Gap>
          label="Areas with homes and nobody in the post"
          rows={gaps}
          rowKey={keyOf}
          onRowAction={canAppoint ? (g) => router.push(appointHref(g)) : undefined}
          empty={<EmptyBlock size="sm" icon="CircleCheck" title="Every area with homes has its leaders" />}
          columns={[
            {
              id: "area",
              header: "Area",
              isRowHeader: true,
              sortValue: (g) => g.area,
              cell: (g) => <span className="whitespace-normal">{g.area}</span>,
            },
            { id: "role", header: "Post", sortValue: (g) => g.roleLabel, cell: (g) => g.roleLabel },
            {
              id: "homes",
              header: "Homes",
              align: "end",
              sortValue: (g) => g.homes,
              cell: (g) => <span className="tabular">{formatNumber(g.homes)}</span>,
            },
            {
              id: "waiting",
              header: "Guests waiting",
              align: "end",
              sortValue: (g) => g.waitingReports,
              cell: (g) =>
                g.waitingReports > 0 ? (
                  <span className="font-medium text-warning tabular">{formatNumber(g.waitingReports)}</span>
                ) : (
                  <span className="text-muted tabular">0</span>
                ),
            },
            {
              id: "since",
              header: "Since",
              hideBelow: "lg",
              sortValue: (g) => since.get(keyOf(g)) ?? "",
              cell: (g) => {
                const at = since.get(keyOf(g));
                return at ? formatDay(at) : <span className="text-muted">-</span>;
              },
            },
          ]}
          rowActions={
            canAppoint
              ? (g) => (
                  <IconAction
                    icon="PersonPlus"
                    label={`Appoint for ${g.area}`}
                    onPress={() => router.push(appointHref(g))}
                  />
                )
              : undefined
          }
          mobile={{
            title: (g) => g.area,
            description: (g) => `${g.roleLabel} · ${g.homes === 1 ? "1 home" : `${formatNumber(g.homes)} homes`}`,
            trailing: (g) => <span className="text-sm tabular">{formatNumber(g.waitingReports)} waiting</span>,
          }}
        />
      </SectionCard>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="Leaders who never opened a guest" className="h-full" contentClassName="gap-0">
          <DataTable
            label="Leaders who never opened a guest"
            rows={coverage.neverOpened}
            rowKey={(n) => n.assignmentId}
            empty={<EmptyBlock size="sm" icon="Eye" title="Every leader with guests has opened them" />}
            columns={[
              {
                id: "leader",
                header: "Leader",
                isRowHeader: true,
                cell: (n) => (
                  <div className="flex min-w-0 flex-col text-sm">
                    <span className="truncate">{n.name ?? n.email}</span>
                    <span className="truncate text-xs text-muted">
                      {n.roleLabel}, {n.area}
                    </span>
                  </div>
                ),
              },
              {
                id: "guests",
                header: "Guests",
                align: "end",
                sortValue: (n) => n.delivered,
                cell: (n) => <span className="tabular">{formatNumber(n.delivered)}</span>,
              },
              {
                id: "first",
                header: "First guest",
                sortValue: (n) => n.firstDeliveredAt,
                cell: (n) => formatDay(n.firstDeliveredAt),
              },
            ]}
            mobile={{
              title: (n) => n.name ?? n.email,
              description: (n) => `${n.roleLabel} · since ${formatDay(n.firstDeliveredAt)}`,
              trailing: (n) => <span className="text-sm tabular">{formatNumber(n.delivered)}</span>,
            }}
          />
        </SectionCard>
        <SectionCard title="All Rwanda" className="h-full" contentClassName="gap-0">
          <DataTable
            label="Coverage across Rwanda"
            rows={coverage.roles}
            rowKey={(r) => r.role}
            columns={[
              { id: "role", header: "Post", isRowHeader: true, cell: (r) => r.roleLabel },
              {
                id: "areas",
                header: "Areas",
                align: "end",
                cell: (r) => <span className="tabular">{formatNumber(r.nationwide.areas)}</span>,
              },
              {
                id: "covered",
                header: "Filled",
                align: "end",
                cell: (r) => (
                  <span className="tabular">
                    {formatNumber(r.nationwide.covered)}
                    <span className="text-muted">
                      {" "}
                      ({r.nationwide.areas > 0 ? Math.round((r.nationwide.covered / r.nationwide.areas) * 100) : 0}%)
                    </span>
                  </span>
                ),
              },
            ]}
            mobile={{
              title: (r) => r.roleLabel,
              trailing: (r) => (
                <span className="text-sm tabular">
                  {formatNumber(r.nationwide.covered)} of {formatNumber(r.nationwide.areas)}
                </span>
              ),
            }}
          />
        </SectionCard>
      </div>
    </PageContent>
  );
}
