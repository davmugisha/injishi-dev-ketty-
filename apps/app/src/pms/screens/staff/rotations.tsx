"use client";

/**
 * Staff · Rotations (ADR-058, 058-time AC-TM3).
 *
 * A rotation is an ordered list of steps, each a shift of the branch or a day
 * off, and a rule saying when the step moves on: every few days, each time a
 * weekday comes round, or on a day of the month. People are put on it from a
 * date, at a step, and the daily job keeps four weeks of their shifts drafted
 * ahead, never on a day off, a day of approved leave or a day they already
 * work. A shift the generator wrote and a manager cancelled is never written
 * again.
 *
 * A pattern somebody is on never changes its steps: their drafts follow it.
 * Rename it, or end the assignments and archive it, and make a new one.
 *
 * The desk reads the rotations (it clocks people onto their shifts) and
 * changes nothing.
 */

import type { RotationPattern, RotationRule, RotationStep } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useState } from "react";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useEmployees, useShiftTemplates } from "../../data/people";
import {
  useAssignRotation,
  useCreateRotationPattern,
  useEndRotation,
  useRotationAssignments,
  useRotationPatterns,
  useUpdateRotationPattern,
} from "../../data/time";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const OFF = "off";

/** How a rule reads in a sentence: "moves every 2 days", "moves each Monday", "moves on the 1st". */
export function ruleText(rule: RotationRule, value: number): string {
  if (rule === "every_n_days") return value === 1 ? "moves every day" : `moves every ${value} days`;
  if (rule === "weekly") return `moves each ${WEEKDAYS[value] ?? "week"}`;
  const suffix = value % 10 === 1 && value !== 11 ? "st" : value % 10 === 2 && value !== 12 ? "nd" : value % 10 === 3 && value !== 13 ? "rd" : "th";
  return `moves on the ${value}${suffix} of each month`;
}

export function Rotations() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const mayRoster = can("roster.manage");
  const branches = currentGrant(state)?.branches ?? [];
  const patterns = useRotationPatterns(workspaceId);
  const update = useUpdateRotationPattern(workspaceId);
  const [creating, setCreating] = useState(false);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const list = patterns.data?.patterns ?? [];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading n={list.length}>Rotations</SectionHeading>
          {mayRoster && !creating && (
            <ActionButton variant="primary" onClick={() => setCreating(true)}>
              New rotation
            </ActionButton>
          )}
        </div>
        {creating && <NewPattern onDone={() => setCreating(false)} />}
        {patterns.isError ? (
          <EmptyState className="p-5">The rotations could not be read.</EmptyState>
        ) : list.length === 0 ? (
          <EmptyState className="p-5">
            No rotations yet. A rotation fills the roster ahead: mornings and nights every two days, a weekend
            turn, a day off each week.
          </EmptyState>
        ) : (
          <RowList>
            {list.map((p, i) => (
              <div key={p.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-pattern={p.id}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{p.name}</span>
                  <span className="text-2xs text-muted-foreground">
                    {p.stepNames.join(" → ")} · {ruleText(p.rule, p.ruleValue)}
                    {branches.length > 1 ? ` · ${branchName(p.propertyId)}` : ""}
                  </span>
                </span>
                <span className="pms-num text-2xs text-muted-foreground">
                  {p.openAssignments} {p.openAssignments === 1 ? "person" : "people"} on it
                </span>
                {p.status === "archived" ? (
                  <Badge>Archived</Badge>
                ) : (
                  mayRoster && (
                    <ConfirmAction
                      confirmLabel="Yes, archive it"
                      pending={update.isPending && update.variables?.id === p.id}
                      deniedReason={p.openAssignments > 0 ? "End everyone's assignment first" : undefined}
                      onConfirm={() =>
                        update.mutate(
                          { id: p.id, body: { status: "archived" } },
                          { onSuccess: () => toast(`${p.name} archived`, "ok") },
                        )
                      }
                    >
                      Archive
                    </ConfirmAction>
                  )
                )}
              </div>
            ))}
          </RowList>
        )}
        <FormError error={update.error} />
      </section>

      {mayRoster && <Assignments patterns={list.filter((p) => p.status === "active")} />}
    </div>
  );
}

function NewPattern({ onDone }: { onDone: () => void }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const templates = useShiftTemplates(workspaceId);
  const create = useCreateRotationPattern(workspaceId);
  const [draft, setDraft] = useState({
    name: "",
    propertyId: branches[0]?.id ?? "",
    steps: ["", ""] as string[],
    rule: "every_n_days" as RotationRule,
    ruleValue: "2",
  });
  const shifts = (templates.data?.templates ?? []).filter((t) => t.propertyId === draft.propertyId && t.status === "active");
  const stepOptions = [...shifts.map((t) => ({ value: t.id, label: `${t.name} ${t.startsAt}–${t.endsAt}` })), { value: OFF, label: "Day off" }];
  const ready = draft.name.trim() !== "" && draft.steps.every((s) => s !== "") && draft.steps.some((s) => s !== OFF);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!ready) return;
        create.mutate(
          {
            name: draft.name.trim(),
            propertyId: draft.propertyId,
            steps: draft.steps as RotationStep[],
            rule: draft.rule,
            ruleValue: Number(draft.ruleValue),
          },
          {
            onSuccess: (p) => {
              toast(`${p.name} added. Put people on it below.`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>New rotation</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="rot-name">
          <Input id="rot-name" required placeholder="Kitchen two by two" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Branch">
          <SelectField
            label="Branch"
            value={draft.propertyId}
            onChange={(v) => setDraft({ ...draft, propertyId: v, steps: draft.steps.map(() => "") })}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
        <Field label="Moves on">
          <SelectField
            label="Moves on"
            value={draft.rule}
            onChange={(v) => setDraft({ ...draft, rule: (v || "every_n_days") as RotationRule, ruleValue: v === "weekly" ? "1" : v === "monthly" ? "1" : "2" })}
            options={[
              { value: "every_n_days", label: "Every few days" },
              { value: "weekly", label: "A weekday" },
              { value: "monthly", label: "A day of the month" },
            ]}
          />
        </Field>
        {draft.rule === "weekly" ? (
          <Field label="Each">
            <SelectField
              label="Weekday"
              value={draft.ruleValue}
              onChange={(v) => setDraft({ ...draft, ruleValue: v || "1" })}
              options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
            />
          </Field>
        ) : (
          <Field label={draft.rule === "monthly" ? "Day of the month (1 to 28)" : "Every how many days (1 to 28)"} htmlFor="rot-value">
            <Input id="rot-value" inputMode="numeric" required value={draft.ruleValue} onChange={(e) => setDraft({ ...draft, ruleValue: e.target.value })} className={inputClass} />
          </Field>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-2xs font-bold tracking-[0.08em] uppercase text-muted-foreground">Steps, in order</span>
        {draft.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="pms-num w-8 shrink-0 text-sm text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <SelectField
                label={`Step ${i + 1}`}
                value={step}
                onChange={(v) => setDraft({ ...draft, steps: draft.steps.map((s, j) => (j === i ? v : s)) })}
                placeholder={shifts.length ? "A shift, or a day off" : "Add a shift at this branch first"}
                options={stepOptions}
              />
            </div>
            <ActionButton
              type="button"
              onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
              deniedReason={draft.steps.length <= 2 ? "A rotation has at least two steps" : undefined}
            >
              Remove
            </ActionButton>
          </div>
        ))}
        <span>
          <ActionButton
            type="button"
            onClick={() => setDraft({ ...draft, steps: [...draft.steps, ""] })}
            deniedReason={draft.steps.length >= 28 ? "At most 28 steps" : undefined}
          >
            Add a step
          </ActionButton>
        </span>
      </div>
      <FormError error={create.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          type="submit"
          pending={create.isPending}
          deniedReason={ready ? undefined : "Name it and fill every step, with at least one shift"}
        >
          {create.isPending ? "Saving" : "Add rotation"}
        </ActionButton>
      </div>
    </form>
  );
}

function Assignments({ patterns }: { patterns: RotationPattern[] }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const [showEnded, setShowEnded] = useState(false);
  const assignments = useRotationAssignments(workspaceId, showEnded);
  const employees = useEmployees(workspaceId, "active");
  const assign = useAssignRotation(workspaceId);
  const end = useEndRotation(workspaceId);
  const [draft, setDraft] = useState({ employeeId: "", patternId: "", startsOn: todayIso(), startStep: "0" });
  const [ending, setEnding] = useState<{ id: string; endsOn: string } | null>(null);
  const pattern = patterns.find((p) => p.id === draft.patternId);
  const people = (employees.data ?? []).filter((e) => !pattern || e.workPropertyId === pattern.propertyId);
  const rows = assignments.data?.assignments ?? [];

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading n={rows.length}>People on a rotation</SectionHeading>
        <ActionButton onClick={() => setShowEnded(!showEnded)}>{showEnded ? "Running only" : "Show ended too"}</ActionButton>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!draft.employeeId || !draft.patternId) return;
          assign.mutate(
            { employeeId: draft.employeeId, patternId: draft.patternId, startsOn: draft.startsOn, startStep: Number(draft.startStep) },
            {
              onSuccess: (a) => {
                toast(`${a.employee.displayName} is on ${a.patternName} from ${dshortIso(a.startsOn)}; four weeks of drafts are on the roster`, "ok");
                setDraft({ ...draft, employeeId: "" });
              },
            },
          );
        }}
      >
        <div className="min-w-0 flex-1">
          <Field label="Rotation">
            <SelectField
              label="Rotation"
              value={draft.patternId}
              onChange={(v) => setDraft({ ...draft, patternId: v, startStep: "0", employeeId: "" })}
              placeholder={patterns.length ? "Choose a rotation" : "Add a rotation first"}
              options={patterns.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Person">
            <SelectField
              label="Person"
              value={draft.employeeId}
              onChange={(v) => setDraft({ ...draft, employeeId: v })}
              placeholder={pattern ? "Someone at its branch" : "Choose the rotation first"}
              disabled={!pattern}
              options={people.map((e) => ({ value: e.id, label: e.displayName }))}
            />
          </Field>
        </div>
        <div className="shrink-0">
          <Field label="From" htmlFor="rot-from">
            <Input id="rot-from" type="date" value={draft.startsOn} onChange={(e) => e.target.value && setDraft({ ...draft, startsOn: e.target.value })} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
          </Field>
        </div>
        <div className="w-48">
          <Field label="Starting on">
            <SelectField
              label="Starting step"
              value={draft.startStep}
              onChange={(v) => setDraft({ ...draft, startStep: v || "0" })}
              disabled={!pattern}
              options={(pattern?.stepNames ?? ["The first step"]).map((n, i) => ({ value: String(i), label: `${i + 1}. ${n}` }))}
            />
          </Field>
        </div>
        <ActionButton
          variant="primary"
          type="submit"
          pending={assign.isPending}
          deniedReason={!draft.employeeId || !draft.patternId ? "Choose a rotation and a person" : undefined}
        >
          {assign.isPending ? "Putting on" : "Put on the rotation"}
        </ActionButton>
        <div className="w-full">
          <FormError error={assign.error} />
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState className="p-5">Nobody is on a rotation.</EmptyState>
      ) : (
        <RowList>
          {rows.map((a, i) => (
            <div key={a.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-assignment={a.id}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{a.employee.displayName}</span>
                <span className="text-2xs text-muted-foreground">
                  {a.patternName}, from {dshortIso(a.startsOn)} at step {a.startStep + 1}
                  {a.endsOn ? `, until ${dshortIso(a.endsOn)}` : ""}
                </span>
              </span>
              {a.endsOn ? (
                <Badge>Ended</Badge>
              ) : ending?.id === a.id ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Last day for ${a.employee.displayName}`}
                    type="date"
                    value={ending.endsOn}
                    onChange={(e) => e.target.value && setEnding({ ...ending, endsOn: e.target.value })}
                    className="h-10 w-auto rounded border-line2 bg-card text-sm"
                  />
                  <ActionButton onClick={() => setEnding(null)}>Keep</ActionButton>
                  <ActionButton
                    variant="primary"
                    pending={end.isPending}
                    onClick={() =>
                      end.mutate(
                        { id: a.id, endsOn: ending.endsOn },
                        {
                          onSuccess: () => {
                            toast(`${a.employee.displayName} leaves ${a.patternName} after ${dshortIso(ending.endsOn)}; later drafts are cancelled`, "ok");
                            setEnding(null);
                          },
                        },
                      )
                    }
                  >
                    End here
                  </ActionButton>
                </span>
              ) : (
                <ActionButton onClick={() => setEnding({ id: a.id, endsOn: todayIso() })}>End</ActionButton>
              )}
            </div>
          ))}
        </RowList>
      )}
      <FormError error={end.error} />
    </section>
  );
}
