"use client";

import type { BrokerReview, BrokerReviews } from "@injishi/contracts";
import { type DataColumn, DataTable, DateText, EmptyBlock, formatDay, PageContent, Stars } from "@injishi/ui";
import { AreaHeader } from "@/components/shell/WorkspaceNav";

const keyOf = (r: BrokerReview) => `${r.ratedAt}-${r.from}-${r.raterName ?? ""}-${r.stars}`;
const FROM = { tenant: "Tenant", landlord: "Landlord" } as const;

/**
 * What landlords and tenants said about the broker (2026-10-30): one table, newest first, with filters
 * for who rated and the stars. The average sits on the overview, not repeated here.
 */
export function ReviewsView({ data }: { data: BrokerReviews }) {
  const columns: DataColumn<BrokerReview>[] = [
    { id: "stars", header: "Stars", sortValue: (r) => r.stars, cell: (r) => <Stars value={r.stars} size="size-3.5" /> },
    {
      id: "comment",
      header: "Comment",
      isRowHeader: true,
      cell: (r) =>
        r.comment ? <span className="text-sm text-pretty">{r.comment}</span> : <span className="text-muted">-</span>,
    },
    {
      id: "from",
      header: "From",
      sortValue: (r) => r.raterName ?? r.from,
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.raterName ?? FROM[r.from]}</span>
          <span className="text-xs text-muted">{[FROM[r.from], r.propertyName].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    {
      id: "date",
      header: "Date",
      sortValue: (r) => r.ratedAt,
      cell: (r) => <DateText value={r.ratedAt.slice(0, 10)} />,
    },
  ];
  return (
    <PageContent>
      <AreaHeader />
      <DataTable
        label="Reviews"
        noun={{ one: "review", many: "reviews" }}
        rows={data.reviews}
        rowKey={keyOf}
        columns={columns}
        defaultSort={{ column: "date", direction: "descending" }}
        search={{
          placeholder: "Comment, name or building",
          text: (r) => `${r.comment ?? ""} ${r.raterName ?? ""} ${r.propertyName ?? ""}`,
        }}
        filters={[
          {
            id: "from",
            name: "From",
            icon: "Persons",
            options: [
              { id: "all", label: "All" },
              { id: "landlord", label: "Landlords" },
              { id: "tenant", label: "Tenants" },
            ],
            match: (r, v) => r.from === v,
          },
          {
            id: "stars",
            name: "Stars",
            icon: "Star",
            options: [
              { id: "all", label: "All" },
              ...[5, 4, 3, 2, 1].map((n, i) => ({ id: String(n), label: `${n} stars`, count: data.breakdown[i] ?? 0 })),
            ],
            match: (r, v) => r.stars === Number(v),
          },
        ]}
        mobile={{
          title: (r) => <Stars value={r.stars} size="size-3.5" />,
          description: (r) => (
            <span className="flex flex-col gap-1">
              {r.comment ? <span className="text-foreground">{r.comment}</span> : null}
              <span>
                {[r.raterName ?? FROM[r.from], r.propertyName, formatDay(r.ratedAt.slice(0, 10))]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          ),
        }}
        empty={
          <EmptyBlock
            icon="Star"
            title="No reviews yet"
            description="Landlords and tenants rate you once a tenancy you brought starts."
          />
        }
      />
    </PageContent>
  );
}
