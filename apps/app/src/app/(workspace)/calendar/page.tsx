import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { StaysCalendarView } from "@/features/pms/stays/StaysCalendarView";
import { requirePersona } from "@/lib/session";
import { can, staysActivity, staysScope } from "@/server/stays/client";
import { calendarBoard, readDesk } from "@/server/stays/desk";

export const metadata: Metadata = { title: screens.StaysCalendar.pageTitle };

/** The booking calendar: rooms by type and their stays, from the desk's day and the period's earlier stays. */
export default async function StaysCalendarPage() {
  await requirePersona("StaysCalendar");
  const [board, activity, scope] = await Promise.all([readDesk(), staysActivity(), staysScope()]);
  return (
    <StaysCalendarView
      board={calendarBoard(board, activity?.stays ?? [])}
      can={{
        approve: scope ? can(scope, "reservation.approve") : false,
        checkIn: scope ? can(scope, "stay.checkin") : false,
        assign: scope ? can(scope, "reservation.assign") : false,
      }}
    />
  );
}

export const dynamic = "force-dynamic";
