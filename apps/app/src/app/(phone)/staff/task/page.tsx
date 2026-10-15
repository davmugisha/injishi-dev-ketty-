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
import { StaffTaskView } from "@/features/staff/StaffTaskView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.StaffTask.pageTitle };

export default async function StaffTaskPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  const persona = await requirePersona("StaffTask");
  const [rooms, finished, sections, minibar, spots, foundItems, profile] = await Promise.all([
    getCollection<CleaningRoom>("staff.rooms"),
    getCollection<FinishedRoom>("staff.finishedRooms"),
    getCollection<ChecklistSection>("staff.checklistSections"),
    getCollection<MinibarItem>("staff.minibarItems"),
    getCollection<FoundItemSpot>("staff.foundSpots"),
    getCollection<FoundItem>("staff.foundItems"),
    getDocument<StaffProfile>("staff.profiles", persona.id),
  ]);
  const found = foundItems[0];
  if (!rooms.length || !found || !profile) notFound();
  const { offline } = await searchParams;
  return (
    <StaffTaskView
      persona={persona}
      data={{ rooms, finished, sections, minibar, spots, found, profile }}
      offline={offline === "1"}
    />
  );
}
