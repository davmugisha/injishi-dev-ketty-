import { Badge } from "@injishi/ui";
import type { SectionRow, SectionStat } from "@/lib/types";

/**
 * The fee schedule, as the platform currently holds it (F-A07 / F-A10).
 *
 * IT IS A SERVER COMPONENT AND NO LONGER A FORM. The version this replaces was
 * an editable table backed by a browser cookie: typing an amount there changed
 * what the registration wizard quoted on that one machine and nowhere else. It
 * was honest about being a prototype, but it was still a second source of truth
 * for a price, and `GET /api/v1/admin/configuration/fees` is now the first one.
 * There is no write route in the seam yet, so this screen reads.
 *
 * COLOCATED WITH ITS ROUTE, the way `app/users/user-directory.tsx` already is.
 * `components/` holds what more than one screen renders; this is a property of
 * exactly one screen, and moving it out would only split one page in two.
 *
 * It takes rows that `lib/present/configuration.ts` has already mapped. Nothing
 * is formatted here — money in particular, which crosses as integer francs plus
 * a currency and becomes text in `lib/present/format.ts` and nowhere else.
 */
export function FeeSchedule({
  stats,
  fees,
  plans,
}: {
  stats: SectionStat[];
  fees: SectionRow[];
  plans: SectionRow[];
}) {
  return (
    <>
      <dl className="grid gap-3 md:grid-cols-2">
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

      <section className="mt-8" aria-label="Registration fees">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Registration fee by business type
        </h2>
        {fees.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">No registration fee is set</p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              Nothing is being charged to register a business on this platform.
              A fee appears here once a row is written, and superseded rows stay
              visible beside it because a registration keeps the amount that was
              locked onto its invoice.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[42rem] text-sm">
              <caption className="sr-only">
                The one-time registration fee, per business type, with
                superseded amounts kept
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Business type</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Effective</th>
                  <th className="p-4">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fees.map((row) => (
                  <tr key={`${row.ref}-${row.context}-${row.subject}`}>
                    <td className="p-4 font-semibold">{row.ref}</td>
                    <td className="money p-4 font-bold">{row.subject}</td>
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

      <section className="mt-8" aria-label="Subscription plans">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Subscription plans
        </h2>
        {plans.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">No subscription plan exists</p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              Nothing is on sale to a business yet. Retired plans would be shown
              here too, so an empty table means none has ever been offered.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">
                Subscription plans, their price and what each includes
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Code</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Terms</th>
                  <th className="p-4">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((row) => (
                  <tr key={`${row.ref}-${row.subject}`}>
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
    </>
  );
}
