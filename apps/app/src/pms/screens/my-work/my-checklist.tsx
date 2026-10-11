"use client";

/**
 * My work · the person's own joining or leaving checklist (ADR-058).
 *
 * A first week is a list of things that are meant to happen to you, and most
 * of them are somebody else's to do. This shows the whole list, so a new room
 * attendant can see that a uniform is owed to her and by when, and lets her
 * tick the ones that are hers: read the house rules, bring a copy of an ID.
 *
 * The office's tasks are read only here; the server refuses a tick on one in
 * its own words. Drawn only while a checklist has something left to do: a
 * finished list is the office's record, not something to greet a person with
 * every morning.
 */

import { CHECKLIST_KIND_LABEL } from "@injishi/contracts";
import { Checkbox } from "@injishi/ui";

import { cn } from "@/lib/utils";

import { SectionHeading } from "../../components/ui";
import { useMyChecklists, useTickMyTask } from "../../data/my-work";
import { usePms } from "../../store";
import { Progress, taskWhen } from "../staff/checklists";
import { Panel } from "./my-work-ui";

export function MyChecklist({ employeeId }: { employeeId: string }) {
  const { toastError } = usePms();
  const checklists = useMyChecklists(employeeId);
  const tick = useTickMyTask(employeeId);

  const open = (checklists.data?.checklists ?? []).filter((c) => c.doneCount < c.tasks.length);
  if (!checklists.data || open.length === 0) return null;
  const { today } = checklists.data;

  return (
    <>
      {open.map((checklist) => {
        const mine = checklist.tasks.filter((t) => t.byEmployee && t.doneAt === null).length;
        return (
          <div key={checklist.id} className="flex flex-col gap-2.5">
            <SectionHeading
              action={
                <span className="flex items-center gap-2">
                  <Progress done={checklist.doneCount} total={checklist.tasks.length} />
                  <span className="pms-num text-2xs text-ink2">
                    {checklist.doneCount} of {checklist.tasks.length} done
                  </span>
                </span>
              }
            >
              {checklist.kind === "onboarding" ? "Your first days" : "Before you go"}
            </SectionHeading>
            <Panel className="overflow-hidden">
              <p className="px-[18px] py-2.5 text-2xs text-muted-foreground">
                {checklist.templateName}.{" "}
                {mine > 0
                  ? `${mine} of these ${mine === 1 ? "is" : "are"} yours to tick; the office does the rest.`
                  : "The office does what is left, and ticks it here when it is done."}
              </p>
              <ul aria-label={`Your ${CHECKLIST_KIND_LABEL[checklist.kind].toLowerCase()} checklist`}>
                {checklist.tasks.map((task) => {
                  const when = taskWhen(task, today);
                  const done = task.doneAt !== null;
                  const label = (
                    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className={cn("text-sm", done ? "text-muted-foreground line-through" : "text-ink")}>{task.label}</span>
                      {!task.byEmployee && !done && <span className="text-2xs text-muted-foreground">the office</span>}
                      <span className={cn("pms-num ml-auto text-2xs", when.late ? "font-semibold text-warn" : "text-muted-foreground")}>
                        {when.text}
                      </span>
                    </span>
                  );
                  return (
                    <li key={task.id} className="border-t border-line px-[18px] py-2">
                      {task.byEmployee ? (
                        <Checkbox
                          isSelected={done}
                          isDisabled={tick.isPending && tick.variables?.taskId === task.id}
                          onChange={(on: boolean) => tick.mutate({ taskId: task.id, done: on }, { onError: toastError })}
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
            </Panel>
          </div>
        );
      })}
    </>
  );
}
