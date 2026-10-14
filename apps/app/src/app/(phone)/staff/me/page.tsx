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
import { StaffMeView } from "@/features/staff/StaffMeView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.StaffMe.pageTitle };

export default async function StaffMePage({ searchParams }: { searchParams: Promise<{ payslips?: string }> }) {
  const persona = await requirePersona("StaffMe");
  const [profile, fallbackProfile, payslips, balance, requests, documents, assets, tickets, topics] = await Promise.all(
    [
      getDocument<StaffProfile>("staff.profiles", persona.id),
      getDocument<StaffProfile>("staff.profiles", "housekeeper"),
      getCollection<Payslip>("staff.payslips"),
      getDocument<LeaveBalance>("staff.leaveBalances", "housekeeper"),
      getCollection<StaffRequest>("staff.requests"),
      getCollection<StaffDocument>("staff.documents"),
      getCollection<LoanedAsset>("staff.assets"),
      getCollection<HelpTicket>("staff.helpTickets"),
      getCollection<HelpTopic>("staff.helpTopics"),
    ],
  );
  const me = profile ?? fallbackProfile;
  if (!me || !balance || !topics.length) notFound();
  const { payslips: payslipsParam } = await searchParams;
  return (
    <StaffMeView
      persona={persona}
      data={{ profile: me, payslips, balance, requests, documents, assets, tickets, topics }}
      initialPayslips={payslipsParam === "unlocked" ? "unlocked" : "locked"}
    />
  );
}
