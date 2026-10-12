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
 *
 * 058-time adds what each record came to (AC-TM7): late, early, worked and
 * overtime minutes, read only by those who act on them (`attendance.approve`
 * and `people.manage`), with the overtime decision beside them (AC-TM8). A
 * phone or self clock in, and one the sweep closed, waits in the validation
 * queue (AC-TM9, AC-TM4): a phone punch shows how far it was, never where. The
 * desk cannot correct a record, but it can ask for one to be put right, or for
 * a missed day (AC-TM6); those are decided on Attendance requests.
 */

import { ATTENDANCE_LIST, ListQuery, type AttendanceRecord, type ListFilter } from "@injishi/contracts";
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
import { useCreateAttendanceRequest, useDecideOvertime, useValidateAttendance } from "../../data/time";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, Reveal, RowList, clock, fromLocalInput, hoursText, inputClass, rowClass, toLocalInput } from "./staff-ui";

type Fixing = { id: string; name: string; clockInAt: string; clockOutAt: string; note: string };
type Asking = { employeeId: string; name: string; recordId: string | null; workDate: string; clockInAt: string; clockOutAt: string; reason: string };
type Overtime = { id: string; name: string; worked: number; minutes: string };

/** How a record came in, in words. */
function sourceText(r: AttendanceRecord): string {
  if (r.supersedesId) return `corrected: ${r.note ?? ""}`;
  if (r.autoClosed) return "closed by the sweep: times are a guess";
  switch (r.source) {
    case "self":
      return "clocked themselves in";
    case "phone":
      return "by phone";
    case "kiosk":
      return "at a kiosk";
    default:
      return "by the desk";
  }
}

/** The validation queue and the overtime queue, as list filters (AC-TM9, AC-TM8). */
const TO_VALIDATE: ListFilter[] = [
  { field: "validated", op: "eq", value: false },
  { field: "status", op: "eq", value: "closed" },
];
const OVERTIME_TO_DECIDE: ListFilter[] = [{ field: "overtimePending", op: "eq", value: true }];

export function Attendance() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const today = todayIso();
  const branches = currentGrant(state)?.branches ?? [];
  const mayRecord = can("attendance.record");
  const mayApprove = can("attendance.approve");
  const mayReadFiles = can("people.view") || can("people.manage");
  // The figure audience (AC-TM13): who acts on late, early and overtime.
  const figures = mayApprove || can("people.manage");

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
  const validate = useValidateAttendance(workspaceId);
  const decideOvertime = useDecideOvertime(workspaceId);
  const ask = useCreateAttendanceRequest(workspaceId);
  const [offRoster, setOffRoster] = useState("");
  const [fixing, setFixing] = useState<Fixing | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [overtime, setOvertime] = useState<Overtime | null>(null);

  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, ATTENDANCE_LIST.key);
  const reader = { view: "basic" as const, figures };
  const list = useListUrl(ATTENDANCE_LIST, reader, defaultView);
  const showQueue = (filters: ListFilter[]) => list.setState((s) => ({ ...s, query: { ...s.query, filters, page: 1 } }));
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
      wrap: true,
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <span className="whitespace-nowrap font-semibold text-foreground">{r.employee.displayName}</span>
          <span className="text-2xs text-muted-foreground">{sourceText(r)}</span>
          {r.location && (r.location.inDistanceM !== null || r.location.outDistanceM !== null) && (
            <span className="pms-num text-2xs text-muted-foreground">
              {r.location.inDistanceM !== null ? `in ${r.location.inDistanceM} m away` : "in: no location"}
              {r.location.outDistanceM !== null ? ` · out ${r.location.outDistanceM} m away` : ""}
            </span>
          )}
        </span>
      ),
    },
    ...(figures
      ? [
          {
            key: "figures",
            header: "Came to",
            cell: (r: AttendanceRecord) =>
              r.figures ? (
                <span className="pms-num flex flex-col gap-0.5 text-2xs text-ink2">
                  <span>worked {hoursText(r.figures.workedMinutes)}</span>
                  {(r.figures.lateMinutes ?? 0) > 0 && <span>late {hoursText(r.figures.lateMinutes ?? 0)}</span>}
                  {(r.figures.earlyMinutes ?? 0) > 0 && <span>left {hoursText(r.figures.earlyMinutes ?? 0)} early</span>}
                  {(r.figures.overtimeMinutes ?? 0) > 0 && (
                    <span>
                      overtime {hoursText(r.figures.overtimeMinutes ?? 0)}
                      {r.figures.approvedOvertimeMinutes === null ? ", to decide" : `, ${hoursText(r.figures.approvedOvertimeMinutes)} approved`}
                    </span>
                  )}
                </span>
              ) : null,
          } satisfies DataColumn<AttendanceRecord>,
        ]
      : []),
    { key: "workDate", header: "Day", cell: (r) => <span className="pms-num">{dshortIso(r.workDate)}</span> },
    {
      key: "status",
      header: "Status",
      wrap: true,
      cell: (r) => (
        <span className="flex flex-wrap gap-1.5">
          <Badge intent={r.status === "open" ? "ok" : "neutral"}>
            {r.status === "open" ? "In" : r.status === "closed" ? "Closed" : "Corrected"}
          </Badge>
          {!r.validated && r.status !== "superseded" && <Badge intent="warn">To validate</Badge>}
          {r.autoClosed && r.status === "closed" && <Badge intent="bad">Closed by the sweep</Badge>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      // On a narrow page the buttons stack before the table scrolls.
      wrap: true,
      cell: (r) => (
        <span className="flex justify-end gap-2 @max-4xl:flex-wrap">
          {r.status === "open" && mayRecord && (
            <ActionButton pending={clockOut.isPending && clockOut.variables?.id === r.id} onClick={() => doClockOut(r)}>
              Clock out
            </ActionButton>
          )}
          {mayApprove && r.status === "closed" && !r.validated && !r.autoClosed && (
            <ActionButton
              pending={validate.isPending && validate.variables?.id === r.id}
              onClick={() => validate.mutate({ id: r.id }, { onSuccess: () => toast(`${r.employee.displayName}'s clock in is validated`, "ok") })}
            >
              Validate
            </ActionButton>
          )}
          {figures && mayApprove && r.figures && (r.figures.overtimeMinutes ?? 0) > 0 && r.figures.approvedOvertimeMinutes === null && overtime?.id !== r.id && (
            <ActionButton
              onClick={() =>
                setOvertime({ id: r.id, name: r.employee.displayName, worked: r.figures?.overtimeMinutes ?? 0, minutes: String(r.figures?.overtimeMinutes ?? 0) })
              }
            >
              Decide overtime
            </ActionButton>
          )}
          {mayRecord && !mayApprove && r.status !== "superseded" && r.status !== "open" && asking?.recordId !== r.id && (
            <ActionButton
              onClick={() =>
                setAsking({
                  employeeId: r.employee.employeeId,
                  name: r.employee.displayName,
                  recordId: r.id,
                  workDate: r.workDate,
                  clockInAt: toLocalInput(r.clockInAt),
                  clockOutAt: toLocalInput(r.clockOutAt ?? new Date().toISOString()),
                  reason: "",
                })
              }
            >
              Ask to fix
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
    <div className="pms-enter @container flex max-w-page flex-col gap-4">
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
        <Reveal when={fixing.id}>
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
        </Reveal>
      )}

      {overtime && (
        <Reveal when={overtime.id}>
          <form
            className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              const minutes = Number(overtime.minutes);
              if (!Number.isInteger(minutes) || minutes < 0 || minutes > overtime.worked) return;
              decideOvertime.mutate(
                { id: overtime.id, approvedMinutes: minutes },
                {
                  onSuccess: () => {
                    toast(`${minutes} of ${overtime.worked} overtime minutes approved for ${overtime.name}`, "ok");
                    setOvertime(null);
                  },
                },
              );
            }}
          >
            <div className="min-w-0 flex-1">
              <Field label={`Overtime to approve for ${overtime.name}`} hint={`Up to the ${overtime.worked} worked. Only what is approved reaches pay.`} htmlFor="ot-minutes">
                <Input id="ot-minutes" inputMode="numeric" value={overtime.minutes} onChange={(e) => setOvertime({ ...overtime, minutes: e.target.value.replace(/\D/g, "") })} className={inputClass} />
              </Field>
            </div>
            <ActionButton type="button" onClick={() => setOvertime(null)}>
              Cancel
            </ActionButton>
            <ActionButton
              variant="primary"
              type="submit"
              pending={decideOvertime.isPending}
              deniedReason={Number(overtime.minutes) > overtime.worked ? `At most ${overtime.worked}` : undefined}
            >
              Approve
            </ActionButton>
            <div className="w-full">
              <FormError error={decideOvertime.error} />
            </div>
          </form>
        </Reveal>
      )}

      {mayRecord && !asking && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-sm text-muted-foreground">
            Somebody forgot to clock in, or the times are wrong? Ask for it to be put right; a supervisor decides.
          </span>
          <ActionButton
            onClick={() =>
              setAsking({ employeeId: "", name: "", recordId: null, workDate: today, clockInAt: `${today}T08:00`, clockOutAt: `${today}T16:00`, reason: "" })
            }
          >
            Ask for a missed day
          </ActionButton>
        </div>
      )}

      {asking && (
        <Reveal when={asking.recordId ?? asking.employeeId}>
          <form
            className="flex flex-col gap-3 rounded-card border border-card-bd bg-card p-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!asking.employeeId || asking.reason.trim().length < 3) return;
              ask.mutate(
                {
                  employeeId: asking.employeeId,
                  workDate: asking.clockInAt.slice(0, 10),
                  clockInAt: fromLocalInput(asking.clockInAt),
                  clockOutAt: fromLocalInput(asking.clockOutAt),
                  recordId: asking.recordId,
                  reason: asking.reason.trim(),
                },
                {
                  onSuccess: (r) => {
                    toast(`Asked. ${r.routedTo ? `It goes to ${r.routedTo.displayName}` : "A supervisor decides it"}`, "ok");
                    setAsking(null);
                  },
                },
              );
            }}
          >
            <SectionHeading>{asking.recordId ? `Ask to fix ${asking.name}'s times` : "Ask for a missed day"}</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              {!asking.recordId && (
                <Field label="Person">
                  <SelectField
                    label="Person"
                    value={asking.employeeId}
                    onChange={(v) => setAsking({ ...asking, employeeId: v })}
                    placeholder="Choose someone"
                    options={
                      mayReadFiles
                        ? (employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))
                        : [...new Map(onShift.map((e) => [e.employee.employeeId, e.employee.displayName])).entries()].map(([value, label]) => ({ value, label }))
                    }
                  />
                </Field>
              )}
              <Field label="Why" htmlFor="ask-reason">
                <Input id="ask-reason" required value={asking.reason} onChange={(e) => setAsking({ ...asking, reason: e.target.value })} className={inputClass} />
              </Field>
              <Field label="In" htmlFor="ask-in">
                <Input id="ask-in" type="datetime-local" value={asking.clockInAt} onChange={(e) => setAsking({ ...asking, clockInAt: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Out" htmlFor="ask-out">
                <Input id="ask-out" type="datetime-local" value={asking.clockOutAt} onChange={(e) => setAsking({ ...asking, clockOutAt: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <FormError error={ask.error} />
            <div className="flex justify-end gap-2">
              <ActionButton type="button" onClick={() => setAsking(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                type="submit"
                pending={ask.isPending}
                deniedReason={!asking.employeeId ? "Choose someone" : asking.reason.trim().length < 3 ? "Say why" : undefined}
              >
                {ask.isPending ? "Asking" : "Ask"}
              </ActionButton>
            </div>
          </form>
        </Reveal>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeading n={page.data?.total}>Records</SectionHeading>
          <span className="flex-1" />
          {mayApprove && <ActionButton onClick={() => showQueue(TO_VALIDATE)}>To validate</ActionButton>}
          {figures && mayApprove && <ActionButton onClick={() => showQueue(OVERTIME_TO_DECIDE)}>Overtime to decide</ActionButton>}
          {(mayApprove || figures) && <ActionButton onClick={() => showQueue([])}>Today&apos;s sheet</ActionButton>}
        </div>
        <FormError error={validate.error} />
        <DataView
          spec={ATTENDANCE_LIST}
          reader={reader}
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
