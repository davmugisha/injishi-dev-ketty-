import { screens } from "@injishi/data";
import type {
  AttendanceException,
  AttendanceSummary,
  ClockCorrection,
  ClockRecord,
  DeskEmployee,
} from "@injishi/data/fixtures/people";
import type { Metadata } from "next";
import { AttendanceView } from "@/features/people/AttendanceView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { clock } from "@/server/format";

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
  const { today } = await requestContext();
  return (
    <AttendanceView
      persona={persona}
      data={{ records, corrections, exceptions, deskEmployees, summary: summaries[0] }}
      initial={{
        day: day === "yesterday" ? "yesterday" : "today",
        tab: tab === "exceptions" ? "exceptions" : "records",
      }}
      today={today.iso}
      now={clock(new Date())}
    />
  );
}
