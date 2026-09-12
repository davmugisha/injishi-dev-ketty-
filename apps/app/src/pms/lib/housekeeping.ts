import type { HousekeepingStatus } from "@injishi/contracts";

/**
 * The four real housekeeping states, worded for a desk, with the one colour and
 * badge intent each wears. The ONLY copy.
 *
 * Room status (F-P04) and the Room grid's row dots each carried their own table
 * and they disagreed: the grid painted `inspected` the same green as `clean`
 * and `out_of_order` red, while Room status painted `inspected` violet and
 * `out_of_order` grey. A receptionist moving between the two screens read the
 * same room two ways. Both read this table now.
 *
 * Colour never carries the state alone: every place that draws `dot` also
 * says `label`, as a badge, a chip or an accessible name.
 */
export const HOUSEKEEPING: readonly {
  key: HousekeepingStatus;
  label: string;
  dot: string;
  intent: "ok" | "warn" | "info" | "neutral";
}[] = [
  { key: "clean", label: "Ready", dot: "var(--ok)", intent: "ok" },
  { key: "dirty", label: "Needs cleaning", dot: "var(--warn)", intent: "warn" },
  { key: "inspected", label: "Inspected", dot: "var(--info)", intent: "info" },
  { key: "out_of_order", label: "Out of order", dot: "var(--faint)", intent: "neutral" },
];

export const HOUSEKEEPING_BY = Object.fromEntries(HOUSEKEEPING.map((h) => [h.key, h])) as Record<
  HousekeepingStatus,
  (typeof HOUSEKEEPING)[number]
>;
