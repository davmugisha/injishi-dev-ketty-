import { Languages } from "lucide-react";

import { Badge } from "@injishi/ui";
import { SectionFailure } from "@/components/failure/section-failure";
import { getLocalization } from "@/lib/api/localization";
import {
  presentCoveragePrimary,
  presentCoverageStats,
  presentEmailTemplate,
  presentTranslationEntry,
} from "@/lib/present/localization";

export const metadata = { title: "Localization" };

/** The permission `GET /api/v1/admin/localization` declares. */
const PERMISSION = "admin.localization.edit";

/**
 * Localization (F-A15) — translations and email templates, from the API.
 *
 * COVERAGE COMES FROM THE SERVER AND IS NOT COUNTED HERE. `coverage` spans
 * every key the platform has; `entries` is whatever this response chose to
 * carry. Counting the array would report the state of a slice as the state of
 * the platform, and on a screen whose whole subject is what is missing, that is
 * the one arithmetic error that matters.
 *
 * An empty entry list is therefore NOT the same as 100% coverage, and the
 * headline says "not measured" rather than printing a perfect score nobody
 * earned — `presentCoveragePrimary` owns that rule.
 */
export default async function Page() {
  const result = await getLocalization();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <SectionFailure reason={result.reason} permission={PERMISSION} />
      </div>
    );
  }

  const data = result.data;
  const primary = presentCoveragePrimary(data);
  const stats = presentCoverageStats(data);
  const entries = data.entries.map(presentTranslationEntry);
  const templates = data.templates.map(presentEmailTemplate);

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
                <Languages className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">Localization</h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              English and Kinyarwanda copy, and the keys that have only one of
              them. A missing Kinyarwanda string is not a pending nicety — it is
              a person reading a screen in a language they did not choose.
            </p>
          </div>
          <div className="min-w-[16rem] rounded-card bg-card p-4 text-card-foreground">
            <p className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
              {primary.label}
            </p>
            <p className="figure mt-1 text-4xl font-bold">{primary.value}</p>
            <p className="mt-2">
              <Badge variant={primary.intent}>{primary.note}</Badge>
            </p>
          </div>
        </div>
      </section>

      <dl className="mt-6 grid gap-3 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-card bg-card p-4 text-card-foreground"
          >
            <dt className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
              {stat.label}
            </dt>
            <dd className="figure mt-1 text-3xl font-bold">{stat.value}</dd>
            <dd className="mt-2">
              <Badge variant={stat.intent}>{stat.note}</Badge>
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-8" aria-label="Translation keys">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Translation keys
        </h2>
        {entries.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">
              No translation key has been registered yet
            </p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              Keys arrive here as the product declares them. None exist on this
              platform so far, which is why the coverage figure above reads as
              unmeasured rather than complete.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">
                Every translation key, its text and whether Kinyarwanda exists
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Version</th>
                  <th className="p-4">Key</th>
                  <th className="p-4">Text</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((row, index) => (
                  // Keyed by the source row's id: `ref` on the presentation
                  // shape is a version number, and many keys share one.
                  <tr key={data.entries[index]!.id}>
                    <td className="money p-4 text-xs font-semibold">
                      {row.ref}
                    </td>
                    <td className="money p-4">{row.subject}</td>
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

      <section className="mt-8" aria-label="Email templates">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Email templates
        </h2>
        {templates.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">
              No email template has been registered yet
            </p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              Transactional and marketing templates appear here once they are
              stored. This platform holds none.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">
                Email templates and the language of their subject lines
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Version</th>
                  <th className="p-4">Template</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Kind</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((row, index) => (
                  <tr key={data.templates[index]!.id}>
                    <td className="money p-4 text-xs font-semibold">
                      {row.ref}
                    </td>
                    <td className="money p-4">{row.subject}</td>
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
