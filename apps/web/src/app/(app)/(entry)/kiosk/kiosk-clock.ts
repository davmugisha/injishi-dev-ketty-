"use client";

/**
 * The kiosk's clock: Kigali time, on whatever tablet it runs on.
 *
 * A punch takes Injishi's time, never the tablet's (the API stamps `now` as it
 * writes). Each recorded punch tells the kiosk Injishi's clock to within half a
 * round trip, so the face is corrected by that offset once one is known: the
 * clock people read at the door then agrees with the time their punch shows.
 */
import { useEffect, useState } from "react";

const ZONE = "Africa/Kigali";

const HHMM = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const LONG_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "long", day: "numeric", month: "long" });
const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "short", day: "numeric", month: "short" });

/** `06:58`, in Kigali. */
export function clockTime(date: Date): string {
  return HHMM.format(date);
}

/** `Tuesday 6 October`. */
export function longDate(date: Date): string {
  return LONG_DATE.format(date).replace(",", "");
}

/** `Tue 6 Oct`. */
export function shortDate(date: Date): string {
  return SHORT_DATE.format(date).replace(",", "");
}

/**
 * The time now, ticking each second, as Injishi has it when `offsetMs` is
 * known. Null until the page is mounted, so the server render and the first
 * client render agree and nothing time shaped is hydrated twice.
 */
export function useKioskNow(offsetMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date(Date.now() + offsetMs));
    tick();
    const t = setInterval(tick, 1_000);
    return () => clearInterval(t);
  }, [offsetMs]);
  return now;
}

/**
 * "2 min fast", "1 min slow", or null when the tablet is within a minute of
 * Injishi, which is too close to be worth a sentence.
 */
export function driftLabel(offsetMs: number): string | null {
  const minutes = Math.round(Math.abs(offsetMs) / 60_000);
  if (minutes < 1) return null;
  // Injishi ahead of the tablet means the tablet is slow.
  return `${minutes} min ${offsetMs > 0 ? "slow" : "fast"}`;
}
