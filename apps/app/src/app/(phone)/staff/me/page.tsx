import { screens } from "@injishi/data";
import type {
  HelpTicket,
  HelpTopic,
  LeaveBalance,
  LoanedAsset,
  Payslip,
  StaffDocument,
  StaffProfile,
  StaffRequest,
} from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NothingYet } from "@/features/staff/parts";
import { StaffMeView } from "@/features/staff/StaffMeView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument, requestContext } from "@/server/data";
import { myClockIn, staffReadRefusal } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.StaffMe.pageTitle };

export default async function StaffMePage({ searchParams }: { searchParams: Promise<{ payslips?: string }> }) {
  const persona = await requirePersona("StaffMe");
  const read = await Promise.all([
    getDocument<StaffProfile>("staff.profiles", persona.id),
    getDocument<StaffProfile>("staff.profiles", "housekeeper"),
    getCollection<Payslip>("staff.payslips"),
    getDocument<LeaveBalance>("staff.leaveBalances", persona.id),
    getCollection<StaffRequest>("staff.requests"),
    getCollection<StaffDocument>("staff.documents"),
    getCollection<LoanedAsset>("staff.assets"),
    getCollection<HelpTicket>("staff.helpTickets"),
    getCollection<HelpTopic>("staff.helpTopics"),
  ]).catch((error: unknown) => {
    const refusal = staffReadRefusal(error);
    if (refusal === null) throw error;
    return refusal;
  });
  if (typeof read === "string") return <NothingYet title="Me" message={`Your own page cannot be shown yet. ${read}`} />;
  const [profile, fallbackProfile, payslips, balance, requests, documents, assets, tickets, topics] = read;
  const me = profile ?? fallbackProfile;
  if (!me || !topics.length) notFound();
  if (!balance) return <NothingYet title="Me" message="Leave is not set up for your business yet. Ask HR." />;
  // When the caller clocked in, from their own attendance record (null when they are not clocked in).
  const clockedInAt = await myClockIn(await requestContext());
  const { payslips: payslipsParam } = await searchParams;
  return (
    <StaffMeView
      persona={persona}
      data={{ profile: me, payslips, balance, requests, documents, assets, tickets, topics, clockedInAt }}
      initialPayslips={payslipsParam === "unlocked" ? "unlocked" : "locked"}
    />
  );
}
