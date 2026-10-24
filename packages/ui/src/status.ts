import type { Tone } from "./tone.ts";

/**
 * Every rentals status the screens show, with ONE tone and ONE label each, so a state looks the same on
 * the landlord's side, the tenant's side and in an email. A screen never picks a status colour itself:
 * it renders `<StatusChip kind="lease" status={lease.status} />`.
 *
 * The lists mirror `packages/contracts/src/rentals/vocab.ts` (and the database enums for the parts the
 * contracts do not hold yet). They are plain string literals, not imports, because the app runs zod 4
 * and contracts zod 3; `tests/status.test.ts` fails when a contracts value has no tone here.
 *
 * Tones carry one intent each:
 * - `success`: done or in good standing (Active, Paid, Received, Fixed, Filed).
 * - `warning`: needs someone's attention soon (Waiting for tenant, Ending, To acknowledge, Due).
 * - `danger`: something went wrong or is late (Overdue, Failed, Flagged).
 * - `info`: moving along on its own, nothing to do yet (Signed, Seen, Assigned, Arriving, Sending).
 * - `default`: neutral or finished (Draft, Ended, Cancelled, Waived, Withdrawn, Closed).
 */
export type StatusTone = Exclude<Tone, "accent">;

/** The values of each status kind. Derived states (worked out, never stored) are marked. */
export const STATUS_VALUES = {
  /** contracts `LeaseStatus`. */
  lease: ["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"],
  /** contracts `LeaseChargeStatus`, plus `overdue` (open after the due date and grace days). */
  charge: ["open", "overdue", "paid", "waived"],
  /** contracts `LeasePaymentStatus`. */
  payment: ["pending", "succeeded", "failed", "expired", "reversed"],
  /** contracts `LeaseDepositStatus`, plus `disputed` (the tenant disputed the settlement). */
  deposit: ["awaiting", "held", "settled", "disputed"],
  /** contracts `MoveOutNoticeStatus`. */
  notice: ["submitted", "acknowledged", "withdrawn"],
  /** Maintenance tickets (blueprint 1.3): `open` is Reported, `acknowledged` Seen, `resolved` Fixed. */
  fault: ["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"],
  /**
   * A guest registration as the tenant and the leaders see it: where the stay is (worked out from the
   * dates of a `submitted` registration), `cancelled`, or `flagged` by a leader.
   */
  guest: ["arriving", "staying", "left", "cancelled", "flagged"],
  /** `filing_status` for lease copies to RRA, plus `overdue` (still pending after the due day). */
  filing: ["pending", "overdue", "filed", "failed"],
  /** `payout_status`, with `failed` from the blueprint. */
  payout: ["scheduled", "queued", "paid", "held", "failed"],
  /** A unit: occupancy worked out from leases (`occupied`, `vacant`), or contracts `RentalUnitState`. */
  unit: ["occupied", "vacant", "off_market", "retired"],
} as const satisfies Record<string, readonly string[]>;

export type StatusKind = keyof typeof STATUS_VALUES;
export type StatusOf<K extends StatusKind> = (typeof STATUS_VALUES)[K][number];

type StatusMap<V> = { readonly [K in StatusKind]: Readonly<Record<StatusOf<K>, V>> };

/** The one tone of every status. */
export const STATUS_TONE: StatusMap<StatusTone> = {
  lease: {
    draft: "default",
    pending_signature: "warning",
    signed: "info",
    active: "success",
    ending: "warning",
    ended: "default",
    cancelled: "default",
  },
  charge: { open: "info", overdue: "danger", paid: "success", waived: "default" },
  payment: { pending: "info", succeeded: "success", failed: "danger", expired: "default", reversed: "warning" },
  deposit: { awaiting: "warning", held: "success", settled: "default", disputed: "danger" },
  notice: { submitted: "warning", acknowledged: "info", withdrawn: "default" },
  fault: {
    open: "warning",
    acknowledged: "info",
    assigned: "info",
    in_progress: "info",
    resolved: "success",
    closed: "default",
    wont_fix: "default",
    cancelled: "default",
  },
  guest: { arriving: "info", staying: "success", left: "default", cancelled: "default", flagged: "danger" },
  filing: { pending: "warning", overdue: "danger", filed: "success", failed: "danger" },
  payout: { scheduled: "info", queued: "info", paid: "success", held: "warning", failed: "danger" },
  unit: { occupied: "success", vacant: "warning", off_market: "default", retired: "default" },
};

/**
 * The words for every status. Where contracts has a label map (`LEASE_STATUS_LABEL`, ...), these are the
 * same words; the test checks it.
 */
export const STATUS_LABEL: StatusMap<string> = {
  lease: {
    draft: "Draft",
    pending_signature: "Waiting for tenant",
    signed: "Signed",
    active: "Active",
    ending: "Ending",
    ended: "Ended",
    cancelled: "Cancelled",
  },
  charge: { open: "Open", overdue: "Overdue", paid: "Paid", waived: "Waived" },
  payment: { pending: "Waiting", succeeded: "Received", failed: "Failed", expired: "Expired", reversed: "Reversed" },
  deposit: { awaiting: "Not paid yet", held: "Held", settled: "Settled", disputed: "Disputed" },
  notice: { submitted: "To acknowledge", acknowledged: "Acknowledged", withdrawn: "Withdrawn" },
  fault: {
    open: "Reported",
    acknowledged: "Seen",
    assigned: "Assigned",
    in_progress: "In progress",
    resolved: "Fixed",
    closed: "Closed",
    wont_fix: "Won't fix",
    cancelled: "Cancelled",
  },
  guest: { arriving: "Arriving", staying: "Staying", left: "Left", cancelled: "Cancelled", flagged: "Flagged" },
  filing: { pending: "Due", overdue: "Overdue", filed: "Filed", failed: "Failed" },
  payout: { scheduled: "Scheduled", queued: "Sending", paid: "Paid out", held: "Held", failed: "Failed" },
  unit: { occupied: "Occupied", vacant: "Vacant", off_market: "Off market", retired: "Retired" },
};

/** Is `status` a known value of `kind`? */
export function isStatus<K extends StatusKind>(kind: K, status: string): status is StatusOf<K> {
  return (STATUS_VALUES[kind] as readonly string[]).includes(status);
}

/** The tone of a status; an unknown value (a newer API than this build) is neutral, never a guess. */
export function statusTone(kind: StatusKind, status: string): StatusTone {
  return isStatus(kind, status) ? (STATUS_TONE[kind] as Record<string, StatusTone>)[status] : "default";
}

/** The words for a status; an unknown value reads as itself in sentence case ("on_hold" as "On hold"). */
export function statusLabel(kind: StatusKind, status: string): string {
  if (isStatus(kind, status)) return (STATUS_LABEL[kind] as Record<string, string>)[status];
  const words = status.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Unknown";
}
