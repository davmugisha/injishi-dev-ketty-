import { screens } from "@injishi/data";
import type {
  Arrival,
  Departure,
  DeskKpi,
  DeskRoom,
  GuestRequest,
  InHouseStay,
  QueueTab,
  ReadinessRoom,
  RoomType,
} from "@injishi/data/fixtures/frontdesk";
import type { Metadata } from "next";
import { FrontDeskTodayView } from "@/features/frontdesk/FrontDeskTodayView";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { deskPropertyName } from "@/server/sources/frontdesk";

export const metadata: Metadata = { title: screens.FrontDeskToday.pageTitle };

export default async function FrontDeskTodayPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  await requirePersona("FrontDeskToday");
  const [kpis, tabs, arrivals, inHouse, departures, requests, readiness, roomTypes, rooms] = await Promise.all([
    getCollection<DeskKpi>("frontdesk.deskKpis"),
    getCollection<QueueTab>("frontdesk.queueTabs"),
    getCollection<Arrival>("frontdesk.arrivals"),
    getCollection<InHouseStay>("frontdesk.inHouse"),
    getCollection<Departure>("frontdesk.departures"),
    getCollection<GuestRequest>("frontdesk.guestRequests"),
    getCollection<ReadinessRoom>("frontdesk.readiness"),
    getCollection<RoomType>("frontdesk.roomTypes"),
    getCollection<DeskRoom>("frontdesk.rooms"),
  ]);
  // The day and the property are the desk's own read (the same board the collections above came from).
  const ctx = await requestContext();
  const property = await deskPropertyName(ctx);
  const { offline } = await searchParams;
  return (
    <PmsMount>
      <FrontDeskTodayView
        offline={offline === "1" || offline === "true"}
        data={{
          kpis,
          tabs,
          arrivals,
          inHouse,
          departures,
          requests,
          readiness,
          roomTypes,
          rooms,
          today: ctx.today.iso,
          property,
        }}
      />
    </PmsMount>
  );
}
