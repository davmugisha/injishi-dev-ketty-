"use client";

import { Check } from "lucide-react";
import { Button } from "@injishi/ui";
import { useChosenRoom } from "@/components/property/chosen-room";

/**
 * "Choose" on a row of the property's Rooms list: picks that room for the
 * booking card and scrolls the card into view, where the price is now that
 * room's. Pressed again on the chosen room, it lets the card pick again.
 */
export function ChooseRoomButton({ roomTypeId, roomName }: { roomTypeId: string; roomName: string }) {
  const [chosen, choose] = useChosenRoom();
  const selected = chosen === roomTypeId;
  return (
    <Button
      variant={selected ? "primary" : "outline"}
      size="sm"
      aria-pressed={selected}
      aria-label={selected ? `${roomName} is selected` : `Choose ${roomName}`}
      onClick={() => choose(selected ? null : roomTypeId, { reveal: !selected })}
      className="min-w-24 rounded-full"
    >
      {selected ? (
        <>
          <Check className="size-4" strokeWidth={2.6} aria-hidden />
          Selected
        </>
      ) : (
        "Choose"
      )}
    </Button>
  );
}

/** What the row shows before the page is interactive: the same button, unpressed. */
export function ChooseRoomButtonFallback() {
  return (
    <Button variant="outline" size="sm" className="min-w-24 rounded-full" disabled>
      Choose
    </Button>
  );
}
