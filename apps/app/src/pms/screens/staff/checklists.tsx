"use client";

/**
 * Staff · Checklists (ADR-058).
 *
 * What a business does when somebody joins and when somebody leaves: issue a
 * uniform, show the fire exits, collect the keys, write the certificate of
 * service. Every hotel has the list; most keep it in somebody's head, which is
 * how a room attendant works a month with no name badge and a leaver keeps a
 * master key.
 *
 * THE BOARD FIRST, the lists second. Opening this lens is asking "who is
 * partway through, and what is late", so each person's checklist is drawn with
 * its tasks and their days, unfinished before finished. The templates are the
 * business's own wording of the lists and sit below, for whoever keeps the
 * files.
 *
 * A NEW FILE AND AN OFFBOARDING START THE DEFAULT LIST THEMSELVES. Somebody who
 * joined or left before a list was written shows under "No checklist yet", to
 * be started by hand.
 *
 * A checklist is a copy taken the day it starts. Editing a template changes
 * nobody's list in hand, and a deleted template leaves what it started
 * standing; the template editor says so where it matters.
 *
 * Reading is `people.view` or `people.manage`; every write is `people.manage`'s.
 * A person ticks the tasks that are theirs on My work, never here, though the
 * office may tick them too: somebody has to when the person has no account.
 */

import {
  CHECKLIST_KIND_LABEL,
  type ChecklistKind,
  type ChecklistTask,
  type ChecklistTemplate,
  type EmployeeChecklist,
} from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import {
  CHECKLIST_ANCHOR,
  useChecklistBoard,
  useChecklistTemplates,
  useDeleteChecklistTemplate,
  useSaveChecklistTemplate,
  useStartChecklist,
  useTickChecklistTask,
} from "../../data/checklists";
import { useHrCatalog } from "../../data/people-file";
import { dshortIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

/** When a task is due or was done, and whether it is late: one line a person can act on. */
export function taskWhen(task: ChecklistTask, today: string): { text: string; late: boolean } {
  if (task.doneAt) {
    return { text: `done ${dshortIso(task.doneAt)}${task.doneByName ? ` by ${task.doneByName}` : ""}`, late: false };
  }
  if (task.dueOn < today) return { text: `late, was due ${dshortIso(task.dueOn)}`, late: true };
  return { text: task.dueOn === today ? "due today" : `due ${dshortIso(task.dueOn)}`, late: false };
}

/** How far through a checklist is, as a thin bar. The words beside it say the same, so it is hidden from a reader. */
export function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span aria-hidden className="block h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--chart-track)]">
      <span className="block h-full rounded-r bg-[var(--chart-1)]" style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
    </span>
  );
}

function ChecklistCard({
  checklist,
  today,
  base,
  mayManage,
}: {
  checklist: EmployeeChecklist;
  today: string;
  base: string;
  mayManage: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const { toastError } = usePms();
  const tick = useTickChecklistTask(workspaceId);
  const total = checklist.tasks.length;

  return (
    <section className="overflow-hidden rounded-card border border-card-bd bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-[18px] py-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`${base}/${checklist.employee.employeeId}`}
            className="truncate text-sm font-semibold text-ink underline-offset-2 hover:underline"
          >
            {checklist.employee.displayName}
          </Link>
          <span className="truncate text-2xs text-muted-foreground">
            {[checklist.employee.jobPositionTitle, `${checklist.templateName}, ${CHECKLIST_ANCHOR[checklist.kind]} ${dshortIso(checklist.anchorOn)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <Badge intent={checklist.kind === "onboarding" ? "info" : "neutral"}>{CHECKLIST_KIND_LABEL[checklist.kind]}</Badge>
        {checklist.overdueCount > 0 && <Badge intent="warn">{checklist.overdueCount} late</Badge>}
        <span className="flex items-center gap-2">
          <Progress done={checklist.doneCount} total={total} />
          <span className="pms-num text-2xs text-ink2">
            {checklist.doneCount} of {total} done
          </span>
        </span>
      </header>
      <ul aria-label={`${checklist.employee.displayName}: ${CHECKLIST_KIND_LABEL[checklist.kind].toLowerCase()} tasks`}>
        {checklist.tasks.map((task) => {
          const when = taskWhen(task, today);
          const done = task.doneAt !== null;
          const busy = tick.isPending && tick.variables?.id === task.id;
          const label = (
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className={cn("text-sm", done ? "text-muted-foreground line-through" : "text-ink")}>{task.label}</span>
              {task.byEmployee && <span className="text-2xs text-muted-foreground">theirs to do</span>}
              <span className={cn("pms-num ml-auto text-2xs", when.late ? "font-semibold text-warn" : "text-muted-foreground")}>
                {when.text}
              </span>
            </span>
          );
          return (
            <li key={task.id} className="border-t border-line px-[18px] py-2">
              {mayManage ? (
                <Checkbox
                  isSelected={done}
                  isDisabled={busy}
                  onChange={(on: boolean) => tick.mutate({ id: task.id, done: on }, { onError: toastError })}
                  className="flex w-full items-start gap-2.5 font-normal"
                  controlClassName="mt-0.5"
                >
                  {label}
                </Checkbox>
              ) : (
                <span className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center text-sm text-muted-foreground">
                    {done ? "✓" : "·"}
                  </span>
                  <span className="sr-only">{done ? "Done:" : "Not done:"}</span>
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- The lists themselves ---------------------------------------------------------

interface DraftItem {
  label: string;
  byEmployee: boolean;
  dueAfterDays: string;
  jobPositionId: string;
}

interface Draft {
  id: string | null;
  kind: ChecklistKind;
  name: string;
  isDefault: boolean;
  items: DraftItem[];
}

const EVERYBODY = "everybody";
const blankItem = (): DraftItem => ({ label: "", byEmployee: false, dueAfterDays: "0", jobPositionId: EVERYBODY });

/** A first list a business can keep, change or throw away: the tasks most hotels do. */
const STARTERS: Readonly<Record<ChecklistKind, { name: string; items: DraftItem[] }>> = {
  onboarding: {
    name: "Joining the hotel",
    items: [
      { label: "Sign the contract and give a copy", byEmployee: false, dueAfterDays: "0", jobPositionId: EVERYBODY },
      { label: "Bring a copy of your ID and your RSSB number", byEmployee: true, dueAfterDays: "0", jobPositionId: EVERYBODY },
      { label: "Issue a uniform and a name tag", byEmployee: false, dueAfterDays: "0", jobPositionId: EVERYBODY },
      { label: "Walk the fire exits and the assembly point", byEmployee: false, dueAfterDays: "1", jobPositionId: EVERYBODY },
      { label: "Read the house rules", byEmployee: true, dueAfterDays: "3", jobPositionId: EVERYBODY },
      { label: "First month review with their manager", byEmployee: false, dueAfterDays: "30", jobPositionId: EVERYBODY },
    ],
  },
  offboarding: {
    name: "Leaving the hotel",
    items: [
      { label: "Take them off next week's roster", byEmployee: false, dueAfterDays: "-3", jobPositionId: EVERYBODY },
      { label: "Hand back the uniform, name tag and locker key", byEmployee: true, dueAfterDays: "0", jobPositionId: EVERYBODY },
      { label: "Collect master keys and any hotel phone", byEmployee: false, dueAfterDays: "0", jobPositionId: EVERYBODY },
      { label: "Final pay settled on the next run", byEmployee: false, dueAfterDays: "30", jobPositionId: EVERYBODY },
      { label: "Certificate of service handed over", byEmployee: false, dueAfterDays: "7", jobPositionId: EVERYBODY },
    ],
  },
};

function draftOf(template: ChecklistTemplate): Draft {
  return {
    id: template.id,
    kind: template.kind,
    name: template.name,
    isDefault: template.isDefault,
    items: template.items.map((item) => ({
      label: item.label,
      byEmployee: item.byEmployee,
      dueAfterDays: String(item.dueAfterDays),
      jobPositionId: item.jobPosition?.id ?? EVERYBODY,
    })),
  };
}

function TemplateEditor({ draft, onChange, onDone }: { draft: Draft; onChange: (draft: Draft) => void; onDone: () => void }) {
  const workspaceId = useWorkspaceId();
  const { toast } = usePms();
  const save = useSaveChecklistTemplate(workspaceId);
  const positions = useHrCatalog(workspaceId, "job-positions");
  const positionOptions = [
    { value: EVERYBODY, label: "Everybody" },
    ...(positions.data?.items ?? []).filter((p) => p.status === "active").map((p) => ({ value: p.id, label: p.title })),
  ];
  const setItem = (index: number, patch: Partial<DraftItem>) =>
    onChange({ ...draft, items: draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= draft.items.length) return;
    const items = [...draft.items];
    [items[index], items[to]] = [items[to], items[index]];
    onChange({ ...draft, items });
  };

  function submit() {
    const items = draft.items
      .filter((item) => item.label.trim() !== "")
      .map((item) => ({
        label: item.label,
        byEmployee: item.byEmployee,
        dueAfterDays: Number.parseInt(item.dueAfterDays, 10) || 0,
        jobPositionId: item.jobPositionId === EVERYBODY ? null : item.jobPositionId,
      }));
    const body = { name: draft.name, isDefault: draft.isDefault, items };
    save.mutate(draft.id === null ? { id: null, body: { ...body, kind: draft.kind } } : { id: draft.id, body }, {
      onSuccess: (saved) => {
        toast(`${saved.name} saved. It applies to checklists started from now on.`, "ok");
        onDone();
      },
    });
  }

  const anchor = CHECKLIST_ANCHOR[draft.kind];

  return (
    <section className="flex flex-col gap-3.5 rounded-card border border-card-bd bg-card px-5 py-4">
      <SectionHeading>{draft.id === null ? `A new ${CHECKLIST_KIND_LABEL[draft.kind].toLowerCase()} checklist` : `Change ${draft.name}`}</SectionHeading>
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Name" htmlFor="checklist-name">
          <Input id="checklist-name" value={draft.name} onChange={(ev) => onChange({ ...draft, name: ev.target.value })} className={inputClass} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            isSelected={draft.isDefault}
            onChange={(on: boolean) => onChange({ ...draft, isDefault: on })}
            className="flex items-center gap-2.5 text-sm font-normal text-ink"
          >
            {draft.kind === "onboarding" ? "Start it for every new file" : "Start it at every offboarding"}
          </Checkbox>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Tasks, in order</span>
        {draft.items.map((item, index) => (
          <div key={index} className="grid grid-cols-1 items-end gap-2 rounded border border-line px-3 py-2.5 @2xl:grid-cols-[minmax(0,5fr)_7rem_minmax(0,3fr)_auto]">
            <Field label={`Task ${index + 1}`} htmlFor={`task-${index}`}>
              <Input
                id={`task-${index}`}
                value={item.label}
                placeholder="What is to be done"
                onChange={(ev) => setItem(index, { label: ev.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Due, days" htmlFor={`task-days-${index}`} hint={`from the ${anchor}`}>
              <Input
                id={`task-days-${index}`}
                type="number"
                min={-60}
                max={365}
                value={item.dueAfterDays}
                onChange={(ev) => setItem(index, { dueAfterDays: ev.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="For">
              <SelectField label={`Who task ${index + 1} is for`} value={item.jobPositionId} onChange={(jobPositionId) => setItem(index, { jobPositionId })} options={positionOptions} />
            </Field>
            <div className="flex items-center gap-1.5 pb-1">
              <ActionButton aria-label={`Move task ${index + 1} up`} deniedReason={index === 0 ? "It is already first." : undefined} onClick={() => move(index, -1)}>
                ↑
              </ActionButton>
              <ActionButton
                aria-label={`Move task ${index + 1} down`}
                deniedReason={index === draft.items.length - 1 ? "It is already last." : undefined}
                onClick={() => move(index, 1)}
              >
                ↓
              </ActionButton>
              <ActionButton
                aria-label={`Remove task ${index + 1}`}
                deniedReason={draft.items.length === 1 ? "A checklist has at least one task." : undefined}
                onClick={() => onChange({ ...draft, items: draft.items.filter((_, i) => i !== index) })}
              >
                Remove
              </ActionButton>
            </div>
            <div className="@2xl:col-span-4">
              <Checkbox
                isSelected={item.byEmployee}
                onChange={(on: boolean) => setItem(index, { byEmployee: on })}
                className="flex items-center gap-2.5 text-sm font-normal text-ink2"
              >
                The person does this themselves, and ticks it on My work
              </Checkbox>
            </div>
          </div>
        ))}
        <div>
          <ActionButton onClick={() => onChange({ ...draft, items: [...draft.items, blankItem()] })}>Add a task</ActionButton>
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        A day before the {anchor} is a minus number: -2 is two days before. Changing this list changes nobody&apos;s
        checklist already in hand.
      </p>
      <FormError error={save.error} />
      <div className="flex gap-2.5">
        <ActionButton variant="primary" pending={save.isPending} onClick={submit}>
          Save the checklist
        </ActionButton>
        <ActionButton onClick={onDone}>Cancel</ActionButton>
      </div>
    </section>
  );
}

function Templates({ templates }: { templates: readonly ChecklistTemplate[] }) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const remove = useDeleteChecklistTemplate(workspaceId);
  const save = useSaveChecklistTemplate(workspaceId);
  const [draft, setDraft] = useState<Draft | null>(null);

  const start = (kind: ChecklistKind) => {
    // The first list of a kind opens on the tasks most hotels do; the next on a blank one.
    const first = templates.every((t) => t.kind !== kind);
    setDraft({
      id: null,
      kind,
      name: first ? STARTERS[kind].name : "",
      isDefault: first,
      items: first ? STARTERS[kind].items.map((item) => ({ ...item })) : [blankItem()],
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <SectionHeading n={templates.length}>The lists</SectionHeading>
        {!draft && (
          <span className="ml-auto flex flex-wrap gap-2">
            <ActionButton onClick={() => start("onboarding")}>Write a joining checklist</ActionButton>
            <ActionButton onClick={() => start("offboarding")}>Write a leaving checklist</ActionButton>
          </span>
        )}
      </div>
      {draft && <TemplateEditor draft={draft} onChange={setDraft} onDone={() => setDraft(null)} />}
      {templates.length === 0 && !draft ? (
        <EmptyState>
          No checklist is written yet. Write a joining one and every new file starts it; a leaving one starts at every
          offboarding. Both open on the tasks most hotels do, for you to change.
        </EmptyState>
      ) : (
        templates.length > 0 && (
          <RowList>
            {templates.map((template, index) => (
              <div key={template.id} className={cn(rowClass(index), "flex flex-wrap items-center gap-x-3 gap-y-1.5")}>
                <span className="flex min-w-44 flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">{template.name}</span>
                  <span className="text-2xs text-muted-foreground">
                    {template.items.length} task{template.items.length === 1 ? "" : "s"}
                    {template.items.some((i) => i.byEmployee) ? `, ${template.items.filter((i) => i.byEmployee).length} for the person themselves` : ""}
                  </span>
                </span>
                <Badge intent={template.kind === "onboarding" ? "info" : "neutral"}>{CHECKLIST_KIND_LABEL[template.kind]}</Badge>
                {template.isDefault ? (
                  <Badge intent="ok">{template.kind === "onboarding" ? "Starts for every new file" : "Starts at every offboarding"}</Badge>
                ) : (
                  <ActionButton
                    pending={save.isPending && save.variables?.id === template.id}
                    onClick={() =>
                      save.mutate(
                        {
                          id: template.id,
                          body: {
                            name: template.name,
                            isDefault: true,
                            items: template.items.map((i) => ({ label: i.label, byEmployee: i.byEmployee, dueAfterDays: i.dueAfterDays, jobPositionId: i.jobPosition?.id ?? null })),
                          },
                        },
                        { onSuccess: () => toast(`${template.name} now starts by itself.`, "ok"), onError: toastError },
                      )
                    }
                  >
                    Make it the default
                  </ActionButton>
                )}
                <ActionButton onClick={() => setDraft(draftOf(template))}>Change</ActionButton>
                <ConfirmAction
                  confirmLabel="Delete it. Checklists in hand stay"
                  pending={remove.isPending && remove.variables?.id === template.id}
                  onConfirm={() =>
                    remove.mutate({ id: template.id }, { onSuccess: () => toast(`${template.name} deleted.`, "ok"), onError: toastError })
                  }
                >
                  Delete
                </ConfirmAction>
              </div>
            ))}
          </RowList>
        )
      )}
    </div>
  );
}

export function Checklists() {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const { toast, toastError } = usePms();
  const base = `${workspaceBase(workspaceId)}/staff`;
  const mayManage = can("people.manage");
  const board = useChecklistBoard(workspaceId);
  const templates = useChecklistTemplates(workspaceId);
  const start = useStartChecklist(workspaceId);

  if (board.isPending || templates.isPending) {
    return (
      <div className="flex max-w-page flex-col gap-3 pt-4" aria-busy="true" aria-label="Loading">
        <Skeleton height={56} />
        <Skeleton height={180} delay={60} />
        <Skeleton height={120} delay={120} />
      </div>
    );
  }
  if (board.isError || templates.isError) {
    return (
      <LoadFailed
        className="mt-4"
        onRetry={() => {
          void board.refetch();
          void templates.refetch();
        }}
        retrying={board.isFetching || templates.isFetching}
      >
        We couldn&apos;t load the checklists. Nothing is lost. Try again.
      </LoadFailed>
    );
  }

  const { today, checklists, unstarted } = board.data;
  const open = checklists.filter((c) => c.doneCount < c.tasks.length);
  const finished = checklists.filter((c) => c.doneCount === c.tasks.length);
  const hasDefault = (kind: ChecklistKind) => templates.data.templates.some((t) => t.kind === kind && t.isDefault);

  return (
    <div className="@container relative flex max-w-page flex-col gap-6 pt-4">
      <p className="text-sm text-muted-foreground">
        What is done when somebody joins and when somebody leaves. A new file and an offboarding start the default list
        by themselves; a checklist records that a thing was done and by whom, and changes no pay or access.
      </p>

      {unstarted.length > 0 && (
        <div className="flex flex-col gap-0">
          <SectionHeading n={unstarted.length}>No checklist yet</SectionHeading>
          <RowList>
            {unstarted.map((person, index) => (
              <div key={`${person.employee.employeeId}:${person.kind}`} className={cn(rowClass(index), "flex flex-wrap items-center gap-x-3 gap-y-1.5")}>
                <span className="flex min-w-44 flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">{person.employee.displayName}</span>
                  <span className="pms-num text-2xs text-muted-foreground">
                    {[person.employee.jobPositionTitle, person.kind === "onboarding" ? `joined ${dshortIso(person.on)}` : `last day ${dshortIso(person.on)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {mayManage && (
                  <ActionButton
                    pending={start.isPending && start.variables?.employeeId === person.employee.employeeId && start.variables.kind === person.kind}
                    deniedReason={hasDefault(person.kind) ? undefined : `Write a ${CHECKLIST_KIND_LABEL[person.kind].toLowerCase()} checklist below and make it the default first.`}
                    onClick={() =>
                      start.mutate(
                        { employeeId: person.employee.employeeId, kind: person.kind },
                        { onSuccess: (c) => toast(`${c.employee.displayName}: ${c.tasks.length} tasks to do.`, "ok"), onError: toastError },
                      )
                    }
                  >
                    Start the {CHECKLIST_KIND_LABEL[person.kind].toLowerCase()} checklist
                  </ActionButton>
                )}
              </div>
            ))}
          </RowList>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <SectionHeading n={open.length}>In hand</SectionHeading>
        {open.length === 0 ? (
          <EmptyState>
            {checklists.length === 0
              ? "Nobody has a checklist yet. The next person put on file starts one, once a joining checklist is written below."
              : "Every checklist that was started is finished."}
          </EmptyState>
        ) : (
          open.map((checklist) => <ChecklistCard key={checklist.id} checklist={checklist} today={today} base={base} mayManage={mayManage} />)
        )}
      </div>

      {finished.length > 0 && (
        <details>
          <summary className="cursor-pointer text-2xs font-bold tracking-[0.09em] uppercase text-[var(--muted2)]">
            Finished ({finished.length})
          </summary>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {finished.map((checklist) => (
              <ChecklistCard key={checklist.id} checklist={checklist} today={today} base={base} mayManage={mayManage} />
            ))}
          </div>
        </details>
      )}

      {mayManage && <Templates templates={templates.data.templates} />}
    </div>
  );
}
