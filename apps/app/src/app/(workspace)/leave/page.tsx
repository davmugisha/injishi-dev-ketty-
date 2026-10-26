import { screens } from "@injishi/data";
import type { LeaveBalance, LeaveCalendarEntry, LeaveRequest, LeaveType } from "@injishi/data/fixtures/people";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { LeaveView } from "@/features/people/LeaveView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";

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
  const { today } = await requestContext();
  return (
    <HrMount>
      <LeaveView
        persona={persona}
        data={{ requests, balances, types, calendar }}
        initial={{
          request: requests.some((r) => r.id === request)
            ? (request as string)
            : (requests.find((r) => r.step === "hr" && !r.hrDecision)?.id ?? requests[0]?.id ?? ""),
          tab: tab === "lm" || tab === "done" ? tab : "mine",
          show: show === "rules" ? "rules" : "bal",
        }}
        today={today.iso}
      />
    </HrMount>
  );
}
