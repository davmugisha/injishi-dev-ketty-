import { screens } from "@injishi/data";
import type {
  ChecklistSection,
  CleaningRoom,
  FinishedRoom,
  FoundItem,
  FoundItemSpot,
  MinibarItem,
} from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { NothingYet } from "@injishi/ui/phone";
import { StaffTaskView } from "@/features/staff/StaffTaskView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { myProfile, phoneSupervisor } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.StaffTask.pageTitle };

export default async function StaffTaskPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  const persona = await requirePersona("StaffTask");
  const [rooms, finished, sections, minibar, spots, found, profile] = await Promise.all([
    getCollection<CleaningRoom>("staff.rooms"),
    getCollection<FinishedRoom>("staff.finishedRooms"),
    getCollection<ChecklistSection>("staff.checklistSections"),
    getCollection<MinibarItem>("staff.minibarItems"),
    getCollection<FoundItemSpot>("staff.foundSpots"),
    // Shown as what is already logged from the room, so nothing is logged twice; the form itself starts empty.
    getCollection<FoundItem>("staff.foundItems"),
    // The caller's own HR file, never a sample profile (null reads "not on file").
    requestContext().then(myProfile),
  ]);
  // A housekeeper with no room today is told so; the page never answers 404 for having nothing yet.
  if (!rooms.length) return <NothingYet title="My rooms" message="No room is assigned to you today yet." />;
  // Today's housekeeping supervisor as the API names them (the same phone read the rooms came from).
  const supervisor = await phoneSupervisor(await requestContext());
  const { offline } = await searchParams;
  return (
    <StaffTaskView
      persona={persona}
      data={{ rooms, finished, sections, minibar, spots, found, profile: profile ?? null, supervisor }}
      offline={offline === "1"}
    />
  );
}
