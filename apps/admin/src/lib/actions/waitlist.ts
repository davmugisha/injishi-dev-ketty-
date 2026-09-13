"use server";

import { AdminWaitlistInviteResult, Uuid } from "@injishi/contracts";
import { revalidatePath } from "next/cache";

import { apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * The one waitlist write (ADR-048) — `POST /api/v1/admin/waitlist/:id/invite`.
 *
 * A Server Action, because the staffer's session cookie belongs to the API
 * origin and only a server-side call carries it.
 *
 * IT IS IDEMPOTENT AT THE API, which is why the success sentence can be worded
 * from `invitedAt` rather than from "we just did it": marking somebody invited
 * twice returns the FIRST timestamp, so a staffer who clicks again is told when
 * the person was actually invited instead of being quietly told a new lie about
 * today.
 */
const INVITE: WriteSpec<AdminWaitlistInviteResult> = {
  what: "marking them invited",
  // The waitlist routes declare no staff permission of their own: `StaffGuard`
  // alone is their boundary, and ADR-048 did not mint a power for them. This
  // names the closest existing one purely so a refusal has words, the same
  // borrowing `REISSUE` in `users.ts` documents. If a waitlist permission is
  // ever added, this line and the controller change together.
  permission: "admin.overview.view",
  success: (r) =>
    `Marked invited, recorded at ${r.invitedAt}. Clicking again will not move that time.`,
};

export async function markInvited(
  id: string,
): Promise<WriteOutcome<AdminWaitlistInviteResult>> {
  const parsed = Uuid.safeParse(id);
  if (!parsed.success) return badInput(INVITE);

  const result = await apiPost(
    `/api/v1/admin/waitlist/${parsed.data}/invite`,
    AdminWaitlistInviteResult,
  );

  // The row's own state changed, so the page that listed it is now stale.
  if (result.ok) revalidatePath("/waitlist");

  return outcomeOf(result, INVITE);
}
