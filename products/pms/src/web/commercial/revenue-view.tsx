"use client";

import { Tag } from "@gravity-ui/icons";
import { Card, Chip, ProgressBar, Table } from "@heroui/react";
import { KPIGroup, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { Fragment, type ReactNode, useState } from "react";
import type { RevenueScenarioId } from "../../model/commercial.ts";
import {
  REVENUE_MILLIONS,
  type RevenueData,
  revenueCount,
  revenueEventsFor,
  revenueFigures,
  revenueNightRows,
  revenueRecommendationsFor,
  revenueRound1,
  revenueRwf,
  revenueRwfM,
  revenueSignedPts,
} from "../../model/revenue-model.ts";
import { useBoardHref, usePmsShell } from "../mount.tsx";
import { RevenueForecast } from "./revenue-forecast.tsx";
import { RevenueRecommendations } from "./revenue-recommendations.tsx";

function RevenueKpi({
  label,
  tag,
  forecast,
  value,
  foot,
}: {
  label: string;
  tag: string;
  forecast?: boolean;
  value: ReactNode;
  foot: string;
}) {
  return (
    <KPI className="min-w-[min(220px,100%)] flex-[1_1_220px]">
      <KPI.Header>
        <KPI.Title>{label}</KPI.Title>
        <Chip size="sm" variant="soft" color={forecast ? "warning" : "default"} className="ml-auto">
          {tag}
        </Chip>
      </KPI.Header>
      <KPI.Content>{value}</KPI.Content>
      <KPI.Footer>
        <p className="text-xs leading-4 text-muted">{foot}</p>
      </KPI.Footer>
    </KPI>
  );
}

function RevenueLegendKey({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {children}
    </span>
  );
}

export function RevenueView({ data }: { data: RevenueData }) {
  const screenHref = useBoardHref();
  const { TopbarStatus } = usePmsShell();
  const [scenario, setScenario] = useState<RevenueScenarioId>("base");
  const rows = revenueNightRows(data, scenario);
  // Opens on the busiest night of the base forecast (the first night at the peak).
  const [night, setNight] = useState(() => {
    const base = revenueNightRows(data, "base").map((r) => r.forecast.value);
    return Math.max(0, base.indexOf(Math.max(...base)));
  });

  const current = data.scenarios.find((s) => s.id === scenario);
  const withOwner = data.recommendations.filter((r) => r.scenario === null && r.status === "pending").length;
  const fig = revenueFigures(data, scenario);
  const base = revenueFigures(data, "base");
  const conference = revenueFigures(data, "conference");
  const compare = [
    { k: "Occupancy, 30 nights", a: `${revenueRound1(base.occupancy)}%`, b: `${revenueRound1(conference.occupancy)}%` },
    { k: "Room nights", a: String(base.roomNights), b: String(conference.roomNights) },
    { k: "ADR", a: revenueRwf(base.adr), b: revenueRwf(conference.adr) },
    { k: "Rooms revenue", a: revenueRwfM(base.revenue), b: revenueRwfM(conference.revenue) },
    {
      k: "Rate changes suggested",
      a: String(revenueRecommendationsFor(data, "base").length),
      b: String(revenueRecommendationsFor(data, "conference").length),
    },
  ];

  const kpis = [
    {
      id: "otb",
      label: "On the books",
      tag: "Recorded",
      value: (
        <KPI.Value
          value={fig.onTheBooks / 100}
          formatOptions={{ style: "percent", maximumFractionDigits: 1 }}
          className="tabular"
        />
      ),
      foot: `${fig.onTheBooksRoomNights} of ${revenueCount(fig.capacity)} room nights reserved`,
    },
    {
      id: "occ",
      label: "Occupancy",
      tag: "Forecast",
      forecast: true,
      value: (
        <KPI.Value
          value={fig.occupancy / 100}
          formatOptions={{ style: "percent", maximumFractionDigits: 1 }}
          className="tabular"
        />
      ),
      foot: `80% range ${Math.round(fig.low)}–${Math.round(fig.high)}% · ${fig.roomNights} room nights`,
    },
    {
      id: "pace",
      label: "Pace vs last year",
      tag: "Recorded",
      value: (
        <KPI.Value
          value={fig.pace}
          formatOptions={{ signDisplay: "exceptZero", maximumFractionDigits: 1 }}
          className="tabular"
        >
          {(formatted) => `${formatted} pts`}
        </KPI.Value>
      ),
      foot: "On the books vs the same date in 2025",
    },
    {
      id: "rev",
      label: "Rooms revenue",
      tag: "Forecast",
      forecast: true,
      value: <KPI.Value value={fig.revenue} formatOptions={REVENUE_MILLIONS} className="tabular" />,
      foot: `Range ${revenueRwfM(fig.revenueLow)} – ${revenueRwfM(fig.revenueHigh)} at ADR ${revenueRwf(fig.adr)}`,
    },
  ];

  return (
    <PageContent>
      <TopbarStatus
        kind="chip"
        label={`${withOwner} ${withOwner === 1 ? "rate change" : "rate changes"} with owner`}
        tone="default"
        dot="warning"
      />
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Commercial · Next 30 nights, 13 Oct – 11 Nov"
        title="Revenue"
        actions={
          <>
            <Segment
              aria-label="Scenario"
              selectedKey={scenario}
              onSelectionChange={(k) => setScenario(k === "conference" ? "conference" : "base")}
            >
              {data.scenarios.map((s) => (
                <Segment.Item key={s.id} id={s.id}>
                  {s.label}
                </Segment.Item>
              ))}
            </Segment>
            <LinkButton href={screenHref("RatesInventory")} variant="secondary">
              <Tag className="size-4" />
              Rates &amp; inventory
            </LinkButton>
          </>
        }
      />

      <section aria-label="Key figures, next 30 nights">
        <KPIGroup className="flex-wrap">
          {kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <RevenueKpi label={k.label} tag={k.tag} forecast={k.forecast} value={k.value} foot={k.foot} />
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(min(320px,100%),1fr)]">
        <RevenueForecast
          rows={rows}
          events={revenueEventsFor(data, scenario)}
          scenario={current}
          selected={night}
          onSelect={setNight}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="pace-h">
            <Card className="gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="pace-h" className="text-[15px] font-semibold">
                  Pace vs Last Year
                </Card.Title>
                <Card.Description>
                  On the books today vs the same date in 2025 · recorded, not forecast
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <div className="flex items-center gap-[14px]">
                  <RevenueLegendKey color="var(--chart-3)">2026</RevenueLegendKey>
                  <RevenueLegendKey color="var(--chart-5)">Same date 2025</RevenueLegendKey>
                </div>
                {data.paceWeeks.map((w) => {
                  const diff = w.onTheBooks - w.lastYear;
                  return (
                    <div key={w.id} className="grid grid-cols-[96px_minmax(0,1fr)_62px] items-center gap-[10px]">
                      <span className="flex flex-col">
                        <span className="text-xs font-medium">{w.label}</span>
                        <span className="text-[11px] leading-[14px] text-muted tabular">
                          {w.onTheBooks}% vs {w.lastYear}%
                        </span>
                      </span>
                      <span className="flex flex-col gap-[3px]" aria-hidden="true">
                        <ProgressBar value={w.onTheBooks} size="sm" aria-label={`${w.label}, 2026`}>
                          <ProgressBar.Track>
                            <ProgressBar.Fill style={{ background: "var(--chart-3)" }} />
                          </ProgressBar.Track>
                        </ProgressBar>
                        <ProgressBar value={w.lastYear} size="sm" aria-label={`${w.label}, same date 2025`}>
                          <ProgressBar.Track>
                            <ProgressBar.Fill style={{ background: "var(--chart-5)" }} />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </span>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={diff >= 0 ? "success" : "danger"}
                        className="justify-self-end tabular"
                      >
                        {revenueSignedPts(diff)}
                      </Chip>
                    </div>
                  );
                })}
              </Card.Content>
            </Card>
          </section>

          <section aria-labelledby="sc-h">
            <Card className="gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="sc-h" className="text-[15px] font-semibold">
                  Scenario Comparison
                </Card.Title>
                <Card.Description>
                  Conference week assumes the Lake Kivu Business Summit, 28–31 Oct, is confirmed (enquiry only, not
                  contracted)
                </Card.Description>
              </Card.Header>
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Scenario comparison">
                    <Table.Header>
                      <Table.Column isRowHeader>Forecast</Table.Column>
                      <Table.Column className="text-right">Base</Table.Column>
                      <Table.Column className="text-right">Conference</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {compare.map((c) => (
                        <Table.Row key={c.k} id={c.k}>
                          <Table.Cell className="text-[13px]">{c.k}</Table.Cell>
                          <Table.Cell className="text-right text-[13px] tabular">{c.a}</Table.Cell>
                          <Table.Cell className="text-right text-[13px] tabular">{c.b}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </Card>
          </section>
        </div>
      </div>

      <RevenueRecommendations recommendations={revenueRecommendationsFor(data, scenario)} scenario={scenario} />
    </PageContent>
  );
}
