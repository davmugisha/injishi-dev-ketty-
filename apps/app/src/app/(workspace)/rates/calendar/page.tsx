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
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.AvailabilityCalendar.pageTitle };

export default async function AvailabilityCalendarPage() {
  const persona = await requirePersona("AvailabilityCalendar");
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
