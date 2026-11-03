"use client";

import type { LeaderCoverage } from "@injishi/contracts";
import { ActionLink, DataTable, EmptyBlock, formatDay, formatNumber, IconAction, PageContent } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { AreaHeader } from "@/components/shell/WorkspaceNav";

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

/**
 * Coverage (P5, 2026-10-30): the posts to fill, as one table: each area with rented homes and nobody in
 * a local leader post, with its homes and the guests waiting there, filtered by post and by whether
 * guests wait; each row opens the appointment form for that post and place. Downloads as CSV.
 */
export function CoverageView({ coverage, canAppoint }: { coverage: LeaderCoverage; canAppoint: boolean }) {
  const router = useRouter();
  const keyOf = (g: Pick<Gap, "role" | "districtId" | "sectorId" | "cellId" | "villageId">) =>
    `${g.role}-${g.districtId}-${g.sectorId}-${g.cellId}-${g.villageId}`;
  const since = new Map(coverage.waiting.map((w) => [keyOf(w), w.oldestArrival]));
  const posts = [...new Map(coverage.uncovered.map((g) => [g.role, g.roleLabel])).entries()];
  return (
    <PageContent>
      <AreaHeader />
      <DataTable<Gap>
        label="Posts to fill"
        noun={{ one: "post to fill", many: "posts to fill" }}
        rows={coverage.uncovered}
        rowKey={keyOf}
        onRowAction={canAppoint ? (g) => router.push(appointHref(g)) : undefined}
        search={{ placeholder: "Area", text: (g) => g.area }}
        filters={[
          {
            id: "post",
            name: "Post",
            options: [{ id: "all", label: "All" }, ...posts.map(([id, label]) => ({ id, label }))],
            match: (g, v) => g.role === v,
          },
          {
            id: "waiting",
            name: "Guests",
            icon: "PersonPlus",
            options: [
              { id: "all", label: "All" },
              {
                id: "waiting",
                label: "Guests waiting",
                count: coverage.uncovered.filter((g) => g.waitingReports > 0).length,
              },
            ],
            match: (g) => g.waitingReports > 0,
          },
        ]}
        toolbarEnd={
          <ActionLink href="/api/admin/leaders/coverage.csv" icon="ArrowDownToLine" size="sm" prefetch={false}>
            Export CSV
          </ActionLink>
        }
        empty={<EmptyBlock icon="CircleCheck" title="Every area with homes has its leaders" />}
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
            header: "Waiting since",
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
    </PageContent>
  );
}
