"use client";

/**
 * Payroll · Rules in force (058-payroll AC-PY15): the national rows a run
 * reads, PAYE, RSSB, overtime, a leaver's settlement, the leave defaults, the
 * public holidays and the declaration formats, each with the version in force
 * today and the versions before it.
 *
 * Read only, and on purpose. A rule is Rwanda's, not the business's: it
 * changes by a new version written from the accountant's sheet, never from
 * this screen, and a run records which version it computed with. On a sample
 * database every row is an invented placeholder marked DEMO SAMPLE DATA.
 *
 * EACH RULE IS SHOWN AS WHAT IT SAYS. The screen used to name a rule by its
 * config key (`hr.rw.paye`) and keep its content as JSON behind "What it
 * says", so the one person who has to check the tax bands against the
 * accountant's sheet read braces. A rule is a card now: what it is for, then
 * its content as that kind of rule is read (bands as a table, rates as
 * percentages, holidays as dates). The key, the versions and the stored value
 * are still there, folded under "For the accountant".
 *
 * A rule's value is `unknown` to this screen: it is written by hand from a
 * sheet, and a new version may carry a shape this build has not seen. Each
 * reader below answers null for a value it does not recognise, and the card
 * shows the stored value instead of guessing.
 */

import type { PayrollRule } from "@injishi/contracts";
import type { ReactNode } from "react";

import { Badge, EmptyState, LoadFailed, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { usePayrollRules } from "../../data/payroll";
import { dshortIso, fmt, kigaliDateOf } from "../../lib/format";

type Json = Record<string, unknown>;

const obj = (v: unknown): Json | null => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const list = (v: unknown): Json[] | null => (Array.isArray(v) && v.every((x) => obj(x) !== null) ? (v as Json[]) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** A rate kept as a fraction, as a person says it: `0.004` is `0.4%`. */
const percent = (rate: number): string => `${Math.round(rate * 10_000) / 100}%`;
const yesNo = (v: unknown, yes: string, no: string): string => (v === true ? yes : no);

/** What each rule is for, in the words of somebody who does not keep the config. */
const PURPOSE: Record<string, string> = {
  "hr.rw.paye": "The income tax taken from each payslip.",
  "hr.rw.rssb": "What the employee and the business each pay to RSSB.",
  "hr.rw.leave_defaults": "The leave a new business starts with. Yours are under Leave, Leave types.",
  "hr.rw.public_holidays": "The national days off. Working one is paid as overtime.",
  "hr.rw.overtime": "How much more an hour of overtime is worth than a normal one.",
  "hr.rw.final_settlement": "What somebody leaving is paid for leave they did not take.",
  "hr.rw.declaration_formats": "The layout of the files sent to RRA and RSSB.",
};

export function PayRules() {
  const workspaceId = useWorkspaceId();
  const rules = usePayrollRules(workspaceId);
  if (rules.isPending) return <Skeleton height={240} />;
  if (rules.isError) {
    return (
      <LoadFailed onRetry={() => void rules.refetch()} retrying={rules.isFetching}>
        We couldn&apos;t read the rules in force. Nothing has changed.
      </LoadFailed>
    );
  }
  const all = rules.data.rules;
  const sample = all.filter(isSample).length;
  const missing = all.filter((r) => !r.inForce).length;

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The national rules every pay run is worked out from. They are read here, not changed: the accountant sends a new
        version when the law changes, and each pay run records the version it used.
      </p>

      {sample > 0 && (
        <p role="note" className="rounded-card border border-card-bd bg-warn-bg px-4 py-3 text-sm text-ink" data-sample-rules>
          <strong>Sample values.</strong> {sample === all.length ? "These figures" : `${sample} of these rules`} are invented
          placeholders, not Rwanda&apos;s real rates. Replace them from the accountant&apos;s sheet before paying real people.
        </p>
      )}
      {missing > 0 && (
        <p role="alert" className="rounded-card border border-card-bd bg-warn-bg px-4 py-3 text-sm text-ink">
          {missing === 1 ? "One rule has" : `${missing} rules have`} no version in force. A pay run that needs it is refused
          until the accountant&apos;s figures are entered.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        {all.map((r) => (
          <RuleCard key={r.configType} rule={r} />
        ))}
      </div>
    </div>
  );
}

function isSample(rule: PayrollRule): boolean {
  const note = text(obj(rule.inForce?.value)?.note);
  return note !== null && note.startsWith("DEMO SAMPLE DATA");
}

function RuleCard({ rule }: { rule: PayrollRule }) {
  const value = rule.inForce?.value;
  const body = rule.inForce ? readRule(rule.configType, value) : null;
  return (
    <section className="flex flex-col gap-3 rounded-card border border-card-bd bg-card px-5 py-4" data-rule={rule.configType}>
      <div className="flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-ink">{rule.label[0].toUpperCase() + rule.label.slice(1)}</h3>
          {!rule.inForce && <Badge intent="bad">None in force</Badge>}
        </span>
        {PURPOSE[rule.configType] && <span className="text-2xs text-muted-foreground">{PURPOSE[rule.configType]}</span>}
      </div>

      {rule.inForce ? (
        (body ?? <Stored value={value} />)
      ) : (
        <EmptyState className="p-3 text-2xs">
          A run that needs this rule is refused, naming it, until a row is written from the accountant&apos;s sheet.
        </EmptyState>
      )}

      {rule.inForce && (
        <details className="border-t border-line pt-2.5">
          <summary className="cursor-pointer text-2xs text-muted-foreground">
            Version {rule.inForce.version}
            {rule.inForce.effectiveFrom ? `, in force since ${dshortIso(kigaliDateOf(rule.inForce.effectiveFrom))}` : ""}
            <span className="font-semibold text-accent-text"> · For the accountant</span>
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <span className="pms-num text-2xs text-muted-foreground">Kept as {rule.configType}</span>
            {rule.history.length > 1 && (
              <ul className="flex flex-col gap-1 text-2xs text-muted-foreground">
                {rule.history.map((h) => (
                  <li key={h.configEntryId}>
                    Version {h.version}: {h.effectiveFrom ? dshortIso(kigaliDateOf(h.effectiveFrom)) : "always"} to{" "}
                    {h.effectiveTo ? dshortIso(kigaliDateOf(h.effectiveTo)) : "now"}
                  </li>
                ))}
              </ul>
            )}
            {body && <Stored value={value} />}
          </div>
        </details>
      )}
    </section>
  );
}

/** The value as it is stored, for a shape this build cannot read and for whoever checks it by hand. */
function Stored({ value }: { value: unknown }) {
  return <pre className="rounded border border-line bg-panel p-3 text-2xs break-words whitespace-pre-wrap text-ink2">{JSON.stringify(value, null, 2)}</pre>;
}

// --- How each kind of rule reads -----------------------------------------------------------

/** Rows of "what" and "how much", the shape most rules are. */
function Figures({ head, rows }: { head?: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  return (
    <table className="w-full text-sm">
      {head && (
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`pb-1.5 text-2xs font-semibold text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-t border-line first:border-t-0">
            {row.map((cell, i) => (
              <td key={i} className={i === 0 ? "py-1.5 pr-3 text-ink" : "pms-num py-1.5 pl-3 text-right font-semibold text-ink"}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Aside = ({ children }: { children: ReactNode }) => <p className="text-2xs text-muted-foreground">{children}</p>;

function readRule(configType: string, value: unknown): ReactNode | null {
  const v = obj(value);
  if (!v) return null;
  switch (configType) {
    case "hr.rw.paye":
      return paye(v);
    case "hr.rw.rssb":
      return rssb(v);
    case "hr.rw.leave_defaults":
      return leaveDefaults(v);
    case "hr.rw.public_holidays":
      return holidays(v);
    case "hr.rw.overtime":
      return overtime(v);
    case "hr.rw.final_settlement":
      return settlement(v);
    case "hr.rw.declaration_formats":
      return formats(v);
    default:
      return null;
  }
}

function paye(v: Json): ReactNode | null {
  const bands = list(v.bands);
  if (!bands || bands.length === 0) return null;
  const rows: ReactNode[][] = [];
  for (const band of bands) {
    const from = num(band.fromRwf);
    const to = band.toRwf === null ? null : num(band.toRwf);
    const rate = num(band.rate);
    if (from === null || rate === null || (band.toRwf !== null && to === null)) return null;
    rows.push([to === null ? `Above ${fmt(from)}` : from === 0 ? `Up to ${fmt(to)}` : `${fmt(from)} to ${fmt(to)}`, rate === 0 ? "No tax" : percent(rate)]);
  }
  return (
    <>
      <Figures head={["Monthly pay", "Tax on that part"]} rows={rows} />
      <Aside>Worked out on {v.taxableBase === "gross" ? "gross pay" : (text(v.taxableBase) ?? "taxable pay")}: each part of the pay is taxed at its own rate.</Aside>
    </>
  );
}

function rssb(v: Json): ReactNode | null {
  const contributions = list(v.contributions);
  if (!contributions || contributions.length === 0) return null;
  const rows: ReactNode[][] = [];
  for (const c of contributions) {
    const employee = num(c.employeeRate);
    const employer = num(c.employerRate);
    if (employee === null || employer === null) return null;
    rows.push([
      <span key="name" className="flex flex-col">
        {text(c.label) ?? text(c.code) ?? "Contribution"}
        <span className="text-2xs text-muted-foreground">on {c.base === "basic" ? "the basic wage" : "gross pay"}</span>
      </span>,
      percent(employee),
      percent(employer),
    ]);
  }
  return <Figures head={["Contribution", "Employee pays", "Business pays"]} rows={rows} />;
}

function leaveDefaults(v: Json): ReactNode | null {
  const types = list(v.types);
  if (!types || types.length === 0) return null;
  const rows = types.map((t): ReactNode[] => {
    const days = num(t.yearlyEntitlementDays);
    const notes = [
      t.payment === "unpaid" ? "unpaid" : t.payment === "partial" ? `paid at ${num(t.paymentPercent) ?? 0}%` : "paid",
      t.eligibleSex === "female" ? "women" : t.eligibleSex === "male" ? "men" : null,
      num(t.minServiceMonths) ? `after ${num(t.minServiceMonths)} months` : null,
      t.needsAttachment === true ? "needs a note" : null,
      t.compensatory === true ? "earned by working a day off" : null,
    ].filter(Boolean);
    return [
      <span key="name" className="flex flex-col">
        {text(t.name) ?? text(t.code) ?? "Leave"}
        <span className="text-2xs text-muted-foreground">{notes.join(", ")}</span>
      </span>,
      days === null || days === 0 ? "No fixed days" : `${days} days`,
    ];
  });
  return <Figures head={["Leave", "A year"]} rows={rows} />;
}

function holidays(v: Json): ReactNode | null {
  const dates = list(v.dates);
  if (!dates) return null;
  const rows = dates.map((d): ReactNode[] => [text(d.name) ?? "Holiday", text(d.date) ? dshortIso(text(d.date) as string) : ""]);
  return (
    <>
      {rows.length > 0 ? <Figures rows={rows} /> : <Aside>No dates recorded.</Aside>}
      {num(v.year) !== null && <Aside>For {num(v.year)}. Each year has its own list.</Aside>}
    </>
  );
}

function overtime(v: Json): ReactNode | null {
  const m = obj(v.multipliers);
  if (!m) return null;
  const times = (x: unknown) => (num(x) === null ? "Not set" : `${num(x)} times normal pay`);
  const divisor = num(v.monthlyHoursDivisor);
  return (
    <>
      <Figures
        rows={[
          ["On a working day", times(m.weekday)],
          ["On a weekly day off", times(m.weekly_off)],
          ["On a public holiday", times(m.public_holiday)],
        ]}
      />
      <Aside>
        {divisor !== null ? `An hour is the monthly wage divided by ${divisor}. ` : ""}
        Overtime is {yesNo(v.taxable, "taxed", "not taxed")} and {yesNo(v.contributable, "counts for RSSB", "does not count for RSSB")}.
      </Aside>
    </>
  );
}

function settlement(v: Json): ReactNode | null {
  const leave = obj(v.unusedLeave);
  if (!leave) return null;
  return (
    <Figures
      rows={[
        ["Unused leave is paid out", "Yes"],
        ["Taxed under PAYE", yesNo(leave.taxable, "Yes", "No")],
        ["Counts for RSSB", yesNo(leave.contributable, "Yes", "No")],
      ]}
    />
  );
}

function formats(v: Json): ReactNode | null {
  const named = (x: unknown): string | null => {
    const format = text(obj(x)?.format);
    return format === null ? null : format === "provisional_csv" ? "Provisional (a plain CSV file)" : format.replace(/_/g, " ");
  };
  const paye = named(v.paye);
  const rssb = named(v.rssb);
  if (paye === null && rssb === null) return null;
  return (
    <>
      <Figures
        rows={[
          ["PAYE declaration", paye ?? "Not set"],
          ["RSSB declaration", rssb ?? "Not set"],
        ]}
      />
      <Aside>A provisional file says so on its first line, until the authority&apos;s own layout is set.</Aside>
    </>
  );
}
