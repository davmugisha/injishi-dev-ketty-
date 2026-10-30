import { letsLongStays } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type {
  AvailabilityCalendarChannel,
  AvailabilityCalendarGroupBlock,
  AvailabilityCalendarHold,
  AvailabilityCalendarIssue,
  AvailabilityCalendarNight,
  AvailabilityCalendarRatePlan,
  AvailabilityCalendarReason,
  AvailabilityCalendarRoomType,
  AvailabilityCalendarWindow,
} from "@injishi/data/fixtures/commercial";
import { AvailabilityCalendarView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { PmsMount } from "@/features/pms/pms-mount";
import { RatesCalendarView } from "@/features/pms/stays/RatesCalendarView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { ratesCalendar, staysSummary } from "@/server/stays/client";

export const metadata: Metadata = { title: screens.AvailabilityCalendar.pageTitle };

export default async function AvailabilityCalendarPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const persona = await requirePersona("AvailabilityCalendar");
  // A stay business prices and closes its days here, live (2026-10-29).
  const { from } = await searchParams;
  const day = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const [summary, calendar] = await Promise.all([staysSummary(), ratesCalendar(day)]);
  if (summary && calendar) {
    return <RatesCalendarView data={calendar} longStays={letsLongStays(summary.business.kind)} />;
  }
  const [windows, nights, ratePlans, roomTypes, groupBlocks, issues, channels, holds, reasons] = await Promise.all([
    getCollection<AvailabilityCalendarWindow>("commercial.calendarWindows"),
    getCollection<AvailabilityCalendarNight>("commercial.calendarNights"),
    getCollection<AvailabilityCalendarRatePlan>("commercial.calendarRatePlans"),
    getCollection<AvailabilityCalendarRoomType>("commercial.calendarRoomTypes"),
    getCollection<AvailabilityCalendarGroupBlock>("commercial.calendarGroupBlocks"),
    getCollection<AvailabilityCalendarIssue>("commercial.calendarIssues"),
    getCollection<AvailabilityCalendarChannel>("commercial.calendarChannels"),
    getCollection<AvailabilityCalendarHold>("commercial.calendarHolds"),
    getCollection<AvailabilityCalendarReason>("commercial.calendarReasons"),
  ]);
  return (
    <PmsMount>
      <AvailabilityCalendarView
        persona={persona}
        data={{
          window: windows[0] ?? null,
          nights,
          ratePlans,
          roomTypes,
          groupBlocks,
          issues,
          channels,
          holds,
          reasons,
        }}
      />
    </PmsMount>
  );
}
