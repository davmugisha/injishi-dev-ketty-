"use client";

/**
 * HR · Roster: who works which shift, a week at a time (HR module, Phase 5 —
 * first pass, no ADR yet).
 *
 * THE GRID IS PAINTED, NOT FILLED IN. A week for twenty people is a hundred
 * and forty cells, and a dropdown in each would be a hundred and forty
 * dropdowns. So a shift is chosen ONCE, above the grid, and then every cell
 * pressed takes it; pressing a cell that already has that shift clears it,
 * and "Clear" is a brush of its own. Writing a week is a row of presses.
 *
 * A DAY ON APPROVED LEAVE CANNOT BE PAINTED. The cell says "Leave" instead of
 * offering a shift, and the API refuses it too for anyone who gets round the
 * grid.
 *
 * The shifts themselves (Morning, Evening, Night) are set up once, under the
 * grid, and then left alone. A shift that is retired stays on the weeks it was
 * worked: the past roster keeps saying what happened.
 */

import { Input } from "@injishi/ui";
import { CalendarRange, ChevronLeft, ChevronRight, Clock, Copy, Eraser, Plus, Users } from "lucide-react";
import { Fragment, useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, Chip, EmptyState, LoadFailed, SectionHeading, Skeleton, StatCard } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useAssignShift,
  useCopyRosterWeek,
  useCreateShift,
  useRetireShift,
  useRosterWeek,
  useUpdateShift,
  type RosterWeek,
  type Shift,
} from "../data/hr-time";
import { addDaysIso, dayPartsIso, dshortIso } from "../lib/format";
import { usePms } from "../store";
import {
  Eyebrow,
  Field,
  FormError,
  Person,
  RowList,
  hoursText,
  inputClass,
  panelClass,
  rowClass,
  shiftColor,
  shiftHours,
} from "./hr-ui";

/** What a press on a cell does: put this shift there, or take away whatever is. */
type Brush = { kind: "shift"; shiftId: string } | { kind: "clear" };

/** The three shifts a hotel most often runs, offered where there are none yet. */
const USUAL_SHIFTS = [
  { name: "Morning", startTime: "07:00", endTime: "15:00", graceMinutes: 10, colorSlot: 1 },
  { name: "Evening", startTime: "15:00", endTime: "23:00", graceMinutes: 10, colorSlot: 3 },
  { name: "Night", startTime: "23:00", endTime: "07:00", graceMinutes: 10, colorSlot: 5 },
] as const;

const stepClass =
  "flex size-9 cursor-pointer items-center justify-center rounded border border-card-bd bg-card text-ink2 hover:bg-hover";

export function Roster() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { toast, toastError } = usePms();

  // `null` is this week, which the API works out on the hotel's own clock.
  const [from, setFrom] = useState<string | null>(null);
  const week = useRosterWeek(workspaceId, from);
  const assign = useAssignShift(workspaceId);
  const copy = useCopyRosterWeek(workspaceId);
  const createShift = useCreateShift(workspaceId);

  const [brush, setBrush] = useState<Brush | null>(null);
  // The cells whose press is still on its way to the server.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [seeding, setSeeding] = useState(false);

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (week.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={84} />
        <Skeleton height={320} delay={60} />
      </div>
    );
  }

  if (week.isError) {
    return (
      <LoadFailed onRetry={() => void week.refetch()} retrying={week.isFetching}>
        We couldn&apos;t load the roster. This is on our side.
      </LoadFailed>
    );
  }

  const data = week.data;
  const offered = data.shifts.filter((s) => s.isActive);
  const shiftById = new Map(data.shifts.map((s) => [s.id, s]));
  const cellKey = (memberId: string, day: string) => `${memberId}|${day}`;
  const assigned = new Map(data.assignments.map((a) => [cellKey(a.departmentMemberId, a.workDate), a.shiftId]));
  const onLeave = (memberId: string, day: string) =>
    data.leave.some((l) => l.departmentMemberId === memberId && l.startDate <= day && day <= l.endDate);

  // With nothing chosen, the first shift is the brush: the grid is never dead.
  const active: Brush | null =
    brush && (brush.kind === "clear" || offered.some((s) => s.id === brush.shiftId))
      ? brush
      : offered[0]
        ? { kind: "shift", shiftId: offered[0].id }
        : null;

  const paint = (memberId: string, day: string) => {
    if (!active) return;
    const key = cellKey(memberId, day);
    const current = assigned.get(key) ?? null;
    // The same shift again takes it off, so a slip is one more press to undo.
    const next = active.kind === "clear" || current === active.shiftId ? null : active.shiftId;
    if (next === current) return;
    setBusy((cells) => new Set(cells).add(key));
    assign.mutate(
      { departmentMemberId: memberId, workDate: day, shiftId: next },
      {
        onError: (error) => toastError(error),
        onSettled: () =>
          setBusy((cells) => {
            const rest = new Set(cells);
            rest.delete(key);
            return rest;
          }),
      },
    );
  };

  const seedUsualShifts = async () => {
    setSeeding(true);
    try {
      for (const shift of USUAL_SHIFTS) await createShift.mutateAsync(shift);
      toast("Morning, Evening and Night shifts added", "ok");
    } catch (error) {
      toastError(error);
    } finally {
      setSeeding(false);
    }
  };

  const rosteredPeople = new Set(data.assignments.map((a) => a.departmentMemberId)).size;
  const minutes = data.assignments.reduce((n, a) => n + (shiftById.get(a.shiftId)?.minutes ?? 0), 0);
  const isThisWeek = data.from <= data.today && data.today <= data.to;

  // People arrive sorted by department, then name, so a run of rows is a department.
  const departments: { name: string; people: RosterWeek["people"] }[] = [];
  for (const person of data.people) {
    const name = person.departmentName ?? "No department";
    const last = departments[departments.length - 1];
    if (last && last.name === name) last.people.push(person);
    else departments.push({ name, people: [person] });
  }

  return (
    <div className="pms-enter relative flex max-w-page flex-col gap-6">
      <section aria-label="The week at a glance" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard n={String(data.assignments.length)} label="Shifts rostered this week" />
        <StatCard n={`${rosteredPeople} of ${data.people.length}`} label="People with at least one shift" />
        <StatCard n={minutes > 0 ? hoursText(minutes) : "0 h"} label="Hours scheduled" />
        <StatCard n={String(data.people.length - rosteredPeople)} label="People with no shift yet" />
      </section>

      <section>
        <SectionHeading
          icon={CalendarRange}
          action={
            <span className="flex flex-wrap items-center gap-2">
              <ActionButton
                icon={Copy}
                pending={copy.isPending}
                deniedReason={offered.length === 0 ? "Add a shift first" : undefined}
                onClick={() =>
                  copy.mutate(
                    { from: addDaysIso(data.from, -7), to: data.from },
                    {
                      onSuccess: (result) =>
                        toast(
                          result.copied > 0
                            ? `${result.copied} ${result.copied === 1 ? "shift" : "shifts"} copied from the week before`
                            : "Nothing to copy: the week before is empty, or every day here is already written",
                          result.copied > 0 ? "ok" : "warn",
                        ),
                      onError: toastError,
                    },
                  )
                }
              >
                Copy the week before
              </ActionButton>
            </span>
          }
        >
          Roster
        </SectionHeading>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" aria-label="The week before" onClick={() => setFrom(addDaysIso(data.from, -7))} className={stepClass}>
            <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
          <span className="pms-num min-w-52 text-center text-sm font-semibold text-ink" aria-live="polite">
            {dshortIso(data.from)} to {dshortIso(data.to)} {data.to.slice(0, 4)}
          </span>
          <button type="button" aria-label="The week after" onClick={() => setFrom(addDaysIso(data.from, 7))} className={stepClass}>
            <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
          {isThisWeek ? <Badge intent="accent">This week</Badge> : <ActionButton onClick={() => setFrom(null)}>Back to this week</ActionButton>}
        </div>

        {offered.length === 0 ? (
          <EmptyState icon={Clock} className="mt-2.5">
            <span className="flex flex-col items-start gap-3">
              <span>
                No shifts yet. Add the shifts you run, then press the days each person works. Most hotels start from a
                morning, an evening and a night shift.
              </span>
              <ActionButton variant="primary" icon={Plus} pending={seeding} onClick={() => void seedUsualShifts()}>
                Add Morning, Evening and Night
              </ActionButton>
            </span>
          </EmptyState>
        ) : data.people.length === 0 ? (
          <EmptyState icon={Users} className="mt-2.5">
            Nobody to roster yet. Add people on the Employees tab.
          </EmptyState>
        ) : (
          <>
            {/* The brush: chosen once, then every press on the grid uses it. */}
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="What a press on the grid does">
              <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Paint with</span>
              {offered.map((s) => (
                <Chip
                  key={s.id}
                  size="sm"
                  label={`${s.name} · ${s.startTime} to ${s.endTime}`}
                  dot={shiftColor(s)}
                  active={active?.kind === "shift" && active.shiftId === s.id}
                  onClick={() => setBrush({ kind: "shift", shiftId: s.id })}
                />
              ))}
              <Chip size="sm" label="Clear" icon={Eraser} active={active?.kind === "clear"} onClick={() => setBrush({ kind: "clear" })} />
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">
              Choose a shift, then press each day it covers. Pressing a day that already has that shift takes it off.
            </p>

            <div className={cn(panelClass, "mt-2.5 overflow-x-auto")}>
              <table className="w-full min-w-[56rem] border-collapse text-sm">
                <caption className="sr-only">
                  Roster for {dshortIso(data.from)} to {dshortIso(data.to)}
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="w-56 px-[18px] py-2.5 text-left">
                      <Eyebrow>Person</Eyebrow>
                    </th>
                    {data.days.map((day) => {
                      const { wd, dd, weekend } = dayPartsIso(day);
                      const isToday = day === data.today;
                      return (
                        <th key={day} scope="col" className={cn("px-1 py-2.5 text-center", isToday && "bg-accent-soft")}>
                          <span className={cn("flex flex-col items-center leading-tight", weekend && !isToday && "text-muted-foreground")}>
                            <span className="text-2xs font-bold tracking-[0.05em] uppercase">{wd}</span>
                            <span className={cn("pms-num text-sm font-semibold", isToday ? "text-accent-text" : "text-ink")}>{dd}</span>
                          </span>
                        </th>
                      );
                    })}
                    <th scope="col" className="px-[18px] py-2.5 text-right">
                      <Eyebrow>Hours</Eyebrow>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <Fragment key={department.name}>
                      <tr className="border-b border-line bg-field">
                        <th scope="colgroup" colSpan={data.days.length + 2} className="px-[18px] py-1.5 text-left">
                          <Eyebrow>{department.name}</Eyebrow>
                        </th>
                      </tr>
                      {department.people.map((person) => {
                        const name = person.name ?? "Unknown";
                        const personMinutes = data.days.reduce(
                          (n, day) => n + (shiftById.get(assigned.get(cellKey(person.departmentMemberId, day)) ?? "")?.minutes ?? 0),
                          0,
                        );
                        return (
                          <tr key={person.departmentMemberId} className="border-b border-line last:border-b-0">
                            <th scope="row" className="px-[18px] py-2 text-left font-normal">
                              <Person name={name} detail={person.jobTitle ?? undefined} />
                            </th>
                            {data.days.map((day) => {
                              const key = cellKey(person.departmentMemberId, day);
                              const shift = shiftById.get(assigned.get(key) ?? "");
                              const isToday = day === data.today;
                              return (
                                <td key={day} className={cn("p-1 align-middle", isToday && "bg-accent-soft")}>
                                  {onLeave(person.departmentMemberId, day) ? (
                                    <span className="flex h-12 items-center justify-center rounded bg-info-bg text-2xs font-semibold text-info">
                                      Leave
                                    </span>
                                  ) : (
                                    <Cell
                                      shift={shift}
                                      busy={busy.has(key)}
                                      past={day < data.today}
                                      label={`${name}, ${dshortIso(day)}: ${shift ? `${shift.name}, ${shiftHours(shift)}` : "off"}`}
                                      onPress={() => paint(person.departmentMemberId, day)}
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="pms-num px-[18px] py-2 text-right text-sm font-semibold whitespace-nowrap text-ink">
                              {personMinutes > 0 ? hoursText(personMinutes) : <span className="font-normal text-faint">0 h</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-field">
                    <th scope="row" className="px-[18px] py-2 text-left">
                      <Eyebrow>On shift</Eyebrow>
                    </th>
                    {data.days.map((day) => {
                      const count = data.assignments.filter((a) => a.workDate === day).length;
                      return (
                        <td key={day} className={cn("pms-num px-1 py-2 text-center text-sm font-semibold", count === 0 ? "text-faint" : "text-ink")}>
                          {count}
                        </td>
                      );
                    })}
                    <td className="pms-num px-[18px] py-2 text-right text-sm font-bold whitespace-nowrap text-ink">
                      {minutes > 0 ? hoursText(minutes) : "0 h"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      <Shifts shifts={data.shifts} />
    </div>
  );
}

/** One day for one person: the shift they are on, or an empty day waiting for one. */
function Cell({
  shift,
  busy,
  past,
  label,
  onPress,
}: {
  shift: Shift | undefined;
  busy: boolean;
  /** Already gone. Still correctable, but drawn quieter than the days ahead. */
  past: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy}
      onClick={onPress}
      className={cn(
        "flex h-12 w-full cursor-pointer flex-col justify-center rounded border px-2 text-left transition-colors duration-quick",
        shift ? "border-card-bd bg-card hover:bg-hover" : "border-dashed border-line2 bg-transparent hover:bg-hover",
        (busy || past) && "opacity-60",
      )}
      // The shift's colour as the leading edge, with its name beside it: the
      // colour finds the shift on the grid, the word says which it is.
      style={shift ? { borderLeftWidth: 4, borderLeftColor: shiftColor(shift) } : undefined}
    >
      {shift ? (
        <>
          <span className="truncate text-2xs font-semibold text-ink">{shift.name}</span>
          <span className="pms-num truncate text-2xs text-muted-foreground">
            {shift.startTime} to {shift.endTime}
          </span>
        </>
      ) : (
        <span className="text-center text-2xs text-faint">Off</span>
      )}
    </button>
  );
}

/* ── The shifts themselves ──────────────────────────────────────────────── */

const BLANK = { name: "", startTime: "07:00", endTime: "15:00", graceMinutes: "10", colorSlot: 1 };

/** The shifts the business runs: set up once, then mostly left alone. */
function Shifts({ shifts }: { shifts: readonly Shift[] }) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const retire = useRetireShift(workspaceId);
  // `"new"` is the add form; an id is that shift being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const offered = shifts.filter((s) => s.isActive);

  return (
    <section>
      <SectionHeading
        n={offered.length}
        icon={Clock}
        action={
          editing === null && (
            <ActionButton icon={Plus} onClick={() => setEditing("new")}>
              Add a shift
            </ActionButton>
          )
        }
      >
        Shifts
      </SectionHeading>

      {editing === "new" && <ShiftForm shift={null} onDone={() => setEditing(null)} />}

      {offered.length === 0 ? (
        editing === null && (
          <EmptyState icon={Clock} className="mt-2.5">
            No shifts yet. A shift is a name and the hours it runs.
          </EmptyState>
        )
      ) : (
        <RowList>
          {offered.map((s, i) =>
            editing === s.id ? (
              <div key={s.id} className={rowClass(i)}>
                <ShiftForm shift={s} onDone={() => setEditing(null)} inRow />
              </div>
            ) : (
              <div key={s.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                <span aria-hidden className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: shiftColor(s) }} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{s.name}</span>
                  <span className="pms-num text-2xs text-muted-foreground">
                    {shiftHours(s)} · {hoursText(s.minutes)}
                    {s.overnight ? " · ends the next morning" : ""} · on time up to {s.graceMinutes} min after the start
                  </span>
                </span>
                <ActionButton onClick={() => setEditing(s.id)}>Edit</ActionButton>
                <ActionButton
                  pending={retire.isPending && retire.variables?.shiftId === s.id}
                  onClick={() =>
                    retire.mutate(
                      { shiftId: s.id },
                      { onSuccess: () => toast(`${s.name} is no longer offered. Past weeks keep it.`, "ok"), onError: toastError },
                    )
                  }
                >
                  Retire
                </ActionButton>
              </div>
            ),
          )}
        </RowList>
      )}
    </section>
  );
}

function ShiftForm({ shift, onDone, inRow = false }: { shift: Shift | null; onDone: () => void; inRow?: boolean }) {
  const workspaceId = useWorkspaceId();
  const { toast } = usePms();
  const create = useCreateShift(workspaceId);
  const update = useUpdateShift(workspaceId);
  const [draft, setDraft] = useState(
    shift
      ? {
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          graceMinutes: String(shift.graceMinutes),
          colorSlot: shift.colorSlot,
        }
      : BLANK,
  );
  const id = shift?.id ?? "new";
  const error = create.error ?? update.error;
  const overnight = draft.endTime <= draft.startTime;

  return (
    <form
      className={cn("flex flex-col gap-4", !inRow && cn(panelClass, "mt-2.5 p-5"))}
      onSubmit={(ev) => {
        ev.preventDefault();
        const body = {
          name: draft.name.trim(),
          startTime: draft.startTime,
          endTime: draft.endTime,
          graceMinutes: Math.max(0, Math.round(Number(draft.graceMinutes) || 0)),
          colorSlot: draft.colorSlot,
        };
        const done = { onSuccess: (saved: Shift) => (toast(`${saved.name} saved`, "ok"), onDone()) };
        if (shift) update.mutate({ shiftId: shift.id, body }, done);
        else create.mutate(body, done);
      }}
    >
      {!inRow && <SectionHeading>Add a shift</SectionHeading>}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Field label="Name" htmlFor={`shift-name-${id}`}>
            <Input
              id={`shift-name-${id}`}
              required
              minLength={2}
              maxLength={40}
              placeholder="Morning"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Starts" htmlFor={`shift-start-${id}`}>
          <Input
            id={`shift-start-${id}`}
            required
            type="time"
            value={draft.startTime}
            onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Ends" hint={overnight ? "The next morning." : undefined} htmlFor={`shift-end-${id}`}>
          <Input
            id={`shift-end-${id}`}
            required
            type="time"
            value={draft.endTime}
            onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Grace, in minutes" hint="How long after the start somebody is still on time." htmlFor={`shift-grace-${id}`}>
            <Input
              id={`shift-grace-${id}`}
              type="number"
              min={0}
              max={120}
              value={draft.graceMinutes}
              onChange={(e) => setDraft({ ...draft, graceMinutes: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Colour on the roster">
            <div role="radiogroup" aria-label="Colour on the roster" className="flex h-10 items-center gap-2">
              {[1, 2, 3, 4, 5].map((slot) => (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={draft.colorSlot === slot}
                  aria-label={`Colour ${slot} of 5`}
                  onClick={() => setDraft({ ...draft, colorSlot: slot })}
                  className={cn(
                    "size-8 cursor-pointer rounded-full border-2",
                    draft.colorSlot === slot ? "border-ink" : "border-transparent",
                  )}
                  style={{ background: `var(--chart-${slot})`, backgroundClip: "content-box", padding: 3 }}
                />
              ))}
            </div>
          </Field>
        </div>
      </div>
      <FormError error={error} />
      <div className="flex justify-end gap-2">
        <ActionButton onClick={onDone}>Cancel</ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending || update.isPending}>
          {shift ? "Save shift" : "Add shift"}
        </ActionButton>
      </div>
    </form>
  );
}
