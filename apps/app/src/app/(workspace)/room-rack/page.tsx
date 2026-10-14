import { screens } from "@injishi/data";
import type { RackDay, RackLane, ReservationRecord, RoomMove } from "@injishi/data/fixtures/frontdesk";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { RoomRackView } from "@/features/frontdesk/RoomRackView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.RoomRack.pageTitle };

export default async function RoomRackPage() {
  await requirePersona("RoomRack");
  const [days, lanes, moves, records] = await Promise.all([
    getCollection<RackDay>("frontdesk.rackDays"),
    getCollection<RackLane>("frontdesk.rackLanes"),
    getCollection<RoomMove>("frontdesk.roomMoves"),
    getCollection<ReservationRecord>("frontdesk.reservationRecords"),
  ]);
  return <RoomRackView days={days} lanes={lanes} move={moves[0] ?? null} recordIds={records.map((r) => r.id)} />;
}
