import type { HousekeepingStatus } from "@injishi/contracts";
import { Ban, BadgeCheck, CircleCheck, SprayCan, type LucideIcon } from "lucide-react";

import type { HkStatus } from "../data/types";

/**
 * The four real housekeeping states, worded for a desk, with the one colour,
 * badge intent and icon each wears. The ONLY copy.
 *
 * Room status (F-P04) and the Room grid's row dots each carried their own table
 * and they disagreed: the grid painted `inspected` the same green as `clean`
 * and `out_of_order` red, while Room status painted `inspected` violet and
 * `out_of_order` grey. A receptionist moving between the two screens read the
 * same room two ways. Both read this table now, and so does Today, which shows
 * an arriving guest's room by the same word and the same mark.
 *
 * Colour never carries the state alone: every place that draws `dot` or `icon`
 * also says `label`, as a badge, a chip or an accessible name. The icon is the
 * second channel, for the desk that reads a floor of cards at a glance and for
 * anyone who cannot tell the dots apart: a tick is ready, a spray can needs a
 * clean, a badge has been checked, a circle struck through cannot be sold.
 */
export const HOUSEKEEPING: readonly {
  key: HousekeepingStatus;
  label: string;
  dot: string;
  intent: "ok" | "warn" | "info" | "neutral";
  icon: LucideIcon;
}[] = [
  { key: "clean", label: "Ready", dot: "var(--ok)", intent: "ok", icon: CircleCheck },
  { key: "dirty", label: "Needs cleaning", dot: "var(--warn)", intent: "warn", icon: SprayCan },
  { key: "inspected", label: "Inspected", dot: "var(--info)", intent: "info", icon: BadgeCheck },
  { key: "out_of_order", label: "Out of order", dot: "var(--faint)", intent: "neutral", icon: Ban },
];

export const HOUSEKEEPING_BY = Object.fromEntries(HOUSEKEEPING.map((h) => [h.key, h])) as Record<
  HousekeepingStatus,
  (typeof HOUSEKEEPING)[number]
>;

/**
 * The demo store's own vocabulary, mapped onto the real one.
 *
 * Here rather than in Room status since Today reads it too: the standalone
 * demo's arrivals show their room's state through the same four words.
 */
export const HOUSEKEEPING_FROM_DEMO: Record<HkStatus, HousekeepingStatus> = {
  ready: "clean",
  needs: "dirty",
  // The demo's middle state. It has no column, so on the way in it reads as
  // what it actually means to a desk: this room is not ready yet.
  cleaning: "dirty",
  inspected: "inspected",
};
