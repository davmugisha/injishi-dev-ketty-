import { ChartColumn } from "lucide-react";

import { Badge } from "@injishi/ui";
import { SectionFailure } from "@/components/failure/section-failure";
import { getAnalytics } from "@/lib/api/analytics";
import {
  presentAnalyticsSummary,
  presentSavedScope,
  presentSeries,
} from "@/lib/present/analytics";
import { count } from "@/lib/present/format";
import { presentKpis } from "@/lib/present/overview";

export const metadata = { title: "Analytics & insights" };

/** The permission `GET /api/v1/admin/analytics` declares. */
const PERMISSION = "admin.analytics.view";

/**
 * Analytics & insights (F-A14) — aggregated from `analytics_events`.
 *
 * THE EMPTY STATE IS THE POINT ON THIS SCREEN. `analytics_events` is written by
 * the product as people use it, so on a fresh database this page genuinely has
 * nothing to show — and "no events have been recorded yet" is a TRUE statement
 * about the platform, not a failure. The screen it replaces printed a 4.6%
 * search-to-book rate nobody measured, which is worse than an empty table in
 * the specific way that matters: somebody could act on it.
 *
 * Nothing is re-bucketed here. The server did the aggregation, and two
 * different bucketings of the same events produce two different-looking truths.
 */
export default async function Page() {
  const result = await getAnalytics();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <SectionFailure reason={result.reason} permission={PERMISSION} />
      </div>
    );
  }

  const data = result.data;
  const totals = presentKpis(data.totals);
  const series = data.series.map(presentSeries);
  const scopes = data.savedScopes.map(presentSavedScope);

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <section className="rounded-card border border-border bg-field p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-wide">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Platform
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground">
                <ChartColumn className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">
                Analytics &amp; insights
              </h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              Marketplace, growth, finance, supply and support analytics,
              aggregated on the server from recorded events and carrying no
              personal data.
            </p>
          </div>
          <div className="min-w-[16rem] rounded-card bg-card p-4 text-card-foreground">
            <p className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
              Series recorded
            </p>
            <p className="figure mt-1 text-4xl font-bold">
              {count(data.series.length)}
            </p>
            <p className="mt-2">
              <Badge variant="default">{presentAnalyticsSummary(data)}</Badge>
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6" aria-label="Analytics totals">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Totals
        </h2>
        {totals.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">No totals to report yet</p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              A total appears once the platform has recorded the events behind
              it. Nothing has been measured on this deployment so far.
            </p>
          </div>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {totals.map((kpi) =>
              // `empty: true` is a KPI the platform has no value for, which is
              // a different thing from a zero somebody measured.
              kpi.empty ? (
                <div
                  key={kpi.label}
                  className="rounded-card border border-dashed border-border p-4"
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {kpi.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-muted-foreground">
                    {kpi.value}
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    not measured yet
                  </dd>
                </div>
              ) : (
                <div
                  key={kpi.label}
                  className="rounded-card bg-card p-4 text-card-foreground"
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
                    {kpi.label}
                  </dt>
                  <dd className="figure mt-1 text-3xl font-bold">{kpi.value}</dd>
                  {kpi.noteBadge ? (
                    <dd className="mt-2">
                      <Badge variant={kpi.noteBadge.intent}>
                        {kpi.noteBadge.text}
                      </Badge>
                    </dd>
                  ) : null}
                </div>
              ),
            )}
          </dl>
        )}
      </section>

      <section className="mt-8" aria-label="Analytics series">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Series
        </h2>
        {series.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">No events recorded yet</p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              Series are built from the events the product writes as people use
              it. This platform has recorded none so far, so there is nothing to
              trend — that is a statement about the data, not about this screen.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[42rem] text-sm">
              <caption className="sr-only">
                Aggregated series, as the server bucketed them
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Key</th>
                  <th className="p-4">Series</th>
                  <th className="p-4">Range</th>
                  <th className="p-4">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {series.map((row) => (
                  <tr key={row.ref}>
                    <td className="money p-4 text-xs font-semibold">
                      {row.ref}
                    </td>
                    <td className="p-4">{row.subject}</td>
                    <td className="p-4 text-muted-foreground">{row.context}</td>
                    <td className="p-4">
                      <Badge variant={row.intent}>{row.state}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8" aria-label="Saved scopes">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Saved scopes
        </h2>
        {scopes.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">Nobody has saved a scope</p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              A scope is a filter a staff member kept for reuse. None have been
              saved on this platform.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[38rem] text-sm">
              <caption className="sr-only">
                Scopes staff have saved for reuse
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Saved</th>
                  <th className="p-4">Scope</th>
                  <th className="p-4">Detail</th>
                  <th className="p-4">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scopes.map((row, index) => (
                  // Keyed by the row's own index within the mapped list: a
                  // saved scope's presentation carries a date and a district,
                  // neither of which is unique, and `AdminSavedScope.id` is
                  // deliberately not on the presentation shape.
                  <tr key={`${row.ref}-${row.subject}-${index}`}>
                    <td className="money p-4 text-xs font-semibold">
                      {row.ref}
                    </td>
                    <td className="p-4">{row.subject}</td>
                    <td className="p-4 text-muted-foreground">{row.context}</td>
                    <td className="p-4">
                      <Badge variant={row.intent}>{row.state}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
