import type {
  TeamRolesInviteDraft,
  TeamRolesMember,
  TeamRolesPermissionArea,
  TeamRolesRole,
} from "@injishi/data/fixtures/owner";
import type { AccessRequestView } from "@injishi/data/fixtures/people";
import type { TeamRolesData } from "@/features/owner/TeamRolesModel";
import { getCollection } from "./data";
import { currentOwnershipTransfer } from "./ownership-transfer";
import { businessNames, employeeFileEmails, teamScopes } from "./sources/owner";
import type { SourceContext } from "./sources/types";

/**
 * Everything the team manager shows, read from the team API through the same sources for every place it is drawn
 * (Settings → Team, and the point of sale's Setup), so the two can never disagree. Null when the invite draft is
 * missing, which only happens on a misconfigured store.
 */
export async function teamRolesData(ctx: SourceContext): Promise<TeamRolesData | null> {
  // The scope picker lists the live branches a grant can name (not the prototype's tree, whose outlet rows
  // cannot be granted), and the member panel says whether People holds a file, read from People.
  const [members, roles, areas, invites, accessRequests, scopes, employeeFiles] = await Promise.all([
    getCollection<TeamRolesMember>("owner.teamRolesMembers"),
    getCollection<TeamRolesRole>("owner.teamRolesRoles"),
    getCollection<TeamRolesPermissionArea>("owner.teamRolesPermissionAreas"),
    getCollection<TeamRolesInviteDraft>("owner.teamRolesInvite"),
    getCollection<AccessRequestView>("people.accessRequests"),
    teamScopes(ctx),
    employeeFileEmails(ctx),
  ]);
  const invite = invites.find((i) => i.id === "draft");
  if (!invite) return null;
  // Only the owner may transfer the business, and only the owner is answered its open request (the API refuses others).
  let viewerIsOwner = false;
  try {
    viewerIsOwner = ctx.ops().workspace.orgRole === "owner";
  } catch {
    viewerIsOwner = false;
  }
  const transfer = viewerIsOwner ? await currentOwnershipTransfer(ctx).catch(() => null) : null;
  const ownershipTransfer = transfer?.transfer ?? null;
  const transferEligible = transfer?.eligible ?? [];
  return {
    members,
    roles,
    areas,
    scopes,
    invite,
    businessName: businessNames(ctx, { permission: "team.manage" }),
    employeeFiles,
    accessRequests,
    viewerIsOwner,
    ownershipTransfer,
    transferEligible,
  };
}
