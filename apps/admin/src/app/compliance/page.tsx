import { ShieldCheck } from "lucide-react";

import { Badge } from "@injishi/ui";
import { getCompliance } from "@/lib/api/compliance";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import {
  presentComplianceArtifact,
  presentCompliancePrimary,
  presentComplianceStats,
  presentDsrRow,
} from "@/lib/present/compliance";
import type { SectionRow } from "@/lib/types";

export const metadata = { title: "Compliance" };

/**
 * F-A08 compliance — the artifacts on file and the data-subject requests open
 * against them.
 *
 * ONE READ. The counts and the two lists arrive together, so the tile saying
 * "two reviews overdue" and the table showing which two can never disagree.
 *
 * WHY THIS SCREEN NO LONGER USES `SectionPage`. That component draws one table
 * and has no empty state — with no rows it renders an empty `<tbody>`, which
 * reads exactly like a table that failed to load. Compliance has two lists that
 * empty independently and each needs to say so in words. Its prose panels went
 * with it: they named an invoice, a lodge and a lease that only ever existed in
 * the fixture, and no contract field backs any of them.
 *
 * The classes below are `SectionPage`'s, so the section still looks like its
 * siblings.
 */
export default async function Page() {
  const result = await getCompliance();
  if (!result.ok) return <Unavailable reason={result.reason} />;

  const { data } = result;
  const primary = presentCompliancePrimary(data);
  const stats = presentComplianceStats(data);
  // Called with one argument deliberately: `presentComplianceArtifact` takes an
  // optional `now` for the review clock, and a bare `.map(fn)` would hand it
  // the array index in place of the current date — every artifact would then be
  // measured against 1 January 1970 and read as wildly overdue.
  const artifacts = data.artifacts.map((artifact) => presentComplianceArtifact(artifact));

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <section className="rounded-card border border-border bg-field p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-wide">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Money &amp; compliance
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground">
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="font-display text-3xl font-bold">Compliance</h2>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              The NCSA registration, the DPO of record, the DPIAs and the processor inventory — with
              the data-subject requests running against them.
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
          <div key={stat.label} className="rounded-card bg-card p-4 text-card-foreground">
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

      <RowTable
        heading="Data-subject requests"
        caption="Data-subject requests and the state of each"
        rows={data.requests.map(presentDsrRow)}
        empty="Nobody has asked for their data. A request appears here the moment one is raised, with the clock the law gives it."
      />

      <RowTable
        heading="Compliance artifacts"
        caption="Registrations, appointments, assessments and the processor inventory"
        rows={artifacts}
        empty="No compliance artifact is on file yet. The NCSA registration, the DPO appointment, each DPIA and every processor lands on this list as it is recorded — an empty one means none has been."
      />
    </div>
  );
}

/**
 * One of the two lists.
 *
 * The colours come from `lib/present/compliance.ts`, where the review clock
 * decides them: overdue is red, due inside thirty days amber, and an artifact
 * that was never due is neutral because nothing is late that had no date.
 */
function RowTable({
  heading,
  caption,
  rows,
  empty,
}: {
  heading: string;
  caption: string;
  rows: SectionRow[];
  empty: string;
}) {
  return (
    <section className="mt-8" aria-label={heading}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {heading}
      </h2>
      {rows.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-4">Kind</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Context</th>
                <th className="p-4">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={`${row.ref}-${row.subject}-${i}`}>
                  <td className="p-4 font-semibold">{row.ref}</td>
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
  );
}

/**
 * The read failed, so there is nothing to draw.
 *
 * The whole screen, because the counts and both lists come from the one call.
 * Empty lists here would say "no request is open and nothing is overdue", which
 * is the most dangerous wrong sentence this section could print.
 */
function Unavailable({ reason }: { reason: ApiFailure }) {
  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="animate-arrive rounded-card border border-border bg-field p-6 sm:p-7">
        <p className="text-base font-semibold">
          {failureHeading(reason, "admin.compliance.view")}
        </p>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {apiFailureMessage(reason)}
        </p>
        <FailureNextStep reason={reason} />
      </div>
    </div>
  );
}
