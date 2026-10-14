"use client";

/**
 * One guest on Today (F-B07): who, what about them today, and the one thing
 * to do.
 *
 * **IT LAYS ITSELF OUT BY THE WIDTH IT IS GIVEN, NOT THE WINDOW'S.** Today puts
 * a section in a full width column, in half of a two column board, or on a
 * phone, and the same row has to read in all three. So the list is a CSS
 * container and the row answers to it (`@md`, `@3xl`):
 *
 *  - narrow (a phone): a card. Name and status on top, the day's detail under
 *    it, and the actions across the full width with the primary one taking
 *    whatever is left. It used to be one five track grid whose `auto` columns
 *    could not shrink, so on a 390px phone the page was 570px wide and every
 *    button sat off screen.
 *  - half width (`@md`): the detail and the actions share a line, indented
 *    under the name.
 *  - full width (`@3xl`): one line, in fixed tracks, so the status and the
 *    buttons line up from row to row and from section to section. The detail
 *    wrapper turns into `contents` there, which hands its two children to the
 *    row's grid without a second copy of either.
 */

import type { HousekeepingStatus } from "@injishi/contracts";
import { Check, KeyRound, LogIn, LogOut, Receipt, type LucideIcon } from "lucide-react";

import type { Reservation } from "../data/types";
import { fmt, initials } from "../lib/format";
import { HOUSEKEEPING_BY } from "../lib/housekeeping";
import { ConfirmAction } from "./confirm-action";
import { ActionButton, Badge, Initials } from "./ui";

export type Group = "pending" | "arriving" | "departing" | "inhouse";

/**
 * Whether an arriving guest's room can be handed over.
 *
 * A housekeeping state when the room is known and the rooms read answered;
 * `no-room` when nothing is held for the booking; `null` when we cannot tell
 * (the caller may not read rooms, or the read has not answered). Null says
 * nothing rather than guessing "ready".
 */
export type Readiness = HousekeepingStatus | "no-room" | null;

/**
 * One row of the day, from either source.
 *
 * The two middle lines are rendered strings rather than raw fields on purpose:
 * a live row and a demo row phrase "night 2 of 3" from different inputs (an ISO
 * date against today, versus a day offset), and normalising them here keeps one
 * row instead of two.
 */
export interface DayRow {
  /** The reservation id. The React key and, for a demo row, the bill address. */
  id: string;
  guest: string;
  /** Raw name, which may be null. What the check-in drawer is seeded with. */
  guestName: string | null;
  nights: number;
  /** Reference line under the name. */
  sub: string;
  /** Middle cell, top line. */
  top: string;
  /** Middle cell, bottom line. */
  bottom: string;
  group: Group;
  /** The room's label when one is known: the stay's, or the one held for it. */
  room: string | null;
  /** Arrivals only: whether that room can be handed over. */
  readiness: Readiness;
  /**
   * The OPEN stay this reservation became, when it has become one.
   *
   * Null on a live row means the server has no open stay against this booking,
   * which is the honest state for an arrival that has not been checked in — and
   * it is why check out and the bill link are offered from this field rather
   * than from the reservation id.
   */
  stayId: string | null;
  /** Balance on the bill, or null when there is no bill to read. */
  balance: number | null;
  /** In the building and due out tomorrow: the in-house tile counts these. */
  leavesTomorrow: boolean;
  /** Whether a walk-in badge belongs on an arriving row. */
  walkIn: boolean;
  /** The room type a live booking bought; narrows the check-in room list. */
  roomTypeId?: string;
  /** The live booking's own reference, for the check-in drawer's header. */
  reference?: string;
  source: "live" | "demo";
  demo?: Reservation;
}

const NO_BILL = "This booking has no open stay yet, so there is no bill to open.";

export function TodayRow({
  r,
  decideReason,
  checkInReason,
  checkOutReason,
  pendingAction,
  billHref,
  mayReadBills,
  onApprove,
  onDecline,
  onCheckIn,
  onCheckout,
  onBill,
}: {
  r: DayRow;
  decideReason?: string;
  checkInReason?: string;
  checkOutReason?: string;
  /** Which of THIS row's commands is in flight, if any. */
  pendingAction: "approve" | "decline" | "checkout" | null;
  billHref: string | null;
  mayReadBills: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onCheckIn: () => void;
  onCheckout: () => void;
  onBill: () => void;
}) {
  /* The primary action takes the rest of the line on a card and its own width
     once the row has room; `min-w-26` gives every row's main button the same
     floor, so down a column of rows the eye finds it in the same place. */
  const primary = "min-w-26 flex-1 @md:flex-none";

  return (
    <li
      data-day-row
      className={[
        "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-2.5",
        "border-t border-line first:border-t-0",
        "@3xl:grid-cols-[2.25rem_minmax(0,1.1fr)_minmax(0,1.3fr)_10.5rem_15.5rem] @3xl:items-center @3xl:gap-y-0",
      ].join(" ")}
    >
      <span className="col-start-1 row-start-1">
        <Initials>{initials(r.guest)}</Initials>
      </span>

      <span className="col-start-2 row-start-1 min-w-0 self-center">
        <span className="block truncate text-sm font-semibold text-foreground">{r.guest}</span>
        <span className="pms-num block truncate text-2xs text-muted-foreground">{r.sub}</span>
      </span>

      <span className="col-start-3 row-start-1 self-center justify-self-end @3xl:col-start-4 @3xl:justify-self-start">
        <RowBadge r={r} mayReadBills={mayReadBills} />
      </span>

      <div className="col-span-3 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 @md:col-span-2 @md:col-start-2 @3xl:contents">
        <span className="min-w-0 flex-1 basis-44 @3xl:col-start-3 @3xl:row-start-1">
          <span className="block truncate text-sm text-ink2">{r.top}</span>
          <span className="pms-num block text-xs text-muted-foreground">{r.bottom}</span>
        </span>

        <span className="ml-auto flex w-full flex-wrap justify-end gap-2 @md:w-auto @3xl:col-start-5 @3xl:row-start-1">
          {r.group === "pending" && (
            <>
              {/* Declining sends the guest's money back, and nothing here can
                  undo it — so it asks once, in place, without a modal. */}
              <ConfirmAction
                onConfirm={onDecline}
                confirmLabel="Yes, decline and refund"
                deniedReason={decideReason}
                pending={pendingAction === "decline"}
              >
                {pendingAction === "decline" ? "Declining" : "Decline"}
              </ConfirmAction>
              <ActionButton
                variant="primary"
                icon={Check}
                onClick={onApprove}
                deniedReason={decideReason}
                pending={pendingAction === "approve"}
                className={primary}
              >
                {pendingAction === "approve" ? "Approving" : "Approve"}
              </ActionButton>
            </>
          )}
          {r.group === "arriving" && (
            <ActionButton
              variant="primary"
              icon={LogIn}
              onClick={onCheckIn}
              deniedReason={checkInReason}
              className={primary}
            >
              Check in
            </ActionButton>
          )}
          {r.group === "departing" && (
            <>
              <ActionButton icon={Receipt} onClick={onBill} deniedReason={billHref ? undefined : NO_BILL}>
                View bill
              </ActionButton>
              {/* ONE press, and it stays one press: check-out is the fast path
                  and never grows a confirm step. What it gains is the wait made
                  visible, so nobody presses it twice wondering. */}
              <ActionButton
                variant="primary"
                icon={LogOut}
                onClick={onCheckout}
                deniedReason={checkOutReason}
                pending={pendingAction === "checkout"}
                className={primary}
              >
                {pendingAction === "checkout" ? "Checking out" : "Check out"}
              </ActionButton>
            </>
          )}
          {r.group === "inhouse" && (
            <ActionButton
              icon={Receipt}
              onClick={onBill}
              deniedReason={billHref ? undefined : NO_BILL}
              className={primary}
            >
              View bill
            </ActionButton>
          )}
        </span>
      </div>
    </li>
  );
}

/** What an arriving guest's room says, worded and marked from the one table. */
function readinessBadge(readiness: Exclude<Readiness, null>): { label: string; intent: "ok" | "warn" | "info" | "bad"; icon: LucideIcon } {
  if (readiness === "no-room") return { label: "No room yet", intent: "warn", icon: KeyRound };
  const h = HOUSEKEEPING_BY[readiness];
  // A guest on the way to a room that cannot be sold is the one state here that
  // needs somebody now, so it is drawn as a problem rather than as a grey fact.
  if (readiness === "out_of_order") return { label: h.label, intent: "bad", icon: h.icon };
  return { label: readiness === "clean" ? "Room ready" : h.label, intent: h.intent === "neutral" ? "info" : h.intent, icon: h.icon };
}

function RowBadge({ r, mayReadBills }: { r: DayRow; mayReadBills: boolean }) {
  if (r.group === "pending") return <Badge intent="warn">Request</Badge>;
  if (r.group === "arriving") {
    if (r.readiness !== null) {
      const b = readinessBadge(r.readiness);
      return (
        <Badge intent={b.intent} icon={b.icon}>
          {b.label}
        </Badge>
      );
    }
    return r.walkIn ? <Badge intent="warn">Awaiting ID</Badge> : <Badge intent="info">Arrives today</Badge>;
  }
  if (r.group === "departing") {
    /* A balance nobody is allowed to read is not reported as zero. */
    if (!mayReadBills) return <Badge intent="neutral">Bill</Badge>;
    if (r.balance === null) return <Badge intent="neutral">No bill</Badge>;
    if (r.balance > 0) return <Badge intent="warn">{`${fmt(r.balance)} due`}</Badge>;
    return (
      <Badge intent="ok" icon={Check}>
        Settled
      </Badge>
    );
  }
  /* In the building: the running bill, when it can be read and is not empty.
     It is not "due" yet, so it is not worded or coloured as a debt. */
  if (mayReadBills && r.balance !== null && r.balance > 0) {
    return <Badge intent="neutral">{`${fmt(r.balance)} on the bill`}</Badge>;
  }
  return <Badge intent="accent">In-house</Badge>;
}
