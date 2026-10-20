import { screens } from "@injishi/data";
import type { InspectionCheck, InspectionRoom, StaffProfile } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { InspectRoomView } from "@/features/staff/InspectRoomView";
import { NothingYet } from "@/features/staff/parts";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.InspectRoom.pageTitle };

export default async function InspectRoomPage() {
  const persona = await requirePersona("InspectRoom");
  // The caller's own profile only: never another persona's shown as theirs (null reads "not on file").
  const [profile, rooms, checks] = await Promise.all([
    getDocument<StaffProfile>("staff.profiles", persona.id),
    getCollection<InspectionRoom>("staff.inspectionRooms"),
    getCollection<InspectionCheck>("staff.inspectionChecks"),
  ]);
  // No room waiting is not a 404: the view says so (and keeps a room it just decided on screen).
  if (!checks.length)
    return <NothingYet title="Inspections" message="No inspection checklist is set up for this business yet." />;
  return <InspectRoomView persona={persona} data={{ profile: profile ?? null, rooms, checks }} />;
}
