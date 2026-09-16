"use client";

/**
 * One room's status, as four big buttons.
 *
 * Each writes `POST /ops/rooms/:id/housekeeping`, the same row the desk's
 * Room grid reads. The sheet stays open until the server has answered, so the
 * badge the housekeeper sees afterwards is the server's, not a guess.
 *
 * Rendered by the phone as a sibling of the scrolling body, never inside it.
 */

import type { HousekeepingStatus, OperatorRoom } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { cn } from "@/lib/utils";

import { Badge } from "../ui";
import { ROOM_STATUS, ROOM_STATUS_ORDER, roomName } from "./words";

export interface RoomSheetProps {
  room: OperatorRoom;
  maySet: boolean;
  mayReport: boolean;
  busy: boolean;
  onSet: (room: OperatorRoom, to: HousekeepingStatus) => void;
  onReport: (roomId: string) => void;
  onClose: () => void;
}

export function RoomSheet({ room: open, maySet, mayReport, busy, onSet, onReport, onClose }: RoomSheetProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        className="flex-1 bg-scrim"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-label={roomName(open.label)}
        className="pms-sheet flex flex-col gap-3 rounded-t-card border-t border-line2 bg-panel px-5 pt-3 pb-6"
      >
        <span className="mx-auto h-1 w-10 rounded-full bg-line2" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-bold text-ink">{roomName(open.label)}</span>
            <span className="block text-sm text-muted-foreground">
              {open.roomTypeName}
              {open.occupiedBy ? " · guest in room" : ""}
            </span>
          </span>
          <Badge intent={ROOM_STATUS[open.housekeeping].intent}>{ROOM_STATUS[open.housekeeping].label}</Badge>
        </div>
        {maySet && (
          <>
            <p className="text-sm text-ink2">Tap what the room is now.</p>
            <div className="grid grid-cols-2 gap-2">
              {ROOM_STATUS_ORDER.map((hk) => {
                const current = open.housekeeping === hk;
                return (
                  <Button
                    key={hk}
                    type="button"
                    variant={current ? "secondary" : "outline"}
                    shape="rounded"
                    size="lg"
                    fullWidth
                    aria-pressed={current}
                    data-set-status={hk}
                    pending={busy}
                    onClick={() => {
                      if (busy || current) return;
                      onSet(open, hk);
                    }}
                    className={cn(
                      "min-h-14 text-base font-semibold",
                      current && "border-accent-text text-accent-text",
                    )}
                  >
                    {ROOM_STATUS[hk].label}
                  </Button>
                );
              })}
            </div>
          </>
        )}
        {mayReport && (
          <Button
            type="button"
            variant="outline"
            shape="rounded"
            size="lg"
            fullWidth
            onClick={() => {
              onReport(open.id);
            }}
            className="min-h-12 text-base font-semibold"
          >
            Something is broken here
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          shape="rounded"
          size="lg"
          fullWidth
          onClick={() => !busy && onClose()}
          className="min-h-12 text-base"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
