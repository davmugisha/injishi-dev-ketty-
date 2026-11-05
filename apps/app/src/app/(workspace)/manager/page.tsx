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
import { redirect } from "next/navigation";
import { ManagerTodayView } from "@/features/commercial/ManagerTodayView";
import { StayHomeView } from "@/features/pms/stays/StayHomeView";
import { currentAccount, requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { posOutlets } from "@/server/pos";
import { staysActivity, staysSummary } from "@/server/stays/client";

/** Whether this person's workspace has a bar or restaurant outlet to sell from. A failed read counts as no. */
async function hasPosOutlets(): Promise<boolean> {
  try {
    return (await posOutlets(await requestContext())).length > 0;
  } catch {
    return false;
  }
}

export const metadata: Metadata = { title: screens.ManagerToday.pageTitle };

export default async function ManagerTodayPage() {
  const persona = await requirePersona("ManagerToday");
  // A stay business's manager reads the same home as its owner, all from the API.
  const stays = await staysSummary();
  // A business with no rooms but a bar or restaurant outlet is run from the point of sale, not a front desk.
  if (stays && stays.business.rooms === 0 && (await hasPosOutlets())) redirect("/pos/dashboard");
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
