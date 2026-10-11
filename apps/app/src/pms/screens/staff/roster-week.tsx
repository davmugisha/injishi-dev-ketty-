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
 * and changing one meant cancelling it in the list and adding another. Now a
 * shift is chosen once ("Paint with") and every day pressed takes it: an empty
 * day gets the shift, a day on another shift is moved to it, and "Day off"
 * takes a day's shifts away. Every active person of the branch has a row, so
 * somebody with no shift yet can be given one. "Copy last week" fills the
 * empty days of the week in view from the week before.
 *
 * It writes through the two roster commands that already existed, one shift a
 * press: add, and cancel with a reason. A move is a cancel and an add, so the
 * server's own refusals (on approved leave, an overlap, a branch out of reach)
 * arrive in its words and the day is left as it was.
 */

import type { RosterEntry } from "@injishi/contracts";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useDepartments } from "../../data/ops";
import { useCancelRosterEntry, useEmployees, useRosterEntry, useShiftTemplates } from "../../data/people";
import { usePublishRoster, useRosterWeek } from "../../data/time";
import { addDaysIso, dayPartsIso, dshortIso, kigaliDateOf, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { FormError, clock } from "./staff-ui";

/** The department filter's "no filter": an empty key would read as a blank selection. */
const EVERY = "every";

/** "Paint with" set to taking shifts away, beside the shift ids it otherwise holds. */
const DAY_OFF = "off";

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

  // Editing in place: the shifts to paint with, the people to give them to,
  // and last week to copy from. Asked only of whoever manages the roster.
  const templates = useShiftTemplates(mayRoster ? workspaceId : null);
  const staff = useEmployees(mayRoster ? workspaceId : null, "active");
  const lastWeek = useRosterWeek(mayRoster ? workspaceId : null, propertyId, addDaysIso(from, -7));
  const add = useRosterEntry(workspaceId);
  const cancel = useCancelRosterEntry(workspaceId);
  const [paint, setPaint] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const shifts = (templates.data?.templates ?? []).filter((t) => t.propertyId === propertyId);

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
   * Press a day: it takes the shift being painted with. One press at a time a
   * day, the commands in order, and the first refusal stops it and is said.
   */
  async function press(employeeId: string, name: string, day: string) {
    const key = `${employeeId}:${day}`;
    if (paint === null || busy.has(key)) return;
    const here = cell(employeeId, day);
    const target = paint === DAY_OFF ? null : (shifts.find((s) => s.id === paint) ?? null);
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

      {mayRoster && (
        <div className="flex flex-col gap-2.5 rounded-card border border-card-bd bg-card px-4 py-3" data-roster-edit>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Paint with</span>
            {shifts.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={paint === s.id}
                onClick={() => setPaint(paint === s.id ? null : s.id)}
                className={cn(
                  "min-h-9 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap",
                  paint === s.id ? "border-accent-text bg-accent-soft text-accent-text" : "border-card-bd bg-card text-ink2 hover:bg-hover",
                )}
              >
                {s.name}{" "}
                <span className="pms-num font-normal">
                  {s.startsAt}–{s.endsAt}
                </span>
              </button>
            ))}
            {shifts.length > 0 && (
              <button
                type="button"
                aria-pressed={paint === DAY_OFF}
                onClick={() => setPaint(paint === DAY_OFF ? null : DAY_OFF)}
                className={cn(
                  "min-h-9 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap",
                  paint === DAY_OFF ? "border-accent-text bg-accent-soft text-accent-text" : "border-card-bd bg-card text-ink2 hover:bg-hover",
                )}
              >
                Day off
              </button>
            )}
            <span className="ml-auto">
              <ActionButton pending={copying} deniedReason={lastWeek.isPending ? "Reading last week." : undefined} onClick={() => void copyLastWeek()}>
                {copying ? "Copying" : "Copy last week"}
              </ActionButton>
            </span>
          </div>
          <p className="text-2xs text-muted-foreground">
            {shifts.length === 0
              ? "This branch has no shift yet. Add one under Shifts below, then come back to give it to people."
              : paint === null
                ? "Choose a shift, then press the days it goes on. Pressing a day that has another shift moves it; Day off takes a day's shift away."
                : paint === DAY_OFF
                  ? "Press a day to take its shift away."
                  : `Press the days ${shifts.find((s) => s.id === paint)?.name ?? "it"} goes on. Press the shift above again to stop.`}
          </p>
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
        <div className="overflow-x-auto rounded-card border border-card-bd bg-card">
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
                    <th key={d} scope="col" className="px-2 py-2 text-left text-2xs font-bold text-muted-foreground">
                      <span className={d === today ? "text-foreground" : undefined}>
                        {parts.wd} {parts.dd} {parts.mon}
                        {d === today ? " · today" : ""}
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
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">{p.displayName}</span>
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
                            className={`flex flex-col gap-0.5 rounded border px-2 py-1 ${e.publishedAt === null ? "border-dashed border-line2" : "border-line"}`}
                          >
                            <span className="font-semibold text-ink">{e.shiftName}</span>
                            <span className="pms-num text-2xs text-muted-foreground">
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
                        <td key={d} className="px-2 py-2 align-top">
                          {chips}
                        </td>
                      );
                    }
                    const parts = dayPartsIso(d);
                    return (
                      <td key={d} className="p-1 align-top">
                        <button
                          type="button"
                          disabled={waiting}
                          onClick={() => void press(p.employeeId, p.displayName, d)}
                          aria-label={`${p.displayName}, ${parts.wd} ${parts.dd} ${parts.mon}: ${here.length > 0 ? here.map((e) => e.shiftName).join(" and ") : "off"}`}
                          className={cn(
                            "flex min-h-14 w-full min-w-24 flex-col rounded p-1 text-left",
                            paint !== null ? "cursor-pointer hover:bg-accent-soft" : "cursor-default",
                            waiting && "opacity-50",
                          )}
                        >
                          {here.length > 0 ? chips : <span className="px-1 pt-1 text-2xs text-faint">{paint !== null ? "+" : "Off"}</span>}
                        </button>
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
