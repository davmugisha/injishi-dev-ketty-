import { screens } from "@injishi/data";
import type { RackDay, RackLane, RoomMove } from "@injishi/data/fixtures/frontdesk";
import type { Metadata } from "next";
import { RoomRackView } from "@/features/frontdesk/RoomRackView";
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
  return <RoomRackView days={days} lanes={lanes} move={moves[0] ?? null} />;
}
