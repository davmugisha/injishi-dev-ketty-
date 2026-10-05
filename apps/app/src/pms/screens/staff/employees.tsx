"use client";

/**
 * Staff · Employees (ADR-058, AC-P1 to AC-P3, AC-P5).
 *
 * Everyone on file at this business, with or without an account: the cook who
 * never signs in is here beside the receptionist who does. A file is not an
 * account and holds no role; the badge says which role an account holds, when
 * the file has one.
 *
 * **What a row shows depends on who is looking, and the SERVER decides it.**
 * `people.view` reads files without a date of birth, an ID, an RSSB number or
 * a wage; `people.manage` and `payroll.run` read them in full. The response
 * carries `view`, and this screen draws the wage column only for a full row,
 * so a manager's screen has no empty wage cell to wonder about.
 *
 * A file backfilled from a membership starts without its statutory details
 * (`detailsMissing`). The row says so, because a contract cannot start until
 * they are in.
 */

import { EMPLOYEE_MISSING_DETAIL_LABEL, type CreateEmployeeRequest, type Employee } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import Link from "next/link";
import { useState } from "react";

import {
  ActionButton,
  Badge,
  Chip,
  EmptyState,
  LoadFailed,
  SectionHeading,
  SelectField,
  Skeleton,
} from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useCreateEmployee, useEmployees } from "../../data/people";
import { dshortIso, fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  receptionist: "Receptionist",
  housekeeper: "Housekeeper",
};

const EMPTY_FORM = {
  legalName: "",
  preferredName: "",
  phone: "",
  dateOfBirth: "",
  sex: "",
  idDocumentType: "national_id",
  idDocumentNumber: "",
  hiredOn: "",
  workPropertyId: "",
  rssbNumber: "",
  email: "",
};

export function Employees() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const [filter, setFilter] = useState<"active" | "offboarded">("active");
  const [adding, setAdding] = useState(false);
  const query = useEmployees(workspaceId);
  const create = useCreateEmployee(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [form, setForm] = useState({ ...EMPTY_FORM, hiredOn: todayIso(), workPropertyId: branches[0]?.id ?? "" });
  const base = `${workspaceBase(workspaceId)}/staff`;
  const mayManage = can("people.manage");

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const body: CreateEmployeeRequest = {
      legalName: form.legalName,
      preferredName: form.preferredName.trim() || null,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      sex: form.sex as CreateEmployeeRequest["sex"],
      idDocumentType: form.idDocumentType as CreateEmployeeRequest["idDocumentType"],
      idDocumentNumber: form.idDocumentNumber,
      hiredOn: form.hiredOn,
      workPropertyId: form.workPropertyId,
      rssbNumber: form.rssbNumber.trim() || null,
      email: form.email.trim() || null,
    };
    create.mutate(body, {
      onSuccess: (e) => {
        toast(`${e.displayName} is on file as employee ${e.employeeNumber}`, "ok");
        setAdding(false);
        setForm({ ...EMPTY_FORM, hiredOn: todayIso(), workPropertyId: branches[0]?.id ?? "" });
      },
    });
  };

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={220} delay={60} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your staff files. They are all still there — this is on our side.
      </LoadFailed>
    );
  }

  const all = query.data;
  const shown = all.filter((e) => e.status === filter);
  const working = all.filter((e) => e.status === "active").length;
  const full = all.some((e) => e.view === "full");

  const row = (e: Employee, i: number) => {
    const contract = e.currentContract;
    return (
      <Link
        key={e.id}
        href={`${base}/${e.id}`}
        data-employee={e.employeeNumber}
        className={`${rowClass(i)} flex items-center gap-3 no-underline hover:bg-hover`}
      >
        <span className="pms-num w-14 shrink-0 text-2xs text-muted-foreground">{e.employeeNumber}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-ink">{e.displayName}</span>
          <span className="truncate text-2xs text-muted-foreground">
            {[e.jobPositionTitle, e.workPropertyName ?? "No branch yet", `since ${dshortIso(e.hiredOn)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {e.detailsMissing.length > 0 && (
          <Badge intent="warn">
            Missing {e.detailsMissing.map((d) => EMPLOYEE_MISSING_DETAIL_LABEL[d]).join(", ")}
          </Badge>
        )}
        {e.view === "full" ? (
          <span className="pms-num hidden w-32 shrink-0 text-right text-sm text-ink2 md:block">
            {e.currentContract ? fmt(e.currentContract.wageRwf) : "No contract"}
          </span>
        ) : (
          !contract && <span className="text-2xs text-muted-foreground">No contract</span>
        )}
        <Badge intent={e.hasAccount ? "info" : "neutral"}>
          {e.hasAccount && e.orgRole ? ROLE_LABEL[e.orgRole] : "No account"}
        </Badge>
      </Link>
    );
  };

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Everyone who works here, whether or not they ever sign in. A role comes with an account;
          pay comes with a contract.
        </span>
        {mayManage && !adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Put someone on file
          </ActionButton>
        )}
      </div>

      {adding && (
        <form
          className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
          onSubmit={(ev) => {
            ev.preventDefault();
            submit();
          }}
        >
          <SectionHeading>New staff file</SectionHeading>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Legal name" hint="As it is written on the ID." htmlFor="hr-legal-name">
              <Input id="hr-legal-name" required value={form.legalName} onChange={(e) => set("legalName")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Called" hint="Optional. What colleagues call them." htmlFor="hr-preferred">
              <Input id="hr-preferred" value={form.preferredName} onChange={(e) => set("preferredName")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone" htmlFor="hr-phone">
              <Input id="hr-phone" required inputMode="tel" placeholder="0788 123 456" value={form.phone} onChange={(e) => set("phone")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Date of birth" htmlFor="hr-dob">
              <Input id="hr-dob" required type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Sex">
              <SelectField
                label="Sex"
                value={form.sex}
                onChange={set("sex")}
                placeholder="Choose"
                options={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                ]}
              />
            </Field>
            <Field label="ID document">
              <SelectField
                label="ID document"
                value={form.idDocumentType}
                onChange={set("idDocumentType")}
                options={[
                  { value: "national_id", label: "National ID" },
                  { value: "passport", label: "Passport" },
                ]}
              />
            </Field>
            <Field label="ID number" htmlFor="hr-id-number">
              <Input id="hr-id-number" required value={form.idDocumentNumber} onChange={(e) => set("idDocumentNumber")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="RSSB number" hint="Optional now; pay cannot be confirmed without it." htmlFor="hr-rssb">
              <Input id="hr-rssb" value={form.rssbNumber} onChange={(e) => set("rssbNumber")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Hired on" htmlFor="hr-hired">
              <Input id="hr-hired" required type="date" value={form.hiredOn} onChange={(e) => set("hiredOn")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Works at">
              <SelectField
                label="Works at"
                value={form.workPropertyId}
                onChange={set("workPropertyId")}
                placeholder="Choose a branch"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
            <Field label="Email" hint="Optional." htmlFor="hr-email">
              <Input id="hr-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <FormError error={create.error} />
          <div className="flex justify-end gap-2">
            <ActionButton type="button" onClick={() => setAdding(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" pending={create.isPending}>
              {create.isPending ? "Saving" : "Put on file"}
            </ActionButton>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "active"} onClick={() => setFilter("active")} n={working} label="Working here" />
        <Chip
          active={filter === "offboarded"}
          onClick={() => setFilter("offboarded")}
          n={all.length - working}
          label="Left"
        />
      </div>

      <section>
        <SectionHeading n={shown.length}>{filter === "active" ? "Working here" : "No longer here"}</SectionHeading>
        {shown.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            {filter === "active"
              ? mayManage
                ? "Nobody is on file yet. Put your first person on file to roster and pay them."
                : "Nobody is on file yet. The owner puts people on file."
              : "Nobody has left yet. A file is kept when someone leaves, so their history stays."}
          </EmptyState>
        ) : (
          <RowList>{shown.map((e, i) => row(e, i))}</RowList>
        )}
      </section>

      {!full && (
        <p className="text-2xs text-muted-foreground">
          Dates of birth, ID and RSSB numbers and wages are shown only to people who manage staff files
          or run payroll.
        </p>
      )}
    </div>
  );
}
