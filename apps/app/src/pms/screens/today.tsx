"use client";

/**
 * Today — the temporal home of the front desk (F-B07, blueprint §4).
 *
 * Actionable stat tiles filter the grouped list beneath them; each row carries
 * exactly one primary action. This is the "start the day" journey: scan, tap a
 * tile to narrow, act per row.
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
 *  - `GET /ops/rooms` supplies each arriving guest's ROOM READINESS (2026-10-06):
 *    the question a desk asks about an arrival is whether the room is clean, and
 *    the answer was one screen away on Room status. Same read, same cache, same
 *    four words; gated by the hook on the read's own permissions.
 *
 * **THE BOARD (2026-10-06).** The pill chips became stat tiles with an icon and
 * a hint line, the setup card became one line, and the list became a board:
 *
 *  - From 1280px wide the groups sit in two columns. Requests and departures
 *    on the left, because both are a decision with money on it (approve or
 *    refund; settle the bill and let them go). Arrivals on the right, each with
 *    its room's readiness, because that column is the afternoon's work and is
 *    read top to bottom as guests turn up. In-house runs full width under both:
 *    it is the longest list and the least urgent, and a full line per guest
 *    fits the bill figure. One column below 1280px, in the same order, since
 *    two columns of cards on a laptop or a phone would be narrower than a card.
 *  - Rows lay themselves out by the column they are in (`today-row.tsx`), so a
 *    phone gets cards with a full width primary button rather than a page that
 *    scrolled sideways.
 *  - An owner (`money.view`) gets one line of figures under the tiles: rooms
 *    occupied tonight and what today's departures still owe. Both are counted
 *    from the rows already on this screen; neither is a new read.
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

import { BedDouble, Inbox, LogIn, LogOut, Wallet, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { HousekeepingStatus, OperatorFolio, OperatorReservation, OperatorRoomAssignment, OperatorStay } from "@injishi/contracts";

import { SetupBanner } from "../components/setup-banner";
import { TodayRow, type DayRow, type Group, type Readiness } from "../components/today-row";
import { useWorkspaceHref } from "../lib/workspace-href";
import { useHost, usePms } from "../store";
import { usePmsUi } from "../ui-store";
import type { HospitalityProperty, Intent, Reservation } from "../data/types";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useApproveReservation,
  useDeclineReservation,
  useReservations,
} from "../data/reservations";
import { useCheckOut, useFolios, useRoomAssignments, useRooms, useStays } from "../data/ops";
import { seedFromDemoReservation, seedFromServerReservation } from "../lib/check-in-seed";
import { buildFolio } from "../lib/folio";
import { addDaysIso, dateRange, dateRangeIso, dshort, dshortIso, fmt, nights, todayIso } from "../lib/format";
import { HOUSEKEEPING_FROM_DEMO } from "../lib/housekeeping";
import { EmptyState, LoadFailed, SectionHeading, Skeleton, StatTile, surfaceClass } from "../components/ui";
import { cn } from "@/lib/utils";

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

type ChipKey = "all" | Group;

/**
 * The four groups, once. The tile, the section heading and the empty state all
 * read this, so a group has one name, one icon and one colour wherever it shows.
 */
const GROUPS: readonly {
  key: Group;
  /** The section heading. */
  label: string;
  /** The tile's shorter word. */
  tile: string;
  icon: LucideIcon;
  intent: Intent;
  emptyTxt: string;
}[] = [
  {
    key: "pending",
    label: "Requests to approve",
    tile: "Requests",
    icon: Inbox,
    intent: "warn",
    emptyTxt: "No pending requests. New booking requests appear here the moment they arrive.",
  },
  {
    key: "arriving",
    label: "Arriving today",
    tile: "Arriving",
    icon: LogIn,
    intent: "info",
    emptyTxt: "No arrivals today. Tomorrow's arrivals are on the Calendar.",
  },
  {
    key: "departing",
    label: "Departing today",
    tile: "Departing",
    icon: LogOut,
    intent: "neutral",
    emptyTxt: "No departures today.",
  },
  {
    key: "inhouse",
    label: "In-house tonight",
    tile: "In-house",
    icon: BedDouble,
    intent: "accent",
    emptyTxt: "No guests in-house tonight. Walk-ins open a bill in under two minutes.",
  },
];

/**
 * Where each group sits on the two column board, from 1280px. The DOM order is
 * the single column order (requests, arriving, departing, in-house); the grid
 * places them, so a keyboard and a screen reader meet them in the same order
 * on every width. Departing takes the `1fr` row, so a long arrivals column
 * stretches the space under departures rather than opening a gap between the
 * two sections on the left.
 */
const BOARD_PLACE: Record<Group, string> = {
  pending: "xl:col-start-1 xl:row-start-1",
  arriving: "xl:col-start-2 xl:row-span-2 xl:row-start-1",
  departing: "xl:col-start-1 xl:row-start-2",
  inhouse: "xl:col-span-2 xl:row-start-3",
};

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
  /*
   * The rooms list, for readiness. `useRooms` gates itself on the read's own
   * permissions (`OPS_READ.rooms`), so a caller who may not read it sends
   * nothing and every arrival simply shows no readiness rather than a refusal.
   * One read, shared with Room status and the sidebar through the query cache.
   */
  const rooms = useRooms(workspaceId);
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

  /* Room label -> housekeeping state, or null when the rooms read has not
     answered (or may not be made): readiness then stays unknown, never "ready". */
  const roomState: Map<string, HousekeepingStatus> | null = live
    ? rooms.data
      ? new Map(rooms.data.rooms.flatMap((rm) => (rm.label ? [[rm.label, rm.housekeeping] as const] : [])))
      : null
    : new Map(P.rooms.map((rm) => [rm.id, HOUSEKEEPING_FROM_DEMO[rm.hk]] as const));

  const rows = live
    ? fromServer(
        reservations.data?.reservations ?? [],
        stays.data?.stays ?? [],
        mayReadBills ? (folios.data?.folios ?? []) : null,
        holds.data?.assignments ?? [],
        roomState,
      )
    : fromDemo(P, roomState);

  const loading = live && (reservations.isPending || stays.isPending);
  const failed = live && (reservations.isError || stays.isError);

  const byGroup = (g: Group) => rows.filter((r) => r.group === g);
  const arriving = byGroup("arriving");
  const departing = byGroup("departing");

  /* The hint under each tile answers the next question about its number. */
  const noRoom = arriving.filter((r) => r.readiness === "no-room").length;
  const notReady = arriving.filter((r) => r.readiness === "dirty" || r.readiness === "out_of_order").length;
  const owing = departing.filter((r) => r.balance !== null && r.balance > 0);
  const leavingTomorrow = byGroup("inhouse").filter((r) => r.leavesTomorrow).length;
  /* Short on purpose: a tile is a fifth of a 1280px screen, and a hint that
     truncates answers nothing. */
  const hint: Record<Group, string> = {
    pending: byGroup("pending").length > 0 ? "To decide" : "Nothing waiting",
    arriving:
      arriving.length === 0
        ? "Nobody due"
        : noRoom > 0
          ? `${noRoom} need a room`
          : notReady > 0
            ? `${notReady} ${notReady === 1 ? "room" : "rooms"} not ready`
            : roomState
              ? "Rooms ready"
              : "Due today",
    departing:
      departing.length === 0
        ? "Nobody leaving"
        : mayReadBills && owing.length > 0
          ? `${owing.length} ${owing.length === 1 ? "owes" : "owe"} money`
          : "Leaving today",
    // Tomorrow's departures, which are what a desk plans tonight around.
    inhouse:
      byGroup("inhouse").length === 0
        ? "Nobody in"
        : leavingTomorrow > 0
          ? `${leavingTomorrow} out tomorrow`
          : "None out tomorrow",
  };

  /*
   * The owner's line (`money.view`). Counted from the rows on this screen and
   * nothing else: tonight's rooms are everybody staying past today plus
   * everybody arriving today, and what is owed is the sum of the departures'
   * open balances. The room count is the denominator only when the rooms read
   * answered; without it the line still says how many, just not out of what.
   */
  const occupiedTonight = byGroup("inhouse").length + arriving.length;
  const totalRooms = live ? (rooms.data?.rooms.length ?? null) : P.rooms.length;
  // Only once the bills have answered: before that every balance is unknown,
  // and a sum of unknowns would print "RWF 0 owed" for a moment.
  const owed =
    mayReadBills && (!live || folios.isSuccess) ? owing.reduce((sum, r) => sum + (r.balance ?? 0), 0) : null;
  const showFigures = can("money.view") && !loading && !failed;

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

  function section(g: (typeof GROUPS)[number], filtered: boolean) {
    const list = byGroup(g.key);
    return (
      <DaySection
        key={g.key}
        group={g}
        count={list.length}
        className={filtered ? undefined : BOARD_PLACE[g.key]}
        action={
          filtered ? (
            <button
              type="button"
              onClick={() => setChip("all")}
              className="cursor-pointer rounded px-1 text-xs font-semibold text-accent-text hover:underline"
            >
              Show all {rows.length}
            </button>
          ) : undefined
        }
      >
        {list.length === 0 ? null : (
          list.map((r) => (
            <TodayRow
              key={r.id}
              r={r}
              decideReason={decideReason}
              checkInReason={checkInReason}
              checkOutReason={checkOutReason}
              /* ONE row's pending, not the board's. `variables` is the id the
                 mutation was called with, so the guest whose button was pressed
                 is the only one that shimmers — a shared `isPending` relabelled
                 every row at once. */
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
                    : seedFromServerReservation({
                        id: r.id,
                        guestName: r.guestName,
                        nights: r.nights,
                        reference: r.reference,
                        roomTypeId: r.roomTypeId,
                      }),
                )
              }
              onCheckout={() => departGuest(r)}
              onBill={() => {
                const to = billHref(r);
                if (to) router.push(to);
              }}
            />
          ))
        )}
      </DaySection>
    );
  }

  return (
    <div className="pms-enter flex min-w-0 flex-col gap-3">
      <SetupBanner />

      {/* The tiles, and beside them on a wide screen the owner's two figures.
          On a narrower one the figures drop to a line under the tiles: the
          same grid, its fifth cell spanning it. The turn is at 1400px rather
          than the board's 1280, because beside the figures a tile at 1280 is
          too narrow for its own label. It is written 87.5rem, in the unit
          the theme's breakpoints use: in px, Tailwind cannot order it after
          `md:` and the narrow layout wins on every width. */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 min-[87.5rem]:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div role="group" aria-label="Filter today's guests" className="contents">
          {GROUPS.map((g) => (
            <StatTile
              key={g.key}
              icon={g.icon}
              label={g.tile}
              n={loading ? "—" : byGroup(g.key).length}
              hint={loading || failed ? undefined : hint[g.key]}
              intent={g.intent}
              active={chip === g.key}
              // Pressing the lit tile again is the way back to everything, as
              // pressing a lit filter chip always was.
              onPress={() => setChip(chip === g.key ? "all" : g.key)}
            />
          ))}
        </div>

        {showFigures && (
          <dl
            className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink2 md:col-span-4 min-[87.5rem]:col-span-1 min-[87.5rem]:flex-col min-[87.5rem]:flex-nowrap min-[87.5rem]:items-start min-[87.5rem]:justify-center min-[87.5rem]:border-l min-[87.5rem]:border-line min-[87.5rem]:pl-4"
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <dt className="flex">
                <BedDouble aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={2} />
                <span className="sr-only">Rooms occupied tonight</span>
              </dt>
              <dd>
                <strong className="pms-num font-semibold text-foreground">{occupiedTonight}</strong>
                {totalRooms !== null && totalRooms > 0
                  ? ` of ${totalRooms} rooms tonight · ${Math.round((occupiedTonight / totalRooms) * 100)}%`
                  : ` ${occupiedTonight === 1 ? "room" : "rooms"} tonight`}
              </dd>
            </div>
            {owed !== null && (
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <dt className="flex">
                  <Wallet aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={2} />
                  <span className="sr-only">Still owed by today&apos;s departures</span>
                </dt>
                <dd>
                  <strong className="pms-num font-semibold text-foreground">{fmt(owed)}</strong>
                  <span aria-hidden="true"> owed by departures</span>
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {loading ? (
        <div className={cn(surfaceClass, "flex flex-col gap-2.5 p-[18px]")}>
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
      ) : chip === "all" ? (
        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 xl:grid-rows-[auto_1fr_auto] xl:items-start">
          {GROUPS.map((g) => section(g, false))}
        </div>
      ) : (
        section(GROUPS.find((g) => g.key === chip) ?? GROUPS[0], true)
      )}
    </div>
  );
}

/** One group: its heading, then its rows as a list, or its empty state. */
function DaySection({
  group,
  count,
  action,
  className,
  children,
}: {
  group: (typeof GROUPS)[number];
  count: number;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-2", className)}>
      <SectionHeading id={headingId} n={count} icon={group.icon} action={action}>
        {group.label}
      </SectionHeading>
      {count === 0 ? (
        <EmptyState icon={group.icon}>{group.emptyTxt}</EmptyState>
      ) : (
        /* The list is the CONTAINER its rows measure (`@container`), so a row
           reads the column it is in rather than the window. */
        <ul aria-labelledby={headingId} className="@container min-w-0 rounded-card border border-panel-bd bg-card">
          {children}
        </ul>
      )}
    </section>
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
 *
 * `roomState` is null, not empty, for the same reason on rooms: an empty map
 * would make every arrival "no room yet"'s cousin, "unknown room", look like a
 * fact. Null leaves readiness unknown.
 */
function fromServer(
  reservations: readonly OperatorReservation[],
  stays: readonly OperatorStay[],
  folios: readonly OperatorFolio[] | null,
  holds: readonly OperatorRoomAssignment[] = [],
  roomState: ReadonlyMap<string, HousekeepingStatus> | null = null,
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

  // Name the branch on each row once there is more than one in view: a host
  // with two properties saw requests and arrivals that named neither.
  const branches = new Set(reservations.map((r) => r.propertyName).filter(Boolean));
  const whereFor = (r: OperatorReservation) =>
    branches.size > 1 && r.propertyName
      ? ` · ${r.propertyName}${r.roomTypeName ? `, ${r.roomTypeName}` : ""}`
      : "";

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
    const guest = r.guestName ?? r.guestEmail ?? "Guest";

    rows.push({
      id: r.id,
      guest,
      guestName: r.guestName,
      nights: r.nights,
      sub: `${r.reference}${whereFor(r)}`,
      ...linesFor(r, group, room, today),
      group,
      room,
      readiness: group === "arriving" ? readinessOf(room, roomState) : null,
      stayId: stay?.id ?? null,
      balance: folio ? folio.balanceRwf : null,
      leavesTomorrow: group === "inhouse" && r.checkOut === addDaysIso(today, 1),
      // The server has no walk-in flag on a reservation, and it does not need
      // one: a walk-in never had a booking, so it is never in this list.
      walkIn: false,
      roomTypeId: r.roomTypeId,
      reference: r.reference,
      source: "live",
    });
  }
  return rows;
}

/**
 * An arrival's readiness. No room is a fact we can state; a room whose state we
 * cannot read is not, so it stays null. A label the rooms list does not carry
 * is the second kind: say nothing rather than call it ready.
 */
function readinessOf(room: string | null, roomState: ReadonlyMap<string, HousekeepingStatus> | null): Readiness {
  if (!room) return "no-room";
  return roomState?.get(room) ?? null;
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
    // The badge says "No room yet"; the line says what to do about it.
    return room
      ? { top: `Room ${room}`, bottom: `${nights(r.nights)} · ${dateRangeIso(r.checkIn, r.checkOut)}` }
      : { top: `${nights(r.nights)} · ${dateRangeIso(r.checkIn, r.checkOut)}`, bottom: "Pick a room at check-in, from the ones actually free" };
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
function fromDemo(P: HospitalityProperty, roomState: ReadonlyMap<string, HousekeepingStatus> | null): DayRow[] {
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
            : { top: `${nights(r.nights)} · ${dateRange(r.start, r.nights)}`, bottom: "Assign one on the Room grid, or pick at check-in" }
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
        // The readiness badge now holds the arrival's status slot, so a walk-in
        // still waiting on its ID says so here rather than losing it.
        : group === "arriving" && r.walkin ? "Walk-in · awaiting ID"
        : r.id,
      ...lines,
      group,
      room: r.room,
      readiness: group === "arriving" ? readinessOf(r.room, roomState) : null,
      // The fixture has no stay rows. The demo bill is addressed by the
      // reservation id, which is what `billHref` special-cases.
      stayId: null,
      balance: r.room ? buildFolio(r, P).bal : 0,
      leavesTomorrow: group === "inhouse" && r.start + r.nights === 1,
      walkIn: Boolean(r.walkin),
      source: "demo",
      demo: r,
    }];
  });
}
