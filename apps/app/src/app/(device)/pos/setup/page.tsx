import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosSetupView } from "@/features/pos/pos-setup-view";
import { stepFrom } from "@/features/pos/setup-logic";
import { posSetup, posVenue } from "@/server/pos";
import { teamRolesData } from "@/server/team-roles";

export const metadata: Metadata = { title: POS_BOARDS.PosSetup.pageTitle };

/** The floor, stations, registers and routing of one outlet, and how far its setup has got (`outlet.manage`). */
export default async function PosSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; step?: string }>;
}) {
  const { outlet: outletParam, step } = await searchParams;
  const page = await loadPosPage("PosSetup", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  if (!page.can.includes("outlet.manage")) {
    return (
      <PosBlocked
        title="Setup is for owners and managers"
        message="Ask the owner of the business to change the floor, stations or registers."
      />
    );
  }
  // The team is read only for someone who may manage it (the owner): Setup's team steps draw the same manager as
  // Settings → Team. A failed read shows a sentence in those steps, never a broken setup page.
  const [venue, setup, team] = await Promise.all([
    posVenue(page.ctx, page.outlet.id),
    posSetup(page.ctx, page.outlet.id),
    page.can.includes("team.manage") ? teamRolesData(page.ctx).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <PosSetupView
      outlets={page.outlets}
      outlet={page.outlet}
      venue={venue}
      setup={setup}
      can={page.can}
      initialStep={stepFrom(step)}
      team={team}
    />
  );
}
