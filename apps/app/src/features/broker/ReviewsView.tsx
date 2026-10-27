import type { BrokerReviews } from "@injishi/contracts";
import { EmptyBlock, formatDay, formatNumber, KpiStrip, SectionCard, Stars } from "@injishi/ui";

/**
 * What landlords and tenants said about the broker (2026-10-25), on the earnings page since 2026-10-27:
 * the figures in the same panel as the page's other figures, the spread of stars, and every review,
 * newest first. Each side rates once the tenancy the broker brought has started.
 */
export function ReviewsSection({ data }: { data: BrokerReviews }) {
  const max = Math.max(1, ...data.breakdown);
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="flex scroll-mt-20 flex-col gap-4">
      <h2 id="reviews-title" className="text-lg font-semibold">
        Reviews
      </h2>
      <KpiStrip
        label="Reviews"
        items={[
          {
            id: "average",
            label: "Average rating",
            value: data.average ?? 0,
            format: "count",
            icon: "Star",
            footnote: data.average === null ? "No ratings yet" : "Out of 5 stars",
          },
          {
            id: "ratings",
            label: "Ratings",
            value: data.count,
            format: "count",
            icon: "Comments",
            footnote: "From landlords and tenants",
          },
          {
            id: "placed",
            label: "Tenancies started",
            value: data.placedCount,
            format: "count",
            icon: "Persons",
            footnote: "Each one can be rated",
          },
        ]}
      />
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <SectionCard title="Stars given">
          <ul className="flex flex-col gap-2" aria-label="Stars given">
            {data.breakdown.map((n, i) => {
              const stars = 5 - i;
              return (
                <li key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular text-muted">{stars}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-default">
                    <span className="block h-full rounded-full bg-warning" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right tabular text-muted">{formatNumber(n)}</span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
        <SectionCard title="What people said" className="lg:col-span-2">
          {data.reviews.length === 0 ? (
            <EmptyBlock
              size="sm"
              icon="Star"
              title="No reviews yet"
              description="Landlords and tenants rate you once a tenancy you brought has started."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.reviews.map((r) => (
                <li
                  key={`${r.ratedAt}-${r.from}-${r.raterName ?? ""}`}
                  className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={r.stars} size="size-3.5" />
                    <span className="text-xs text-muted">{formatDay(r.ratedAt, "short")}</span>
                  </span>
                  {r.comment ? <p className="text-sm text-pretty">{r.comment}</p> : null}
                  <span className="text-xs text-muted">
                    {r.from === "tenant" ? "Tenant" : "Landlord"}
                    {r.raterName ? `, ${r.raterName}` : ""}
                    {r.propertyName ? ` · ${r.propertyName}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </section>
  );
}
