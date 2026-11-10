"use client";

import {
  Briefcase,
  Check,
  HeartPulse,
  Lock,
  Persons,
  Pill,
  ShieldCheck,
  Stethoscope,
  Umbrella,
} from "@gravity-ui/icons";
import { Button, Card, Chip, Input, Label, Skeleton, Switch, TextField, toast } from "@heroui/react";
import { formatRwf } from "@injishi/ui";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import type { PayrollContribution, PayrollContributionList } from "../../model/payroll.ts";
import { useHrActions, useHrFeature } from "../mount.tsx";
import { Hint } from "../people/parts";
import { simulatePay as simulate } from "./pay-calc";
import { type CalcInput, PayCalculator, salaryOf } from "./pay-calculator";

/** What each scheme is for, in a line, from RSSB, RRA and the Prime Minister's Orders (looked up 22 October 2026). */
const ABOUT: Record<string, { icon: ReactNode; what: string; detail: string }> = {
  pension: {
    icon: <Umbrella />,
    what: "Retirement, invalidity and survivors' pension.",
    detail:
      "6% each since January 2025 (Presidential Order 086/01), on pay including transport. Rises 2 points a year from 2027 to 20% in 2030.",
  },
  maternity: {
    icon: <Persons />,
    what: "Pays mothers on maternity leave.",
    detail: "0.3% each (RRA). Leave is 14 weeks; RSSB refunds the business for the last 8.",
  },
  occupational_hazards: {
    icon: <ShieldCheck />,
    what: "Work accidents and occupational diseases.",
    detail: "2%, paid by the business alone (RSSB).",
  },
  cbhi: {
    icon: <HeartPulse />,
    what: "Mutuelle de santé: community health insurance subsidy.",
    detail:
      "0.5% of net pay, withheld and paid to RSSB (Prime Minister's Order 034/01 of 2020). Leave on unless your staff are exempt.",
  },
  medical_scheme: {
    icon: <Stethoscope />,
    what: "RSSB medical insurance: 85% of treatment and medicines, for the employee and family.",
    detail:
      "7.5% each of basic salary (RRA). Public bodies must; a private business may join it instead of a private insurer.",
  },
};

const BASE_WORDS: Record<PayrollContribution["base"], string> = {
  gross: "of gross pay",
  basic: "of basic salary",
  contributable: "of pay counted for RSSB",
  net: "of net pay",
};

const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;

/** The health insurance options, hidden when Injishi switches `insurance` off. The statutory schemes stay. */
const INSURANCE_CODES = new Set(["medical", "medical_scheme", "private_health"]);

/**
 * Insurance and contributions: what the business and each employee pay on pay, scheme by scheme.
 * The law's own are always on; CBHI, RSSB's medical scheme and a private insurer are the
 * business's choice (the owner's). A salary slider shows what each side pays on an example wage.
 */
export function ContributionsPanel() {
  const { chooseContribution, loadContributions } = useHrActions();
  const insuranceOn = useHrFeature("insurance");
  const [loaded, setList] = useState<PayrollContributionList | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [calc, setCalc] = useState<CalcInput>({ mode: "salary", amount: 300_000 });
  const [pending, startTransition] = useTransition();
  const [insurer, setInsurer] = useState({ provider: "", employee: "", employer: "" });

  useEffect(() => {
    let live = true;
    loadContributions()
      .then((r) => {
        if (!live) return;
        if (r.ok) {
          setList(r.list);
          setInsurer({
            provider: r.list.privateHealth.provider ?? "",
            employee: r.list.privateHealth.employeeAmountRwf ? String(r.list.privateHealth.employeeAmountRwf) : "",
            employer: r.list.privateHealth.employerAmountRwf ? String(r.list.privateHealth.employerAmountRwf) : "",
          });
        } else setFailure(r.error);
      })
      .catch(() => {
        if (live) setFailure("Try again in a moment.");
      });
    return () => {
      live = false;
    };
  }, [loadContributions]);

  const choose = (code: string, body: Parameters<typeof chooseContribution>[1], done: string) =>
    startTransition(async () => {
      const r = await chooseContribution(code, body);
      if (r.ok) {
        setList(r.list);
        toast.success(done);
      } else toast.danger(r.error);
    });

  if (failure) {
    return <Card className="p-[18px] text-sm text-muted">Could not load contributions: {failure}</Card>;
  }
  if (!loaded) {
    return (
      <Card className="gap-3 p-[18px]" aria-busy="true">
        <Skeleton className="h-5 w-56 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </Card>
    );
  }
  // With insurance off, its cards go and the example salary leaves it out; switched on again, all is as before.
  const list: PayrollContributionList = insuranceOn
    ? loaded
    : {
        ...loaded,
        contributions: loaded.contributions.filter((c) => !INSURANCE_CODES.has(c.code)),
        privateHealth: { ...loaded.privateHealth, enabled: false },
      };

  const salary = salaryOf(list, calc);
  const sim = simulate(list, salary);
  const byCode = new Map(sim.rows.map((r) => [r.code, r]));
  const amount = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^0-9]/g, "")) || 0));

  return (
    <Card aria-labelledby="ins-h" className="gap-5 p-[18px]" render={(props) => <section {...(props as object)} />}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="ins-h" className="flex items-center gap-1.5 text-[17px] leading-6 font-semibold">
            {insuranceOn ? "Insurance and contributions" : "Contributions"}
            {list.note ? <Hint label="Where these figures come from">{list.note}</Hint> : null}
          </h2>
          <span className="text-xs text-muted">
            RSSB rule v{list.ruleVersion ?? "—"} · the next pay run follows any change
          </span>
        </div>
        {list.canChoose ? null : (
          <Chip size="sm" variant="soft">
            <Lock className="size-3" aria-hidden="true" />
            <Chip.Label>The owner chooses the optional ones</Chip.Label>
          </Chip>
        )}
      </div>

      <PayCalculator list={list} input={calc} onInput={setCalc} />

      {/* The schemes */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
        {list.contributions.map((c) => {
          const about = ABOUT[c.code];
          const on = byCode.get(c.code);
          return (
            <Card key={c.code} variant="secondary" className="gap-3 p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${c.enabled ? "bg-accent-soft text-accent-soft-foreground" : "bg-default text-muted"} [&>svg]:size-5`}
                  aria-hidden="true"
                >
                  {about?.icon ?? <Briefcase />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    {c.label}
                    {about ? <Hint label={`About ${c.label}`}>{about.detail}</Hint> : null}
                  </span>
                  <span className="text-xs leading-4 text-muted">{about?.what ?? BASE_WORDS[c.base]}</span>
                </div>
                {c.optional ? (
                  <Switch
                    aria-label={`${c.label}: ${c.enabled ? "on" : "off"}`}
                    isSelected={c.enabled}
                    isDisabled={!list.canChoose || pending}
                    onChange={(v) =>
                      choose(c.code, { enabled: v }, `${c.label} ${v ? "on" : "off"} from the next pay run`)
                    }
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                ) : (
                  <Chip size="sm" variant="soft">
                    <Check className="size-3" aria-hidden="true" />
                    <Chip.Label>Required</Chip.Label>
                  </Chip>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip size="sm" variant="soft">
                  Business {c.employerRate ? pct(c.employerRate) : "0%"}
                </Chip>
                <Chip size="sm" variant="soft">
                  Employee {c.employeeRate ? pct(c.employeeRate) : "0%"}
                </Chip>
                <span className="text-xs text-muted">{BASE_WORDS[c.base]}</span>
              </div>
              <span className="text-xs text-muted tabular">
                {c.enabled && on
                  ? `On ${formatRwf(salary)}: business ${formatRwf(on.employer)} · employee ${formatRwf(on.employee)}`
                  : c.byDefault
                    ? "Off by default"
                    : "Off for this business"}
              </span>
            </Card>
          );
        })}

        {/* A private insurer: fixed premiums the business sets */}
        {insuranceOn ? (
          <Card variant="secondary" className="gap-3 p-4">
            <div className="flex items-start gap-3">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${list.privateHealth.enabled ? "bg-accent-soft text-accent-soft-foreground" : "bg-default text-muted"} [&>svg]:size-5`}
                aria-hidden="true"
              >
                <Pill />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  Private health insurance
                  <Hint label="About private health insurance">
                    A private insurer&apos;s plan, instead of or beside RSSB&apos;s medical scheme: a fixed monthly
                    premium per person, shared as you agree. Taken after PAYE; ask your accountant whether the business
                    part is a taxable benefit.
                  </Hint>
                </span>
                <span className="text-xs leading-4 text-muted">
                  {list.privateHealth.enabled
                    ? `${list.privateHealth.provider ?? "Insurer"} · business ${formatRwf(list.privateHealth.employerAmountRwf)} · employee ${formatRwf(list.privateHealth.employeeAmountRwf)} a month`
                    : "If the business has a private insurer."}
                </span>
              </div>
              <Switch
                aria-label={`Private health insurance: ${list.privateHealth.enabled ? "on" : "off"}`}
                isSelected={list.privateHealth.enabled}
                isDisabled={!list.canChoose || pending}
                onChange={(v) =>
                  v
                    ? amount(insurer.employee) + amount(insurer.employer) > 0
                      ? choose(
                          "private_health",
                          {
                            enabled: true,
                            provider: insurer.provider || null,
                            employeeAmountRwf: amount(insurer.employee),
                            employerAmountRwf: amount(insurer.employer),
                          },
                          "Health insurance on from the next pay run",
                        )
                      : toast.warning("Enter the monthly premium first.")
                    : choose("private_health", { enabled: false }, "Health insurance off from the next pay run")
                }
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
            {list.canChoose ? (
              <div className="grid grid-cols-3 gap-2">
                <TextField
                  value={insurer.provider}
                  onChange={(v) => setInsurer((s) => ({ ...s, provider: v }))}
                  className="col-span-3 flex flex-col gap-1"
                >
                  <Label className="text-xs">Insurer</Label>
                  <Input placeholder="e.g. Radiant, Britam, Sanlam" />
                </TextField>
                <TextField
                  value={insurer.employer}
                  onChange={(v) => setInsurer((s) => ({ ...s, employer: v }))}
                  className="col-span-3 flex flex-col gap-1 sm:col-span-1"
                >
                  <Label className="text-xs">Business / month</Label>
                  <Input inputMode="numeric" placeholder="0" className="tabular" />
                </TextField>
                <TextField
                  value={insurer.employee}
                  onChange={(v) => setInsurer((s) => ({ ...s, employee: v }))}
                  className="col-span-3 flex flex-col gap-1 sm:col-span-1"
                >
                  <Label className="text-xs">Employee / month</Label>
                  <Input inputMode="numeric" placeholder="0" className="tabular" />
                </TextField>
                <Button
                  size="sm"
                  variant="secondary"
                  className="col-span-3 self-end sm:col-span-1"
                  isDisabled={pending || amount(insurer.employee) + amount(insurer.employer) === 0}
                  onPress={() =>
                    choose(
                      "private_health",
                      {
                        enabled: true,
                        provider: insurer.provider || null,
                        employeeAmountRwf: amount(insurer.employee),
                        employerAmountRwf: amount(insurer.employer),
                      },
                      "Health insurance saved; the next pay run takes it",
                    )
                  }
                >
                  Save
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </Card>
  );
}
