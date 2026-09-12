import { NotFoundException } from '@nestjs/common';

/**
 * Prove that the row a `/me` route named actually belongs to the caller
 * (ADR-032, AC-24).
 *
 * This is the sibling of `assertOwned`, for the other authorization model. A
 * `/ops` route is authorized by workspace: `WorkspaceGuard` proves the caller
 * holds the workspace, and `assertOwned` proves the row sits inside it. A `/me`
 * route has no workspace to lean on — a guest's thread lives in the property's
 * workspace, not the guest's, so no workspace guard can answer the question.
 * Ownership is the guard instead, and it is proved here, in the service.
 *
 * That is why the ADR-012 permission lint rule does not fire on these routes
 * and should not be made to: it governs `WorkspaceGuard` and
 * `StaffGuard` routes, and a `/me` route is behind neither.
 *
 * 404, never 403, for the same reason `assertOwned` gives: a 403 confirms the
 * id exists and belongs to someone else, which turns the id space into a
 * directory a probe can walk. A 404 says only "not here", which is also true.
 *
 * `ownerUserId` is nullable because the join that produced it may not have
 * found an owner at all — an unattached thread, a booking with no guest. A row
 * that belongs to nobody belongs to nobody in particular, so it is refused.
 *
 * Every mutating `/me` route calls this before it writes.
 */
export function assertMine<T>(
  row: T | undefined | null,
  ownerUserId: string | null | undefined,
  userId: string,
): T {
  if (!row || !ownerUserId || ownerUserId !== userId) {
    throw new NotFoundException();
  }
  return row;
}
