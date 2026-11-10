import { screens } from "@injishi/data";
import type {
  ClockCorrection,
  DeptPresence,
  ExpiringItem,
  HelpdeskTicket,
  LeaveRequest,
  PayRunSummary,
  PeopleProperty,
  RosterGap,
  ShiftSwap,
} from "@injishi/data/fixtures/people";
import type { DocumentToCheck, ExtraDaysAsk, HrWaiting } from "@injishi/product-hr";
import { PeopleHomeView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { clock } from "@/server/format";
import { hrFeaturesOff } from "@/server/hr-features";

export const metadata: Metadata = { title: screens.PeopleHome.pageTitle };

export default async function PeopleHomePage() {
  const persona = await requirePersona("PeopleHome");
  const [properties, presence, leave, gaps, payRuns, expiring, tickets, swaps, corrections, extraDays, documents] =
    await Promise.all([
      getCollection<PeopleProperty>("people.properties"),
      getCollection<DeptPresence>("people.presence"),
      getCollection<LeaveRequest>("people.leaveRequests"),
      getCollection<RosterGap>("people.rosterGaps"),
      getCollection<PayRunSummary>("people.payRunSummary"),
      getCollection<ExpiringItem>("people.expiring"),
      getCollection<HelpdeskTicket>("people.tickets"),
      getCollection<ShiftSwap>("people.shiftSwaps"),
      getCollection<ClockCorrection>("people.corrections"),
      getCollection<ExtraDaysAsk>("people.extraDays"),
      getCollection<DocumentToCheck>("people.documentsToCheck"),
    ]);
  // Every other request waiting on HR, linking to the screen that decides it. The documents link opens the
  // next file with one to check, and moves on to the one after as they are decided.
  const nextDocument = documents[0];
  const waiting: HrWaiting[] = [
    { id: "swaps", label: "Shift swaps", count: swaps.length, board: "Roster", query: "" },
    {
      id: "corrections",
      label: "Clock corrections",
      count: corrections.filter((c) => c.state === "pending").length,
      board: "Attendance",
      query: "?tab=corrections",
    },
    {
      id: "extra-days",
      label: "Extra leave days",
      count: extraDays.filter((x) => x.state === "pending").length,
      board: "Leave",
      query: "#extra-days",
    },
    {
      id: "documents",
      label: "Documents to check",
      count: documents.length,
      board: "Employees",
      query: nextDocument ? `?employee=${nextDocument.employeeId}&tab=docs` : "",
    },
  ];
  const { today } = await requestContext();
  return (
    <HrMount off={await hrFeaturesOff()}>
      <PeopleHomeView
        persona={persona}
        data={{ properties, presence, leave, gaps, payRun: payRuns[0], expiring, tickets, waiting }}
        today={today.iso}
        now={clock(new Date())}
      />
    </HrMount>
  );
}
