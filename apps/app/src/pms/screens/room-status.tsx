"use client";

/**
 * Room status (F-P04) — the desk's view of housekeeping, floor by floor.
 * Housekeeping status is separate from availability; it updates live from the
 * housekeeping phones. A card expands to set the status inline.
 *
 * **On real data** (ADR-012 step 4), following the Reservations pattern exactly:
 * `useCapability()` says what may be done, three read states are told apart, and
 * the demo store stands in when no workspace has been resolved.
 *
 * The four states shown here are the DATABASE's four, not the demo's. The demo
 * offered "Being cleaned", which has no column behind it and never had; showing
 * it on real data would let an operator set a status the server cannot store.
 * `out_of_order` goes the other way: a real state the demo never showed.
 *
 * **The card header is a native `<button>`, and that is deliberate.** It was
 * `Button` from `@injishi/ui`, which is a HeroUI button, and `.button` pins a
 * FIXED height (`h-10 md:h-9`), centres its content, and sets `white-space:
 * nowrap` and `width: fit-content`. Three lines of card content in a 36px box
 * overflowed it: the room name, the status badge and the room type rendered ON
 * TOP of the action panel beneath them, and that panel's two nowrap columns ran
 * past a 148px card that clipped them. A whole card is not a control in the
 * button vocabulary; it is an expandable surface that happens to be pressable.
 * `@injishi/ui`'s Button stays where a button belongs — the four status actions
 * below, through `ActionButton`, which is the only thing here that can word a
 * refusal (ADR-012, AC-5).
 */

import { useState } from "react";
import { DoorOpen, UserRound } from "lucide-react";
import { useHost, usePms } from "../store";
import type { HkStatus } from "../data/types";
import type { HousekeepingStatus } from "@injishi/contracts";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useRooms, useSetHousekeeping } from "../data/ops";
import {
  ActionButton,
  Badge,
  Chip,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
} from "../components/ui";
import {
  HOUSEKEEPING as HK,
  HOUSEKEEPING_BY as HK_BY,
  HOUSEKEEPING_FROM_DEMO as FROM_DEMO,
} from "../lib/housekeeping";

const TO_DEMO: Record<HousekeepingStatus, HkStatus> = {
  clean: "ready",
  dirty: "needs",
  inspected: "inspected",
  // Nothing in the demo store can hold this, so it lands on the nearest thing.
  out_of_order: "needs",
};

/**
 * How often the desk's board re-reads the rooms.
 *
 * The same 30 seconds the housekeeping phone polls at (`PHONE_REFRESH_MS` in
 * `data/housekeeper.ts`), because it is the same event from the other end: a
 * room finished upstairs has to appear downstairs. This screen said "updates
 * live from the housekeeping phones" while reading the list exactly ONCE, so
 * the sentence was the only live thing about it.
 */
const ROOM_STATUS_REFRESH_MS = 30_000;

interface DeskRoom {
  id: string;
  label: string;
  floor: string;
  typeName: string;
  hk: HousekeepingStatus;
  occupantName: string | null;
}

export function RoomStatus() {
  const { dispatch, toast, toastError } = usePms();
  const P = useHost();
  const [filter, setFilter] = useState<HousekeepingStatus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useRooms(workspaceId, ROOM_STATUS_REFRESH_MS);
  const setHousekeeping = useSetHousekeeping(workspaceId);

  const live = workspaceId !== null;
  const maySet = can("housekeeping.set");
  const denied = maySet ? undefined : reasonFor("housekeeping.set");

  const rooms: DeskRoom[] = live
    ? (query.data?.rooms ?? []).map((r) => ({
        id: r.id,
        label: r.label ?? "—",
        floor: floorOf(r.label),
        typeName: r.roomTypeName,
        hk: r.housekeeping,
        occupantName: r.occupiedBy?.guestName ?? null,
      }))
    : fromDemoStore(P);

  const shown = rooms.filter((r) => !filter || r.hk === filter);
  const floors: { label: string; rooms: DeskRoom[] }[] = [];
  for (const rm of shown) {
    let f = floors.find((x) => x.label === rm.floor);
    if (!f) {
      f = { label: rm.floor, rooms: [] };
      floors.push(f);
    }
    f.rooms.push(rm);
  }
  /* Building order, then room order. The API returns rooms in whatever order
     the query produced them, and a desk reads this screen by walking a floor:
     101, 102, 103. First-seen order put 204 above 201 for no reason a
     receptionist could see. */
  floors.sort((a, b) => floorRank(a.label) - floorRank(b.label) || a.label.localeCompare(b.label));
  for (const f of floors) f.rooms.sort(byRoomLabel);

  /** What the room IS now, for the desk deciding whether it can be sold. */
  function arrived(room: DeskRoom, to: HousekeepingStatus): string {
    if (to === "clean") return `Room ${room.label} is ready to sell.`;
    if (to === "dirty") return `Room ${room.label} needs cleaning. It is on the housekeeping phones now.`;
    if (to === "inspected") return `Room ${room.label} is inspected and ready.`;
    return `Room ${room.label} is out of order. It won't be offered to a guest.`;
  }

  function set(room: DeskRoom, to: HousekeepingStatus) {
    if (!live) {
      dispatch({ type: "setHk", room: room.id, hk: TO_DEMO[to] });
      toast(arrived(room, to), "ok");
      return;
    }
    setHousekeeping.mutate(
      { roomId: room.id, housekeeping: to },
      {
        onSuccess: () => toast(arrived(room, to), "ok"),
        onError: toastError,
      },
    );
  }

  if (live && query.isPending) {
    return (
      <div className="pms-enter" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={104} delay={i * 60} />
        ))}
      </div>
    );
  }

  /* AC-13: unreachable is not "no rooms". A desk told it has no rooms will
     stop looking for the one that needs cleaning.

     Only when there is NOTHING to show, though. Now that the board polls, a
     single blip 30 seconds after a good read would otherwise replace a full
     screen of floors with a failure panel — the desk would lose the rooms it
     was reading because a refresh it never asked for did not land. */
  const boardIsBlank = live && query.isError && query.data === undefined;
  const refreshFailed = live && query.isError && query.data !== undefined;

  if (boardIsBlank) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your rooms. Every room is still on the property — this is on
        our side, not an empty floor.
      </LoadFailed>
    );
  }

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {HK.map((h) => (
          <Chip
            key={h.key}
            label={h.label}
            n={rooms.filter((r) => r.hk === h.key).length}
            dot={h.dot}
            icon={h.icon}
            active={filter === h.key}
            onClick={() => setFilter(filter === h.key ? null : h.key)}
            size="sm"
          />
        ))}
        <span style={{ flex: 1 }} />
        {/* Says only what the screen does. On the demo store there are no
            phones and no poll, so the clause that promises both is not
            printed. */}
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Housekeeping status is separate from availability
          {live ? " · re-reads the floors every 30 seconds, so a room finished on a housekeeping phone appears here" : ""}
        </span>
      </div>

      {/* The other half of the poll: when a refresh does not land, the board
          says so rather than quietly ageing. Nothing is hidden and nothing is
          invented — these are the floors as of the last read. */}
      {refreshFailed && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            border: "1px solid var(--line2)",
            borderRadius: "var(--radius-surface)",
            fontSize: 12.5,
            color: "var(--muted)",
          }}
        >
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: "var(--warn)", flexShrink: 0 }} />
          The last refresh didn&apos;t reach us. These are the floors as we last read them.
          <ActionButton
            onClick={() => void query.refetch()}
            pending={query.isFetching}
            style={{ marginLeft: "auto", flexShrink: 0 }}
          >
            Try now
          </ActionButton>
        </div>
      )}

      {rooms.length === 0 && (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          No rooms on this property yet. Add them under Rooms &amp; rates.
        </EmptyState>
      )}

      {/* A filter that matches nothing used to render NOTHING: no cards, no
          message, and the chip still lit. A desk reads that as a broken screen
          or as an empty property, and neither is true — so name the filter that
          is on and offer the way back out of it. */}
      {rooms.length > 0 && shown.length === 0 && filter !== null && (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          No room is marked &ldquo;{HK_BY[filter].label}&rdquo; right now.{" "}
          <button
            type="button"
            className="font-semibold text-accent-text underline"
            onClick={() => setFilter(null)}
          >
            Show all {rooms.length} rooms
          </button>
        </EmptyState>
      )}

      {floors.map((f) => (
        <section key={f.label}>
          <SectionHeading n={f.rooms.length}>{f.label}</SectionHeading>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {f.rooms.map((rm) => {
              const h = HK_BY[rm.hk];
              const sel = selected === rm.id;
              const panelId = `hk-panel-${rm.id}`;
              /* One card, one request. The old guard refused only a SECOND
                 press of the SAME button, so pressing "Inspected" while
                 "Ready" was still in flight sent both and the room landed on
                 whichever answered last. */
              const cardBusy =
                setHousekeeping.isPending && setHousekeeping.variables?.roomId === rm.id;
              return (
                <div
                  key={rm.id}
                  style={{
                    border: `1.5px solid ${sel ? "var(--accent-text)" : "var(--card-bd)"}`,
                    background: "var(--card)",
                    borderRadius: "var(--radius-surface)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(sel ? null : rm.id)}
                    aria-expanded={sel}
                    // Only while the panel is on the page: `aria-controls`
                    // pointing at an id that does not exist is a dangling
                    // reference, not a hint.
                    aria-controls={sel ? panelId : undefined}
                    /* Layout inline, tint by class: an inline `background`
                       would outrank the hover fill and kill it. */
                    className="block w-full cursor-pointer border-0 bg-transparent text-left hover:bg-hover"
                    style={{
                      padding: "12px 13px 10px",
                      /* The hover fill has to sit INSIDE the card's corners —
                         the card no longer clips, so a square fill would poke
                         past them — and go square along the bottom once the
                         panel is open and the divider is straight. */
                      borderRadius: sel
                        ? "calc(var(--radius-surface) - 2px) calc(var(--radius-surface) - 2px) 0 0"
                        : "calc(var(--radius-surface) - 2px)",
                    }}
                  >
                    {/* THE NUMBER IN FULL. It was "Room 101" in a nowrap line
                        beside an "occupied" tag that would not shrink, so every
                        occupied room truncated to "Room…" and the one fact the
                        card exists to show was the one it hid. The word "Room"
                        is for a screen reader now; the number stands alone and
                        wraps rather than cuts if a named room is long. Who is
                        in it moved to an icon on this line and a line of its
                        own below. */}
                    <span className="flex items-start gap-2">
                      <span data-room-label className="pms-num min-w-0 text-xl leading-tight font-bold break-words text-foreground">
                        <span className="sr-only">Room </span>
                        {rm.label}
                      </span>
                      {rm.occupantName && (
                        <span title={`Occupied by ${rm.occupantName}`} className="mt-0.5 ml-auto flex shrink-0">
                          <UserRound aria-hidden="true" className="size-4 text-accent-text" strokeWidth={2.2} />
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block">
                      <Badge intent={h.intent} icon={h.icon}>
                        {h.label}
                      </Badge>
                    </span>
                    {/* The room TYPE, always. The guest's name used to REPLACE
                        it the moment a room was occupied, so the one screen
                        that says what a room is stopped saying it exactly when
                        a desk was deciding where to move somebody. Both lines
                        fit; neither has to win. */}
                    <span className="mt-1.5 block truncate text-2xs text-muted-foreground">{rm.typeName}</span>
                    {/* Occupancy said in words as well as by the icon above,
                        both ways: "Vacant" is what a desk deciding where to put
                        a walk-in is looking for. */}
                    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-2xs">
                      {rm.occupantName ? (
                        <>
                          <UserRound aria-hidden="true" className="size-3 shrink-0 text-accent-text" strokeWidth={2.2} />
                          <span className="truncate font-semibold text-foreground">
                            <span className="sr-only">Occupied by </span>
                            {rm.occupantName}
                          </span>
                        </>
                      ) : (
                        <>
                          <DoorOpen aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" strokeWidth={2.2} />
                          <span className="text-muted-foreground">Vacant</span>
                        </>
                      )}
                    </span>
                  </button>
                  {sel && (
                    <div
                      id={panelId}
                      role="group"
                      aria-label={`Set housekeeping status for room ${rm.label}`}
                      /* ONE column. Two made every label nowrap inside a ~64px
                         cell, so "Needs cleaning" and "Out of order" ran out of
                         the card and were clipped. */
                      style={{ borderTop: "1px solid var(--line)", padding: 8, display: "grid", gridTemplateColumns: "1fr", gap: 6 }}
                    >
                      {HK.map((x) => {
                        const on = rm.hk === x.key;
                        // The pressed button on the pressed room, so the desk
                        // can see which of the four it sent while it goes.
                        const busy = cardBusy && setHousekeeping.variables?.housekeeping === x.key;
                        return (
                          <ActionButton
                            key={x.key}
                            onClick={() => !cardBusy && set(rm, x.key)}
                            deniedReason={denied}
                            pending={busy}
                            aria-pressed={on}
                            /* Every one of these is inline on purpose. They
                               contradict `.button`'s own geometry — fixed
                               height, fit width, centred, nowrap — and an
                               inline declaration is the one thing that cannot
                               lose to it, whatever layer that sheet lands in.
                               Together they make a clipped label impossible:
                               the control fills its column, the label wraps,
                               and the box grows to whatever that needs. */
                            style={{
                              width: "100%",
                              height: "auto",
                              minHeight: 34,
                              paddingBlock: 6,
                              justifyContent: "flex-start",
                              whiteSpace: "normal",
                              textAlign: "left",
                              fontSize: 11.5,
                              lineHeight: 1.25,
                              ...(on
                                ? {
                                    borderColor: "var(--accent-text)",
                                    background: "var(--accent-soft)",
                                    color: "var(--accent-text)",
                                  }
                                : null),
                            }}
                          >
                            <x.icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.2} style={{ color: x.dot }} />
                            {x.label}
                          </ActionButton>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * The floor a room is on, read off its number.
 *
 * A convention, not a column: "101" is floor 1. Rooms whose label is not a
 * number (a named suite, a cottage) group together rather than inventing a
 * floor for them.
 */
function floorOf(label: string | null): string {
  if (!label) return "Rooms";
  return /^\d{2,}$/.test(label) ? `Floor ${label[0]}` : "Rooms";
}

/** Floors climb; the unnumbered group ("Rooms") sits last. */
function floorRank(label: string): number {
  const digits = label.match(/\d+/);
  return digits ? Number(digits[0]) : Number.MAX_SAFE_INTEGER;
}

/** 2 before 10, and G1 before G2: a room label is read, not sorted as text. */
function byRoomLabel(a: DeskRoom, b: DeskRoom): number {
  return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
}

/** The demo store's rooms, unchanged in behaviour from before. */
function fromDemoStore(P: ReturnType<typeof useHost>): DeskRoom[] {
  const occupied: Record<string, string> = {};
  for (const r of P.res) {
    if (r.status === "inhouse" && r.room) occupied[r.room] = r.guest;
  }
  return P.rooms.map((rm) => ({
    id: rm.id,
    label: rm.id,
    floor: P.key === "hotel" ? `Floor ${rm.id[0]}` : "Rooms",
    typeName: rm.type,
    hk: FROM_DEMO[rm.hk],
    occupantName: occupied[rm.id] ?? null,
  }));
}
