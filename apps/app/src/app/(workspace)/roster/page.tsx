import { screens } from "@injishi/data";
import type {
  PublicHoliday,
  RosterGroup,
  RosterStaff,
  RosterWeek,
  Rotation,
  ShiftSwap,
} from "@injishi/data/fixtures/people";
import { RosterView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { workspaceFor } from "@/server/auth";
import { getCollection, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";
import { chosenRosterBranch } from "@/server/roster-branch";

export const metadata: Metadata = { title: screens.Roster.pageTitle };

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  await requirePersona("Roster");
  const [groups, staff, weeks, swaps, rotations, holidays] = await Promise.all([
    getCollection<RosterGroup>("people.rosterGroups"),
    getCollection<RosterStaff>("people.rosterStaff"),
    getCollection<RosterWeek>("people.rosterWeeks"),
    getCollection<ShiftSwap>("people.shiftSwaps"),
    getCollection<Rotation>("people.rotations"),
    getCollection<PublicHoliday>("people.holidays"),
  ]);
  const { week } = await searchParams;
  const ctx = await requestContext();
  // The roster is the head office's (the branches come head office first); a shift is lent to the next one.
  const branches = ((ctx.account ? workspaceFor(ctx.account, "hospitality")?.branches : []) ?? []) as {
    id: string;
    name: string;
    isHeadOffice?: boolean;
  }[];
  const chosen = await chosenRosterBranch();
  const current = branches.find((b) => b.id === chosen) ?? branches.find((b) => b.isHeadOffice) ?? branches[0];
  const other = branches.find((b) => b.id !== current?.id);
  return (
    <HrMount off={await hrFeaturesOff()}>
      <RosterView
        data={{ groups, staff, weeks, swaps, rotations, holidays }}
        initialWeek={week === "next" ? "next" : "this"}
        today={ctx.today.iso}
        branchName={current?.name ?? "this branch"}
        otherBranchName={other?.name ?? "another branch"}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        branchId={current?.id ?? ""}
      />
    </HrMount>
  );
}
