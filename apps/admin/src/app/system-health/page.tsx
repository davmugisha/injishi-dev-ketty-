import { Activity, Zap } from "lucide-react";

import { Badge } from "@injishi/ui";
import { SectionFailure } from "@/components/failure/section-failure";
import { getSystemHealth } from "@/lib/api/system-health";
import { presentAdapters, presentQueues } from "@/lib/present/overview";
import {
  presentSystemPrimary,
  presentSystemStats,
} from "@/lib/present/system-health";

export const metadata = { title: "System health" };

/** The permission `GET /api/v1/admin/system-health` declares. */
const PERMISSION = "admin.system.view";

/**
 * Adapter and queue state, tinted.
 *
 * The same three tones the overview strip uses, so a queue that is
 * dead-lettering is the same colour on both screens. Token classes only — a raw
 * Tailwind colour here would be a second definition of "this is bad".
 */
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
 * System health (F-A09) — the platform's own vital signs, from the API.
 *
 * The screen renders whatever the health endpoint says, INCLUDING
 * `database.reachable: false`. That case is the whole reason this page exists:
 * an API answering while its own database is unreachable is a platform that is
 * up and can do nothing, and a screen that only works when everything works
 * cannot report it.
 *
 * A failed READ is a different thing again and gets different words. When the
 * health endpoint itself does not answer we do not know which part is down —
 * only that we could not ask — so the page says so rather than inventing a red
 * row it has no evidence for.
 */
export default async function Page() {
  const result = await getSystemHealth();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <SectionFailure reason={result.reason} permission={PERMISSION} />
      </div>
    );
  }

  const health = result.data;
  const primary = presentSystemPrimary(health);
  const stats = presentSystemStats(health);
  const adapters = presentAdapters(health.adapters);
  const queues = presentQueues(health.queues);

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
                <Activity className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">System health</h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              Adapter, queue and runtime health for the never-silent operating
              guarantee — read from the running process, not from a stored
              summary.
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

      <dl className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

      <section className="mt-8" aria-label="Adapters">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Adapters
        </h2>
        {adapters.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">No adapter has reported yet</p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              Adapter health is written by the adapters themselves as they run.
              Nothing has recorded a snapshot on this deployment so far.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <div className="flex min-w-max divide-x divide-border">
              {adapters.map((adapter) => (
                <div key={adapter.name} className="adapter-cell">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold ${STATE_TONE[adapter.state]}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[adapter.state]}`}
                      aria-hidden
                    />
                    {adapter.state}
                  </span>
                  <span className="mt-1 block text-sm font-semibold">
                    {adapter.name}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {adapter.mode === "mock" ? (
                      <Badge variant="warning">
                        <Zap className="size-3" aria-hidden />
                        mock
                      </Badge>
                    ) : (
                      <Badge variant="success">live</Badge>
                    )}
                    <span className="money text-xs text-muted-foreground">
                      {adapter.detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8" aria-label="Queues">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Queues
        </h2>
        {queues.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">No queue has reported yet</p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              A queue appears here once it has held or processed a job. An empty
              board means no background work has run, not that the workers are
              missing.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[38rem] text-sm">
              <caption className="sr-only">
                Queue depth, failures and dead-lettered jobs
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Queue</th>
                  <th className="p-4">State</th>
                  <th className="p-4">Detail</th>
                  <th className="p-4">Dead-lettered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queues.map((queue) => (
                  <tr key={queue.name}>
                    <td className="p-4 font-semibold">{queue.name}</td>
                    <td className="p-4">
                      <span
                        className={`flex items-center gap-1.5 text-xs font-semibold ${STATE_TONE[queue.state]}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[queue.state]}`}
                          aria-hidden
                        />
                        {queue.state}
                      </span>
                    </td>
                    <td className="money p-4 text-muted-foreground">
                      {queue.detail}
                    </td>
                    <td className="p-4">
                      {queue.deadCount ? (
                        <Badge variant="danger">{queue.deadCount}</Badge>
                      ) : (
                        <Badge variant="success">none</Badge>
                      )}
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
