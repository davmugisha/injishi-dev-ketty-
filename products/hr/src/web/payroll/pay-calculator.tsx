"use client";

import { ArrowUp, Wallet } from "@gravity-ui/icons";
import { Button, Chip, Label, NumberField, Slider, Table } from "@heroui/react";
import { NumberValue, Segment } from "@heroui-pro/react";
import { formatRwf } from "@injishi/ui";
import type { PayrollContributionList } from "../../model/payroll.ts";
import { AmountList, LineDonut } from "./parts";
import { simulatePay } from "./pay-calc";

type Mode = "salary" | "takeHome";

/** The figure typed or slid: a salary, or the take-home it must reach. */
export interface CalcInput {
  mode: Mode;
  amount: number;
}

/** Per mode: the slider's range and step, and the amounts a click away. */
const SCALE: Record<Mode, { min: number; max: number; step: number; presets: number[] }> = {
  salary: { min: 60_000, max: 2_000_000, step: 10_000, presets: [150_000, 300_000, 500_000, 1_000_000, 2_000_000] },
  takeHome: { min: 50_000, max: 1_500_000, step: 5_000, presets: [100_000, 250_000, 400_000, 750_000, 1_500_000] },
};

/** What one more slice of salary is worth, the raise a manager asks about. */
const RAISE = 10_000;

/** A preset as a button reads it: "150k", "1M", "1.5M". */
const presetLabel = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1_000)}k`);
const share = (part: number, whole: number) => (whole > 0 ? `${+((part / whole) * 100).toFixed(1)}%` : "0%");
const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;

/** The least salary whose take-home reaches the target: take-home only grows with salary, so halve the range. */
function salaryFor(list: PayrollContributionList, takeHome: number): number {
  let lo = 0;
  let hi = 50_000_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (simulatePay(list, mid).takeHome >= takeHome) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** The salary the input stands for. */
export function salaryOf(list: PayrollContributionList, input: CalcInput): number {
  return input.mode === "salary" ? input.amount : salaryFor(list, input.amount);
}

/**
 * The example salary on the contributions card: type or slide a salary, or the take-home someone
 * was promised, and see PAYE, each side's contributions, the take-home and the cost to the business
 * under the rules in force, as tiles, a waterfall and scheme by scheme.
 */
export function PayCalculator({
  list,
  input,
  onInput,
}: {
  list: PayrollContributionList;
  input: CalcInput;
  onInput: (next: CalcInput) => void;
}) {
  const { mode, amount } = input;
  const setAmount = (a: number) => onInput({ mode, amount: a });
  const scale = SCALE[mode];
  const salary = salaryOf(list, input);
  const sim = simulatePay(list, salary);
  const next = simulatePay(list, salary + RAISE);
  const marginal = Math.round(((next.paye - sim.paye) / RAISE) * 100);

  const switchTo = (m: Mode) => {
    if (m === mode) return;
    // Carry the figure across, rounded to the new slider's step.
    const step = SCALE[m].step;
    onInput({ mode: m, amount: m === "takeHome" ? Math.round(sim.takeHome / step) * step : salary });
  };

  const rates = new Map(list.contributions.map((c) => [c.code, c]));
  const schemeRows = sim.rows.map((r) => {
    const c = rates.get(r.code);
    return {
      ...r,
      employeeRate: c && c.employeeRate > 0 ? `${pct(c.employeeRate)}${c.base === "net" ? " of net" : ""}` : null,
      employerRate: c && c.employerRate > 0 ? pct(c.employerRate) : null,
    };
  });
  const topRate = Math.max(0, ...(list.paye?.bands ?? []).map((b) => b.rate));

  // The whole cost, split by who ends up with it.
  const spend = [
    { label: "take-home", value: sim.takeHome, color: "var(--accent)" },
    { label: "PAYE", value: sim.paye, color: "var(--chart-other)" },
    { label: "employee contributions", value: sim.employee, color: "var(--chart-5)" },
    { label: "business contributions", value: sim.employer, color: "var(--chart-4)" },
  ];

  const tiles: { label: string; value: number; foot: string; color: string }[] = [
    { label: "PAYE", value: sim.paye, foot: `${share(sim.paye, salary)} of salary`, color: "var(--chart-other)" },
    {
      label: "Employee pays",
      value: sim.employee,
      foot: `${share(sim.employee, salary)} of salary`,
      color: "var(--chart-5)",
    },
    {
      label: "Business pays on top",
      value: sim.employer,
      foot: `+${share(sim.employer, salary)} on top`,
      color: "var(--chart-4)",
    },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface-secondary p-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* The figure: a salary, or the take-home it must reach */}
        <div className="flex flex-col gap-3">
          <Segment aria-label="Work from" size="sm" selectedKey={mode} onSelectionChange={(k) => switchTo(k as Mode)}>
            <Segment.Item id="salary">From salary</Segment.Item>
            <Segment.Item id="takeHome">
              <Segment.Separator />
              From take-home
            </Segment.Item>
          </Segment>
          <NumberField
            fullWidth
            variant="secondary"
            minValue={0}
            step={scale.step}
            value={amount}
            onChange={(v) => setAmount(Math.max(0, Math.round(Number.isFinite(v) ? v : 0)))}
            formatOptions={{ style: "currency", currency: "RWF", maximumFractionDigits: 0 }}
          >
            <Label className="text-sm font-medium">
              {mode === "salary" ? "Monthly salary" : "Take-home wanted each month"}
            </Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input className="text-lg font-semibold tabular" />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
          <Slider
            aria-label={mode === "salary" ? "Monthly salary" : "Take-home wanted"}
            minValue={scale.min}
            maxValue={Math.max(scale.max, amount)}
            step={scale.step}
            value={Math.max(scale.min, amount)}
            onChange={(v) => setAmount(Array.isArray(v) ? v[0] : v)}
          >
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Example amounts</legend>
            {scale.presets.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={amount === p ? "primary" : "secondary"}
                className="h-7 min-w-0 px-2.5 text-xs tabular"
                onPress={() => setAmount(p)}
              >
                {presetLabel(p)}
              </Button>
            ))}
          </fieldset>
          <div className="mt-auto flex flex-col gap-2 rounded-xl bg-surface px-3 py-3">
            <span className="text-xs font-medium">Of every RWF 100 the business spends</span>
            <div
              role="img"
              aria-label={`Of ${formatRwf(sim.cost)}: ${spend.map((p) => `${p.label} ${share(p.value, sim.cost)}`).join(", ")}`}
              className="flex h-3 gap-0.5 overflow-hidden rounded-full"
            >
              {spend.map((p) => (
                <span key={p.label} className="h-full min-w-1" style={{ flexGrow: p.value, background: p.color }} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {spend.map((p) => (
                <li key={p.label} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: p.color }} />
                  <span className="font-semibold text-foreground tabular">
                    {sim.cost > 0 ? +((p.value / sim.cost) * 100).toFixed(1) : 0}
                  </span>
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* What it comes to */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground [&>svg]:size-5">
              <Wallet aria-hidden="true" />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-xs font-medium text-muted">
                {mode === "salary" ? "Take-home" : "Salary to offer"}
              </span>
              <NumberValue
                value={mode === "salary" ? sim.takeHome : salary}
                style="currency"
                currency="RWF"
                className="text-3xl leading-8 font-bold text-accent-soft-foreground tabular"
              />
            </div>
            <Chip size="sm" variant="soft" color="accent">
              <Chip.Label className="tabular">
                {mode === "salary"
                  ? `${share(sim.takeHome, salary)} of salary`
                  : `take-home ${formatRwf(sim.takeHome)}`}
              </Chip.Label>
            </Chip>
          </div>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr))]">
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col gap-0.5 rounded-xl bg-surface px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: t.color }} />
                  {t.label}
                </span>
                <NumberValue
                  value={t.value}
                  style="currency"
                  currency="RWF"
                  className="text-lg leading-6 font-bold tabular"
                />
                <span className="text-xs text-muted tabular">{t.foot}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl bg-surface px-4 py-2.5">
            <span className="text-sm font-medium">Cost to the business</span>
            <span className="flex items-baseline gap-2">
              <span className="text-xs text-muted tabular">salary + {share(sim.employer, salary)}</span>
              <NumberValue value={sim.cost} style="currency" currency="RWF" className="text-lg font-bold tabular" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 border-t border-separator pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Salary down to take-home, then what the business pays on top: a ring and the sums, in words. */}
        <div className="flex flex-col gap-3">
          <LineDonut gross={salary} net={sim.takeHome} paye={sim.paye} rssb={sim.employee} other={0} />
          <AmountList
            className="rounded-2xl bg-surface-secondary p-3"
            rows={[
              { label: "Salary", value: formatRwf(salary) },
              { label: "PAYE, to RRA", value: `− ${formatRwf(sim.paye)}` },
              { label: "Employee contributions", value: `− ${formatRwf(sim.employee)}` },
              { label: "Take-home", value: formatRwf(sim.takeHome), total: true },
              { label: "Business contributions, on top", value: `+ ${formatRwf(sim.employer)}` },
              { label: "Cost to the business", value: formatRwf(sim.cost), total: true },
            ]}
          />
        </div>

        {/* Scheme by scheme */}
        <div className="flex flex-col gap-3">
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Deductions and contributions on this salary" className="text-sm">
                <Table.Header>
                  <Table.Column isRowHeader>On {formatRwf(salary)}</Table.Column>
                  <Table.Column className="text-right">Employee</Table.Column>
                  <Table.Column className="text-right">Business</Table.Column>
                </Table.Header>
                <Table.Body>
                  <Table.Row id="paye">
                    <Table.Cell>
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="size-2 rounded-full bg-[var(--chart-other)]" />
                        PAYE
                        <span className="text-xs text-muted">bands to {pct(topRate)}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right font-medium tabular">{formatRwf(sim.paye)}</Table.Cell>
                    <Table.Cell className="text-right text-muted">—</Table.Cell>
                  </Table.Row>
                  {schemeRows.map((r) => (
                    <Table.Row key={r.code} id={r.code}>
                      <Table.Cell>
                        <span className="flex items-center gap-2">
                          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: r.color }} />
                          {r.label}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right tabular">
                        {r.employee ? (
                          <span className="flex flex-col items-end leading-4">
                            <span className="font-medium">{formatRwf(r.employee)}</span>
                            {r.employeeRate ? <span className="text-xs text-muted">{r.employeeRate}</span> : null}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right tabular">
                        {r.employer ? (
                          <span className="flex flex-col items-end leading-4">
                            <span className="font-medium">{formatRwf(r.employer)}</span>
                            {r.employerRate ? <span className="text-xs text-muted">{r.employerRate}</span> : null}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  <Table.Row id="total" className="font-bold">
                    <Table.Cell>Total</Table.Cell>
                    <Table.Cell className="text-right tabular">{formatRwf(sim.paye + sim.employee)}</Table.Cell>
                    <Table.Cell className="text-right tabular">{formatRwf(sim.employer)}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-xs">
            <span className="mr-1 font-medium">Next {formatRwf(RAISE)} of salary</span>
            <Chip size="sm" variant="soft" color="accent">
              <ArrowUp className="size-3" />
              <Chip.Label className="tabular">{formatRwf(next.takeHome - sim.takeHome)} take-home</Chip.Label>
            </Chip>
            <Chip size="sm" variant="soft">
              <ArrowUp className="size-3" />
              <Chip.Label className="tabular">{formatRwf(next.cost - sim.cost)} cost</Chip.Label>
            </Chip>
            <Chip size="sm" variant="soft">
              <Chip.Label className="tabular">taxed at {marginal}%</Chip.Label>
            </Chip>
          </div>
        </div>
      </div>
    </div>
  );
}
