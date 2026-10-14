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
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { ManagerTodayView } from "@/features/commercial/ManagerTodayView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.ManagerToday.pageTitle };

export default async function ManagerTodayPage() {
  const persona = await requirePersona("ManagerToday");
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
