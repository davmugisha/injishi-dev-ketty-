"use client";

import { FileText, FolderHouse, PersonPlus, ShieldExclamation, Wallet, Wrench } from "@gravity-ui/icons";
import { Card, Chip, Separator, ToggleButton } from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, ListView, Segment, Timeline, TrendChip, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ArrearsBucket,
  HomeKpi,
  HomeTicket,
  LeaseFiling,
  RenewalNotice,
  RentBucket,
  ResidenceBlock,
  ResidenceUnit,
  ServiceTicket,
  Tone,
  UnitStatus,
  Vacancy,
} from "@injishi/data/fixtures/residence";
import { GateChip, Icon, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { type CSSProperties, Fragment, useState } from "react";
import { Dot, HBar, Legend, money, plain, ToneChip } from "./shared";

export interface ResidenceHomeData {
  kpis: HomeKpi[];
  rent: RentBucket[];
  aging: ArrearsBucket[];
  vacancies: Vacancy[];
  blocks: ResidenceBlock[];
  units: ResidenceUnit[];
  renewals: RenewalNotice[];
  homeTickets: HomeTicket[];
  tickets: ServiceTicket[];
  filings: LeaseFiling[];
}

/** How a unit's rent status reads on its tile, in the selected-unit panel and in the legend. */
const STATUS: Record<UnitStatus, { tag: string; chip: string; legend: string; tone: Tone }> = {
  paid: { tag: "Paid", chip: "Paid · verified", legend: "Paid, verified", tone: "success" },
  pending: { tag: "Pending", chip: "Payment pending", legend: "Payment pending", tone: "info" },
  unknown: { tag: "Unknown", chip: "Checking provider", legend: "Result unknown", tone: "warning" },
  arrears: { tag: "Arrears", chip: "In arrears", legend: "In arrears", tone: "danger" },
  notice: { tag: "Notice", chip: "Notice given", legend: "Notice given", tone: "accent" },
  vacant: { tag: "Vacant", chip: "Vacant", legend: "Vacant", tone: "default" },
};
const LEGEND_ORDER: UnitStatus[] = ["paid", "pending", "unknown", "arrears", "notice", "vacant"];

type Filter = "all" | "attention" | "vacant" | "tenancy";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Rent attention" },
  { id: "vacant", label: "Vacant" },
  { id: "tenancy", label: "Notices & renewals" },
];

/** Days of vacancy that fill the vacancy bar. */
const VACANCY_SCALE_DAYS = 60;

/** Tile surface per status (artifact .ij-room): vacant units are hatched, units in arrears get a danger ring. */
const tileVars = (status: UnitStatus): CSSProperties => {
  const bg = status === "vacant" ? "var(--surface-secondary)" : "var(--surface)";
  const hover = `color-mix(in oklab, ${bg}, var(--foreground) 5%)`;
  return {
    "--toggle-button-bg": bg,
    "--toggle-button-bg-hover": hover,
    "--toggle-button-bg-pressed": hover,
    "--toggle-button-bg-selected": bg,
    "--toggle-button-bg-selected-hover": hover,
    "--toggle-button-bg-selected-pressed": hover,
    "--toggle-button-fg": "var(--foreground)",
    "--toggle-button-fg-selected": "var(--foreground)",
  } as CSSProperties;
};
const TILE_DECOR: Record<UnitStatus, string> = {
  paid: "shadow-surface",
  pending: "shadow-surface",
  unknown: "shadow-surface",
  notice: "shadow-surface",
  arrears: "shadow-[inset_0_0_0_1.5px_var(--danger)]",
  vacant:
    "bg-[repeating-linear-gradient(135deg,var(--surface-secondary)_0_6px,var(--surface-tertiary)_6px_12px)] shadow-none",
};

/** "C. Nsengimana"; companies keep their first word ("Umurage Ltd"). */
function shortName(name: string): string {
  if (!name) return "No resident";
  const parts = name.split(" ");
  if (name.includes("Ltd")) return `${parts[0]} Ltd`;
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

function KpiTrend({ kpi }: { kpi: HomeKpi }) {
  if (kpi.trendTone === "success" || kpi.trendTone === "danger") {
    return (
      <KPI.Trend trend={kpi.trendTone === "success" ? "up" : "down"} className="ml-auto whitespace-nowrap">
        <TrendChip.Indicator>
          <Icon name={kpi.trendIcon} className="size-3" />
        </TrendChip.Indicator>
        {kpi.trend}
      </KPI.Trend>
    );
  }
  return (
    <Chip size="sm" variant="soft" color={toneColor(kpi.trendTone)} className="ml-auto whitespace-nowrap">
      <Icon name={kpi.trendIcon} className="size-3" />
      <Chip.Label>{kpi.trend}</Chip.Label>
    </Chip>
  );
}

function CardHeading({ id, children }: { id: string; children: string }) {
  return (
    <Card.Title id={id} render={(p) => <h2 {...p} />} className="text-[15px] leading-[22px] font-semibold">
      {children}
    </Card.Title>
  );
}

export function ResidenceHomeView({ persona, data }: { persona: Persona; data: ResidenceHomeData }) {
  const [selected, setSelected] = useState("B-07");
  const [filter, setFilter] = useState<Filter>("all");

  const bucket = (id: RentBucket["id"]) => data.rent.find((b) => b.id === id)?.amount ?? 0;
  const scheduled = bucket("scheduled");
  const verified = bucket("verified");
  const pending = bucket("pending");
  const unpaid = Math.max(0, scheduled - verified - pending);
  const pct = (v: number) => (scheduled ? Math.round((v / scheduled) * 100) : 0);

  const agingTotal = data.aging.reduce((t, a) => t + a.amount, 0);
  const agingMax = Math.max(1, ...data.aging.map((a) => a.amount));
  const inArrears = data.units.filter((u) => u.status === "arrears").length;
  const agingLabel = `Arrears by age: ${data.aging
    .map(
      (a) =>
        `${a.label.charAt(0).toLowerCase()}${a.label.slice(1)} ${a.amount ? `RWF ${(a.amount / 1e6).toFixed(1)} million` : "none"}`,
    )
    .join(", ")}`;

  const vacantRent = data.vacancies.reduce((t, v) => t + v.rent, 0);
  const vacancyDays = (id: string) => data.vacancies.find((v) => v.unit === id)?.days;
  const tenancyUnits = new Set(data.renewals.map((r) => r.unit));
  const matches = (u: ResidenceUnit) => {
    if (filter === "all") return true;
    if (filter === "attention") return u.status === "arrears" || u.status === "pending" || u.status === "unknown";
    if (filter === "vacant") return u.status === "vacant";
    return tenancyUnits.has(u.id);
  };

  const unit = data.units.find((u) => u.id === selected) ?? data.units[0];
  const unitStatus = STATUS[unit.status];
  const isVacant = unit.status === "vacant";
  const blockName = data.blocks.find((b) => b.id === unit.block)?.name ?? `Block ${unit.block}`;

  const openTickets = data.tickets.filter((t) => t.status !== "done");
  const unassigned = data.tickets.filter((t) => t.status === "new").length;
  const awaitingAck = data.filings.filter((f) => f.stage === "awaiting").length;
  const drafts = data.filings.filter((f) => f.stage === "draft").length;

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow="Monday 12 October 2026 · Kacyiru Court Residences · Gasabo"
        title={`Good morning, ${persona.firstName}`}
        description="Three residents are in arrears, Olivier Habineza answers his renewal offer by Thursday, and two units are waiting for tenants."
        actions={
          <>
            <LinkButton href={screenHref("RentRoll")} variant="secondary">
              <Wallet className="size-4" />
              Open rent roll
            </LinkButton>
            <LinkButton href={screenHref("Applicants")}>
              <PersonPlus className="size-4" />
              Invite applicant
            </LinkButton>
          </>
        }
      />

      <section aria-label="October figures">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((kpi, i) => (
            <Fragment key={kpi.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="relative min-w-[min(190px,100%)] flex-[1_1_190px]">
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
                <KPI.Content className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  {kpi.total ? (
                    <KPI.Value value={kpi.value} className="tabular">
                      {(formatted) => `${formatted} of ${kpi.total}`}
                    </KPI.Value>
                  ) : (
                    <KPI.Value value={kpi.value} formatOptions={kpi.format} className="tabular" />
                  )}
                  <KpiTrend kpi={kpi} />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-[12px] leading-4 text-muted">{kpi.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        <Widget aria-labelledby="rent-h" render={(p) => <section {...p} />}>
          <Widget.Header>
            <Widget.Title id="rent-h" role="heading" aria-level={2}>
              October Rent
            </Widget.Title>
            <Widget.Legend>
              <Widget.LegendItem color="var(--chart-3)">Verified</Widget.LegendItem>
              <Widget.LegendItem color="var(--chart-5)">Pending</Widget.LegendItem>
              <Widget.LegendItem color="var(--surface-tertiary)">Not paid</Widget.LegendItem>
            </Widget.Legend>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-3">
            <div
              role="img"
              aria-label={`October rent: ${pct(verified)} percent verified, ${pct(pending)} percent pending verification, ${100 - pct(verified) - pct(pending)} percent not paid`}
            >
              <BarChart
                data={[{ month: "October", verified, pending, unpaid }]}
                layout="vertical"
                height={14}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <BarChart.XAxis type="number" hide domain={[0, scheduled]} />
                <BarChart.YAxis type="category" dataKey="month" hide />
                <BarChart.Bar
                  dataKey="verified"
                  stackId="rent"
                  barSize={14}
                  fill="var(--chart-3)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  radius={[7, 0, 0, 7]}
                  isAnimationActive={false}
                />
                <BarChart.Bar
                  dataKey="pending"
                  stackId="rent"
                  barSize={14}
                  fill="var(--chart-5)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <BarChart.Bar
                  dataKey="unpaid"
                  stackId="rent"
                  barSize={14}
                  fill="var(--surface-tertiary)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  radius={[0, 7, 7, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </div>
            <KeyValueList
              items={data.rent.map((b) => ({
                label: b.label,
                value: <span className="tabular">{money(b.amount)}</span>,
              }))}
            />
            <p className="text-[12px] leading-4 text-muted">
              Only provider-confirmed payments count as collected. Caution deposits are held separately and never
              counted as rent.
            </p>
          </Widget.Content>
        </Widget>

        <Widget aria-labelledby="age-h" render={(p) => <section {...p} />}>
          <Widget.Header>
            <Widget.Title id="age-h" role="heading" aria-level={2}>
              Arrears Aging
            </Widget.Title>
            <span className="text-[12px] text-muted tabular">
              {money(agingTotal)} · {inArrears} residents
            </span>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-3" role="img" aria-label={agingLabel}>
            {data.aging.map((a) => (
              <div key={a.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span>{a.label}</span>
                  <span className="font-medium tabular">{money(a.amount)}</span>
                </div>
                <HBar value={Math.round((a.amount / agingMax) * 100)} color="accent" label={a.label} />
                <span className="text-[12px] leading-4 text-muted">{a.who}</span>
              </div>
            ))}
          </Widget.Content>
        </Widget>

        <section aria-labelledby="vac-h">
          <ItemCardGroup layout="list">
            <ItemCardGroup.Header>
              <ItemCardGroup.Title id="vac-h" aria-level={2}>
                Vacant Units
              </ItemCardGroup.Title>
              <ItemCardGroup.Description>Rent not earned in October: {money(vacantRent)}</ItemCardGroup.Description>
            </ItemCardGroup.Header>
            {data.vacancies.map((v) => (
              <Fragment key={v.id}>
                <Separator />
                <ItemCard className="items-start">
                  <ItemCard.Icon>
                    <FolderHouse />
                  </ItemCard.Icon>
                  <ItemCard.Content className="gap-1.5">
                    <ItemCard.Title className="tabular">
                      {v.unit} · {v.type} · {money(v.rent)}
                    </ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{v.note}</ItemCard.Description>
                    <HBar
                      value={Math.min(100, Math.round((v.days / VACANCY_SCALE_DAYS) * 100))}
                      color="warning"
                      label={`${v.days} days vacant`}
                    />
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <ToneChip tone="warning" className="tabular">
                      {v.days} days
                    </ToneChip>
                  </ItemCard.Action>
                </ItemCard>
              </Fragment>
            ))}
            <Separator />
            <ItemCard>
              <ItemCard.Content>
                <ItemCard.Description className="whitespace-normal">
                  All {data.units.length} units are residence-only. A leased unit cannot be sold as a nightly stay.
                </ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action>
                <LinkButton href={screenHref("Applicants")} size="sm" variant="secondary">
                  Applicants
                </LinkButton>
              </ItemCard.Action>
            </ItemCard>
          </ItemCardGroup>
        </section>
      </div>

      <Card className="gap-[14px] p-[18px]" aria-labelledby="grid-h" render={(p) => <section {...p} />}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="grid-h" className="text-[15px] leading-[22px] font-semibold">
              Units by Block
            </h2>
            <span className="text-[12px] text-muted">Status for October rent · select a unit for details</span>
          </div>
          <Segment aria-label="Highlight units" selectedKey={filter} onSelectionChange={(k) => setFilter(k as Filter)}>
            {FILTERS.map((f) => (
              <Segment.Item key={f.id} id={f.id}>
                {f.label}
              </Segment.Item>
            ))}
          </Segment>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-[14px]">
            {data.blocks.map((b) => {
              const list = data.units.filter((u) => u.block === b.id);
              const rents = list.map((u) => u.rent);
              return (
                <div key={b.id} className="flex flex-col gap-2" role="group" aria-label={b.name}>
                  <span className="text-[13px] font-semibold">
                    {b.name}{" "}
                    <span className="font-normal text-muted">
                      · {b.kind} · {money(Math.min(...rents))}–{plain(Math.max(...rents))}
                    </span>
                  </span>
                  <div className="grid grid-cols-4 gap-2 xl:grid-cols-8">
                    {list.map((u) => {
                      const s = STATUS[u.status];
                      const days = vacancyDays(u.id);
                      return (
                        <ToggleButton
                          key={u.id}
                          aria-label={`${u.id}, ${u.resident || "vacant"}, ${s.chip}`}
                          isSelected={selected === u.id}
                          onChange={() => setSelected(u.id)}
                          style={tileVars(u.status)}
                          className={`h-auto w-full min-w-0 flex-col items-start justify-start gap-0.5 rounded-[14px] px-3 py-2.5 text-left font-normal whitespace-normal transition-opacity data-[selected=true]:outline-2 data-[selected=true]:outline-offset-2 data-[selected=true]:outline-accent data-[selected=true]:outline-solid ${TILE_DECOR[u.status]} ${matches(u) ? "" : "opacity-35"}`}
                        >
                          <span className="text-[15px] font-semibold tabular">{u.id}</span>
                          <span className="block w-full truncate text-[11px] leading-[14px] text-muted">
                            {shortName(u.resident)}
                          </span>
                          <span className="flex w-full min-w-0 items-center gap-1 text-[11px] leading-[14px]">
                            <Dot tone={s.tone} />
                            <span className="truncate tabular">
                              {u.status === "vacant" && days ? `${days} days` : s.tag}
                            </span>
                          </span>
                        </ToggleButton>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <Legend items={LEGEND_ORDER.map((k) => ({ tone: STATUS[k].tone, label: STATUS[k].legend }))} />
          </div>

          <Card variant="secondary" className="gap-3 p-4" aria-label="Selected unit" render={(p) => <aside {...p} />}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[20px] leading-[26px] font-semibold tabular">{unit.id}</span>
                <span className="text-[12px] text-muted">
                  {unit.type} · {blockName}
                </span>
              </div>
              <ToneChip tone={unitStatus.tone} size="md">
                {unitStatus.chip}
              </ToneChip>
            </div>
            <KeyValueList
              items={[
                { label: "Resident", value: unit.resident || "None" },
                { label: "Lease", value: <span className="tabular">{unit.lease || "No active lease"}</span> },
                {
                  label: "Monthly rent",
                  value: <span className="tabular">{`${money(unit.rent)}${isVacant ? " asking" : " a month"}`}</span>,
                },
                {
                  label: "Caution held",
                  value: <span className="tabular">{isVacant ? "None" : money(unit.rent * 2)}</span>,
                },
                { label: "Sale mode", value: "Residence only" },
              ]}
            />
            <p className="text-[12px] leading-4 text-muted">{unit.note}</p>
            {isVacant ? (
              <LinkButton href={screenHref("Applicants")} size="sm" className="self-start">
                <PersonPlus className="size-4" />
                Invite an applicant
              </LinkButton>
            ) : (
              <div className="flex flex-wrap gap-2">
                <LinkButton href={screenHref("Leases")} size="sm" variant="secondary">
                  <FileText className="size-4" />
                  Open lease
                </LinkButton>
                <LinkButton href={screenHref("RentRoll")} size="sm" variant="ghost">
                  Rent roll
                </LinkButton>
              </div>
            )}
          </Card>
        </div>
      </Card>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        <Card className="gap-3 p-[18px]" aria-labelledby="ren-h" render={(p) => <section {...p} />}>
          <Card.Header>
            <CardHeading id="ren-h">Renewals and Notices</CardHeading>
            <Card.Description>Next 90 days</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {data.renewals.map((r) => (
              <NextLink key={r.id} href={screenHref(r.board)} className="block text-inherit no-underline">
                <ItemCard variant="secondary">
                  <ItemCard.Icon>
                    <Icon name={r.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>{r.title}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{r.desc}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <ToneChip tone={r.chipTone}>{r.chip}</ToneChip>
                  </ItemCard.Action>
                </ItemCard>
              </NextLink>
            ))}
          </Card.Content>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="mnt-h" render={(p) => <section {...p} />}>
          <div className="flex items-start justify-between gap-3">
            <Card.Header>
              <CardHeading id="mnt-h">Maintenance Open</CardHeading>
              <Card.Description>
                {openTickets.length} tickets · {unassigned} not assigned
              </Card.Description>
            </Card.Header>
            <LinkButton href={screenHref("ResidenceService")} size="sm" variant="ghost">
              All tickets
            </LinkButton>
          </div>
          <ListView variant="secondary" aria-label="Open maintenance tickets" items={data.homeTickets}>
            {(m) => (
              <ListView.Item id={m.id} textValue={m.title} href={screenHref("ResidenceService")}>
                <ListView.ItemContent>
                  <Wrench className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{m.title}</ListView.Title>
                    <ListView.Description>{m.desc}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <ToneChip tone={m.chipTone}>{m.chip}</ToneChip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </Card>

        <Card className="gap-3 p-[18px]" aria-labelledby="fil-h" render={(p) => <section {...p} />}>
          <Card.Header>
            <CardHeading id="fil-h">Lease Filings Open</CardHeading>
            <Card.Description>
              {awaitingAck} awaiting acknowledgement · {drafts} draft · deadlines from your configured policy
            </Card.Description>
          </Card.Header>
          <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
            15-day filing rule · Configured · not verified
          </GateChip>
          <Timeline size="sm" density="compact">
            {data.filings.map((f) => (
              <Timeline.Item key={f.id} status={f.status}>
                <Timeline.Rail>
                  <Timeline.Marker>
                    <Icon name={f.icon} className="size-3" />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                  <NextLink href={screenHref("Leases")} className="font-medium text-inherit no-underline tabular">
                    {f.title}
                  </NextLink>
                  <span className="text-[12px] leading-4 text-muted">{f.detail}</span>
                </Timeline.Content>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      </div>
    </PageContent>
  );
}
