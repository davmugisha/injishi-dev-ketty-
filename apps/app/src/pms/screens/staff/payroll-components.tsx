"use client";

/**
 * Payroll · Allowances and deductions (058-payroll AC-PY5).
 *
 * A component is an allowance or a deduction the run adds to a payslip. It
 * says how much (a fixed sum, a share of the basic wage or of gross, so much a
 * day or an hour worked, so much a child), how it is taxed and contributed,
 * and whom it reaches: every active person, the contracts whose structure
 * groups it, or people named one by one, any of them less those named to leave
 * out, and only where its condition holds. A one off pays in one month only.
 * A change applies to runs not yet confirmed; a confirmed payslip keeps the
 * lines it froze.
 *
 * A structure is a named group of components a contract carries, such as
 * "Kitchen" or "Management", set on each contract in Contracts.
 *
 * THREE QUESTIONS, THEN SAVE. Adding one used to open on fourteen controls at
 * once, the first of them a code to invent in lower case with underscores. The
 * form asks what it is, how much, and who gets it; four examples fill it in a
 * press; and what most allowances never need (people to leave out, a
 * condition, how it is taxed, a one off month, the code) is folded under "More
 * options" with the answers a plain allowance has. The code is made from the
 * name, and can still be typed there. What is saved is the same request.
 */

import type {
  CreatePayComponentRequest,
  PayAmountType,
  PayComponent,
  PayCondition,
  PayConditionField,
  PayConditionOp,
  PayStructure,
} from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useDepartments } from "../../data/ops";
import { usePayComponents, usePayStructures, useSavePayComponent, useSavePayStructure } from "../../data/payroll";
import { useHrCatalog } from "../../data/people-file";
import { useEmployees } from "../../data/people";
import { fmt, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { monthName } from "./payroll-ui";
import { Field, FormError, PeoplePicker, Reveal, RowList, inputClass, rowClass } from "./staff-ui";

const AMOUNT_TYPE: Record<PayAmountType, string> = {
  fixed: "The same amount every month",
  percent_basic: "A percentage of the basic wage",
  percent_gross: "A percentage of gross pay",
  per_day_worked: "An amount for each day worked",
  per_hour_worked: "An amount for each hour worked",
  per_child: "An amount for each child",
};
const FIELD: Record<PayConditionField, string> = {
  sex: "Sex",
  marital_status: "Marital status",
  children: "Children",
  years_of_service: "Years of service",
  prior_experience: "Years of prior experience",
  employee_type: "Employee type",
  job_position: "Job position",
  department: "Department",
  branch: "Branch",
  wage_basis: "Paid by",
};
const OP: Record<PayConditionOp, string> = { eq: "is", ne: "is not", gt: "more than", gte: "at least", lt: "less than", lte: "at most", in: "is one of" };
const NUMERIC: readonly PayConditionField[] = ["children", "years_of_service", "prior_experience"];

/** How much a component is, in a few words. */
function amountText(c: Pick<PayComponent, "amountType" | "amountRwf" | "rate" | "capRwf">): string {
  const cap = c.capRwf !== null ? `, at most ${fmt(c.capRwf)}` : "";
  switch (c.amountType) {
    case "fixed":
      return fmt(c.amountRwf ?? 0);
    case "percent_basic":
      return `${c.rate ?? 0}% of basic${cap}`;
    case "percent_gross":
      return `${c.rate ?? 0}% of gross${cap}`;
    case "per_day_worked":
      return `${fmt(c.amountRwf ?? 0)} a day worked${cap}`;
    case "per_hour_worked":
      return `${fmt(c.amountRwf ?? 0)} an hour worked${cap}`;
    case "per_child":
      return `${fmt(c.amountRwf ?? 0)} a child${cap}`;
  }
}

export function PayComponents() {
  const workspaceId = useWorkspaceId();
  const components = usePayComponents(workspaceId);
  const structures = usePayStructures(workspaceId);
  const [editing, setEditing] = useState<PayComponent | "new" | null>(null);
  const [structureEditing, setStructureEditing] = useState<PayStructure | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const all = components.data ?? [];
  const archived = all.filter((c) => c.status === "archived").length;
  const shown = showArchived ? all : all.filter((c) => c.status !== "archived");
  const groups = structures.data ?? [];

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-64 flex-1 text-sm text-muted-foreground">
            What is added to pay or taken from it besides the wage: a transport allowance, meals, union dues. Add each
            one once here and every pay run applies it.
          </p>
          {editing === null && (
            <ActionButton variant="primary" onClick={() => setEditing("new")}>
              Add an allowance or deduction
            </ActionButton>
          )}
        </div>
        {editing !== null && (
          <Reveal when={editing === "new" ? "new" : editing.id}>
            <ComponentForm key={editing === "new" ? "new" : editing.id} component={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          </Reveal>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading n={shown.length}>Allowances and deductions</SectionHeading>
          <span className="flex-1" />
          {archived > 0 && (
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((v) => !v)}
              className="text-2xs font-semibold text-accent-text underline-offset-2 hover:underline"
            >
              {showArchived ? "Hide the archived" : `Show ${archived} archived`}
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <EmptyState className="p-6">
            {all.length === 0
              ? "None yet. Everybody is paid their wage and nothing else. Add a transport or meal allowance to see it on the next pay run."
              : "None in use. The archived ones no longer apply to any pay run."}
          </EmptyState>
        ) : (
          <RowList>
            {shown.map((c, i) => (
              <div key={c.id} className={`${rowClass(i)} flex flex-wrap items-center gap-x-3 gap-y-2`} data-component={c.code}>
                <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                    <Badge intent={c.kind === "allowance" ? "ok" : "neutral"}>{c.kind === "allowance" ? "Added to pay" : "Taken from pay"}</Badge>
                    {c.status === "archived" && <Badge intent="neutral">Archived</Badge>}
                    {c.oneOffPeriod && <Badge intent="info">{monthName(c.oneOffPeriod)} only</Badge>}
                  </span>
                  <span className="text-2xs text-ink2">{reachText(c, groups)}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5 text-right">
                  <span className="pms-num text-sm font-semibold text-ink">{amountText(c)}</span>
                  <span className="text-2xs text-muted-foreground">{taxText(c)}</span>
                </span>
                <ActionButton onClick={() => setEditing(c)}>Change</ActionButton>
              </div>
            ))}
          </RowList>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex min-w-64 flex-1 flex-col gap-1">
            <SectionHeading n={groups.length}>Pay structures (optional)</SectionHeading>
            <span className="text-sm text-muted-foreground">
              A named bundle, such as Kitchen or Management, for when different jobs get different allowances. Put
              allowances in it, then choose it on a person&apos;s contract.
            </span>
          </span>
          {structureEditing === null && (
            <ActionButton onClick={() => setStructureEditing("new")} deniedReason={all.length === 0 ? "Add an allowance or a deduction first" : undefined}>
              Add a structure
            </ActionButton>
          )}
        </div>
        {structureEditing !== null && (
          <Reveal when={structureEditing === "new" ? "new" : structureEditing.id}>
            <StructureForm
              key={structureEditing === "new" ? "new" : structureEditing.id}
              structure={structureEditing === "new" ? null : structureEditing}
              components={all}
              onDone={() => setStructureEditing(null)}
            />
          </Reveal>
        )}
        {groups.length > 0 && (
          <RowList>
            {groups.map((s, i) => (
              <div key={s.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-structure={s.id}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{s.name}</span>
                    {s.status === "archived" && <Badge intent="neutral">Archived</Badge>}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {s.componentIds.map((id) => all.find((c) => c.id === id)?.name ?? "A component").join(", ") || "Nothing in it yet"}
                  </span>
                </span>
                <span className="pms-num text-2xs text-muted-foreground">
                  {s.contractCount} contract{s.contractCount === 1 ? "" : "s"}
                </span>
                <ActionButton onClick={() => setStructureEditing(s)}>Change</ActionButton>
              </div>
            ))}
          </RowList>
        )}
      </section>
    </div>
  );
}

/** How a component meets tax and RSSB, in a few words. */
function taxText(c: Pick<PayComponent, "kind" | "taxable" | "inContributionBase" | "beforeTax">): string {
  if (c.kind === "deduction") return c.beforeTax ? "taken before tax" : "taken after tax";
  return `${c.taxable ? "taxed" : "not taxed"}, ${c.inContributionBase ? "counts for RSSB" : "not for RSSB"}`;
}

/** Whom a component reaches, as one sentence. */
function reachText(c: PayComponent, structures: readonly PayStructure[]): string {
  const included = c.targets.filter((t) => t.mode === "include");
  const excluded = c.targets.filter((t) => t.mode === "exclude");
  const inStructures = structures.filter((s) => s.componentIds.includes(c.id)).map((s) => s.name);
  const parts: string[] = [];
  if (c.appliesAllActive) parts.push("Everybody");
  if (inStructures.length > 0) parts.push(`contracts carrying ${inStructures.join(" or ")}`);
  if (included.length > 0) parts.push(included.map((t) => t.displayName).join(", "));
  let text = parts.length > 0 ? parts.join("; ") : "Nobody yet: choose who gets it, or put it in a pay structure";
  if (excluded.length > 0) text += `, except ${excluded.map((t) => t.displayName).join(", ")}`;
  if (c.condition) text += `, ${conditionText(c.condition)}`;
  return text;
}

/** A condition as words. A value that is an id (a branch, a department) is named by its field only. */
function conditionText(c: PayCondition): string {
  if (c.field === "wage_basis") {
    const basis = c.value === "daily" ? "the day" : c.value === "hourly" ? "the hour" : "the month";
    return c.op === "ne" ? `unless paid by ${basis}` : `when paid by ${basis}`;
  }
  if (c.field === "sex") return `${c.op === "ne" ? "except" : "for"} ${c.value === "female" ? "women" : "men"}`;
  if (c.field === "branch" || c.field === "department" || c.field === "job_position" || c.field === "employee_type") {
    return `${c.op === "ne" ? "outside" : "in"} one ${FIELD[c.field].toLowerCase()}`;
  }
  return `when ${FIELD[c.field].toLowerCase()} ${OP[c.op]} ${c.value}`;
}

/** Who a component is for, as the form asks it. */
type Who = "all" | "some" | "structure";

type ComponentDraft = Omit<CreatePayComponentRequest, "amountRwf" | "rate" | "capRwf" | "targets" | "condition" | "appliesAllActive"> & {
  amountRwf: string;
  rate: string;
  capRwf: string;
  condition: { field: PayConditionField; op: PayConditionOp; value: string } | null;
  who: Who;
  include: string[];
  exclude: string[];
  oneOff: boolean;
  /** The code was typed by hand; otherwise it follows the name. */
  codeTyped: boolean;
};

function draftOf(c: PayComponent | null): ComponentDraft {
  const include = (c?.targets ?? []).filter((t) => t.mode === "include").map((t) => t.employeeId);
  return {
    code: c?.code ?? "",
    name: c?.name ?? "",
    kind: c?.kind ?? "allowance",
    taxable: c?.taxable ?? true,
    inContributionBase: c?.inContributionBase ?? true,
    beforeTax: c?.beforeTax ?? false,
    amountType: c?.amountType ?? "fixed",
    amountRwf: c?.amountRwf !== null && c?.amountRwf !== undefined ? String(c.amountRwf) : "",
    rate: c?.rate !== null && c?.rate !== undefined ? String(c.rate) : "",
    capRwf: c?.capRwf !== null && c?.capRwf !== undefined ? String(c.capRwf) : "",
    condition: c?.condition ?? null,
    // A new one is for everybody: that is what most allowances are.
    who: c === null || c.appliesAllActive ? "all" : include.length > 0 ? "some" : "structure",
    oneOffPeriod: c?.oneOffPeriod ?? null,
    include,
    exclude: (c?.targets ?? []).filter((t) => t.mode === "exclude").map((t) => t.employeeId),
    oneOff: c?.oneOffPeriod !== null && c?.oneOffPeriod !== undefined,
    codeTyped: c !== null,
  };
}

/** The payslip line's code, from the name: `Transport allowance` is `transport_allowance`. */
function codeFrom(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 31);
}

/** What most hotels pay or take. Pressing one fills the form; nothing is saved until Save. */
const EXAMPLES: readonly { label: string; fill: Partial<ComponentDraft> }[] = [
  { label: "Transport allowance", fill: { name: "Transport allowance", kind: "allowance", amountType: "fixed", amountRwf: "20000" } },
  { label: "Meals, for each day worked", fill: { name: "Meal allowance", kind: "allowance", amountType: "per_day_worked", amountRwf: "1500" } },
  { label: "Housing, a share of the wage", fill: { name: "Housing allowance", kind: "allowance", amountType: "percent_basic", rate: "10" } },
  { label: "Union dues", fill: { name: "Union dues", kind: "deduction", amountType: "percent_basic", rate: "1" } },
];

function ComponentForm({ component, onDone }: { component: PayComponent | null; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const save = useSavePayComponent(workspaceId);
  const [d, setD] = useState<ComponentDraft>(() => draftOf(component));
  const [more, setMore] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const percent = d.amountType === "percent_basic" || d.amountType === "percent_gross";
  const people = (employees.data ?? []).map((e) => ({ id: e.id, label: e.displayName, detail: e.employeeNumber }));
  const code = component ? component.code : d.codeTyped ? d.code.trim() : codeFrom(d.name);
  const amount = {
    amountType: d.amountType,
    amountRwf: percent ? null : Number(d.amountRwf) || 0,
    rate: percent ? Number(d.rate) || 0 : null,
    capRwf: d.capRwf.trim() === "" || d.amountType === "fixed" ? null : Number(d.capRwf),
  };
  const filled = percent ? Number(d.rate) > 0 : Number(d.amountRwf) > 0;
  const said = `${d.kind === "allowance" ? "Adds" : "Takes"} ${filled ? amountText(amount) : "an amount"}${d.amountType === "fixed" && filled ? " a month" : ""}, ${
    d.who === "all" ? "for everybody" : d.who === "some" ? `for ${d.include.length} ${d.include.length === 1 ? "person" : "people"}` : "for contracts whose pay structure carries it"
  }${d.exclude.length > 0 ? `, except ${d.exclude.length}` : ""}${d.oneOff ? `, in ${monthName(d.oneOffPeriod ?? todayIso().slice(0, 7))} only` : ""}.`;

  const submit = () => {
    if (!component && !/^[a-z][a-z0-9_]{1,30}$/.test(code)) {
      setProblem(d.codeTyped ? "The code is lower case letters, digits and underscores, starting with a letter." : "Give it a name that starts with a letter.");
      if (d.codeTyped) setMore(true);
      return;
    }
    if (d.who === "some" && d.include.length === 0) {
      setProblem("Choose at least one person, or give it to everybody.");
      return;
    }
    setProblem(null);
    const condition: PayCondition | null = d.condition && d.condition.value.trim() ? { ...d.condition, value: d.condition.value.trim() } : null;
    const fields = {
      name: d.name.trim(),
      kind: d.kind,
      taxable: d.kind === "allowance" ? d.taxable : false,
      inContributionBase: d.kind === "allowance" ? d.inContributionBase : false,
      beforeTax: d.kind === "deduction" ? d.beforeTax : false,
      amountType: d.amountType,
      amountRwf: percent ? null : Number(d.amountRwf),
      rate: percent ? Number(d.rate) : null,
      capRwf: amount.capRwf,
      condition,
      appliesAllActive: d.who === "all",
      oneOffPeriod: d.oneOff ? (d.oneOffPeriod ?? todayIso().slice(0, 7)) : null,
      targets: [
        ...(d.who === "some" ? d.include : []).map((employeeId) => ({ employeeId, mode: "include" as const })),
        ...d.exclude.map((employeeId) => ({ employeeId, mode: "exclude" as const })),
      ],
    };
    save.mutate(component ? { id: component.id, body: fields } : { id: null, body: { ...fields, code } }, {
      onSuccess: (c) => {
        toast(`${c.name} saved. It applies from the next pay run that is not yet confirmed.`, "ok");
        onDone();
      },
    });
  };

  return (
    <form
      className="@container flex flex-col gap-5 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <SectionHeading>{component ? `Change ${component.name}` : "Add an allowance or a deduction"}</SectionHeading>

      {!component && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Examples to start from">
          <span className="text-2xs text-muted-foreground">Start from an example:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => setD({ ...draftOf(null), ...example.fill })}
              className="rounded-full border border-card-bd bg-card px-3 py-1 text-2xs font-semibold text-ink2 hover:bg-hover"
            >
              {example.label}
            </button>
          ))}
        </div>
      )}

      <Step n={1} title="What is it?">
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
          <Field label="Name" hint="As it will read on the payslip." htmlFor="comp-name">
            <Input id="comp-name" required minLength={2} maxLength={80} placeholder="Transport allowance" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={inputClass} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Whether it is added or taken">
            <Choice on={d.kind === "allowance"} onPress={() => setD({ ...d, kind: "allowance" })} title="An allowance" hint="Added to their pay." />
            <Choice on={d.kind === "deduction"} onPress={() => setD({ ...d, kind: "deduction" })} title="A deduction" hint="Taken from their pay." />
          </div>
        </div>
      </Step>

      <Step n={2} title="How much?">
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
          <Field label="It is">
            <SelectField
              label="How the amount is reached"
              value={d.amountType}
              onChange={(v) => setD({ ...d, amountType: (Object.keys(AMOUNT_TYPE).includes(v) ? v : "fixed") as PayAmountType })}
              options={(Object.keys(AMOUNT_TYPE) as PayAmountType[]).map((k) => ({ value: k, label: AMOUNT_TYPE[k] }))}
            />
          </Field>
          {percent ? (
            <Field label="Percentage" hint="2.5 is 2.5%." htmlFor="comp-rate">
              <Input id="comp-rate" type="number" min={0.01} max={100} step={0.01} required value={d.rate} onChange={(e) => setD({ ...d, rate: e.target.value })} className={`${inputClass} pms-num`} />
            </Field>
          ) : (
            <Field label="Amount in RWF" htmlFor="comp-amount">
              <Input id="comp-amount" type="number" min={1} step={1} required value={d.amountRwf} onChange={(e) => setD({ ...d, amountRwf: e.target.value })} className={`${inputClass} pms-num`} />
            </Field>
          )}
          {d.amountType !== "fixed" && (
            <Field label="Never more than (RWF)" hint="Empty for no limit." htmlFor="comp-cap">
              <Input id="comp-cap" type="number" min={1} step={1} value={d.capRwf} onChange={(e) => setD({ ...d, capRwf: e.target.value })} className={`${inputClass} pms-num`} />
            </Field>
          )}
        </div>
      </Step>

      <Step n={3} title="Who gets it?">
        <div className="flex flex-col gap-2 @2xl:flex-row" role="group" aria-label="Who it is for">
          <Choice on={d.who === "all"} onPress={() => setD({ ...d, who: "all" })} title="Everybody" hint="Every active person, new hires too." />
          <Choice on={d.who === "some"} onPress={() => setD({ ...d, who: "some" })} title="Only people I choose" hint="Named one by one." />
          <Choice on={d.who === "structure"} onPress={() => setD({ ...d, who: "structure" })} title="A pay structure" hint="Whoever's contract carries a bundle with it." />
        </div>
        {d.who === "some" && (
          <Field label="These people">
            <PeoplePicker people={people} selected={d.include} onChange={(ids) => setD({ ...d, include: ids })} label="People it reaches" />
          </Field>
        )}
        {d.who === "structure" && (
          <p className="text-2xs text-muted-foreground">Save it, then add it to a pay structure below. Nobody gets it until a structure carries it.</p>
        )}
      </Step>

      <div className="flex flex-col gap-4 border-t border-line pt-4">
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          className="self-start text-sm font-semibold text-accent-text underline-offset-2 hover:underline"
        >
          {more ? "Hide more options" : "More options: tax, people to leave out, a condition, one month only"}
        </button>
        {more && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {d.kind === "allowance" ? (
                <>
                  <Checkbox isSelected={d.taxable} onChange={(on) => setD({ ...d, taxable: on })} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
                    Taxed under PAYE
                  </Checkbox>
                  <Checkbox isSelected={d.inContributionBase} onChange={(on) => setD({ ...d, inContributionBase: on })} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
                    Counts for RSSB contributions
                  </Checkbox>
                </>
              ) : (
                <Checkbox isSelected={d.beforeTax} onChange={(on) => setD({ ...d, beforeTax: on })} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
                  Taken before tax, so it lowers the taxable pay
                </Checkbox>
              )}
              <Checkbox isSelected={d.oneOff} onChange={(on) => setD({ ...d, oneOff: on, oneOffPeriod: on ? (d.oneOffPeriod ?? todayIso().slice(0, 7)) : null })} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
                Once only, in one month
              </Checkbox>
              {d.oneOff && (
                <Input aria-label="The month it pays in" type="month" value={d.oneOffPeriod ?? ""} onChange={(e) => e.target.value && setD({ ...d, oneOffPeriod: e.target.value })} className="h-10 w-auto self-start rounded border-line2 bg-card text-sm" />
              )}
            </div>
            <Field label="Leave these people out" hint="They never get it, whoever else does.">
              <PeoplePicker people={people} selected={d.exclude} onChange={(ids) => setD({ ...d, exclude: ids })} label="People it never reaches" />
            </Field>
            <ConditionField value={d.condition} onChange={(condition) => setD({ ...d, condition })} />
            {component ? (
              <Field label="Code on the payslip" hint="It never changes: it names this line on every payslip.">
                <span className="pms-num flex h-10 items-center text-sm text-ink2">{component.code}</span>
              </Field>
            ) : (
              <div className="w-full @2xl:w-1/2">
                <Field label="Code on the payslip" hint="Made from the name. Lower case, no spaces: transport_allowance." htmlFor="comp-code">
                  <Input id="comp-code" value={code} onChange={(e) => setD({ ...d, code: e.target.value, codeTyped: true })} className={`${inputClass} pms-num`} />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>

      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <FormError error={save.error} />
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="min-w-48 flex-1 text-sm text-ink2" data-component-says>
          {said}
        </span>
        {component && component.status === "active" && (
          <ActionButton
            type="button"
            pending={save.isPending && save.variables?.id === component.id && "status" in (save.variables?.body ?? {})}
            onClick={() =>
              save.mutate({ id: component.id, body: { status: "archived" } }, { onSuccess: () => { toast(`${component.name} archived. No pay run applies it any more.`, "ok"); onDone(); } })
            }
          >
            Archive
          </ActionButton>
        )}
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={save.isPending}>
          Save
        </ActionButton>
      </div>
    </form>
  );
}

/** One of the form's three questions. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 flex items-center gap-2.5">
        <span aria-hidden className="pms-num grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-bold text-accent-text">
          {n}
        </span>
        <span className="text-sm font-bold text-ink">{title}</span>
      </legend>
      {children}
    </fieldset>
  );
}

/** One answer among a few, said with what it means beneath it. */
function Choice({ on, onPress, title, hint }: { on: boolean; onPress: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPress}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-0.5 rounded-card border px-3.5 py-2.5 text-left",
        on ? "border-accent-text bg-accent-soft" : "border-card-bd bg-card hover:bg-hover",
      )}
    >
      <span className={cn("text-sm font-semibold", on ? "text-accent-text" : "text-ink")}>{title}</span>
      <span className="text-2xs text-ink2">{hint}</span>
    </button>
  );
}

/** One condition on one field, from the closed list the server reads. */
function ConditionField({
  value,
  onChange,
}: {
  value: ComponentDraft["condition"];
  onChange: (v: ComponentDraft["condition"]) => void;
}) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const departments = useDepartments(workspaceId);
  const positions = useHrCatalog(workspaceId, "job-positions");
  const types = useHrCatalog(workspaceId, "employee-types");
  const field = value?.field ?? null;
  const choices: Partial<Record<PayConditionField, { value: string; label: string }[]>> = {
    sex: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
    ],
    marital_status: ["single", "married", "divorced", "widowed"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
    wage_basis: [
      { value: "monthly", label: "The month" },
      { value: "daily", label: "The day" },
      { value: "hourly", label: "The hour" },
    ],
    branch: branches.map((b) => ({ value: b.id, label: b.name })),
    department: (departments.data?.departments ?? []).map((x) => ({ value: x.id, label: x.name })),
    job_position: (positions.data?.items ?? []).map((x) => ({ value: x.id, label: x.title })),
    employee_type: (types.data?.items ?? []).map((x) => ({ value: x.id, label: x.title })),
  };
  const numeric = field !== null && NUMERIC.includes(field);
  const ops: PayConditionOp[] = numeric ? ["eq", "ne", "gt", "gte", "lt", "lte"] : ["eq", "ne"];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Only when">
        <SelectField
          label="Condition field"
          placeholder="Always"
          value={field ?? ""}
          onChange={(v) => onChange(v ? { field: v as PayConditionField, op: "eq", value: "" } : null)}
          options={[{ value: "", label: "Always" }, ...(Object.keys(FIELD) as PayConditionField[]).map((k) => ({ value: k, label: FIELD[k] }))]}
        />
      </Field>
      {value && (
        <>
          <Field label="Is">
            <SelectField label="Condition" value={value.op} onChange={(v) => onChange({ ...value, op: v as PayConditionOp })} options={ops.map((o) => ({ value: o, label: OP[o] }))} />
          </Field>
          <Field label="Value">
            {numeric ? (
              <Input aria-label="Condition value" type="number" min={0} step={1} value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} className={inputClass} />
            ) : (
              <SelectField label="Condition value" value={value.value} onChange={(v) => onChange({ ...value, value: v })} placeholder="Choose" options={choices[value.field] ?? []} />
            )}
          </Field>
        </>
      )}
    </div>
  );
}

function StructureForm({ structure, components, onDone }: { structure: PayStructure | null; components: readonly PayComponent[]; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const save = useSavePayStructure(workspaceId);
  const [name, setName] = useState(structure?.name ?? "");
  const [ids, setIds] = useState<string[]>(structure?.componentIds ?? []);
  const active = components.filter((c) => c.status === "active" || ids.includes(c.id));

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        const body = { name: name.trim(), componentIds: ids };
        save.mutate(structure ? { id: structure.id, body } : { id: null, body }, {
          onSuccess: (s) => {
            toast(`${s.name} saved`, "ok");
            onDone();
          },
        });
      }}
    >
      <SectionHeading>{structure ? `Change ${structure.name}` : "Add a pay structure"}</SectionHeading>
      <Field label="Name" hint="The job or group it is for." htmlFor="structure-name">
        <Input id="structure-name" required maxLength={80} placeholder="Kitchen" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">What it carries</span>
      <div role="group" aria-label="Components in the structure" className="flex flex-col gap-1.5">
        {active.map((c) => (
          <Checkbox
            key={c.id}
            isSelected={ids.includes(c.id)}
            onChange={(on) => setIds(on ? [...ids, c.id] : ids.filter((x) => x !== c.id))}
            className="flex w-full items-center gap-2.5 text-sm font-normal text-ink"
          >
            {c.name} <span className="text-2xs text-muted-foreground">{amountText(c)}</span>
          </Checkbox>
        ))}
      </div>
      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        {structure && structure.status === "active" && (
          <ActionButton type="button" onClick={() => save.mutate({ id: structure.id, body: { status: "archived" } }, { onSuccess: () => { toast(`${structure.name} archived`, "ok"); onDone(); } })}>
            Archive
          </ActionButton>
        )}
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={save.isPending}>
          Save
        </ActionButton>
      </div>
    </form>
  );
}
