"use client";

import { ChartColumn, ChevronRight } from "@gravity-ui/icons";
import { Alert, Avatar, Card, Chip, ProgressBar, Table } from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, Timeline, TrendChip, Widget } from "@heroui-pro/react";
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
import { Fragment } from "react";

interface OwnerHomeData {
  kpis: OwnerKpi[];
  decisions: OwnerDecision[];
  revenueDays: RevenueDay[];
  properties: OwnerProperty[];
  insights: OwnerInsight[];
  compliance: ComplianceEvent[];
}

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

/** "Thursday 15 October 2026", today in Kigali. */
function kigaliLongDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(now)
    .replace(",", "");
}

/** "Good morning" until noon in Kigali, "Good afternoon" until six, then "Good evening". */
function greeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** A business of this owner's that is not on the marketplace yet, and where its real setup page is. */
export interface SetupDue {
  workspaceId: string;
  businessName: string;
  /** Setup is closed: unpaid, sent back, suspended or unclaimed. */
  notApproved: boolean;
  /** Paid and being reviewed: setup is open, Publish waits for approval. */
  inReview: boolean;
  /** What the listing still lacks besides approval, in the setup page's words. */
  missing: string[];
  href: string;
}

function setupDueWords(b: SetupDue): { title: string; text: string; cta: string } {
  if (b.notApproved)
    return {
      title: `${b.businessName} is not approved yet`,
      text: "See where the registration stands and anything it still needs.",
      cta: "See where it stands",
    };
  const left = b.missing.join(" ");
  if (b.inReview)
    return {
      title: `${b.businessName} is in review`,
      text: left
        ? `Get your listing ready while we review it. ${left} You can publish once it is approved.`
        : "Your listing is ready. You can publish as soon as it is approved.",
      cta: "Open setup",
    };
  return {
    title: `${b.businessName} is not on the marketplace yet`,
    text: left ? `${left} Then publish. Guests see nothing until you do.` : "Everything is in place. Publish it to go live.",
    cta: "Set up your property",
  };
}

export function OwnerHomeView({
  persona,
  data,
  setupDue = [],
  sample = false,
}: {
  persona: Persona;
  data: OwnerHomeData;
  setupDue?: SetupDue[];
  /** One of the demo's own people: Reports and Approvals are still the demo's, and only they see the links. */
  sample?: boolean;
}) {
  const waiting = data.decisions.length;
  const unsettled = data.kpis.find((k) => k.id === "unsettled");
  const labelAt = (i: number) =>
    i === 0 || i === 6 || i === data.revenueDays.length - 1 ? data.revenueDays[i]?.label : "";

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow={
          <>
            {kigaliLongDate()} · {persona.role}
          </>
        }
        title={`${greeting()}, ${persona.firstName}`}
        description={`${COUNT_WORDS[waiting] ?? waiting} ${waiting === 1 ? "decision is" : "decisions are"} waiting for you.${
          unsettled && unsettled.trendTone === "danger" ? ` ${unsettled.trend} unsettled are with Finance.` : ""
        }`}
        actions={
          // The figures here are tonight's and today's, as each one's label says. A period switch changed none
          // of them, so other periods are in Reports.
          sample ? (
            <LinkButton href={screenHref("Reports")} variant="secondary">
              <ChartColumn className="size-4" />
              Open reports
            </LinkButton>
          ) : null
        }
      />

      {setupDue.map((b) => {
        // The setup page is the one path to the marketplace: rooms, prices, a photograph, publish. Nothing
        // else in this shell linked to it, so an approved owner signing in here never found it.
        const words = setupDueWords(b);
        return (
          <Alert key={b.workspaceId} status={b.notApproved ? "default" : "accent"} role="status">
            <Alert.Content>
              <Alert.Title>{words.title}</Alert.Title>
              <Alert.Description>{words.text}</Alert.Description>
            </Alert.Content>
            <LinkButton href={b.href} variant="primary">
              {words.cta}
            </LinkButton>
          </Alert>
        );
      })}

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
            {sample ? (
              <LinkButton href={screenHref("Approvals")} size="sm" variant="ghost">
                All approvals
              </LinkButton>
            ) : null}
          </ItemCardGroup.Header>
          {data.decisions.length === 0 ? <p className="text-sm text-muted">Nothing is waiting for you.</p> : null}
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
              Posted folio and outlet charges in the rooms and food and beverage departments, before fiscal adjustments.
              Other departments are not drawn.
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
            {data.insights.length === 0 ? <p className="text-sm text-muted">Nothing stands out yet.</p> : null}
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
