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
 *
 * The list is the shared `DataView` over `EMPLOYEE_LIST` (058-list-framework):
 * search, filters, sort, grouping, the card view, saved views and the CSV
 * export, all in the URL. What a reader may filter or sort follows their file
 * view, and the server refuses the rest.
 */

import {
  EMPLOYEE_LIST,
  EMPLOYEE_MISSING_DETAIL_LABEL,
  EmployeePage,
  LIST_READ,
  type CreateEmployeeRequest,
  type Employee,
} from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { downloadListCsv, useListPage, useListUrl, useSavedViewsFor } from "../../data/lists";
import { useCreateEmployee } from "../../data/people";
import { dshortIso, fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, inputClass } from "./staff-ui";

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
  const [adding, setAdding] = useState(false);
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

  // The file view decides what a reader may filter, sort and see; the server
  // decides what it sends, so this only keeps the screen from asking for more.
  const view = can("people.manage") || can("payroll.run") ? "full" : "basic";
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, EMPLOYEE_LIST.key);
  const list = useListUrl(EMPLOYEE_LIST, view, defaultView);
  const page = useListPage(
    workspaceId,
    "employees",
    "/ops/employees",
    list.state.query,
    EmployeePage,
    LIST_READ["staff.employees"],
  );
  const columns = useMemo(() => employeeColumns(base, view === "full"), [base, view]);

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

      <DataView
        spec={EMPLOYEE_LIST}
        reader={view}
        state={list.state}
        onStateChange={list.setState}
        dropped={list.dropped}
        onDismissDropped={list.dismissDropped}
        page={page.data}
        status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
        onRetry={() => void page.refetch()}
        columns={columns}
        defaultColumns={["employeeNumber", "name", "branch", "hiredOn", "status", "account", "details"]}
        getRowId={(e) => e.id}
        labelOf={(e) => e.displayName}
        groupKeyOf={employeeGroupKey}
        caption="Staff files"
        searchPlaceholder="Search name, number or phone"
        refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
        card={(e) => (
          <Link href={`${base}/${e.id}`} className="flex flex-col gap-1 no-underline">
            <span className="text-sm font-semibold text-foreground">{e.displayName}</span>
            <span className="text-2xs text-muted-foreground">
              {[e.employeeNumber, e.jobPositionTitle, e.workPropertyName ?? "No branch yet"].filter(Boolean).join(" · ")}
            </span>
            <span className="flex flex-wrap gap-1.5 pt-1">
              <Badge intent={e.hasAccount ? "info" : "neutral"}>
                {e.hasAccount && e.orgRole ? ROLE_LABEL[e.orgRole] : "No account"}
              </Badge>
              {e.detailsMissing.length > 0 && <Badge intent="warn">Details missing</Badge>}
            </span>
          </Link>
        )}
        savedViews={savedViews}
        onExport={(shown) => void downloadListCsv(workspaceId as string, "/ops/employees", list.state.query, shown)}
        empty={{
          title: "Nobody is on file yet",
          body: mayManage
            ? "Put your first person on file to roster and pay them."
            : "The owner puts people on file.",
          action:
            mayManage && !adding ? (
              <ActionButton variant="primary" onClick={() => setAdding(true)}>
                Put someone on file
              </ActionButton>
            ) : undefined,
        }}
      />

      {view === "basic" && (
        <p className="text-2xs text-muted-foreground">
          Dates of birth, ID and RSSB numbers and wages are shown only to people who manage staff files
          or run payroll.
        </p>
      )}
    </div>
  );
}

/** How the server keys each groupable field of a file, so a grouped page heads its groups. */
function employeeGroupKey(e: Employee, field: string): string | null {
  switch (field) {
    case "status":
      return e.status;
    case "branch":
      return e.workPropertyId;
    case "jobPosition":
      return e.jobPositionId;
    case "hasAccount":
      return String(e.hasAccount);
    default:
      return null;
  }
}

/**
 * The Employees columns. Keys that name an `EMPLOYEE_LIST` field sort by it when
 * the spec allows; the wage column exists only for a full reader, because a
 * `people.view` row carries no wage to show.
 */
function employeeColumns(base: string, full: boolean): DataColumn<Employee>[] {
  return [
    {
      key: "employeeNumber",
      header: "Number",
      cell: (e) => <span className="pms-num text-2xs text-muted-foreground">{e.employeeNumber}</span>,
    },
    {
      key: "name",
      header: "Name",
      cell: (e) => (
        <Link href={`${base}/${e.id}`} data-employee={e.employeeNumber} className="font-semibold text-foreground no-underline hover:underline">
          {e.displayName}
        </Link>
      ),
    },
    { key: "jobPosition", header: "Position", cell: (e) => e.jobPositionTitle ?? "None yet" },
    { key: "branch", header: "Branch", cell: (e) => e.workPropertyName ?? "No branch yet" },
    { key: "hiredOn", header: "Hired", cell: (e) => <span className="pms-num">{dshortIso(e.hiredOn)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (e) => <Badge intent={e.status === "active" ? "ok" : "neutral"}>{e.status === "active" ? "Working" : "Left"}</Badge>,
    },
    {
      key: "account",
      header: "Account",
      cell: (e) => (
        <Badge intent={e.hasAccount ? "info" : "neutral"}>
          {e.hasAccount && e.orgRole ? ROLE_LABEL[e.orgRole] : "No account"}
        </Badge>
      ),
    },
    {
      key: "details",
      header: "Details",
      cell: (e) =>
        e.detailsMissing.length > 0 ? (
          <Badge intent="warn">Missing {e.detailsMissing.map((d) => EMPLOYEE_MISSING_DETAIL_LABEL[d]).join(", ")}</Badge>
        ) : (
          <span className="text-2xs text-muted-foreground">Complete</span>
        ),
    },
    ...(full
      ? [
          {
            key: "wage",
            header: "Wage",
            align: "end" as const,
            cell: (e: Employee) =>
              e.view === "full" && e.currentContract ? fmt(e.currentContract.wageRwf) : "No contract",
          },
        ]
      : []),
  ];
}
