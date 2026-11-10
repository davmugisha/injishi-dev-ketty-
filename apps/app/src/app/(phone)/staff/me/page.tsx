import { screens } from "@injishi/data";
import type {
  HelpTicket,
  HelpTopic,
  LeaveBalance,
  LeaveType,
  LoanedAsset,
  Payslip,
  StaffClaim,
  StaffDocument,
  StaffRequest,
} from "@injishi/data/fixtures/staff";
import { StaffMeView } from "@injishi/product-hr/web";
import { NothingYet } from "@injishi/ui/phone";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";
import { hasOwnPin, myAnnouncements, myLoans, myProfile, myReviews, staffReadRefusal } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.StaffMe.pageTitle };

export default async function StaffMePage() {
  const persona = await requirePersona("StaffMe");
  const read = await Promise.all([
    // The caller's own HR file, never a sample profile (null reads "not on file").
    requestContext().then(myProfile),
    getCollection<Payslip>("staff.payslips"),
    getDocument<LeaveBalance>("staff.leaveBalances", persona.id),
    getCollection<StaffRequest>("staff.requests"),
    getCollection<StaffDocument>("staff.documents"),
    getCollection<LoanedAsset>("staff.assets"),
    getCollection<HelpTicket>("staff.helpTickets"),
    getCollection<HelpTopic>("staff.helpTopics"),
    getCollection<StaffClaim>("staff.claims"),
    getCollection<LeaveType>("staff.leaveTypes"),
    requestContext().then(myAnnouncements),
    requestContext().then(myReviews),
    requestContext().then(myLoans),
  ]).catch((error: unknown) => {
    const refusal = staffReadRefusal(error);
    if (refusal === null) throw error;
    return refusal;
  });
  if (typeof read === "string") return <NothingYet title="Me" message={`Your own page cannot be shown yet. ${read}`} />;
  const [
    profile,
    payslips,
    balance,
    requests,
    documents,
    assets,
    tickets,
    topics,
    claims,
    leaveTypes,
    announcements,
    reviews,
    loans,
  ] = read;
  if (!topics.length) notFound();
  if (!profile) return <NothingYet title="Me" message="You are not on file at this business yet. Ask HR." />;
  if (!balance) return <NothingYet title="Me" message="Leave is not set up for your business yet. Ask HR." />;
  const pinNeeded = await requestContext().then(hasOwnPin);
  return (
    <HrMount off={await hrFeaturesOff()}>
      <StaffMeView
        persona={persona}
        data={{
          profile,
          payslips,
          balance,
          requests,
          documents,
          assets,
          tickets,
          topics,
          claims,
          leaveTypes,
          announcements,
          reviews,
          loans,
        }}
        initialPayslips={pinNeeded ? "locked" : "unlocked"}
      />
    </HrMount>
  );
}
