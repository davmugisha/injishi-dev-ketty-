"use client";

import { ArrowRotateRight, Check, Clock, Lock, ShieldExclamation, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Label, Meter, Table, Tabs } from "@heroui/react";
import { ListView, Segment, Widget } from "@heroui-pro/react";
import { LineChart } from "@heroui-pro/react/line-chart";
import type {
  Adapter,
  DeadLetter,
  ErrorGroup,
  HealthPanel,
  Incident,
  Pipeline,
  QueueStat,
  SchedulerRun,
  StageState,
  Sweep,
  Tone,
} from "@injishi/data/fixtures/admin";
import { GateChip, Icon, PageContent, PageHeader, SectionHeader, StatusDot, toneColor } from "@injishi/ui";
import { useState } from "react";
import { FigureGrid, lineTab, TabCount, ToneChip } from "./shared";

interface AdminHealthData {
  incidents: Incident[];
  adapters: Adapter[];
  deadLetters: DeadLetter[];
  queues: QueueStat[];
  schedulers: SchedulerRun[];
  sweeps: Sweep[];
  panels: HealthPanel[];
  errors: ErrorGroup[];
  pipelines: Pipeline[];
}

const WINDOWS = [
  { id: "0", label: "15 min", caption: "Last 15 minutes" },
  { id: "1", label: "1 hour", caption: "Last hour" },
  { id: "2", label: "24 hours", caption: "Last 24 hours" },
];

const ADAPTER_TONE: Record<Adapter["status"], Tone> = {
  Healthy: "success",
  Degraded: "warning",
  Partial: "warning",
  Up: "success",
  "Not verified": "default",
};

const STAGES = ["Build", "Tests", "Security", "Staging", "Canary", "Production"];

const STAGE_TONE: Record<StageState, Tone | null> = {
  success: "success",
  accent: "accent",
  warning: "warning",
  pending: null,
};

type JobTab = "dlq" | "queues" | "sched" | "sweeps";

function panel(panels: HealthPanel[], id: HealthPanel["id"]): HealthPanel {
  const found = panels.find((p) => p.id === id);
  if (!found) throw new Error(`missing health panel ${id}`);
  return found;
}

export function AdminHealthView({ data }: { data: AdminHealthData }) {
  const [win, setWin] = useState(0);
  const [jtab, setJtab] = useState<JobTab>("dlq");
  const [replayed, setReplayed] = useState<Record<string, boolean>>({});
  const [restore, setRestore] = useState(false);

  const window = WINDOWS[win] ?? WINDOWS[0];
  const left = data.deadLetters.filter((d) => d.replayable && !replayed[d.id]).length;
  const outbox = panel(data.panels, "outbox");
  const realtime = panel(data.panels, "realtime");
  const storage = panel(data.panels, "storage");
  const backup = panel(data.panels, "backup");
  const usedPct = storage.used && storage.capacity ? Math.round((storage.used / storage.capacity) * 100) : 0;

  const jobTabs: { id: JobTab; label: string; count: string; tone?: Tone }[] = [
    { id: "dlq", label: "Dead letters", count: String(left + 3), tone: "warning" },
    { id: "queues", label: "Queues", count: "5" },
    { id: "sched", label: "Schedulers", count: "1 failed", tone: "danger" },
    { id: "sweeps", label: "Sweeps", count: "4" },
  ];

  return (
    <PageContent>
      <PageHeader
        eyebrow="Platform › Health · Production · updated 09:42:05 CAT"
        title="Platform Health"
        description="Adapters, events, jobs, storage and delivery. Support can read and replay; Engineering owns changes and promotions."
        actions={
          <Segment aria-label="Time window" selectedKey={String(win)} onSelectionChange={(k) => setWin(Number(k))}>
            {WINDOWS.map((w) => (
              <Segment.Item key={w.id} id={w.id}>
                {w.label}
              </Segment.Item>
            ))}
          </Segment>
        }
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        {data.incidents.map((n) => (
          <Alert key={n.id} status={n.tone === "danger" ? "danger" : "warning"} role="status">
            <Alert.Indicator>
              <TriangleExclamation />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>
                {n.id} · {n.title} · {n.severity}
              </Alert.Title>
              <Alert.Description>{n.summary}</Alert.Description>
            </Alert.Content>
          </Alert>
        ))}
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="ad-h">
        <SectionHeader
          id="ad-h"
          title="Adapters"
          action={<span className="text-xs text-muted">p95 latency and error rate · {window.caption}</span>}
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Adapters">
              <Table.Header>
                <Table.Column isRowHeader>Adapter</Table.Column>
                <Table.Column>Endpoint</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column className="text-right">p95</Table.Column>
                <Table.Column className="text-right">Errors</Table.Column>
                <Table.Column>Notes</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.adapters.map((a) => (
                  <Table.Row key={a.id} id={a.id}>
                    <Table.Cell className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Icon name={a.icon} className="size-4 text-muted" />
                        <span className="font-medium">{a.name}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-[13px] whitespace-nowrap text-muted">{a.endpoint}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(ADAPTER_TONE[a.status])}>
                        {a.status === "Not verified" ? <Lock className="size-3" /> : null}
                        <Chip.Label>{a.status}</Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-right whitespace-nowrap tabular">{a.p95[win]}</Table.Cell>
                    <Table.Cell className="text-right tabular">{a.errors[win]}</Table.Cell>
                    <Table.Cell className="text-xs leading-4 text-muted">{a.note}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <Widget className="min-w-0 flex-[999_1_560px]" aria-labelledby="jobs-h" render={(p) => <section {...p} />}>
          <Widget.Header>
            <Widget.Title id="jobs-h" role="heading" aria-level={2}>
              Jobs and Queues
            </Widget.Title>
            <span className="text-xs text-muted">Retries back off; replays reuse the original idempotency key</span>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-3">
            <Tabs variant="secondary" selectedKey={jtab} onSelectionChange={(k) => setJtab(String(k) as JobTab)}>
              <Tabs.ListContainer>
                <Tabs.List aria-label="Job views">
                  {jobTabs.map((t) => (
                    <Tabs.Tab key={t.id} id={t.id} className={lineTab}>
                      {t.label}
                      <TabCount tone={t.tone}>{t.count}</TabCount>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="dlq" className="pt-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-muted">
                      Showing {data.deadLetters.length} of 9 · {left} replayable here · 3 more in payments.callback
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={left === 0}
                      onPress={() =>
                        setReplayed((current) => {
                          const next = { ...current };
                          for (const d of data.deadLetters) if (d.replayable) next[d.id] = true;
                          return next;
                        })
                      }
                    >
                      <ArrowRotateRight className="size-4" />
                      Replay all replayable
                    </Button>
                  </div>
                  <ListView aria-label="Dead letters" variant="secondary">
                    {data.deadLetters.map((d) => (
                      <DeadLetterRow
                        key={d.id}
                        letter={d}
                        replayed={!!replayed[d.id]}
                        onReplay={() => setReplayed((current) => ({ ...current, [d.id]: true }))}
                      />
                    ))}
                  </ListView>
                </div>
              </Tabs.Panel>
              <Tabs.Panel id="queues" className="pt-3">
                <QueueTable queues={data.queues} />
              </Tabs.Panel>
              <Tabs.Panel id="sched" className="pt-3">
                <ResultTable
                  label="Schedulers"
                  head={["Scheduler", "Runs", "Last run", "Result", "Next"]}
                  rows={data.schedulers.map((s) => ({
                    id: s.id,
                    cells: [s.id, s.runs, s.lastRun, s.next],
                    chip: s.result,
                    tone: s.tone,
                    chipAt: 3,
                  }))}
                />
              </Tabs.Panel>
              <Tabs.Panel id="sweeps" className="pt-3">
                <ResultTable
                  label="Sweeps"
                  head={["Sweep", "Rule", "Last run", "Result", "Next"]}
                  rows={data.sweeps.map((s) => ({
                    id: s.id,
                    cells: [s.name, s.rule, s.lastRun, s.next],
                    chip: s.result,
                    tone: s.tone,
                    chipAt: 3,
                  }))}
                />
              </Tabs.Panel>
            </Tabs>
          </Widget.Content>
        </Widget>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Widget aria-labelledby="ob-h" render={(p) => <section {...p} />}>
            <Widget.Header>
              <Widget.Title id="ob-h" role="heading" aria-level={2}>
                Transactional Outbox
              </Widget.Title>
              <ToneChip tone={outbox.tone}>{outbox.state}</ToneChip>
            </Widget.Header>
            <Widget.Content className="flex flex-col gap-2.5">
              <div role="img" aria-label="Outbox publish lag over the last hour, peaking at 4.2 seconds around 09:05">
                <LineChart data={outbox.series ?? []} height={40} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                  <LineChart.XAxis dataKey="at" hide />
                  <LineChart.YAxis hide />
                  <LineChart.Line
                    type="linear"
                    dataKey="lag"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </div>
              <FigureGrid facts={outbox.facts} />
            </Widget.Content>
          </Widget>
          <Widget aria-labelledby="rt-h" render={(p) => <section {...p} />}>
            <Widget.Header>
              <Widget.Title id="rt-h" role="heading" aria-level={2}>
                Realtime Fan-out
              </Widget.Title>
              <ToneChip tone={realtime.tone}>{realtime.state}</ToneChip>
            </Widget.Header>
            <Widget.Content>
              <FigureGrid facts={realtime.facts} />
            </Widget.Content>
          </Widget>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <Card className="gap-2.5 p-[18px]" aria-labelledby="os-h" render={(p) => <section {...p} />}>
          <div className="flex flex-col gap-0.5">
            <h2 id="os-h" className="text-[15px] leading-[22px] font-semibold">
              Object Storage
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">Documents, photos, receipts and exports</p>
          </div>
          <Meter
            aria-label="Storage used"
            value={usedPct}
            valueLabel={`${storage.used} of ${storage.capacity} TB`}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <Label>Used</Label>
              <span className="tabular">
                {storage.used} of {storage.capacity} TB
              </span>
            </div>
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
          <div className="flex flex-col gap-1.5 text-[13px] leading-[18px]">
            {(storage.notes ?? []).map((n) => (
              <span key={n.text} className="flex items-center gap-2">
                <StatusDot tone={n.tone} />
                {n.text}
              </span>
            ))}
          </div>
          {(storage.gates ?? []).map((g) => (
            <GateChip key={g} icon={<ShieldExclamation className="size-3" />} className="self-start">
              {g}
            </GateChip>
          ))}
        </Card>

        <Card className="gap-2.5 p-[18px]" aria-labelledby="er-h" render={(p) => <section {...p} />}>
          <div className="flex flex-col gap-0.5">
            <h2 id="er-h" className="text-[15px] leading-[22px] font-semibold">
              Errors and Crashes
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">Crash-free sessions · web 99.6% · staff app 98.9%</p>
          </div>
          {data.errors.map((e) => (
            <ErrorRow key={e.id} error={e} />
          ))}
        </Card>

        <Card className="gap-2.5 p-[18px]" aria-labelledby="bk-h" render={(p) => <section {...p} />}>
          <div className="flex flex-col gap-0.5">
            <h2 id="bk-h" className="text-[15px] leading-[22px] font-semibold">
              Backup and Restore
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              A backup counts only once a restore from it has been tested
            </p>
          </div>
          <FigureGrid facts={backup.facts} />
          {restore ? (
            <Chip variant="soft" color="success" className="self-start">
              <Check className="size-3" />
              <Chip.Label>Restore drill booked 14:00 · Samuel Nkusi</Chip.Label>
            </Chip>
          ) : (
            <Alert status="warning">
              <Alert.Indicator>
                <Clock />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Restore test due today</Alert.Title>
                <Alert.Description>
                  Fortnightly drill into an isolated environment. No tenant traffic is affected.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" isDisabled={restore} onPress={() => setRestore(true)}>
              Book restore drill
            </Button>
            {(backup.gates ?? []).map((g) => (
              <GateChip key={g} icon={<ShieldExclamation className="size-3" />}>
                {g}
              </GateChip>
            ))}
          </div>
        </Card>
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="ci-h">
        <SectionHeader
          id="ci-h"
          title="CI and Deploy Pipeline"
          action={<GateChip icon={<Lock className="size-3" />}>Payment services frozen until INC-0192 closes</GateChip>}
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Deploy pipeline">
              <Table.Header>
                <Table.Column isRowHeader>Service</Table.Column>
                <Table.Column>Stages</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Next step</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.pipelines.map((p) => (
                  <Table.Row key={p.id} id={p.id}>
                    <Table.Cell className="whitespace-nowrap">
                      <span className="flex flex-col">
                        <span className="font-medium">{p.service}</span>
                        <span className="text-xs text-muted tabular">{p.version}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {p.stages.map((state, i) => (
                          <span key={STAGES[i]} className="flex items-center gap-1 text-xs">
                            <StatusDot tone={STAGE_TONE[state]} />
                            {STAGES[i]}
                          </span>
                        ))}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <ToneChip tone={p.tone}>{p.status}</ToneChip>
                    </Table.Cell>
                    <Table.Cell className="text-xs leading-4 text-muted">{p.next}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <p className="text-xs text-muted">
          Promotion to production is an Engineering action with two reviewers. Support sees status only.
        </p>
      </section>
    </PageContent>
  );
}

function DeadLetterRow({
  letter: d,
  replayed,
  onReplay,
}: {
  letter: DeadLetter;
  replayed: boolean;
  onReplay: () => void;
}) {
  return (
    <ListView.Item id={d.id} textValue={`${d.id} ${d.queue}`}>
      <ListView.ItemContent>
        <span className="w-[70px] flex-none text-xs text-muted tabular">{d.id}</span>
        <div className="flex min-w-0 flex-col">
          <ListView.Title className="text-[13px]">
            {d.queue} · {d.ref}
          </ListView.Title>
          <ListView.Description>
            {d.reason} · {d.attempts} attempts · since {d.since}
          </ListView.Description>
        </div>
      </ListView.ItemContent>
      <ListView.ItemAction className="flex items-center gap-1.5">
        {d.replayable && !replayed ? (
          <Button size="sm" variant="secondary" onPress={onReplay}>
            Replay
          </Button>
        ) : null}
        {replayed ? (
          <Chip size="sm" variant="soft" color="success">
            <Chip.Label>Re-queued 09:42</Chip.Label>
          </Chip>
        ) : null}
        {!d.replayable ? <ToneChip tone="default">Inspect only</ToneChip> : null}
      </ListView.ItemAction>
    </ListView.Item>
  );
}

function QueueTable({ queues }: { queues: QueueStat[] }) {
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Queues">
          <Table.Header>
            <Table.Column isRowHeader>Queue</Table.Column>
            <Table.Column>Depth</Table.Column>
            <Table.Column>Oldest</Table.Column>
            <Table.Column>Retry policy</Table.Column>
            <Table.Column>Dead letters</Table.Column>
          </Table.Header>
          <Table.Body>
            {queues.map((q) => (
              <Table.Row key={q.id} id={q.id}>
                <Table.Cell className="text-[13px]">{q.id}</Table.Cell>
                <Table.Cell className="text-[13px] tabular">{q.depth}</Table.Cell>
                <Table.Cell className="text-[13px]">{q.oldest}</Table.Cell>
                <Table.Cell className="text-[13px]">{q.retry}</Table.Cell>
                <Table.Cell>
                  <ToneChip tone={q.deadLetters > 0 ? "warning" : "success"}>{q.deadLetters}</ToneChip>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function ResultTable({
  label,
  head,
  rows,
}: {
  label: string;
  head: string[];
  rows: { id: string; cells: string[]; chip: string; tone: Tone; chipAt: number }[];
}) {
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label={label}>
          <Table.Header>
            {head.map((h, i) => (
              <Table.Column key={h} isRowHeader={i === 0}>
                {h}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.id} id={r.id}>
                {r.cells.slice(0, r.chipAt).map((c) => (
                  <Table.Cell key={c} className="text-[13px]">
                    {c}
                  </Table.Cell>
                ))}
                <Table.Cell>
                  <ToneChip tone={r.tone}>{r.chip}</ToneChip>
                </Table.Cell>
                {r.cells.slice(r.chipAt).map((c) => (
                  <Table.Cell key={c} className="text-[13px]">
                    {c}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function ErrorRow({ error: e }: { error: ErrorGroup }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-separator py-2">
      <span className="text-[13px] font-medium">{e.title}</span>
      <span className="text-xs leading-4 text-muted">{e.meta}</span>
      <ToneChip tone={e.tone} className="self-start">
        {e.state}
      </ToneChip>
    </div>
  );
}
