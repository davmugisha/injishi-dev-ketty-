import { screens } from "@injishi/data";
import type {
  DeptPresence,
  ExpiringItem,
  HelpdeskTicket,
  LeaveRequest,
  PayRunSummary,
  PeopleProperty,
  RosterGap,
} from "@injishi/data/fixtures/people";
import type { Metadata } from "next";
import { PeopleHomeView } from "@/features/people/PeopleHomeView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { clock } from "@/server/format";

export const metadata: Metadata = { title: screens.PeopleHome.pageTitle };

export default async function PeopleHomePage() {
  const persona = await requirePersona("PeopleHome");
  const [properties, presence, leave, gaps, payRuns, expiring, tickets] = await Promise.all([
    getCollection<PeopleProperty>("people.properties"),
    getCollection<DeptPresence>("people.presence"),
    getCollection<LeaveRequest>("people.leaveRequests"),
    getCollection<RosterGap>("people.rosterGaps"),
    getCollection<PayRunSummary>("people.payRunSummary"),
    getCollection<ExpiringItem>("people.expiring"),
    getCollection<HelpdeskTicket>("people.tickets"),
  ]);
  const { today } = await requestContext();
  return (
    <PeopleHomeView
      persona={persona}
      data={{ properties, presence, leave, gaps, payRun: payRuns[0], expiring, tickets }}
      today={today.iso}
      now={clock(new Date())}
    />
  );
}
