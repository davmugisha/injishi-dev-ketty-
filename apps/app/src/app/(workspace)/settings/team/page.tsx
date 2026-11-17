import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TeamRolesView } from "@/features/owner/TeamRolesView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { landlordScope } from "@/server/rentals/client";
import { teamRolesData } from "@/server/team-roles";

export const metadata: Metadata = { title: screens.TeamRoles.pageTitle };

export default async function TeamRolesPage() {
  await requirePersona("TeamRoles");
  // A landlord's team lives under Settings, beside the rest of the business's settings.
  if (await landlordScope()) redirect("/settings/rentals?tab=team");
  const data = await teamRolesData(await requestContext());
  if (!data) notFound();
  return <TeamRolesView data={data} />;
}
