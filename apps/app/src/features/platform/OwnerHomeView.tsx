"use client";

import { ChartColumn, ChevronRight } from "@gravity-ui/icons";
import { Avatar, Card, Chip, ProgressBar, Table } from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, Segment, Timeline, TrendChip, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ComplianceEvent,
  OwnerDecision,
  OwnerInsight,
  OwnerKpi,
  OwnerProperty,
  RevenueDay,
} from "@injishi/data/fixtures/platform";
import { Icon, LinkButton, PageContent, PageHeader, SectionHeader, StatusDot, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useState } from "react";

export interface OwnerHomeData {
  kpis: OwnerKpi[];
  decisions: OwnerDecision[];
  revenueDays: RevenueDay[];
  properties: OwnerProperty[];
  insights: OwnerInsight[];
  compliance: ComplianceEvent[];
}

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "mtd", label: "Month to date" },
];

function KpiTrend({ kpi }: { kpi: OwnerKpi }) {
  if (kpi.trendTone === "success" || kpi.trendTone === "danger") {
    const custom = kpi.trendIcon !== "ArrowUpRight" && kpi.trendIcon !== "ArrowDownRight";
    return (
      <KPI.Trend trend={kpi.trendTone === "success" ? "up" : "down"}>
        {custom ? (
          <TrendChip.Indicator>
            <Icon name={kpi.trendIcon} className="size-3" />
          </TrendChip.Indicator>
        ) : null}
        {kpi.trend}
      </KPI.Trend>
    );
  }
  return (
    <Chip size="sm" variant="soft" color={toneColor(kpi.trendTone)}>
      <Icon name={kpi.trendIcon} className="size-3" />
      <Chip.Label>{kpi.trend}</Chip.Label>
    </Chip>
  );
}

export function OwnerHomeView({ persona, data }: { persona: Persona; data: OwnerHomeData }) {
  const [period, setPeriod] = useState("today");
  const labelAt = (i: number) =>
    i === 0 || i === 6 || i === data.revenueDays.length - 1 ? data.revenueDays[i]?.label : "";

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow={<>Monday 12 October 2026 · {persona.role}</>}
        title={`Good morning, ${persona.firstName}`}
        description="Four decisions are waiting for you. Two payment exceptions are with Finance."
        actions={
          <>
            <Segment aria-label="Period" selectedKey={period} onSelectionChange={(k) => setPeriod(String(k))}>
              {PERIODS.map((p) => (
                <Segment.Item key={p.id} id={p.id}>
                  {p.label}
                </Segment.Item>
              ))}
            </Segment>
            <LinkButton href={screenHref("Reports")} variant="secondary">
              <ChartColumn className="size-4" />
              Open reports
            </LinkButton>
          </>
        }
      />

      <section aria-label="Key figures">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((kpi, i) => (
            <Fragment key={kpi.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="relative min-w-[min(200px,100%)]">
                <KPI.Header>
                  <KPI.Title>
                    <NextLink
                      href={screenHref(kpi.board)}
                      className="text-inherit no-underline after:absolute after:inset-0"
                    >
                      {kpi.label}
                    </NextLink>
                  </KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value value={kpi.value} formatOptions={kpi.format} className="tabular" />
                  <KpiTrend kpi={kpi} />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs leading-4 text-muted">{kpi.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <ItemCardGroup layout="list" aria-labelledby="wait-h">
          <ItemCardGroup.Header className="flex items-center gap-2">
            <div className="flex-1">
              <ItemCardGroup.Title id="wait-h">Waiting for You</ItemCardGroup.Title>
              <ItemCardGroup.Description>
                Only the owner can decide these. Each opens with its evidence.
              </ItemCardGroup.Description>
            </div>
            <LinkButton href={screenHref("Approvals")} size="sm" variant="ghost">
              All approvals
            </LinkButton>
          </ItemCardGroup.Header>
          {data.decisions.map((d) => (
            <ItemCard key={d.id}>
              <ItemCard.Icon>
                <Icon name={d.icon} />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>{d.title}</ItemCard.Title>
                <ItemCard.Description>{d.desc}</ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action className="flex items-center gap-2">
                <Chip size="sm" variant="soft" color={toneColor(d.chipTone)}>
                  {d.chip}
                </Chip>
                <LinkButton href={screenHref(d.board)} size="sm" aria-label={`Review: ${d.title}`}>
                  Review
                </LinkButton>
              </ItemCard.Action>
            </ItemCard>
          ))}
        </ItemCardGroup>

        <Widget aria-labelledby="rev-h">
          <Widget.Header>
            <Widget.Title id="rev-h">Revenue by Department</Widget.Title>
            <Widget.Legend>
              <Widget.LegendItem color="var(--chart-1)">Rooms</Widget.LegendItem>
              <Widget.LegendItem color="var(--chart-4)">Food and beverage</Widget.LegendItem>
            </Widget.Legend>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-2.5">
            <div role="img" aria-label="Daily revenue for the last 14 days, rooms and food and beverage stacked">
              <BarChart
                data={data.revenueDays.map((d) => ({ label: d.label, rooms: d.rooms, fb: d.fb }))}
                height={170}
                margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              >
                <BarChart.XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tickFormatter={(_: string, i: number) => labelAt(i) ?? ""}
                />
                <BarChart.Tooltip content={<BarChart.TooltipContent />} cursor={false} />
                <BarChart.Bar dataKey="rooms" name="Rooms" stackId="rev" fill="var(--chart-1)" radius={[2, 2, 2, 2]} />
                <BarChart.Bar
                  dataKey="fb"
                  name="Food and beverage"
                  stackId="rev"
                  fill="var(--chart-4)"
                  radius={[5, 5, 2, 2]}
                />
              </BarChart>
            </div>
            <p className="text-xs text-muted">
              Posted folio and outlet charges, before fiscal adjustments. Tenant outlet Ikawa Corner is a separate
              merchant and is not included.
            </p>
          </Widget.Content>
        </Widget>
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="props-h">
        <SectionHeader
          id="props-h"
          title="Properties"
          action={<span className="text-xs text-muted">Residence is measured by leases, not nights</span>}
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Properties">
              <Table.Header>
                <Table.Column isRowHeader>Property</Table.Column>
                <Table.Column>Legal entity</Table.Column>
                <Table.Column>Occupancy</Table.Column>
                <Table.Column className="text-right">ADR</Table.Column>
                <Table.Column>Open exceptions</Table.Column>
                <Table.Column>Fiscal queue</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.properties.map((p) => (
                  <Table.Row key={p.id} id={p.id}>
                    <Table.Cell>
                      <NextLink
                        href={screenHref(p.board)}
                        className="flex items-center gap-3 text-inherit no-underline"
                      >
                        <Avatar size="sm" variant="soft" color="accent">
                          <Avatar.Fallback>{p.initials}</Avatar.Fallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted">{p.kind}</span>
                        </span>
                      </NextLink>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col gap-0.5">
                        <span>{p.entity}</span>
                        <span className="text-xs text-muted tabular">{p.tin}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="min-w-40">
                      <ProgressBar
                        value={p.occupancyValue}
                        size="sm"
                        aria-label={`${p.name} occupancy`}
                        className="gap-1.5"
                      >
                        <span className="font-medium tabular">{p.occupancy}</span>
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </Table.Cell>
                    <Table.Cell className="text-right tabular">{p.adr}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(p.exceptionsTone)}>
                        {p.exceptions}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex items-center gap-2">
                        <StatusDot tone={p.fiscalTone} />
                        {p.fiscal}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <Card aria-labelledby="ins-h" className="gap-3 p-[18px]">
          <Card.Header>
            <Card.Title id="ins-h" className="text-[15px] font-semibold">
              Worth Acting On
            </Card.Title>
            <Card.Description>Patterns from this week, each with the records behind it</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {data.insights.map((ins) => (
              <NextLink key={ins.id} href={screenHref(ins.board)} className="block text-inherit no-underline">
                <ItemCard variant="secondary">
                  <ItemCard.Icon>
                    <Icon name={ins.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title className="whitespace-normal">{ins.title}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{ins.evidence}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                  </ItemCard.Action>
                </ItemCard>
              </NextLink>
            ))}
          </Card.Content>
        </Card>

        <Card aria-labelledby="comp-h" className="gap-3 p-[18px]">
          <Card.Header>
            <Card.Title id="comp-h" className="text-[15px] font-semibold">
              Compliance and Integrations
            </Card.Title>
            <Card.Description>Nothing here is marked done without the counterpart’s evidence</Card.Description>
          </Card.Header>
          <Card.Content>
            <Timeline size="sm" density="compact">
              {data.compliance.map((c) => (
                <Timeline.Item key={c.id} status={c.status}>
                  <Timeline.Rail>
                    <Timeline.Marker>
                      <Icon name={c.icon} className="size-3" />
                    </Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                    <NextLink href={screenHref(c.board)} className="font-medium text-inherit no-underline">
                      {c.title}
                    </NextLink>
                    <span className="text-xs leading-4 text-muted">{c.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card.Content>
        </Card>
      </div>
    </PageContent>
  );
}
