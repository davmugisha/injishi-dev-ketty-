"use client";

/**
 * My work · the clock (ADR-058, 058-time AC-TM9).
 *
 * One button, in or out, whichever the person is not. It is the staff phone
 * app's punch from a browser: the device is asked where it is, and the server
 * measures that against the branch's geofence. A punch it can place stands; one
 * it cannot (no position, too far, too vague) is still recorded and waits for
 * a supervisor, and this card says which happened and why, in the server's
 * words. It never refuses a person for saying no to the location prompt.
 *
 * Whether somebody is in is the server's `openRecord`, never this tab's
 * memory: the desk or a kiosk may have clocked them in, and the card reads
 * again every minute.
 */

import type { PhoneClockResult, RosterEntry } from "@injishi/contracts";
import { useEffect, useState } from "react";

import { ActionButton, Badge } from "../../components/ui";
import { humanError } from "../../data/api";
import { useMyClock, useMyRoster, useMyWorkFile } from "../../data/my-work";
import { TIMEZONE, addDaysIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { clock, hoursText } from "../staff/staff-ui";
import { Panel } from "./my-work-ui";

/**
 * The shift to speak of beside the clock: the one under way, else the next one
 * still to come, else the last one that ended today. Null on a day off.
 */
function shiftNow(entries: readonly RosterEntry[], now: Date, today: string): { entry: RosterEntry; over: boolean } | null {
  const live = entries.filter((e) => e.status === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const current = live.find((e) => new Date(e.startsAt) <= now && now < new Date(e.endsAt)) ?? live.find((e) => new Date(e.startsAt) > now);
  if (current) return { entry: current, over: false };
  const ended = live.filter((e) => e.workDate === today).slice(-1)[0];
  return ended ? { entry: ended, over: true } : null;
}

/** What a punch came to, for the line under the button. */
function outcomeText(result: PhoneClockResult, direction: "in" | "out"): string {
  const at = clock(direction === "in" ? result.record.clockInAt : (result.record.clockOutAt ?? result.record.clockInAt));
  const done = direction === "in" ? `Clocked in at ${at}.` : `Clocked out at ${at}.`;
  if (result.validated) return done;
  const far = result.distanceM !== null ? ` You were about ${result.distanceM.toLocaleString("en-US")} m from the branch.` : "";
  // The reason is the server's own sentence, full stop included.
  return `${done} A supervisor has to confirm it. ${result.pendingReason ?? "It could not be placed."}${far}`;
}

export function ClockCard({ employeeId }: { employeeId: string }) {
  const { toast } = usePms();
  const today = todayIso();
  const file = useMyWorkFile(employeeId);
  // Yesterday too: a night shift that began then is the one still under way at 03:00.
  const roster = useMyRoster(employeeId, addDaysIso(today, -1), today);
  const punch = useMyClock(employeeId);

  // Set after mount: the wall clock of the server render is not this device's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(tick);
  }, []);
  const [last, setLast] = useState<{ result: PhoneClockResult; direction: "in" | "out" } | null>(null);

  const open = file.data?.openRecord ?? null;
  const shift = now ? shiftNow(roster.data?.entries ?? [], now, today) : null;
  const direction = open ? "out" : "in";

  function press() {
    if (punch.isPending) return;
    punch.mutate(direction, {
      onSuccess: (result) => {
        setLast({ result, direction });
        toast(outcomeText(result, direction), result.validated ? "ok" : "warn");
      },
      // In the card, where the button is: a refusal here names the next step
      // ("you are already clocked in") and should be read beside it.
      onError: () => setLast(null),
    });
  }

  const wallClock = now
    ? new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(now)
    : "--:--";

  return (
    <Panel className="flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-2xs font-bold tracking-[0.09em] uppercase text-[var(--muted2)]">Kigali time</span>
          <span className="pms-num text-4xl leading-none font-bold tracking-[-1px] text-ink" aria-live="off">
            {wallClock}
          </span>
        </div>
        {file.isPending ? null : open ? (
          <Badge intent="ok">At work since {clock(open.clockInAt)}</Badge>
        ) : (
          <Badge intent="neutral">Not clocked in</Badge>
        )}
      </div>

      <p className="text-sm text-ink2">
        {open && now
          ? `You have been in for ${hoursText(Math.max(0, Math.floor((now.getTime() - Date.parse(open.clockInAt)) / 60_000)))}.`
          : shift
            ? shift.over
              ? `Your ${shift.entry.shiftName.toLowerCase()} shift ended at ${clock(shift.entry.endsAt)}.`
              : `${shift.entry.shiftName}, ${clock(shift.entry.startsAt)} to ${clock(shift.entry.endsAt)}.`
            : roster.isPending
              ? "Looking up your shift."
              : "You are not on today's roster. You can still clock in if you were asked to come."}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          variant={open ? "secondary" : "primary"}
          pending={punch.isPending}
          deniedReason={file.isError ? "We could not check whether you are clocked in. Reload the page first." : undefined}
          onClick={press}
          className="h-11 px-6 text-base"
        >
          {open ? "Clock out" : "Clock in"}
        </ActionButton>
        {punch.isPending && <span className="text-xs text-muted-foreground">Checking where you are…</span>}
      </div>

      {punch.isError && (
        <p role="alert" className="text-sm text-danger">
          {humanError(punch.error)}
        </p>
      )}
      {last && !punch.isError && (
        <p role="status" className="text-sm text-ink2">
          {outcomeText(last.result, last.direction)}
        </p>
      )}

      <p className="text-2xs text-muted-foreground">
        Your browser may ask to share your location. It is used once, to check the clock in against the branch, and only
        the distance is kept. If you say no, the clock in still counts once a supervisor confirms it.
      </p>
    </Panel>
  );
}
