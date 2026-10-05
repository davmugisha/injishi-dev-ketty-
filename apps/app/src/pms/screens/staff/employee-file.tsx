"use client";

/**
 * One staff file (ADR-058, AC-P2, AC-P4, AC-P6, AC-O1, AC-O2; 058-people-file
 * AC-PF1 to AC-PF3, AC-PF13).
 *
 * The record page for a person on file, in tabs that are route segments:
 * Profile, Work, Contracts, Documents, Pay accounts, Notes, Discipline and
 * Leave. **A tab is offered only when the caller may read what it shows**
 * (AC-PF2): documents, notes and discipline are `people.manage`'s, pay accounts
 * `people.manage` or `payroll.run`'s. Typed by URL, a tab the grant does not
 * reach says so rather than firing a read the server would refuse.
 *
 * **The personal fields appear only when the server sent them.** A manager
 * reading this page gets the basic file, which has no date of birth, ID, family,
 * address or emergency contact to show, so those rows are absent, not blank.
 *
 * **Offboarding a person with an account is the owner's.** It removes their
 * access, which is `team.manage`, and that cannot be granted. A manager given
 * `people.manage` can offboard staff who never had an account; the button says
 * why when it will be refused.
 */

import {
  EMPLOYEE_MISSING_DETAIL_LABEL,
  type ContractType,
  type EmployeeFile as EmployeeFileData,
  type MaritalStatus,
  type Permission,
  type UpdateEmployeeRequest,
} from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ObjectPage, type Lens } from "../../components/object-page";
import {
  ActionButton,
  Badge,
  EmptyState,
  Initials,
  LoadFailed,
  SectionHeading,
  SelectField,
  Skeleton,
} from "../../components/ui";
import { VillagePicker } from "../../components/village-picker";
import { useCapability, useWorkspaceId } from "../../data/capability";
import {
  useCreateContract,
  useEmployeeFile,
  useEmployees,
  useLeaveBalances,
  useOffboard,
  useUpdateEmployee,
} from "../../data/people";
import { useEmployeePhoto, useHrCatalog, useSetPhoto } from "../../data/people-file";
import { dshortIso, fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { DisciplineTab, DocumentsTab, NotesTab, PayTab } from "./employee-records";
import { HrFileInput } from "./hr-file-input";
import { Field, FormError, RowList, daysText, inputClass, rowClass, toneIntent } from "./staff-ui";

const CONTRACT_TYPE: Record<ContractType, string> = {
  permanent: "Permanent",
  fixed_term: "Fixed term",
  casual: "Casual",
};

const MARITAL: Record<MaritalStatus, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
};

export type FileLens = "profile" | "work" | "contracts" | "documents" | "pay" | "notes" | "discipline" | "leave";

/** The file's tabs, in rail order, each with the read it makes (AC-PF2, AC-PF13). */
const FILE_LENSES: readonly { key: FileLens; label: string; segment: string; anyPermission?: readonly Permission[] }[] = [
  { key: "profile", label: "Profile", segment: "" },
  { key: "work", label: "Work", segment: "work" },
  { key: "contracts", label: "Contracts", segment: "contracts" },
  { key: "documents", label: "Documents", segment: "documents", anyPermission: ["people.manage"] },
  { key: "pay", label: "Pay accounts", segment: "pay", anyPermission: ["people.manage", "payroll.run"] },
  { key: "notes", label: "Notes", segment: "notes", anyPermission: ["people.manage"] },
  { key: "discipline", label: "Discipline", segment: "discipline", anyPermission: ["people.manage"] },
  { key: "leave", label: "Leave", segment: "leave", anyPermission: ["people.view", "people.manage", "leave.approve"] },
];

export function EmployeeFile({ employeeId, lens }: { employeeId: string; lens: FileLens }) {
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
  return <FileBody file={query.data} lens={lens} />;
}

function FileBody({ file, lens }: { file: EmployeeFileData; lens: FileLens }) {
  const { employee: e } = file;
  const { can } = useCapability();
  const workspaceId = useWorkspaceId();
  const mayManage = can("people.manage");
  const left = e.status === "offboarded";
  const base = `${workspaceBase(workspaceId)}/staff/${e.id}`;

  const reachable = FILE_LENSES.filter((l) => !l.anyPermission || l.anyPermission.some(can));
  const lenses: Lens[] = reachable.map((l) => ({ key: l.key, label: l.label, href: l.segment ? `${base}/${l.segment}` : base }));
  const allowed = reachable.some((l) => l.key === lens);

  return (
    <ObjectPage
      title={e.displayName}
      subtitle={`Employee ${e.employeeNumber} · ${e.workPropertyName ?? "No branch yet"} · hired ${dshortIso(e.hiredOn)}`}
      status={left ? { label: `Left ${dshortIso(e.offboardedOn ?? "")}`, intent: "neutral" } : { label: "Working here", intent: "ok" }}
      lenses={lenses}
      active={lens}
    >
      <div className="mt-5 flex max-w-wide flex-col gap-6">
        {e.detailsMissing.length > 0 && (lens === "profile" || lens === "contracts") && (
          <div role="status" className="rounded-card border border-card-bd bg-warn-bg px-5 py-4 text-sm text-ink">
            This file is missing {e.detailsMissing.map((d) => EMPLOYEE_MISSING_DETAIL_LABEL[d]).join(", ")}.
            {mayManage ? " Add them on the Profile tab before a contract can start." : " Someone who manages staff files can add them."}
          </div>
        )}
        {!allowed ? (
          <EmptyState className="p-5">
            Your role does not open this part of a staff file. An owner can change what your role allows in Team &amp;
            Departments.
          </EmptyState>
        ) : lens === "work" ? (
          <>
            <Work file={file} mayManage={mayManage && !left} />
            <Departments file={file} />
            {!left && mayManage && <Offboard file={file} />}
            {left && e.view === "full" && e.offboardReason && (
              <p className="text-sm text-muted-foreground">
                Left on {dshortIso(e.offboardedOn ?? "")}: {e.offboardReason}
              </p>
            )}
          </>
        ) : lens === "contracts" ? (
          <Contracts employeeId={e.id} contracts={file.contracts} mayManage={mayManage && !left} hiredOn={e.hiredOn} />
        ) : lens === "documents" ? (
          <DocumentsTab file={file} />
        ) : lens === "pay" ? (
          <PayTab file={file} />
        ) : lens === "notes" ? (
          <NotesTab file={file} />
        ) : lens === "discipline" ? (
          <DisciplineTab file={file} workBase={`${base}/work`} />
        ) : lens === "leave" ? (
          <Balances employeeId={e.id} />
        ) : (
          <>
            <Photo file={file} mayManage={mayManage && !left} />
            <Profile file={file} mayManage={mayManage && !left} />
          </>
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

// --- Profile --------------------------------------------------------------------------

/** The photo, a work field: anyone who reads the file sees it (AC-PF2). */
function Photo({ file, mayManage }: { file: EmployeeFileData; mayManage: boolean }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const e = file.employee;
  const photo = useEmployeePhoto(workspaceId, e.id, e.hasPhoto);
  const setPhoto = useSetPhoto(workspaceId);

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-card border border-card-bd bg-card p-5">
      {e.hasPhoto && photo.data ? (
        // eslint-disable-next-line @next/next/no-img-element -- a five minute signed read; the optimiser would cache an expiring URL
        <img src={photo.data.url} alt={`${e.displayName}'s photo`} className="size-20 rounded-full object-cover" />
      ) : (
        <Initials size={80}>{e.displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</Initials>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-semibold text-ink">{e.displayName}</span>
        <span className="text-2xs text-muted-foreground">
          {[e.jobPositionTitle, e.employeeType?.title].filter(Boolean).join(" · ") || "No position yet"}
        </span>
        {e.tags.length > 0 && (
          <span className="flex flex-wrap gap-1.5 pt-1">
            {e.tags.map((t) => (
              <Badge key={t.id} intent={toneIntent(t.tone)}>
                {t.title}
              </Badge>
            ))}
          </span>
        )}
      </div>
      {mayManage && (
        <div className="flex flex-wrap items-start gap-2">
          <HrFileInput
            workspaceId={workspaceId}
            purpose="photo"
            label={e.hasPhoto ? "Change photo" : "Add a photo"}
            onUploaded={(up) =>
              setPhoto.mutate({ id: e.id, objectKey: up.objectKey }, { onSuccess: () => toast("Photo saved", "ok") })
            }
          />
          {e.hasPhoto && (
            <ActionButton
              pending={setPhoto.isPending}
              onClick={() => setPhoto.mutate({ id: e.id, objectKey: null }, { onSuccess: () => toast("Photo removed", "ok") })}
            >
              Remove photo
            </ActionButton>
          )}
        </div>
      )}
      <FormError error={setPhoto.error} />
    </section>
  );
}

function Profile({ file, mayManage }: { file: EmployeeFileData; mayManage: boolean }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const update = useUpdateEmployee(workspaceId);
  const e = file.employee;
  const full = e.view === "full" ? e : null;
  const initial = {
    preferredName: e.preferredName ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    dateOfBirth: full?.dateOfBirth ?? "",
    sex: full?.sex ?? "",
    idDocumentType: full?.idDocumentType ?? "national_id",
    idDocumentNumber: full?.idDocumentNumber ?? "",
    rssbNumber: full?.rssbNumber ?? "",
    maritalStatus: full?.maritalStatus ?? "",
    childrenCount: full?.childrenCount === null || full?.childrenCount === undefined ? "" : String(full.childrenCount),
    street: full?.address?.street ?? "",
    emergencyName: full?.emergencyContact?.name ?? "",
    emergencyPhone: full?.emergencyContact?.phone ?? "",
    emergencyRelation: full?.emergencyContact?.relation ?? "",
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [villageId, setVillageId] = useState<number | null>(null);
  const set = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    // Only what changed, so an edit never rewrites a value nobody touched.
    const patch: UpdateEmployeeRequest = {};
    const changed = (key: keyof typeof draft) => draft[key] !== initial[key];
    if (changed("preferredName")) patch.preferredName = draft.preferredName.trim() || null;
    if (draft.phone && changed("phone")) patch.phone = draft.phone;
    if (changed("email")) patch.email = draft.email.trim() || null;
    if (draft.dateOfBirth && changed("dateOfBirth")) patch.dateOfBirth = draft.dateOfBirth;
    if (draft.sex && changed("sex")) patch.sex = draft.sex as UpdateEmployeeRequest["sex"];
    if (draft.idDocumentNumber && (changed("idDocumentNumber") || changed("idDocumentType"))) {
      patch.idDocumentType = draft.idDocumentType as UpdateEmployeeRequest["idDocumentType"];
      patch.idDocumentNumber = draft.idDocumentNumber;
    }
    if (changed("rssbNumber")) patch.rssbNumber = draft.rssbNumber.trim() || null;
    if (changed("maritalStatus")) patch.maritalStatus = (draft.maritalStatus || null) as MaritalStatus | null;
    if (changed("childrenCount")) patch.childrenCount = draft.childrenCount === "" ? null : Number(draft.childrenCount);
    if (villageId !== null) patch.villageId = villageId;
    if (changed("street")) patch.street = draft.street.trim() || null;
    if (changed("emergencyName")) patch.emergencyName = draft.emergencyName.trim() || null;
    if (changed("emergencyPhone")) patch.emergencyPhone = draft.emergencyPhone.trim() || null;
    if (changed("emergencyRelation")) patch.emergencyRelation = draft.emergencyRelation.trim() || null;
    if (Object.keys(patch).length === 0) return setEditing(false);
    update.mutate(
      { id: e.id, patch },
      {
        onSuccess: () => {
          toast("Profile updated", "ok");
          setEditing(false);
        },
      },
    );
  };

  const address = full?.address
    ? [full.address.street, full.address.villageName, full.address.cellName, full.address.sectorName, full.address.districtName]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeading>Profile</SectionHeading>
        {mayManage && !editing && full && (
          <ActionButton
            onClick={() => {
              setDraft(initial);
              setVillageId(null);
              setEditing(true);
            }}
          >
            Edit profile
          </ActionButton>
        )}
      </div>
      {!editing ? (
        <dl className="mt-2.5 grid gap-4 rounded-card border border-card-bd bg-card p-5 md:grid-cols-3">
          <Row label="Legal name">{e.legalName}</Row>
          <Row label="Called">{e.preferredName ?? "—"}</Row>
          <Row label="Phone">{e.phone ?? "—"}</Row>
          <Row label="Email">{e.email ?? "—"}</Row>
          <Row label="Account">{e.hasAccount ? `Signs in (${e.orgRole ?? "role"})` : "No account"}</Row>
          {full && (
            <>
              <Row label="Sex">{full.sex ? (full.sex === "female" ? "Female" : "Male") : "—"}</Row>
              <Row label="Date of birth">{full.dateOfBirth ? `${dshortIso(full.dateOfBirth)} ${full.dateOfBirth.slice(0, 4)}` : "—"}</Row>
              <Row label="ID">
                {full.idDocumentNumber
                  ? `${full.idDocumentType === "passport" ? "Passport" : "National ID"} ${full.idDocumentNumber}`
                  : "—"}
              </Row>
              <Row label="RSSB number">{full.rssbNumber ?? "Not recorded"}</Row>
              <Row label="Marital status">{full.maritalStatus ? MARITAL[full.maritalStatus] : "—"}</Row>
              <Row label="Children">{full.childrenCount ?? "—"}</Row>
              <Row label="Home address">{address ?? "—"}</Row>
              <Row label="Emergency contact">
                {full.emergencyContact
                  ? [full.emergencyContact.name, full.emergencyContact.relation, full.emergencyContact.phone].filter(Boolean).join(" · ")
                  : "—"}
              </Row>
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
            <Field label="Marital status">
              <SelectField
                label="Marital status"
                value={draft.maritalStatus}
                onChange={set("maritalStatus")}
                placeholder="Not recorded"
                options={Object.entries(MARITAL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Children" hint="0 to 30." htmlFor="hr-edit-children">
              <Input id="hr-edit-children" type="number" min={0} max={30} value={draft.childrenCount} onChange={(ev) => set("childrenCount")(ev.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Home address" hint={address ? `Now: ${address}. Choose a village only to change it.` : "Choose down to the village."}>
            <VillagePicker onVillage={setVillageId} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Street and house" hint="Optional." htmlFor="hr-edit-street">
              <Input id="hr-edit-street" value={draft.street} onChange={(ev) => set("street")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Emergency contact" htmlFor="hr-edit-emergency-name">
              <Input id="hr-edit-emergency-name" value={draft.emergencyName} onChange={(ev) => set("emergencyName")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Their phone" htmlFor="hr-edit-emergency-phone">
              <Input id="hr-edit-emergency-phone" inputMode="tel" value={draft.emergencyPhone} onChange={(ev) => set("emergencyPhone")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Relation" hint="Sister, husband, neighbour." htmlFor="hr-edit-emergency-relation">
              <Input id="hr-edit-emergency-relation" value={draft.emergencyRelation} onChange={(ev) => set("emergencyRelation")(ev.target.value)} className={inputClass} />
            </Field>
          </div>
          <FormError error={update.error} />
          <div className="flex justify-end gap-2">
            <ActionButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" pending={update.isPending}>
              {update.isPending ? "Saving" : "Save profile"}
            </ActionButton>
          </div>
        </form>
      )}
      {full?.previousEmployeeId && (
        <p className="mt-3 text-sm text-muted-foreground">
          Rehired.{" "}
          <Link href={`${workspaceBase(workspaceId)}/staff/${full.previousEmployeeId}`} className="text-foreground underline">
            Their earlier file
          </Link>{" "}
          is kept as it was.
        </p>
      )}
    </section>
  );
}

// --- Work ----------------------------------------------------------------------------

function Work({ file, mayManage }: { file: EmployeeFileData; mayManage: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const update = useUpdateEmployee(workspaceId);
  const positions = useHrCatalog(workspaceId, "job-positions");
  const types = useHrCatalog(workspaceId, "employee-types");
  const tags = useHrCatalog(workspaceId, "tags");
  const colleagues = useEmployees(workspaceId, "active");
  const e = file.employee;
  const full = e.view === "full" ? e : null;
  const branches = currentGrant(state)?.branches ?? [];
  const initial = {
    workPropertyId: e.workPropertyId ?? "",
    jobPositionId: e.jobPositionId ?? "",
    employeeTypeId: e.employeeType?.id ?? "",
    reportingManagerId: e.reportingManagerId ?? "",
    hiredOn: e.hiredOn,
    serviceFrom: full?.serviceFrom ?? e.hiredOn,
    qualification: e.qualification ?? "",
    priorExperienceYears: e.priorExperienceYears === null ? "" : String(e.priorExperienceYears),
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [tagIds, setTagIds] = useState<string[]>(e.tags.map((t) => t.id));
  const set = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  // Archived rows are not offered for new choices, but stay on the file that
  // carries them, so the one this file has is kept in the list (AC-PF11).
  const options = (items: { id: string; title: string; status: string }[] | undefined, current: string) =>
    (items ?? []).filter((i) => i.status === "active" || i.id === current).map((i) => ({ value: i.id, label: i.title }));
  const tagChoices = useMemo(
    () => (tags.data?.items ?? []).filter((t) => t.status === "active" || e.tags.some((c) => c.id === t.id)),
    [tags.data, e.tags],
  );

  const save = () => {
    const patch: UpdateEmployeeRequest = {};
    const changed = (key: keyof typeof draft) => draft[key] !== initial[key];
    if (draft.workPropertyId && changed("workPropertyId")) patch.workPropertyId = draft.workPropertyId;
    if (changed("jobPositionId")) patch.jobPositionId = draft.jobPositionId || null;
    if (changed("employeeTypeId")) patch.employeeTypeId = draft.employeeTypeId || null;
    if (changed("reportingManagerId")) patch.reportingManagerId = draft.reportingManagerId || null;
    if (draft.hiredOn && changed("hiredOn")) patch.hiredOn = draft.hiredOn;
    if (full && draft.serviceFrom && changed("serviceFrom")) patch.serviceFrom = draft.serviceFrom;
    if (changed("qualification")) patch.qualification = draft.qualification.trim() || null;
    if (changed("priorExperienceYears")) patch.priorExperienceYears = draft.priorExperienceYears === "" ? null : Number(draft.priorExperienceYears);
    const before = e.tags.map((t) => t.id).sort().join();
    if ([...tagIds].sort().join() !== before) patch.tagIds = tagIds;
    if (Object.keys(patch).length === 0) return setEditing(false);
    update.mutate(
      { id: e.id, patch },
      {
        onSuccess: () => {
          toast("Work details updated", "ok");
          setEditing(false);
        },
      },
    );
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeading>Work</SectionHeading>
        {mayManage && !editing && (
          <ActionButton
            onClick={() => {
              setDraft(initial);
              setTagIds(e.tags.map((t) => t.id));
              setEditing(true);
            }}
          >
            Edit work details
          </ActionButton>
        )}
      </div>
      {!editing ? (
        <dl className="mt-2.5 grid gap-4 rounded-card border border-card-bd bg-card p-5 md:grid-cols-3">
          <Row label="Works at">{e.workPropertyName ?? "No branch yet"}</Row>
          <Row label="Job position">{e.jobPositionTitle ?? "None yet"}</Row>
          <Row label="Employee type">{e.employeeType?.title ?? "—"}</Row>
          <Row label="Reports to">{e.reportingManagerName ?? "Nobody named"}</Row>
          <Row label="Hired on">{`${dshortIso(e.hiredOn)} ${e.hiredOn.slice(0, 4)}`}</Row>
          {full && (
            <Row label="Service counts from">
              {full.serviceFrom === e.hiredOn ? "The hire date" : `${dshortIso(full.serviceFrom)} ${full.serviceFrom.slice(0, 4)}`}
            </Row>
          )}
          <Row label="Qualification">{e.qualification ?? "—"}</Row>
          <Row label="Experience before joining">
            {e.priorExperienceYears === null ? "—" : `${e.priorExperienceYears} year${e.priorExperienceYears === 1 ? "" : "s"}`}
          </Row>
          <Row label="Tags">
            {e.tags.length === 0 ? (
              "—"
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {e.tags.map((t) => (
                  <Badge key={t.id} intent={toneIntent(t.tone)}>
                    {t.title}
                  </Badge>
                ))}
              </span>
            )}
          </Row>
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
            <Field label="Works at">
              <SelectField
                label="Works at"
                value={draft.workPropertyId}
                onChange={set("workPropertyId")}
                placeholder="Choose a branch"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </Field>
            <Field label="Job position" hint="Positions are kept under Staff, Configuration.">
              <SelectField
                label="Job position"
                value={draft.jobPositionId}
                onChange={set("jobPositionId")}
                placeholder="None"
                options={options(positions.data?.items, initial.jobPositionId)}
              />
            </Field>
            <Field label="Employee type">
              <SelectField
                label="Employee type"
                value={draft.employeeTypeId}
                onChange={set("employeeTypeId")}
                placeholder="None"
                options={options(types.data?.items, initial.employeeTypeId)}
              />
            </Field>
            <Field label="Reports to">
              <SelectField
                label="Reports to"
                value={draft.reportingManagerId}
                onChange={set("reportingManagerId")}
                placeholder="Nobody"
                options={(colleagues.data ?? []).filter((c) => c.id !== e.id).map((c) => ({ value: c.id, label: c.displayName }))}
              />
            </Field>
            <Field label="Hired on" hint="Fixed once leave has been earned or pay computed from it." htmlFor="hr-edit-hired">
              <Input id="hr-edit-hired" type="date" value={draft.hiredOn} onChange={(ev) => set("hiredOn")(ev.target.value)} className={inputClass} />
            </Field>
            {full && (
              <Field label="Service counts from" hint="The hire date, unless an earlier employment here is credited." htmlFor="hr-edit-service">
                <Input id="hr-edit-service" type="date" max={draft.hiredOn} value={draft.serviceFrom} onChange={(ev) => set("serviceFrom")(ev.target.value)} className={inputClass} />
              </Field>
            )}
            <Field label="Highest qualification" htmlFor="hr-edit-qualification">
              <Input id="hr-edit-qualification" value={draft.qualification} onChange={(ev) => set("qualification")(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Years of experience before joining" hint="0 to 60." htmlFor="hr-edit-experience">
              <Input id="hr-edit-experience" type="number" min={0} max={60} value={draft.priorExperienceYears} onChange={(ev) => set("priorExperienceYears")(ev.target.value)} className={inputClass} />
            </Field>
          </div>
          {tagChoices.length > 0 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Tags</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
                {tagChoices.map((t) => (
                  <Checkbox
                    key={t.id}
                    isSelected={tagIds.includes(t.id)}
                    onChange={(on) => setTagIds((ids) => (on ? [...ids, t.id] : ids.filter((x) => x !== t.id)))}
                    className="flex items-center gap-2 text-sm font-normal text-ink"
                  >
                    {t.title}
                    {t.status === "archived" && <span className="text-2xs text-muted-foreground">archived</span>}
                  </Checkbox>
                ))}
              </div>
            </fieldset>
          )}
          <FormError error={update.error} />
          <div className="flex justify-end gap-2">
            <ActionButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" pending={update.isPending}>
              {update.isPending ? "Saving" : "Save work details"}
            </ActionButton>
          </div>
        </form>
      )}
    </section>
  );
}

function Departments({ file }: { file: EmployeeFileData }) {
  const { departments } = file;
  return (
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
  );
}

// --- Contracts ---------------------------------------------------------------------------

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
                  {c.view === "full" && c.endReason ? ` · ${c.endReason}` : ""}
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

// --- Leave -------------------------------------------------------------------------------

function Balances({ employeeId }: { employeeId: string }) {
  const workspaceId = useWorkspaceId();
  const query = useLeaveBalances(workspaceId, employeeId);
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

// --- Leaving -------------------------------------------------------------------------------

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
    <section id="leaving">
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
