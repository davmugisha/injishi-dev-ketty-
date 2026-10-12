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
 *
 * ONE THING AT A TIME, AND IN WORDS. This was one long page: eight numbers in
 * a grid under labels such as "…at clock in plus (minutes)", then every
 * branch's radius with its buttons open, then two more forms. It is four
 * tiles now (two for the desk, which does not read the business's calendar),
 * each saying what is set today, and the one that is open below them. Nothing
 * is a form until somebody presses Change:
 *
 *   Attendance rules   each rule as the sentence it means ("late once more
 *                      than 10 minutes past the start"), and behind Change the
 *                      numbers in three groups, the rare ones folded away
 *   Phone clock in     a line a branch; its radius and centre behind Change
 *   Holidays, Days off the list first, the form behind Add
 *
 * The three settings kept in minutes that a person thinks of in hours (how
 * long a forgotten day counts as, how early a clock in belongs to a shift,
 * how long on a day off earns a day back) are typed in hours and stored as
 * the minutes the contract asks for.
 *
 * `?part=holidays` opens on that tile: Leave links here for the holidays, and
 * a link that says holidays should not land on the attendance rules.
 */

import type { AttendancePolicy, BranchClockSettings, OrgHoliday, WeeklyOff } from "@injishi/contracts";
import { Checkbox, Input } from "@injishi/ui";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { OPS_READ, useMayRead } from "../../data/ops";
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

const PARTS = ["rules", "phone", "holidays", "daysOff"] as const;
type Part = (typeof PARTS)[number];

/** A length of time as somebody says it: `10 minutes`, `8 hours`, `7 h 30`. */
function spanText(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Minutes as the hours a person types: `480` is `8`, `450` is `7.5`. */
const asHours = (minutes: number): string => String(Math.round((minutes / 60) * 100) / 100);
/** Hours typed, back to whole minutes; nothing typed is nothing. */
const asMinutes = (hours: string): number | null => (hours.trim() === "" || Number.isNaN(Number(hours)) ? null : Math.round(Number(hours) * 60));

export function TimeSettings() {
  const { can } = useCapability();
  const workspaceId = useWorkspaceId();
  const settings = useAttendanceSettings(workspaceId);
  const holidays = useHolidays(workspaceId);
  const offs = useWeeklyOffs(workspaceId);
  const asked = useSearchParams().get("part");
  const [chosen, setPart] = useState<Part>(PARTS.find((p) => p === asked) ?? "rules");
  const mayRoster = can("roster.manage");
  const mayCalendar = mayRoster || can("people.manage");
  // The desk reads the rules and the geofence, not the business's calendar. A
  // tile it cannot read would say "national holidays only" of a business that
  // has its own, so it is not offered one.
  const readsCalendar = useMayRead(OPS_READ.hrHolidays);
  const part = readsCalendar || chosen === "rules" || chosen === "phone" ? chosen : "rules";

  const business = settings.data?.policies.find((p) => p.propertyId === null);
  const clock = settings.data?.clock ?? [];
  const noCentre = clock.filter((b) => !b.hasCoordinates).length;
  const days = offs.data?.weeklyOffs ?? [];
  const ownHolidays = holidays.data?.holidays ?? [];

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        How time is counted here. Each tile says what is set today; open one to {mayCalendar ? "change it" : "read it in full"}.
      </p>

      <div
        role="group"
        aria-label="Which settings to show"
        className={cn("grid grid-cols-1 gap-3 @xl:grid-cols-2", readsCalendar && "@4xl:grid-cols-4")}
      >
        <Tile on={part === "rules"} onPress={() => setPart("rules")} title="Attendance rules">
          {business ? `Late after ${spanText(business.graceInMinutes)}. Overtime ${business.overtimeAutoApprove ? "approved by itself" : "decided by a supervisor"}.` : "Late, early, overtime."}
        </Tile>
        <Tile on={part === "phone"} onPress={() => setPart("phone")} title="Phone clock in" warn={noCentre > 0}>
          {clock.length === 0
            ? "Where staff may clock in from."
            : noCentre > 0
              ? `${noCentre} branch${noCentre === 1 ? " has" : "es have"} no location set.`
              : `${clock.length} branch${clock.length === 1 ? "" : "es"}, within ${Math.min(...clock.map((b) => b.geofenceRadiusM))} to ${Math.max(...clock.map((b) => b.geofenceRadiusM))} m.`}
        </Tile>
        {readsCalendar && (
          <Tile on={part === "holidays"} onPress={() => setPart("holidays")} title="Holidays">
            {!holidays.data
              ? "The national ones, and the business's own."
              : ownHolidays.length === 0
                ? "National holidays only."
                : `National holidays, and ${ownHolidays.length} of your own.`}
          </Tile>
        )}
        {readsCalendar && (
          <Tile on={part === "daysOff"} onPress={() => setPart("daysOff")} title="Weekly days off">
            {!offs.data
              ? "The days that are not working days."
              : days.length === 0
                ? "Saturday and Sunday."
                : [...new Set(days.map((d) => WEEKDAYS[d.weekday]))].join(", ") + "."}
          </Tile>
        )}
      </div>

      {part === "rules" && <PolicySection mayEdit={mayRoster} />}
      {part === "phone" && <GeofenceSection mayEdit={mayRoster} />}
      {part === "holidays" && <HolidaySection mayEdit={mayCalendar} />}
      {part === "daysOff" && <WeeklyOffSection mayEdit={mayCalendar} />}
    </div>
  );
}

/** One of the four parts: its name, what is set today, and the way in. */
function Tile({ on, onPress, title, warn, children }: { on: boolean; onPress: () => void; title: string; warn?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPress}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-card border px-4 py-3.5 text-left",
        on ? "border-accent-text bg-accent-soft" : "border-card-bd bg-card hover:bg-hover",
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("text-sm font-bold", on ? "text-accent-text" : "text-ink")}>{title}</span>
        {warn && <Badge intent="warn">Needs a look</Badge>}
      </span>
      <span className="text-2xs text-ink2">{children}</span>
    </button>
  );
}

// --- Attendance rules ----------------------------------------------------------------------

type PolicyDraft = Record<
  | "graceInMinutes"
  | "graceOutMinutes"
  | "overtimeCutoffMinutes"
  | "overtimeMinMinutes"
  | "staleOpenHours"
  // Kept in minutes, typed in hours.
  | "linkWindowHours"
  | "defaultShiftHours"
  | "compensationHours",
  string
> & { overtimeAutoApprove: boolean };

function draftOf(p: AttendancePolicy): PolicyDraft {
  return {
    graceInMinutes: String(p.graceInMinutes),
    graceOutMinutes: String(p.graceOutMinutes),
    overtimeCutoffMinutes: p.overtimeCutoffMinutes === null ? "" : String(p.overtimeCutoffMinutes),
    overtimeMinMinutes: String(p.overtimeMinMinutes),
    staleOpenHours: String(p.staleOpenHours),
    linkWindowHours: asHours(p.linkWindowMinutes),
    defaultShiftHours: asHours(p.defaultShiftMinutes),
    compensationHours: asHours(p.compensationThresholdMinutes),
    overtimeAutoApprove: p.overtimeAutoApprove,
  };
}

/** What a policy means, a rule a line, for the page and for anybody who cannot change it. */
function rulesOf(p: AttendancePolicy): { rule: string; meaning: string }[] {
  const overtime = p.overtimeAutoApprove
    ? p.overtimeMinMinutes > 0
      ? `Approved by itself from ${spanText(p.overtimeMinMinutes)}. Less than that waits for a supervisor.`
      : "Approved by itself, whatever its length."
    : "Every minute worked past the end of a shift waits for a supervisor to approve it.";
  return [
    {
      rule: "Arriving late",
      meaning: p.graceInMinutes === 0 ? "Counted from the first minute past the start of a shift." : `Counted once somebody is more than ${spanText(p.graceInMinutes)} past the start of their shift.`,
    },
    {
      rule: "Leaving early",
      meaning: p.graceOutMinutes === 0 ? "Counted from the first minute before the end of a shift." : `Counted once somebody leaves more than ${spanText(p.graceOutMinutes)} before the end.`,
    },
    {
      rule: "Overtime",
      meaning: `${overtime}${p.overtimeCutoffMinutes === null ? "" : ` At most ${spanText(p.overtimeCutoffMinutes)} count on one day.`}`,
    },
    {
      rule: "A forgotten clock out",
      meaning: `Closed after ${p.staleOpenHours} hours, and the day counted as ${spanText(p.defaultShiftMinutes)} until a supervisor puts the times right.`,
    },
    {
      rule: "Clocking in before a shift",
      meaning: `A clock in up to ${spanText(p.linkWindowMinutes)} before a shift starts belongs to that shift.`,
    },
    {
      rule: "Working a day off or a holiday",
      meaning: `${spanText(p.compensationThresholdMinutes)} or more earns a whole day off in return; ${spanText(Math.round(p.compensationThresholdMinutes / 2))} earns half a day.`,
    },
  ];
}

function PolicySection({ mayEdit }: { mayEdit: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const settings = useAttendanceSettings(workspaceId);
  const put = usePutPolicy(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [scope, setScope] = useState(BUSINESS);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [more, setMore] = useState(false);
  const policies = settings.data?.policies ?? [];
  const business = policies.find((p) => p.propertyId === null);
  const own = policies.find((p) => p.propertyId === scope);
  const shown = scope === BUSINESS ? business : (own ?? business);

  const whose =
    scope === BUSINESS
      ? business?.saved
        ? "Every branch without rules of its own follows these."
        : "Nothing has been saved yet, so these are the rules the product starts with."
      : own
        ? "This branch has rules of its own."
        : "This branch follows the whole business until you save rules of its own.";

  /** A number field with what it is counted in beside it. */
  const num = (key: keyof Omit<PolicyDraft, "overtimeAutoApprove">, label: string, unit: string, hint?: string, decimal = false) =>
    draft && (
      <Field label={label} hint={hint} htmlFor={`policy-${key}`}>
        <span className="flex items-center gap-2">
          <Input
            id={`policy-${key}`}
            inputMode={decimal ? "decimal" : "numeric"}
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: decimal ? e.target.value.replace(/[^\d.]/g, "") : e.target.value.replace(/\D/g, "") })}
            className={cn(inputClass, "pms-num w-24")}
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
        </span>
      </Field>
    );

  const submit = () => {
    if (!draft || !mayEdit) return;
    put.mutate(
      {
        propertyId: scope === BUSINESS ? null : scope,
        graceInMinutes: Number(draft.graceInMinutes || 0),
        graceOutMinutes: Number(draft.graceOutMinutes || 0),
        overtimeCutoffMinutes: draft.overtimeCutoffMinutes === "" ? null : Number(draft.overtimeCutoffMinutes),
        overtimeAutoApprove: draft.overtimeAutoApprove,
        overtimeMinMinutes: Number(draft.overtimeMinMinutes || 0),
        linkWindowMinutes: asMinutes(draft.linkWindowHours) ?? 0,
        staleOpenHours: Number(draft.staleOpenHours || 16),
        defaultShiftMinutes: asMinutes(draft.defaultShiftHours) ?? 480,
        compensationThresholdMinutes: asMinutes(draft.compensationHours) ?? 360,
      },
      {
        onSuccess: () => {
          setDraft(null);
          toast(scope === BUSINESS ? "The rules for the whole business are saved." : "This branch's own rules are saved.", "ok");
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Attendance policy">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Field label="These rules are for">
            <SelectField
              label="Rules for"
              value={scope}
              onChange={(v) => {
                setScope(v || BUSINESS);
                setDraft(null);
              }}
              options={[{ value: BUSINESS, label: "The whole business" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </Field>
        </div>
        <p className="min-w-0 flex-1 pb-2.5 text-2xs text-muted-foreground">{whose}</p>
        {mayEdit && shown && !draft && (
          <ActionButton variant="primary" onClick={() => setDraft(draftOf(shown))}>
            Change these rules
          </ActionButton>
        )}
      </div>

      {!shown ? (
        <EmptyState className="p-5">{settings.isError ? "The rules could not be read. Try again in a moment." : "Reading the rules…"}</EmptyState>
      ) : !draft ? (
        <RowList>
          {rulesOf(shown).map((line, index) => (
            <div key={line.rule} className={cn(rowClass(index), "flex flex-wrap items-baseline gap-x-4 gap-y-1")}>
              <span className="w-56 shrink-0 text-sm font-semibold text-ink">{line.rule}</span>
              <span className="min-w-0 flex-1 text-sm text-ink2">{line.meaning}</span>
            </div>
          ))}
        </RowList>
      ) : (
        <form
          className="flex flex-col gap-5 rounded-card border border-card-bd bg-card p-5"
          onSubmit={(ev) => {
            ev.preventDefault();
            submit();
          }}
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2.5 text-sm font-bold text-ink">Late and early</legend>
            <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
              {num("graceInMinutes", "Late once past the start by more than", "minutes", "0 counts every minute.")}
              {num("graceOutMinutes", "Early once before the end by more than", "minutes")}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
            <legend className="sr-only">Overtime</legend>
            <span className="text-sm font-bold text-ink">Overtime</span>
            <Checkbox
              isSelected={draft.overtimeAutoApprove}
              onChange={(on) => setDraft({ ...draft, overtimeAutoApprove: on })}
              className="flex w-full items-center gap-2.5 text-sm font-normal text-ink"
            >
              Approve overtime by itself, without a supervisor
            </Checkbox>
            <p className="text-2xs text-muted-foreground">
              {draft.overtimeAutoApprove
                ? "Overtime shorter than the least below still waits for a supervisor."
                : "Off: a supervisor decides every overtime, on Attendance."}
            </p>
            <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
              {draft.overtimeAutoApprove && num("overtimeMinMinutes", "The least that is approved by itself", "minutes")}
              {num("overtimeCutoffMinutes", "The most that counts on one day", "minutes", "Empty: no limit.")}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore((m) => !m)}
              className="self-start text-sm font-semibold text-accent-text underline-offset-2 hover:underline"
            >
              {more ? "Hide the settings most hotels never change" : "Show the settings most hotels never change"}
            </button>
            {more && (
              <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
                {num("staleOpenHours", "Close a forgotten clock out after", "hours", "Somebody clocked in and never out.")}
                {num("defaultShiftHours", "…and count that day as", "hours", "Until a supervisor puts the real times right.", true)}
                {num("linkWindowHours", "A clock in belongs to a shift from", "hours before it", "Earlier than this, it is a day with no shift.", true)}
                {num("compensationHours", "A day off or holiday worked earns a day back from", "hours", "Half as long earns half a day.", true)}
              </div>
            )}
          </div>

          <FormError error={put.error} />
          <div className="flex gap-2.5">
            <ActionButton variant="primary" type="submit" pending={put.isPending}>
              {put.isPending ? "Saving" : "Save the rules"}
            </ActionButton>
            <ActionButton type="button" onClick={() => setDraft(null)}>
              Cancel
            </ActionButton>
          </div>
        </form>
      )}
    </section>
  );
}

// --- Phone clock in --------------------------------------------------------------------------

function GeofenceSection({ mayEdit }: { mayEdit: boolean }) {
  const workspaceId = useWorkspaceId();
  const settings = useAttendanceSettings(workspaceId);
  const rows = settings.data?.clock ?? [];
  return (
    <section className="flex flex-col gap-3" aria-label="Geofence">
      <p className="text-sm text-muted-foreground">
        When somebody clocks in from a phone or a browser, the product checks how far they are from their branch. Inside
        the distance below it counts at once. Further away, or with no location shared, it is still recorded and a
        supervisor confirms it. Nobody is ever refused for where they are.
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
  const [open, setOpen] = useState(false);
  const [radius, setRadius] = useState(String(branch.geofenceRadiusM));
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const save = (centre?: { lat: number; lng: number } | null) =>
    put.mutate(
      { propertyId: branch.propertyId, body: { geofenceRadiusM: Number(radius) || 150, ...(centre !== undefined ? { centre } : {}) } },
      {
        onSuccess: () => {
          toast(`${branch.branchName}: saved.`, "ok");
          setOpen(false);
        },
      },
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

  const measuredFrom = branch.centre ? "a point set at the door" : branch.propertyHasCoordinates ? "the branch's map pin" : null;

  return (
    <div className={cn(rowClass(index), "flex flex-col gap-3")} data-geofence={branch.propertyId}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">{branch.branchName}</span>
          <span className="text-2xs text-ink2">
            {measuredFrom
              ? `Counts at once within ${branch.geofenceRadiusM} m of ${measuredFrom}.`
              : "No location is set, so every phone clock in waits for a supervisor."}
          </span>
        </span>
        {!branch.hasCoordinates && <Badge intent="warn">No location</Badge>}
        {mayEdit && !open && (
          <ActionButton variant={branch.hasCoordinates ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {branch.hasCoordinates ? "Change" : "Set it"}
          </ActionButton>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3 rounded border border-line px-3.5 py-3">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="How close" htmlFor={`radius-${branch.propertyId}`} hint="25 to 2,000. A hotel with a big compound needs more.">
              <span className="flex items-center gap-2">
                <Input
                  id={`radius-${branch.propertyId}`}
                  aria-label={`Radius in metres for ${branch.branchName}`}
                  inputMode="numeric"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))}
                  className={cn(inputClass, "pms-num w-24")}
                />
                <span className="text-sm text-muted-foreground">metres</span>
              </span>
            </Field>
            <ActionButton variant="primary" pending={put.isPending && put.variables?.body.centre === undefined} onClick={() => save()}>
              Save the distance
            </ActionButton>
            <ActionButton
              onClick={() => {
                setOpen(false);
                setRadius(String(branch.geofenceRadiusM));
                setGeoError(null);
              }}
            >
              Cancel
            </ActionButton>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
            <span className="min-w-56 flex-1 text-2xs text-muted-foreground">
              Measured from {measuredFrom ?? "nowhere yet"}. Standing at the door staff use? Set that spot as the centre
              from this device.
            </span>
            <ActionButton pending={locating} onClick={here}>
              {locating ? "Finding this device" : "Centre it where I stand"}
            </ActionButton>
            {branch.centre && (
              <ActionButton pending={put.isPending && put.variables?.body.centre === null} onClick={() => save(null)}>
                Go back to the map pin
              </ActionButton>
            )}
          </div>
          {geoError && (
            <p role="alert" className="text-sm text-danger">
              {geoError}
            </p>
          )}
          <FormError error={put.error} />
        </div>
      )}
    </div>
  );
}

// --- Holidays ---------------------------------------------------------------------------------

function HolidaySection({ mayEdit }: { mayEdit: boolean }) {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const holidays = useHolidays(workspaceId);
  const save = useSaveHoliday(workspaceId);
  const remove = useDeleteHoliday(workspaceId);
  const branches = currentGrant(state)?.branches ?? [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", fromDate: todayIso(), toDate: todayIso(), propertyId: BUSINESS, recurringYearly: false });
  const rows = holidays.data?.holidays ?? [];
  const where = (h: OrgHoliday) => (h.propertyId ? (branches.find((b) => b.id === h.propertyId)?.name ?? "One branch") : "Every branch");

  return (
    <section className="flex flex-col gap-3" aria-label="Holidays">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Rwanda&apos;s national holidays are counted already. Add only the days this business gives on top: they are
          never taken from anybody&apos;s leave, and working one earns time back.
        </p>
        {mayEdit && !adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Add a holiday
          </ActionButton>
        )}
      </div>

      {adding && (
        <form
          className="flex flex-col gap-3.5 rounded-card border border-card-bd bg-card p-5"
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
                  toast(`${h.name} added.`, "ok");
                  setDraft({ ...draft, name: "" });
                  setAdding(false);
                },
              },
            );
          }}
        >
          <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-4">
            <Field label="What it is called" htmlFor="hol-name">
              <Input id="hol-name" placeholder="Staff day" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="First day" htmlFor="hol-from">
              <Input
                id="hol-from"
                type="date"
                value={draft.fromDate}
                onChange={(e) => e.target.value && setDraft({ ...draft, fromDate: e.target.value, toDate: draft.toDate < e.target.value ? e.target.value : draft.toDate })}
                className={inputClass}
              />
            </Field>
            <Field label="Last day" htmlFor="hol-to" hint="The same day for one day.">
              <Input id="hol-to" type="date" min={draft.fromDate} value={draft.toDate} onChange={(e) => e.target.value && setDraft({ ...draft, toDate: e.target.value })} className={inputClass} />
            </Field>
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
            className="flex items-center gap-2.5 text-sm font-normal text-ink"
          >
            It comes back on the same date every year
          </Checkbox>
          <FormError error={save.error} />
          <div className="flex gap-2.5">
            <ActionButton variant="primary" type="submit" pending={save.isPending} deniedReason={draft.name.trim().length < 2 ? "Say what it is called first." : undefined}>
              Add the holiday
            </ActionButton>
            <ActionButton type="button" onClick={() => setAdding(false)}>
              Cancel
            </ActionButton>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <EmptyState className="p-5">No holidays of the business&apos;s own. National holidays count without being listed here.</EmptyState>
      ) : (
        <RowList>
          {rows.map((h, i) => (
            <div key={h.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")} data-holiday={h.id}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{h.name}</span>
                <span className="pms-num text-2xs text-muted-foreground">
                  {h.fromDate === h.toDate ? dshortIso(h.fromDate) : `${dshortIso(h.fromDate)} to ${dshortIso(h.toDate)}`} · {where(h)}
                </span>
              </span>
              {h.recurringYearly && <Badge intent="info">Every year</Badge>}
              {mayEdit && (
                <ConfirmAction
                  confirmLabel="Yes, remove it"
                  pending={remove.isPending && remove.variables?.id === h.id}
                  onConfirm={() => remove.mutate({ id: h.id }, { onSuccess: () => toast(`${h.name} removed.`, "ok") })}
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

// --- Weekly days off -----------------------------------------------------------------------------

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
  const [adding, setAdding] = useState(false);
  const [someWeeks, setSomeWeeks] = useState(false);
  const [draft, setDraft] = useState({ propertyId: BUSINESS, weekday: "0", weeks: [] as number[] });
  const rows = offs.data?.weeklyOffs ?? [];
  const where = (w: WeeklyOff) => (w.propertyId ? (branches.find((b) => b.id === w.propertyId)?.name ?? "One branch") : "Every branch");

  return (
    <section className="flex flex-col gap-3" aria-label="Weekly days off">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          The days of the week the business does not count as working days. They matter for leave: a week of leave for
          somebody with no roster takes only the days that are not days off. With none listed here, Saturday and Sunday
          are days off.
        </p>
        {mayEdit && !adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Add a day off
          </ActionButton>
        )}
      </div>

      {adding && (
        <form
          className="flex flex-col gap-3.5 rounded-card border border-card-bd bg-card p-5"
          onSubmit={(ev) => {
            ev.preventDefault();
            save.mutate(
              {
                create: {
                  propertyId: draft.propertyId === BUSINESS ? null : draft.propertyId,
                  weekday: Number(draft.weekday),
                  weeks: someWeeks ? draft.weeks : [],
                },
              },
              {
                onSuccess: (w) => {
                  toast(`${WEEKDAYS[w.weekday]} is a day off, ${weeksText(w)}.`, "ok");
                  setAdding(false);
                },
              },
            );
          }}
        >
          <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
            <Field label="Day">
              <SelectField label="Day" value={draft.weekday} onChange={(v) => setDraft({ ...draft, weekday: v || "0" })} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} />
            </Field>
            <Field label="Where">
              <SelectField
                label="Where"
                value={draft.propertyId}
                onChange={(v) => setDraft({ ...draft, propertyId: v || BUSINESS })}
                options={[{ value: BUSINESS, label: "Every branch" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </Field>
            <Field label="How often">
              <SelectField
                label="How often"
                value={someWeeks ? "some" : "every"}
                onChange={(v) => setSomeWeeks(v === "some")}
                options={[
                  { value: "every", label: "Every week" },
                  { value: "some", label: "Only some weeks of the month" },
                ]}
              />
            </Field>
          </div>
          {someWeeks && (
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend className="mb-2 text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Which weeks of the month</legend>
              {[1, 2, 3, 4, 5].map((n) => (
                <Checkbox
                  key={n}
                  isSelected={draft.weeks.includes(n)}
                  onChange={(on) => setDraft({ ...draft, weeks: on ? [...draft.weeks, n].sort((a, b) => a - b) : draft.weeks.filter((x) => x !== n) })}
                  className="flex items-center gap-2 text-sm font-normal text-ink"
                >
                  Week {n}
                </Checkbox>
              ))}
            </fieldset>
          )}
          <FormError error={save.error} />
          <div className="flex gap-2.5">
            <ActionButton
              variant="primary"
              type="submit"
              pending={save.isPending}
              deniedReason={someWeeks && draft.weeks.length === 0 ? "Tick the weeks first, or choose every week." : undefined}
            >
              Add the day off
            </ActionButton>
            <ActionButton type="button" onClick={() => setAdding(false)}>
              Cancel
            </ActionButton>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <EmptyState className="p-5">Nothing listed, so Saturday and Sunday count as days off.</EmptyState>
      ) : (
        <RowList>
          {rows.map((w, i) => (
            <div key={w.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")} data-weekly-off={w.id}>
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
                  onConfirm={() => remove.mutate({ id: w.id }, { onSuccess: () => toast(`${WEEKDAYS[w.weekday]} removed.`, "ok") })}
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
