"use client";

/**
 * Staff · Attendance (ADR-058, AC-T4, AC-T5, AC-T6).
 *
 * Today's sheet, worked at the desk: everyone on today's roster with a button
 * to clock them in or out, and the records beneath. A night shift that began
 * yesterday is still on today's sheet until it is clocked out, because with no
 * day named the API returns every OPEN record whatever its date.
 *
 * What the desk sees of a colleague is a roster card: a name and a job title.
 * Correcting a record is `attendance.approve`, a supervisor's; a correction
 * never edits the original, it writes a new record and marks the old one
 * superseded.
 *
 * The roster block is a sheet, not a list, and stays bespoke. The records are
 * the shared `DataView` over `ATTENDANCE_LIST` (058-list-framework): with no
 * day filter they are today's sheet, and a day filter opens any other day.
 */

import { ATTENDANCE_LIST, ListQuery, type AttendanceRecord } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import {
  useAttendancePage,
  useClockIn,
  useClockOut,
  useCorrectAttendance,
  useEmployees,
  useRosterPage,
} from "../../data/people";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, RowList, clock, fromLocalInput, inputClass, rowClass, toLocalInput } from "./staff-ui";

type Fixing = { id: string; name: string; clockInAt: string; clockOutAt: string; note: string };

export function Attendance() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const today = todayIso();
  const branches = currentGrant(state)?.branches ?? [];
  const mayRecord = can("attendance.record");
  const mayApprove = can("attendance.approve");
  const mayReadFiles = can("people.view") || can("people.manage");

  // The sheet: today's roster, and today's records to say who is in.
  const todayRoster = useRosterPage(
    workspaceId,
    ListQuery.parse({ filters: [{ field: "workDate", op: "eq", value: today }], pageSize: 100 }),
  );
  const todaySheet = useAttendancePage(workspaceId, ListQuery.parse({ pageSize: 100 }));
  const employees = useEmployees(mayRecord && mayReadFiles ? workspaceId : null, "active");
  const clockIn = useClockIn(workspaceId);
  const clockOut = useClockOut(workspaceId);
  const correct = useCorrectAttendance(workspaceId);
  const [offRoster, setOffRoster] = useState("");
  const [fixing, setFixing] = useState<Fixing | null>(null);

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, ATTENDANCE_LIST.key);
  const list = useListUrl(ATTENDANCE_LIST, "basic", defaultView);
  const page = useAttendancePage(workspaceId, list.state.query);

  const sheet = (todaySheet.data?.items ?? []).filter((r) => r.status !== "superseded");
  const openFor = (employeeId: string) => sheet.find((r) => r.status === "open" && r.employee.employeeId === employeeId);
  const onShift = (todayRoster.data?.items ?? []).filter((e) => e.status === "scheduled");

  const doClockIn = (employeeId: string, rosterEntryId?: string, name?: string) =>
    clockIn.mutate(
      { employeeId, rosterEntryId },
      { onSuccess: (r) => toast(`${name ?? r.employee.displayName} clocked in at ${clock(r.clockInAt)}`, "ok") },
    );
  const doClockOut = (r: AttendanceRecord) =>
    clockOut.mutate(
      { id: r.id },
      { onSuccess: (out) => toast(`${r.employee.displayName} clocked out at ${clock(out.clockOutAt ?? "")}`, "ok") },
    );

  // Built each render: the buttons read the pending state of their own row.
  const columns: DataColumn<AttendanceRecord>[] = [
    {
      key: "clockInAt",
      header: "In and out",
      cell: (r) => (
        <span className="pms-num">
          {clock(r.clockInAt)}–{r.clockOutAt ? clock(r.clockOutAt) : "…"}
        </span>
      ),
    },
    {
      key: "employee",
      header: "Person",
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">{r.employee.displayName}</span>
          <span className="text-2xs text-muted-foreground">
            {r.supersedesId ? `corrected: ${r.note ?? ""}` : r.source === "self" ? "clocked themselves in" : "by the desk"}
          </span>
        </span>
      ),
    },
    { key: "workDate", header: "Day", cell: (r) => <span className="pms-num">{dshortIso(r.workDate)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-wrap gap-1.5">
          <Badge intent={r.status === "open" ? "ok" : "neutral"}>
            {r.status === "open" ? "In" : r.status === "closed" ? "Closed" : "Corrected"}
          </Badge>
          {!r.validated && r.status !== "superseded" && <Badge intent="warn">Waiting for validation</Badge>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => (
        <span className="flex justify-end gap-2">
          {r.status === "open" && mayRecord && (
            <ActionButton pending={clockOut.isPending && clockOut.variables?.id === r.id} onClick={() => doClockOut(r)}>
              Clock out
            </ActionButton>
          )}
          {mayApprove && r.status !== "superseded" && fixing?.id !== r.id && (
            <ActionButton
              onClick={() =>
                setFixing({
                  id: r.id,
                  name: r.employee.displayName,
                  clockInAt: toLocalInput(r.clockInAt),
                  clockOutAt: toLocalInput(r.clockOutAt ?? new Date().toISOString()),
                  note: "",
                })
              }
            >
              Correct
            </ActionButton>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <section>
        <SectionHeading n={onShift.length}>On today&apos;s roster, {dshortIso(today)}</SectionHeading>
        {todayRoster.isPending ? null : onShift.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">Nobody is rostered today. Someone not on the roster can still be clocked in below.</EmptyState>
        ) : (
          <RowList>
            {onShift.map((entry, i) => {
              const rec = openFor(entry.employee.employeeId);
              const done = sheet.find((r) => r.rosterEntryId === entry.id && r.status === "closed");
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

      {mayRecord && mayReadFiles && (
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
                options={(employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
              />
            </Field>
          </div>
          <ActionButton type="submit" deniedReason={offRoster ? undefined : "Choose someone"}>
            Clock in
          </ActionButton>
        </form>
      )}

      {fixing && (
        <form
          className="flex flex-col gap-3 rounded-card border border-card-bd bg-card p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            correct.mutate(
              {
                id: fixing.id,
                body: {
                  clockInAt: fromLocalInput(fixing.clockInAt),
                  clockOutAt: fromLocalInput(fixing.clockOutAt),
                  note: fixing.note,
                },
              },
              {
                onSuccess: () => {
                  toast(`${fixing.name}'s times corrected`, "ok");
                  setFixing(null);
                },
              },
            );
          }}
        >
          <SectionHeading>Correct {fixing.name}&apos;s times</SectionHeading>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="In" htmlFor="fix-in">
              <Input id="fix-in" type="datetime-local" value={fixing.clockInAt} onChange={(e) => setFixing({ ...fixing, clockInAt: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Out" htmlFor="fix-out">
              <Input id="fix-out" type="datetime-local" value={fixing.clockOutAt} onChange={(e) => setFixing({ ...fixing, clockOutAt: e.target.value })} className={inputClass} />
            </Field>
            <Field label="What was wrong" htmlFor="fix-note">
              <Input id="fix-note" required value={fixing.note} onChange={(e) => setFixing({ ...fixing, note: e.target.value })} className={inputClass} />
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

      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Records</SectionHeading>
        <DataView
          spec={ATTENDANCE_LIST}
          reader="basic"
          state={list.state}
          onStateChange={list.setState}
          dropped={list.dropped}
          onDismissDropped={list.dismissDropped}
          page={page.data}
          status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
          onRetry={() => void page.refetch()}
          columns={columns}
          getRowId={(r) => r.id}
          labelOf={(r) => r.employee.displayName}
          groupKeyOf={attendanceGroupKey}
          caption="Attendance records"
          searchPlaceholder="Search a name"
          refOptions={{ branch: branches.map((b) => ({ value: b.id, label: b.name })) }}
          savedViews={savedViews}
          empty={{ title: "No clock ins here", body: "With no day chosen this is today's sheet and anything still open." }}
        />
      </section>
    </div>
  );
}

/** How the server keys each groupable field of a record. */
function attendanceGroupKey(r: AttendanceRecord, field: string): string | null {
  switch (field) {
    case "workDate":
      return r.workDate;
    case "branch":
      return r.branchId;
    case "source":
      return r.source;
    case "validated":
      return String(r.validated);
    default:
      return null;
  }
}
