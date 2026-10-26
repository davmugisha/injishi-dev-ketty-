import { screens } from "@injishi/data";
import type {
  LeaveApprover,
  LeaveBalance,
  LeaveType,
  Shift,
  StaffRequest,
  SwapColleague,
} from "@injishi/data/fixtures/staff";
import { NothingYet } from "@injishi/ui/phone";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { StaffScheduleView } from "@/features/staff/StaffScheduleView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument, requestContext } from "@/server/data";
import { myProfile, staffReadRefusal } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.StaffSchedule.pageTitle };

/** The leave form starts empty: the dates and the note are the person's, never a sample draft. */
export default async function StaffSchedulePage() {
  const persona = await requirePersona("StaffSchedule");
  const read = await Promise.all([
    // The caller's own HR file, never a sample profile (null reads "not on file").
    requestContext().then(myProfile),
    getCollection<Shift>("staff.shifts"),
    getCollection<SwapColleague>("staff.swapColleagues"),
    getCollection<StaffRequest>("staff.requests"),
    getCollection<LeaveType>("staff.leaveTypes"),
    getDocument<LeaveBalance>("staff.leaveBalances", persona.id),
    getCollection<LeaveApprover>("staff.leaveApprovers"),
  ]).catch((error: unknown) => {
    const refusal = staffReadRefusal(error);
    if (refusal === null) throw error;
    return refusal;
  });
  if (typeof read === "string")
    return <NothingYet title="Schedule" message={`Your shifts and leave cannot be shown yet. ${read}`} />;
  const [profile, shifts, colleagues, requests, leaveTypes, balance, approvers] = read;
  if (!balance || !leaveTypes.length)
    return <NothingYet title="Schedule" message="Leave is not set up for your business yet. Ask HR." />;
  return (
    <HrMount>
      <StaffScheduleView
        persona={persona}
        data={{ profile: profile ?? null, shifts, colleagues, requests, leaveTypes, balance, approvers }}
      />
    </HrMount>
  );
}
