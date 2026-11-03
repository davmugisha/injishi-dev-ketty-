"use client";

import { ArrowDownToLine, CircleCheck, Flag, Lock, ShieldCheck, ShieldExclamation } from "@gravity-ui/icons";
import { Button, Card, Chip, ListBox, Meter, Radio, RadioGroup, Table, Toast, toast } from "@heroui/react";
import { CellSelect, CellSwitch, ListView, Segment } from "@heroui-pro/react";
import type {
  FindingOption,
  FlaggedAnswer,
  RetentionSetting,
  TenantLimitOption,
  Tone,
  UsageAlert,
  UsageMonth,
  UsageTenant,
} from "@injishi/data/fixtures/platformops";
import { GateChip, PageContent, PageHeader, SectionHeader } from "@injishi/ui";
import { useState } from "react";
import { count, firstKey, HBar, KpiStrip, money, ToneChip } from "./shared";

interface AssistantUsageData {
  months: UsageMonth[];
  flags: FlaggedAnswer[];
  findings: FindingOption[];
  alerts: UsageAlert[];
  retention: RetentionSetting[];
  limits: TenantLimitOption[];
}

const FB_LABELS = ["Helpful", "Wrong information", "Missing a source", "Not helpful", "Should not see this"];
const FB_COLORS = ["var(--chart-3)", "var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

function tenantRow(t: UsageTenant, isOct: boolean) {
  const pct = t.limit ? Math.round((t.cost / t.limit) * 100) : 0;
  let alert = "Within limit";
  let tone: Tone = "default";
  if (!t.limit) alert = "None at 80%";
  else if (pct >= 100) {
    alert = isOct ? "Answers paused" : "Paused 27–30 Sep";
    tone = "danger";
  } else if (pct >= 80) {
    alert = isOct ? "80% alert sent 11 Oct" : "Crossed 80%";
    tone = "warning";
  }
  return {
    ...t,
    pct,
    alert,
    tone,
    limitText: t.limit ? `${pct}% of ${money(t.limit)}` : "Each tenant RWF 300,000",
    barLabel: t.limit ? `${pct} percent of monthly limit` : "No single limit",
  };
}

export function AssistantUsageView({ data }: { data: AssistantUsageData }) {
  const [monthId, setMonthId] = useState("oct");
  const [flagId, setFlagId] = useState("FL-0232");
  const [finding, setFinding] = useState("correct");
  const [closed, setClosed] = useState<Record<string, string>>({});
  const [limitId, setLimitId] = useState("300");
  const [alerts, setAlerts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.alerts.map((a) => [a.id, a.on])),
  );
  const [ret, setRet] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.retention.map((r) => [r.id, r.index])),
  );

  const month = data.months.find((m) => m.id === monthId) ?? data.months[0];
  const isOct = month?.id === "oct";
  const tenants = (month?.tenants ?? []).map((t) => tenantRow(t, !!isOct));
  const isClosed = (f: FlaggedAnswer) => !!(f.closedOutcome || closed[f.id]);
  const openFlags = data.flags.filter((f) => !isClosed(f)).length;
  const selected = data.flags.find((f) => f.id === flagId) ?? data.flags[0];
  const findingLabel = data.findings.find((f) => f.id === finding)?.label ?? data.findings[0]?.label ?? "";
  const segs = FB_LABELS.map((label, i) => ({
    label,
    v: month?.feedback[i] ?? 0,
    color: FB_COLORS[i] ?? "var(--chart-1)",
  }));
  const fbAria = `Answer feedback: ${segs.map((s) => `${s.label} ${s.v} percent`).join(", ")}`;

  return (
    <PageContent>
      <PageHeader
        eyebrow="Oversight · Assistant"
        title="Assistant Usage and Safety"
        actions={
          <>
            <Segment aria-label="Month" selectedKey={monthId} onSelectionChange={(k) => setMonthId(String(k))}>
              {data.months.map((m, i) => (
                <Segment.Item key={m.id} id={m.id}>
                  {i > 0 ? <Segment.Separator /> : null}
                  {m.label}
                </Segment.Item>
              ))}
            </Segment>
            <Button
              variant="secondary"
              onPress={() => toast.success("CSV prepared · tenant totals only, no conversation text")}
            >
              <ArrowDownToLine />
              Export CSV
            </Button>
          </>
        }
      />

      {month ? (
        <KpiStrip label="Assistant key figures" items={month.kpis} itemClassName="min-w-[180px] flex-[1_1_180px]" />
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-4">
          <section className="flex flex-col gap-2.5" aria-labelledby="use-h">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <SectionHeader id="use-h" title={`Usage and Cost by Tenant · ${month?.longLabel ?? ""}`} />
              <span className="text-xs text-muted">
                Cost in RWF from metered usage · Injishi’s cost, not billed to tenants
              </span>
            </div>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Usage and cost by tenant">
                  <Table.Header>
                    <Table.Column isRowHeader>Tenant</Table.Column>
                    <Table.Column className="text-right">Conversations</Table.Column>
                    <Table.Column className="text-right">Cost</Table.Column>
                    <Table.Column className="min-w-[170px]">Monthly limit used</Table.Column>
                    <Table.Column>Alert</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {tenants.map((t) => (
                      <Table.Row key={t.id} id={t.id}>
                        <Table.Cell>
                          <span className={t.limit ? "font-medium" : "font-normal"}>{t.name}</span>{" "}
                          <span className="text-xs text-muted">· {t.sub}</span>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{count(t.conversations)}</Table.Cell>
                        <Table.Cell className="text-right tabular">{money(t.cost)}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col gap-1">
                            <span className="text-xs tabular">{t.limitText}</span>
                            <HBar
                              value={t.pct}
                              label={t.barLabel}
                              color={t.tone === "danger" ? "danger" : t.tone === "warning" ? "warning" : "accent"}
                            />
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={t.tone}>{t.alert}</ToneChip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </section>

          <Card className="gap-3 p-[18px]" aria-labelledby="fl-h">
            <div className="flex items-start gap-3">
              <div className="flex flex-1 flex-col gap-0.5">
                <h2 id="fl-h" className="text-[15px] leading-[22px] font-semibold">
                  Flagged Answers
                </h2>
                <p className="text-[13px] leading-[18px] text-muted">
                  Users chose to share these answers for review · nothing else from their conversations is visible
                </p>
              </div>
              <Chip size="sm" variant="soft" color="warning">
                <Chip.Label>{openFlags} open</Chip.Label>
              </Chip>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">
                Answer feedback · <span className="font-normal text-muted">{month?.ratedText}</span>
              </span>
              <div role="img" aria-label={fbAria} className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {segs.map((sg) => (
                  <span key={sg.label} className="block h-full" style={{ width: `${sg.v}%`, background: sg.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3.5 gap-y-1">
                {segs.map((sl) => (
                  <span key={sl.label} className="flex items-center gap-1.5 text-xs">
                    <i
                      aria-hidden="true"
                      className="inline-block size-2 rounded-full"
                      style={{ background: sl.color }}
                    />
                    {sl.label} <span className="tabular">{sl.v}%</span>
                  </span>
                ))}
              </div>
              <p className="flex items-start gap-2 text-xs leading-4 text-muted">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Cross-tenant reads: 0. {month?.refused} questions were refused because the record was outside the
                  asker’s permissions.
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-3.5">
              <ListView
                variant="secondary"
                aria-label="Flagged answers"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={new Set([selected?.id ?? "FL-0232"])}
                onSelectionChange={(keys) => {
                  const k = firstKey(keys);
                  if (k) {
                    setFlagId(k);
                    setFinding("correct");
                  }
                }}
                className="min-w-0 flex-[1_1_280px]"
              >
                {data.flags.map((f) => {
                  const shut = isClosed(f);
                  return (
                    <ListView.Item key={f.id} id={f.id} textValue={`${f.id} ${f.tenant}`}>
                      <ListView.ItemContent>
                        <Flag className="size-4 text-muted" />
                        <span className="flex flex-col">
                          <ListView.Title className="tabular">
                            {f.id} · {f.tenant}
                          </ListView.Title>
                          <ListView.Description>
                            {f.reason} · {f.age}
                          </ListView.Description>
                        </span>
                      </ListView.ItemContent>
                      <ListView.ItemAction>
                        <ToneChip tone={shut ? "success" : "warning"}>{shut ? "Closed" : "New"}</ToneChip>
                      </ListView.ItemAction>
                    </ListView.Item>
                  );
                })}
              </ListView>
              {selected ? (
                <Card variant="secondary" className="min-w-0 flex-[1_1_320px] gap-2.5 p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-semibold tabular">
                      {selected.id} · flagged by {selected.by}
                    </span>
                    <ToneChip tone={isClosed(selected) ? "success" : "warning"}>
                      {isClosed(selected) ? "Closed" : "New"}
                    </ToneChip>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted">Question</span>
                    <span className="text-[13px] leading-[18px]">{selected.question}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted">Answer excerpt</span>
                    <span className="text-[13px] leading-[18px]">{selected.excerpt}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted">Sources cited · permission checked</span>
                    <span className="text-[13px] tabular">{selected.sources}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted">User’s note</span>
                    <span className="text-[13px] leading-[18px]">{selected.note}</span>
                  </div>
                  {!isClosed(selected) ? (
                    <>
                      <RadioGroup
                        aria-label="Review finding"
                        value={finding}
                        onChange={setFinding}
                        className="grid gap-x-3 gap-y-1.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]"
                      >
                        {data.findings.map((fd) => (
                          <Radio key={fd.id} value={fd.id}>
                            <Radio.Content>
                              <Radio.Control>
                                <Radio.Indicator />
                              </Radio.Control>
                              <span>{fd.label}</span>
                            </Radio.Content>
                          </Radio>
                        ))}
                      </RadioGroup>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onPress={() =>
                            setClosed((s) => ({
                              ...s,
                              [selected.id]: `Finding: ${findingLabel.toLowerCase()} · user notified`,
                            }))
                          }
                        >
                          Record finding
                        </Button>
                        <span className="text-xs text-muted">The user is told the outcome, not your notes.</span>
                      </div>
                    </>
                  ) : (
                    <p className="flex items-center gap-2 text-[13px]">
                      <CircleCheck className="size-4 text-success" />
                      {selected.closedOutcome || closed[selected.id]}
                    </p>
                  )}
                </Card>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <Card className="gap-2.5 p-[18px]" aria-labelledby="lim-h">
            <div className="flex flex-col gap-0.5">
              <h2 id="lim-h" className="text-[15px] leading-[22px] font-semibold">
                Limits and Alerts
              </h2>
              <p className="text-[13px] leading-[18px] text-muted">{month?.budgetUsed}</p>
            </div>
            <Meter aria-label="Platform budget used" value={month?.budgetPct ?? 0} color="accent">
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
            <CellSelect
              variant="secondary"
              aria-label="Default tenant limit"
              value={limitId}
              onChange={(v) => {
                if (v == null) return;
                setLimitId(String(v));
                toast.success("Default tenant limit changed · applies from 1 November · logged in Audit");
              }}
            >
              <CellSelect.Trigger>
                <CellSelect.Label>Default tenant limit</CellSelect.Label>
                <CellSelect.Value />
                <CellSelect.Indicator />
              </CellSelect.Trigger>
              <CellSelect.Popover>
                <ListBox>
                  {data.limits.map((o) => (
                    <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                      {o.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </CellSelect.Popover>
            </CellSelect>
            {data.alerts.map((al) => (
              <CellSwitch
                key={al.id}
                variant="secondary"
                isSelected={alerts[al.id] ?? al.on}
                onChange={(on) => setAlerts((s) => ({ ...s, [al.id]: on }))}
                aria-label={al.label}
              >
                <CellSwitch.Trigger>
                  <CellSwitch.Label>{al.label}</CellSwitch.Label>
                  <CellSwitch.Control />
                </CellSwitch.Trigger>
              </CellSwitch>
            ))}
            <p className="text-xs leading-4 text-muted">
              At 100% answers pause for that tenant until the 1st. “Talk to a person” always stays on. Owners and the
              support lead are notified at each threshold.
            </p>
          </Card>

          <Card className="gap-2.5 p-[18px]" aria-labelledby="ret-h">
            <div className="flex items-start gap-2">
              <div className="flex flex-1 flex-col gap-0.5">
                <h2 id="ret-h" className="text-[15px] leading-[22px] font-semibold">
                  Retention
                </h2>
                <p className="text-[13px] leading-[18px] text-muted">
                  Platform defaults · tenants may shorten, never extend
                </p>
              </div>
              <GateChip icon={<ShieldExclamation className="size-3" />}>Awaiting privacy review</GateChip>
            </div>
            {data.retention.map((rt) => {
              const index = ret[rt.id] ?? rt.index;
              const value = rt.options[index % rt.options.length] ?? rt.options[0];
              return (
                <CellSelect
                  key={rt.id}
                  variant="secondary"
                  aria-label={rt.label}
                  value={value}
                  onChange={(v) => {
                    if (v == null) return;
                    const next = rt.options.indexOf(String(v));
                    setRet((s) => ({ ...s, [rt.id]: next < 0 ? 0 : next }));
                    toast.success(`${rt.label} retention changed · logged in Audit`);
                  }}
                >
                  <CellSelect.Trigger>
                    <CellSelect.Label>{rt.label}</CellSelect.Label>
                    <CellSelect.Value />
                    <CellSelect.Indicator />
                  </CellSelect.Trigger>
                  <CellSelect.Popover>
                    <ListBox>
                      {rt.options.map((o) => (
                        <ListBox.Item key={o} id={o} textValue={o}>
                          {o}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </CellSelect.Popover>
                </CellSelect>
              );
            })}
            <CellSwitch
              variant="secondary"
              isSelected={false}
              isDisabled
              aria-label="Use conversations to improve answers"
            >
              <CellSwitch.Trigger>
                <CellSwitch.Label>Use conversations to improve answers · Off</CellSwitch.Label>
                <Lock className="size-4 text-muted" />
              </CellSwitch.Trigger>
            </CellSwitch>
            <p className="text-xs leading-4 text-muted">
              Locked off: it would need each tenant’s written consent, and none has been given. Changes here are logged
              in Audit with your name.
            </p>
          </Card>
        </div>
      </div>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
