"use client";

/**
 * Room status (F-P04) — the desk's view of housekeeping, floor by floor.
 * Housekeeping status is separate from availability. A card expands to set the
 * status inline.
 *
 * **HOW IT STAYS CURRENT, stated because this line used to overstate it.** It
 * claimed the board was pushed every change a housekeeper made. Nothing pushes to
 * it. It reads `GET /ops/rooms`, and that read is refreshed when the screen
 * opens, after a status is set here, when the tab comes back into view, and
 * every `REFRESH_MS` while it is visible. A room changed anywhere else — another
 * desk, a housekeeper — therefore shows here within that interval, and the
 * sentence on screen says exactly that.
 *
 * **On real data** (ADR-012 step 4), following the Reservations pattern exactly:
 * `useCapability()` says what may be done, three read states are told apart, and
 * the demo store stands in when no workspace has been resolved.
 *
 * The four states shown here are the DATABASE's four, not the demo's. The demo
 * offered "Being cleaned", which has no column behind it and never had; showing
 * it on real data would let an operator set a status the server cannot store.
 * `out_of_order` goes the other way: a real state the demo never showed.
 */

import { Button } from "@injishi/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useHost, usePms } from "../store";
import type { HkStatus } from "../data/types";
import type { HousekeepingStatus } from "@injishi/contracts";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useRooms, useSetHousekeeping } from "../data/ops";
import { queryKeys } from "../data/queries";
import { ActionButton, Badge, Chip, EmptyState, LoadFailed, Skeleton } from "../components/ui";
import { HOUSEKEEPING as HK, HOUSEKEEPING_BY as HK_BY } from "../lib/housekeeping";

/** The demo store's own vocabulary, mapped onto the real one. */
const FROM_DEMO: Record<HkStatus, HousekeepingStatus> = {
  ready: "clean",
  needs: "dirty",
  // The demo's middle state. It has no column, so on the way in it reads as
  // what it actually means to a desk: this room is not ready yet.
  cleaning: "dirty",
  inspected: "inspected",
};
const TO_DEMO: Record<HousekeepingStatus, HkStatus> = {
  clean: "ready",
  dirty: "needs",
  inspected: "inspected",
  // Nothing in the demo store can hold this, so it lands on the nearest thing.
  out_of_order: "needs",
};

/** How often the board re-reads `GET /ops/rooms` while it is on screen. */
const REFRESH_MS = 30_000;

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
  const query = useRooms(workspaceId);
  const setHousekeeping = useSetHousekeeping(workspaceId);

  const live = workspaceId !== null;
  const client = useQueryClient();

  /*
   * Re-read the rooms on a timer while the tab is visible. The app turns
   * refetch-on-focus off everywhere, so without this the board would show a
   * room as dirty long after somebody cleaned it. A hidden tab asks nothing.
   */
  useEffect(() => {
    if (!live) return;
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
      }
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [client, live, workspaceId]);

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

  /** What the room IS now, for the desk deciding whether it can be sold. */
  function arrived(room: DeskRoom, to: HousekeepingStatus): string {
    if (to === "clean") return `Room ${room.label} is ready to sell.`;
    if (to === "dirty") return `Room ${room.label} needs cleaning before it can be sold.`;
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
      <div className="pms-enter" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={104} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (live && query.isError) {
    /* AC-13: unreachable is not "no rooms". A desk told it has no rooms will
       stop looking for the one that needs cleaning. */
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
            active={filter === h.key}
            onClick={() => setFilter(filter === h.key ? null : h.key)}
            size="sm"
          />
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Housekeeping status is separate from availability · {live ? "refreshed from the server every 30 seconds" : "demo rooms, not saved"}
        </span>
      </div>

      {rooms.length === 0 && (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          No rooms on this property yet. Add them under Inventory.
        </EmptyState>
      )}

      {floors.map((f) => (
        <section key={f.label}>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted2)" }}>{f.label}</h2>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
            {f.rooms.map((rm) => {
              const h = HK_BY[rm.hk];
              const sel = selected === rm.id;
              return (
                <div key={rm.id} style={{ border: `1.5px solid ${sel ? "var(--accent-text)" : "var(--card-bd)"}`, background: "var(--card)", borderRadius: "var(--radius-surface)", overflow: "hidden" }}>
                  <Button variant="ghost"
                    onClick={() => setSelected(sel ? null : rm.id)}
                    style={{ display: "block", width: "100%", border: "none", background: "none", padding: "12px 13px 10px", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: h.dot }} />
                      <span className="pms-num" style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>Room {rm.label}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--faint)" }}>{rm.occupantName ? "occupied" : ""}</span>
                    </span>
                    <span style={{ display: "block", marginTop: 6 }}><Badge intent={h.intent}>{h.label}</Badge></span>
                    <span style={{ display: "block", marginTop: 5, fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rm.occupantName ?? rm.typeName}</span>
                  </Button>
                  {sel && (
                    <div style={{ borderTop: "1px solid var(--line)", padding: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {HK.map((x) => {
                        const on = rm.hk === x.key;
                        const off = Boolean(denied);
                        // The pressed button on the pressed room, so the desk
                        // can see which of the four it sent while it goes.
                        const busy =
                          setHousekeeping.isPending &&
                          setHousekeeping.variables?.roomId === rm.id &&
                          setHousekeeping.variables?.housekeeping === x.key;
                        return (
                          <Button variant="ghost"
                            key={x.key}
                            onClick={() => !off && !busy && set(rm, x.key)}
                            aria-disabled={off || undefined}
                            pending={busy}
                            title={denied}
                            style={{
                              minHeight: 34,
                              border: `1.5px solid ${on ? "var(--accent-text)" : "var(--line2)"}`,
                              background: on ? "var(--accent-soft)" : "var(--field)",
                              color: on ? "var(--accent-text)" : "var(--foreground)",
                              borderRadius: 9,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: off ? "not-allowed" : "pointer",
                              opacity: off ? 0.5 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {x.label}
                          </Button>
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
