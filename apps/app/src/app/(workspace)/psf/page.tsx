import { screens } from "@injishi/data";
import type { ChamberMember, MembershipApplication } from "@injishi/data/fixtures/oversight";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { PsfConsoleView } from "@/features/oversight/PsfConsoleView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.PsfConsole.pageTitle };

/** Chamber of Tourism membership applications. The Chamber decides; Injishi records the decision. */
export default async function PsfConsolePage() {
  const persona = await requirePersona("PsfConsole");
  const [applications, members] = await Promise.all([
    getCollection<MembershipApplication>("oversight.applications"),
    getCollection<ChamberMember>("oversight.chamberMembers"),
  ]);
  return <PsfConsoleView persona={persona} applications={applications} members={members} />;
}
