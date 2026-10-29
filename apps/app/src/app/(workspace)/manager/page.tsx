import { screens } from "@injishi/data";
import type {
  ManagerTodayEvent,
  ManagerTodayException,
  ManagerTodayKpi,
  ManagerTodayNoShow,
  ManagerTodayOutlet,
  ManagerTodayOutOfOrder,
  ManagerTodayRoomStatus,
  ManagerTodayStaffLine,
} from "@injishi/data/fixtures/commercial";
import type { Metadata } from "next";
import { ManagerTodayView } from "@/features/commercial/ManagerTodayView";
import { StayHomeView } from "@/features/stays/StayHomeView";
import { currentAccount, requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { staysActivity, staysSummary } from "@/server/stays/client";

export const metadata: Metadata = { title: screens.ManagerToday.pageTitle };

export default async function ManagerTodayPage() {
  const persona = await requirePersona("ManagerToday");
  // A stay business's manager reads the same home as its owner, all from the API.
  const stays = await staysSummary();
  if (stays) {
    const [account, activity] = await Promise.all([currentAccount(), staysActivity()]);
    return (
      <StayHomeView
        firstName={(account?.user.name ?? "").trim().split(/\s+/)[0] ?? ""}
        summary={stays}
        activity={activity}
        setup={null}
      />
    );
  }
  const [kpis, exceptions, roomStatus, outOfOrder, staff, outlets, events, noShows] = await Promise.all([
    getCollection<ManagerTodayKpi>("commercial.managerKpis"),
    getCollection<ManagerTodayException>("commercial.managerExceptions"),
    getCollection<ManagerTodayRoomStatus>("commercial.managerRoomStatus"),
    getCollection<ManagerTodayOutOfOrder>("commercial.managerOutOfOrder"),
    getCollection<ManagerTodayStaffLine>("commercial.managerStaff"),
    getCollection<ManagerTodayOutlet>("commercial.managerOutlets"),
    getCollection<ManagerTodayEvent>("commercial.managerEvents"),
    getCollection<ManagerTodayNoShow>("commercial.managerNoShows"),
  ]);
  return (
    <ManagerTodayView
      persona={persona}
      data={{ kpis, exceptions, roomStatus, outOfOrder, staff, outlets, events, noShows }}
    />
  );
}
