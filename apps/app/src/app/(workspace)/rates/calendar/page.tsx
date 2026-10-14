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
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AvailabilityCalendarView } from "@/features/commercial/AvailabilityCalendarView";
import { requirePersona } from "@/lib/session";

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
    <AvailabilityCalendarView
      persona={persona}
      data={{ window: windows[0] ?? null, nights, ratePlans, roomTypes, groupBlocks, issues, channels, holds, reasons }}
    />
  );
}
