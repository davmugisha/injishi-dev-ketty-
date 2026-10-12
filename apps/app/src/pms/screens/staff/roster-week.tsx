"use client";

/**
 * Staff · Roster · the week grid (ADR-058, 058-time AC-TM1, AC-TM14).
 *
 * One branch, Monday to Sunday, a row per person and a column per day. New
 * shifts are drafts: only those who manage the roster see them, marked as such,
 * until somebody publishes the week (or one department of it), and then every
 * person whose shifts were published is told once. A shift added to a week
 * already published is published as it is made. Rotation shifts and shifts
 * that came from an approved request say so.
 *
 * The desk reads the same grid without the drafts (the server leaves them
 * out), and without the publish bar.
 *
 * WHOEVER MANAGES THE ROSTER EDITS IT IN PLACE. The grid used to be a picture
 * of the roster: a shift was added one at a time through the form below it,
 * and changing one meant cancelling it in the list and adding another. Now
 * every day of every person is a button: pressing it opens the branch's
 * shifts, the one that day is on ticked, and choosing another moves the day to
 * it; "Day off" takes the day's shift away. Every active person of the branch
 * has a row, so somebody with no shift yet can be given one. "Copy last week"
 * fills the empty days of the week in view from the week before.
 *
 * It writes through the two roster commands that already existed: add, and
 * cancel with a reason. A move is a cancel and an add, so the server's own
 * refusals (on approved leave, an overlap, a branch out of reach) arrive in
 * its words and the day is left as it was.
 *
 * A SHIFT HAS A SHADE, so a week reads at a glance: who is on mornings, where
 * the nights fall, which day is thin. The shades are the design system's one
 * ramp (`--chart-1` to `--chart-5`), lightest for the shift that starts
 * earliest and darkest for the latest, so the colour says the time of day and
 * needs no legend to be learned twice. It is never the only sign: every shift
 * still carries its name and its hours in ink, and the key above the grid
 * names each shade.
 */

import type { RosterEntry } from "@injishi/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@injishi/ui";
import { useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useDepartments } from "../../data/ops";
import { useCancelRosterEntry, useEmployees, useRosterEntry, useShiftTemplates } from "../../data/people";
import { usePublishRoster, useRosterWeek } from "../../data/time";
import { addDaysIso, dayPartsIso, dshortIso, kigaliDateOf, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Avatar, FACE, WITH_FACE } from "./staff-look";
import { FormError, clock } from "./staff-ui";

/** The department filter's "no filter": an empty key would read as a blank selection. */
const EVERY = "every";

/** The menu's choice that takes a day's shift away, beside the shift ids it otherwise holds. */
const DAY_OFF = "off";

/**
 * The shades a shift may wear, earliest start first: the chart ramp from its
 * lightest step to its darkest. Four steps for up to four shifts, which is
 * what a hotel runs (morning, day, evening, night); a fifth takes the middle
 * step, and past five the latest shifts share the darkest.
 */
const SHADES: readonly (readonly string[])[] = [
  [],
  ["--chart-3"],
  ["--chart-5", "--chart-1"],
  ["--chart-5", "--chart-3", "--chart-1"],
  ["--chart-5", "--chart-4", "--chart-2", "--chart-1"],
  ["--chart-5", "--chart-4", "--chart-3", "--chart-2", "--chart-1"],
];

/** A shift's shade as a tint behind its name and a bar at its edge. Text stays in ink. */
function shadeStyle(token: string | undefined): CSSProperties | undefined {
  if (!token) return undefined;
  return {
    backgroundColor: `color-mix(in oklab, var(${token}) 24%, var(--card))`,
    borderLeft: `3px solid var(${token})`,
  };
}

/** The small square that names a shade in the key and the menu. */
function Swatch({ token }: { token: string | undefined }) {
  return (
    <span
      aria-hidden
      className="inline-block size-3 shrink-0 rounded-[3px] border border-line2"
      style={token ? { backgroundColor: `var(${token})`, borderColor: `var(${token})` } : undefined}
    />
  );
}

/** Why a shift was cancelled, when the roster itself moved or removed it. */
const CHANGED = "Changed on the roster";

/** The Monday of the week a date is in. */
export function mondayIso(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDaysIso(date, -((day + 6) % 7));
}

export function RosterWeekGrid() {
  const { state, toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const branches = currentGrant(state)?.branches ?? [];
  const [chosenBranch, setChosenBranch] = useState("");
  const [department, setDepartment] = useState(EVERY);
  const [from, setFrom] = useState(() => mondayIso(todayIso()));
  const propertyId = chosenBranch || branches[0]?.id || "";
  const departmentId = department === EVERY ? "" : department;
  const week = useRosterWeek(workspaceId, propertyId, from);
  const departments = useDepartments(workspaceId);
  const publish = usePublishRoster(workspaceId);
  const mayRoster = can("roster.manage");
  const today = todayIso();

  // The branch's shifts, for the key and the shades; the hook asks only for
  // whoever may read them, and the desk may. Then, for whoever manages the
  // roster: the people to give shifts to, and last week to copy from.
  const templates = useShiftTemplates(workspaceId);
  const staff = useEmployees(mayRoster ? workspaceId : null, "active");
  const lastWeek = useRosterWeek(mayRoster ? workspaceId : null, propertyId, addDaysIso(from, -7));
  const add = useRosterEntry(workspaceId);
  const cancel = useCancelRosterEntry(workspaceId);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const shifts = (templates.data?.templates ?? [])
    .filter((t) => t.propertyId === propertyId && t.status === "active")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.name.localeCompare(b.name));
  // Earliest start lightest, latest darkest. By rank among the branch's
  // shifts rather than by the clock, so two shifts never share a shade until
  // there are more shifts than steps.
  const ramp = SHADES[Math.min(shifts.length, SHADES.length - 1)];
  const shadeOf = new Map(shifts.map((shift, index) => [shift.id, ramp[Math.min(index, ramp.length - 1)]]));

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(from, i));
  const branchDepartments = (departments.data?.departments ?? []).filter(
    (d) => d.status === "active" && (d.propertyId === propertyId || d.propertyId === null),
  );
  const entries = (week.data?.entries ?? []).filter(
    (e) => e.status === "scheduled" && (!departmentId || e.departmentId === departmentId),
  );
  // Whoever is on a shift this week, and, for somebody editing with no
  // department filter on, everybody who works at the branch: a person with no
  // shift yet still needs a row to be given one on.
  const onShift = entries.map((e) => e.employee);
  const atBranch =
    mayRoster && !departmentId
      ? (staff.data ?? [])
          .filter((e) => e.workPropertyId === propertyId)
          .map((e) => ({ employeeId: e.id, displayName: e.displayName, jobPositionTitle: e.jobPositionTitle }))
      : [];
  const people = [...new Map([...atBranch, ...onShift].map((p) => [p.employeeId, p])).values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const drafts = entries.filter((e) => e.publishedAt === null).length;
  const cell = (employeeId: string, day: string): RosterEntry[] =>
    entries
      .filter((e) => e.employee.employeeId === employeeId && e.workDate === day)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  /**
   * Put a day on the shift chosen from its menu, or take its shift away. One
   * change at a time a day, the commands in order, and the first refusal stops
   * it and is said.
   */
  async function assign(employeeId: string, name: string, day: string, choice: string) {
    const key = `${employeeId}:${day}`;
    if (busy.has(key)) return;
    const here = cell(employeeId, day);
    const target = choice === DAY_OFF ? null : (shifts.find((s) => s.id === choice) ?? null);
    if (choice !== DAY_OFF && !target) return;
    if (target && here.length === 1 && here[0].shiftTemplateId === target.id) return;
    if (!target && here.length === 0) return;
    setBusy((b) => new Set(b).add(key));
    try {
      for (const entry of here) await cancel.mutateAsync({ id: entry.id, reason: CHANGED });
      if (target) await add.mutateAsync({ employeeId, shiftTemplateId: target.id, workDate: day });
      toast(target ? `${name}: ${target.name} on ${dshortIso(day)}` : `${name}: off on ${dshortIso(day)}`, "ok");
    } catch (error) {
      toastError(error);
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(key);
        return next;
      });
    }
  }

  /** Give every empty day of this week the shift the same person had seven days before. */
  async function copyLastWeek() {
    if (copying) return;
    const taken = new Set(entries.map((e) => `${e.employee.employeeId}:${e.workDate}`));
    const wanted = (lastWeek.data?.entries ?? [])
      .filter((e) => e.status === "scheduled")
      .map((e) => ({ employeeId: e.employee.employeeId, shiftTemplateId: e.shiftTemplateId, workDate: addDaysIso(e.workDate, 7) }))
      .filter((e) => !taken.has(`${e.employeeId}:${e.workDate}`));
    if (wanted.length === 0) {
      toast("Nothing to copy: last week is empty, or every day it covers is already filled here.", "warn");
      return;
    }
    setCopying(true);
    let copied = 0;
    let refused = 0;
    for (const shift of wanted) {
      try {
        await add.mutateAsync(shift);
        copied += 1;
      } catch {
        // On leave that day, or left since: that day stays empty, the rest go on.
        refused += 1;
      }
    }
    setCopying(false);
    toast(
      `${copied} shift${copied === 1 ? "" : "s"} copied from last week${refused > 0 ? `; ${refused} left out (somebody is on leave or no longer here)` : ""}.`,
      copied > 0 ? "ok" : "warn",
    );
  }

  const doPublish = () =>
    publish.mutate(
      { propertyId, departmentId: departmentId || null, from, to: days[6] },
      {
        onSuccess: (p) =>
          toast(
            p.entryCount === 0
              ? `${dshortIso(from)} to ${dshortIso(days[6])} is published; shifts added to it now go out at once`
              : `${p.entryCount} shift${p.entryCount === 1 ? "" : "s"} published, and everyone on them told`,
            "ok",
          ),
      },
    );

  return (
    <section className="flex flex-col gap-3" aria-label="Week">
      <div className="flex flex-wrap items-end gap-3">
        <SectionHeading>
          Week of {dshortIso(from)}
        </SectionHeading>
        <span className="flex-1" />
        {branches.length > 1 && (
          <div className="w-56">
            <SelectField
              label="Branch"
              value={propertyId}
              onChange={(v) => {
                setChosenBranch(v);
                setDepartment(EVERY);
              }}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </div>
        )}
        {branchDepartments.length > 0 && (
          <div className="w-56">
            <SelectField
              label="Department"
              value={department}
              onChange={(v) => setDepartment(v || EVERY)}
              options={[{ value: EVERY, label: "Every department" }, ...branchDepartments.map((d) => ({ value: d.id, label: d.name }))]}
            />
          </div>
        )}
        <span className="flex gap-2">
          <ActionButton onClick={() => setFrom(addDaysIso(from, -7))}>Previous week</ActionButton>
          <ActionButton onClick={() => setFrom(mondayIso(today))} deniedReason={from === mondayIso(today) ? "This is this week" : undefined}>
            This week
          </ActionButton>
          <ActionButton onClick={() => setFrom(addDaysIso(from, 7))}>Next week</ActionButton>
        </span>
      </div>

      {mayRoster && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-card-bd bg-card px-4 py-3">
          <span className="flex-1 text-sm text-ink2">
            {drafts === 0
              ? "No drafts this week. Publishing still records it, so shifts added to it later go out at once."
              : `${drafts} draft${drafts === 1 ? "" : "s"} only you and other roster managers can see.`}
          </span>
          <ActionButton variant="primary" pending={publish.isPending} onClick={doPublish} deniedReason={propertyId ? undefined : "Choose a branch"}>
            {publish.isPending ? "Publishing" : drafts === 0 ? "Publish this week" : `Publish ${drafts} draft${drafts === 1 ? "" : "s"}`}
          </ActionButton>
          <div className="w-full">
            <FormError error={publish.error} />
          </div>
        </div>
      )}

      {(shifts.length > 0 || mayRoster) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-roster-key>
          <ul aria-label="Shifts at this branch, and the shade of each" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {shifts.map((shift) => (
              <li key={shift.id} className="flex items-center gap-1.5 text-2xs text-ink2">
                <Swatch token={shadeOf.get(shift.id)} />
                <span className="font-semibold text-ink">{shift.name}</span>
                <span className="pms-num">
                  {shift.startsAt}–{shift.endsAt}
                </span>
              </li>
            ))}
          </ul>
          {mayRoster && (
            <>
              <span className="text-2xs text-muted-foreground">
                {shifts.length === 0
                  ? "This branch has no shift yet. Add one under Shifts below, then give it to people here."
                  : "Press any day to choose its shift."}
              </span>
              <span className="ml-auto">
                <ActionButton pending={copying} deniedReason={lastWeek.isPending ? "Reading last week." : undefined} onClick={() => void copyLastWeek()}>
                  {copying ? "Copying" : "Copy last week"}
                </ActionButton>
              </span>
            </>
          )}
        </div>
      )}

      {week.isError ? (
        <EmptyState className="p-5">The week could not be read. Try again in a moment.</EmptyState>
      ) : people.length === 0 ? (
        <EmptyState className="p-5">
          {week.isPending
            ? "Reading the week…"
            : mayRoster
              ? "Nobody works at this branch yet. Give people a branch on their file, and they appear here."
              : "Nobody is on a shift this week here."}
        </EmptyState>
      ) : (
        // Seven days and a name have to fit a 1366 pixel laptop: the day is two
        // short lines, the cells are close, and on the narrowest screens a shift
        // shows its name alone (its hours are in the key above, and on hover).
        <div className="@container overflow-x-auto rounded-card border border-card-bd bg-card">
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">Shifts of the week of {dshortIso(from)}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-card px-3 py-2 text-left text-2xs font-bold text-muted-foreground">
                  Person
                </th>
                {days.map((d) => {
                  const parts = dayPartsIso(d);
                  return (
                    <th
                      key={d}
                      scope="col"
                      aria-current={d === today ? "date" : undefined}
                      className="px-1.5 py-2 text-left text-2xs font-bold text-muted-foreground"
                    >
                      <span className={cn("flex flex-col", d === today && "text-accent-text")}>
                        <span>
                          {parts.wd}
                          {d === today ? " · today" : ""}
                        </span>
                        <span className="pms-num font-normal">
                          {parts.dd} {parts.mon}
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.employeeId} className="border-t border-line">
                  <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-left align-top font-normal">
                    {/* Seven days need the room on a small laptop: the face goes first. */}
                    <span className={cn(WITH_FACE, "@max-3xl:gap-x-0")}>
                      <Avatar name={p.displayName} size={28} className={cn(FACE, "@max-3xl:hidden")} />
                      <span className="font-semibold whitespace-nowrap text-foreground">{p.displayName}</span>
                      {p.jobPositionTitle && <span className="text-2xs text-muted-foreground">{p.jobPositionTitle}</span>}
                    </span>
                  </th>
                  {days.map((d) => {
                    const here = cell(p.employeeId, d);
                    const waiting = busy.has(`${p.employeeId}:${d}`);
                    const chips = (
                      <span className="flex flex-col gap-1.5">
                        {here.map((e) => (
                          <span
                            key={e.id}
                            data-entry={e.id}
                            title={`${e.shiftName}, ${clock(e.startsAt)}–${clock(e.endsAt)}`}
                            style={shadeStyle(shadeOf.get(e.shiftTemplateId))}
                            className={cn(
                              "flex flex-col gap-0.5 rounded border px-1.5 py-1",
                              e.publishedAt === null ? "border-dashed border-line2" : "border-transparent",
                              // A shift with no shade (its template was archived) keeps the plain outline.
                              !shadeOf.has(e.shiftTemplateId) && e.publishedAt !== null && "border-line",
                            )}
                          >
                            <span className="font-semibold text-ink">{e.shiftName}</span>
                            <span className="pms-num whitespace-nowrap text-2xs text-ink2 @max-3xl:hidden">
                              {clock(e.startsAt)}–{clock(e.endsAt)}
                            </span>
                            <span className="flex flex-wrap gap-1">
                              {e.publishedAt === null && <Badge intent="warn">Draft</Badge>}
                              {e.generated && <Badge intent="info">Rotation</Badge>}
                              {e.fromRequest && <Badge intent="accent">Request</Badge>}
                            </span>
                          </span>
                        ))}
                      </span>
                    );
                    if (!mayRoster) {
                      return (
                        <td key={d} className="px-1 py-2 align-top">
                          {chips}
                        </td>
                      );
                    }
                    const parts = dayPartsIso(d);
                    const dayName = `${parts.wd} ${parts.dd} ${parts.mon}`;
                    // What the menu ticks: the one shift the day is on, off for an
                    // empty day, and nothing for a day on two shifts.
                    const current = here.length === 1 ? here[0].shiftTemplateId : here.length === 0 ? DAY_OFF : "";
                    return (
                      <td key={d} className="p-0.5 align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={waiting}
                              aria-label={`${p.displayName}, ${dayName}: ${here.length > 0 ? here.map((e) => e.shiftName).join(" and ") : "off"}. Change`}
                              className={cn(
                                "group flex min-h-14 w-full min-w-[4.5rem] cursor-pointer flex-col rounded p-0.5 text-left hover:bg-hover",
                                "data-[state=open]:bg-hover data-[state=open]:outline data-[state=open]:outline-2 data-[state=open]:outline-accent",
                                waiting && "opacity-50",
                              )}
                            >
                              {here.length > 0 ? (
                                chips
                              ) : (
                                <span className="px-1 pt-1 text-2xs text-faint">
                                  <span className="group-hover:hidden group-focus-visible:hidden">Off</span>
                                  <span className="hidden font-semibold text-accent-text group-hover:inline group-focus-visible:inline">+ Add a shift</span>
                                </span>
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-60">
                            <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                              <span>{p.displayName}</span>
                              <span className="text-2xs font-normal text-muted-foreground">{dayName}</span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {shifts.length === 0 ? (
                              <p className="max-w-56 px-3 py-2 text-sm text-muted-foreground">
                                This branch has no shift yet. Add one under Shifts, below the roster.
                              </p>
                            ) : (
                              <DropdownMenuRadioGroup
                                value={current}
                                onValueChange={(choice) => void assign(p.employeeId, p.displayName, d, choice)}
                              >
                                {shifts.map((shift) => (
                                  <DropdownMenuRadioItem key={shift.id} value={shift.id} className="gap-2">
                                    <Swatch token={shadeOf.get(shift.id)} />
                                    <span className="flex-1">{shift.name}</span>
                                    <span className="pms-num text-2xs font-normal text-muted-foreground">
                                      {shift.startsAt}–{shift.endsAt}
                                    </span>
                                  </DropdownMenuRadioItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioItem value={DAY_OFF} className="gap-2">
                                  <Swatch token={undefined} />
                                  <span className="flex-1">Day off</span>
                                </DropdownMenuRadioItem>
                              </DropdownMenuRadioGroup>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(week.data?.publications ?? []).length > 0 && (
        <ul className="flex flex-col gap-1 text-2xs text-muted-foreground" aria-label="Publishes this week">
          {week.data?.publications.map((p) => (
            <li key={p.id}>
              Published {dshortIso(kigaliDateOf(p.publishedAt))} at {clock(p.publishedAt)}
              {p.publishedByName ? ` by ${p.publishedByName}` : ""}: {p.entryCount} shift{p.entryCount === 1 ? "" : "s"},{" "}
              {dshortIso(p.fromDate)} to {dshortIso(p.toDate)}
              {p.departmentId ? ` (${branchDepartments.find((d) => d.id === p.departmentId)?.name ?? "one department"})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
