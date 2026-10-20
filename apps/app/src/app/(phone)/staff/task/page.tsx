import { screens } from "@injishi/data";
import type {
  ChecklistSection,
  CleaningRoom,
  FinishedRoom,
  FoundItem,
  FoundItemSpot,
  MinibarItem,
  StaffProfile,
} from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NothingYet } from "@/features/staff/parts";
import { StaffTaskView } from "@/features/staff/StaffTaskView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument, requestContext } from "@/server/data";
import { phoneSupervisor } from "@/server/sources/staff";

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
    getDocument<StaffProfile>("staff.profiles", persona.id),
  ]);
  if (!profile) notFound();
  // A housekeeper with no room today is told so; the page never answers 404 for having nothing yet.
  if (!rooms.length) return <NothingYet title="My rooms" message="No room is assigned to you today yet." />;
  // Today's housekeeping supervisor as the API names them (the same phone read the rooms came from).
  const supervisor = await phoneSupervisor(await requestContext());
  const { offline } = await searchParams;
  return (
    <StaffTaskView
      persona={persona}
      data={{ rooms, finished, sections, minibar, spots, found, profile, supervisor }}
      offline={offline === "1"}
    />
  );
}
