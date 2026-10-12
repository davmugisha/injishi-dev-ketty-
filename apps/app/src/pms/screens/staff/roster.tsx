"use client";

/**
 * Staff · Roster (ADR-058, AC-T1 to AC-T3, AC-T6; 058-time AC-TM1, AC-TM14).
 *
 * Who is on which shift, at the branches you cover. On top, the week grid of
 * one branch (and department) with its drafts and the publish bar
 * (`roster-week.tsx`). Beneath it the list, the shared `DataView` over
 * `ROSTER_LIST` (058-list-framework): with no day filter it reads this week,
 * Monday to Sunday, and grouping by day lays it out as one.
 *
 * Two people cannot overlap themselves, and the DATABASE refuses it, so two
 * managers rostering the same cook at once cannot both succeed. A day inside
 * approved leave is refused too, naming the leave. Those refusals arrive here
 * as the server's own sentence.
 *
 * The desk reads this lens (it clocks people onto shifts) and sees no
 * button to change it: rostering is `roster.manage`.
 */

import { ROSTER_LIST, type RosterEntry } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import {
  useCancelRosterEntry,
  useCreateShiftTemplate,
  useUpdateShiftTemplate,
  useEmployees,
  useRosterEntry,
  useRosterPage,
  useShiftTemplates,
} from "../../data/people";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { RosterWeekGrid } from "./roster-week";
import { Field, FormError, Reveal, RowList, clock, hoursText, inputClass, rowClass } from "./staff-ui";

export function Roster() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const [day, setDay] = useState(todayIso());
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, ROSTER_LIST.key);
  const list = useListUrl(ROSTER_LIST, "basic", defaultView);
  const page = useRosterPage(workspaceId, list.state.query);
  const templates = useShiftTemplates(workspaceId);
  const mayRoster = can("roster.manage");
  const employees = useEmployees(mayRoster ? workspaceId : null, "active");
  const create = useRosterEntry(workspaceId);
  const cancel = useCancelRosterEntry(workspaceId);
  const createTemplate = useCreateShiftTemplate(workspaceId);
  const updateTemplate = useUpdateShiftTemplate(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [pick, setPick] = useState({ employeeId: "", shiftTemplateId: "" });
  const [shiftForm, setShiftForm] = useState<null | {
    /** The shift being changed; absent for a new one. */
    id?: string;
    name: string;
    propertyId: string;
    startsAt: string;
    endsAt: string;
    breakMinutes: string;
    minWorkMinutes: string;
    autoClockOutMinutes: string;
  }>(null);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";

  const shifts = templates.data?.templates ?? [];

  // Built each render: a button reads the pending state of its own row.
  const columns: DataColumn<RosterEntry>[] = [
    { key: "workDate", header: "Day", cell: (r) => <span className="pms-num">{dshortIso(r.workDate)}</span> },
    {
      key: "startsAt",
      header: "Hours",
      cell: (r) => (
        <span className="pms-num">
          {clock(r.startsAt)}–{clock(r.endsAt)}
        </span>
      ),
    },
    {
      key: "employee",
      header: "Person",
      wrap: true,
      cell: (r) => (
        <span className="flex flex-col gap-0.5" data-roster={r.id}>
          <span className="whitespace-nowrap font-semibold text-foreground">{r.employee.displayName}</span>
          {r.employee.jobPositionTitle ? <span className="text-2xs text-muted-foreground">{r.employee.jobPositionTitle}</span> : null}
        </span>
      ),
    },
    { key: "shift", header: "Shift", cell: (r) => r.shiftName },
    { key: "branch", header: "Branch", wrap: true, cell: (r) => branchName(r.propertyId) },
    {
      key: "status",
      header: "Status",
      wrap: true,
      // The reason is a sentence: under the word, where it can take a second line.
      cell: (r) =>
        r.status === "scheduled" ? (
          <Badge intent="ok">Scheduled</Badge>
        ) : (
          <span className="flex flex-col items-start gap-0.5">
            <Badge>Cancelled</Badge>
            {r.cancelReason ? <span className="text-2xs text-muted-foreground">{r.cancelReason}</span> : null}
          </span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) =>
        mayRoster && r.status === "scheduled" ? (
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
        ) : null,
    },
  ];

  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <RosterWeekGrid />

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
          <div className="shrink-0">
            <Field label="Day" htmlFor="roster-day">
              <Input
                id="roster-day"
                type="date"
                value={day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
                className="h-10 w-auto rounded border-line2 bg-card text-sm"
              />
            </Field>
          </div>
          <div className="min-w-0 flex-1">
            <Field label="Person">
              <SelectField
                label="Person"
                value={pick.employeeId}
                onChange={(v) => setPick({ ...pick, employeeId: v })}
                placeholder="Choose someone"
                options={(employees.data ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
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

      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Roster</SectionHeading>
        <DataView
          spec={ROSTER_LIST}
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
          groupKeyOf={rosterGroupKey}
          caption="Roster"
          searchPlaceholder="Search a name"
          refOptions={{
            branch: branches.map((b) => ({ value: b.id, label: b.name })),
            shift: shifts.map((t) => ({ value: t.id, label: t.name })),
          }}
          savedViews={savedViews}
          empty={{
            title: "Nobody is rostered",
            body: mayRoster
              ? "With no day chosen this is this week. Put someone on a shift above."
              : "With no day chosen this is this week.",
          }}
        />
        <FormError error={cancel.error} />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <SectionHeading n={shifts.length}>Shifts</SectionHeading>
          {mayRoster && !shiftForm && (
            <ActionButton
              onClick={() =>
                setShiftForm({
                  name: "",
                  propertyId: branches[0]?.id ?? "",
                  startsAt: "07:00",
                  endsAt: "15:00",
                  breakMinutes: "0",
                  minWorkMinutes: "",
                  autoClockOutMinutes: "",
                })
              }
            >
              New shift
            </ActionButton>
          )}
        </div>
        {shiftForm && (
          <Reveal when={shiftForm.id ?? "new"}>
            <form
              className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (shiftForm.id) {
                  updateTemplate.mutate(
                    {
                      id: shiftForm.id,
                      body: {
                        name: shiftForm.name,
                        startsAt: shiftForm.startsAt,
                        endsAt: shiftForm.endsAt,
                        breakMinutes: Number(shiftForm.breakMinutes) || 0,
                        minWorkMinutes: shiftForm.minWorkMinutes.trim() === "" ? null : Number(shiftForm.minWorkMinutes),
                        autoClockOutMinutes: shiftForm.autoClockOutMinutes.trim() === "" ? null : Number(shiftForm.autoClockOutMinutes),
                      },
                    },
                    {
                      onSuccess: (s) => {
                        toast(`${s.name} saved. Shifts already on the roster keep the hours they were given.`, "ok");
                        setShiftForm(null);
                      },
                    },
                  );
                  return;
                }
                createTemplate.mutate(
                  {
                    name: shiftForm.name,
                    propertyId: shiftForm.propertyId,
                    startsAt: shiftForm.startsAt,
                    endsAt: shiftForm.endsAt,
                    breakMinutes: Number(shiftForm.breakMinutes) || 0,
                    minWorkMinutes: shiftForm.minWorkMinutes.trim() === "" ? null : Number(shiftForm.minWorkMinutes),
                    autoClockOutMinutes: shiftForm.autoClockOutMinutes.trim() === "" ? null : Number(shiftForm.autoClockOutMinutes),
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
                {/* A shift stays at its branch: moved to another, it is another shift. */}
                {!shiftForm.id && (
                  <Field label="Branch">
                    <SelectField
                      label="Branch"
                      value={shiftForm.propertyId}
                      onChange={(v) => setShiftForm({ ...shiftForm, propertyId: v })}
                      options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    />
                  </Field>
                )}
                <Field label="Starts" htmlFor="hr-shift-start">
                  <Input id="hr-shift-start" required type="time" value={shiftForm.startsAt} onChange={(e) => setShiftForm({ ...shiftForm, startsAt: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Ends" hint="An end before the start runs past midnight." htmlFor="hr-shift-end">
                  <Input id="hr-shift-end" required type="time" value={shiftForm.endsAt} onChange={(e) => setShiftForm({ ...shiftForm, endsAt: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Break (minutes)" htmlFor="hr-shift-break">
                  <Input id="hr-shift-break" inputMode="numeric" value={shiftForm.breakMinutes} onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Minimum work (minutes)" hint="Overtime counts past this. Empty: the shift's length less its break." htmlFor="hr-shift-min">
                  <Input id="hr-shift-min" inputMode="numeric" value={shiftForm.minWorkMinutes} onChange={(e) => setShiftForm({ ...shiftForm, minWorkMinutes: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Clock out by itself after (minutes)" hint="Past the shift's end, for whoever forgets. Empty: never." htmlFor="hr-shift-auto">
                  <Input id="hr-shift-auto" inputMode="numeric" value={shiftForm.autoClockOutMinutes} onChange={(e) => setShiftForm({ ...shiftForm, autoClockOutMinutes: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <FormError error={shiftForm.id ? updateTemplate.error : createTemplate.error} />
              <div className="flex justify-end gap-2">
                <ActionButton type="button" onClick={() => setShiftForm(null)}>
                  Cancel
                </ActionButton>
                <ActionButton variant="primary" type="submit" pending={createTemplate.isPending || updateTemplate.isPending}>
                  {createTemplate.isPending || updateTemplate.isPending ? "Saving" : shiftForm.id ? "Save the shift" : "Add shift"}
                </ActionButton>
              </div>
            </form>
          </Reveal>
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
                  {s.autoClockOutMinutes !== null && (
                    <span className="text-2xs text-muted-foreground">clocks out {hoursText(s.autoClockOutMinutes)} after</span>
                  )}
                  {mayRoster && shiftForm?.id !== s.id && (
                    <ActionButton
                      onClick={() => {
                        updateTemplate.reset();
                        setShiftForm({
                          id: s.id,
                          name: s.name,
                          propertyId: s.propertyId,
                          startsAt: s.startsAt,
                          endsAt: s.endsAt,
                          breakMinutes: String(s.breakMinutes),
                          minWorkMinutes: s.minWorkMinutes === null ? "" : String(s.minWorkMinutes),
                          autoClockOutMinutes: s.autoClockOutMinutes === null ? "" : String(s.autoClockOutMinutes),
                        });
                      }}
                    >
                      Change
                    </ActionButton>
                  )}
                </div>
              ))}
            </RowList>
          )
        )}
      </section>
    </div>
  );
}

/** How the server keys each groupable field of an entry. */
function rosterGroupKey(r: RosterEntry, field: string): string | null {
  switch (field) {
    case "workDate":
      return r.workDate;
    case "shift":
      return r.shiftTemplateId;
    case "branch":
      return r.propertyId;
    case "department":
      return r.departmentId;
    default:
      return null;
  }
}
