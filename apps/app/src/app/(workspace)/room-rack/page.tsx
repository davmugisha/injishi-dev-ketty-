import { screens } from "@injishi/data";
import type { RackDay, RackLane, RoomMove } from "@injishi/data/fixtures/frontdesk";
import { RoomRackView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.RoomRack.pageTitle };

/** The room rack is the prototype's sample day (group and out-of-order blocks have no tables yet). */
export default async function RoomRackPage() {
  await requirePersona("RoomRack");
  const [days, lanes, moves] = await Promise.all([
    getCollection<RackDay>("frontdesk.rackDays"),
    getCollection<RackLane>("frontdesk.rackLanes"),
    getCollection<RoomMove>("frontdesk.roomMoves"),
  ]);
  return (
    <PmsMount>
      <RoomRackView days={days} lanes={lanes} move={moves[0] ?? null} />
    </PmsMount>
  );
}
