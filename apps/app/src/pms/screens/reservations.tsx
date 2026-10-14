"use client";

/**
 * Reservations — requests + confirmed, the dense list the front desk works
 * (was "Bookings"; blueprint §5 terminology). Status chips filter, a search
 * box narrows by guest or reference, and every row carries one primary action
 * matched to the reservation's state with the rest in a "more" menu.
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
 * **EVERY ROW ACTION OPENS SOMETHING REAL (2026-09-15).** "On the grid" and
 * "Assign room" open the grid at `?booking=<id>`, which moves its window to the
 * booking's dates, marks its bar and offers the rooms it may hold. "View" on a
 * finished booking opens its own record (`/reservations/:id`). Check in opens
 * the shared drawer against the live free-room list (ADR-035), and View bill
 * addresses the STAY, which is why `GET /ops/stays` is read beside the list.
 *
 * **ONE TABLE (2026-10-06).** Every row used to be its own CSS grid whose last
 * track was `auto`, so each row sized its action column by its own buttons and
 * Dates and Status landed a few pixels apart from one row to the next. It is a
 * real `<table>` now, `table-layout: fixed` with a `<colgroup>`, so every
 * column has one width for the whole list and the action column is a fixed
 * one. The row's buttons became one primary command plus a menu
 * (`row-actions.tsx`), which is what makes a fixed action column possible.
 *
 * A native table rather than HeroUI's Table, deliberately. HeroUI's is React
 * Aria's grid: one tab stop for the table and arrow keys between cells. That
 * model owns ArrowDown, and so does the Radix menu trigger in every row, so a
 * keyboard user opening "more" would also be moved a row down. A native table
 * keeps the Tab order every other listing in the app has, keeps the row header
 * a screen reader announces with each cell, and draws on the same surface
 * tokens as the rest of the operator screens.
 *
 * The Room column shows the room: the stay's once checked in, the one held for
 * the booking before that (`GET /ops/room-assignments`), and a "Not assigned"
 * chip for a request or a confirmed booking with neither. It showed "—" on
 * every row because it read only the reservation's own `room`, which is the
 * STAY's and stays null until check in.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { withQuery } from "@injishi/utils";
import { useRouter } from "next/navigation";
import type { OperatorReservation } from "@injishi/contracts";
import { CalendarDays, Check, FileText, KeyRound, LogIn, Receipt, SearchX, X } from "lucide-react";
import { SearchField } from "@heroui/react";
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
import { matchesBookingQuery } from "../lib/booking-search";
import { addDaysIso, dateRange, dateRangeIso, fmt, nights, todayIso } from "../lib/format";
import { ActionButton, Badge, Chip, EmptyState, LoadFailed, Skeleton, surfaceClass } from "../components/ui";
import { HOST_CANCEL_ICON, useHostCancel } from "../components/reservations/host-cancel-action";
import { DeclineDialog } from "../components/reservations/decline-dialog";
import { RowActions, type MenuAction } from "../components/reservations/row-actions";
import { cn } from "@/lib/utils";
// The wording of a decision lives with Today, so the two screens cannot tell
// an operator two different things about the same command.
import { decisionToast } from "./today";

type Bucket = "pending" | "confirmed" | "inhouse" | "out";
type Filter = "all" | Bucket;

const ORDER: Record<Bucket, number> = { pending: 0, confirmed: 1, inhouse: 2, out: 3 };

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
  /** The booking reference alone: what the search box matches. */
  reference: string;
  /** The room type a live booking bought; narrows the check-in room list. */
  roomTypeId?: string;
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
  /** The room's label: the stay's, or the one held for the booking. */
  room: string | null;
  /** True when `room` is a hold rather than the room the guest is in. */
  roomHeld: boolean;
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
  /** The server's row, which the host cancel dialog reads. Live rows only. */
  live?: OperatorReservation;
  /** The demo record, kept so the check in drawer can still be handed one. */
  demo?: Reservation;
}

export function Reservations() {
  const { dispatch, toast, toastError } = usePms();
  const P = useHost();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const workspaceId = useWorkspaceId();
  const list = useReservations(workspaceId);
  /*
   * Read second only for the STAY ID. `OperatorReservation` cannot carry one:
   * a stay does not exist until somebody arrives, so it is a different row with
   * a different lifetime. This read is what lets an in-house row open its bill.
   * A failure here degrades to a disabled button with its own wording; it never
   * blocks the list.
   */
  const stays = useStays(workspaceId);
  /*
   * Which confirmed bookings already hold a room, so the row shows the room and
   * says "On the grid" rather than "Assign room" to a desk that assigned it
   * yesterday. The reservation's own `room` is the STAY's room and stays null
   * until check in, so it cannot answer this. One windowed read, from today to
   * the last confirmed departure, asked only once the list has answered. The
   * API refuses a window over 62 days, so a booking further out than that reads
   * "Assign room" and the grid it opens says what it actually holds.
   */
  const confirmed = (list.data?.reservations ?? []).filter((r) => r.state === "confirmed");
  const latest = confirmed.reduce((max, r) => (r.checkOut > max ? r.checkOut : max), addDaysIso(todayIso(), 1));
  const holdsCap = addDaysIso(todayIso(), 62);
  const holdsTo = latest > holdsCap ? holdsCap : latest;
  const holds = useRoomAssignments(list.isSuccess ? workspaceId : null, todayIso(), holdsTo);
  const heldBookings = new Set((holds.data?.assignments ?? []).map((h) => h.bookingId));
  const heldRoomFor = new Map<string, string>();
  for (const h of holds.data?.assignments ?? []) {
    if (h.status === "assigned" && h.roomLabel && !heldRoomFor.has(h.bookingId)) heldRoomFor.set(h.bookingId, h.roomLabel);
  }
  const approve = useApproveReservation(workspaceId);
  const decline = useDeclineReservation(workspaceId);

  const live = workspaceId !== null;

  // Only an OPEN stay counts. A closed one is a previous guest in the same
  // room, and joining to it would point "View bill" at last week's folio.
  const openStayFor = new Map<string, { id: string; roomLabel: string | null }>();
  for (const s of stays.data?.stays ?? []) {
    if (s.lifecycle === "open" && s.bookingId) openStayFor.set(s.bookingId, { id: s.id, roomLabel: s.roomLabel });
  }

  // More than one branch in the list: each row names its own (see Today).
  const liveReservations = list.data?.reservations ?? [];
  const manyBranches =
    new Set(liveReservations.map((r) => r.propertyName).filter(Boolean)).size > 1;
  const rows: DeskRow[] = live
    ? liveReservations.flatMap((r) =>
        fromServer(r, openStayFor.get(r.id) ?? null, heldRoomFor.get(r.id) ?? null, manyBranches),
      )
    : P.res.filter((r) => r.status !== "declined").map((r) => fromDemo(r, P));

  const all = [...rows].sort(
    (a, b) => ORDER[a.bucket] - ORDER[b.bucket] || a.sortKey.localeCompare(b.sortKey),
  );
  // The search narrows first, so every chip counts what the search found: a
  // desk looking for "Uwase" sees at a glance which state she is in.
  const found = all.filter((r) => matchesBookingQuery(r.guest, r.reference, query));
  const shown = found.filter((r) => filter === "all" || r.bucket === filter);
  const searching = query.trim().length > 0;

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "inhouse", label: "In-house" },
    { key: "out", label: "Checked out" },
  ];

  /** Run a command and speak the answer, whichever way it went. */
  function decide(row: DeskRow, action: "approve" | "decline", settled?: () => void) {
    if (row.source === "demo") {
      dispatch({ type: action, id: row.id });
      settled?.();
      return;
    }
    const mutation = action === "approve" ? approve : decline;
    mutation.mutate(row.id, {
      onSuccess: () => toast(decisionToast(action, row.guest), action === "approve" ? "ok" : "info"),
      // Owned wording, chosen by what actually happened (`data/api.ts`).
      onError: toastError,
      onSettled: settled,
    });
  }

  return (
    <div className="pms-enter flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Filter by state" className="flex flex-wrap items-center gap-2.5">
          {chips.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              n={c.key === "all" ? found.length : found.filter((r) => r.bucket === c.key).length}
              active={filter === c.key}
              onClick={() => setFilter(c.key)}
              size="sm"
            />
          ))}
        </div>
        <SearchField
          aria-label="Search reservations by guest name or reference"
          value={query}
          onChange={setQuery}
          variant="secondary"
          className="w-full sm:ml-auto sm:w-72"
        >
          <SearchField.Group className="rounded border border-line2 bg-field">
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Guest name or reference" className="text-sm" />
            <SearchField.ClearButton aria-label="Clear the search" />
          </SearchField.Group>
        </SearchField>
      </div>
      {/* Says how many the search found, for a screen reader that cannot see
          the list shrink. Empty while there is no search, so it says nothing
          on every keystroke of a list nobody filtered. */}
      <p className="sr-only" aria-live="polite">
        {searching ? `${shown.length} ${shown.length === 1 ? "reservation matches" : "reservations match"} ${query.trim()}` : ""}
      </p>

      {live && list.isPending ? (
        <div className={cn(surfaceClass, "flex flex-col gap-2.5 p-[18px]")}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={38} delay={i * 80} />
          ))}
        </div>
      ) : live && list.isError ? (
        /* AC-13: a failed read is NOT an empty desk. An operator told "no
           reservations" when the truth is "we could not ask" will act on a desk
           that is not theirs. Say what happened, and offer the retry. */
        <LoadFailed onRetry={() => void list.refetch()} retrying={list.isFetching}>
          We couldn&apos;t load your reservations. Your bookings are safe — this is on our
          side, not an empty desk.
        </LoadFailed>
      ) : shown.length === 0 && searching ? (
        <EmptyState icon={SearchX} className="text-sm">
          No reservation{filter === "all" ? "" : ` in ${chips.find((c) => c.key === filter)?.label}`} matches
          &ldquo;{query.trim()}&rdquo;.{" "}
          <button
            type="button"
            className="cursor-pointer font-semibold text-accent-text underline"
            onClick={() => setQuery("")}
          >
            Clear the search
          </button>
          {filter !== "all" && found.length > 0 && (
            <>
              {" "}or{" "}
              <button
                type="button"
                className="cursor-pointer font-semibold text-accent-text underline"
                onClick={() => setFilter("all")}
              >
                show all {found.length} that match
              </button>
            </>
          )}
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={FileText} style={{ padding: 26, fontSize: 13.5 }}>
          No reservations in this view. New booking requests land under Pending the moment they arrive.
        </EmptyState>
      ) : (
        <>
          {/* A phone gets cards: the same facts and commands as a row, with the
              primary button within reach of a thumb. The table from 640px. */}
          <ul aria-label="Reservations" className="flex flex-col gap-2.5 sm:hidden">
            {shown.map((r) => (
              <DeskCard
                key={r.id}
                r={r}
                heldBookings={heldBookings}
                approving={approve.isPending && approve.variables === r.id}
                declining={decline.isPending && decline.variables === r.id}
                onDecide={decide}
              />
            ))}
          </ul>
          {/* The table keeps its designed width and scrolls INSIDE this box when
              the screen is narrower than it (a tablet, a split window), so the
              page itself never scrolls sideways; the guest column stays pinned
              while the rest moves under it. `relative` is what makes the box
              hold: it is the containing block of every `sr-only` label in the
              table, which is absolutely positioned and otherwise hung off the
              page at the table's far edge, outside the scroll box, so the page
              grew to 893px on a 390px screen. */}
          <div className="relative hidden overflow-x-auto overscroll-x-contain rounded-card border border-panel-bd bg-card sm:block">
          <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-0 text-left">
            <caption className="sr-only">Reservations{filter === "all" ? "" : `, ${chips.find((c) => c.key === filter)?.label}`}</caption>
            <colgroup>
              <col />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-36" />
              <col className="w-28" />
              <col className="w-56" />
            </colgroup>
            <thead>
              <tr className="text-2xs font-bold tracking-[0.05em] uppercase text-[var(--muted2)]">
                <th scope="col" className={cn(HEAD, STICKY, "pl-4")}>Guest</th>
                <th scope="col" className={HEAD}>Dates</th>
                <th scope="col" className={HEAD}>Room</th>
                <th scope="col" className={HEAD}>Status</th>
                <th scope="col" className={cn(HEAD, "text-right")}>Total</th>
                <th scope="col" className={cn(HEAD, "pr-4 text-right")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <DeskRowView
                  key={r.id}
                  r={r}
                  heldBookings={heldBookings}
                  approving={approve.isPending && approve.variables === r.id}
                  declining={decline.isPending && decline.variables === r.id}
                  onDecide={decide}
                />
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}

const HEAD = "border-b border-line px-3 py-2.5 font-bold whitespace-nowrap";
/* The guest column holds still while a narrow screen scrolls the rest. Its own
   fill, so the cells sliding under it do not show through. */
const STICKY = "sticky left-0 z-10 bg-card";
const CELL = "border-t border-line px-3 py-2.5 align-middle";
/* The hover tint on the pinned cell is painted OVER its opaque fill rather than
   replacing it: `--hover` is translucent in dark mode, and a translucent
   pinned cell would show the cells scrolling beneath it. */
const STICKY_HOVER = "group-hover:shadow-[inset_0_0_0_100vmax_var(--hover)]";

/**
 * Why "View bill" is refused on an in-house row with no stay to address.
 *
 * The bill screen is fine; there is simply no stay to address. That happens
 * when the reservations and stays reads disagree for a moment, and it is worded
 * as that rather than as a broken screen, which would send the operator looking
 * in the wrong place.
 */
const NO_STAY = "We can't find an open stay for this booking, so there is no bill to open.";

/** What a row offers, built once for either of its two layouts. */
interface RowCommands {
  primary: React.ReactNode;
  more: MenuAction[];
  /** The decline and host cancel dialogs, closed until a menu item opens one. */
  dialogs: React.ReactNode;
  moreRef: React.RefObject<HTMLButtonElement | null>;
  recordHref: string;
}

/**
 * One booking's commands: the primary one for its state, the rest for its menu,
 * and the dialogs two of them open. A hook rather than a component because the
 * same booking is drawn as a table row on a wide screen and as a card on a
 * phone, and both must offer exactly the same thing. Each layout holds its own
 * dialog state, so the decline and the cancel are scoped to the row that
 * opened them.
 */
function useRowCommands({
  r,
  heldBookings,
  approving,
  declining,
  onDecide,
  primaryClass,
}: RowProps & {
  /** The primary button's width: one column width in the table, the rest of the line on a card. */
  primaryClass: string;
}): RowCommands {
  const router = useRouter();
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const { openCheckIn } = usePmsUi();
  const { can, reasonFor } = useCapability();
  const moreRef = useRef<HTMLButtonElement>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  // Confirmed bookings only: a pending one already has Decline, which is the
  // same refund. The hook gates on `reservation.approve` and offers nothing
  // once the guest is in. Focus goes back to this row's menu when it closes.
  const hostCancel = useHostCancel(r.bucket === "confirmed" ? r.live : undefined, () => moreRef.current?.focus());

  // `reasonFor` returns undefined when the caller MAY act, which is exactly the
  // shape `deniedReason` wants: no reason means no refusal.
  const decideReason = can("reservation.approve") ? undefined : reasonFor("reservation.approve");
  const checkInReason = can("stay.checkin") ? undefined : reasonFor("stay.checkin");

  const recordHref = href(`/reservations/${r.id}`);
  const gridHref = href(r.source === "live" ? withQuery("/calendar", { booking: r.id }) : "/calendar");
  const onGrid = Boolean(r.room) || heldBookings.has(r.id);
  const PRIMARY = cn("justify-center", primaryClass);

  const openRecord: MenuAction = {
    key: "record",
    label: "Open booking",
    icon: FileText,
    onSelect: () => router.push(recordHref),
  };

  let primary: React.ReactNode = null;
  const more: MenuAction[] = [];

  if (r.bucket === "pending") {
    primary = (
      <ActionButton
        variant="primary"
        icon={Check}
        onClick={() => onDecide(r, "approve")}
        deniedReason={decideReason}
        /* This row's wait, not the list's. */
        pending={approving}
        className={PRIMARY}
      >
        {approving ? "Approving" : "Approve"}
      </ActionButton>
    );
    more.push(openRecord, {
      key: "decline",
      label: "Decline and refund",
      icon: X,
      danger: true,
      deniedReason: decideReason,
      onSelect: () => setDeclineOpen(true),
    });
  } else if (r.bucket === "confirmed") {
    primary = r.today ? (
      /* A LIVE row opens the drawer: it has sent real commands since ADR-035,
         and `checkInReason` is the ordinary capability refusal, so a
         receptionist without `stay.checkin` still sees why rather than a
         button that 403s. */
      <ActionButton
        variant="primary"
        icon={LogIn}
        onClick={() =>
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
        deniedReason={checkInReason}
        className={PRIMARY}
      >
        Check in
      </ActionButton>
    ) : (
      /* Opens the grid ON this booking: its dates in view, its bar marked, and
         the rooms it may hold offered in place. */
      <ActionButton icon={onGrid ? CalendarDays : KeyRound} onClick={() => router.push(gridHref)} className={PRIMARY}>
        {onGrid ? "On the grid" : "Assign room"}
      </ActionButton>
    );
    more.push(openRecord);
    if (r.today) {
      more.push({
        key: "grid",
        label: onGrid ? "Show on the grid" : "Assign a room on the grid",
        icon: CalendarDays,
        onSelect: () => router.push(gridHref),
      });
    }
    if (hostCancel.offered) {
      more.push({
        key: "cancel",
        label: hostCancel.pending ? "Cancelling" : "Cancel booking",
        icon: HOST_CANCEL_ICON,
        danger: true,
        deniedReason: hostCancel.deniedReason,
        onSelect: hostCancel.open,
      });
    }
  } else if (r.bucket === "inhouse") {
    /* THE BILL HANGS OFF THE STAY, NOT THE BOOKING, which is why this needed
       `GET /ops/stays` rather than a bigger reservation payload. */
    primary = (
      <ActionButton
        icon={Receipt}
        onClick={() => {
          const to = r.source === "demo" ? r.id : r.stayId;
          if (to) router.push(href(`/stays/${to}/folio`));
        }}
        deniedReason={r.source === "demo" || r.stayId ? undefined : NO_STAY}
        className={PRIMARY}
      >
        View bill
      </ActionButton>
    );
    more.push(openRecord, {
      key: "grid",
      label: "Show on the grid",
      icon: CalendarDays,
      onSelect: () => router.push(gridHref),
    });
  } else {
    /* A finished booking's record: its dates, total, and the stay and bill it
       became. The grid only reaches two days back, so it could not show most
       of these. */
    primary = (
      <ActionButton icon={FileText} onClick={() => router.push(recordHref)} className={PRIMARY}>
        View
      </ActionButton>
    );
  }

  const dialogs = (
    <>
      {r.bucket === "pending" && (
        <DeclineDialog
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          guest={r.guest}
          reference={r.reference}
          dates={r.dates}
          pending={declining}
          onConfirm={() => onDecide(r, "decline", () => setDeclineOpen(false))}
          onClosed={() => moreRef.current?.focus()}
        />
      )}
      {hostCancel.dialog}
    </>
  );

  return { primary, more, dialogs, moreRef, recordHref };
}

interface RowProps {
  r: DeskRow;
  heldBookings: ReadonlySet<string>;
  approving: boolean;
  declining: boolean;
  onDecide: (row: DeskRow, action: "approve" | "decline", settled?: () => void) => void;
}

/** One booking as a table row: the wide layout. */
function DeskRowView(props: RowProps) {
  const { r } = props;
  // One width for every row's main button, so the column reads as a column.
  const c = useRowCommands({ ...props, primaryClass: "w-32" });

  return (
    <tr data-res-row className="group">
      <th scope="row" className={cn(CELL, STICKY, "pl-4 font-normal", STICKY_HOVER)}>
        {/* The row is an index INTO the record, not the only place it can be
            seen (ADR-018, AC-9). This link is what a duty manager copies into
            a handover message. */}
        <Link
          href={c.recordHref}
          className="block truncate text-sm font-semibold text-foreground no-underline hover:underline"
        >
          {r.guest}
        </Link>
        <span className="pms-num block truncate text-2xs text-muted-foreground">{r.sub}</span>
      </th>
      <td data-col="dates" className={cn(CELL, "group-hover:bg-hover")}>
        <span className="pms-num block text-sm whitespace-nowrap text-ink2">{r.dates}</span>
        <span className="pms-num block text-2xs text-muted-foreground">{nights(r.nights)}</span>
      </td>
      <td data-col="room" className={cn(CELL, "group-hover:bg-hover")}>
        <RoomCell r={r} />
      </td>
      <td data-col="status" className={cn(CELL, "group-hover:bg-hover")}>
        <Badge intent={r.badgeIntent}>{r.badgeLabel}</Badge>
      </td>
      <td className={cn(CELL, "text-right group-hover:bg-hover")}>
        <span className="pms-num text-sm font-semibold whitespace-nowrap text-foreground">
          {r.total === null ? "—" : fmt(r.total)}
        </span>
      </td>
      <td className={cn(CELL, "pr-4 group-hover:bg-hover")}>
        <RowActions primary={c.primary} more={c.more} moreLabel={`More for ${r.guest}`} triggerRef={c.moreRef} />
        {c.dialogs}
      </td>
    </tr>
  );
}

/**
 * One booking as a card: the phone layout. The same facts and the same
 * commands as the row, stacked, with the primary button across the card rather
 * than at the far end of a table the thumb had to scroll sideways to reach.
 */
function DeskCard(props: RowProps) {
  const { r } = props;
  const c = useRowCommands({ ...props, primaryClass: "flex-1" });

  return (
    <li data-res-card className="rounded-card border border-panel-bd bg-card px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <Link
            href={c.recordHref}
            className="block truncate text-sm font-semibold text-foreground no-underline hover:underline"
          >
            {r.guest}
          </Link>
          <span className="pms-num block truncate text-2xs text-muted-foreground">{r.sub}</span>
        </span>
        <Badge intent={r.badgeIntent}>{r.badgeLabel}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="pms-num text-sm whitespace-nowrap text-ink2">
          {r.dates} <span className="text-2xs text-muted-foreground">· {nights(r.nights)}</span>
        </span>
        <RoomCell r={r} />
        {r.total !== null && (
          <span className="pms-num ml-auto text-sm font-semibold whitespace-nowrap text-foreground">{fmt(r.total)}</span>
        )}
      </div>
      <RowActions
        primary={c.primary}
        more={c.more}
        moreLabel={`More for ${r.guest}`}
        triggerRef={c.moreRef}
        className="mt-3"
      />
      {c.dialogs}
    </li>
  );
}

/**
 * The room, or the honest absence of one.
 *
 * A request or a confirmed booking with no room is a job for the desk, so it
 * says "Not assigned" as a chip. A finished booking with none is history, not
 * a job, so it is a dash.
 */
function RoomCell({ r }: { r: DeskRow }) {
  if (r.room) {
    return (
      <span className="block truncate text-sm text-ink2">
        <span className="pms-num font-semibold text-foreground">{r.room}</span>
        {r.roomHeld && <span className="text-2xs text-muted-foreground"> · held</span>}
      </span>
    );
  }
  if (r.bucket === "pending" || r.bucket === "confirmed") {
    return (
      <Badge intent="neutral" icon={KeyRound}>
        Not assigned
      </Badge>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

/**
 * A server reservation as the desk reads it.
 *
 * Returns an EMPTY array for a declined request, which is how the demo list has
 * always behaved: a refused request is finished business and the desk has
 * nothing left to do with it. A cancellation is kept, because somebody has to
 * see that a confirmed booking went away.
 */
function fromServer(
  r: OperatorReservation,
  stay: { id: string; roomLabel: string | null } | null,
  heldRoom: string | null,
  nameBranch = false,
): DeskRow[] {
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

  // The room the guest is in, else the one held for them. A hold only means
  // something before the guest leaves, so a finished booking shows its own.
  const own = r.room ?? stay?.roomLabel ?? null;
  const held = bucket === "pending" || bucket === "confirmed" ? heldRoom : null;

  return [{
    id: r.id,
    // An account can exist before a name does, and "Guest" beats a blank cell
    // that reads as a rendering bug.
    guest: r.guestName ?? r.guestEmail ?? "Guest",
    guestName: r.guestName,
    nights: r.nights,
    reference: r.reference,
    roomTypeId: r.roomTypeId,
    sub:
      nameBranch && r.propertyName
        ? `${r.reference} · ${r.propertyName}${r.roomTypeName ? `, ${r.roomTypeName}` : ""}`
        : r.reference,
    dates: dateRangeIso(r.checkIn, r.checkOut),
    sortKey: r.checkIn,
    room: own ?? held,
    roomHeld: own === null && held !== null,
    bucket,
    ...badge,
    total: r.totalRwf,
    today,
    source: "live",
    stayId: stay?.id ?? null,
    live: r,
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
    reference: r.id,
    sub: r.rep ? `${r.id} · ${r.rep}` : r.id,
    dates: dateRange(r.start, r.nights),
    sortKey: String(r.start + 1000).padStart(6, "0"),
    room: r.room,
    // The fixture's `room` is the assignment: a confirmed demo booking with a
    // room is a hold, an in-house one is the room the guest is in.
    roomHeld: Boolean(r.room) && (status === "pending" || status === "confirmed"),
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
