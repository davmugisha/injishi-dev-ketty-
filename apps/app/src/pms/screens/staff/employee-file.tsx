"use client";

/**
 * One staff file (ADR-058, AC-P2, AC-P4, AC-P6, AC-O1, AC-O2).
 *
 * The record page for a person on file: their details, their contracts, the
 * departments they are on, their leave balances, and the one step that takes
 * them off the business.
 *
 * **The sensitive fields appear only when the server sent them.** A manager
 * reading this page gets the basic file, which has no date of birth, ID, RSSB
 * number or wage to show, so those rows are absent rather than blank.
 *
 * **Offboarding a person with an account is the owner's.** It removes their
 * access, which is `team.manage`, and that cannot be granted. A manager given
 * `people.manage` can offboard staff who never had an account; the button says
 * why when it will be refused.
 */

import type {
  ContractType,
  EmployeeFile as EmployeeFileData,
  UpdateEmployeeRequest,
} from "@injishi/contracts";
import { EMPLOYEE_MISSING_DETAIL_LABEL } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useState, type ReactNode } from "react";

import { ObjectPage } from "../../components/object-page";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  SelectField,
  Skeleton,
} from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import {
  useCreateContract,
  useEmployeeFile,
  useLeaveBalances,
  useOffboard,
  useUpdateEmployee,
} from "../../data/people";
import { dshortIso, fmt, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, RowList, daysText, inputClass, rowClass } from "./staff-ui";

const CONTRACT_TYPE: Record<ContractType, string> = {
  permanent: "Permanent",
  fixed_term: "Fixed term",
  casual: "Casual",
};

export function EmployeeFile({ employeeId }: { employeeId: string }) {
  const workspaceId = useWorkspaceId();
  const query = useEmployeeFile(workspaceId, employeeId);

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={260} delay={60} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load this file. Nothing on it has changed — this is on our side.
      </LoadFailed>
    );
  }
  return <FileBody file={query.data} />;
}

function FileBody({ file }: { file: EmployeeFileData }) {
  const { employee: e, contracts, departments } = file;
  const { can } = useCapability();
  const mayManage = can("people.manage");
  const left = e.status === "offboarded";

  return (
    <ObjectPage
      title={e.displayName}
      subtitle={`Employee ${e.employeeNumber} · ${e.workPropertyName ?? "No branch yet"} · hired ${dshortIso(e.hiredOn)}`}
      status={left ? { label: `Left ${dshortIso(e.offboardedOn ?? "")}`, intent: "neutral" } : { label: "Working here", intent: "ok" }}
      lenses={[]}
      active=""
    >
      <div className="mt-5 flex max-w-wide flex-col gap-6">
        {e.detailsMissing.length > 0 && (
          <div role="status" className="rounded-card border border-card-bd bg-warn-bg px-5 py-4 text-sm text-ink">
            This file is missing {e.detailsMissing.map((d) => EMPLOYEE_MISSING_DETAIL_LABEL[d]).join(", ")}.
            {mayManage ? " Add them below before a contract can start." : " Someone who manages staff files can add them."}
          </div>
        )}
        <Details file={file} mayManage={mayManage && !left} />
        <Contracts employeeId={e.id} contracts={contracts} mayManage={mayManage && !left} hiredOn={e.hiredOn} />
        <section>
          <SectionHeading n={departments.length}>Departments</SectionHeading>
          {departments.length === 0 ? (
            <EmptyState className="mt-2.5 p-5">Not on any department yet.</EmptyState>
          ) : (
            <RowList>
              {departments.map((d, i) => (
                <div key={d.departmentId} className={`${rowClass(i)} flex items-center justify-between`}>
                  <span className="text-sm text-ink">{d.name}</span>
                  <Badge>{d.departmentPosition.replace("_", " ")}</Badge>
                </div>
              ))}
            </RowList>
          )}
        </section>
        <Balances employeeId={e.id} />
        {!left && mayManage && <Offboard file={file} />}
        {left && e.offboardReason && (
          <p className="text-sm text-muted-foreground">Left on {dshortIso(e.offboardedOn ?? "")}: {e.offboardReason}</p>
        )}
      </div>
    </ObjectPage>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function Details({ file, mayManage }: { file: EmployeeFileData; mayManage: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const update = useUpdateEmployee(workspaceId);
  const e = file.employee;
  const full = e.view === "full" ? e : null;
  const branches = currentGrant(state)?.branches ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    preferredName: e.preferredName ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    dateOfBirth: full?.dateOfBirth ?? "",
    sex: e.sex ?? "",
    idDocumentType: full?.idDocumentType ?? "national_id",
    idDocumentNumber: full?.idDocumentNumber ?? "",
    rssbNumber: full?.rssbNumber ?? "",
    workPropertyId: e.workPropertyId ?? "",
  });
  const set = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    // Only what changed, so an edit never rewrites a value nobody touched.
    const patch: UpdateEmployeeRequest = {};
    if (draft.preferredName !== (e.preferredName ?? "")) patch.preferredName = draft.preferredName.trim() || null;
    if (draft.phone && draft.phone !== (e.phone ?? "")) patch.phone = draft.phone;
    if (draft.email !== (e.email ?? "")) patch.email = draft.email.trim() || null;
    if (draft.dateOfBirth && draft.dateOfBirth !== (full?.dateOfBirth ?? "")) patch.dateOfBirth = draft.dateOfBirth;
    if (draft.sex && draft.sex !== (e.sex ?? "")) patch.sex = draft.sex as UpdateEmployeeRequest["sex"];
    if (
      draft.idDocumentNumber &&
      (draft.idDocumentNumber !== (full?.idDocumentNumber ?? "") || draft.idDocumentType !== (full?.idDocumentType ?? ""))
    ) {
      patch.idDocumentType = draft.idDocumentType as UpdateEmployeeRequest["idDocumentType"];
      patch.idDocumentNumber = draft.idDocumentNumber;
    }
    if (draft.rssbNumber !== (full?.rssbNumber ?? "")) patch.rssbNumber = draft.rssbNumber.trim() || null;
    if (draft.workPropertyId && draft.workPropertyId !== (e.workPropertyId ?? "")) patch.workPropertyId = draft.workPropertyId;
    if (Object.keys(patch).length === 0) return setEditing(false);
    update.mutate(
      { id: e.id, patch },
      {
        onSuccess: () => {
          toast("File updated", "ok");
          setEditing(false);
        },
      },
    );
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeading>Details</SectionHeading>
        {mayManage && !editing && e.view === "full" && (
          <ActionButton onClick={() => setEditing(true)}>Edit details</ActionButton>
        )}
      </div>
      {!editing ? (
        <dl className="mt-2.5 grid gap-4 rounded-card border border-card-bd bg-card p-5 md:grid-cols-3">
          <Row label="Legal name">{e.legalName}</Row>
          <Row label="Phone">{e.phone ?? "—"}</Row>
          <Row label="Email">{e.email ?? "—"}</Row>
          <Row label="Sex">{e.sex ? (e.sex === "female" ? "Female" : "Male") : "—"}</Row>
          <Row label="Reports to">{e.reportingManagerName ?? "Nobody named"}</Row>
          <Row label="Account">{e.hasAccount ? `Signs in (${e.orgRole ?? "role"})` : "No account"}</Row>
          {full && (
            <>
              <Row label="Date of birth">{full.dateOfBirth ? dshortIso(full.dateOfBirth) + " " + full.dateOfBirth.slice(0, 4) : "—"}</Row>
              <Row label="ID">
                {full.idDocumentNumber
                  ? `${full.idDocumentType === "passport" ? "Passport" : "National ID"} ${full.idDocumentNumber}`
                  : "—"}
              </Row>
              <Row label="RSSB number">{full.rssbNumber ?? "Not recorded"}</Row>
            </>
          )}
        </dl>
      ) : (
        <form
          className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
          onSubmit={(ev) => {
            ev.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Called" htmlFor="hr-edit-preferred">
              <Input id="hr-edit-preferred" value={draft.preferredName} onChange={(ev) => set("preferredName")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone" htmlFor="hr-edit-phone">
              <Input id="hr-edit-phone" inputMode="tel" value={draft.phone} onChange={(ev) => set("phone")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Email" htmlFor="hr-edit-email">
              <Input id="hr-edit-email" type="email" value={draft.email} onChange={(ev) => set("email")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Date of birth" htmlFor="hr-edit-dob">
              <Input id="hr-edit-dob" type="date" value={draft.dateOfBirth} onChange={(ev) => set("dateOfBirth")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Sex">
              <SelectField
                label="Sex"
                value={draft.sex}
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
                value={draft.idDocumentType}
                onChange={set("idDocumentType")}
                options={[
                  { value: "national_id", label: "National ID" },
                  { value: "passport", label: "Passport" },
                ]}
              />
            </Field>
            <Field label="ID number" htmlFor="hr-edit-id">
              <Input id="hr-edit-id" value={draft.idDocumentNumber} onChange={(ev) => set("idDocumentNumber")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="RSSB number" htmlFor="hr-edit-rssb">
              <Input id="hr-edit-rssb" value={draft.rssbNumber} onChange={(ev) => set("rssbNumber")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Works at">
              <SelectField
                label="Works at"
                value={draft.workPropertyId}
                onChange={set("workPropertyId")}
                placeholder="Choose a branch"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
          </div>
          <FormError error={update.error} />
          <div className="flex justify-end gap-2">
            <ActionButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" pending={update.isPending}>
              {update.isPending ? "Saving" : "Save details"}
            </ActionButton>
          </div>
        </form>
      )}
    </section>
  );
}

function Contracts({
  employeeId,
  contracts,
  mayManage,
  hiredOn,
}: {
  employeeId: string;
  contracts: EmployeeFileData["contracts"];
  mayManage: boolean;
  hiredOn: string;
}) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const create = useCreateContract(workspaceId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ contractType: "permanent", startsOn: todayIso() < hiredOn ? hiredOn : todayIso(), endsOn: "", wage: "" });

  const submit = () => {
    create.mutate(
      {
        id: employeeId,
        body: {
          contractType: draft.contractType as ContractType,
          startsOn: draft.startsOn,
          endsOn: draft.endsOn || null,
          wageBasis: "monthly",
          wageRwf: Number(draft.wage.replace(/[^\d]/g, "")),
        },
      },
      {
        onSuccess: (r) => {
          toast(
            r.shortened ? `New contract saved; the previous one now ends ${dshortIso(r.shortened.endsOn ?? "")}` : "Contract saved",
            "ok",
          );
          setOpen(false);
        },
      },
    );
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeading n={contracts.length}>Contracts</SectionHeading>
        {mayManage && !open && <ActionButton onClick={() => setOpen(true)}>New contract</ActionButton>}
      </div>
      {open && (
        <form
          className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
          onSubmit={(ev) => {
            ev.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <SelectField
                label="Contract type"
                value={draft.contractType}
                onChange={(v) => setDraft({ ...draft, contractType: v })}
                options={[
                  { value: "permanent", label: "Permanent" },
                  { value: "fixed_term", label: "Fixed term" },
                  { value: "casual", label: "Casual" },
                ]}
              />
            </Field>
            <Field label="Monthly wage (RWF)" hint="Daily and hourly pay come with the next payroll release." htmlFor="hr-wage">
              <Input id="hr-wage" required inputMode="numeric" value={draft.wage} onChange={(ev) => setDraft({ ...draft, wage: ev.target.value })} className={inputClass} />
            </Field>
            <Field label="Starts on" hint="A current contract ends the day before." htmlFor="hr-starts">
              <Input id="hr-starts" required type="date" value={draft.startsOn} onChange={(ev) => setDraft({ ...draft, startsOn: ev.target.value })} className={inputClass} />
            </Field>
            <Field label="Ends on" hint={draft.contractType === "fixed_term" ? "Required for a fixed term." : "Optional."} htmlFor="hr-ends">
              <Input id="hr-ends" type="date" value={draft.endsOn} onChange={(ev) => setDraft({ ...draft, endsOn: ev.target.value })} className={inputClass} />
            </Field>
          </div>
          <FormError error={create.error} />
          <div className="flex justify-end gap-2">
            <ActionButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" pending={create.isPending}>
              {create.isPending ? "Saving" : "Save contract"}
            </ActionButton>
          </div>
        </form>
      )}
      {contracts.length === 0 ? (
        <EmptyState className="mt-2.5 p-5">
          No contract yet. A person is paid from their contract, so nobody is on a pay run without one.
        </EmptyState>
      ) : (
        <RowList>
          {contracts.map((c, i) => (
            <div key={c.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{CONTRACT_TYPE[c.contractType]}</span>
                <span className="pms-num text-2xs text-muted-foreground">
                  {dshortIso(c.startsOn)} {c.startsOn.slice(0, 4)} to {c.endsOn ? `${dshortIso(c.endsOn)} ${c.endsOn.slice(0, 4)}` : "open ended"}
                </span>
              </span>
              {c.view === "full" && <span className="pms-num text-sm text-ink2">{fmt(c.wageRwf)} a month</span>}
              <Badge intent={c.status === "active" ? "ok" : c.status === "scheduled" ? "info" : "neutral"}>
                {c.status === "active" ? "Current" : c.status === "scheduled" ? "Starts later" : "Ended"}
              </Badge>
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

function Balances({ employeeId }: { employeeId: string }) {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const mayRead = can("people.view") || can("people.manage") || can("leave.approve");
  const query = useLeaveBalances(workspaceId, mayRead ? employeeId : null);
  if (!mayRead) return null;
  return (
    <section>
      <SectionHeading>Leave</SectionHeading>
      {query.isPending ? (
        <Skeleton height={80} />
      ) : query.isError ? (
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load leave balances. If the leave rules are not set up yet, leave cannot be
          counted until they are.
        </LoadFailed>
      ) : (
        <RowList>
          {query.data.balances.map((b, i) => (
            <div key={b.leaveType.id} className={`${rowClass(i)} flex items-center justify-between gap-3`}>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{b.leaveType.name}</span>
                <span className="text-2xs text-muted-foreground">
                  {b.leaveType.paid ? "Paid" : "Unpaid"}
                  {b.leaveType.yearlyEntitlementDays !== null ? ` · ${daysText(b.leaveType.yearlyEntitlementDays)} a year` : ""}
                </span>
              </span>
              <span className="pms-num text-sm text-ink">
                {b.balanceDays === null ? "No balance kept" : `${daysText(b.balanceDays)} left`}
              </span>
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

function Offboard({ file }: { file: EmployeeFileData }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const offboard = useOffboard(workspaceId);
  const e = file.employee;
  const [open, setOpen] = useState(false);
  const [lastDay, setLastDay] = useState(todayIso());
  const [reason, setReason] = useState("");
  const denied =
    e.hasAccount && !can("team.manage")
      ? "This person signs in here, and taking that access away is the owner's."
      : undefined;

  return (
    <section>
      <SectionHeading>Leaving</SectionHeading>
      {!open ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-card border border-card-bd bg-card p-5">
          <span className="flex-1 text-sm text-muted-foreground">
            Offboarding ends their contract on their last day, clears their shifts and leave after it
            {e.hasAccount ? ", and removes their access to this business at once" : ""}. The file is kept.
          </span>
          <ActionButton deniedReason={denied} onClick={() => setOpen(true)}>
            Offboard
          </ActionButton>
        </div>
      ) : (
        <form
          className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
          onSubmit={(ev) => {
            ev.preventDefault();
            offboard.mutate(
              { id: e.id, body: { lastDay, reason } },
              {
                onSuccess: () => {
                  toast(`${e.displayName} has been offboarded`, "ok");
                  setOpen(false);
                },
              },
            );
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Last day" htmlFor="hr-last-day">
              <Input id="hr-last-day" required type="date" value={lastDay} onChange={(ev) => setLastDay(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Why they are leaving" htmlFor="hr-reason">
              <Input id="hr-reason" required value={reason} onChange={(ev) => setReason(ev.target.value)} className={inputClass} />
            </Field>
          </div>
          <FormError error={offboard.error} />
          <div className="flex justify-end gap-2">
            <ActionButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" pending={offboard.isPending}>
              {offboard.isPending ? "Offboarding" : `Offboard ${e.displayName}`}
            </ActionButton>
          </div>
        </form>
      )}
    </section>
  );
}
