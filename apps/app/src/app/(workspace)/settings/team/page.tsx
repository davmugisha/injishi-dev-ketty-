import { screens } from "@injishi/data";
import type {
  TeamRolesInviteDraft,
  TeamRolesMember,
  TeamRolesPermissionArea,
  TeamRolesRole,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamRolesView } from "@/features/owner/TeamRolesView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { businessNames, employeeFileEmails, teamScopes } from "@/server/sources/owner";

export const metadata: Metadata = { title: screens.TeamRoles.pageTitle };

export default async function TeamRolesPage() {
  await requirePersona("TeamRoles");
  const ctx = await requestContext();
  // The scope picker lists the live branches a grant can name (not the prototype's tree, whose outlet rows
  // cannot be granted), and the member panel says whether People holds a file, read from People.
  const [members, roles, areas, invites, scopes, employeeFiles] = await Promise.all([
    getCollection<TeamRolesMember>("owner.teamRolesMembers"),
    getCollection<TeamRolesRole>("owner.teamRolesRoles"),
    getCollection<TeamRolesPermissionArea>("owner.teamRolesPermissionAreas"),
    getCollection<TeamRolesInviteDraft>("owner.teamRolesInvite"),
    teamScopes(ctx),
    employeeFileEmails(ctx),
  ]);
  const invite = invites.find((i) => i.id === "draft");
  if (!invite) notFound();
  return (
    <TeamRolesView
      data={{
        members,
        roles,
        areas,
        scopes,
        invite,
        businessName: businessNames(ctx, { permission: "team.manage" }),
        employeeFiles,
      }}
    />
  );
}
