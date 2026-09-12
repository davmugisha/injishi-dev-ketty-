import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, TrendingUp, Zap } from "lucide-react";

import { Badge } from "@injishi/ui";
import { getOverview } from "@/lib/api/overview";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import { EMPTY } from "@/lib/present/format";
import {
  presentAdapters,
  presentDensity,
  presentKpis,
  presentQueues,
  presentRevenue,
  presentWorkQueue,
} from "@/lib/present/overview";

import { DensityList } from "./density-list";

export const metadata = { title: "Overview" };

const STATE_TONE = {
  up: "text-success",
  degraded: "text-warning",
  "dead-letter": "text-destructive",
} as const;

const STATE_DOT = {
  up: "bg-success",
  degraded: "bg-warning",
  "dead-letter": "bg-destructive",
} as const;

/**
 * F-A02 platform overview: adapter strip, supply density, work queue, KPIs.
 *
 * ONE READ ANSWERS THE WHOLE SCREEN. `GET /api/v1/admin/overview` is a single
 * statement about the platform at one instant; six requests would let its
 * halves disagree, and an overview whose adapter strip is younger than its KPIs
 * is an overview nobody can act on.
 *
 * Everything below renders from that answer or says plainly that there is
 * nothing to render. Nothing here is computed from a figure the API did not
 * send — the fixture this replaced carried a "384 active properties" headline
 * and a "93% retention" footnote that no contract field backs, and both are
 * gone rather than guessed at.
 */
export default async function Page() {
  const result = await getOverview();
  if (!result.ok) return <Unavailable reason={result.reason} />;

  const { data } = result;
  const adapters = presentAdapters(data.adapters);
  const queues = presentQueues(data.queues);
  const density = presentDensity(data.density);
  const workQueue = presentWorkQueue(data.workQueue);
  const kpis = presentKpis(data.kpis);
  const revenue = presentRevenue(data.revenue);

  // The strip is one row of cells built from two lists rather than one
  // flattened one: an adapter carries a mock/live mode and a BullMQ queue has
  // none, so merging them would mean inventing a mode beside a money queue.
  const strip: {
    name: string;
    state: "up" | "degraded" | "dead-letter";
    detail: string;
    deadCount?: number;
    mode: "mock" | "live" | null;
  }[] = [
    ...adapters.map((a) => ({ ...a, mode: a.mode })),
    ...queues.map((q) => ({ ...q, mode: null })),
  ];

  // Money settles through the payments adapter, so the revenue table's adapter
  // column states THAT adapter's mode rather than stamping "mock" on every row
  // the way the fixture did. Nothing reported means exactly that, and reads as
  // an em dash — not as a live adapter.
  const paymentsMode =
    data.adapters.find((a) => a.adapter === "payment")?.mode ?? null;
  const anyMock = data.adapters.some((a) => a.mode === "mock");

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      {/* Adapter status strip [F-A09] — the never-silent guarantee */}
      <section aria-label="Adapter and queue status">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Adapters &amp; queues
          </h2>
          <Link
            href="/system-health"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text hover:underline"
          >
            System health <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        {strip.length === 0 ? (
          <Empty>
            No adapter or queue has reported its health yet. The strip fills in
            once the platform records its first snapshot — nothing here is down.
          </Empty>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <div className="flex min-w-max divide-x divide-border">
              {strip.map((cell) => (
                <Link
                  key={cell.name}
                  href="/system-health"
                  className={`adapter-cell ${cell.state === "dead-letter" ? "bg-destructive/5" : ""}`}
                >
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold ${STATE_TONE[cell.state]}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[cell.state]}`}
                      aria-hidden
                    />
                    {cell.state === "dead-letter" ? "dead-letter" : cell.state}
                  </span>
                  <span className="mt-1 block text-sm font-semibold">{cell.name}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {cell.deadCount ? (
                      <Badge variant="danger">
                        <Zap className="size-3" aria-hidden />
                        {cell.deadCount} dead
                      </Badge>
                    ) : cell.mode === "mock" ? (
                      <Badge variant="warning">
                        <Zap className="size-3" aria-hidden />
                        mock
                      </Badge>
                    ) : cell.mode === "live" ? (
                      <Badge variant="success">live</Badge>
                    ) : null}
                    <span className="money text-xs text-muted-foreground">{cell.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Hero + work queue */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Supply density hero [F-A02 §2] */}
        <section className="lg:col-span-2" aria-label="Activated supply density per district">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {/* No headline figure any more. `AdminDistrictDensity` counts
                BUSINESSES per district and the fixture headline counted active
                PROPERTIES; summing the one to print the other would put a
                number nobody measured at the top of the measurement screen. */}
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Activated supply density
            </h2>
            {/* Says what the list draws. It used to say "trended
                month-over-month" over a list with no trend in it: the one
                comparison is the badge against last month. */}
            <p className="text-xs text-muted-foreground">
              The GTM north-star · businesses per district, busiest first ·
              change on last month
            </p>
          </div>
          {density.length === 0 ? (
            <Empty>
              No business has been registered in any district yet. The bars grow
              as registrations reach <span className="font-semibold">active</span>.
            </Empty>
          ) : (
            <DensityList rows={density} />
          )}
        </section>

        {/* Work queue summary [F-A02 §4] — items awaiting a human */}
        <section aria-label="Work queue">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Awaiting a human
          </h2>
          {workQueue.length === 0 ? (
            <Empty>Nothing is waiting on a person right now.</Empty>
          ) : (
            <div className="mt-4 divide-y divide-border rounded-card border border-border bg-field">
              {workQueue.map((item) => (
                <Link key={item.title} href={item.href} className="queue-row">
                  <span
                    className={`money w-9 shrink-0 text-2xl font-bold ${
                      item.countTone === "destructive" ? "text-destructive" : ""
                    }`}
                  >
                    {item.count}
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block truncate text-sm font-semibold">{item.title}</span>
                    <span
                      className={`block text-xs ${
                        item.detailTone === "warning"
                          ? "text-warning"
                          : item.detailTone === "destructive"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {item.detail}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Every failed money or compliance event queues — it is never skipped, never silent.
          </p>
        </section>
      </div>

      {/* Measurement set [F-A02 §1] */}
      <section className="mt-10" aria-label="The measurement set">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* No month label. The contract carries no reporting period, and a
              hardcoded "July 2026" standing over live figures is worse than no
              date at all: it is a date that will be wrong every other month. */}
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Measurement set
          </h2>
          {anyMock && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="warning">
                <Zap className="size-3" aria-hidden />
                mock
              </Badge>
              some figures settle on mocked adapters — never mistaken for live
            </p>
          )}
        </div>

        {kpis.length === 0 ? (
          <Empty>
            No measurement has been recorded yet. Each figure appears once the
            platform has something to count.
          </Empty>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {kpis.map((kpi) =>
              kpi.empty ? (
                <div key={kpi.label} className="rounded-card border border-dashed border-border p-4">
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {kpi.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-muted-foreground">{kpi.value}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    Nothing measured yet — an empty state, never a misleading zero.
                  </dd>
                </div>
              ) : (
                <div key={kpi.label} className="rounded-card bg-card p-4 text-card-foreground">
                  <dt className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
                    {kpi.label}
                  </dt>
                  <dd className="figure mt-1 text-3xl font-bold">{kpi.value}</dd>
                  <dd className="mt-1 flex items-center gap-1.5 text-xs text-card-foreground/60">
                    {kpi.noteBadge && (
                      <Badge variant={kpi.noteBadge.intent}>
                        {kpi.noteBadge.icon === "zap" ? (
                          <Zap className="size-3" aria-hidden />
                        ) : kpi.noteBadge.icon === "check" ? (
                          <Check className="size-3" aria-hidden />
                        ) : null}
                        {kpi.noteBadge.text}
                      </Badge>
                    )}
                    {kpi.note}
                  </dd>
                </div>
              ),
            )}
          </dl>
        )}

        {/* Revenue lines — money always labels its adapter mode */}
        {revenue.length === 0 ? (
          <Empty>
            No revenue has been recorded yet. Subscriptions and placement fees
            appear on this table as they settle.
          </Empty>
        ) : (
          <div className="mt-6 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[38rem] text-sm">
              <caption className="sr-only">
                Revenue lines — each names the mode of the adapter the money settles on
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Revenue line</th>
                  <th className="p-4">This month</th>
                  <th className="p-4">MoM</th>
                  <th className="p-4">Adapter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {revenue.map((line) => (
                  <tr key={line.line}>
                    <td className="p-4 font-semibold">
                      {line.line}
                      {line.lineNote && (
                        <span className="font-normal text-muted-foreground"> {line.lineNote}</span>
                      )}
                    </td>
                    <td className="money p-4 font-bold">{line.amount}</td>
                    <td className="p-4">
                      <Badge variant={line.mom.intent}>
                        {line.mom.trendingUp ? (
                          <TrendingUp className="size-3" aria-hidden />
                        ) : null}
                        {line.mom.text}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {paymentsMode === "mock" ? (
                        <Badge variant="warning">
                          <Zap className="size-3" aria-hidden />
                          mock
                        </Badge>
                      ) : paymentsMode === "live" ? (
                        <Badge variant="success">live</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{EMPTY}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Residence is monetized via per-Org subscription — there is no rent-commission line.
        </p>
      </section>
    </div>
  );
}

/**
 * A panel of this screen that has nothing in it YET.
 *
 * Dashed rather than tinted, and worded as a fact about the platform. An empty
 * overview on a fresh database is the CORRECT overview; drawing it as a warning
 * sends somebody looking for a fault that does not exist.
 */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * The read failed, so there is no overview to draw.
 *
 * The WHOLE screen, because every panel on it comes from the one call. Drawing
 * a shell of empty sections instead would state that the platform has no
 * adapters and no revenue — a different, and false, sentence from "we could not
 * ask". The words come from `apiFailureMessage`, so `unreachable` says nothing
 * about the caller's access and cannot drift into a refusal here.
 */
function Unavailable({ reason }: { reason: ApiFailure }) {
  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="animate-arrive rounded-card border border-border bg-field p-6">
        <p className="text-base font-semibold">
          {failureHeading(reason, "admin.overview.view")}
        </p>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {apiFailureMessage(reason)}
        </p>
        <FailureNextStep reason={reason} />
      </div>
    </div>
  );
}
