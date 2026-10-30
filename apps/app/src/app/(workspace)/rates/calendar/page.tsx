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
import { StayPricesView } from "@/features/pms/stays/StayPricesView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { ratesCalendar, ratesSpecialDates, staysSummary } from "@/server/stays/client";

export const metadata: Metadata = { title: screens.AvailabilityCalendar.pageTitle };

export default async function AvailabilityCalendarPage() {
  const persona = await requirePersona("AvailabilityCalendar");
  // A stay business's prices, live (2026-10-30): its room types' terms (a one day read) and special dates.
  const summary = await staysSummary();
  const [calendar, special] = summary
    ? await Promise.all([ratesCalendar(summary.today, summary.today), ratesSpecialDates()])
    : [null, null];
  if (summary && calendar) {
    return (
      <StayPricesView
        roomTypes={calendar.roomTypes}
        ranges={special?.ranges ?? []}
        today={calendar.today}
        longStays={letsLongStays(summary.business.kind)}
      />
    );
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
