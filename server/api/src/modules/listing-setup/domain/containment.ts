import { NotFoundException } from '@nestjs/common';

/**
 * Containment: does this row belong to the workspace the caller named?
 *
 * THIS IS A SECURITY CONTROL, NOT A TIDY UP. `WorkspaceGuard` answers a
 * different question: does the caller HOLD the workspace they named? It reads
 * that name from a header, a path param, the body or the query, looks it up in
 * the caller's own grant list, and stops. It never reads the target row.
 *
 * So a caller who legitimately holds workspace A can name workspace A and pass
 * any `:id` they like, including one belonging to workspace B, and the guard
 * waves it through. That is an insecure direct object reference, and it is
 * exactly the kind of hole that survives review because the route visibly
 * composes a real, trusted guard.
 *
 * ADR-009 makes this AC-14 and builds it BEFORE the first route exists, so no
 * route in this module can be written without one to call.
 *
 * It throws 404 rather than 403 on purpose: whether a row exists at all is not
 * something a stranger should be able to learn by probing ids.
 */
export function assertContained(
  row: { workspaceId: string } | null | undefined,
  claimedWorkspaceId: string,
  what: string,
): asserts row is { workspaceId: string } {
  if (!row || row.workspaceId !== claimedWorkspaceId) {
    throw new NotFoundException(`${what} not found.`);
  }
}
