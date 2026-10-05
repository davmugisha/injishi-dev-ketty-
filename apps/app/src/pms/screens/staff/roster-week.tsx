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
 */

import type { RosterEntry } from "@injishi/contracts";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useDepartments } from "../../data/ops";
import { usePublishRoster, useRosterWeek } from "../../data/time";
import { addDaysIso, dayPartsIso, dshortIso, kigaliDateOf, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { FormError, clock } from "./staff-ui";

/** The department filter's "no filter": an empty key would read as a blank selection. */
const EVERY = "every";

/** The Monday of the week a date is in. */
export function mondayIso(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDaysIso(date, -((day + 6) % 7));
}

export function RosterWeekGrid() {
  const { state, toast } = usePms();
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

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(from, i));
  const branchDepartments = (departments.data?.departments ?? []).filter(
    (d) => d.status === "active" && (d.propertyId === propertyId || d.propertyId === null),
  );
  const entries = (week.data?.entries ?? []).filter(
    (e) => e.status === "scheduled" && (!departmentId || e.departmentId === departmentId),
  );
  const people = [...new Map(entries.map((e) => [e.employee.employeeId, e.employee])).values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const drafts = entries.filter((e) => e.publishedAt === null).length;
  const cell = (employeeId: string, day: string): RosterEntry[] =>
    entries
      .filter((e) => e.employee.employeeId === employeeId && e.workDate === day)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

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

      {week.isError ? (
        <EmptyState className="p-5">The week could not be read. Try again in a moment.</EmptyState>
      ) : people.length === 0 ? (
        <EmptyState className="p-5">
          {week.isPending ? "Reading the week…" : "Nobody is on a shift this week here."}
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
                  {days.map((d) => (
                    <td key={d} className="px-2 py-2 align-top">
                      <span className="flex flex-col gap-1.5">
                        {cell(p.employeeId, d).map((e) => (
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
                    </td>
                  ))}
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
