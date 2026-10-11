"use client";

/**
 * Onboarding and offboarding tasks (HR module, Phase 3).
 *
 * TWO LISTS, AND EACH TASK SAYS WHO IT IS FOR. A task is for one department or
 * for everybody, so a housekeeper is not handed the engineer's tasks. People
 * are never assigned tasks one by one: a task added to a list, moved to another
 * department or removed goes to — or is taken back from — the people it now
 * concerns, on the server, at once. Somebody hired later gets the tasks for
 * their department the day they are added.
 *
 * So the only button on a person is "Start": for somebody who has no checklist
 * of that kind yet. It used to be two "Assign" buttons on everybody, which for
 * anyone already up to date could only answer "nothing to assign".
 *
 * People come first on the page because that is what HR opens it to look at;
 * the lists are set up once and then mostly left alone.
 */

import { Checkbox, Input } from "@injishi/ui";
import { ChevronDown, ListChecks, Plus, Users, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useAddTemplateItem,
  useApplyChecklistTemplate,
  useChecklistProgress,
  useChecklistTemplateItems,
  useChecklistTemplates,
  useCreateChecklistTemplate,
  useDeleteTemplateItem,
  useDepartments,
  useEmployeeChecklist,
  useEmployees,
  useFormerEmployees,
  useSetDefaultChecklistTemplate,
  useSetTemplateItemDepartment,
  useToggleChecklistItem,
  type ChecklistItemRow,
  type ChecklistProgressRow,
  type ChecklistTemplateRow,
  type EmployeeRow,
} from "../data/ops";
import { dshortIso } from "../lib/format";
import { usePms } from "../store";
import { Eyebrow, Field, MoreToggle, Person as PersonCell, RowList, inputClass, panelClass, rowClass } from "./hr-ui";

type Kind = "onboarding" | "offboarding";

const KIND: Record<Kind, { title: string; who: string; short: string }> = {
  onboarding: { title: "Onboarding tasks", who: "For people who work here", short: "Onboarding" },
  offboarding: { title: "Offboarding tasks", who: "For people who are leaving", short: "Offboarding" },
};

/**
 * "Everyone" in the department picker. The picker reads an empty value as
 * nothing chosen and shows its placeholder, so a task for everybody needs a
 * value of its own; it is turned back into no department before it is sent.
 */
const EVERYONE = "everyone";

interface Department {
  id: string;
  name: string;
}

/* ── One person ─────────────────────────────────────────────────────────── */

function Person({
  employee,
  progress,
  open,
  onToggle,
  first,
  left = false,
}: {
  employee: EmployeeRow;
  progress: ChecklistProgressRow | undefined;
  open: boolean;
  onToggle: () => void;
  first: boolean;
  /** Their employment has ended; they are here only for what is left to do. */
  left?: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const checklist = useEmployeeChecklist(workspaceId, open ? employee.departmentMemberId : null);
  const toggle = useToggleChecklistItem(workspaceId);
  const start = useApplyChecklistTemplate(workspaceId);

  const name = employee.name ?? "Unknown";
  const items = checklist.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const of = (kind: Kind) =>
    items.filter((i) => i.kind === kind).sort((a, b) => Number(a.done) - Number(b.done) || a.label.localeCompare(b.label));

  const task = (item: ChecklistItemRow) => (
    <div key={item.id} className="flex items-center gap-3 py-1">
      <span className="min-w-0 flex-1">
        <Checkbox
          isSelected={item.done}
          onChange={(done: boolean) =>
            toggle.mutate(
              { itemId: item.id, done, departmentMemberId: employee.departmentMemberId },
              { onError: toastError },
            )
          }
          className="flex w-full items-center gap-2.5 text-sm font-normal text-ink"
        >
          <span className={item.done ? "text-muted-foreground line-through" : undefined}>{item.label}</span>
        </Checkbox>
      </span>
      {item.done ? (
        <Badge intent="ok">Done</Badge>
      ) : item.dueDate && item.dueDate < today ? (
        <Badge intent="warn">Overdue · {dshortIso(item.dueDate)}</Badge>
      ) : item.dueDate ? (
        <span className="pms-num text-2xs text-muted-foreground">Due {dshortIso(item.dueDate)}</span>
      ) : null}
    </div>
  );

  return (
    <div className={cn("border-t", first ? "border-transparent" : "border-line")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer flex-wrap items-center gap-3 bg-transparent px-[18px] py-3 text-left hover:bg-hover"
      >
        <PersonCell name={name} detail={[employee.jobTitle, employee.departmentName].filter(Boolean).join(" · ")}>
          {left && <Badge intent="neutral">Left</Badge>}
        </PersonCell>
        {!progress || progress.total === 0 ? (
          <span className="text-2xs text-muted-foreground">No tasks</span>
        ) : (
          <>
            {progress.overdue > 0 && <Badge intent="warn">{progress.overdue} overdue</Badge>}
            <Badge intent={progress.done === progress.total ? "ok" : "info"}>
              {progress.done === progress.total ? "All done" : `${progress.done} of ${progress.total} done`}
            </Badge>
          </>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>

      {open && (
        // Indented to the name, past the initials, so the tasks read as this person's.
        <div className="flex flex-col gap-3 pr-[18px] pb-4 pl-[62px]">
          {checklist.isPending ? (
            <Skeleton height={48} />
          ) : (
            <>
              {(["onboarding", "offboarding"] as const).map((kind) =>
                of(kind).length > 0 ? (
                  <div key={kind} className="flex flex-col">
                    <Eyebrow>{KIND[kind].short}</Eyebrow>
                    {of(kind).map(task)}
                  </div>
                ) : null,
              )}
              <div className="flex flex-wrap gap-2">
                {(["onboarding", "offboarding"] as const).map((kind) =>
                  !left && of(kind).length === 0 ? (
                    <ActionButton
                      key={kind}
                      pending={start.isPending && start.variables?.kind === kind}
                      onClick={() =>
                        start.mutate(
                          { departmentMemberId: employee.departmentMemberId, kind },
                          {
                            onSuccess: () => toast(`${KIND[kind].short} started for ${name}`, "ok"),
                            onError: toastError,
                          },
                        )
                      }
                    >
                      Start {kind}
                    </ActionButton>
                  ) : null,
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── One list of tasks ──────────────────────────────────────────────────── */

function TaskList({
  kind,
  template,
  departments,
}: {
  kind: Kind;
  template: ChecklistTemplateRow | undefined;
  departments: readonly Department[];
}) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const tasks = useChecklistTemplateItems(workspaceId, template?.id ?? null);
  const createTemplate = useCreateChecklistTemplate(workspaceId);
  const addTask = useAddTemplateItem(workspaceId);
  const setDepartment = useSetTemplateItemDepartment(workspaceId);
  const removeTask = useDeleteTemplateItem(workspaceId);

  const [label, setLabel] = useState("");
  const [forDepartment, setForDepartment] = useState(EVERYONE);
  const [days, setDays] = useState("0");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const list = (tasks.data ?? []).slice().sort((a, b) => a.beginOnDays - b.beginOnDays || a.label.localeCompare(b.label));
  const departmentName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "Everyone";
  const departmentOptions = [{ value: EVERYONE, label: "Everyone" }, ...departments.map((d) => ({ value: d.id, label: d.name }))];
  const idOf = (choice: string): string | null => (choice === EVERYONE ? null : choice);

  const add = async () => {
    const name = label.trim();
    if (!name) return;
    setAdding(true);
    try {
      // The first task of a kind makes its list, so nobody has to "create a
      // list" before they can write a task down.
      const templateId = template?.id ?? (await createTemplate.mutateAsync({ kind, name: KIND[kind].short })).id;
      await addTask.mutateAsync({
        templateId,
        label: name,
        beginOnDays: Math.max(0, Math.round(Number(days) || 0)),
        departmentId: idOf(forDepartment),
      });
      toast(`${name} added for ${departmentName(idOf(forDepartment)).toLowerCase()}`, "ok");
      setLabel("");
      setDays("0");
    } catch (error) {
      toastError(error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={cn(panelClass, "overflow-hidden")}>
      <div className="flex flex-col gap-0.5 px-[18px] py-3.5">
        <div className="flex items-baseline gap-2">
          <span className="flex-1 text-sm font-semibold text-ink">{KIND[kind].title}</span>
          <span className="pms-num text-2xs text-faint">{list.length}</span>
        </div>
        <span className="text-2xs text-muted-foreground">{KIND[kind].who}</span>
      </div>

      {list.length === 0 ? (
        <p className="px-[18px] pb-3 text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        list.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 border-t border-line px-[18px] py-2.5">
            <span className="flex min-w-0 flex-[1_1_8rem] flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">{t.label}</span>
              <span className="text-2xs text-muted-foreground">
                {t.beginOnDays === 0 ? "Due the day it is given" : `Due after ${t.beginOnDays} ${t.beginOnDays === 1 ? "day" : "days"}`}
              </span>
            </span>
            <SelectField
              label={`Who ${t.label} is for`}
              value={t.departmentId ?? EVERYONE}
              disabled={setDepartment.isPending}
              onChange={(choice) => {
                const next = idOf(choice);
                if (next === (t.departmentId ?? null)) return;
                setDepartment.mutate(
                  { itemId: t.id, departmentId: next },
                  {
                    onSuccess: () => toast(`${t.label} is now for ${departmentName(next).toLowerCase()}`, "ok"),
                    onError: toastError,
                  },
                );
              }}
              options={departmentOptions}
              className="w-44"
            />
            {confirming === t.id ? (
              <>
                <ActionButton
                  pending={removeTask.isPending}
                  onClick={() =>
                    removeTask.mutate(
                      { itemId: t.id },
                      {
                        onSuccess: () => toast(`${t.label} removed`, "ok"),
                        onError: toastError,
                        onSettled: () => setConfirming(null),
                      },
                    )
                  }
                >
                  Remove
                </ActionButton>
                <ActionButton onClick={() => setConfirming(null)}>Keep</ActionButton>
              </>
            ) : (
              <button
                type="button"
                aria-label={`Remove ${t.label}`}
                title="Remove"
                onClick={() => setConfirming(t.id)}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded bg-transparent text-muted-foreground hover:bg-hover hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={2} />
              </button>
            )}
          </div>
        ))
      )}

      <form
        className="flex flex-col gap-3 border-t border-line bg-field px-[18px] py-3.5"
        onSubmit={(ev) => {
          ev.preventDefault();
          void add();
        }}
      >
        <Field label="Add a task" htmlFor={`task-new-${kind}`}>
          <Input
            id={`task-new-${kind}`}
            required
            maxLength={160}
            placeholder="What has to be done"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-[1_1_10rem]">
            <Field label="For">
              <SelectField label="Who it is for" value={forDepartment} onChange={setForDepartment} options={departmentOptions} />
            </Field>
          </div>
          <div className="w-32">
            <Field label="Due after, days" htmlFor={`task-days-${kind}`}>
              <Input
                id={`task-days-${kind}`}
                type="number"
                min={0}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <ActionButton variant="primary" type="submit" icon={Plus} pending={adding}>
            Add
          </ActionButton>
        </div>
      </form>
    </div>
  );
}

/* ── The screen ─────────────────────────────────────────────────────────── */

export function Checklists() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { toast, toastError } = usePms();

  const templates = useChecklistTemplates(workspaceId);
  const employees = useEmployees(workspaceId);
  const departments = useDepartments(workspaceId);
  const progress = useChecklistProgress(workspaceId);
  const former = useFormerEmployees(workspaceId);
  const createTemplate = useCreateChecklistTemplate(workspaceId);
  const setDefault = useSetDefaultChecklistTemplate(workspaceId);

  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [newKind, setNewKind] = useState<Kind>("onboarding");
  const [newName, setNewName] = useState("");

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (templates.isPending || employees.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (templates.isError || employees.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void templates.refetch();
          void employees.refetch();
        }}
        retrying={templates.isFetching || employees.isFetching}
      >
        We couldn&apos;t load checklists. This is on our side.
      </LoadFailed>
    );
  }

  const templateList = templates.data ?? [];
  const employeeList = employees.data?.employees ?? [];
  // Leaving the roster does not finish the offboarding. Somebody who has left
  // stays on this list until their last task is done, and then drops off it.
  const leavers: EmployeeRow[] = (former.data ?? [])
    .filter((f) => f.openTasks > 0)
    .map((f) => ({
      departmentMemberId: f.departmentMemberId,
      userId: f.userId,
      name: f.name,
      email: null,
      departmentId: "",
      departmentName: f.departmentName,
      jobTitle: f.jobTitle,
      employmentType: null,
      hiredOn: f.hiredOn,
      effectiveFrom: f.endedOn,
    }));
  const departmentList: Department[] = (departments.data?.departments ?? []).map((d) => ({ id: d.id, name: d.name }));
  const progressByMember = new Map((progress.data ?? []).map((p) => [p.departmentMemberId, p]));
  const inUse = (kind: Kind) => templateList.find((t) => t.kind === kind && t.isDefault);
  const spare = templateList.filter((t) => !t.isDefault);

  return (
    <div className="pms-enter relative flex max-w-page flex-col gap-6">
      {/* --- People --- */}
      <section>
        <SectionHeading n={employeeList.length + leavers.length} icon={Users}>
          People
        </SectionHeading>
        {employeeList.length + leavers.length === 0 ? (
          <EmptyState icon={Users} className="mt-2.5">
            Nobody to show yet. Add people on the Employees tab.
          </EmptyState>
        ) : (
          <RowList>
            {[...employeeList, ...leavers].map((e, i) => (
              <Person
                key={e.departmentMemberId}
                employee={e}
                progress={progressByMember.get(e.departmentMemberId)}
                open={openPerson === e.departmentMemberId}
                onToggle={() => setOpenPerson(openPerson === e.departmentMemberId ? null : e.departmentMemberId)}
                first={i === 0}
                left={i >= employeeList.length}
              />
            ))}
          </RowList>
        )}
      </section>

      {/* --- The two lists --- */}
      <section className="flex flex-col">
        <SectionHeading icon={ListChecks}>Task lists</SectionHeading>
        <div className="mt-2.5 grid gap-3 lg:grid-cols-2">
          <TaskList kind="onboarding" template={inUse("onboarding")} departments={departmentList} />
          <TaskList kind="offboarding" template={inUse("offboarding")} departments={departmentList} />
        </div>

        {/* Spare lists are rare, so they stay out of the way until asked for. */}
        <div className="mt-3">
          <MoreToggle open={showMore} onToggle={() => setShowMore(!showMore)}>
            {showMore ? "Hide other lists" : `Other lists${spare.length > 0 ? ` (${spare.length})` : ""}`}
          </MoreToggle>
        </div>

        {showMore && (
          <RowList>
            {spare.map((t, i) => (
              <div key={t.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{t.name}</span>
                  <span className="text-2xs text-muted-foreground">{KIND[t.kind].short}</span>
                </span>
                <ActionButton
                  pending={setDefault.isPending && setDefault.variables?.templateId === t.id}
                  onClick={() =>
                    setDefault.mutate(
                      { templateId: t.id },
                      { onSuccess: () => toast(`${t.name} is now the ${t.kind} list`, "ok"), onError: toastError },
                    )
                  }
                >
                  Use this one
                </ActionButton>
              </div>
            ))}
            <form
              className={cn(rowClass(spare.length), "flex flex-wrap items-end gap-3 bg-field")}
              onSubmit={(ev) => {
                ev.preventDefault();
                const name = newName.trim();
                if (!name) return;
                createTemplate.mutate(
                  { kind: newKind, name },
                  {
                    onSuccess: () => {
                      toast(`${name} created`, "ok");
                      setNewName("");
                    },
                    onError: toastError,
                  },
                );
              }}
            >
              <div className="w-44">
                <Field label="Kind of list">
                  <SelectField
                    label="Kind of list"
                    value={newKind}
                    onChange={(v) => setNewKind(v as Kind)}
                    options={[
                      { value: "onboarding", label: "Onboarding" },
                      { value: "offboarding", label: "Offboarding" },
                    ]}
                  />
                </Field>
              </div>
              <div className="min-w-0 flex-[1_1_10rem]">
                <Field label="Name of the new list" htmlFor="checklist-new-name">
                  <Input
                    id="checklist-new-name"
                    required
                    maxLength={80}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <ActionButton type="submit" pending={createTemplate.isPending}>
                Create list
              </ActionButton>
            </form>
          </RowList>
        )}
      </section>
    </div>
  );
}
