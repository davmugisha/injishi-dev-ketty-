"use client";

/**
 * Today — the temporal home of the front desk (F-B07, blueprint §4).
 *
 * Actionable stat chips filter the grouped list beneath them; each row carries
 * exactly one primary action. This is the "start the day" journey: scan, tap a
 * chip to narrow, act per row.
 *
 * **ON REAL DATA.** This screen is the host workspace's landing page — it is
 * the first thing an operator sees every morning — and it was the largest
 * remaining fixture in the app. Every endpoint it needed already existed:
 *
 *  - `GET /ops/reservations` is the whole list. `OperatorReservation.state`
 *    already distinguishes pending, confirmed, in-house and checked out, so the
 *    four groups below are a filter on the server's own derivation rather than
 *    a second one invented here.
 *  - `GET /ops/stays` supplies the STAY ID, which the reservation cannot: check
 *    out names a stay in its path and the bill hangs off a stay, so without
 *    this read the two right-hand buttons on a departing row have nothing to
 *    point at.
 *  - `GET /ops/folios` supplies the balance the departure badge reports. It is
 *    read only when the caller holds `folio.charge`, the same permission the
 *    Bills screen gates on — a desk that may not open a bill is not shown its
 *    number, and the badge says "bill" instead of a figure it could not check.
 *
 * Commands: approve and decline (`reservation.approve`), check in through the
 * shared drawer (`stay.checkin`), and check out (`stay.checkout`). Each is
 * disabled with the server's own wording when the permission is absent, so a
 * disabled button and a 403 say the same sentence.
 *
 * **It still runs with no server.** No workspace id means nothing to ask, so
 * the demo store stands in exactly as before and the shell's banner names the
 * screens that applies to. Where the two paths differ, they differ because the
 * fixture cannot answer: a demo row has no stay id, so its bill link keeps
 * addressing the reservation the way it always did.
 *
 * **A failed read is not an empty hotel.** "We could not reach the server" gets
 * its own state with a retry; showing it as "no arrivals today" would tell a
 * receptionist nobody is coming when in fact nobody asked.
 */

import { SetupBanner } from "../components/setup-banner";
import { Button } from "@injishi/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceHref } from "../lib/workspace-href";
import { useHost, usePms } from "../store";
import { usePmsUi } from "../ui-store";
import type { HospitalityProperty, Reservation } from "../data/types";
import type { OperatorFolio, OperatorReservation, OperatorRoomAssignment, OperatorStay } from "@injishi/contracts";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useApproveReservation,
  useDeclineReservation,
  useReservations,
} from "../data/reservations";
import { useCheckOut, useFolios, useRoomAssignments, useStays } from "../data/ops";
import { seedFromDemoReservation, seedFromServerReservation } from "../lib/check-in-seed";
import { buildFolio } from "../lib/folio";
import { addDaysIso, dateRange, dateRangeIso, ds, dshort, dshortIso, fmt, initials, nights, todayIso, TIMEZONE } from "../lib/format";
import { ActionButton, Badge, EmptyState, Initials, LoadFailed, SectionHeading, Skeleton, surface } from "../components/ui";
import { ConfirmAction } from "../components/confirm-action";

/**
 * What a decision on a request is worded as, on BOTH screens that offer it.
 *
 * Today and Reservations used to disagree about where a room gets assigned —
 * "at check-in" here, "on the Room grid" there — for the same command on the
 * same booking. Two answers to "what do I do next" is worse than either.
 */
export function decisionToast(action: "approve" | "decline", guest: string): string {
  return action === "approve"
    ? `${guest} is confirmed. Give them a room on the Room grid, or at check-in.`
    : `${guest}'s request is declined and their money is going back.`;
}

type Group = "pending" | "arriving" | "departing" | "inhouse";
type ChipKey = "all" | Group;

/**
 * One row of the day, from either source.
 *
 * The two middle lines are rendered strings rather than raw fields on purpose:
 * a live row and a demo row phrase "night 2 of 3" from different inputs (an ISO
 * date against today, versus a day offset), and normalising them here keeps one
 * table instead of two.
 */
interface DayRow {
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
  /** Whether a walk-in badge belongs on an arriving row. */
  walkIn: boolean;
  source: "live" | "demo";
  demo?: Reservation;
}

export function Today() {
  const { dispatch, toast, toastError } = usePms();
  // The demo property, which stands in when there is no workspace to ask. Read
  // unconditionally because hooks must be: Today only ever renders inside a
  // hospitality workspace, which is the one place `useHost` does not throw.
  const P = useHost();
  const { openCheckIn } = usePmsUi();
  const router = useRouter();
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const [chip, setChip] = useState<ChipKey>("all");

  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const live = workspaceId !== null;

  const reservations = useReservations(workspaceId);
  const stays = useStays(workspaceId);
  /*
   * The bill total is a DISCLOSURE, so it is gated the way Bills is.
   *
   * Passing null rather than branching on the result: `useFolios` is disabled
   * on a null workspace, so a caller without the permission simply never makes
   * the request. Firing it and rendering the 403 would spend a round trip to
   * learn what the permission array already said.
   */
  const mayReadBills = can("folio.charge");
  /*
   * Rooms already HELD for today's arrivals. A reservation's own `room` is the
   * stay's room and stays null until check in, so without this read an arrival
   * the desk assigned yesterday reads "No room yet". Gated like the grid it
   * mirrors: a caller who may not assign rooms never makes the request.
   */
  const holds = useRoomAssignments(
    live && can("reservation.assign") ? workspaceId : null,
    todayIso(),
    addDaysIso(todayIso(), 1),
  );
  const folios = useFolios(mayReadBills && live ? workspaceId : null);
  const checkOut = useCheckOut(workspaceId);
  // The SAME two hooks Reservations uses, not a second pair. They own the cache
  // patching that makes an approved request move group without a reload, and
  // two definitions of "approve" would be two answers to one question.
  const approve = useApproveReservation(workspaceId);
  const decline = useDeclineReservation(workspaceId);

  // `reasonFor` returns undefined when the caller MAY act, which is exactly the
  // shape `deniedReason` wants: no reason means no refusal.
  const decideReason = can("reservation.approve") ? undefined : reasonFor("reservation.approve");
  const checkInReason = can("stay.checkin") ? undefined : reasonFor("stay.checkin");
  const checkOutReason = can("stay.checkout") ? undefined : reasonFor("stay.checkout");

  const rows = live
    ? fromServer(
        reservations.data?.reservations ?? [],
        stays.data?.stays ?? [],
        mayReadBills ? (folios.data?.folios ?? []) : null,
        holds.data?.assignments ?? [],
      )
    : fromDemo(P);

  const groups: { key: Group; label: string; emptyTxt: string }[] = [
    { key: "pending", label: "Requests to approve", emptyTxt: "No pending requests. New booking requests appear here the moment they arrive." },
    { key: "arriving", label: "Arriving today", emptyTxt: "No arrivals today. Tomorrow's arrivals are on the Calendar." },
    { key: "departing", label: "Departing today", emptyTxt: "No departures today." },
    { key: "inhouse", label: "In-house tonight", emptyTxt: "No guests in-house tonight. Walk-ins open a bill in under two minutes." },
  ];

  const chips: { key: ChipKey; label: string; n: number }[] = [
    { key: "all", label: "All", n: rows.length },
    ...groups.map((g) => ({
      key: g.key as ChipKey,
      label: g.key === "pending" ? "Pending" : g.key === "arriving" ? "Arriving" : g.key === "departing" ? "Departing" : "In-house",
      n: rows.filter((r) => r.group === g.key).length,
    })),
  ];

  const shown = groups.filter((g) => chip === "all" || chip === g.key);

  /** Approve or decline, from whichever source this row came. */
  function decide(row: DayRow, action: "approve" | "decline") {
    if (row.source === "demo") {
      dispatch({ type: action, id: row.id });
      return;
    }
    const mutation = action === "approve" ? approve : decline;
    mutation.mutate(row.id, {
      onSuccess: () => toast(decisionToast(action, row.guest), action === "approve" ? "ok" : "info"),
      // The server's own sentence where it wrote one for a person, and our own
      // where it did not — `humanError` in `data/api.ts` decides which.
      onError: toastError,
    });
  }

  /** Check the guest out, and say what happened either way. */
  function departGuest(row: DayRow) {
    if (row.source === "demo") {
      dispatch({ type: "checkout", id: row.id });
      return;
    }
    if (!row.stayId) {
      // Nothing to check out. Said plainly rather than swallowed: a departing
      // row with no open stay means the two reads disagree, and an operator
      // pressing a button that does nothing is the worst version of that.
      toast("We can't find an open stay for this booking. Reload and try again.", "bad");
      return;
    }
    checkOut.mutate({ stayId: row.stayId }, {
      onSuccess: () =>
        toast(`${row.guest} is checked out. The room is on the housekeeping board now.`, "ok"),
      onError: toastError,
    });
  }

  /** Where a row's bill lives. A live bill hangs off the STAY, never the booking. */
  function billHref(row: DayRow): string | null {
    if (row.source === "demo") return href(`/stays/${row.id}/folio`);
    return row.stayId ? href(`/stays/${row.stayId}/folio`) : null;
  }

  const loading = live && (reservations.isPending || stays.isPending);
  const failed = live && (reservations.isError || stays.isError);

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SetupBanner />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {chips.map((c) => {
          const on = chip === c.key;
          return (
            <Button variant="ghost"
              key={c.key}
              onClick={() => setChip(c.key)}
              aria-pressed={on}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                border: `1.5px solid ${on ? "var(--accent-text)" : "var(--card-bd)"}`,
                background: on ? "var(--accent-soft)" : "var(--card)",
                color: on ? "var(--accent-text)" : "var(--ink2)",
                borderRadius: 999,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              <span className="pms-num" style={{ fontSize: 17, fontWeight: 700 }}>
                {loading ? "—" : c.n}
              </span>
              {c.label}
            </Button>
          );
        })}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{`${ds(0)} · ${TIMEZONE}`}</span>
      </div>

      {loading ? (
        <div style={{ ...surface, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={38} delay={i * 80} />
          ))}
        </div>
      ) : failed ? (
        /* A failed read is NOT an empty day. A receptionist told "no arrivals"
           will stop expecting guests who are on their way. */
        <LoadFailed
          onRetry={() => {
            void reservations.refetch();
            void stays.refetch();
          }}
          retrying={reservations.isFetching || stays.isFetching}
        >
          We couldn&apos;t load today. Your arrivals and departures are safe — this is on
          our side, not an empty hotel.
        </LoadFailed>
      ) : (
        shown.map((g) => {
          const list = rows.filter((r) => r.group === g.key);
          return (
            <section key={g.key}>
              <SectionHeading n={list.length}>{g.label}</SectionHeading>
              {list.length === 0 ? (
                <EmptyState style={{ marginTop: 10 }}>{g.emptyTxt}</EmptyState>
              ) : (
                <div className="pms-tablescroll" style={{ ...surface, marginTop: 10 }}>
                  {list.map((r, i) => (
                    <TodayRow
                      key={r.id}
                      r={r}
                      first={i === 0}
                      decideReason={decideReason}
                      checkInReason={checkInReason}
                      checkOutReason={checkOutReason}
                      /* ONE row's pending, not the board's. `variables` is the
                         id the mutation was called with, so the guest whose
                         button was pressed is the only one that shimmers — a
                         shared `isPending` relabelled every row at once. */
                      pendingAction={
                        approve.isPending && approve.variables === r.id
                          ? "approve"
                          : decline.isPending && decline.variables === r.id
                            ? "decline"
                            : checkOut.isPending && r.stayId !== null && checkOut.variables?.stayId === r.stayId
                              ? "checkout"
                              : null
                      }
                      billHref={billHref(r)}
                      mayReadBills={!live || mayReadBills}
                      onApprove={() => decide(r, "approve")}
                      onDecline={() => decide(r, "decline")}
                      onCheckIn={() =>
                        openCheckIn(
                          r.demo
                            ? seedFromDemoReservation(r.demo)
                            : seedFromServerReservation({ id: r.id, guestName: r.guestName, nights: r.nights }),
                        )
                      }
                      onCheckout={() => departGuest(r)}
                      onBill={() => {
                        const to = billHref(r);
                        if (to) router.push(to);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

/* ── Normalising each source ────────────────────────────────────────────── */

/**
 * The day, from the server.
 *
 * Three reads joined on two ids, and the joins are the reason this is a
 * function rather than three `.map`s at the call site:
 *
 *  - a stay finds its reservation through `bookingId`, and only an OPEN stay
 *    counts — a closed one is last week's guest in the same room;
 *  - a folio finds its stay through `guestStayId`, falling back to `bookingId`
 *    for a bill opened before anyone arrived.
 *
 * `folios` is null, not empty, when the caller may not read bills. Empty would
 * mean "no bills", which renders as "settled" — telling a receptionist a
 * departing guest owes nothing is exactly the mistake that costs money.
 */
function fromServer(
  reservations: readonly OperatorReservation[],
  stays: readonly OperatorStay[],
  folios: readonly OperatorFolio[] | null,
  holds: readonly OperatorRoomAssignment[] = [],
): DayRow[] {
  const today = todayIso();
  const heldRoomFor = new Map<string, string>();
  for (const h of holds) {
    if (h.status === "assigned" && h.roomLabel && h.from <= today && today < h.to) heldRoomFor.set(h.bookingId, h.roomLabel);
  }
  const openStayFor = new Map<string, OperatorStay>();
  for (const s of stays) {
    if (s.lifecycle === "open" && s.bookingId) openStayFor.set(s.bookingId, s);
  }

  const rows: DayRow[] = [];
  for (const r of reservations) {
    const group = groupOf(r, today);
    if (!group) continue;

    const stay = openStayFor.get(r.id) ?? null;
    const folio =
      folios === null
        ? null
        : (folios.find((f) => (stay && f.guestStayId === stay.id) || f.bookingId === r.id) ?? null);

    const room = r.room ?? stay?.roomLabel ?? heldRoomFor.get(r.id) ?? null;
    const guest = r.guestName ?? "Guest";

    rows.push({
      id: r.id,
      guest,
      guestName: r.guestName,
      nights: r.nights,
      sub: r.reference,
      ...linesFor(r, group, room, today),
      group,
      stayId: stay?.id ?? null,
      balance: folio ? folio.balanceRwf : null,
      // The server has no walk-in flag on a reservation, and it does not need
      // one: a walk-in never had a booking, so it is never in this list.
      walkIn: false,
      source: "live",
    });
  }
  return rows;
}

/** Which group a server reservation belongs to, or null when it is not today's work. */
function groupOf(r: OperatorReservation, today: string): Group | null {
  if (r.state === "pending") return "pending";
  if (r.state === "confirmed") return r.checkIn === today ? "arriving" : null;
  if (r.state !== "inhouse") return null;
  // A stay whose planned checkout has arrived (or passed — an overstay is still
  // today's problem) is a departure; anything later is simply in the building.
  return r.checkOut <= today ? "departing" : "inhouse";
}

/** The two middle lines, which read differently per group. */
function linesFor(
  r: OperatorReservation,
  group: Group,
  room: string | null,
  today: string,
): { top: string; bottom: string } {
  if (group === "pending") {
    return { top: nights(r.nights), bottom: dateRangeIso(r.checkIn, r.checkOut) };
  }
  if (group === "arriving") {
    return room
      ? { top: `Room ${room}`, bottom: `${nights(r.nights)} · ${dateRangeIso(r.checkIn, r.checkOut)}` }
      : { top: "No room yet", bottom: "Pick one at check-in, from the rooms that are actually free" };
  }
  if (group === "departing") {
    return { top: room ? `Room ${room}` : "No room on file", bottom: `Checkout today · ${dshortIso(r.checkOut)}` };
  }
  // In-house. "Night 2 of 3" is counted from the arrival date rather than
  // stored, so it stays right without anybody updating a row at midnight.
  const elapsed = daysBetween(r.checkIn, today);
  const nightNo = Math.min(Math.max(1, elapsed), r.nights);
  return {
    top: room ? `Room ${room}` : "No room on file",
    bottom: `Night ${nightNo} of ${r.nights} · out ${dshortIso(r.checkOut)}`,
  };
}

/** Whole days from one `YYYY-MM-DD` to another. Both are bare dates, so UTC is safe. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The same day from the demo store, unchanged in behaviour.
 *
 * It groups on a day OFFSET rather than on a date, because that is what the
 * fixture stores: `start === 0` is arriving today and `start + nights === 0` is
 * leaving today. The two rules say the same thing about different inputs, which
 * is why they are two functions rather than one with a flag.
 */
function fromDemo(P: HospitalityProperty): DayRow[] {
  const roomType = (r: Reservation) => P.rooms.find((x) => x.id === r.room)?.type ?? "";

  return P.res.flatMap((r): DayRow[] => {
    const group: Group | null =
      r.status === "pending" ? "pending"
      : r.status === "confirmed" && r.start === 0 ? "arriving"
      : r.status === "inhouse" && r.start + r.nights === 0 ? "departing"
      : r.status === "inhouse" && r.start + r.nights > 0 ? "inhouse"
      : null;
    if (!group) return [];

    const lines =
      group === "pending"
        ? { top: nights(r.nights), bottom: dateRange(r.start, r.nights) }
        : group === "arriving"
          ? r.room
            ? { top: `Room ${r.room} · ${roomType(r)}`, bottom: `${nights(r.nights)} · ${dateRange(r.start, r.nights)}` }
            : { top: "No room yet", bottom: "Assign one on the Room grid, or pick at check-in" }
          : group === "departing"
            ? { top: `Room ${r.room} · ${roomType(r)}`, bottom: `Checkout by ${r.time ?? "11:00"}` }
            : {
                top: `Room ${r.room} · ${roomType(r)}`,
                bottom: `Night ${Math.max(1, -r.start)} of ${r.nights} · out ${dshort(r.start + r.nights)}`,
              };

    return [{
      id: r.id,
      guest: r.guest,
      guestName: r.guest,
      nights: r.nights,
      sub:
        group === "pending" ? `${r.id} · ${r.rep ?? ""}`
        : group === "arriving" && r.walkin ? "Walk-in · no reservation"
        : r.id,
      ...lines,
      group,
      // The fixture has no stay rows. The demo bill is addressed by the
      // reservation id, which is what `billHref` special-cases.
      stayId: null,
      balance: r.room ? buildFolio(r, P).bal : 0,
      walkIn: Boolean(r.walkin),
      source: "demo",
      demo: r,
    }];
  });
}

function TodayRow({
  r,
  first,
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
  first: boolean;
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
  const nameCell = (
    <span style={{ minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {r.guest}
      </span>
      <span className="pms-num" style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
        {r.sub}
      </span>
    </span>
  );

  const midCell = (
    <span style={{ minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 13, color: "var(--ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.top}</span>
      <span className="pms-num" style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>{r.bottom}</span>
    </span>
  );

  const NO_BILL = "This booking has no open stay yet, so there is no bill to open.";

  return (
    <Row first={first}>
      <Initials>{initials(r.guest)}</Initials>
      {nameCell}
      {midCell}
      <span style={{ justifySelf: "end" }}>
        {r.group === "pending" ? (
          <Badge intent="warn">Request</Badge>
        ) : r.group === "arriving" ? (
          r.walkIn ? <Badge intent="warn">Awaiting ID</Badge> : <Badge intent="info">Arrives today</Badge>
        ) : r.group === "departing" ? (
          /* A balance nobody is allowed to read is not reported as zero. */
          !mayReadBills ? (
            <Badge intent="neutral">Bill</Badge>
          ) : r.balance === null ? (
            <Badge intent="neutral">No bill</Badge>
          ) : r.balance > 0 ? (
            <Badge intent="warn">{`${fmt(r.balance)} due`}</Badge>
          ) : (
            <Badge intent="ok">Settled</Badge>
          )
        ) : (
          <Badge intent="accent">In-house</Badge>
        )}
      </span>
      <span style={{ display: "flex", gap: 8, justifySelf: "end" }}>
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
              onClick={onApprove}
              deniedReason={decideReason}
              pending={pendingAction === "approve"}
              style={{ minWidth: 104 }}
            >
              {pendingAction === "approve" ? "Approving" : "Approve"}
            </ActionButton>
          </>
        )}
        {r.group === "arriving" && (
          <ActionButton variant="primary" onClick={onCheckIn} deniedReason={checkInReason} style={{ minWidth: 104 }}>
            Check in
          </ActionButton>
        )}
        {r.group === "departing" && (
          <>
            <ActionButton onClick={onBill} deniedReason={billHref ? undefined : NO_BILL}>
              View bill
            </ActionButton>
            {/* ONE press, and it stays one press: check-out is the fast path
                and never grows a confirm step. What it gains is the wait made
                visible, so nobody presses it twice wondering. */}
            <ActionButton
              variant="primary"
              onClick={onCheckout}
              deniedReason={checkOutReason}
              pending={pendingAction === "checkout"}
              style={{ minWidth: 104 }}
            >
              {pendingAction === "checkout" ? "Checking out" : "Check out"}
            </ActionButton>
          </>
        )}
        {r.group === "inhouse" && (
          <ActionButton onClick={onBill} deniedReason={billHref ? undefined : NO_BILL} style={{ minWidth: 104 }}>
            View bill
          </ActionButton>
        )}
      </span>
    </Row>
  );
}

function Row({ children, first }: { children: React.ReactNode; first: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1.4fr 1.5fr auto auto",
        gap: 14,
        alignItems: "center",
        padding: "11px 18px",
        borderTop: `1px solid ${first ? "transparent" : "var(--line)"}`,
      }}
    >
      {children}
    </div>
  );
}
