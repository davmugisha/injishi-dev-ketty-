import { screens } from "@injishi/data";
import type {
  LeaveApprover,
  LeaveBalance,
  LeaveDraft,
  LeaveType,
  Shift,
  StaffProfile,
  StaffRequest,
  SwapColleague,
} from "@injishi/data/fixtures/staff";
import { getCollection, getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffScheduleView } from "@/features/staff/StaffScheduleView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.StaffSchedule.pageTitle };

export default async function StaffSchedulePage() {
  const persona = await requirePersona("StaffSchedule");
  const [profile, fallbackProfile, shifts, colleagues, requests, leaveTypes, balance, approvers, draft] =
    await Promise.all([
      getDocument<StaffProfile>("staff.profiles", persona.id),
      getDocument<StaffProfile>("staff.profiles", "housekeeper"),
      getCollection<Shift>("staff.shifts"),
      getCollection<SwapColleague>("staff.swapColleagues"),
      getCollection<StaffRequest>("staff.requests"),
      getCollection<LeaveType>("staff.leaveTypes"),
      getDocument<LeaveBalance>("staff.leaveBalances", "housekeeper"),
      getCollection<LeaveApprover>("staff.leaveApprovers"),
      getDocument<LeaveDraft>("staff.leaveDrafts", "christmas"),
    ]);
  const me = profile ?? fallbackProfile;
  if (!me || !balance || !draft || !leaveTypes.length) notFound();
  return (
    <StaffScheduleView
      persona={persona}
      data={{ profile: me, shifts, colleagues, requests, leaveTypes, balance, approvers, draft }}
    />
  );
}
