import { screens } from "@injishi/data";
import type {
  TeamRolesInviteDraft,
  TeamRolesMember,
  TeamRolesPermissionArea,
  TeamRolesRole,
  TeamRolesScope,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamRolesView } from "@/features/owner/TeamRolesView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.TeamRoles.pageTitle };

export default async function TeamRolesPage() {
  await requirePersona("TeamRoles");
  const [members, roles, areas, scopes, invites] = await Promise.all([
    getCollection<TeamRolesMember>("owner.teamRolesMembers"),
    getCollection<TeamRolesRole>("owner.teamRolesRoles"),
    getCollection<TeamRolesPermissionArea>("owner.teamRolesPermissionAreas"),
    getCollection<TeamRolesScope>("owner.teamRolesScopes"),
    getCollection<TeamRolesInviteDraft>("owner.teamRolesInvite"),
  ]);
  const invite = invites.find((i) => i.id === "draft");
  if (!invite) notFound();
  return <TeamRolesView data={{ members, roles, areas, scopes, invite }} />;
}
