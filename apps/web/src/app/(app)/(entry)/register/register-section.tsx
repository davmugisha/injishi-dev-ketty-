"use client";

import type { ReactNode } from "react";
import { Check, CircleCheck, Lock } from "lucide-react";
import { Badge, Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import type { SectionState } from "./register-steps";

/**
 * One section of Business or You (Register.dc.html): a numbered mark, a title, and
 * either its body (OPEN), a one line summary with what checked it and an Edit
 * (DONE), or what it is waiting for (LOCKED). Sections open in order; which one
 * is open is `sectionStates` in `register-steps.ts`.
 */
export function RegisterSection({
  id,
  n,
  title,
  state,
  summary,
  checkedBy,
  editText = "Edit",
  onEdit,
  children,
}: {
  id: string;
  n: number;
  title: string;
  state: SectionState;
  /** Done: what was answered. Locked: what it waits for. */
  summary?: string;
  /** Done: who checked it ("Checked by RRA"), when anyone did. */
  checkedBy?: string | null;
  editText?: string;
  /** Done, and the registration not yet signed: reopen it. */
  onEdit?: (() => void) | null;
  children?: ReactNode;
}) {
  const headingId = `register-section-${id}`;
  return (
    <section
      aria-labelledby={headingId}
      data-state={state}
      className={cn(
        "flex min-w-0 flex-col rounded-card",
        state === "open" && "gap-4 border border-border p-4 sm:px-5 sm:py-5",
        state === "done" && "bg-secondary px-4 py-3",
        state === "locked" && "border border-dashed border-border px-4 py-3",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            state === "open" && "bg-accent-brand text-accent-brand-foreground",
            state === "done" && "bg-success/15 text-success",
            state === "locked" && "bg-secondary text-muted-foreground",
          )}
        >
          {state === "done" ? (
            <Check size={14} aria-label="Done" />
          ) : state === "locked" ? (
            <Lock size={13} aria-label="Locked" />
          ) : (
            <span aria-hidden>{n}</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <h3
            id={headingId}
            className={cn("text-base", state === "locked" ? "font-medium text-muted-foreground" : "font-semibold")}
          >
            {title}
          </h3>
          {state !== "open" && summary ? (
            <span className="break-words text-xs text-muted-foreground sm:text-sm">{summary}</span>
          ) : null}
        </div>
        {state === "done" && checkedBy ? (
          <Badge variant="success" size="sm">
            <CircleCheck size={13} aria-hidden />
            {checkedBy}
          </Badge>
        ) : null}
        {state === "done" && onEdit ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {editText}
            <span className="sr-only"> {title.toLowerCase()}</span>
          </Button>
        ) : null}
      </div>
      {state === "open" ? <div className="flex min-w-0 flex-col gap-4 md:pl-10">{children}</div> : null}
    </section>
  );
}
