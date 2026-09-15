"use client";

/**
 * Reservations — requests + confirmed, the dense list the front desk works
 * (was "Bookings"; blueprint §5 terminology). Status chips filter; one primary
 * action per row, matched to the reservation's state.
 *
 * **This is the first screen on real data** (ADR-012, D-k). Three things about
 * it are the pattern every other screen copies, so they are worth reading here:
 *
 * 1. **It asks what it may do; it never works it out.** `useCapability()`
 *    returns the array the server resolved, and `reasonFor` words the refusal
 *    from the same table `WorkspaceGuard` refuses from — so a disabled button
 *    and a 403 say the same sentence (AC-5).
 * 2. **A failed read is not an empty desk.** "We could not reach the server"
 *    and "you have no reservations" are different answers and they get
 *    different screens. Rendering the first as the second tells an operator
 *    their bookings vanished (AC-13).
 * 3. **It still runs with no server.** With no workspace id there is nothing to
 *    ask, so the demo store stands in exactly as before and the shell's banner
 *    says which screens that applies to (AC-12).
 *
 * **EVERY ROW ACTION OPENS SOMETHING REAL NOW (2026-09-15).** The last refusal
 * on this screen was the Calendar link ("On the grid", "Assign room", "View"),
 * disabled on a live row as if the grid still drew the fixture. It had not
 * been true since the room grid moved onto `/ops/rooms`, `/ops/room-assignments`
 * and `/ops/stays`. So:
 *
 *  - "On the grid" and "Assign room" open the grid at `?booking=<id>`. The grid
 *    moves its window to the booking's dates, marks its bar, and offers the
 *    rooms it may hold, so an unassigned arrival is one choice away from a room.
 *  - "View" on a checked out, cancelled or no show booking opens the booking's
 *    own record (`/reservations/:id`), which shows the stay it became. The grid
 *    was the wrong target even for the demo: it shows two days of history.
 *
 * **CHECK IN AND VIEW BILL WERE REFUSED THE SAME WAY BEFORE THAT, AND SHOULD
 * NOT HAVE BEEN.** Neither screen was the problem:
 *
 *  - `CheckInDrawer` has sent `POST /ops/stays/:bookingId/checkin` against the
 *    live free-room list since ADR-035. What was still on demo data was the
 *    OPENER — `openCheckIn` took the fixture `Reservation` type — so a real
 *    booking had no way in. It takes a `CheckInSeed` now and the refusal on
 *    that button is the ordinary `stay.checkin` capability one.
 *  - Bills has read `GET /ops/folios/:id` since wave 2. What this screen was
 *    missing was the STAY ID, because a bill hangs off the stay and not off the
 *    booking. `GET /ops/stays` supplies it.
 *
 * The Calendar link made it three times: a screen labelled "still a demo" when
 * the gap was the one line joining it up.
 */

import { useState } from "react";
import Link from "next/link";
import { withQuery } from "@injishi/utils";
import { useRouter } from "next/navigation";
import { useWorkspaceHref } from "../lib/workspace-href";
import { useHost, usePms } from "../store";
import { usePmsUi } from "../ui-store";
import type { Reservation, ResStatus } from "../data/types";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useApproveReservation,
  useDeclineReservation,
  useReservations,
} from "../data/reservations";
import { useRoomAssignments, useStays } from "../data/ops";
import { seedFromDemoReservation, seedFromServerReservation } from "../lib/check-in-seed";
import { buildFolio } from "../lib/folio";
import { addDaysIso, dateRange, dateRangeIso, fmt, todayIso } from "../lib/format";
import { ActionButton, Badge, Chip, EmptyState, LoadFailed, Skeleton, surface, tableHeadStyle } from "../components/ui";
import { ConfirmAction } from "../components/confirm-action";
// The wording of a decision lives with Today, so the two screens cannot tell
// an operator two different things about the same command.
import { decisionToast } from "./today";

type Bucket = "pending" | "confirmed" | "inhouse" | "out";
type Filter = "all" | Bucket;

const ORDER: Record<Bucket, number> = { pending: 0, confirmed: 1, inhouse: 2, out: 3 };

const COLUMNS = "1.5fr 1.2fr .7fr 1fr .9fr auto";

/**
 * One row of the desk, from either source.
 *
 * Both paths normalise into this so the table is written once. `source` is what
 * decides which actions are offered: a live row's id means nothing to a screen
 * that is still reading `data/demo.ts`.
 */
interface DeskRow {
  id: string;
  guest: string;
  /**
   * The raw name, which may be null, alongside the rendered `guest` above.
   *
   * Both, because they are for two different things. `guest` is display and so
   * it substitutes "Guest" for a missing name; this is what gets handed to the
   * check-in drawer, where substituting would check somebody in under a name
   * nobody gave.
   */
  guestName: string | null;
  /** Prefills the drawer's night count when this row is checked in. */
  nights: number;
  /** The reference, plus the guest reputation line on a demo request. */
  sub: string;
  dates: string;
  /**
   * What the list sorts on, as a comparable string.
   *
   * NOT the rendered date: "04 Jul – 07 Jul" sorts alphabetically, which puts
   * April before January and looks like the desk lost track of its own
   * arrivals. Live rows carry the ISO date; demo rows carry their day offset,
   * zero padded and shifted past zero so a past arrival stays negative-free.
   */
  sortKey: string;
  room: string | null;
  bucket: Bucket;
  badgeLabel: string;
  badgeIntent: "warn" | "accent" | "neutral" | "info";
  total: number | null;
  /** Arrives today, which is what turns "Reserved" into a check in button. */
  today: boolean;
  source: "live" | "demo";
  /**
   * The OPEN stay this booking became, on a live row.
   *
   * The bill hangs off the stay rather than off the booking, so without this
   * the "View bill" button on an in-house row has nothing to address. Null on a
   * demo row, where the fixture has no stays and the bill is addressed by the
   * reservation id instead.
   */
  stayId: string | null;
  /** The demo record, kept so the check in drawer can still be handed one. */
  demo?: Reservation;
}

export function Reservations() {
  const { dispatch, toast, toastError } = usePms();
  const P = useHost();
  const { openCheckIn } = usePmsUi();
  const router = useRouter();
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const [filter, setFilter] = useState<Filter>("all");

  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useReservations(workspaceId);
  /*
   * Read second only for the STAY ID. `OperatorReservation` cannot carry one:
   * a stay does not exist until somebody arrives, so it is a different row with
   * a different lifetime. This read is what lets an in-house row open its bill.
   * A failure here degrades to a disabled button with its own wording; it never
   * blocks the list.
   */
  const stays = useStays(workspaceId);
  /*
   * Which confirmed bookings already hold a room, so the row says "On the grid"
   * rather than "Assign room" to a desk that assigned it yesterday. The
   * reservation's own `room` is the STAY's room and stays null until check in,
   * so it cannot answer this. One windowed read, from today to the last
   * confirmed departure, asked only once the list has answered. The API refuses
   * a window over 62 days, so a booking further out than that reads "Assign
   * room" and the grid it opens says what it actually holds.
   */
  const confirmed = (query.data?.reservations ?? []).filter((r) => r.state === "confirmed");
  const latest = confirmed.reduce((max, r) => (r.checkOut > max ? r.checkOut : max), addDaysIso(todayIso(), 1));
  const holdsCap = addDaysIso(todayIso(), 62);
  const holdsTo = latest > holdsCap ? holdsCap : latest;
  const holds = useRoomAssignments(query.isSuccess ? workspaceId : null, todayIso(), holdsTo);
  const heldBookings = new Set((holds.data?.assignments ?? []).map((h) => h.bookingId));
  const approve = useApproveReservation(workspaceId);
  const decline = useDeclineReservation(workspaceId);

  const live = workspaceId !== null;
  // `reasonFor` returns undefined when the caller MAY act, which is exactly the
  // shape `deniedReason` wants: no reason means no refusal.
  const decideReason = can("reservation.approve")
    ? undefined
    : reasonFor("reservation.approve");
  const checkInReason = can("stay.checkin") ? undefined : reasonFor("stay.checkin");

  // Only an OPEN stay counts. A closed one is a previous guest in the same
  // room, and joining to it would point "View bill" at last week's folio.
  const openStayFor = new Map<string, string>();
  for (const s of stays.data?.stays ?? []) {
    if (s.lifecycle === "open" && s.bookingId) openStayFor.set(s.bookingId, s.id);
  }

  const rows: DeskRow[] = live
    ? (query.data?.reservations ?? []).flatMap((r) =>
        fromServer(r, openStayFor.get(r.id) ?? null),
      )
    : P.res.filter((r) => r.status !== "declined").map((r) => fromDemo(r, P));

  const all = [...rows].sort(
    (a, b) => ORDER[a.bucket] - ORDER[b.bucket] || a.sortKey.localeCompare(b.sortKey),
  );
  const list = all.filter((r) => filter === "all" || r.bucket === filter);

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "inhouse", label: "In-house" },
    { key: "out", label: "Checked out" },
  ];

  /** Run a command and speak the answer, whichever way it went. */
  function decide(row: DeskRow, action: "approve" | "decline") {
    if (row.source === "demo") {
      dispatch({ type: action, id: row.id });
      return;
    }
    const mutation = action === "approve" ? approve : decline;
    mutation.mutate(row.id, {
      onSuccess: () => toast(decisionToast(action, row.guest), action === "approve" ? "ok" : "info"),
      // Owned wording, chosen by what actually happened (`data/api.ts`).
      onError: toastError,
    });
  }

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {chips.map((c) => (
          <Chip
            key={c.key}
            label={c.label}
            n={c.key === "all" ? all.length : all.filter((r) => r.bucket === c.key).length}
            active={filter === c.key}
            onClick={() => setFilter(c.key)}
            size="sm"
          />
        ))}
      </div>

      {live && query.isPending ? (
        <div style={{ ...surface, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={38} delay={i * 80} />
          ))}
        </div>
      ) : live && query.isError ? (
        /* AC-13: a failed read is NOT an empty desk. An operator told "no
           reservations" when the truth is "we could not ask" will act on a desk
           that is not theirs. Say what happened, and offer the retry. */
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load your reservations. Your bookings are safe — this is on our
          side, not an empty desk.
        </LoadFailed>
      ) : list.length === 0 ? (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          No reservations in this view. New booking requests land under Pending the moment they arrive.
        </EmptyState>
      ) : (
        <div className="pms-tablescroll" style={{ ...surface }}>
          <div style={tableHeadStyle(COLUMNS)}>
            <span>Guest</span>
            <span>Dates</span>
            <span>Room</span>
            <span>Status</span>
            <span style={{ textAlign: "right" }}>Total</span>
            <span />
          </div>
          {list.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: COLUMNS,
                gap: 10,
                alignItems: "center",
                padding: "10px 18px",
                borderTop: `1px solid ${i === 0 ? "transparent" : "var(--line)"}`,
              }}
            >
              <span style={{ minWidth: 0 }}>
                {/* The row is an index INTO the record, not the only place it
                    can be seen (ADR-018, AC-9). This link is what a duty manager
                    copies into a handover message. */}
                <Link
                  href={href(`/reservations/${r.id}`)}
                  style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: "none" }}
                >
                  {r.guest}
                </Link>
                <span className="pms-num" style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                  {r.sub}
                </span>
              </span>
              <span className="pms-num" style={{ fontSize: 12.5, color: "var(--ink2)", whiteSpace: "nowrap" }}>
                {r.dates}
              </span>
              <span className="pms-num" style={{ fontSize: 13, color: "var(--ink2)" }}>{r.room ?? "—"}</span>
              <span><Badge intent={r.badgeIntent}>{r.badgeLabel}</Badge></span>
              <span className="pms-num" style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", textAlign: "right", whiteSpace: "nowrap" }}>
                {r.total === null ? "—" : fmt(r.total)}
              </span>
              <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {r.bucket === "pending" && (
                  <>
                    {/* The refund is the irreversible half, so the button asks
                        once in place rather than opening a dialog. */}
                    <ConfirmAction
                      onConfirm={() => decide(r, "decline")}
                      confirmLabel="Yes, decline and refund"
                      deniedReason={decideReason}
                      pending={decline.isPending && decline.variables === r.id}
                    >
                      {decline.isPending && decline.variables === r.id ? "Declining" : "Decline"}
                    </ConfirmAction>
                    <ActionButton
                      variant="primary"
                      onClick={() => decide(r, "approve")}
                      deniedReason={decideReason}
                      /* This row's wait, not the list's. */
                      pending={approve.isPending && approve.variables === r.id}
                      style={{ minWidth: 96 }}
                    >
                      {approve.isPending && approve.variables === r.id ? "Approving" : "Approve"}
                    </ActionButton>
                  </>
                )}
                {r.bucket === "confirmed" && r.today && (
                  /* A LIVE row opens the drawer now, and this is the change
                     that mattered on this screen. The drawer has sent real
                     commands since ADR-035; the only thing stopping a server
                     reservation from reaching it was an opener that insisted on
                     a demo record. `checkInReason` is the ordinary capability
                     refusal, so a receptionist without `stay.checkin` still
                     sees why rather than a button that 403s. */
                  <ActionButton
                    variant="primary"
                    onClick={() =>
                      openCheckIn(
                        r.demo
                          ? seedFromDemoReservation(r.demo)
                          : seedFromServerReservation({
                              id: r.id,
                              guestName: r.guestName,
                              nights: r.nights,
                            }),
                      )
                    }
                    deniedReason={checkInReason}
                    style={{ minWidth: 96 }}
                  >
                    Check in
                  </ActionButton>
                )}
                {r.bucket === "confirmed" && !r.today && (
                  /* Opens the grid ON this booking: its dates in view, its bar
                     marked, and the rooms it may hold offered in place. */
                  <ActionButton
                    onClick={() =>
                      router.push(
                        href(r.source === "live" ? withQuery("/calendar", { booking: r.id }) : "/calendar"),
                      )
                    }
                    style={{ minWidth: 96 }}
                  >
                    {r.room || heldBookings.has(r.id) ? "On the grid" : "Assign room"}
                  </ActionButton>
                )}
                {r.bucket === "inhouse" && (
                  /* THE BILL HANGS OFF THE STAY, NOT THE BOOKING, which is why
                     this needed `GET /ops/stays` rather than a bigger
                     reservation payload. A live row used to be refused here as
                     if Bills were still a demo — Bills has read
                     `GET /ops/folios/:id` since wave 2, and the real gap was
                     that this screen had no stay id to address. */
                  <ActionButton
                    onClick={() => {
                      const to = r.source === "demo" ? r.id : r.stayId;
                      if (to) router.push(href(`/stays/${to}/folio`));
                    }}
                    deniedReason={r.source === "demo" || r.stayId ? undefined : NO_STAY}
                    style={{ minWidth: 96 }}
                  >
                    View bill
                  </ActionButton>
                )}
                {r.bucket === "out" && (
                  /* A finished booking's record: its dates, total, and the
                     stay and bill it became. The grid only reaches two days
                     back, so it could not show most of these. */
                  <ActionButton
                    onClick={() => router.push(href(`/reservations/${r.id}`))}
                    style={{ minWidth: 96 }}
                  >
                    View
                  </ActionButton>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Why "View bill" is refused on an in-house row with no stay to address.
 *
 * The bill screen is fine; there is simply no stay to address. That happens
 * when the reservations and stays reads disagree for a moment, and it is worded
 * as that rather than as a broken screen, which would send the operator looking
 * in the wrong place.
 */
const NO_STAY = "We can't find an open stay for this booking, so there is no bill to open.";

/**
 * A server reservation as the desk reads it.
 *
 * Returns an EMPTY array for a declined request, which is how the demo list has
 * always behaved: a refused request is finished business and the desk has
 * nothing left to do with it. A cancellation is kept, because somebody has to
 * see that a confirmed booking went away.
 */
function fromServer(r: {
  id: string;
  reference: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  room: string | null;
  nights: number;
  state: string;
  totalRwf: number | null;
}, stayId: string | null): DeskRow[] {
  if (r.state === "declined") return [];

  const bucket: Bucket =
    r.state === "pending" ? "pending"
    : r.state === "inhouse" ? "inhouse"
    : r.state === "confirmed" ? "confirmed"
    : "out";

  const today = r.checkIn === todayIso();
  const badge =
    r.state === "pending" ? { badgeLabel: "Request", badgeIntent: "warn" as const }
    : r.state === "inhouse" ? { badgeLabel: "In-house", badgeIntent: "accent" as const }
    : r.state === "checked_out" ? { badgeLabel: "Checked out", badgeIntent: "neutral" as const }
    : r.state === "cancelled" ? { badgeLabel: "Cancelled", badgeIntent: "neutral" as const }
    : r.state === "no_show" ? { badgeLabel: "No show", badgeIntent: "neutral" as const }
    : today ? { badgeLabel: "Arrives today", badgeIntent: "info" as const }
    : { badgeLabel: "Reserved", badgeIntent: "info" as const };

  return [{
    id: r.id,
    // An account can exist before a name does, and "—" beats a blank cell that
    // reads as a rendering bug.
    guest: r.guestName ?? "Guest",
    guestName: r.guestName,
    nights: r.nights,
    sub: r.reference,
    dates: dateRangeIso(r.checkIn, r.checkOut),
    sortKey: r.checkIn,
    room: r.room,
    bucket,
    ...badge,
    total: r.totalRwf,
    today,
    source: "live",
    stayId,
  }];
}

/** The same row from the demo store, unchanged in behaviour from before. */
function fromDemo(r: Reservation, P: Parameters<typeof buildFolio>[1]): DeskRow {
  const folio = r.room ? buildFolio(r, P) : null;
  const status: ResStatus = r.status;
  const bucket: Bucket = status === "declined" ? "out" : (status as Bucket);
  const today = r.start === 0;

  const badge =
    status === "pending" ? { badgeLabel: "Request", badgeIntent: "warn" as const }
    : status === "inhouse" ? { badgeLabel: "In-house", badgeIntent: "accent" as const }
    : status === "out" ? { badgeLabel: r.invoice ? "Invoiced" : "Checked out", badgeIntent: "neutral" as const }
    : today ? { badgeLabel: "Arrives today", badgeIntent: "info" as const }
    : { badgeLabel: "Reserved", badgeIntent: "info" as const };

  return {
    id: r.id,
    guest: r.guest,
    guestName: r.guest,
    nights: r.nights,
    sub: r.rep ? `${r.id} · ${r.rep}` : r.id,
    dates: dateRange(r.start, r.nights),
    sortKey: String(r.start + 1000).padStart(6, "0"),
    room: r.room,
    bucket,
    ...badge,
    total: folio ? folio.total : null,
    today,
    source: "demo",
    // The fixture has no stays. The demo bill is addressed by the reservation.
    stayId: null,
    demo: r,
  };
}
