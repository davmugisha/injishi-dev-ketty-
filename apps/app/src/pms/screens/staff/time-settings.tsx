"use client";

/**
 * Staff · Time settings (ADR-058, 058-time AC-TM4, AC-TM7 to AC-TM9, AC-TM12).
 *
 * How lateness, early leaving and overtime are counted, when an open record is
 * stale; where each branch's geofence is and how wide; and the business's own
 * holidays and weekly days off, which leave counting reads beside the national
 * holidays.
 *
 * A policy is the business default, which every branch without its own
 * follows, or a branch's own. The geofence is centred on the branch's map pin,
 * or on a point set here (from this device, standing at the door staff use),
 * because nothing else in the product records a branch's location: with no
 * centre, every phone clock in waits for somebody to validate it.
 *
 * Anyone who works time reads this; the policy and geofence are changed by
 * whoever manages the roster, holidays and days off by them or `people.manage`.
 */

import type { AttendancePolicy, BranchClockSettings, OrgHoliday, WeeklyOff } from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useState } from "react";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import {
  useAttendanceSettings,
  useDeleteHoliday,
  useDeleteWeeklyOff,
  useHolidays,
  usePutClockSettings,
  usePutPolicy,
  useSaveHoliday,
  useSaveWeeklyOff,
  useWeeklyOffs,
} from "../../data/time";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BUSINESS = "business";

export function TimeSettings() {
  const { can } = useCapability();
  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <PolicySection mayEdit={can("roster.manage")} />
      <GeofenceSection mayEdit={can("roster.manage")} />
      <HolidaySection mayEdit={can("roster.manage") || can("people.manage")} />
      <WeeklyOffSection mayEdit={can("roster.manage") || can("people.manage")} />
    </div>
  );
}

type PolicyDraft = Record<
  | "graceInMinutes"
  | "graceOutMinutes"
  | "overtimeCutoffMinutes"
  | "overtimeMinMinutes"
  | "linkWindowMinutes"
  | "staleOpenHours"
  | "defaultShiftMinutes"
  | "compensationThresholdMinutes",
  string
> & { overtimeAutoApprove: boolean };

function draftOf(p: AttendancePolicy): PolicyDraft {
  return {
    graceInMinutes: String(p.graceInMinutes),
    graceOutMinutes: String(p.graceOutMinutes),
    overtimeCutoffMinutes: p.overtimeCutoffMinutes === null ? "" : String(p.overtimeCutoffMinutes),
    overtimeMinMinutes: String(p.overtimeMinMinutes),
    linkWindowMinutes: String(p.linkWindowMinutes),
    staleOpenHours: String(p.staleOpenHours),
    defaultShiftMinutes: String(p.defaultShiftMinutes),
    compensationThresholdMinutes: String(p.compensationThresholdMinutes),
    overtimeAutoApprove: p.overtimeAutoApprove,
  };
}

function PolicySection({ mayEdit }: { mayEdit: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const settings = useAttendanceSettings(workspaceId);
  const put = usePutPolicy(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [scope, setScope] = useState(BUSINESS);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const policies = settings.data?.policies ?? [];
  const business = policies.find((p) => p.propertyId === null);
  const own = policies.find((p) => p.propertyId === scope);
  const shown = scope === BUSINESS ? business : (own ?? business);
  const current = draft ?? (shown ? draftOf(shown) : null);
  const num = (key: keyof Omit<PolicyDraft, "overtimeAutoApprove">, label: string, hint?: string) =>
    current && (
      <Field label={label} hint={hint} htmlFor={`policy-${key}`}>
        <Input
          id={`policy-${key}`}
          inputMode="numeric"
          disabled={!mayEdit}
          value={current[key]}
          onChange={(e) => setDraft({ ...current, [key]: e.target.value.replace(/\D/g, "") })}
          className={inputClass}
        />
      </Field>
    );

  return (
    <section className="flex flex-col gap-2" aria-label="Attendance policy">
      <SectionHeading>Attendance policy</SectionHeading>
      <form
        className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!current || !mayEdit) return;
          put.mutate(
            {
              propertyId: scope === BUSINESS ? null : scope,
              graceInMinutes: Number(current.graceInMinutes || 0),
              graceOutMinutes: Number(current.graceOutMinutes || 0),
              overtimeCutoffMinutes: current.overtimeCutoffMinutes === "" ? null : Number(current.overtimeCutoffMinutes),
              overtimeAutoApprove: current.overtimeAutoApprove,
              overtimeMinMinutes: Number(current.overtimeMinMinutes || 0),
              linkWindowMinutes: Number(current.linkWindowMinutes || 0),
              staleOpenHours: Number(current.staleOpenHours || 16),
              defaultShiftMinutes: Number(current.defaultShiftMinutes || 480),
              compensationThresholdMinutes: Number(current.compensationThresholdMinutes || 360),
            },
            {
              onSuccess: () => {
                setDraft(null);
                toast(scope === BUSINESS ? "The business default is saved" : "This branch's own policy is saved", "ok");
              },
            },
          );
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="For"
            hint={
              scope === BUSINESS
                ? business?.saved
                  ? "Every branch without its own policy follows this."
                  : "Nothing saved yet: these are the built in values."
                : own
                  ? "This branch has its own policy."
                  : "This branch follows the business default until you save its own."
            }
          >
            <SelectField
              label="Policy for"
              value={scope}
              onChange={(v) => {
                setScope(v || BUSINESS);
                setDraft(null);
              }}
              options={[{ value: BUSINESS, label: "The whole business" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </Field>
          <span />
          {num("graceInMinutes", "Late after (minutes of grace)", "Lateness is counted from the shift's start once past this.")}
          {num("graceOutMinutes", "Early before (minutes of grace)")}
          {num("overtimeMinMinutes", "Overtime counts from (minutes)", "Less than this is not approved by itself.")}
          {num("overtimeCutoffMinutes", "Most overtime one record may count", "Empty: no cap.")}
          {num("linkWindowMinutes", "A clock in links to a shift up to (minutes before it)")}
          {num("staleOpenHours", "Close a forgotten clock in after (hours)")}
          {num("defaultShiftMinutes", "…at clock in plus (minutes)")}
          {num(
            "compensationThresholdMinutes",
            "A day off or holiday worked earns a whole day in lieu from (minutes)",
            "Half of it earns half a day.",
          )}
          {current && (
            <Checkbox
              isSelected={current.overtimeAutoApprove}
              isDisabled={!mayEdit}
              onChange={(on) => setDraft({ ...current, overtimeAutoApprove: on })}
              className="flex w-full items-center gap-2.5 self-end text-sm font-normal text-ink"
            >
              Approve overtime by itself once it reaches the minimum
            </Checkbox>
          )}
        </div>
        <FormError error={put.error} />
        {mayEdit && (
          <div className="flex justify-end gap-2">
            {draft && (
              <ActionButton type="button" onClick={() => setDraft(null)}>
                Undo changes
              </ActionButton>
            )}
            <ActionButton variant="primary" type="submit" pending={put.isPending}>
              {put.isPending ? "Saving" : "Save the policy"}
            </ActionButton>
          </div>
        )}
      </form>
    </section>
  );
}

function GeofenceSection({ mayEdit }: { mayEdit: boolean }) {
  const workspaceId = useWorkspaceId();
  const settings = useAttendanceSettings(workspaceId);
  const rows = settings.data?.clock ?? [];
  return (
    <section className="flex flex-col gap-2" aria-label="Geofence">
      <SectionHeading>Phone clock in</SectionHeading>
      <p className="text-sm text-muted-foreground">
        A phone clock in within the radius of its branch, located closely enough, is validated as it is made. Anything
        else is still recorded, with how far it was, for a supervisor to validate. Nobody is ever refused for where they
        are.
      </p>
      {rows.length === 0 ? (
        <EmptyState className="p-5">No branches in view.</EmptyState>
      ) : (
        <RowList>
          {rows.map((b, i) => (
            <GeofenceRow key={b.propertyId} branch={b} index={i} mayEdit={mayEdit} />
          ))}
        </RowList>
      )}
    </section>
  );
}

function GeofenceRow({ branch, index, mayEdit }: { branch: BranchClockSettings; index: number; mayEdit: boolean }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const put = usePutClockSettings(workspaceId);
  const [radius, setRadius] = useState(String(branch.geofenceRadiusM));
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const save = (centre?: { lat: number; lng: number } | null) =>
    put.mutate(
      { propertyId: branch.propertyId, body: { geofenceRadiusM: Number(radius) || 150, ...(centre !== undefined ? { centre } : {}) } },
      { onSuccess: () => toast(`${branch.branchName}: geofence saved`, "ok") },
    );

  const here = () => {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("This device cannot say where it is.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        save({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
      },
      () => {
        setLocating(false);
        setGeoError("The location was not shared. Allow it for this site and try again.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className={`${rowClass(index)} flex flex-col gap-2`} data-geofence={branch.propertyId}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">{branch.branchName}</span>
          <span className="text-2xs text-muted-foreground">
            {branch.centre
              ? `Centred on a point set here (${branch.centre.lat.toFixed(5)}, ${branch.centre.lng.toFixed(5)})`
              : branch.propertyHasCoordinates
                ? "Centred on the branch's map pin"
                : "No centre: every phone clock in waits for validation"}
          </span>
        </span>
        {!branch.hasCoordinates && <Badge intent="warn">No centre</Badge>}
        <div className="w-28">
          <Input
            aria-label={`Radius in metres for ${branch.branchName}`}
            inputMode="numeric"
            disabled={!mayEdit}
            value={radius}
            onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </div>
        <span className="text-2xs text-muted-foreground">metres</span>
      </div>
      {mayEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          {branch.centre && (
            <ActionButton pending={put.isPending && put.variables?.body.centre === null} onClick={() => save(null)}>
              Use the map pin
            </ActionButton>
          )}
          <ActionButton pending={locating} onClick={here}>
            {locating ? "Finding this device" : "Centre it where I stand"}
          </ActionButton>
          <ActionButton variant="primary" pending={put.isPending && put.variables?.body.centre === undefined} onClick={() => save()}>
            Save the radius
          </ActionButton>
        </div>
      )}
      {geoError && (
        <p role="alert" className="text-sm text-danger">
          {geoError}
        </p>
      )}
      <FormError error={put.error} />
    </div>
  );
}

function HolidaySection({ mayEdit }: { mayEdit: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const holidays = useHolidays(workspaceId);
  const save = useSaveHoliday(workspaceId);
  const remove = useDeleteHoliday(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [draft, setDraft] = useState({ name: "", fromDate: todayIso(), toDate: todayIso(), propertyId: BUSINESS, recurringYearly: false });
  const rows = holidays.data?.holidays ?? [];
  const where = (h: OrgHoliday) => (h.propertyId ? (branches.find((b) => b.id === h.propertyId)?.name ?? "One branch") : "Every branch");

  return (
    <section className="flex flex-col gap-2" aria-label="Holidays">
      <SectionHeading n={rows.length}>The business's own holidays</SectionHeading>
      <p className="text-sm text-muted-foreground">
        Counted like a national holiday: never a day of leave, and a holiday for overtime.
      </p>
      {mayEdit && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (draft.name.trim().length < 2) return;
            save.mutate(
              {
                create: {
                  name: draft.name.trim(),
                  fromDate: draft.fromDate,
                  toDate: draft.toDate,
                  propertyId: draft.propertyId === BUSINESS ? null : draft.propertyId,
                  recurringYearly: draft.recurringYearly,
                },
              },
              {
                onSuccess: (h) => {
                  toast(`${h.name} added`, "ok");
                  setDraft({ ...draft, name: "" });
                },
              },
            );
          }}
        >
          <div className="min-w-0 flex-1">
            <Field label="Name" htmlFor="hol-name">
              <Input id="hol-name" placeholder="Staff day" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <div className="shrink-0">
            <Field label="From" htmlFor="hol-from">
              <Input id="hol-from" type="date" value={draft.fromDate} onChange={(e) => e.target.value && setDraft({ ...draft, fromDate: e.target.value, toDate: draft.toDate < e.target.value ? e.target.value : draft.toDate })} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
            </Field>
          </div>
          <div className="shrink-0">
            <Field label="To" htmlFor="hol-to">
              <Input id="hol-to" type="date" value={draft.toDate} onChange={(e) => e.target.value && setDraft({ ...draft, toDate: e.target.value })} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
            </Field>
          </div>
          <div className="w-48">
            <Field label="Where">
              <SelectField
                label="Where"
                value={draft.propertyId}
                onChange={(v) => setDraft({ ...draft, propertyId: v || BUSINESS })}
                options={[{ value: BUSINESS, label: "Every branch" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </Field>
          </div>
          <Checkbox
            isSelected={draft.recurringYearly}
            onChange={(on) => setDraft({ ...draft, recurringYearly: on })}
            className="flex items-center gap-2 pb-2.5 text-sm font-normal text-ink"
          >
            Every year
          </Checkbox>
          <ActionButton variant="primary" type="submit" pending={save.isPending} deniedReason={draft.name.trim().length < 2 ? "Name the holiday" : undefined}>
            Add
          </ActionButton>
          <div className="w-full">
            <FormError error={save.error} />
          </div>
        </form>
      )}
      {rows.length === 0 ? (
        <EmptyState className="p-5">No holidays of the business's own. National holidays count without being listed here.</EmptyState>
      ) : (
        <RowList>
          {rows.map((h, i) => (
            <div key={h.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-holiday={h.id}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{h.name}</span>
                <span className="text-2xs text-muted-foreground">
                  {h.fromDate === h.toDate ? dshortIso(h.fromDate) : `${dshortIso(h.fromDate)} to ${dshortIso(h.toDate)}`} · {where(h)}
                  {h.recurringYearly ? " · every year" : ""}
                </span>
              </span>
              {mayEdit && (
                <ConfirmAction
                  confirmLabel="Yes, remove it"
                  pending={remove.isPending && remove.variables?.id === h.id}
                  onConfirm={() => remove.mutate({ id: h.id }, { onSuccess: () => toast(`${h.name} removed`, "ok") })}
                >
                  Remove
                </ConfirmAction>
              )}
            </div>
          ))}
        </RowList>
      )}
      <FormError error={remove.error} />
    </section>
  );
}

function weeksText(w: WeeklyOff): string {
  if (w.weeks.length === 0) return "every week";
  const ord = (n: number) => ["", "first", "second", "third", "fourth", "fifth"][n] ?? String(n);
  return `the ${w.weeks.map(ord).join(", ")} of the month`;
}

function WeeklyOffSection({ mayEdit }: { mayEdit: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const offs = useWeeklyOffs(workspaceId);
  const save = useSaveWeeklyOff(workspaceId);
  const remove = useDeleteWeeklyOff(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [draft, setDraft] = useState({ propertyId: BUSINESS, weekday: "0", weeks: [] as number[] });
  const rows = offs.data?.weeklyOffs ?? [];
  const where = (w: WeeklyOff) => (w.propertyId ? (branches.find((b) => b.id === w.propertyId)?.name ?? "One branch") : "Every branch");

  return (
    <section className="flex flex-col gap-2" aria-label="Weekly days off">
      <SectionHeading n={rows.length}>Weekly days off</SectionHeading>
      <p className="text-sm text-muted-foreground">
        On a day nobody is rostered, leave counts only days that are not days off here. With none recorded, Saturday and
        Sunday are.
      </p>
      {mayEdit && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            save.mutate(
              {
                create: {
                  propertyId: draft.propertyId === BUSINESS ? null : draft.propertyId,
                  weekday: Number(draft.weekday),
                  weeks: draft.weeks,
                },
              },
              { onSuccess: (w) => toast(`${WEEKDAYS[w.weekday]} is a day off, ${weeksText(w)}`, "ok") },
            );
          }}
        >
          <div className="w-48">
            <Field label="Day">
              <SelectField label="Day" value={draft.weekday} onChange={(v) => setDraft({ ...draft, weekday: v || "0" })} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} />
            </Field>
          </div>
          <div className="w-48">
            <Field label="Where">
              <SelectField
                label="Where"
                value={draft.propertyId}
                onChange={(v) => setDraft({ ...draft, propertyId: v || BUSINESS })}
                options={[{ value: BUSINESS, label: "Every branch" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </Field>
          </div>
          <fieldset className="flex flex-wrap items-center gap-3 pb-2.5">
            <legend className="sr-only">Which weeks of the month</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <Checkbox
                key={n}
                isSelected={draft.weeks.includes(n)}
                onChange={(on) => setDraft({ ...draft, weeks: on ? [...draft.weeks, n].sort((a, b) => a - b) : draft.weeks.filter((x) => x !== n) })}
                className="flex items-center gap-1.5 text-sm font-normal text-ink"
              >
                Week {n}
              </Checkbox>
            ))}
            <span className="text-2xs text-muted-foreground">None ticked: every week</span>
          </fieldset>
          <ActionButton variant="primary" type="submit" pending={save.isPending}>
            Add
          </ActionButton>
          <div className="w-full">
            <FormError error={save.error} />
          </div>
        </form>
      )}
      {rows.length === 0 ? (
        <EmptyState className="p-5">No weekly days off recorded: Saturday and Sunday count as days off.</EmptyState>
      ) : (
        <RowList>
          {rows.map((w, i) => (
            <div key={w.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-weekly-off={w.id}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{WEEKDAYS[w.weekday]}</span>
                <span className="text-2xs text-muted-foreground">
                  {weeksText(w)} · {where(w)}
                </span>
              </span>
              {mayEdit && (
                <ConfirmAction
                  confirmLabel="Yes, remove it"
                  pending={remove.isPending && remove.variables?.id === w.id}
                  onConfirm={() => remove.mutate({ id: w.id }, { onSuccess: () => toast(`${WEEKDAYS[w.weekday]} removed`, "ok") })}
                >
                  Remove
                </ConfirmAction>
              )}
            </div>
          ))}
        </RowList>
      )}
      <FormError error={remove.error} />
    </section>
  );
}
