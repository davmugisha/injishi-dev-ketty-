import { screens } from "@injishi/data";
import type {
  LeaveApprover,
  LeaveBalance,
  LeaveType,
  Shift,
  StaffRequest,
  SwapAsk,
  SwapColleague,
} from "@injishi/data/fixtures/staff";
import { StaffScheduleView } from "@injishi/product-hr/web";
import { NothingYet } from "@injishi/ui/phone";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";
import { myProfile, shiftChoices, staffReadRefusal } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.StaffSchedule.pageTitle };

/** The leave form starts empty: the dates and the note are the person's, never a sample draft. */
export default async function StaffSchedulePage() {
  const persona = await requirePersona("StaffSchedule");
  const read = await Promise.all([
    // The caller's own HR file, never a sample profile (null reads "not on file").
    requestContext().then(myProfile),
    getCollection<Shift>("staff.shifts"),
    getCollection<SwapColleague>("staff.swapColleagues"),
    getCollection<SwapAsk>("staff.swapAsks"),
    getCollection<StaffRequest>("staff.requests"),
    getCollection<LeaveType>("staff.leaveTypes"),
    getDocument<LeaveBalance>("staff.leaveBalances", persona.id),
    getCollection<LeaveApprover>("staff.leaveApprovers"),
    requestContext().then(shiftChoices),
  ]).catch((error: unknown) => {
    const refusal = staffReadRefusal(error);
    if (refusal === null) throw error;
    return refusal;
  });
  if (typeof read === "string")
    return <NothingYet title="Schedule" message={`Your shifts and leave cannot be shown yet. ${read}`} />;
  const [profile, shifts, colleagues, asks, requests, leaveTypes, balance, approvers, choices] = read;
  if (!profile) return <NothingYet title="Schedule" message="You are not on file at this business yet. Ask HR." />;
  if (!balance || !leaveTypes.length)
    return <NothingYet title="Schedule" message="Leave is not set up for your business yet. Ask HR." />;
  return (
    <HrMount off={await hrFeaturesOff()}>
      <StaffScheduleView
        persona={persona}
        data={{ profile, shifts, colleagues, asks, requests, leaveTypes, balance, approvers, choices }}
      />
    </HrMount>
  );
}
