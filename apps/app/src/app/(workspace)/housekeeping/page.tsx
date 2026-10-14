import { screens } from "@injishi/data";
import type {
  CleaningTask,
  HousekeepingEscalation,
  HousekeepingRoom,
  HousekeepingRule,
  HousekeepingStaff,
  RoomHistory,
  RoomStatusHistory,
} from "@injishi/data/fixtures/operations";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { HousekeepingBoardView } from "@/features/operations/HousekeepingBoardView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.HousekeepingBoard.pageTitle };

export default async function HousekeepingBoardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const persona = await requirePersona("HousekeepingBoard");
  const [rooms, roomHistory, statusHistory, tasks, staff, escalations, rules] = await Promise.all([
    getCollection<HousekeepingRoom>("operations.rooms"),
    getCollection<RoomHistory>("operations.roomHistory"),
    getCollection<RoomStatusHistory>("operations.roomStatusHistory"),
    getCollection<CleaningTask>("operations.cleaningTasks"),
    getCollection<HousekeepingStaff>("operations.housekeepingStaff"),
    getCollection<HousekeepingEscalation>("operations.housekeepingEscalations"),
    getCollection<HousekeepingRule>("operations.housekeepingRules"),
  ]);
  const { view } = await searchParams;
  return (
    <HousekeepingBoardView
      persona={persona}
      initialView={view === "rooms" ? "rooms" : "tasks"}
      data={{ rooms, roomHistory, statusHistory, tasks, staff, escalations, rules }}
    />
  );
}
