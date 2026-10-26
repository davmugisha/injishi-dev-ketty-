import { screens } from "@injishi/data";
import type { InspectionCheck, InspectionRoom } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { InspectRoomView } from "@/features/staff/InspectRoomView";
import { NothingYet } from "@injishi/ui/phone";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { myProfile } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.InspectRoom.pageTitle };

export default async function InspectRoomPage() {
  const persona = await requirePersona("InspectRoom");
  // The caller's own HR file, never a sample profile (null reads "not on file").
  const [profile, rooms, checks] = await Promise.all([
    requestContext().then(myProfile),
    getCollection<InspectionRoom>("staff.inspectionRooms"),
    getCollection<InspectionCheck>("staff.inspectionChecks"),
  ]);
  // No room waiting is not a 404: the view says so (and keeps a room it just decided on screen).
  if (!checks.length)
    return <NothingYet title="Inspections" message="No inspection checklist is set up for this business yet." />;
  return <InspectRoomView persona={persona} data={{ profile: profile ?? null, rooms, checks }} />;
}
