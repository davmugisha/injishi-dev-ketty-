"use client";

/**
 * The physical rooms, tents, villas or units of one room type (2026-09-13).
 *
 * Before this, a room type's "number of rooms" was stored and seeded nothing,
 * so a property set up in the app had no sellable room, could not publish and
 * showed an empty room status board. Here each one is a real row: added by the
 * label on its door, renamed, or taken out of sale. Whether it is CLEAN is
 * housekeeping's, and is shown, not edited.
 */

import type { InventoryRoom, OperatorRoomType, RoomStatus, SetupVocabulary } from "@injishi/contracts";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { ActionButton, Badge, LoadFailed, Skeleton, surfaceClass } from "../components/ui";
import { humanError } from "../data/api";
import { useAddRooms, useInventoryRooms, useUpdateRoom } from "../data/setup";

const inputClass = "h-9 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";

const STATUS_LABEL: Record<RoomStatus, string> = {
  available: "Available to sell",
  maintenance: "Maintenance",
  out_of_service: "Out of service",
};

const HOUSEKEEPING_LABEL: Record<InventoryRoom["housekeeping"], { text: string; intent: "ok" | "warn" | "info" | "neutral" }> = {
  clean: { text: "Clean", intent: "ok" },
  inspected: { text: "Inspected", intent: "ok" },
  dirty: { text: "Needs cleaning", intent: "warn" },
  out_of_order: { text: "Out of order", intent: "neutral" },
};

/** "101, 102-105, Tent A" → 101, 102, 103, 104, 105, Tent A. */
export function parseRoomLabels(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const piece = part.trim();
    if (!piece) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(piece);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to >= from && to - from < 500) {
        for (let n = from; n <= to; n += 1) out.push(String(n));
        continue;
      }
    }
    out.push(piece);
  }
  return out;
}

export function RoomsEditor({
  workspaceId,
  roomType,
  words,
  onClose,
}: {
  workspaceId: string;
  roomType: OperatorRoomType;
  words: SetupVocabulary;
  onClose: () => void;
}) {
  const query = useInventoryRooms(workspaceId, roomType.id);
  const add = useAddRooms(workspaceId);
  const update = useUpdateRoom(workspaceId);
  const [labels, setLabels] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rooms = query.data?.rooms ?? [];

  const submitAdd = () => {
    setError(null);
    const parsed = parseRoomLabels(labels);
    if (parsed.length === 0) return setError(`Write the number or name of each ${words.unitSingular}, e.g. 101, 102-110.`);
    add.mutate(
      { roomTypeId: roomType.id, labels: parsed },
      { onSuccess: () => setLabels(""), onError: (err) => setError(humanError(err)) },
    );
  };

  const saveRename = () => {
    if (!renaming) return;
    const label = renaming.label.trim();
    if (!label) return setRenaming(null);
    update.mutate(
      { roomId: renaming.id, label },
      { onSuccess: () => setRenaming(null), onError: (err) => setError(humanError(err)) },
    );
  };

  return (
    <section
      data-rooms-editor={roomType.name}
      className={cn(surfaceClass, "flex flex-col gap-3 p-4")}
      aria-label={`${words.unitPlural} of ${roomType.name}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">
          {roomType.name} · {rooms.length} {rooms.length === 1 ? words.unitSingular : words.unitPlural}
        </span>
        <ActionButton onClick={onClose}>Close</ActionButton>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitAdd();
        }}
      >
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Add {words.unitPlural}</span>
          <input
            aria-label={`Add ${words.unitPlural}`}
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            placeholder="e.g. 101, 102, 201-210"
            className={inputClass}
          />
        </label>
        <ActionButton variant="primary" type="submit" pending={add.isPending}>
          Add
        </ActionButton>
      </form>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {query.isPending && <Skeleton height={120} />}
      {query.isError && (
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load these {words.unitPlural}. They are still there — this is on our side.
        </LoadFailed>
      )}
      {query.data && rooms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No {words.unitPlural} yet. Add them by the number on the door so bookings land on a real one.
        </p>
      )}
      {rooms.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const hk = HOUSEKEEPING_LABEL[room.housekeeping];
            const isRenaming = renaming?.id === room.id;
            return (
              <li key={room.id} data-room-label={room.label ?? ""} className="flex flex-col gap-2 rounded border border-line px-3 py-2.5">
                <span className="flex items-center justify-between gap-2">
                  {isRenaming ? (
                    <input
                      autoFocus
                      aria-label={`New name for ${room.label ?? words.unitSingular}`}
                      value={renaming.label}
                      onChange={(e) => setRenaming({ id: room.id, label: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className={inputClass}
                    />
                  ) : (
                    <span className="pms-num text-sm font-bold text-ink">{room.label ?? "Unnamed"}</span>
                  )}
                  <Badge intent={hk.intent}>{hk.text}</Badge>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Sales status of ${room.label ?? words.unitSingular}`}
                    value={room.status}
                    onChange={(e) =>
                      update.mutate(
                        { roomId: room.id, status: e.target.value as RoomStatus },
                        { onError: (err) => setError(humanError(err)) },
                      )
                    }
                    className="h-8 rounded border border-line2 bg-field px-2 text-xs text-foreground"
                  >
                    {(Object.keys(STATUS_LABEL) as RoomStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {isRenaming ? (
                    <ActionButton variant="primary" pending={update.isPending} onClick={saveRename}>
                      Save
                    </ActionButton>
                  ) : (
                    <ActionButton onClick={() => setRenaming({ id: room.id, label: room.label ?? "" })}>Rename</ActionButton>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
