"use server";

import { screenHref } from "@injishi/data";
import type { TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { requestContext } from "@/server/data";
import { cancelInvitation, changeMember, inviteMember, OwnerRefusal, saveRolePresets } from "@/server/mutations/owner";

/** What a Team and Roles action answers: done, or the refusal in words the person can act on. */
export type TeamActionResult = { ok: true } | { ok: false; message: string };

async function run(work: () => Promise<unknown>): Promise<TeamActionResult> {
  await requirePersona("TeamRoles");
  try {
    await work();
  } catch (error) {
    if (error instanceof OwnerRefusal || error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath(screenHref("TeamRoles"));
  return { ok: true };
}

/** Send an invitation (`POST /ops/team/invitations`). The API mails the single use link; access starts on accept. */
export async function sendTeamInvite(input: {
  name: string;
  contact: string;
  role: TeamRolesRoleId;
  scope: string[];
}): Promise<TeamActionResult> {
  return run(async () =>
    inviteMember(await requestContext(), {
      name: input.name,
      contact: input.contact,
      role: input.role,
      scopeIds: input.scope,
    }),
  );
}

/** Cancel an invitation nobody has accepted (`POST /ops/team/invitations/:id/revoke`). */
export async function cancelTeamInvite(memberId: string): Promise<TeamActionResult> {
  return run(async () => cancelInvitation(await requestContext(), memberId));
}

/** Change a member's role and the properties they cover (`PATCH …/role`, `PUT …/branches`), each audited. */
export async function changeTeamMember(
  userId: string,
  input: { role: TeamRolesRoleId; scope: string[] },
): Promise<TeamActionResult> {
  return run(async () => changeMember(await requestContext(), userId, { role: input.role, scopeIds: input.scope }));
}

/** Save the role presets (`PUT /ops/roles/:role` for each role that changed). */
export async function saveTeamRolePresets(
  presets: Partial<Record<TeamRolesRoleId, string[]>>,
): Promise<TeamActionResult> {
  return run(async () => saveRolePresets(await requestContext(), presets));
}
