"use server";

import { screenHref } from "@injishi/data";
import type { TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  cancelInvitation,
  changeMember,
  inviteMember,
  OwnerRefusal,
  saveRolePresets,
  sendStepUpCode,
} from "@/server/mutations/owner";
import { decideAccessRequest, StaffInputError } from "@/server/mutations/staff-access";

/** What a Team and Roles action answers: done, or the refusal in words the person can act on. */
type TeamActionResult = { ok: true } | { ok: false; message: string };

function refusal(error: unknown): { ok: false; message: string } {
  if (error instanceof OwnerRefusal || error instanceof ApiError || error instanceof StaffInputError)
    return { ok: false, message: error.message };
  if (error instanceof ApiUnreachableError)
    return { ok: false, message: "The Injishi service did not answer. Try again." };
  throw error;
}

async function run(work: () => Promise<unknown>): Promise<TeamActionResult> {
  await requirePersona("TeamRoles");
  try {
    await work();
  } catch (error) {
    return refusal(error);
  }
  revalidatePath(screenHref("TeamRoles"));
  revalidatePath(screenHref("Employees"));
  return { ok: true };
}

/**
 * "Send code" on a step-up field (`POST /me/two-factor/send`): the API emails a fresh code for this session
 * and answers the masked address it went to. Nothing on the team changes.
 */
export async function sendTeamStepUpCode(): Promise<{ ok: true; sentTo: string } | { ok: false; message: string }> {
  await requirePersona("TeamRoles");
  try {
    const { sentTo } = await sendStepUpCode(await requestContext());
    return { ok: true, sentTo };
  } catch (error) {
    return refusal(error);
  }
}

/**
 * Send an invitation (`POST /ops/team/invitations`) after the API has checked the step-up code
 * (`POST /me/two-factor/verify`). The API mails the single use link; access starts on accept.
 */
export async function sendTeamInvite(input: {
  name: string;
  contact: string;
  role: TeamRolesRoleId;
  scope: string[];
  code: string;
}): Promise<TeamActionResult> {
  return run(async () =>
    inviteMember(await requestContext(), {
      name: input.name,
      contact: input.contact,
      role: input.role,
      scopeIds: input.scope,
      stepUpCode: input.code,
    }),
  );
}

/** Cancel an invitation nobody has accepted (`POST /ops/team/invitations/:id/revoke`). */
export async function cancelTeamInvite(memberId: string): Promise<TeamActionResult> {
  return run(async () => cancelInvitation(await requestContext(), memberId));
}

/**
 * Change a member's role and the properties they cover (`PATCH …/role`, `PUT …/branches`), each audited, after
 * the API has checked the step-up code.
 */
export async function changeTeamMember(
  userId: string,
  input: { role: TeamRolesRoleId; scope: string[]; code: string },
): Promise<TeamActionResult> {
  return run(async () =>
    changeMember(await requestContext(), userId, { role: input.role, scopeIds: input.scope, stepUpCode: input.code }),
  );
}

/** Save the role presets (`PUT /ops/roles/:role` for each role that changed). */
export async function saveTeamRolePresets(
  presets: Partial<Record<TeamRolesRoleId, string[]>>,
): Promise<TeamActionResult> {
  return run(async () => saveRolePresets(await requestContext(), presets));
}

/**
 * Approve a login HR asked for while putting someone on file (its invitation is sent now), or
 * decline it with a reason HR reads on the file (`POST /ops/team/access-requests/:id/…`).
 */
export async function decideAccess(id: string, decision: "approve" | "decline", note = ""): Promise<TeamActionResult> {
  return run(async () => decideAccessRequest(await requestContext(), id, decision, note));
}
