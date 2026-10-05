"use client";

/**
 * Leave · Leave types (058-leave AC-LV1, AC-LV12).
 *
 * Every type the business offers, with all its rules: how it is paid, how its
 * days are earned and reset, what carries into the next year and for how long,
 * how many people approve it, what it asks for and who may take it. Whoever
 * keeps the files (`people.manage`) edits them; an edit applies to requests
 * made after it, because a request copies its type's steps and pay terms as it
 * is made. A type is archived, never deleted.
 *
 * Below the types, the national defaults row in force compared with them: a
 * type the business does not have yet, a rule that differs. Taking them adds
 * the missing types and moves the rules from now on, and rewrites no ledger
 * row: an accrual already written stays as it was.
 */

import type { CreateLeaveTypeRequest, LeaveType, UpdateLeaveTypeRequest } from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useState, type ReactNode } from "react";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, LoadFailed, SectionHeading, SelectField, Skeleton } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useApplyLeaveDefaults, useCreateLeaveType, useLeaveDefaultsDiff, useLeaveTypes, useUpdateLeaveType } from "../../data/leave";
import { usePms } from "../../store";
import { typeTermsText } from "./leave-ui";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

type Rules = Omit<CreateLeaveTypeRequest, "code">;

const BLANK: Rules = {
  name: "",
  payment: "paid",
  paymentPercent: null,
  yearlyEntitlementDays: 12,
  accrual: "yearly_upfront",
  reset: "yearly",
  carry: "none",
  carryMaxDays: 0,
  carryExpiresMonths: null,
  approvalSteps: 1,
  needsAttachment: false,
  countsWeeklyOffs: false,
  countsHolidays: false,
  eligibleSex: null,
  minServiceMonths: 0,
  oncePerEmployment: false,
  statutory: false,
  allowsPastRequests: false,
  encashable: false,
  compensatory: false,
  seniorityEveryYears: null,
  seniorityExtraDays: null,
  seniorityCapDays: null,
};

/** What each rule is called where the defaults comparison names it. */
const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  payment: "Pay",
  paymentPercent: "Share paid",
  yearlyEntitlementDays: "Days a year",
  accrual: "Earned",
  reset: "Resets",
  carry: "Carry over",
  carryMaxDays: "Most days carried",
  carryExpiresMonths: "Carried days last (months)",
  approvalSteps: "Approvals",
  needsAttachment: "Needs a note",
  countsWeeklyOffs: "Counts weekly days off",
  countsHolidays: "Counts holidays",
  eligibleSex: "Who may take it",
  minServiceMonths: "Months of service first",
  oncePerEmployment: "Once per employment",
  statutory: "Statutory",
  allowsPastRequests: "May start in the past",
  encashable: "May be paid out",
  compensatory: "Takes days in lieu",
  seniorityEveryYears: "Seniority: every N years",
  seniorityExtraDays: "Seniority: extra days",
  seniorityCapDays: "Seniority: most extra days",
};

const shown = (v: string | number | boolean | null): string => (v === null ? "none" : v === true ? "yes" : v === false ? "no" : String(v));

export function LeaveTypes() {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const types = useLeaveTypes(workspaceId);
  const update = useUpdateLeaveType(workspaceId);
  const [editing, setEditing] = useState<LeaveType | "new" | null>(null);
  const mayManage = can("people.manage");

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          A change applies to requests made after it. Requests already made keep the steps and pay they were made
          under, and nothing already earned or taken is rewritten.
        </span>
        {mayManage && editing === null && (
          <ActionButton variant="primary" onClick={() => setEditing("new")}>
            Add a type
          </ActionButton>
        )}
      </div>

      {editing !== null && <TypeForm type={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}

      <section className="flex flex-col gap-2">
        <SectionHeading n={types.data?.length}>Leave types</SectionHeading>
        {types.isPending ? (
          <Skeleton height={120} />
        ) : types.isError ? (
          <LoadFailed onRetry={() => void types.refetch()} retrying={types.isFetching}>
            We couldn&apos;t load the leave types. If the leave rules are not set up yet, there are none to show.
          </LoadFailed>
        ) : (
          <RowList>
            {types.data.map((t, i) => (
              <div key={t.id} className={`${rowClass(i)} flex flex-wrap items-start justify-between gap-3`} data-leave-type={t.code}>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{t.name}</span>
                    {t.status === "archived" && <Badge intent="neutral">Archived</Badge>}
                    {t.statutory && <Badge intent="info">Statutory</Badge>}
                    {t.compensatory && <Badge intent="info">Days in lieu</Badge>}
                  </span>
                  <span className="text-2xs text-muted-foreground">{typeTermsText(t)}</span>
                </span>
                {mayManage && (
                  <span className="flex gap-2">
                    <ActionButton onClick={() => setEditing(t)}>Edit</ActionButton>
                    {t.status === "active" ? (
                      <ConfirmAction
                        confirmLabel="Yes, stop offering it"
                        pending={update.isPending && update.variables?.id === t.id}
                        onConfirm={() =>
                          update.mutate({ id: t.id, body: { status: "archived" } }, { onSuccess: () => toast(`${t.name} archived`, "ok") })
                        }
                      >
                        Archive
                      </ConfirmAction>
                    ) : (
                      <ActionButton
                        pending={update.isPending && update.variables?.id === t.id}
                        onClick={() => update.mutate({ id: t.id, body: { status: "active" } }, { onSuccess: () => toast(`${t.name} offered again`, "ok") })}
                      >
                        Offer again
                      </ActionButton>
                    )}
                  </span>
                )}
              </div>
            ))}
          </RowList>
        )}
        <FormError error={update.error} />
      </section>

      {mayManage && <NationalDefaults />}
    </div>
  );
}

function NationalDefaults() {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const diff = useLeaveDefaultsDiff(workspaceId, true);
  const apply = useApplyLeaveDefaults(workspaceId);
  const [picked, setPicked] = useState<string[] | null>(null);
  if (diff.isPending) return <Skeleton height={60} />;
  if (diff.isError) {
    return (
      <LoadFailed onRetry={() => void diff.refetch()} retrying={diff.isFetching}>
        We couldn&apos;t read the national defaults.
      </LoadFailed>
    );
  }
  const d = diff.data;
  const codes = [...new Set([...d.missing.map((m) => m.code), ...d.changed.map((c) => c.code)])];
  const chosen = picked ?? codes;
  return (
    <section aria-label="The national defaults" className="flex flex-col gap-2">
      <SectionHeading>The national defaults (version {d.version})</SectionHeading>
      {codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your types match the national defaults in force.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            The defaults in force differ from your types. Tick what to take: a missing type is added, a present one takes
            these rules from now on. Nothing is deleted, and nothing already earned or taken changes.
          </p>
          <RowList>
            {codes.map((code, i) => {
              const missing = d.missing.find((m) => m.code === code);
              const changes = d.changed.filter((c) => c.code === code);
              return (
                <div key={code} className={rowClass(i)}>
                  <Checkbox
                    isSelected={chosen.includes(code)}
                    onChange={(on: boolean) => setPicked(on ? [...chosen, code] : chosen.filter((c) => c !== code))}
                    className="flex w-full items-start gap-2.5 text-sm font-normal text-ink"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{missing ? `Add ${missing.name}` : (changes[0]?.name ?? code)}</span>
                      {changes.map((c) => (
                        <span key={c.field} className="text-2xs text-muted-foreground">
                          {FIELD_LABEL[c.field] ?? c.field}: {shown(c.current)} now, {shown(c.defaults)} in the defaults
                        </span>
                      ))}
                    </span>
                  </Checkbox>
                </div>
              );
            })}
          </RowList>
          <FormError error={apply.error} />
          <div className="flex justify-end">
            <ActionButton
              variant="primary"
              pending={apply.isPending}
              onClick={() =>
                chosen.length > 0 &&
                apply.mutate({ codes: chosen }, { onSuccess: () => toast("Taken from the national defaults", "ok") })
              }
            >
              Take the ticked ones
            </ActionButton>
          </div>
        </>
      )}
    </section>
  );
}

function TypeForm({ type, onDone }: { type: LeaveType | null; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const create = useCreateLeaveType(workspaceId);
  const update = useUpdateLeaveType(workspaceId);
  const [code, setCode] = useState("");
  const [rules, setRules] = useState<Rules>(() => (type ? rulesOf(type) : BLANK));
  const set = <K extends keyof Rules>(key: K, value: Rules[K]) => setRules((r) => ({ ...r, [key]: value }));
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  const error = create.error ?? update.error;
  const keepsBalance = rules.yearlyEntitlementDays !== null;

  const submit = () => {
    const body: Rules = {
      ...rules,
      name: rules.name.trim(),
      paymentPercent: rules.payment === "partial" ? (rules.paymentPercent ?? 50) : null,
      carry: rules.reset === "yearly" ? rules.carry : "none",
      carryMaxDays: rules.carry === "none" ? 0 : rules.carryMaxDays,
    };
    if (type) {
      update.mutate(
        { id: type.id, body: body as UpdateLeaveTypeRequest },
        {
          onSuccess: (t) => {
            toast(`${t.name} saved`, "ok");
            onDone();
          },
        },
      );
    } else {
      create.mutate(
        { ...body, code: code.trim() },
        {
          onSuccess: (t) => {
            toast(`${t.name} added`, "ok");
            onDone();
          },
        },
      );
    }
  };

  return (
    <form
      className="flex flex-col gap-5 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <SectionHeading>{type ? `Edit ${type.name}` : "Add a leave type"}</SectionHeading>
      <Group title="Name">
        <Field label="Name" htmlFor="lt-name">
          <Input id="lt-name" required maxLength={80} value={rules.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
        </Field>
        {!type && (
          <Field label="Code" hint="Lower case letters, digits and underscores; fixed once made." htmlFor="lt-code">
            <Input id="lt-code" required pattern="[a-z][a-z0-9_]{1,30}" value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </Field>
        )}
      </Group>

      <Group title="Pay">
        <Field label="Paid">
          <SelectField
            label="How it is paid"
            value={rules.payment}
            onChange={(v) => set("payment", v as Rules["payment"])}
            options={[
              { value: "paid", label: "Paid" },
              { value: "partial", label: "Partly paid" },
              { value: "unpaid", label: "Unpaid" },
            ]}
          />
        </Field>
        {rules.payment === "partial" && (
          <Field label="Share paid (%)" htmlFor="lt-pct">
            <Input id="lt-pct" type="number" min={0} max={100} required value={rules.paymentPercent ?? ""} onChange={(e) => set("paymentPercent", num(e.target.value))} className={inputClass} />
          </Field>
        )}
      </Group>

      <Group title="Days">
        <Field label="Balance">
          <SelectField
            label="Is a balance kept"
            value={keepsBalance ? "kept" : "none"}
            onChange={(v) => setRules((r) => ({ ...r, yearlyEntitlementDays: v === "kept" ? (r.yearlyEntitlementDays ?? 12) : null, accrual: v === "kept" ? r.accrual : "none" }))}
            options={[
              { value: "kept", label: "A balance is kept" },
              { value: "none", label: "No balance, as for unpaid leave" },
            ]}
          />
        </Field>
        {keepsBalance && (
          <>
            <Field label="Days a year" htmlFor="lt-days">
              <Input id="lt-days" type="number" min={0} max={366} step={0.5} required value={rules.yearlyEntitlementDays ?? ""} onChange={(e) => set("yearlyEntitlementDays", num(e.target.value) ?? 0)} className={inputClass} />
            </Field>
            <Field label="Earned">
              <SelectField
                label="How days are earned"
                value={rules.accrual}
                onChange={(v) => set("accrual", v as Rules["accrual"])}
                options={[
                  { value: "yearly_upfront", label: "All at the start of the year" },
                  { value: "monthly", label: "A twelfth each month" },
                  { value: "none", label: "Never: only days added by hand" },
                ]}
              />
            </Field>
            <Field label="Resets">
              <SelectField
                label="When unused days end"
                value={rules.reset}
                onChange={(v) => set("reset", v as Rules["reset"])}
                options={[
                  { value: "yearly", label: "At the end of each year" },
                  { value: "monthly", label: "At the end of each month" },
                  { value: "never", label: "Never" },
                ]}
              />
            </Field>
            {rules.reset === "yearly" && (
              <Field label="Carry over">
                <SelectField
                  label="Carry over"
                  value={rules.carry}
                  onChange={(v) => set("carry", v as Rules["carry"])}
                  options={[
                    { value: "none", label: "Nothing carries" },
                    { value: "carry", label: "Some days carry" },
                    { value: "carry_with_expiry", label: "Some days carry, for some months" },
                  ]}
                />
              </Field>
            )}
            {rules.reset === "yearly" && rules.carry !== "none" && (
              <Field label="Most days carried" htmlFor="lt-carry">
                <Input id="lt-carry" type="number" min={0} max={366} step={0.5} value={rules.carryMaxDays} onChange={(e) => set("carryMaxDays", num(e.target.value) ?? 0)} className={inputClass} />
              </Field>
            )}
            {((rules.reset === "yearly" && rules.carry === "carry_with_expiry") || rules.compensatory) && (
              <Field label={rules.compensatory ? "Days in lieu last (months)" : "Carried days last (months)"} htmlFor="lt-months">
                <Input id="lt-months" type="number" min={1} max={12} required={rules.carry === "carry_with_expiry"} value={rules.carryExpiresMonths ?? ""} onChange={(e) => set("carryExpiresMonths", num(e.target.value))} className={inputClass} />
              </Field>
            )}
          </>
        )}
      </Group>

      <Group title="Approval and what it asks for">
        <Field label="Approvals">
          <SelectField
            label="Approvals"
            value={String(rules.approvalSteps)}
            onChange={(v) => set("approvalSteps", Number(v))}
            options={[
              { value: "0", label: "None: approved as it is asked" },
              { value: "1", label: "One person" },
              { value: "2", label: "Two different people" },
            ]}
          />
        </Field>
        <Flags>
          <Flag on={rules.needsAttachment} onChange={(v) => set("needsAttachment", v)}>Needs a note, such as a doctor&apos;s</Flag>
          <Flag on={rules.allowsPastRequests} onChange={(v) => set("allowsPastRequests", v)}>May start up to 30 days back</Flag>
          <Flag on={rules.countsWeeklyOffs} onChange={(v) => set("countsWeeklyOffs", v)}>Counts weekly days off inside its range</Flag>
          <Flag on={rules.countsHolidays} onChange={(v) => set("countsHolidays", v)}>Counts holidays inside its range</Flag>
        </Flags>
      </Group>

      <Group title="Who may take it">
        <Field label="Who">
          <SelectField
            label="Who may take it"
            value={rules.eligibleSex ?? ""}
            onChange={(v) => set("eligibleSex", v === "" ? null : (v as "female" | "male"))}
            options={[
              { value: "", label: "Anyone" },
              { value: "female", label: "Women" },
              { value: "male", label: "Men" },
            ]}
          />
        </Field>
        <Field label="Months of service first" htmlFor="lt-service">
          <Input id="lt-service" type="number" min={0} max={600} value={rules.minServiceMonths} onChange={(e) => set("minServiceMonths", num(e.target.value) ?? 0)} className={inputClass} />
        </Field>
        <Flags>
          <Flag on={rules.oncePerEmployment} onChange={(v) => set("oncePerEmployment", v)}>Once per employment</Flag>
          <Flag on={rules.statutory} onChange={(v) => set("statutory", v)}>Statutory: never restricted</Flag>
          <Flag on={rules.encashable} onChange={(v) => set("encashable", v)}>Unused days may be paid out</Flag>
          <Flag on={rules.compensatory} onChange={(v) => set("compensatory", v)}>Takes days in lieu (only one type does)</Flag>
        </Flags>
      </Group>

      {keepsBalance && (
        <Group title="Seniority (optional)">
          <Field label="Every N years of service" htmlFor="lt-sen-years">
            <Input id="lt-sen-years" type="number" min={1} max={50} value={rules.seniorityEveryYears ?? ""} onChange={(e) => set("seniorityEveryYears", num(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Extra days a year" htmlFor="lt-sen-days">
            <Input id="lt-sen-days" type="number" min={0} max={366} step={0.5} value={rules.seniorityExtraDays ?? ""} onChange={(e) => set("seniorityExtraDays", num(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Most extra days" htmlFor="lt-sen-cap">
            <Input id="lt-sen-cap" type="number" min={0} max={366} step={0.5} value={rules.seniorityCapDays ?? ""} onChange={(e) => set("seniorityCapDays", num(e.target.value))} className={inputClass} />
          </Field>
        </Group>
      )}

      <FormError error={error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending || update.isPending}>
          {type ? "Save" : "Add the type"}
        </ActionButton>
      </div>
    </form>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold text-ink">{title}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Flags({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 md:col-span-2">{children}</div>;
}

function Flag({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Checkbox isSelected={on} onChange={(v: boolean) => onChange(v)} className="flex w-full items-center gap-2.5 text-sm font-normal text-ink">
      {children}
    </Checkbox>
  );
}

function rulesOf(t: LeaveType): Rules {
  const { id: _id, code: _code, status: _status, ...rules } = t;
  void _id;
  void _code;
  void _status;
  return rules;
}
