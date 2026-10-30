"use client";

import { Book, ChevronRight, ShieldExclamation } from "@gravity-ui/icons";
import { Card, Chip, Separator, Table } from "@heroui/react";
import { KPIGroup } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { KPI } from "@heroui-pro/react/kpi";
import { screenHref } from "@injishi/data";
import type {
  ReportsAgingBucket,
  ReportsArrear,
  ReportsDebtor,
  ReportsProfitLine,
  ReportsSummaryKpi,
  ReportsVacantUnit,
} from "@injishi/data/fixtures/owner";
import { formatNumber, formatRwf, GateChip, LinkButton, SectionHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment } from "react";

/** "RWF 2.04M" — receivables are reported in RWF millions with two decimals. */
const millions = (amount: number) =>
  `RWF ${formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;

/** Period chip, scope note and summary figures above the Financial and Residence tabs. */
export function ReportsSummary({ tab, kpis }: { tab: "fin" | "res"; kpis: ReportsSummaryKpi[] }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant="soft" color="warning">
          Sample data
        </Chip>
        <span className="text-[13px] text-muted">
          {tab === "res"
            ? "Sample figures, not your leases · residences are measured by leases, not nights, and never counted in hotel occupancy"
            : "Sample figures, not your accounts: an expense ledger and city-ledger receivables are not kept yet · RWF millions"}
        </span>
        <span className="flex-1" />
        {tab === "fin" ? (
          <GateChip icon={<ShieldExclamation className="size-3" />}>Account mapping awaiting Finance sign-off</GateChip>
        ) : null}
      </div>
      <section aria-label="Summary">
        <KPIGroup className="flex-wrap">
          {kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[min(200px,100%)] flex-[1_1_200px]">
                <KPI.Header>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value value={k.value} formatOptions={k.format} className="tabular">
                    {k.suffix ? (formatted) => `${formatted}${k.suffix}` : undefined}
                  </KPI.Value>
                  {k.trend ? <KPI.Trend trend="up">{k.trend}</KPI.Trend> : null}
                </KPI.Content>
                <KPI.Footer>
                  <p className="mt-1.5 text-xs leading-4 text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>
    </>
  );
}

const ROW_STYLE: Record<ReportsProfitLine["kind"], string> = {
  heading: "bg-surface-secondary font-semibold",
  department: "",
  subtotal: "font-semibold",
  gop: "bg-accent-soft font-semibold",
};

export function ReportsFinancialPanel({
  profitLines,
  aging,
  debtors,
}: {
  profitLines: ReportsProfitLine[];
  aging: ReportsAgingBucket[];
  debtors: ReportsDebtor[];
}) {
  const total = aging.reduce((sum, a) => sum + a.amount, 0);
  const agingRow = Object.fromEntries([["name", "Receivables"], ...aging.map((a) => [a.id, a.amount])]);
  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="flex min-w-0 flex-[2_1_600px] flex-col gap-2.5" aria-labelledby="pl-h">
        <SectionHeader
          id="pl-h"
          title="Departmental Profit and GOP · Sample"
          className="items-center"
          action={
            <LinkButton href={screenHref("GeneralLedger")} size="sm" variant="secondary">
              <Book className="size-4" />
              Open general ledger
            </LinkButton>
          }
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Departmental profit and GOP">
              <Table.Header>
                <Table.Column isRowHeader>Line</Table.Column>
                <Table.Column className="text-right">Revenue</Table.Column>
                <Table.Column className="text-right">Expenses</Table.Column>
                <Table.Column className="text-right">Profit</Table.Column>
                <Table.Column className="text-right">Margin</Table.Column>
                <Table.Column>
                  <span className="sr-only">Source</span>
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {profitLines.map((l) => {
                  const isLine = l.kind === "department";
                  return (
                    <Table.Row key={l.id} id={l.id} className={ROW_STYLE[l.kind]}>
                      <Table.Cell className={isLine ? "pl-7" : "pl-4"}>
                        <span className="flex flex-col">
                          <span>{l.name}</span>
                          {l.note ? <span className="text-xs font-normal text-muted">{l.note}</span> : null}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right tabular">{l.revenue}</Table.Cell>
                      <Table.Cell className="text-right tabular">{l.expenses}</Table.Cell>
                      <Table.Cell className="text-right tabular">{l.profit}</Table.Cell>
                      <Table.Cell className="text-right font-normal tabular">{l.margin}</Table.Cell>
                      <Table.Cell className="text-right">
                        {isLine ? (
                          <LinkButton
                            href={screenHref("GeneralLedger")}
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={`Ledger entries for ${l.name}`}
                            title={`Ledger entries for ${l.name}`}
                          >
                            <ChevronRight className="size-4" />
                          </LinkButton>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <p className="text-xs text-muted">
          In the USALI layout a separate merchant's sales are not yours: only its rent to you appears, under
          miscellaneous income. Residences report in the Residence tab.
        </p>
      </section>

      <Card
        render={(props) => <section {...props} />}
        aria-labelledby="ar-h"
        className="min-w-0 flex-[1_1_300px] gap-3.5 p-[18px]"
      >
        <Card.Header>
          <Card.Title id="ar-h" render={(props) => <h2 {...props} />} className="text-[15px] font-semibold">
            Receivables Aging
          </Card.Title>
          <Card.Description>Sample city ledger · {millions(total)}</Card.Description>
        </Card.Header>
        <div
          role="img"
          aria-label={`Receivables by age: ${aging.map((a) => `${a.label.toLowerCase().replace("–", " to ")} ${millions(a.amount)}`).join(", ")}`}
          className="overflow-hidden rounded-full"
        >
          <BarChart data={[agingRow]} layout="vertical" height={12} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <BarChart.XAxis type="number" hide domain={[0, total]} />
            <BarChart.YAxis type="category" dataKey="name" hide />
            <BarChart.Tooltip
              cursor={false}
              content={<BarChart.TooltipContent hideHeader valueFormatter={(v) => millions(Number(v))} />}
            />
            {aging.map((a) => (
              <BarChart.Bar
                isAnimationActive={false}
                key={a.id}
                dataKey={a.id}
                name={a.label}
                stackId="aging"
                barSize={12}
                fill={`var(--${a.swatch})`}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
          </BarChart>
        </div>
        <ul className="flex flex-col gap-1.5">
          {aging.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: `var(--${a.swatch})` }}
                />
                {a.label}
              </span>
              <span className="font-medium tabular">{millions(a.amount)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        {debtors.map((d) => (
          <NextLink
            key={d.id}
            href={screenHref(d.board)}
            className="flex items-start justify-between gap-3 text-inherit no-underline"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium">{d.name}</span>
              <span className="text-xs text-muted">{d.note}</span>
            </span>
            <span className="text-[13px] font-medium whitespace-nowrap tabular">{millions(d.amount)}</span>
          </NextLink>
        ))}
        <LinkButton href={screenHref("AccountsReceivable")} size="sm" variant="secondary" className="self-start">
          Accounts receivable
        </LinkButton>
      </Card>
    </div>
  );
}

export function ReportsResidencePanel({
  vacantUnits,
  arrears,
}: {
  vacantUnits: ReportsVacantUnit[];
  arrears: ReportsArrear[];
}) {
  return (
    <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
      <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="vac-h">
        <SectionHeader
          id="vac-h"
          title="Vacant Units · Sample"
          className="items-center"
          action={
            <LinkButton href={screenHref("Units")} size="sm" variant="ghost">
              Units
            </LinkButton>
          }
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Vacant units">
              <Table.Header>
                <Table.Column isRowHeader>Unit</Table.Column>
                <Table.Column className="text-right">Asking rent</Table.Column>
                <Table.Column>Vacant since</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body>
                {vacantUnits.map((v) => (
                  <Table.Row key={v.id} id={v.id}>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span className="font-medium">{v.unit}</span>
                        <span className="text-xs text-muted">{v.kind}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right tabular">{formatRwf(v.rent)}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span>{v.since}</span>
                        <span className="text-xs text-muted">{v.days}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(v.tone)}>
                        {v.status}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="arr-h">
        <SectionHeader
          id="arr-h"
          title="Arrears · Sample"
          className="items-center"
          action={
            <LinkButton href={screenHref("ResidenceHome")} size="sm" variant="ghost">
              Rentals
            </LinkButton>
          }
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Arrears">
              <Table.Header>
                <Table.Column isRowHeader>Resident</Table.Column>
                <Table.Column className="text-right">Overdue</Table.Column>
                <Table.Column>Days</Table.Column>
                <Table.Column>Follow-up</Table.Column>
              </Table.Header>
              <Table.Body>
                {arrears.map((a) => (
                  <Table.Row key={a.id} id={a.id}>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-xs text-muted">{a.unit}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right tabular">{formatRwf(a.amount)}</Table.Cell>
                    <Table.Cell className="tabular">{a.days}</Table.Cell>
                    <Table.Cell className="max-w-[260px] whitespace-normal">
                      <Chip size="sm" variant="soft" color={toneColor(a.tone)}>
                        {a.status}
                      </Chip>
                      <span className="mt-0.5 block text-xs text-muted">{a.note}</span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <p className="text-xs text-muted">
          Only verified payments reduce arrears. A payment the provider has not confirmed stays Unknown, never paid or
          unpaid.
        </p>
      </section>
    </div>
  );
}
