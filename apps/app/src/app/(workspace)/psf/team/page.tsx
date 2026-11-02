import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PsfTeamView } from "@/features/oversight/PsfTeamView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { appointsPsfTeam } from "@/server/oversight/nav";
import { readPsfScope, readPsfTeam } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfTeam.pageTitle };

/** The PSF team: the District Managers and DBOs a Province Manager appoints. */
export default async function PsfTeamPage() {
  await requirePersona("PsfTeam");
  // The Province Manager's screen alone (2026-11-02).
  if (!(await appointsPsfTeam())) redirect("/psf");
  const ctx = await requestContext();
  const [scope, team] = await Promise.all([readPsfScope(ctx), readPsfTeam(ctx)]);
  return <PsfTeamView scope={scope} initial={team} />;
}
