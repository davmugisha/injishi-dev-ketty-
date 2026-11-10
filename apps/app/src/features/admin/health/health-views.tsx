"use client";

import type { AdminAnalytics, AdminSystemHealth, AssistantUsageReport } from "@injishi/contracts";
import {
  DataTable,
  DateText,
  EmptyBlock,
  formatNumber,
  type KpiItem,
  PageContent,
  PageHeader,
  SectionCard,
  StatusChip,
} from "@injishi/ui";
import { ALL, ListBar, ListFilter, ListUrlProvider } from "../list/list-kit";
import { KpiCards } from "../list/stat-cards";
import { FactRow } from "../shared";

const ADAPTER: Record<string, string> = {
  payment: "Mobile money and cards",
  ebm_vsdc: "RRA receipts (EBM)",
  rra_tin: "RRA TIN check",
  nida: "National ID (NIDA)",
  sms: "SMS",
  email: "Email",
};
const words = (s: string) => {
  const w = s.replace(/_/g, " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
};
const STATUS_TONE = { up: "success", degraded: "warning", down: "danger" } as const;
const STATUS_WORD = { up: "Working", degraded: "Slow", down: "Down" } as const;

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/**
 * System health (2026-11-09, real records): whether each outside service answers, what the job queues hold,
 * and the database and API process. Read when the page opens; reload for the latest.
 */
export function SystemHealthView({ health }: { health: AdminSystemHealth }) {
  const down = health.adapters.filter((a) => a.status !== "up").length;
  const failed = health.queues.reduce((n, q) => n + q.failed + q.deadLetter, 0);
  return (
    <PageContent>
      <PageHeader
        title="System health"
        description="Outside services, job queues, the database and the API, as of now."
      />
      <KpiCards
        label="System health"
        items={[
          {
            id: "services",
            label: "Services not working",
            value: down,
            format: "count",
            icon: "AntennaSignal",
            status: down > 0 ? "danger" : "success",
            footnote: `${health.adapters.length} watched`,
          },
          {
            id: "jobs",
            label: "Failed jobs",
            value: failed,
            format: "count",
            icon: "Clock",
            status: failed > 0 ? "warning" : "success",
            footnote: `${health.queues.length} queues`,
          },
          {
            id: "db",
            label: "Database answers in",
            value: health.database.latencyMs ?? 0,
            format: "count",
            icon: "Database",
            status: health.database.reachable ? undefined : "danger",
            footnote: health.database.reachable ? "milliseconds" : "Not reachable",
          },
        ]}
      />
      <SectionCard title="Outside services" description="The last answer each one gave.">
        <DataTable
          label="Outside services"
          rows={health.adapters}
          rowKey={(a) => a.adapter}
          columns={[
            { id: "name", header: "Service", isRowHeader: true, cell: (a) => ADAPTER[a.adapter] ?? words(a.adapter) },
            {
              id: "status",
              header: "Status",
              cell: (a) => <StatusChip tone={STATUS_TONE[a.status]}>{STATUS_WORD[a.status]}</StatusChip>,
            },
            {
              id: "mode",
              header: "Mode",
              cell: (a) => (a.mode === "live" ? "Live" : <span className="text-muted">Test</span>),
            },
            {
              id: "errors",
              header: "Errors",
              align: "end",
              cell: (a) =>
                a.errorRate === null ? "—" : `${formatNumber(a.errorRate * 100, { maximumFractionDigits: 1 })}%`,
            },
            {
              id: "latency",
              header: "Answers in",
              align: "end",
              cell: (a) => (a.latencyMs === null ? "—" : `${a.latencyMs} ms`),
            },
            { id: "seen", header: "Checked", align: "end", cell: (a) => <DateText value={a.observedAt} /> },
          ]}
          empty={<EmptyBlock size="sm" icon="AntennaSignal" title="No service has been checked yet" />}
          mobile={{ title: (a) => ADAPTER[a.adapter] ?? a.adapter, description: (a) => STATUS_WORD[a.status] }}
        />
      </SectionCard>
      <SectionCard title="Job queues" description="Work waiting to run in the background.">
        <DataTable
          label="Job queues"
          rows={health.queues}
          rowKey={(q) => q.queue}
          columns={[
            {
              id: "queue",
              header: "Queue",
              isRowHeader: true,
              cell: (q) => <span className="font-mono text-xs">{q.queue}</span>,
            },
            { id: "depth", header: "Waiting", align: "end", cell: (q) => formatNumber(q.depth) },
            {
              id: "failed",
              header: "Failed",
              align: "end",
              cell: (q) => (q.failed > 0 ? <span className="text-warning">{formatNumber(q.failed)}</span> : "0"),
            },
            {
              id: "dead",
              header: "Gave up",
              align: "end",
              cell: (q) => (q.deadLetter > 0 ? <span className="text-danger">{formatNumber(q.deadLetter)}</span> : "0"),
            },
            { id: "rate", header: "Per minute", align: "end", cell: (q) => formatNumber(q.throughput) },
          ]}
          empty={<EmptyBlock size="sm" icon="Clock" title="No queues reported" />}
          mobile={{ title: (q) => q.queue, description: (q) => `${q.depth} waiting · ${q.failed} failed` }}
        />
      </SectionCard>
      <SectionCard title="Database and API">
        <dl className="flex flex-col">
          <FactRow label="Database">{health.database.reachable ? "Reachable" : "Not reachable"}</FactRow>
          <FactRow label="Changes applied">{health.database.migrationsApplied ?? null}</FactRow>
          <FactRow label="Environment">{words(health.process.environment)}</FactRow>
          <FactRow label="Running for">{uptime(health.process.uptimeSeconds)}</FactRow>
          <FactRow label="Node.js">{health.process.nodeVersion}</FactRow>
        </dl>
      </SectionCard>
    </PageContent>
  );
}

/**
 * Insights (2026-11-09, real records): the platform's headline figures against the period before, each with
 * its trend line where the API keeps one.
 */
export function InsightsView({ data }: { data: AdminAnalytics }) {
  const series = new Map(data.series.map((s) => [s.key, s.points.map((p) => p.value)]));
  const items: KpiItem[] = data.totals.map((k) => {
    const prev = k.previousValue;
    const value = k.value ?? 0;
    const percent = prev && prev !== 0 ? Math.round(((value - prev) / Math.abs(prev)) * 100) : null;
    return {
      id: k.key,
      label: k.label,
      value,
      format: k.unit === "rwf" ? "money" : k.unit === "percent" ? "percent" : "count",
      trend: percent === null ? undefined : { percent, versus: "the period before" },
      spark: series.get(k.key),
    };
  });
  return (
    <PageContent>
      <PageHeader title="Insights" description="Injishi's headline figures, against the period before." />
      {items.length ? (
        <KpiCards label="Headline figures" items={items} />
      ) : (
        <EmptyBlock icon="ChartColumn" title="No figures yet" />
      )}
      {data.series.length ? (
        <SectionCard title="Over time" description="Each figure, newest last.">
          <ul className="m-0 flex list-none flex-col p-0">
            {data.series.map((s) => (
              <li
                key={s.key}
                className="grid grid-cols-1 gap-1 border-b border-separator py-3 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4"
              >
                <span className="text-sm font-medium">{s.label}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {s.points.slice(-8).map((p) => (
                    <span key={p.at} className="tabular">
                      <DateText value={p.at} style="month" />: {formatNumber(p.value)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </PageContent>
  );
}

/** The last six months, newest first, as YYYY-MM. */
function recentMonths(): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push({
      id: m.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(m),
    });
  }
  return out;
}

const usd = (n: number) => `$${formatNumber(n, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

/**
 * The assistant's usage (2026-11-09, real records): one month's answers, model calls and estimated cost,
 * by kind of request, by who asked and by model.
 */
export function AssistantUsageReportView({ report }: { report: AssistantUsageReport }) {
  const months = recentMonths();
  return (
    <ListUrlProvider>
      <PageContent>
        <PageHeader title="Assistant usage" description="What the assistant answered and what it cost, by month." />
        <ListBar keys={["month"]} found={report.answers.total} noun={{ one: "answer", many: "answers" }}>
          <ListFilter
            param="month"
            name="Month"
            icon="Calendar"
            options={[{ id: ALL, label: "This month" }, ...months.slice(1)]}
          />
        </ListBar>
        <KpiCards
          label="This month"
          items={[
            { id: "answers", label: "Answers", value: report.answers.total, format: "count", icon: "Comment" },
            {
              id: "ai",
              label: "Answered by the model",
              value: report.answers.ai,
              format: "count",
              icon: "Comment",
              footnote: `${report.answers.direct} answered directly, ${report.answers.fallback} fell back`,
            },
            { id: "calls", label: "Model calls", value: report.modelRequests, format: "count", icon: "AntennaSignal" },
            {
              id: "tokens",
              label: "Tokens",
              value: report.tokens.input + report.tokens.output,
              format: "count",
              icon: "Database",
              footnote: `${formatNumber(report.tokens.input)} in, ${formatNumber(report.tokens.output)} out`,
            },
          ]}
        />
        <SectionCard title="Estimated cost" description={`At the prices set when this was read, for ${report.month}.`}>
          <p className="m-0 text-2xl font-semibold tabular">{usd(report.estimatedCostUsd)}</p>
        </SectionCard>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {(
            [
              ["By kind of request", report.byRequestType.map((r) => ({ name: words(r.requestType), ...r }))],
              ["By who asked", report.byCallerRole.map((r) => ({ name: words(r.callerRole), ...r }))],
              ["By model", report.byModel.map((r) => ({ name: r.model, ...r }))],
            ] as const
          ).map(([title, rows]) => (
            <SectionCard key={title} title={title}>
              {rows.length === 0 ? (
                <p className="m-0 text-sm text-muted">Nothing this month.</p>
              ) : (
                <dl className="flex flex-col">
                  {rows.map((r) => (
                    <FactRow key={r.name} label={r.name}>
                      {formatNumber(r.modelRequests)} calls · {usd(r.estimatedCostUsd)}
                    </FactRow>
                  ))}
                </dl>
              )}
            </SectionCard>
          ))}
        </div>
      </PageContent>
    </ListUrlProvider>
  );
}
