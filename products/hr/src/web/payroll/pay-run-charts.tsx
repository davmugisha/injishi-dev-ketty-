"use client";

import { ArrowDownToLine, CreditCard, Lock, Smartphone, Wallet } from "@gravity-ui/icons";
import { Button, Chip } from "@heroui/react";
import { NumberValue, TrendChip, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { ComposedChart } from "@heroui-pro/react/composed-chart";
import { PieChart } from "@heroui-pro/react/pie-chart";
import { formatRwf, GateChip, Icon, LinkButton } from "@injishi/ui";
import type { ReactNode } from "react";
import { Cell, LabelList } from "recharts";
import type { PaymentFile, PayRunHistory, PayRunTotal } from "../../model/payroll.ts";
import { useBoardHref } from "../mount.tsx";

/** "RWF 11.3M", "RWF 708k": axis and centre labels; the legend and tooltips carry exact francs. */
export function compactRwf(n: number): string {
  if (n >= 1_000_000) return `RWF ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `RWF ${Math.round(n / 1_000)}k`;
  return formatRwf(n);
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" or "September 2026" as a sortable "2026-09", or null when it is neither. */
function periodKey(period: string): string | null {
  const iso = period.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const named = period.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!named) return null;
  const m = MONTH.findIndex((x) => x.toLowerCase() === named[1].toLowerCase());
  return m < 0 ? null : `${named[2]}-${String(m + 1).padStart(2, "0")}`;
}
const monthOf = (key: string) => `${MONTH[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

const value = (totals: PayRunTotal[], id: string) => totals.find((t) => t.id === id)?.value ?? 0;

/** The change on the month before as a trend chip: "+1.0%" on money, "+3" on a count. */
export function Change({
  now,
  before,
  unit = "money",
  suffix,
}: {
  now: number;
  before: number | null | undefined;
  unit?: "money" | "count";
  suffix?: ReactNode;
}) {
  if (!before || now === before) return null;
  const up = now > before;
  const text =
    unit === "count"
      ? `${up ? "+" : "−"}${Math.abs(now - before)}`
      : `${up ? "+" : "−"}${Math.abs(((now - before) / before) * 100).toFixed(1)}%`;
  return (
    <TrendChip trend={up ? "up" : "down"}>
      {text}
      {suffix ? <TrendChip.Suffix>{suffix}</TrendChip.Suffix> : null}
    </TrendChip>
  );
}

/**
 * Where the month's gross pay goes: what reaches staff, PAYE, the employee RSSB share, and
 * anything else deducted. A ring for the part-to-whole at a glance, three validated series and a
 * neutral fold; the legend beside it is the value table, so no figure lives in colour alone.
 */
function GrossBreakdown({ totals }: { totals: PayRunTotal[] }) {
  const gross = value(totals, "gross");
  const net = value(totals, "net");
  const paye = value(totals, "paye");
  const rssb = value(totals, "rssb");
  // Whatever else came off (loans, advances, other deductions), so the parts add up to the gross.
  const other = Math.max(0, gross - net - paye - rssb);
  const parts = [
    { id: "net", label: "Net pay to staff", value: net, color: "var(--chart-1)" },
    { id: "paye", label: "PAYE to RRA", value: paye, color: "var(--chart-4)" },
    { id: "rssb", label: "RSSB, employee share", value: rssb, color: "var(--chart-5)" },
    { id: "other", label: "Loans and other deductions", value: other, color: "var(--chart-other)" },
  ].filter((p) => p.value > 0);
  if (gross <= 0 || parts.length === 0) return null;
  const share = (n: number) => (n / gross) * 100;

  return (
    <Widget role="region" aria-labelledby="gross-h" className="min-w-0">
      <Widget.Header>
        <Widget.Title id="gross-h" role="heading" aria-level={2}>
          Where the gross pay goes
        </Widget.Title>
        <Chip size="sm" variant="soft" color="success" className="tabular">
          {share(net).toFixed(1)}% reaches staff
        </Chip>
      </Widget.Header>
      <Widget.Content className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div
          role="img"
          aria-label={`Gross pay ${formatRwf(gross)}: ${parts.map((p) => `${p.label} ${formatRwf(p.value)}`).join(", ")}`}
          className="relative mx-auto w-[200px] shrink-0"
        >
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted">Gross pay</span>
            <span className="text-xl leading-6 font-bold">{compactRwf(gross)}</span>
          </div>
          <PieChart height={200} width={200}>
            <PieChart.Tooltip content={<PieChart.TooltipContent valueFormatter={(v) => formatRwf(Number(v))} />} />
            <PieChart.Pie
              data={parts}
              dataKey="value"
              nameKey="label"
              innerRadius={66}
              outerRadius={94}
              paddingAngle={2}
              cornerRadius={5}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {parts.map((p) => (
                <PieChart.Cell key={p.id} fill={p.color} />
              ))}
            </PieChart.Pie>
          </PieChart>
        </div>
        <dl className="flex min-w-[220px] flex-1 flex-col gap-2.5 text-sm">
          {parts.map((p) => (
            <div key={p.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                <dt className="min-w-0 flex-1 text-muted">{p.label}</dt>
                <dd className="flex items-baseline gap-2 tabular">
                  <span className="font-semibold">{formatRwf(p.value)}</span>
                  <span className="w-11 text-right text-xs text-muted">{share(p.value).toFixed(1)}%</span>
                </dd>
              </div>
              <span aria-hidden="true" className="ms-5 h-1 overflow-hidden rounded-full bg-default">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${share(p.value)}%`, background: p.color }}
                />
              </span>
            </div>
          ))}
        </dl>
      </Widget.Content>
    </Widget>
  );
}

/** Each payment rail's colour and icon: mobile money, bank transfer, or paid in cash. */
const railKind = (f: PaymentFile) =>
  f.kind ?? (/mobile|momo/i.test(f.rail) ? "momo" : /bank/i.test(f.rail) ? "bank" : null);

function railLook(f: PaymentFile): { color: string; icon: ReactNode } {
  const kind = railKind(f);
  if (kind === "momo") return { color: "var(--chart-1)", icon: <Smartphone /> };
  if (kind === "bank") return { color: "var(--chart-5)", icon: <CreditCard /> };
  return { color: "var(--chart-other)", icon: <Wallet /> };
}

/**
 * How the net pay leaves the business: one tile per payment file with its amount, its share of the
 * month and its providers; the file itself is built by whoever releases, once the owner confirms.
 * People with no pay account are not a file but a warning, named, with their file one press away.
 */
export function PaymentRails({
  files,
  unpaid,
  confirmed,
  lockLabel,
  note,
  canBuild,
  building,
  onBuild,
}: {
  files: PaymentFile[];
  /** People paid this month who have no pay account on file. */
  unpaid: { id?: string; name: string }[];
  confirmed: boolean;
  /** The chip in the corner: "Locked until confirmation", "You release"... */
  lockLabel: string;
  note: string;
  /** The person may build the files now. */
  canBuild: boolean;
  building: boolean;
  onBuild: (kind: "bank" | "momo") => void;
}) {
  const screenHref = useBoardHref();
  const paid = files.filter((f) => railKind(f) && f.amount > 0).sort((a, b) => b.amount - a.amount);
  // People with no account: counted from the file, named where the person may see the line.
  const noAccount = files.filter((f) => !railKind(f)).reduce((n, f) => n + f.staff, 0);
  const total = paid.reduce((t, f) => t + f.amount, 0);
  const staff = files.reduce((n, f) => n + f.staff, 0);
  if (files.length === 0) return null;
  const share = (f: PaymentFile) => (total ? (f.amount / total) * 100 : 0);

  return (
    <Widget role="region" aria-labelledby="rails-h" className="min-w-0">
      <Widget.Header>
        <Widget.Title id="rails-h" role="heading" aria-level={2}>
          Payment files
        </Widget.Title>
        <Chip size="sm" variant="soft" color={confirmed ? "warning" : "default"}>
          {confirmed ? <ArrowDownToLine className="size-3" /> : <Lock className="size-3" />}
          <Chip.Label>{lockLabel}</Chip.Label>
        </Chip>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <NumberValue value={total} style="currency" currency="RWF" className="text-2xl leading-8 font-bold tabular" />
          <span className="text-xs text-muted tabular">
            {staff} people · {paid.length} {paid.length === 1 ? "file" : "files"}
          </span>
        </div>
        <div
          role="img"
          aria-label={`Net pay by rail: ${paid.map((f) => `${f.rail} ${formatRwf(f.amount)}`).join(", ")}`}
          className="flex h-3 gap-1"
        >
          {paid.map((f) => (
            <span
              key={f.id}
              className="h-full rounded-full"
              style={{ width: `${share(f)}%`, background: railLook(f).color }}
            />
          ))}
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]">
          {paid.map((f) => {
            const look = railLook(f);
            return (
              <div key={f.id} className="flex min-w-0 flex-col gap-2.5 rounded-2xl bg-surface-secondary p-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-foreground [&>svg]:size-5"
                    aria-hidden="true"
                  >
                    {look.icon}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{f.rail}</span>
                    <span className="text-xs text-muted tabular">
                      {f.staff} {f.staff === 1 ? "person" : "people"}
                    </span>
                  </span>
                  <span className="text-[20px] leading-6 font-bold tabular">
                    {share(f).toFixed(0)}
                    <span className="text-xs font-semibold text-muted">%</span>
                  </span>
                </div>
                <NumberValue
                  value={f.amount}
                  style="currency"
                  currency="RWF"
                  className="text-xl leading-6 font-bold tabular"
                />
                <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-default">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${share(f)}%`, background: look.color }}
                  />
                </span>
                <span className="flex flex-wrap gap-1">
                  {f.how.split(/,\s*/).map((p) => (
                    <Chip key={p} size="sm" variant="secondary">
                      {p}
                    </Chip>
                  ))}
                </span>
                {canBuild && f.kind ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    fullWidth
                    isPending={building}
                    onPress={() => onBuild(f.kind as "bank" | "momo")}
                  >
                    <ArrowDownToLine className="size-4" aria-hidden="true" />
                    {f.confirmedGate === "Build the file" ? "Build the file" : "Build again"}
                  </Button>
                ) : confirmed ? (
                  <GateChip icon={<Icon name={f.confirmedIcon} className="size-3" />}>{f.confirmedGate}</GateChip>
                ) : null}
              </div>
            );
          })}
        </div>
        {noAccount ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface-secondary p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning text-warning-foreground">
              <Wallet className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-[1_1_180px] text-sm leading-5">
              <span className="font-semibold">
                {noAccount === 1 && unpaid.length === 1
                  ? unpaid[0].name
                  : `${noAccount} ${noAccount === 1 ? "person" : "people"}`}{" "}
                · no pay account
              </span>
              <span className="block truncate text-xs text-muted">
                {noAccount > 1 && unpaid.length ? `${unpaid.map((u) => u.name).join(", ")} · ` : ""}Paid in cash until
                one is added
              </span>
            </span>
            {unpaid.length === 0 ? null : unpaid.length === 1 && unpaid[0].id ? (
              <LinkButton
                href={`${screenHref("Employees")}?employee=${encodeURIComponent(unpaid[0].id)}`}
                size="sm"
                variant="secondary"
              >
                Add one
              </LinkButton>
            ) : (
              <LinkButton href={screenHref("Employees")} size="sm" variant="secondary">
                Employees
              </LinkButton>
            )}
          </div>
        ) : null}
      </Widget.Content>
      <Widget.Footer>
        <span className="text-xs text-muted">{note}</span>
      </Widget.Footer>
    </Widget>
  );
}

/** Net pay month by month as columns, this month solid, with the headcount as a line across them. */
function NetByMonth({
  history,
  period,
  net,
  staff,
}: {
  history: PayRunHistory[];
  period: string;
  net: number;
  staff: number;
}) {
  const byMonth = new Map<string, { net: number; staff: number }>();
  for (const h of history) {
    const key = periodKey(h.period);
    if (key && h.net > 0) byMonth.set(key, { net: h.net, staff: h.staff });
  }
  const current = periodKey(period);
  if (current && net > 0) byMonth.set(current, { net, staff });
  const points = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, m]) => ({
      key,
      month: monthOf(key),
      net: m.net,
      staff: m.staff,
      label: compactRwf(m.net).replace("RWF ", ""),
    }));
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const before = points[points.length - 2];
  const top = Math.max(...points.map((p) => p.net));
  const most = Math.max(...points.map((p) => p.staff));

  return (
    <Widget role="region" aria-labelledby="trend-h" className="min-w-0">
      <Widget.Header>
        <Widget.Title id="trend-h" role="heading" aria-level={2}>
          Net pay by month
        </Widget.Title>
        <Change now={last.net} before={before.net} suffix={`on ${before.month.slice(0, 3)}`} />
      </Widget.Header>
      <Widget.Content>
        <div
          role="img"
          aria-label={`Net pay and staff by month: ${points.map((p) => `${p.month} ${formatRwf(p.net)}, ${p.staff} staff`).join("; ")}`}
        >
          <ComposedChart data={points} height={196} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
            <ComposedChart.Grid vertical={false} />
            <ComposedChart.XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <ComposedChart.YAxis yAxisId="net" hide domain={[0, top * 1.18]} />
            {/* The staff line runs through the middle of the columns, clear of their labels. */}
            <ComposedChart.YAxis yAxisId="staff" orientation="right" hide domain={[0, most * 2.1]} />
            <ComposedChart.Tooltip
              cursor={{ fill: "var(--surface-secondary)" }}
              content={
                <ComposedChart.TooltipContent
                  valueFormatter={(v) => (Number(v) < 10_000 ? `${v} staff` : formatRwf(Number(v)))}
                />
              }
            />
            <ComposedChart.Bar
              yAxisId="net"
              dataKey="net"
              name="Net pay"
              radius={[6, 6, 0, 0]}
              maxBarSize={52}
              isAnimationActive={false}
            >
              {points.map((p) => (
                <Cell
                  key={p.key}
                  fill={p.key === last.key ? "var(--chart-1)" : "color-mix(in oklab, var(--chart-1) 38%, transparent)"}
                />
              ))}
              <LabelList dataKey="label" position="top" fill="var(--foreground)" fontSize={11} fontWeight={600} />
            </ComposedChart.Bar>
            <ComposedChart.Line
              yAxisId="staff"
              type="monotone"
              dataKey="staff"
              name="Staff"
              stroke="var(--chart-4)"
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-4)" }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="staff"
                position="top"
                offset={9}
                fill="var(--chart-4)"
                fontSize={11}
                fontWeight={700}
              />
            </ComposedChart.Line>
          </ComposedChart>
        </div>
      </Widget.Content>
      <Widget.Footer>
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-1)">Net pay</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-4)">Staff paid</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Footer>
    </Widget>
  );
}

const BANDS = [
  { label: "Under 150k", max: 150_000 },
  { label: "150–200k", max: 200_000 },
  { label: "200–300k", max: 300_000 },
  { label: "300–500k", max: 500_000 },
  { label: "500k+", max: Number.POSITIVE_INFINITY },
];

/** How many people take home how much: one column per band of net pay, the busiest band solid. */
function NetBands({ nets, wide }: { nets: number[]; wide: boolean }) {
  if (nets.length === 0) return null;
  let from = 0;
  const rows = BANDS.map((b) => {
    const count = nets.filter((n) => n >= from && n < b.max).length;
    from = b.max;
    return { band: b.label, count };
  });
  const busiest = Math.max(...rows.map((r) => r.count));
  const median = [...nets].sort((a, b) => a - b)[Math.floor(nets.length / 2)];

  return (
    <Widget role="region" aria-labelledby="bands-h" className={`min-w-0 ${wide ? "lg:col-span-2" : ""}`}>
      <Widget.Header>
        <Widget.Title id="bands-h" role="heading" aria-level={2}>
          Staff by net pay
        </Widget.Title>
        <Chip size="sm" variant="soft" className="tabular">
          Middle take-home {compactRwf(median)}
        </Chip>
      </Widget.Header>
      <Widget.Content>
        <div role="img" aria-label={`Staff by net pay: ${rows.map((r) => `${r.band} ${r.count}`).join(", ")}`}>
          <BarChart data={rows} height={196} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
            <BarChart.Grid vertical={false} />
            <BarChart.XAxis dataKey="band" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <BarChart.YAxis hide allowDecimals={false} />
            <BarChart.Tooltip
              cursor={{ fill: "var(--surface-secondary)" }}
              content={<BarChart.TooltipContent valueFormatter={(v) => `${v} staff`} />}
            />
            <BarChart.Bar
              dataKey="count"
              name="Staff"
              radius={[6, 6, 0, 0]}
              maxBarSize={56}
              minPointSize={2}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell
                  key={r.band}
                  fill={r.count === busiest ? "var(--chart-1)" : "color-mix(in oklab, var(--chart-1) 45%, transparent)"}
                />
              ))}
              <LabelList dataKey="count" position="top" fill="var(--foreground)" fontSize={12} fontWeight={600} />
            </BarChart.Bar>
          </BarChart>
        </div>
      </Widget.Content>
    </Widget>
  );
}

/**
 * A leaver's final pay as a waterfall: what is added (wage, allowance, unused leave, other pay) up to the
 * gross, what is taken (tax and RSSB, deductions), anything paid on top, down to what they are paid.
 */
export function SettlementWaterfall({
  wage,
  allowance,
  leave,
  other,
  gross,
  taxes,
  deductions,
  onTop,
  net,
}: {
  wage: number;
  allowance: number;
  leave: number;
  /** Pay that is neither wage, allowance nor leave: overtime, a correction. */
  other: number;
  gross: number;
  /** PAYE and the employee RSSB share. */
  taxes: number;
  deductions: number;
  /** Paid with the net and not income: a claim paid back. */
  onTop: number;
  net: number;
}) {
  const earning = "color-mix(in oklab, var(--chart-1) 45%, transparent)";
  const withLeave = wage + allowance + leave;
  const afterDeductions = gross - taxes - deductions;
  const steps: { label: string; from: number; to: number; color: string }[] = [
    { label: "Wage", from: 0, to: wage, color: earning },
    ...(allowance > 0 ? [{ label: "Allowance", from: wage, to: wage + allowance, color: earning }] : []),
    ...(leave > 0 ? [{ label: "Leave", from: wage + allowance, to: withLeave, color: earning }] : []),
    ...(other > 0 ? [{ label: "Other", from: withLeave, to: withLeave + other, color: earning }] : []),
    { label: "Gross", from: 0, to: gross, color: "var(--chart-other)" },
    { label: "Taxes", from: gross - taxes, to: gross, color: "var(--chart-4)" },
    ...(deductions > 0
      ? [{ label: "Deductions", from: afterDeductions, to: gross - taxes, color: "var(--chart-4)" }]
      : []),
    ...(onTop > 0 ? [{ label: "On top", from: afterDeductions, to: afterDeductions + onTop, color: earning }] : []),
    { label: "Net", from: 0, to: net, color: "var(--chart-1)" },
  ];
  const data = steps.map((s) => ({
    step: s.label,
    base: Math.min(s.from, s.to),
    size: Math.abs(s.to - s.from),
    label: compactRwf(Math.abs(s.to - s.from)).replace("RWF ", ""),
  }));

  return (
    <div
      role="img"
      aria-label={`Final pay: ${steps.map((s) => `${s.label} ${formatRwf(Math.abs(s.to - s.from))}`).join(", ")}`}
    >
      <BarChart data={data} height={190} margin={{ top: 22, right: 4, bottom: 0, left: 4 }}>
        <BarChart.Grid vertical={false} />
        <BarChart.XAxis dataKey="step" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={0} />
        <BarChart.YAxis hide domain={[0, (max: number) => max * 1.12]} />
        <BarChart.Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <BarChart.Bar dataKey="size" stackId="w" radius={[5, 5, 5, 5]} maxBarSize={44} isAnimationActive={false}>
          {steps.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
          <LabelList dataKey="label" position="top" fill="var(--foreground)" fontSize={11} fontWeight={600} />
        </BarChart.Bar>
      </BarChart>
    </div>
  );
}

/** The run in pictures, under its totals: the gross split, the payment files, pay bands and the months. */
export function PayRunCharts({
  totals,
  history,
  period,
  nets,
  rails,
}: {
  totals: PayRunTotal[];
  history: PayRunHistory[];
  period: string;
  /** Each line's net pay, the owner's left out when it is confidential. */
  nets: number[];
  /** The payment files card, built by the board (it holds the build buttons). */
  rails: ReactNode;
}) {
  const months = NetByMonth({ history, period, net: value(totals, "net"), staff: value(totals, "staff") });
  return (
    <section aria-label="The run in charts" className="grid items-stretch gap-4 lg:grid-cols-2">
      <GrossBreakdown totals={totals} />
      {rails}
      <NetBands nets={nets} wide={!months} />
      {months}
    </section>
  );
}
