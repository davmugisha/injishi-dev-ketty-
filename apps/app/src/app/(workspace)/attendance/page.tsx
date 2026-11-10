import { screens } from "@injishi/data";
import type {
  AttendanceException,
  AttendanceSummary,
  ClockCorrection,
  ClockRecord,
  DeskEmployee,
} from "@injishi/data/fixtures/people";
import { AttendanceView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { readClockSetup } from "@/server/clock-rules";
import { getCollection, requestContext } from "@/server/data";
import { clock } from "@/server/format";
import { hrFeaturesOff } from "@/server/hr-features";

export const metadata: Metadata = { title: screens.Attendance.pageTitle };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; tab?: string }>;
}) {
  const persona = await requirePersona("Attendance");
  const [records, corrections, exceptions, deskEmployees, summaries] = await Promise.all([
    getCollection<ClockRecord>("people.clockRecords"),
    getCollection<ClockCorrection>("people.corrections"),
    getCollection<AttendanceException>("people.attendanceExceptions"),
    getCollection<DeskEmployee>("people.deskEmployees"),
    getCollection<AttendanceSummary>("people.attendanceSummary"),
  ]);
  const { day, tab } = await searchParams;
  const ctx = await requestContext();
  const { today } = ctx;
  const clockSetup = await readClockSetup(ctx);
  return (
    <HrMount off={await hrFeaturesOff()}>
      <AttendanceView
        persona={persona}
        data={{ records, corrections, exceptions, deskEmployees, summary: summaries[0] }}
        initial={{
          day: day === "yesterday" ? "yesterday" : "today",
          tab: tab === "exceptions" || tab === "corrections" ? tab : "records",
        }}
        today={today.iso}
        now={clock(new Date())}
        clockSetup={clockSetup}
      />
    </HrMount>
  );
}
