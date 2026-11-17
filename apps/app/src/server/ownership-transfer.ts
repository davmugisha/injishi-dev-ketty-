/**
 * Ownership transfer, read and written through the API (migration 0155). Server side only.
 *
 * The owner's side is the business's (`/api/v1/ops/team/ownership-transfer`, in the hospitality workspace); the side of
 * the member asked is theirs (`/api/v1/me/ownership-transfers`). Both checks of "it is really you" are the platform's
 * own email step-up: the code is emailed by `POST /me/two-factor/send` and checked by `POST /me/two-factor/verify`,
 * which marks THIS session verified; the transfer routes then refuse unless that happened within ten minutes. This file
 * never decides a code is good.
 */
import type { SourceContext } from "./sources/types";

export interface OwnershipTransferInfo {
  id: string;
  legalName: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toEmail: string;
  previousOwnerRole: string;
  previousOwnerRoleLabel: string;
  expiresAt: string;
  requestedAt: string;
}

const OWNER = "/api/v1/ops/team/ownership-transfer";
const MINE = "/api/v1/me/ownership-transfers";

/** Check a step-up code on the API; a wrong, expired or spent code is refused there (422) in words to show. */
async function verifyCode(ctx: SourceContext, code: string): Promise<void> {
  await ctx.api.post("/api/v1/me/two-factor/verify", { code: code.replace(/\D/g, "") });
}

/** A member who could become owner: active and identity-verified by the platform's rule (the API decides). */
export interface TransferEligible {
  userId: string;
  name: string;
  roleLabel: string;
}

/** The business's open request and who could be asked; for the owner only (the API refuses anyone else). */
export async function currentOwnershipTransfer(
  ctx: SourceContext,
): Promise<{ transfer: OwnershipTransferInfo | null; eligible: TransferEligible[] }> {
  return ctx.ops().get<{ transfer: OwnershipTransferInfo | null; eligible: TransferEligible[] }>(OWNER);
}

export async function requestOwnershipTransfer(
  ctx: SourceContext,
  input: { toUserId: string; previousOwnerRole: string; code: string },
): Promise<OwnershipTransferInfo> {
  await verifyCode(ctx, input.code);
  const res = await ctx.ops().post<{ transfer: OwnershipTransferInfo }>(OWNER, {
    toUserId: input.toUserId,
    previousOwnerRole: input.previousOwnerRole,
  });
  return res.transfer;
}

export async function cancelOwnershipTransfer(ctx: SourceContext, transferId: string): Promise<void> {
  await ctx.ops().post(`${OWNER}/${encodeURIComponent(transferId)}/cancel`, {});
}

/** The open requests that would make the signed-in person an owner. */
export async function myOwnershipTransfers(ctx: SourceContext): Promise<OwnershipTransferInfo[]> {
  const res = await ctx.api.get<{ transfers: OwnershipTransferInfo[] }>(MINE);
  return res.transfers;
}

export async function sendOwnershipCode(ctx: SourceContext): Promise<{ sentTo: string }> {
  return ctx.api.post<{ sentTo: string }>("/api/v1/me/two-factor/send", {});
}

export async function acceptOwnershipTransfer(
  ctx: SourceContext,
  transferId: string,
  code: string,
): Promise<{ orgId: string; legalName: string }> {
  await verifyCode(ctx, code);
  return ctx.api.post<{ orgId: string; legalName: string }>(`${MINE}/${encodeURIComponent(transferId)}/accept`, {});
}

export async function declineOwnershipTransfer(ctx: SourceContext, transferId: string): Promise<void> {
  await ctx.api.post(`${MINE}/${encodeURIComponent(transferId)}/decline`, {});
}
