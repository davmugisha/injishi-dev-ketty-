import { screens } from "@injishi/data";
import type {
  LeaveApprover,
  LeaveBalance,
  LeaveType,
  Shift,
  StaffProfile,
  StaffRequest,
  SwapColleague,
} from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { NothingYet } from "@/features/staff/parts";
import { StaffScheduleView } from "@/features/staff/StaffScheduleView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";
import { staffReadRefusal } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.StaffSchedule.pageTitle };

/** The leave form starts empty: the dates and the note are the person's, never a sample draft. */
export default async function StaffSchedulePage() {
  const persona = await requirePersona("StaffSchedule");
  const read = await Promise.all([
    // The caller's own profile only: never another persona's shown as theirs (null reads "not on file").
    getDocument<StaffProfile>("staff.profiles", persona.id),
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
    <StaffScheduleView
      persona={persona}
      data={{ profile: profile ?? null, shifts, colleagues, requests, leaveTypes, balance, approvers }}
    />
  );
}
