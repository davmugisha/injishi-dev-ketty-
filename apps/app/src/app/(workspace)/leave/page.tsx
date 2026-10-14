import { screens } from "@injishi/data";
import type { LeaveBalance, LeaveCalendarEntry, LeaveRequest, LeaveType } from "@injishi/data/fixtures/people";
import type { Metadata } from "next";
import { LeaveView } from "@/features/people/LeaveView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Leave.pageTitle };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; tab?: string; show?: string }>;
}) {
  const persona = await requirePersona("Leave");
  const [requests, balances, types, calendar] = await Promise.all([
    getCollection<LeaveRequest>("people.leaveRequests"),
    getCollection<LeaveBalance>("people.leaveBalances"),
    getCollection<LeaveType>("people.leaveTypes"),
    getCollection<LeaveCalendarEntry>("people.leaveCalendar"),
  ]);
  const { request, tab, show } = await searchParams;
  return (
    <LeaveView
      persona={persona}
      data={{ requests, balances, types, calendar }}
      initial={{
        request: requests.some((r) => r.id === request) ? (request as string) : "l2",
        tab: tab === "lm" || tab === "done" ? tab : "mine",
        show: show === "rules" ? "rules" : "bal",
      }}
    />
  );
}
