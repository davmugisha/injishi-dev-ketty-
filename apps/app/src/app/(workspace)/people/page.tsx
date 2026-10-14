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
import { getCollection } from "@/server/data";

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
  return (
    <PeopleHomeView
      persona={persona}
      data={{ properties, presence, leave, gaps, payRun: payRuns[0], expiring, tickets }}
    />
  );
}
