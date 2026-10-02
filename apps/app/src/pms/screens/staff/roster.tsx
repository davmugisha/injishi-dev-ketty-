"use client";

/**
 * Staff · Roster (ADR-058, AC-T1 to AC-T3, AC-T6).
 *
 * One day at a time: who is on which shift, at the branches you cover. The
 * week grid per branch and department is slice 3; this is the thin list the
 * first thread asks for.
 *
 * Two people cannot overlap themselves, and the DATABASE refuses it, so two
 * managers rostering the same cook at once cannot both succeed. A day inside
 * approved leave is refused too, naming the leave. Those refusals arrive here
 * as the server's own sentence.
 *
 * The desk reads this lens (it clocks people onto shifts) and sees no
 * button to change it: rostering is `roster.manage`.
 */

import { Input } from "@injishi/ui";
import { useState } from "react";

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
  useCancelRosterEntry,
  useCreateShiftTemplate,
  useEmployees,
  useRoster,
  useRosterEntry,
  useShiftTemplates,
} from "../../data/people";
import { addDaysIso, dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, RowList, clock, inputClass, rowClass } from "./staff-ui";

export function Roster() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const [day, setDay] = useState(todayIso());
  const roster = useRoster(workspaceId, day, day);
  const templates = useShiftTemplates(workspaceId);
  const mayRoster = can("roster.manage");
  const employees = useEmployees(mayRoster ? workspaceId : null, "active");
  const create = useRosterEntry(workspaceId);
  const cancel = useCancelRosterEntry(workspaceId);
  const createTemplate = useCreateShiftTemplate(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [pick, setPick] = useState({ employeeId: "", shiftTemplateId: "" });
  const [shiftForm, setShiftForm] = useState<null | { name: string; propertyId: string; startsAt: string; endsAt: string; breakMinutes: string }>(null);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";

  if (roster.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }
  if (roster.isError) {
    return (
      <LoadFailed onRetry={() => void roster.refetch()} retrying={roster.isFetching}>
        We couldn&apos;t load the roster. Nobody&apos;s shifts have changed — this is on our side.
      </LoadFailed>
    );
  }

  const entries = roster.data.entries;
  const scheduled = entries.filter((e) => e.status === "scheduled");
  const cancelled = entries.filter((e) => e.status === "cancelled");
  const shifts = templates.data?.templates ?? [];

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={() => setDay(addDaysIso(day, -1))}>Previous day</ActionButton>
        <Input
          type="date"
          aria-label="Day"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="h-10 w-auto rounded border-line2 bg-card text-sm"
        />
        <ActionButton onClick={() => setDay(addDaysIso(day, 1))}>Next day</ActionButton>
        {day !== todayIso() && <ActionButton onClick={() => setDay(todayIso())}>Today</ActionButton>}
      </div>

      {mayRoster && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!pick.employeeId || !pick.shiftTemplateId) return;
            create.mutate(
              { ...pick, workDate: day },
              {
                onSuccess: (r) => {
                  toast(`${r.employee.displayName} is on ${r.shiftName}, ${dshortIso(day)}`, "ok");
                  setPick({ employeeId: "", shiftTemplateId: "" });
                },
              },
            );
          }}
        >
          <div className="min-w-0 flex-1">
            <Field label="Person">
              <SelectField
                label="Person"
                value={pick.employeeId}
                onChange={(v) => setPick({ ...pick, employeeId: v })}
                placeholder="Choose someone"
                options={(employees.data?.items ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
              />
            </Field>
          </div>
          <div className="min-w-0 flex-1">
            <Field label="Shift">
              <SelectField
                label="Shift"
                value={pick.shiftTemplateId}
                onChange={(v) => setPick({ ...pick, shiftTemplateId: v })}
                placeholder={shifts.length ? "Choose a shift" : "Add a shift first"}
                options={shifts.map((s) => ({
                  value: s.id,
                  label: `${s.name} ${s.startsAt}–${s.endsAt}${branches.length > 1 ? ` · ${branchName(s.propertyId)}` : ""}`,
                }))}
              />
            </Field>
          </div>
          <ActionButton
            variant="primary"
            type="submit"
            pending={create.isPending}
            deniedReason={!pick.employeeId || !pick.shiftTemplateId ? "Choose a person and a shift" : undefined}
          >
            {create.isPending ? "Adding" : `Put on ${dshortIso(day)}`}
          </ActionButton>
          <div className="w-full">
            <FormError error={create.error} />
          </div>
        </form>
      )}

      <section>
        <SectionHeading n={scheduled.length}>On {dshortIso(day)}</SectionHeading>
        {scheduled.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            Nobody is rostered on this day{mayRoster ? ". Put someone on a shift above." : "."}
          </EmptyState>
        ) : (
          <RowList>
            {scheduled.map((r, i) => (
              <div key={r.id} data-roster={r.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`}>
                <span className="pms-num w-28 shrink-0 text-sm text-ink2">
                  {clock(r.startsAt)}–{clock(r.endsAt)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-ink">{r.employee.displayName}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {[r.shiftName, r.employee.jobPositionTitle, branches.length > 1 ? branchName(r.propertyId) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {mayRoster && (
                  <ActionButton
                    pending={cancel.isPending && cancel.variables?.id === r.id}
                    onClick={() =>
                      cancel.mutate(
                        { id: r.id, reason: "Taken off the roster" },
                        { onSuccess: () => toast(`${r.employee.displayName} is off ${r.shiftName}`, "ok") },
                      )
                    }
                  >
                    Take off
                  </ActionButton>
                )}
              </div>
            ))}
          </RowList>
        )}
        <FormError error={cancel.error} />
      </section>

      {cancelled.length > 0 && (
        <section>
          <SectionHeading n={cancelled.length}>Taken off</SectionHeading>
          <RowList>
            {cancelled.map((r, i) => (
              <div key={r.id} className={`${rowClass(i)} flex items-center gap-3 opacity-60`}>
                <span className="pms-num w-28 shrink-0 text-sm text-ink2">
                  {clock(r.startsAt)}–{clock(r.endsAt)}
                </span>
                <span className="flex-1 text-sm text-ink">{r.employee.displayName}</span>
                <Badge>{r.cancelReason ?? "Cancelled"}</Badge>
              </div>
            ))}
          </RowList>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <SectionHeading n={shifts.length}>Shifts</SectionHeading>
          {mayRoster && !shiftForm && (
            <ActionButton
              onClick={() =>
                setShiftForm({ name: "", propertyId: branches[0]?.id ?? "", startsAt: "07:00", endsAt: "15:00", breakMinutes: "0" })
              }
            >
              New shift
            </ActionButton>
          )}
        </div>
        {shiftForm && (
          <form
            className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              createTemplate.mutate(
                {
                  name: shiftForm.name,
                  propertyId: shiftForm.propertyId,
                  startsAt: shiftForm.startsAt,
                  endsAt: shiftForm.endsAt,
                  breakMinutes: Number(shiftForm.breakMinutes) || 0,
                },
                {
                  onSuccess: (s) => {
                    toast(`${s.name} added${s.crossesMidnight ? ", running past midnight" : ""}`, "ok");
                    setShiftForm(null);
                  },
                },
              );
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" htmlFor="hr-shift-name">
                <Input id="hr-shift-name" required placeholder="Morning, Night…" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Branch">
                <SelectField
                  label="Branch"
                  value={shiftForm.propertyId}
                  onChange={(v) => setShiftForm({ ...shiftForm, propertyId: v })}
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
              </Field>
              <Field label="Starts" htmlFor="hr-shift-start">
                <Input id="hr-shift-start" required type="time" value={shiftForm.startsAt} onChange={(e) => setShiftForm({ ...shiftForm, startsAt: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Ends" hint="An end before the start runs past midnight." htmlFor="hr-shift-end">
                <Input id="hr-shift-end" required type="time" value={shiftForm.endsAt} onChange={(e) => setShiftForm({ ...shiftForm, endsAt: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Break (minutes)" htmlFor="hr-shift-break">
                <Input id="hr-shift-break" inputMode="numeric" value={shiftForm.breakMinutes} onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <FormError error={createTemplate.error} />
            <div className="flex justify-end gap-2">
              <ActionButton type="button" onClick={() => setShiftForm(null)}>
                Cancel
              </ActionButton>
              <ActionButton variant="primary" type="submit" pending={createTemplate.isPending}>
                {createTemplate.isPending ? "Saving" : "Add shift"}
              </ActionButton>
            </div>
          </form>
        )}
        {shifts.length === 0 && !shiftForm ? (
          <EmptyState className="mt-2.5 p-5">
            No shifts yet. A shift is a name and its hours at one branch, such as Morning 07:00 to 15:00.
          </EmptyState>
        ) : (
          shifts.length > 0 && (
            <RowList>
              {shifts.map((s, i) => (
                <div key={s.id} className={`${rowClass(i)} flex items-center gap-3`}>
                  <span className="pms-num w-28 shrink-0 text-sm text-ink2">
                    {s.startsAt}–{s.endsAt}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink">{s.name}</span>
                  {branches.length > 1 && <span className="text-2xs text-muted-foreground">{branchName(s.propertyId)}</span>}
                  {s.crossesMidnight && <Badge intent="info">Overnight</Badge>}
                </div>
              ))}
            </RowList>
          )
        )}
      </section>
    </div>
  );
}
