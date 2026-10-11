"use client";

/**
 * Employees (HR module, Phase 1 — first pass, no ADR yet).
 *
 * "Employee" is a department_members row (see server/api's hr.ts header).
 *
 * TWO WAYS IN. Somebody who will sign in is INVITED by email: the same command
 * the Invites lens sends, behind the same `team.manage`, sent from here because
 * "add somebody new" is asked on this screen. STAFF WITHOUT AN ACCOUNT — a
 * gardener or a night guard who is employed and paid but never signs in — are
 * added with a name, a department and a job title; that creates no login,
 * grants nothing, and puts them on no operational board.
 *
 * THERE IS NO "PICK A COLLEAGUE" FORM ANY MORE. It listed everybody on the
 * team, nearly all of them employees already, so it read as "add somebody who
 * is already in" and its main effect was a second row for the same person.
 * What it was really for still has to happen once: somebody who ACCEPTS an
 * invitation is on the team but has no department, and so is no employee yet.
 * Those people, and only those, are listed under "Joined, not set up yet",
 * each with the department and job title that finishes the job (assigning the
 * member, then recording a 'hired' fact). With nobody waiting, nothing shows.
 *
 * A ROW OPENS INTO THE PERSON'S RECORD: how they are employed, when they
 * started, and every recorded fact since, newest first. THE START DATE CAN BE
 * SET THERE, and matters: until HR sets it, it is the day the person was added
 * to this screen, and leave is worked out from it (a share of the first year,
 * more days for long service). Somebody here for six years, added last week,
 * would otherwise be given a newcomer's few days. It is also where
 * employment ENDS. Ending it takes somebody off the roster — and with it off
 * payroll, leave and new tasks — hands them the offboarding tasks for their
 * department, and keeps their record; they are listed under "Former
 * employees" and can be brought back.
 *
 * No national ID field here on purpose: this app already carries that as a
 * verified identity document with its own retention rules, and duplicating
 * it here would create a second, unverified copy of the same sensitive fact.
 * "Employee ID" is a plain internal reference number instead.
 */

import { InvitableOrgRole, ORG_ROLE_LABEL } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { Search, UserCheck, UserPlus, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  ActionButton,
  Badge,
  Chip,
  EmptyState,
  LoadFailed,
  SectionHeading,
  SelectField,
  Skeleton,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useAddEmployeeWithoutAccount,
  useAssignDepartmentMember,
  useDepartments,
  useEmployees,
  useEmploymentHistory,
  useFormerEmployees,
  useReinstateEmployee,
  useRecordEmploymentEvent,
  useSetEmployeeStartDate,
  useTeam,
  type EmployeeRow,
  type EmploymentEventRow,
  type EmploymentType,
} from "../data/ops";
import { useInviteStaff, useStaffInvitations } from "../data/setup";
import { kigaliDateOf, todayIso } from "../lib/format";
import { usePms } from "../store";
import { Eyebrow, Field, FormError, MoreToggle, Person, RowList, inputClass, panelClass, rowClass } from "./hr-ui";

type AddMode = "plain" | "invite";

/** The two ways somebody becomes an employee here, and one line on each. */
const ADD_MODES: { key: AddMode; label: string; hint: string }[] = [
  { key: "plain", label: "No login needed", hint: "Staff who never sign in, like a gardener or a guard." },
  { key: "invite", label: "Invite by email", hint: "They get a link by email. Once they accept, finish setting them up here." },
];

const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  casual: "Casual",
};

/** "5 Oct 2026", in the reader's own zone: these are moments, not stored days. */
function longDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** One employment fact, as a sentence. */
function eventSentence(e: EmploymentEventRow): string {
  switch (e.eventType) {
    case "hired":
      return e.note === "Brought back" ? "Brought back" : e.jobTitle ? `Hired as ${e.jobTitle}` : "Hired";
    case "title_change":
      return `Job title changed to ${e.jobTitle ?? "—"}`;
    case "employment_type_change":
      return e.employmentType ? `Became ${EMPLOYMENT_LABEL[e.employmentType].toLowerCase()}` : "Employment type changed";
    case "department_change":
      return "Moved department";
    case "terminated":
      return e.note ? `Employment ended · ${e.note}` : "Employment ended";
  }
}

/**
 * The day somebody started, to read and to set. Saved when the box is left
 * with a different day in it, like the other single facts on this record.
 */
function StartDate({ employee }: { employee: EmployeeRow }) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const setStart = useSetEmployeeStartDate(workspaceId);
  const recorded = employee.hiredOn ? kigaliDateOf(employee.hiredOn) : "";
  const [draft, setDraft] = useState(recorded);
  const name = employee.name ?? "This person";

  const save = () => {
    if (!draft || draft === recorded) {
      setDraft(recorded);
      return;
    }
    setStart.mutate(
      { departmentMemberId: employee.departmentMemberId, startedOn: draft },
      {
        onSuccess: () => toast(`${name} started on ${longDay(draft)}. Their leave is worked out from it.`, "ok"),
        onError: (error) => {
          setDraft(recorded);
          toastError(error);
        },
      },
    );
  };

  return (
    <span className="flex flex-col gap-1">
      <Input
        type="date"
        size="sm"
        aria-label={`The day ${name} started`}
        value={draft}
        max={todayIso()}
        disabled={setStart.isPending}
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={save}
        className="h-9 max-w-48 rounded border-line2 bg-card text-sm"
      />
      <span className="text-2xs text-muted-foreground">Their leave is worked out from this day.</span>
    </span>
  );
}

/** The record behind a roster row: how they are employed, their history, and the way out. */
function EmployeeDetails({ employee }: { employee: EmployeeRow }) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const history = useEmploymentHistory(workspaceId, employee.departmentMemberId);
  const recordEvent = useRecordEmploymentEvent(workspaceId);
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState("");

  const name = employee.name ?? "This person";
  const reasonId = `employee-end-reason-${employee.departmentMemberId}`;
  const fact = (label: string, value: ReactNode) => (
    <div className="flex min-h-10 items-center gap-2.5 text-sm">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">{value}</dd>
    </div>
  );

  return (
    // Indented to the name, past the initials, so the record reads as this person's.
    <div className="grid gap-x-8 gap-y-4 pr-[18px] pb-4 pl-[62px] md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Eyebrow>Employment</Eyebrow>
        <dl className="flex flex-col">
          {fact(
            "Type",
            <SelectField
              label={`Employment type for ${name}`}
              value={employee.employmentType ?? ""}
              placeholder="Not set"
              disabled={recordEvent.isPending}
              onChange={(choice) => {
                const next = choice as EmploymentType;
                if (!next || next === employee.employmentType) return;
                recordEvent.mutate(
                  { departmentMemberId: employee.departmentMemberId, eventType: "employment_type_change", employmentType: next },
                  {
                    onSuccess: () => toast(`${name} is now ${EMPLOYMENT_LABEL[next].toLowerCase()}`, "ok"),
                    onError: toastError,
                  },
                );
              }}
              options={(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((t) => ({ value: t, label: EMPLOYMENT_LABEL[t] }))}
              className="max-w-48"
            />,
          )}
          {fact("Started", <StartDate employee={employee} />)}
          {fact("Sign-in", employee.userId === null ? "No login" : (employee.email ?? "Has a login"))}
        </dl>
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow>History</Eyebrow>
        {history.isPending ? (
          <Skeleton height={48} />
        ) : (history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {(history.data ?? []).map((e) => (
              <li key={e.id} className="flex gap-2.5 text-sm">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1 text-ink">{eventSentence(e)}</span>
                <span className="pms-num whitespace-nowrap text-2xs text-muted-foreground">{longDay(e.effectiveFrom)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t border-line pt-3 md:col-span-2">
        {ending ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              recordEvent.mutate(
                { departmentMemberId: employee.departmentMemberId, eventType: "terminated", note: reason.trim() || undefined },
                { onSuccess: () => toast(`${name}'s employment has ended`, "ok"), onError: toastError },
              );
            }}
          >
            <p className="text-sm text-muted-foreground">
              {name} leaves the roster and payroll. Their record and payslips are kept, and you can bring them back.
            </p>
            <Field label="Reason for leaving" hint="Optional." htmlFor={reasonId}>
              <Input
                id={reasonId}
                autoFocus
                maxLength={300}
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <ActionButton onClick={() => setEnding(false)}>Cancel</ActionButton>
              <ActionButton variant="primary" type="submit" pending={recordEvent.isPending}>
                End employment
              </ActionButton>
            </div>
          </form>
        ) : (
          <ActionButton onClick={() => setEnding(true)}>End employment…</ActionButton>
        )}
      </div>
    </div>
  );
}

/** People whose employment was ended: kept on record, and reversible. */
function FormerEmployees() {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const former = useFormerEmployees(workspaceId);
  const reinstate = useReinstateEmployee(workspaceId);
  const [open, setOpen] = useState(false);

  const people = former.data ?? [];
  if (people.length === 0) return null;

  return (
    <section>
      <MoreToggle open={open} onToggle={() => setOpen(!open)}>
        {open ? "Hide former employees" : `Former employees (${people.length})`}
      </MoreToggle>
      {open && (
        <RowList>
          {people.map((f, i) => (
            <div key={f.departmentMemberId} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
              <Person
                name={f.name ?? "Unknown"}
                detail={
                  <>
                    {[f.jobTitle, f.departmentName].filter(Boolean).join(" · ")}
                    {f.endedOn ? ` · left ${longDay(f.endedOn)}` : ""}
                    {f.reason ? ` · ${f.reason}` : ""}
                  </>
                }
                className="basis-52"
              />
              {f.openTasks > 0 && (
                <Badge intent="warn">
                  {f.openTasks} offboarding {f.openTasks === 1 ? "task" : "tasks"} open
                </Badge>
              )}
              <ActionButton
                pending={reinstate.isPending && reinstate.variables?.departmentMemberId === f.departmentMemberId}
                onClick={() =>
                  reinstate.mutate(
                    { departmentMemberId: f.departmentMemberId },
                    { onSuccess: () => toast(`${f.name ?? "They"} are back on the roster`, "ok"), onError: toastError },
                  )
                }
              >
                Bring back
              </ActionButton>
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

export function Employees() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useEmployees(workspaceId);
  const team = useTeam(workspaceId);
  const departments = useDepartments(workspaceId);
  const assignMember = useAssignDepartmentMember(workspaceId);
  const recordEvent = useRecordEmploymentEvent(workspaceId);
  const { toast, toastError } = usePms();
  const invitesSomeone = can("team.manage");
  const invitations = useStaffInvitations(invitesSomeone ? workspaceId : null);
  const invite = useInviteStaff(workspaceId);

  // The one row that is open on its record, and a filter for a long roster.
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // The one row whose job title is being edited, and what has been typed.
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  // Per person waiting to be set up: the department and job title being chosen.
  const [setupDraft, setSetupDraft] = useState<Record<string, { departmentId: string; jobTitle: string }>>({});

  const addWithoutAccount = useAddEmployeeWithoutAccount(workspaceId);
  const [plainName, setPlainName] = useState("");
  const [plainDepartmentId, setPlainDepartmentId] = useState("");
  const [plainJobTitle, setPlainJobTitle] = useState("");
  const [plainEmployeeId, setPlainEmployeeId] = useState("");
  const [plainStartedOn, setPlainStartedOn] = useState("");

  const [addMode, setAddMode] = useState<AddMode>("plain");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableOrgRole>("receptionist");

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load employees. This is on our side.
      </LoadFailed>
    );
  }

  const employees = query.data?.employees ?? [];
  // On the team, but in no department: they accepted an invitation and nobody
  // has made them an employee yet. Everybody else on the team already is one.
  const notSetUp = (team.data?.members ?? []).filter((m) => !employees.some((e) => e.userId === m.userId));
  const departmentList = departments.data?.departments ?? [];
  const departmentOptions = departmentList.map((d) => ({ value: d.id, label: d.name }));
  const waiting = (invitations.data?.invitations ?? []).filter((i) => i.status === "sent");

  const sendInvite = () => {
    const address = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast("Use an email address like name@example.com.", "warn");
      return;
    }
    invite.mutate(
      { email: address, orgRole: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail("");
          toast(`Invitation sent to ${address}`, "ok");
        },
      },
    );
  };

  const addPlainEmployee = () => {
    const name = plainName.trim();
    if (name.length < 2 || !plainDepartmentId) return;
    addWithoutAccount.mutate(
      {
        name,
        departmentId: plainDepartmentId,
        jobTitle: plainJobTitle.trim() || undefined,
        note: plainEmployeeId ? `Employee ID: ${plainEmployeeId}` : undefined,
        startedOn: plainStartedOn || undefined,
      },
      {
        onSuccess: () => {
          setPlainName("");
          setPlainDepartmentId("");
          setPlainJobTitle("");
          setPlainEmployeeId("");
          setPlainStartedOn("");
          toast(`${name} added as an employee`, "ok");
        },
      },
    );
  };

  const setUp = (userId: string, name: string) => {
    const draft = setupDraft[userId];
    if (!draft?.departmentId) return;
    assignMember.mutate(
      { departmentId: draft.departmentId, userId },
      {
        onError: toastError,
        onSuccess: (member) => {
          recordEvent.mutate(
            { departmentMemberId: member.id, eventType: "hired", jobTitle: draft.jobTitle.trim() || undefined },
            { onSuccess: () => toast(`${name} added as an employee`, "ok"), onError: toastError },
          );
          setSetupDraft((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        },
      },
    );
  };

  const wanted = search.trim().toLowerCase();
  // By name, then department, so somebody with two jobs sits together.
  const shown = [...employees]
    .filter((e) => !wanted || [e.name, e.jobTitle, e.departmentName].some((v) => (v ?? "").toLowerCase().includes(wanted)))
    .sort(
      (x, y) => (x.name ?? "").localeCompare(y.name ?? "") || (x.departmentName ?? "").localeCompare(y.departmentName ?? ""),
    );

  return (
    <div className="pms-enter relative flex max-w-page flex-col gap-6">
      {/* --- Add someone: one card, two ways in, one form showing at a time --- */}
      <section>
        <SectionHeading icon={UserPlus}>Add someone</SectionHeading>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {ADD_MODES.map((m) => (
            <Chip key={m.key} size="sm" label={m.label} active={m.key === addMode} onClick={() => setAddMode(m.key)} />
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{ADD_MODES.find((m) => m.key === addMode)?.hint}</p>

        {addMode === "plain" && (
          <form
            className={cn(panelClass, "mt-2.5 flex flex-col gap-4 p-5")}
            onSubmit={(ev) => {
              ev.preventDefault();
              addPlainEmployee();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" htmlFor="employee-new-name">
                <Input
                  id="employee-new-name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={plainName}
                  onChange={(e) => setPlainName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Department">
                <SelectField
                  label="Department"
                  value={plainDepartmentId}
                  onChange={setPlainDepartmentId}
                  placeholder="Choose a department"
                  options={departmentOptions}
                />
              </Field>
              <Field label="Job title" htmlFor="employee-new-title">
                <Input
                  id="employee-new-title"
                  maxLength={120}
                  value={plainJobTitle}
                  onChange={(e) => setPlainJobTitle(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Employee ID" hint="Your own reference number, if you keep one." htmlFor="employee-new-id">
                <Input
                  id="employee-new-id"
                  maxLength={40}
                  value={plainEmployeeId}
                  onChange={(e) => setPlainEmployeeId(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Started on"
                hint="The day they really started; leave is worked out from it. Empty is today."
                htmlFor="employee-new-started"
              >
                <Input
                  id="employee-new-started"
                  type="date"
                  max={todayIso()}
                  value={plainStartedOn}
                  onChange={(e) => setPlainStartedOn(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <FormError error={addWithoutAccount.error} />
            <div className="flex justify-end">
              <ActionButton
                variant="primary"
                type="submit"
                pending={addWithoutAccount.isPending}
                deniedReason={plainDepartmentId ? undefined : "Choose a department first"}
              >
                Add employee
              </ActionButton>
            </div>
          </form>
        )}

        {addMode === "invite" &&
          (invitesSomeone ? (
            <form
              className={cn(panelClass, "mt-2.5 flex flex-col gap-4 p-5")}
              onSubmit={(ev) => {
                ev.preventDefault();
                sendInvite();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Email" htmlFor="employee-invite-email">
                  <Input
                    id="employee-invite-email"
                    required
                    type="email"
                    placeholder="name@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Role">
                  <SelectField
                    label="Role"
                    value={inviteRole}
                    onChange={(v) => setInviteRole(v as InvitableOrgRole)}
                    options={InvitableOrgRole.options.map((r) => ({ value: r, label: ORG_ROLE_LABEL[r] }))}
                  />
                </Field>
              </div>
              {waiting.length > 0 && (
                <p className="text-2xs text-muted-foreground">Waiting to accept: {waiting.map((i) => i.email).join(", ")}</p>
              )}
              <FormError error={invite.error} />
              <div className="flex justify-end">
                <ActionButton variant="primary" type="submit" pending={invite.isPending}>
                  Send invitation
                </ActionButton>
              </div>
            </form>
          ) : (
            <EmptyState className="mt-2.5">{reasonFor("team.manage")}</EmptyState>
          ))}
      </section>

      {/* --- Joined by invitation, not yet an employee --- */}
      {notSetUp.length > 0 && (
        <section>
          <SectionHeading n={notSetUp.length} icon={UserCheck}>
            Joined, not set up yet
          </SectionHeading>
          <RowList>
            {notSetUp.map((m, i) => {
              const name = m.name ?? m.email ?? "This person";
              const draft = setupDraft[m.userId] ?? { departmentId: "", jobTitle: "" };
              const change = (next: Partial<typeof draft>) =>
                setSetupDraft((prev) => ({ ...prev, [m.userId]: { ...draft, ...next } }));
              return (
                <div key={m.userId} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                  <span className="min-w-0 flex-[1_1_10rem] text-sm font-semibold text-ink">{name}</span>
                  <SelectField
                    label={`Department for ${name}`}
                    value={draft.departmentId}
                    onChange={(departmentId) => change({ departmentId })}
                    placeholder="Choose a department"
                    options={departmentOptions}
                    className="w-52"
                  />
                  <Input
                    aria-label={`Job title for ${name}`}
                    placeholder="Job title"
                    maxLength={120}
                    value={draft.jobTitle}
                    onChange={(e) => change({ jobTitle: e.target.value })}
                    className={cn(inputClass, "w-44")}
                  />
                  <ActionButton
                    deniedReason={draft.departmentId ? undefined : "Choose a department first"}
                    pending={assignMember.isPending && assignMember.variables?.userId === m.userId}
                    onClick={() => setUp(m.userId, name)}
                  >
                    Add as employee
                  </ActionButton>
                </div>
              );
            })}
          </RowList>
        </section>
      )}

      {/* --- Roster --- */}
      <section>
        <SectionHeading
          n={employees.length}
          icon={Users}
          action={
            employees.length > 6 && (
              <span className="relative block w-64">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint"
                  strokeWidth={2}
                />
                <Input
                  type="search"
                  size="sm"
                  aria-label="Find an employee"
                  placeholder="Find by name, job or department"
                  value={search}
                  onChange={(ev) => setSearch(ev.target.value)}
                  className="h-9 rounded border-line2 bg-card pl-8 text-sm"
                />
              </span>
            )
          }
        >
          Employees
        </SectionHeading>
        {employees.length === 0 ? (
          <EmptyState icon={Users} className="mt-2.5">
            No employees yet. Add someone above.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={Search} className="mt-2.5">
            Nobody matches “{search.trim()}”.
          </EmptyState>
        ) : (
          <RowList>
            {shown.map((e, i) => {
              const name = e.name ?? "Not signed in yet";
              const editing = editingTitle === e.departmentMemberId;
              const open = openRecord === e.departmentMemberId;
              const saveTitle = () => {
                const title = titleDraft.trim();
                if (!title) return;
                if (title === (e.jobTitle ?? "")) {
                  setEditingTitle(null);
                  return;
                }
                recordEvent.mutate(
                  { departmentMemberId: e.departmentMemberId, eventType: "title_change", jobTitle: title },
                  {
                    onSuccess: () => {
                      setEditingTitle(null);
                      toast(`${name} is now ${title}`, "ok");
                    },
                    onError: toastError,
                  },
                );
              };
              return (
                <div key={e.departmentMemberId} className={cn("border-t", i === 0 ? "border-transparent" : "border-line")}>
                  <div className="flex flex-wrap items-center gap-3 px-[18px] py-2.5">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? "Close" : "Open"} ${name}'s record`}
                      onClick={() => setOpenRecord(open ? null : e.departmentMemberId)}
                      className="flex min-w-0 flex-[1_1_14rem] cursor-pointer items-center bg-transparent text-left"
                    >
                      <Person
                        name={name}
                        detail={[e.departmentName ?? "No department", e.employmentType ? EMPLOYMENT_LABEL[e.employmentType] : null]
                          .filter(Boolean)
                          .join(" · ")}
                      >
                        {e.userId === null && <Badge intent="neutral">No login</Badge>}
                      </Person>
                    </button>

                    {editing ? (
                      <>
                        <Input
                          autoFocus
                          size="sm"
                          aria-label={`Job title for ${name}`}
                          placeholder="Job title"
                          maxLength={120}
                          value={titleDraft}
                          onChange={(ev) => setTitleDraft(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") saveTitle();
                            if (ev.key === "Escape") setEditingTitle(null);
                          }}
                          className="h-9 w-44 rounded border-line2 bg-card text-sm"
                        />
                        <ActionButton
                          variant="primary"
                          deniedReason={titleDraft.trim() ? undefined : "Type a job title first"}
                          pending={recordEvent.isPending}
                          onClick={saveTitle}
                        >
                          Save
                        </ActionButton>
                        <ActionButton onClick={() => setEditingTitle(null)}>Cancel</ActionButton>
                      </>
                    ) : (
                      <>
                        {e.jobTitle ? (
                          <span className="text-sm font-semibold text-ink">{e.jobTitle}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No job title</span>
                        )}
                        <ActionButton
                          onClick={() => {
                            setEditingTitle(e.departmentMemberId);
                            setTitleDraft(e.jobTitle ?? "");
                          }}
                        >
                          {e.jobTitle ? "Edit" : "Set title"}
                        </ActionButton>
                        <ActionButton onClick={() => setOpenRecord(open ? null : e.departmentMemberId)}>
                          {open ? "Close" : "Record"}
                        </ActionButton>
                      </>
                    )}
                  </div>
                  {open && <EmployeeDetails employee={e} />}
                </div>
              );
            })}
          </RowList>
        )}
      </section>

      <FormerEmployees />
    </div>
  );
}
