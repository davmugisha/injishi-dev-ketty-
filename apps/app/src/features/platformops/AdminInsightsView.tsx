"use client";

import { ArrowDownRight, ArrowDownToLine, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, ListBox, Select, Switch, Table, Tabs } from "@heroui/react";
import { TrendChip, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import type { CaptureEvent, FunnelStep, InsightArea, NorthStarStep } from "@injishi/data/fixtures/platformops";
import { Icon, PageContent, PageHeader, SectionHeader } from "@injishi/ui";
import { useState } from "react";
import { HBar, KpiStrip, ToneChip } from "./shared";

interface AdminInsightsData {
  areas: InsightArea[];
  steps: NorthStarStep[];
  funnel: FunnelStep[];
  events: CaptureEvent[];
}

const PERIODS = [{ id: "oct", label: "October 2026 to date" }];

export function AdminInsightsView({ data }: { data: AdminInsightsData }) {
  const [tab, setTab] = useState("exec");
  const [showDef, setShowDef] = useState(false);
  const [gaps, setGaps] = useState(false);
  const events = data.events.filter((e) => !gaps || e.status !== "Live");

  return (
    <PageContent>
      <PageHeader
        eyebrow="Oversight › Insights · Injishi staff only · October 2026 to date"
        title="Platform Insights"
        description="How the platform is doing across tenants. Figures are aggregated; no guest, resident or employee records are shown here."
        actions={
          <>
            <Select aria-label="Period" value="oct" className="min-w-[180px]">
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PERIODS.map((p) => (
                    <ListBox.Item key={p.id} id={p.id} textValue={p.label}>
                      {p.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button variant="secondary">
              <ArrowDownToLine />
              Export
            </Button>
          </>
        }
      />

      <Card className="gap-3.5 p-5" aria-labelledby="ns-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-[min(300px,100%)] flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">North-star</span>
              <Chip size="sm" variant="soft" color="warning">
                <Chip.Label>Proposed metric · definition not approved</Chip.Label>
              </Chip>
            </span>
            <h2 id="ns-h" className="text-[17px] leading-6 font-semibold">
              Businesses completing reservation → stay → financial close this month
            </h2>
            <span className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[36px] leading-[44px] font-semibold tabular">63</span>
              <span className="text-sm text-muted">of 181 active businesses · 35%</span>
              <TrendChip trend="down" size="sm" className="whitespace-nowrap">
                <TrendChip.Indicator>
                  <ArrowDownRight className="size-3" />
                </TrendChip.Indicator>
                71 in September · month not finished
              </TrendChip>
            </span>
          </div>
          <Button size="sm" variant="ghost" aria-expanded={showDef} onPress={() => setShowDef((v) => !v)}>
            {showDef ? "Hide definition" : "Show definition"}
          </Button>
        </div>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
          {data.steps.map((s) => (
            <Card key={s.id} variant="secondary" className="gap-1.5 px-3.5 py-3">
              <span className="text-xs text-muted">{s.label}</span>
              <span className="text-xl font-semibold tabular">{s.value}</span>
              <HBar value={s.pct} label={s.label} />
            </Card>
          ))}
        </div>
        {showDef ? (
          <Card variant="secondary" className="gap-1.5 px-3.5 py-3 text-[13px] leading-[19px]">
            <span>
              <strong>Counts a business once</strong> if, in the calendar month (CAT), at least one reservation became a
              checked-out stay, its folio closed with a Verified payment and an Issued fiscal receipt, and the business
              day closed with no open exceptions.
            </span>
            <span className="text-muted">
              Owner: product analytics · approver: Alain Ntwari and Platform finance · version 0.3 draft
            </span>
          </Card>
        ) : null}
        <Alert status="warning">
          <Alert.Indicator>
            <TriangleExclamation />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Computed from a proxy</Alert.Title>
            <Alert.Description>
              The financial_close.completed event is not instrumented yet, so the last step uses night-audit records.
              Treat this as indicative until the event ships and the definition is approved.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="tab-h">
        <h2 id="tab-h" className="sr-only">
          Analytics by area
        </h2>
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Analytics area" className="gap-1">
              {data.areas.map((a) => (
                <Tabs.Tab key={a.id} id={a.id} className="h-10 w-auto flex-none gap-2 px-3 text-sm whitespace-nowrap">
                  <Icon name={a.icon} className="size-4" />
                  {a.label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {data.areas.map((a) => (
            <Tabs.Panel key={a.id} id={a.id} className="flex flex-col gap-3 p-0 pt-3">
              <AreaPanel area={a} />
            </Tabs.Panel>
          ))}
        </Tabs>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-[1_1_380px] gap-2.5 p-[18px]" aria-labelledby="fn-h">
          <div className="flex flex-col gap-0.5">
            <h2 id="fn-h" className="text-[15px] leading-[22px] font-semibold">
              Registration to Activation
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Cohort registered 1 Jan to 30 Sep 2026 · 312 businesses
            </p>
          </div>
          {data.funnel.map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span>{f.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular">{f.count}</span>
                  <span className="w-[76px] text-right text-xs text-muted tabular">
                    {f.conversion ? `${f.conversion} of prev.` : "cohort"}
                  </span>
                </span>
              </div>
              <HBar value={Math.round((f.count / 312) * 100)} label={f.label} />
            </div>
          ))}
          <p className="text-xs leading-4 text-muted">
            Biggest drop: registered but never submitted KYB (71). 19 are open drafts; 52 went quiet. The
            financial-close step uses the same proxy as the north-star.
          </p>
        </Card>

        <Card className="min-w-0 flex-[1.5_1_520px] gap-2.5 p-[18px]" aria-labelledby="evd-h">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="evd-h" className="text-[15px] leading-[22px] font-semibold">
                Event Capture Definitions
              </h2>
              <p className="text-[13px] leading-[18px] text-muted">
                Product events behind the funnel. Tenant and property IDs only; never names, phone numbers or ID
                numbers.
              </p>
            </div>
            <Switch size="sm" isSelected={gaps} onChange={setGaps} aria-label="Gaps only">
              <Switch.Content className="flex items-center gap-2 text-[13px] font-normal">
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Gaps only
              </Switch.Content>
            </Switch>
          </div>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Event capture definitions">
                <Table.Header>
                  <Table.Column isRowHeader>Event</Table.Column>
                  <Table.Column>Fires when</Table.Column>
                  <Table.Column>Properties</Table.Column>
                  <Table.Column>Status</Table.Column>
                </Table.Header>
                <Table.Body>
                  {events.map((e) => (
                    <Table.Row key={e.id} id={e.id}>
                      <Table.Cell className="text-xs font-medium tabular">{e.name}</Table.Cell>
                      <Table.Cell className="text-xs leading-4">{e.when}</Table.Cell>
                      <Table.Cell className="text-xs leading-4 text-muted">{e.props}</Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={e.tone}>{e.status}</ToneChip>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card>
      </div>
    </PageContent>
  );
}

function AreaPanel({ area }: { area: InsightArea }) {
  const aria = `${area.chartTitle}, ${area.unit}: ${area.points
    .map((p) => (p.label ? `${p.label} ${p.value}` : ""))
    .filter(Boolean)
    .join(", ")}`;
  const chart = area.points.map((p, i) => ({
    id: `${area.id}-${i}`,
    label: p.label,
    solid: area.muteLast && i === area.points.length - 1 ? 0 : p.value,
    muted: area.muteLast && i === area.points.length - 1 ? p.value : 0,
  }));

  return (
    <>
      <KpiStrip
        label={`${area.label} figures`}
        items={area.kpis}
        itemClassName="min-w-[min(200px,100%)] flex-[1_1_200px]"
      />
      <div className="flex flex-wrap items-stretch gap-4">
        <Widget className="min-w-0 flex-[999_1_520px]" aria-labelledby="ch-h" render={(p) => <section {...p} />}>
          <Widget.Header>
            <Widget.Title id="ch-h">{area.chartTitle}</Widget.Title>
            <span className="text-xs text-muted">{area.unit}</span>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-2">
            <BarChart data={chart} height={150} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} aria-label={aria}>
              <BarChart.XAxis dataKey="label" hide />
              <BarChart.YAxis hide domain={[0, area.max]} />
              <BarChart.Bar
                dataKey="solid"
                stackId="v"
                fill="var(--chart-3)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <BarChart.Bar
                dataKey="muted"
                stackId="v"
                fill="var(--chart-5)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
            <div className="flex">
              {area.points.map((p, i) => (
                <span key={`${area.id}-l-${i}`} className="flex-1 text-center text-[11px] text-muted">
                  {p.label}
                </span>
              ))}
            </div>
            <p className="text-xs leading-4 text-muted">{area.caption}</p>
          </Widget.Content>
        </Widget>
        <Card className="min-w-0 flex-[1_1_300px] gap-2.5 p-[18px]" aria-labelledby="br-h">
          <SectionHeader id="br-h" title={area.breakTitle} />
          {area.breakdown.map((d) => (
            <div key={d.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span>{d.label}</span>
                <span className="font-medium tabular">{d.value}</span>
              </div>
              <HBar value={d.pct} label={d.label} />
            </div>
          ))}
          <p className="text-xs leading-4 text-muted">{area.note}</p>
        </Card>
      </div>
    </>
  );
}
