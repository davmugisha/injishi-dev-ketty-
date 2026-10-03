"use client";

/**
 * Staff · Attendance (ADR-058, AC-T4, AC-T5, AC-T6).
 *
 * Today's sheet, worked at the desk: everyone on today's roster with a button
 * to clock them in or out, and every record of the day beneath. A night shift
 * that began yesterday is still here until it is clocked out, because the API
 * returns every OPEN record whatever its date.
 *
 * What the desk sees of a colleague is a roster card: a name and a job title.
 * Correcting a record is `attendance.approve`, a supervisor's; a correction
 * never edits the original, it writes a new record and marks the old one
 * superseded.
 */

import type { AttendanceRecord } from "@injishi/contracts";
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
  useAttendance,
  useClockIn,
  useClockOut,
  useCorrectAttendance,
  useEmployees,
  useRoster,
} from "../../data/people";
import { addDaysIso, dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, RowList, clock, fromLocalInput, inputClass, rowClass, toLocalInput } from "./staff-ui";

export function Attendance() {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const [day, setDay] = useState(todayIso());
  const isToday = day === todayIso();
  const sheet = useAttendance(workspaceId, day);
  const roster = useRoster(workspaceId, day, day);
  const mayRecord = can("attendance.record");
  const mayApprove = can("attendance.approve");
  const mayReadFiles = can("people.view") || can("people.manage");
  const employees = useEmployees(mayRecord && mayReadFiles ? workspaceId : null, "active");
  const clockIn = useClockIn(workspaceId);
  const clockOut = useClockOut(workspaceId);
  const correct = useCorrectAttendance(workspaceId);
  const [offRoster, setOffRoster] = useState("");
  const [fixing, setFixing] = useState<null | { id: string; clockInAt: string; clockOutAt: string; note: string }>(null);

  if (sheet.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }
  if (sheet.isError) {
    return (
      <LoadFailed onRetry={() => void sheet.refetch()} retrying={sheet.isFetching}>
        We couldn&apos;t load the attendance sheet. Nobody&apos;s times have changed — this is on our side.
      </LoadFailed>
    );
  }

  const records = sheet.data.records.filter((r) => r.status !== "superseded");
  const open = records.filter((r) => r.status === "open");
  const openFor = (employeeId: string) => open.find((r) => r.employee.employeeId === employeeId);
  const onShift = (roster.data?.entries ?? []).filter((e) => e.status === "scheduled");

  const doClockIn = (employeeId: string, rosterEntryId?: string, name?: string) =>
    clockIn.mutate(
      { employeeId, rosterEntryId },
      { onSuccess: (r) => toast(`${name ?? r.employee.displayName} clocked in at ${clock(r.clockInAt)}`, "ok") },
    );
  const doClockOut = (r: AttendanceRecord) =>
    clockOut.mutate({ id: r.id }, { onSuccess: (out) => toast(`${r.employee.displayName} clocked out at ${clock(out.clockOutAt ?? "")}`, "ok") });

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={() => setDay(addDaysIso(day, -1))}>Previous day</ActionButton>
        <span className="pms-num px-2 text-sm font-semibold text-ink">{isToday ? `Today, ${dshortIso(day)}` : dshortIso(day)}</span>
        {!isToday && <ActionButton onClick={() => setDay(addDaysIso(day, 1))}>Next day</ActionButton>}
      </div>

      {isToday && (
        <section>
          <SectionHeading n={onShift.length}>On today&apos;s roster</SectionHeading>
          {onShift.length === 0 ? (
            <EmptyState className="mt-2.5 p-5">Nobody is rostered today. Someone not on the roster can still be clocked in below.</EmptyState>
          ) : (
            <RowList>
              {onShift.map((entry, i) => {
                const rec = openFor(entry.employee.employeeId);
                const done = records.find((r) => r.rosterEntryId === entry.id && r.status === "closed");
                return (
                  <div key={entry.id} data-sheet={entry.employee.employeeId} className={`${rowClass(i)} flex flex-wrap items-center gap-3`}>
                    <span className="pms-num w-28 shrink-0 text-sm text-ink2">
                      {clock(entry.startsAt)}–{clock(entry.endsAt)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-ink">{entry.employee.displayName}</span>
                      <span className="truncate text-2xs text-muted-foreground">{entry.shiftName}</span>
                    </span>
                    {rec ? (
                      <>
                        <Badge intent="ok">In since {clock(rec.clockInAt)}</Badge>
                        {mayRecord && (
                          <ActionButton pending={clockOut.isPending && clockOut.variables?.id === rec.id} onClick={() => doClockOut(rec)}>
                            Clock out
                          </ActionButton>
                        )}
                      </>
                    ) : done ? (
                      <Badge>Out at {clock(done.clockOutAt ?? "")}</Badge>
                    ) : (
                      mayRecord && (
                        <ActionButton
                          variant="primary"
                          pending={clockIn.isPending && clockIn.variables?.rosterEntryId === entry.id}
                          onClick={() => doClockIn(entry.employee.employeeId, entry.id, entry.employee.displayName)}
                        >
                          Clock in
                        </ActionButton>
                      )
                    )}
                  </div>
                );
              })}
            </RowList>
          )}
          <FormError error={clockIn.error ?? clockOut.error} />
        </section>
      )}

      {isToday && mayRecord && mayReadFiles && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (offRoster) doClockIn(offRoster);
            setOffRoster("");
          }}
        >
          <div className="min-w-0 flex-1">
            <Field label="Clock in someone not on the roster">
              <SelectField
                label="Person"
                value={offRoster}
                onChange={setOffRoster}
                placeholder="Choose someone"
                options={(employees.data?.items ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
              />
            </Field>
          </div>
          <ActionButton type="submit" deniedReason={offRoster ? undefined : "Choose someone"}>
            Clock in
          </ActionButton>
        </form>
      )}

      <section>
        <SectionHeading n={records.length}>Records</SectionHeading>
        {records.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">No clock ins on this day.</EmptyState>
        ) : (
          <RowList>
            {records.map((r, i) => (
              <div key={r.id} className={rowClass(i)}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="pms-num w-28 shrink-0 text-sm text-ink2">
                    {clock(r.clockInAt)}–{r.clockOutAt ? clock(r.clockOutAt) : "…"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-ink">{r.employee.displayName}</span>
                    <span className="truncate text-2xs text-muted-foreground">
                      {r.workDate !== day ? `from ${dshortIso(r.workDate)} · ` : ""}
                      {r.supersedesId ? `corrected: ${r.note ?? ""}` : r.source === "self" ? "clocked themselves in" : "by the desk"}
                    </span>
                  </span>
                  <Badge intent={r.status === "open" ? "ok" : "neutral"}>{r.status === "open" ? "In" : "Closed"}</Badge>
                  {!r.validated && <Badge intent="warn">Waiting for validation</Badge>}
                  {r.status === "open" && mayRecord && (
                    <ActionButton pending={clockOut.isPending && clockOut.variables?.id === r.id} onClick={() => doClockOut(r)}>
                      Clock out
                    </ActionButton>
                  )}
                  {mayApprove && fixing?.id !== r.id && (
                    <ActionButton
                      onClick={() =>
                        setFixing({
                          id: r.id,
                          clockInAt: toLocalInput(r.clockInAt),
                          clockOutAt: toLocalInput(r.clockOutAt ?? new Date().toISOString()),
                          note: "",
                        })
                      }
                    >
                      Correct
                    </ActionButton>
                  )}
                </div>
                {fixing?.id === r.id && (
                  <form
                    className="mt-3 flex flex-col gap-3 border-t border-line pt-3"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      correct.mutate(
                        {
                          id: r.id,
                          body: {
                            clockInAt: fromLocalInput(fixing.clockInAt),
                            clockOutAt: fromLocalInput(fixing.clockOutAt),
                            note: fixing.note,
                          },
                        },
                        {
                          onSuccess: () => {
                            toast(`${r.employee.displayName}'s times corrected`, "ok");
                            setFixing(null);
                          },
                        },
                      );
                    }}
                  >
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="In" htmlFor={`fix-in-${r.id}`}>
                        <Input id={`fix-in-${r.id}`} type="datetime-local" value={fixing.clockInAt} onChange={(e) => setFixing({ ...fixing, clockInAt: e.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Out" htmlFor={`fix-out-${r.id}`}>
                        <Input id={`fix-out-${r.id}`} type="datetime-local" value={fixing.clockOutAt} onChange={(e) => setFixing({ ...fixing, clockOutAt: e.target.value })} className={inputClass} />
                      </Field>
                      <Field label="What was wrong" htmlFor={`fix-note-${r.id}`}>
                        <Input id={`fix-note-${r.id}`} required value={fixing.note} onChange={(e) => setFixing({ ...fixing, note: e.target.value })} className={inputClass} />
                      </Field>
                    </div>
                    <FormError error={correct.error} />
                    <div className="flex justify-end gap-2">
                      <ActionButton type="button" onClick={() => setFixing(null)}>
                        Cancel
                      </ActionButton>
                      <ActionButton variant="primary" type="submit" pending={correct.isPending}>
                        {correct.isPending ? "Saving" : "Save correction"}
                      </ActionButton>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </RowList>
        )}
      </section>
    </div>
  );
}
