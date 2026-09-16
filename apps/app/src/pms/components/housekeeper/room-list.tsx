"use client";

/**
 * Every room and its cleaning status. A tap opens `RoomSheet`, which is
 * rendered by the phone OUTSIDE this scrolling list: inside it, the sheet was
 * part of the list's scroll area and could slide the whole frame sideways.
 */

import type { HousekeepingStatus, OperatorRoom } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

import { Badge, Chip, EmptyState, surfaceClass } from "../ui";
import { ROOM_STATUS, ROOM_STATUS_ORDER, roomName } from "./words";

export interface RoomListProps {
  rooms: readonly OperatorRoom[];
  onOpen: (roomId: string) => void;
}

const DOT: Record<HousekeepingStatus, string> = {
  dirty: "var(--warn)",
  clean: "var(--ok)",
  inspected: "var(--info)",
  out_of_order: "var(--bad)",
};

export function RoomList({ rooms, onOpen }: RoomListProps) {
  const [filter, setFilter] = useState<HousekeepingStatus | null>(null);

  const sorted = [...rooms].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true }),
  );
  const shown = sorted.filter((r) => !filter || r.housekeeping === filter);

  return (
    <>
      {/* Wrapped, not a sideways scroller: a nowrap row set the min-content width
          of the whole phone frame and pushed it past the screen. Four filters
          fit on two lines, and none hides off the edge. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show rooms">
        {ROOM_STATUS_ORDER.map((hk) => (
          <Chip
            key={hk}
            n={rooms.filter((r) => r.housekeeping === hk).length}
            label={ROOM_STATUS[hk].label}
            active={filter === hk}
            onClick={() => setFilter(filter === hk ? null : hk)}
            size="sm"
          />
        ))}
      </div>

      {rooms.length === 0 ? (
        <EmptyState className="p-6 text-center">
          No rooms on this property yet. The manager adds them.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState className="p-6 text-center">
          No rooms are {ROOM_STATUS[filter as HousekeepingStatus].label.toLowerCase()}. Tap the filter
          again to see all rooms.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Button
                type="button"
                variant="outline"
                shape="rounded"
                size="lg"
                fullWidth
                data-room-id={r.id}
                onClick={() => onOpen(r.id)}
                className={cn(surfaceClass, "h-auto min-h-14 justify-start gap-3 px-4 py-3 text-left")}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: DOT[r.housekeeping] }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">{roomName(r.label)}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {r.roomTypeName}
                    {r.occupiedBy ? " · guest in room" : ""}
                  </span>
                </span>
                <Badge intent={ROOM_STATUS[r.housekeeping].intent}>{ROOM_STATUS[r.housekeeping].label}</Badge>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
