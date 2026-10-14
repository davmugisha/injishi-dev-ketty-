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
  ReservationRecord,
  RoomType,
} from "@injishi/data/fixtures/frontdesk";
import type { Metadata } from "next";
import { FrontDeskTodayView } from "@/features/frontdesk/FrontDeskTodayView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.FrontDeskToday.pageTitle };

export default async function FrontDeskTodayPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  await requirePersona("FrontDeskToday");
  const [kpis, tabs, arrivals, inHouse, departures, requests, readiness, roomTypes, rooms, records] = await Promise.all(
    [
      getCollection<DeskKpi>("frontdesk.deskKpis"),
      getCollection<QueueTab>("frontdesk.queueTabs"),
      getCollection<Arrival>("frontdesk.arrivals"),
      getCollection<InHouseStay>("frontdesk.inHouse"),
      getCollection<Departure>("frontdesk.departures"),
      getCollection<GuestRequest>("frontdesk.guestRequests"),
      getCollection<ReadinessRoom>("frontdesk.readiness"),
      getCollection<RoomType>("frontdesk.roomTypes"),
      getCollection<DeskRoom>("frontdesk.rooms"),
      getCollection<ReservationRecord>("frontdesk.reservationRecords"),
    ],
  );
  const { offline } = await searchParams;
  return (
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
        recordIds: records.map((r) => r.id),
      }}
    />
  );
}
