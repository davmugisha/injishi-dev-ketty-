"use client";

/**
 * Step 5, every room by the number on its door (Onboarding board, "Your rooms").
 *
 * The rooms belong to a room type, so the step lists the property's active room
 * types with how many rooms each already has, and opens the existing
 * `RoomsEditor` for the one chosen: the same editor Inventory's "Manage rooms"
 * opens, writing through `POST /inventory/room-types/:id/rooms`. It opens on the
 * first type with no rooms yet, since that is the one still to do.
 */

import { setupVocabularyFor, type OperatorRoomType } from "@injishi/contracts";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { EmptyState, LoadFailed, Skeleton } from "../ui";
import { useRoomTypes } from "../../data/inventory";
import { RoomsEditor } from "../../screens/rooms-editor";

export function RoomsStep({
  workspaceId,
  propertyId,
  words,
  onAddTypes,
}: {
  workspaceId: string;
  propertyId: string;
  words: ReturnType<typeof setupVocabularyFor>;
  /** Back to the room types step, when there is nothing to number yet. */
  onAddTypes: () => void;
}) {
  const query = useRoomTypes(workspaceId, propertyId);
  const [chosen, setChosen] = useState<string | null>(null);
  /** The editor's own Close folds it away until a room type is chosen again. */
  const [closed, setClosed] = useState(false);

  if (query.isPending) return <Skeleton height={160} />;
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your {words.typePlural.toLowerCase()}. They are all still there; this is on our side.
      </LoadFailed>
    );
  }

  const active = query.data.roomTypes.filter((rt) => rt.status === "active");
  if (active.length === 0) {
    return (
      <EmptyState className="flex flex-wrap items-center justify-between gap-3 p-5">
        <span>
          Add {words.typePlural.toLowerCase()} first: each {words.unitSingular} belongs to one.
        </span>
        <button type="button" onClick={onAddTypes} className="text-sm font-semibold text-accent-text underline-offset-2 hover:underline">
          Go to {words.typePlural.toLowerCase()}
        </button>
      </EmptyState>
    );
  }

  const open: OperatorRoomType =
    active.find((rt) => rt.id === chosen) ?? active.find((rt) => rt.sellableRoomCount === 0) ?? active[0];
  const total = active.reduce((n, rt) => n + rt.sellableRoomCount, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">
        {total > 0
          ? `${total} ${total === 1 ? words.unitSingular : words.unitPlural} to sell across ${active.length} ${active.length === 1 ? words.typePlural.toLowerCase().replace(/s$/, "") : words.typePlural.toLowerCase()}. Choose one to add or rename its ${words.unitPlural}.`
          : `Number each ${words.unitSingular} the way its door is marked, so a booking lands on a real one.`}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={words.typePlural}>
        {active.map((rt) => {
          const on = !closed && rt.id === open.id;
          return (
            <li key={rt.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setChosen(rt.id);
                  setClosed(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold",
                  on
                    ? "border-transparent bg-accent-soft text-accent-soft-foreground"
                    : "border-line2 bg-card text-foreground hover:bg-default",
                )}
              >
                {rt.name}
                <span className={cn("pms-num text-xs font-medium", on ? "text-accent-soft-foreground" : "text-muted-foreground")}>
                  {rt.sellableRoomCount === 0 ? `no ${words.unitPlural} yet` : `${rt.sellableRoomCount} ${rt.sellableRoomCount === 1 ? words.unitSingular : words.unitPlural}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!closed && (
        <RoomsEditor
          key={open.id}
          workspaceId={workspaceId}
          roomType={open}
          words={words}
          onClose={() => setClosed(true)}
        />
      )}
    </div>
  );
}
