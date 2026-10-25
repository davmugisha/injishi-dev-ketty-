"use client";

import type { LeaderCoverage } from "@injishi/contracts";
import {
  ActionLink,
  DataTable,
  EmptyBlock,
  formatDay,
  formatNumber,
  IconAction,
  KpiStrip,
  PageContent,
  PageHeader,
  SectionCard,
} from "@injishi/ui";
import { useRouter } from "next/navigation";

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
  return (
    <PageContent>
      <PageHeader
        title="Coverage"
        description={`Where guests reach a leader, and where they wait. As of ${formatDay(coverage.generatedAt, "long")}.`}
        actions={
          <>
            <ActionLink href="/admin/leaders" icon="Persons">
              Leaders and officers
            </ActionLink>
            <ActionLink href="/api/admin/leaders/coverage.csv" icon="ArrowDownToLine" prefetch={false}>
              Download CSV
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

      <SectionCard
        title="Areas with homes and nobody in the post"
        description="Guests registered here reach nobody at that step until someone is appointed."
        contentClassName="gap-0"
      >
        <DataTable<Gap>
          label="Areas with homes and nobody in the post"
          rows={coverage.uncovered}
          rowKey={(g) => `${g.role}-${g.districtId}-${g.sectorId}-${g.cellId}-${g.villageId}`}
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
              cell: (g) => <span className="tabular">{formatNumber(g.waitingReports)}</span>,
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

      <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-2">
        <SectionCard title="Guests waiting for a leader" contentClassName="gap-0">
          <DataTable
            label="Guests waiting for a leader"
            rows={coverage.waiting}
            rowKey={(w) => `${w.role}-${w.districtId}-${w.sectorId}-${w.cellId}-${w.villageId}`}
            empty={<EmptyBlock size="sm" icon="CircleCheck" title="Nobody is waiting" />}
            columns={[
              {
                id: "area",
                header: "Area",
                isRowHeader: true,
                cell: (w) => <span className="whitespace-normal">{w.area}</span>,
              },
              { id: "role", header: "Post", cell: (w) => w.roleLabel },
              {
                id: "guests",
                header: "Guests",
                align: "end",
                sortValue: (w) => w.reports,
                cell: (w) => <span className="tabular">{formatNumber(w.reports)}</span>,
              },
              {
                id: "since",
                header: "Since",
                sortValue: (w) => w.oldestArrival,
                cell: (w) => formatDay(w.oldestArrival),
              },
            ]}
            mobile={{
              title: (w) => w.area,
              description: (w) => `${w.roleLabel} · since ${formatDay(w.oldestArrival)}`,
              trailing: (w) => <span className="text-sm tabular">{formatNumber(w.reports)}</span>,
            }}
          />
        </SectionCard>
        <SectionCard title="Leaders who never opened a guest" contentClassName="gap-0">
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
      </div>

      <SectionCard
        title="All Rwanda"
        description="Every area at each level, and how many have someone in the post."
        contentClassName="gap-0"
      >
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
              header: "With someone",
              align: "end",
              cell: (r) => <span className="tabular">{formatNumber(r.nationwide.covered)}</span>,
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
    </PageContent>
  );
}
