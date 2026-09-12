import { ScrollText } from "lucide-react";

import { Badge } from "@injishi/ui";
import { listAccessLogs, listAudit } from "@/lib/api/audit";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import { presentAccessLogRow, presentAuditRow } from "@/lib/present/audit";
import { EMPTY, count } from "@/lib/present/format";
import type { SectionRow } from "@/lib/types";

export const metadata = { title: "Audit & data protection" };

/**
 * F-A10 audit & data protection.
 *
 * TWO READS THAT MUST NOT BE MERGED. `audit` records what somebody DID;
 * `access-logs` records what somebody LOOKED AT. A staffer who reads a hundred
 * user records and changes nothing appears only in the second, and that is
 * precisely the pattern the second exists to catch — so they are two tables,
 * two calls, and two independent failure states.
 *
 * ALMOST NOTHING IS COLOURED, and that is `lib/present/audit.ts`'s discipline
 * rather than an omission here: an audit trail records what happened, and a
 * console that pre-judges which events were bad teaches its readers to scan for
 * red and miss everything else. The two exceptions are facts about HOW an
 * action was performed — an impersonated actor, a national-ID read — not
 * verdicts on it.
 *
 * WHY THIS SCREEN NO LONGER USES `SectionPage`. It draws one table and has no
 * empty state; this section has two, and an empty `<tbody>` on an audit trail
 * is indistinguishable from one that failed to load — the single worst
 * ambiguity this screen could carry. The stat tiles below therefore carry no
 * badge either: `lib/present/audit.ts` exports no stat mapping, and an intent
 * invented in a page would be exactly the pre-judgement the section refuses.
 */
export default async function Page() {
  const [events, reads] = await Promise.all([listAudit(), listAccessLogs()]);

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
                <ScrollText className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="font-display text-3xl font-bold">Audit &amp; data protection</h2>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              What was done, and what was looked at. Both are append-only: an audit trail a console
              can edit is not an audit trail.
            </p>
          </div>
          <div className="min-w-[16rem] rounded-card bg-card p-4 text-card-foreground">
            <p className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
              Record reads logged
            </p>
            <p className="figure mt-1 text-4xl font-bold">
              {reads.ok ? count(reads.data.meta.total) : EMPTY}
            </p>
            <p className="mt-2 text-xs text-card-foreground/60">
              {reads.ok
                ? "every one carries the reason its reader typed"
                : "not counted — the read did not answer"}
            </p>
          </div>
        </div>
      </section>

      <dl className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-card bg-card p-4 text-card-foreground">
          <dt className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
            Recorded events
          </dt>
          <dd className="figure mt-1 text-3xl font-bold">
            {events.ok ? count(events.data.meta.total) : EMPTY}
          </dd>
          <dd className="mt-2 text-xs text-card-foreground/60">
            {events.ok ? "append-only" : "not counted — the read did not answer"}
          </dd>
        </div>
        <div className="rounded-card bg-card p-4 text-card-foreground">
          <dt className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
            Record reads
          </dt>
          <dd className="figure mt-1 text-3xl font-bold">
            {reads.ok ? count(reads.data.meta.total) : EMPTY}
          </dd>
          <dd className="mt-2 text-xs text-card-foreground/60">
            {reads.ok ? "reason-gated, one row per subject" : "not counted — the read did not answer"}
          </dd>
        </div>
        <div className="rounded-card bg-card p-4 text-card-foreground">
          <dt className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
            Impersonated actions
          </dt>
          <dd className="figure mt-1 text-3xl font-bold">
            {events.ok
              ? count(events.data.items.filter((e) => e.impersonatedUserId !== null).length)
              : EMPTY}
          </dd>
          <dd className="mt-2 text-xs text-card-foreground/60">
            {/* Counted over the page in view, and it says so. The contract sends
                no platform aggregate for this, and a page count printed as a
                platform total is the console reporting a slice as the whole. */}
            {events.ok
              ? `of the ${events.data.items.length} events listed`
              : "not counted — the read did not answer"}
          </dd>
        </div>
      </dl>

      {events.ok ? (
        <RowTable
          heading="What was done"
          caption="Recorded actions, newest first"
          firstColumn="When"
          rows={events.data.items.map(presentAuditRow)}
          empty="Nothing has been recorded yet. Every admin action writes a row here, so an empty trail means none has been taken."
        />
      ) : (
        <Unavailable title="What was done" reason={events.reason} />
      )}

      {reads.ok ? (
        <>
          <RowTable
            heading="What was looked at"
            caption="Record-access log: who read whose identity data, and why"
            firstColumn="When"
            rows={reads.data.items.map(presentAccessLogRow)}
            empty="Nobody has read anybody's identity data. A row lands here the moment somebody does, carrying the reason they typed."
          />
          <p className="mt-3 text-xs text-muted-foreground">
            The reason is shown in full and never shortened into a code. The whole control is that a
            person had to state a purpose before the platform would show them a record; a log that
            hides what they typed gives back exactly what was gained.
          </p>
        </>
      ) : (
        <Unavailable title="What was looked at" reason={reads.reason} />
      )}
    </div>
  );
}

/** One of the two trails. Rows arrive worded and coloured from `lib/present/audit.ts`. */
function RowTable({
  heading,
  caption,
  firstColumn,
  rows,
  empty,
}: {
  heading: string;
  caption: string;
  firstColumn: string;
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
                <th className="p-4">{firstColumn}</th>
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
 * One trail could not be read.
 *
 * Named, because the two answer different questions and losing one is not
 * losing the other. It is emphatically NOT an empty table: on this screen the
 * difference between "nothing was recorded" and "we could not read what was
 * recorded" is the difference between a clean audit and a missing one.
 */
function Unavailable({ title, reason }: { title: string; reason: ApiFailure }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-3 animate-arrive rounded-card border border-border bg-field p-5">
        <p className="text-sm font-semibold">{failureHeading(reason, "admin.audit.read")}</p>
        <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {apiFailureMessage(reason)}
        </p>
        <FailureNextStep reason={reason} />
      </div>
    </section>
  );
}
