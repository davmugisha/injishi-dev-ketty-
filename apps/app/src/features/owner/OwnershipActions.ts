"use server";

import type { TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import { revalidatePath } from "next/cache";
import { currentAccount, requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  acceptOwnershipTransfer,
  cancelOwnershipTransfer,
  declineOwnershipTransfer,
  myOwnershipTransfers,
  type OwnershipTransferInfo,
  requestOwnershipTransfer,
  sendOwnershipCode,
} from "@/server/ownership-transfer";
import { ORG_ROLE_OF } from "@/server/sources/owner";

type Result<T = undefined> = { ok: true; value: T } | { ok: false; message: string };

function refusal(error: unknown): { ok: false; message: string } {
  if (error instanceof ApiError) return { ok: false, message: error.message };
  if (error instanceof ApiUnreachableError)
    return { ok: false, message: "The Injishi service did not answer. Try again." };
  throw error;
}

/** Every screen that shows who owns the business, or a request waiting. */
function refresh() {
  revalidatePath("/pos", "layout");
  revalidatePath("/settings/team");
}

async function signedIn(): Promise<boolean> {
  return (await currentAccount()) !== null;
}

// ── The owner's side (Team → Transfer ownership) ────────────────────────────────────────────────────

/**
 * Ask for the business to pass to `toUserId`: the step-up code is checked by the API first, then the request is made
 * there, where only the owner, with a step-up from the last ten minutes, may make it.
 */
export async function requestTransferAction(input: {
  toUserId: string;
  afterRole: TeamRolesRoleId;
  code: string;
}): Promise<Result<OwnershipTransferInfo>> {
  await requirePersona("TeamRoles");
  const previousOwnerRole = ORG_ROLE_OF[input.afterRole];
  if (!previousOwnerRole || previousOwnerRole === "owner") return { ok: false, message: "Choose the role you keep." };
  try {
    const value = await requestOwnershipTransfer(await requestContext(), {
      toUserId: input.toUserId,
      previousOwnerRole,
      code: input.code,
    });
    refresh();
    return { ok: true, value };
  } catch (error) {
    return refusal(error);
  }
}

export async function cancelTransferAction(transferId: string): Promise<Result> {
  await requirePersona("TeamRoles");
  try {
    await cancelOwnershipTransfer(await requestContext(), transferId);
    refresh();
    return { ok: true, value: undefined };
  } catch (error) {
    return refusal(error);
  }
}

// ── The side of the member asked to become owner ────────────────────────────────────────────────────

/** Requests waiting for the signed-in person (empty when signed out or when the API cannot be reached). */
export async function myTransfersAction(): Promise<OwnershipTransferInfo[]> {
  if (!(await signedIn())) return [];
  try {
    return await myOwnershipTransfers(await requestContext());
  } catch {
    return [];
  }
}

export async function sendOwnershipCodeAction(): Promise<Result<{ sentTo: string }>> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again." };
  try {
    return { ok: true, value: await sendOwnershipCode(await requestContext()) };
  } catch (error) {
    return refusal(error);
  }
}

export async function acceptTransferAction(
  transferId: string,
  code: string,
): Promise<Result<{ orgId: string; legalName: string }>> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again." };
  try {
    const value = await acceptOwnershipTransfer(await requestContext(), transferId, code);
    refresh();
    return { ok: true, value };
  } catch (error) {
    return refusal(error);
  }
}

export async function declineTransferAction(transferId: string): Promise<Result> {
  if (!(await signedIn())) return { ok: false, message: "Sign in again." };
  try {
    await declineOwnershipTransfer(await requestContext(), transferId);
    refresh();
    return { ok: true, value: undefined };
  } catch (error) {
    return refusal(error);
  }
}
