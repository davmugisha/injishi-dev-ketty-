import { screens } from "@injishi/data";
import type {
  CleaningTask,
  HousekeepingEscalation,
  HousekeepingRoom,
  HousekeepingRule,
  HousekeepingStaff,
  RoomHistory,
} from "@injishi/data/fixtures/operations";
import { HousekeepingBoardView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { readBoard } from "@/server/sources/operations";

export const metadata: Metadata = { title: screens.HousekeepingBoard.pageTitle };

export default async function HousekeepingBoardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const persona = await requirePersona("HousekeepingBoard");
  const [rooms, roomHistory, tasks, staff, escalations, rules] = await Promise.all([
    getCollection<HousekeepingRoom>("operations.rooms"),
    getCollection<RoomHistory>("operations.roomHistory"),
    getCollection<CleaningTask>("operations.cleaningTasks"),
    getCollection<HousekeepingStaff>("operations.housekeepingStaff"),
    getCollection<HousekeepingEscalation>("operations.housekeepingEscalations"),
    getCollection<HousekeepingRule>("operations.housekeepingRules"),
  ]);
  // The board the collections above were read from (one read per request): it names its property.
  const { propertyName } = await readBoard(await requestContext());
  const { view } = await searchParams;
  return (
    <PmsMount>
      <HousekeepingBoardView
        persona={persona}
        initialView={view === "rooms" ? "rooms" : "tasks"}
        data={{ rooms, roomHistory, tasks, staff, escalations, rules, propertyName }}
      />
    </PmsMount>
  );
}
