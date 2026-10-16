import { screens } from "@injishi/data";
import type { InspectionCheck, InspectionRoom, StaffProfile } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InspectRoomView } from "@/features/staff/InspectRoomView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.InspectRoom.pageTitle };

export default async function InspectRoomPage() {
  const persona = await requirePersona("InspectRoom");
  const [profile, fallbackProfile, rooms, checks] = await Promise.all([
    getDocument<StaffProfile>("staff.profiles", persona.id),
    getDocument<StaffProfile>("staff.profiles", "supervisor"),
    getCollection<InspectionRoom>("staff.inspectionRooms"),
    getCollection<InspectionCheck>("staff.inspectionChecks"),
  ]);
  const me = profile ?? fallbackProfile;
  if (!me || !rooms.length || !checks.length) notFound();
  return <InspectRoomView persona={persona} data={{ profile: me, rooms, checks }} />;
}
