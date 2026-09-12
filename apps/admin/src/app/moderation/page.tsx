import { Flag } from "lucide-react";

import { Badge } from "@injishi/ui";
import { getModeration } from "@/lib/api/moderation";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import {
  presentEscalation,
  presentModeratedReview,
  presentModerationPrimary,
  presentModerationStats,
  presentSupportTicket,
} from "@/lib/present/moderation";
import type { SectionRow } from "@/lib/types";

export const metadata = { title: "Moderation & support" };

/**
 * F-A12 moderation & support.
 *
 * ONE READ, THREE LISTS. Reviews, tickets and escalations are one backlog seen
 * from three angles — a review gets reported, the report becomes a ticket, the
 * ticket escalates — so they arrive together and are shown together.
 *
 * WHY THIS SCREEN NO LONGER USES `SectionPage`. That component draws a hero, a
 * stat row, three prose panels and ONE table, and it has no empty state: with
 * no rows it renders an empty `<tbody>`, which is indistinguishable from a
 * table that failed to load. This section has three lists that empty
 * independently, and each needs to say so in words. The panels went with it:
 * they were fixture prose naming invented tickets ("Guest no-show dispute and
 * photo-mismatch report need Ops ownership") and no contract field backs them,
 * so they are gone rather than rewritten into vaguer invention.
 *
 * The classes below are the ones `SectionPage` uses, so the section still looks
 * like its siblings.
 */
export default async function Page() {
  const result = await getModeration();
  if (!result.ok) return <Unavailable reason={result.reason} />;

  const { data } = result;
  const primary = presentModerationPrimary(data);
  const stats = presentModerationStats(data);

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
                <Flag className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="font-display text-3xl font-bold">Moderation &amp; support</h2>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              Escalations, trust and safety decisions, and the support backlog behind them.
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
        heading="Escalations"
        caption="Escalations, open first"
        rows={data.escalations.map(presentEscalation)}
        empty="Nothing has been escalated. An escalation is something that already failed to be handled one level down — none means the level below is holding."
      />

      <RowTable
        heading="Support tickets"
        caption="Support tickets and their response clock"
        rows={data.tickets.map(presentSupportTicket)}
        empty="No support ticket is open. Nobody has asked for help that is still waiting."
      />

      <RowTable
        heading="Reviews in moderation"
        caption="Guest reviews reported or held for moderation"
        rows={data.reviews.map(presentModeratedReview)}
        empty="No review is held for moderation. Reviews reach this list only when they are reported or flagged."
      />
    </div>
  );
}

/**
 * One of the three worklists.
 *
 * Rows come already coloured and worded from `lib/present/moderation.ts`;
 * nothing on this screen decides an intent. The empty line is a statement about
 * the platform, which is why it is written per list rather than shared: "no
 * ticket is open" and "nothing has been escalated" are different pieces of good
 * news, and one sentence covering both would say neither.
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
                <th className="p-4">Raised</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Context</th>
                <th className="p-4">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={`${row.ref}-${row.subject}-${i}`}>
                  <td className="money p-4 text-xs font-semibold">{row.ref}</td>
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
 * The read failed, so there is no backlog to draw.
 *
 * The whole screen, because all three lists and both stat rows come from the
 * one call: drawing empty lists instead would state that nothing is escalated
 * and nobody needs help, which is a different — and possibly very wrong —
 * sentence from "we could not ask". `apiFailureMessage` supplies the words so
 * `unreachable` says nothing about the caller's access.
 */
function Unavailable({ reason }: { reason: ApiFailure }) {
  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="animate-arrive rounded-card border border-border bg-field p-6 sm:p-7">
        <p className="text-base font-semibold">
          {failureHeading(reason, "admin.moderation.act")}
        </p>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {apiFailureMessage(reason)}
        </p>
        <FailureNextStep reason={reason} />
      </div>
    </div>
  );
}
