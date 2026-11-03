import { screens } from "@injishi/data";
import { RoomRackView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readRoomRack } from "@/server/sources/room-rack";

export const metadata: Metadata = { title: screens.RoomRack.pageTitle };

/** The room rack on the property's own records: its rooms, stays and bookings, from the desk's day (2026-10-30). */
export default async function RoomRackPage() {
  await requirePersona("RoomRack");
  const rack = await readRoomRack(await requestContext());
  return (
    <PmsMount>
      <RoomRackView rack={rack} />
    </PmsMount>
  );
}
