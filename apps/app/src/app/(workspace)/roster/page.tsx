import { screens } from "@injishi/data";
import type {
  PublicHoliday,
  RosterGroup,
  RosterStaff,
  RosterWeek,
  Rotation,
  ShiftSwap,
} from "@injishi/data/fixtures/people";
import type { Metadata } from "next";
import { RosterView } from "@/features/people/RosterView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

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
  return (
    <RosterView
      data={{ groups, staff, weeks, swaps, rotations, holidays }}
      initialWeek={week === "next" ? "next" : "this"}
    />
  );
}
