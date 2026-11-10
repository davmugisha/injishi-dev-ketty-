import { screens } from "@injishi/data";
import type {
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveMonth,
  LeaveRequest,
  LeaveStretch,
  LeaveType,
} from "@injishi/data/fixtures/people";
import type { ExtraDaysAsk } from "@injishi/product-hr";
import { LeaveView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";

export const metadata: Metadata = { title: screens.Leave.pageTitle };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; tab?: string; show?: string }>;
}) {
  const persona = await requirePersona("Leave");
  const ctx = await requestContext();
  const [requests, balances, types, calendar, byMonth, stretches, extraDays] = await Promise.all([
    getCollection<LeaveRequest>("people.leaveRequests"),
    getCollection<LeaveBalance>("people.leaveBalances"),
    getCollection<LeaveType>("people.leaveTypes"),
    getCollection<LeaveCalendarEntry>("people.leaveCalendar"),
    getCollection<LeaveMonth>("people.leaveByMonth"),
    getCollection<LeaveStretch>("people.leaveStretches"),
    getCollection<ExtraDaysAsk>("people.extraDays"),
  ]);
  const { request, tab, show } = await searchParams;
  return (
    <HrMount off={await hrFeaturesOff()}>
      <LeaveView
        persona={persona}
        data={{ requests, balances, types, calendar, byMonth, stretches, extraDays }}
        initial={{
          request: requests.some((r) => r.id === request)
            ? (request as string)
            : (requests.find((r) => r.step === "hr" && !r.hrDecision)?.id ?? requests[0]?.id ?? ""),
          tab: tab === "lm" || tab === "done" ? tab : "mine",
          show: show === "rules" ? "rules" : "bal",
          open: requests.some((r) => r.id === request),
        }}
        today={ctx.today.iso}
      />
    </HrMount>
  );
}
