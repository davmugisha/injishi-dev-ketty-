import { Server, Zap } from "lucide-react";

import { Badge } from "@injishi/ui";
import { SectionFailure } from "@/components/failure/section-failure";
import { getEnvironments } from "@/lib/api/environments";
import {
  presentAdapterModes,
  presentEnvironmentPrimary,
} from "@/lib/present/environments";
import { presentAdapters } from "@/lib/present/overview";

export const metadata = { title: "Environments & adapters" };

/** The permission `GET /api/v1/admin/environments` declares. */
const PERMISSION = "admin.environment.manage";

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
 * Environments & adapters (F-A11) — which adapters this deployment is running.
 *
 * THE SCREEN REPORTS; IT DOES NOT DECIDE. The modes below come from the same
 * config the payment, storage, SMS and EBM modules read, and this page prints
 * them verbatim. The version of this screen it replaces held its own table of
 * environments and toggled a local `useState` — which meant the console could
 * cheerfully say "payments: real" while the payment module was running the
 * mock. That is the most expensive lie this app could tell, and the fix is not
 * a better fixture: it is having exactly one source of truth, on the server.
 *
 * Nothing here is editable for the same reason. The seam is a GET; switching an
 * adapter is a deployment concern, and a control that appeared to flip one from
 * the browser would be a second source of truth wearing a button.
 */
export default async function Page() {
  const result = await getEnvironments();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <SectionFailure reason={result.reason} permission={PERMISSION} />
      </div>
    );
  }

  const env = result.data;
  const primary = presentEnvironmentPrimary(env);
  const modes = presentAdapterModes(env);
  const adapters = presentAdapters(env.adapters);

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
                <Server className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">
                Environments &amp; adapters
              </h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              What this deployment is bound to right now. Each mode is read from
              the same configuration the module itself reads, so this screen
              cannot disagree with the code that moves the money.
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

      <section className="mt-6" aria-label="Adapter modes">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Adapter modes
        </h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {modes.map((mode) => (
            <div
              key={mode.label}
              className="rounded-card bg-card p-4 text-card-foreground"
            >
              <dt className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
                {mode.label}
              </dt>
              <dd className="figure mt-1 text-3xl font-bold">{mode.value}</dd>
              <dd className="mt-2">
                <Badge variant={mode.intent}>{mode.note}</Badge>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8" aria-label="Adapter health">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Adapter health
        </h2>
        {adapters.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">
              No adapter has reported health yet
            </p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              The modes above are configuration and are always known. A health
              snapshot is written by an adapter the first time it is called, so
              an empty board here means nothing has called one yet — the binding
              is still exactly what the modes say.
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
        <p className="mt-3 text-xs text-muted-foreground">
          Environment{" "}
          <span className="money font-semibold text-foreground">
            {env.current.name}
          </span>{" "}
          · NODE_ENV{" "}
          <span className="money font-semibold text-foreground">
            {env.current.nodeEnv}
          </span>
        </p>
      </section>
    </div>
  );
}
