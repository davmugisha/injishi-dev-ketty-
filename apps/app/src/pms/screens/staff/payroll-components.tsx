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
import { useState } from "react";

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
import { Field, FormError, PeoplePicker, RowList, inputClass, rowClass } from "./staff-ui";

const AMOUNT_TYPE: Record<PayAmountType, string> = {
  fixed: "A fixed sum",
  percent_basic: "A share of the basic wage",
  percent_gross: "A share of gross",
  per_day_worked: "So much a day worked",
  per_hour_worked: "So much an hour worked",
  per_child: "So much a child",
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
  const all = components.data ?? [];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading n={all.length}>Allowances and deductions</SectionHeading>
          <span className="flex-1" />
          {editing === null && (
            <ActionButton variant="primary" onClick={() => setEditing("new")}>
              Add one
            </ActionButton>
          )}
        </div>
        {editing !== null && <ComponentForm component={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        {all.length === 0 ? (
          <EmptyState className="p-6">
            Nothing yet. A transport allowance for everybody, a share of basic for the union, a meal allowance on days
            worked: each is added once here.
          </EmptyState>
        ) : (
          <RowList>
            {all.map((c, i) => (
              <div key={c.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-component={c.code}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                    <Badge intent={c.kind === "allowance" ? "ok" : "neutral"}>{c.kind === "allowance" ? "Allowance" : "Deduction"}</Badge>
                    {c.status === "archived" && <Badge intent="neutral">Archived</Badge>}
                    {c.oneOffPeriod && <Badge intent="info">{monthName(c.oneOffPeriod)} only</Badge>}
                  </span>
                  <span className="text-2xs text-muted-foreground">{reachText(c, structures.data ?? [])}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5 text-right">
                  <span className="pms-num text-sm text-ink2">{amountText(c)}</span>
                  <span className="text-2xs text-muted-foreground">
                    {c.kind === "allowance"
                      ? `${c.taxable ? "taxed" : "not taxed"}, ${c.inContributionBase ? "contributes" : "no contributions"}`
                      : c.beforeTax
                        ? "taken before tax"
                        : "taken after tax"}
                  </span>
                </span>
                <ActionButton onClick={() => setEditing(c)}>Edit</ActionButton>
              </div>
            ))}
          </RowList>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading n={structures.data?.length}>Pay structures</SectionHeading>
          <span className="flex-1" />
          {structureEditing === null && (
            <ActionButton onClick={() => setStructureEditing("new")} deniedReason={all.length === 0 ? "Add an allowance or a deduction first" : undefined}>
              Add a structure
            </ActionButton>
          )}
        </div>
        <p className="text-2xs text-muted-foreground">
          A structure groups components a contract carries. Set it on each contract under Contracts.
        </p>
        {structureEditing !== null && (
          <StructureForm structure={structureEditing === "new" ? null : structureEditing} components={all} onDone={() => setStructureEditing(null)} />
        )}
        {(structures.data ?? []).length > 0 && (
          <RowList>
            {(structures.data ?? []).map((s, i) => (
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
                <ActionButton onClick={() => setStructureEditing(s)}>Edit</ActionButton>
              </div>
            ))}
          </RowList>
        )}
      </section>
    </div>
  );
}

/** Whom a component reaches, as one sentence. */
function reachText(c: PayComponent, structures: readonly PayStructure[]): string {
  const included = c.targets.filter((t) => t.mode === "include");
  const excluded = c.targets.filter((t) => t.mode === "exclude");
  const inStructures = structures.filter((s) => s.componentIds.includes(c.id)).map((s) => s.name);
  const parts: string[] = [];
  if (c.appliesAllActive) parts.push("Everybody active");
  if (inStructures.length > 0) parts.push(`contracts carrying ${inStructures.join(" or ")}`);
  if (included.length > 0) parts.push(included.map((t) => t.displayName).join(", "));
  let text = parts.length > 0 ? parts.join("; ") : "Nobody yet: put it in a structure or name people";
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

type ComponentDraft = Omit<CreatePayComponentRequest, "amountRwf" | "rate" | "capRwf" | "targets" | "condition"> & {
  amountRwf: string;
  rate: string;
  capRwf: string;
  condition: { field: PayConditionField; op: PayConditionOp; value: string } | null;
  include: string[];
  exclude: string[];
  oneOff: boolean;
};

function draftOf(c: PayComponent | null): ComponentDraft {
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
    appliesAllActive: c?.appliesAllActive ?? false,
    oneOffPeriod: c?.oneOffPeriod ?? null,
    include: (c?.targets ?? []).filter((t) => t.mode === "include").map((t) => t.employeeId),
    exclude: (c?.targets ?? []).filter((t) => t.mode === "exclude").map((t) => t.employeeId),
    oneOff: c?.oneOffPeriod !== null && c?.oneOffPeriod !== undefined,
  };
}

function ComponentForm({ component, onDone }: { component: PayComponent | null; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const employees = useEmployees(workspaceId, "active");
  const save = useSavePayComponent(workspaceId);
  const [d, setD] = useState<ComponentDraft>(() => draftOf(component));
  const percent = d.amountType === "percent_basic" || d.amountType === "percent_gross";
  const people = (employees.data ?? []).map((e) => ({ id: e.id, label: e.displayName, detail: e.employeeNumber }));

  const submit = () => {
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
      capRwf: d.capRwf.trim() === "" || d.amountType === "fixed" ? null : Number(d.capRwf),
      condition,
      appliesAllActive: d.appliesAllActive,
      oneOffPeriod: d.oneOff ? (d.oneOffPeriod ?? todayIso().slice(0, 7)) : null,
      targets: [
        ...d.include.map((employeeId) => ({ employeeId, mode: "include" as const })),
        ...d.exclude.map((employeeId) => ({ employeeId, mode: "exclude" as const })),
      ],
    };
    save.mutate(component ? { id: component.id, body: fields } : { id: null, body: { ...fields, code: d.code.trim() } }, {
      onSuccess: (c) => {
        toast(`${c.name} saved; it applies to runs not yet confirmed`, "ok");
        onDone();
      },
    });
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <SectionHeading>{component ? `Edit ${component.name}` : "Add an allowance or a deduction"}</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="comp-name">
          <Input id="comp-name" required maxLength={80} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={inputClass} />
        </Field>
        {component ? (
          <Field label="Code" hint="A code never changes: it names the line on every payslip.">
            <span className="pms-num flex h-10 items-center text-sm text-ink2">{component.code}</span>
          </Field>
        ) : (
          <Field label="Code" hint="Lower case, as it will name the payslip line: transport, union_dues." htmlFor="comp-code">
            <Input id="comp-code" required pattern="[a-z][a-z0-9_]{1,30}" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} className={inputClass} />
          </Field>
        )}
        <Field label="Kind">
          <SelectField
            label="Kind"
            value={d.kind}
            onChange={(v) => setD({ ...d, kind: v === "deduction" ? "deduction" : "allowance" })}
            options={[
              { value: "allowance", label: "An allowance, paid" },
              { value: "deduction", label: "A deduction, taken" },
            ]}
          />
        </Field>
        <Field label="How much">
          <SelectField
            label="How the amount is reached"
            value={d.amountType}
            onChange={(v) => setD({ ...d, amountType: (Object.keys(AMOUNT_TYPE).includes(v) ? v : "fixed") as PayAmountType })}
            options={(Object.keys(AMOUNT_TYPE) as PayAmountType[]).map((k) => ({ value: k, label: AMOUNT_TYPE[k] }))}
          />
        </Field>
        {percent ? (
          <Field label="Percentage" hint="Up to two decimals: 2.5 is 2.5%." htmlFor="comp-rate">
            <Input id="comp-rate" type="number" min={0.01} max={100} step={0.01} required value={d.rate} onChange={(e) => setD({ ...d, rate: e.target.value })} className={inputClass} />
          </Field>
        ) : (
          <Field label="Amount in RWF" htmlFor="comp-amount">
            <Input id="comp-amount" type="number" min={1} step={1} required value={d.amountRwf} onChange={(e) => setD({ ...d, amountRwf: e.target.value })} className={inputClass} />
          </Field>
        )}
        {d.amountType !== "fixed" && (
          <Field label="At most, in RWF" hint="Empty for no ceiling." htmlFor="comp-cap">
            <Input id="comp-cap" type="number" min={1} step={1} value={d.capRwf} onChange={(e) => setD({ ...d, capRwf: e.target.value })} className={inputClass} />
          </Field>
        )}
      </div>

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
          A one off, paid in one month only
        </Checkbox>
        {d.oneOff && (
          <Input aria-label="The month it pays in" type="month" value={d.oneOffPeriod ?? ""} onChange={(e) => e.target.value && setD({ ...d, oneOffPeriod: e.target.value })} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
        )}
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="text-sm font-semibold text-ink">Whom it reaches</legend>
        <Checkbox isSelected={d.appliesAllActive} onChange={(on) => setD({ ...d, appliesAllActive: on })} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
          Everybody active
        </Checkbox>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={d.appliesAllActive ? "And these people" : "These people"} hint="Besides the contracts whose structure carries it.">
            <PeoplePicker people={people} selected={d.include} onChange={(ids) => setD({ ...d, include: ids })} label="People it reaches" />
          </Field>
          <Field label="Leave out">
            <PeoplePicker people={people} selected={d.exclude} onChange={(ids) => setD({ ...d, exclude: ids })} label="People it never reaches" />
          </Field>
        </div>
        <ConditionField value={d.condition} onChange={(condition) => setD({ ...d, condition })} />
      </fieldset>

      <FormError error={save.error} />
      <div className="flex flex-wrap justify-end gap-2">
        {component && component.status === "active" && (
          <ActionButton
            type="button"
            pending={save.isPending && save.variables?.id === component.id && "status" in (save.variables?.body ?? {})}
            onClick={() =>
              save.mutate({ id: component.id, body: { status: "archived" } }, { onSuccess: () => { toast(`${component.name} archived`, "ok"); onDone(); } })
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
      <SectionHeading>{structure ? `Edit ${structure.name}` : "Add a pay structure"}</SectionHeading>
      <Field label="Name" htmlFor="structure-name">
        <Input id="structure-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
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
