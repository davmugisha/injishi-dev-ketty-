import Link from "next/link";

import { Badge, Card, CardDescription, CardTitle } from "@injishi/ui";
import { listBrokers, listReveals } from "@/lib/api/brokers";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import { EMPTY, count, money } from "@/lib/present/format";
import { presentBrokerRow, presentRevealEvent } from "@/lib/present/brokers";
import { STAT_NOTE, STAT_TERM, STAT_TILE, STAT_VALUE } from "@/lib/stat-tile";

import { BrokerDirectory } from "./broker-directory";

export const metadata = { title: "Brokers" };

/**
 * F-A05 broker administration & reveal-contact fraud oversight.
 *
 * TWO READS, EACH FAILING ON ITS OWN, because the roster and the reveal log
 * answer different questions and a staffer who can see one is not helped by a
 * page that refuses both.
 *
 * A NOTE ON THE STAT TILES. The first two are `meta.total` — the count before
 * paging, so they are true of the platform. The last two are summed over the
 * brokers ON THIS PAGE and say so, because the contract sends no platform
 * aggregate for either and a page total printed as a platform total is the
 * console reporting a slice as the whole.
 */
export default async function Page() {
  const [brokers, reveals] = await Promise.all([listBrokers(), listReveals()]);

  const listed = brokers.ok ? brokers.data.items : [];
  const placements = listed.reduce((sum, b) => sum + b.placementCount, 0);
  const fees = listed.reduce((sum, b) => sum + b.placementFeesRwf, 0);
  // The currency comes off the rows, never hardcoded: a wrong currency on a
  // money tile is the most expensive kind of wrong. With no rows there is no
  // currency to name, and the tile shows an em dash rather than "RWF 0".
  const currency = listed[0]?.currency ?? null;

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card as="dl" className={STAT_TILE}>
          <CardTitle className={STAT_TERM}>Brokers</CardTitle>
          <CardDescription className={`${STAT_VALUE} text-3xl`}>
            {brokers.ok ? count(brokers.data.meta.total) : EMPTY}
          </CardDescription>
          <dd className={STAT_NOTE}>
            {brokers.ok ? "registered rental agents" : "not counted — the read did not answer"}
          </dd>
        </Card>
        <Card as="dl" className={STAT_TILE}>
          <CardTitle className={STAT_TERM}>Reveals logged</CardTitle>
          <CardDescription className={`${STAT_VALUE} text-3xl`}>
            {reveals.ok ? count(reveals.data.meta.total) : EMPTY}
          </CardDescription>
          <dd className={STAT_NOTE}>
            {reveals.ok ? "every one logged" : "not counted — the read did not answer"}
          </dd>
        </Card>
        <Card as="dl" className={STAT_TILE}>
          <CardTitle className={STAT_TERM}>Placements</CardTitle>
          <CardDescription className={`${STAT_VALUE} text-3xl`}>
            {brokers.ok ? count(placements) : EMPTY}
          </CardDescription>
          <dd className={STAT_NOTE}>across the {listed.length} brokers listed</dd>
        </Card>
        <Card as="dl" className={STAT_TILE}>
          <CardTitle className={STAT_TERM}>Placement fees</CardTitle>
          <CardDescription className={`${STAT_VALUE} text-2xl`}>
            {money(currency === null ? null : fees, currency ?? "")}
          </CardDescription>
          <dd className={STAT_NOTE}>across the {listed.length} brokers listed</dd>
        </Card>
      </div>

      {brokers.ok ? (
        <BrokerDirectory
          rows={brokers.data.items.map((b) => ({
            // The id rides beside the presented row: suspension is a real
            // write now, and it is addressed by id, never by display name.
            id: b.id,
            row: presentBrokerRow(b),
          }))}
        />
      ) : (
        <Unavailable title="Directory — licensed rental agents" reason={brokers.reason} />
      )}

      {/* Reveal-contact event log */}
      {reveals.ok ? (
        <section className="mt-8" aria-label="Reveal-contact event log">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Reveal-contact event log{" "}
            <Badge variant="default">the anti-harvesting trail (F-R09)</Badge>
          </h2>
          {reveals.data.items.length === 0 ? (
            <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
              No broker has revealed a landlord&apos;s contact yet. Every reveal
              that happens lands here — an empty log means none has.
            </div>
          ) : (
            <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
              <table className="w-full min-w-[44rem] text-sm">
                <caption className="sr-only">
                  Every landlord-contact reveal by brokers, newest first
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="p-4">When</th>
                    <th className="p-4">Broker</th>
                    <th className="p-4">Landlord</th>
                    <th className="p-4">District</th>
                    <th className="p-4">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reveals.data.items.map((raw) => {
                    const event = presentRevealEvent(raw);
                    return (
                      <tr key={raw.id}>
                        <td className="money p-4 text-xs">{event.when}</td>
                        <td className="p-4">{event.broker}</td>
                        <td className="p-4">{event.unit}</td>
                        <td className="p-4">{event.district}</td>
                        <td className="p-4">
                          <Badge variant={event.outcome.intent}>{event.outcome.text}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            The revealed phone and email are deliberately NOT on these rows — replaying them into an
            admin list would hand every staff member the directory the credit system exists to
            meter. What a reveal happened is the audit;{" "}
            <Link href="/audit" className="font-semibold text-accent-text hover:underline">
              the record-access log
            </Link>{" "}
            records who read a person.
          </p>
        </section>
      ) : (
        <Unavailable title="Reveal-contact event log" reason={reveals.reason} />
      )}
    </div>
  );
}

/**
 * One panel could not be read.
 *
 * Named, so a staffer can tell which half of the screen failed. The sentence
 * comes from `apiFailureMessage`, which keeps `unreachable` from being worded
 * as a refusal of this account's access.
 */
function Unavailable({ title, reason }: { title: string; reason: ApiFailure }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-3 animate-arrive rounded-card border border-border bg-field p-5">
        <p className="text-sm font-semibold">{failureHeading(reason, "admin.broker.view")}</p>
        <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {apiFailureMessage(reason)}
        </p>
        <FailureNextStep reason={reason} />
      </div>
    </section>
  );
}
