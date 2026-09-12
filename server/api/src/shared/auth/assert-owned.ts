import { NotFoundException } from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

/**
 * Prove that the row a nested route named actually belongs to the caller's
 * workspace (ADR-012, AC-3).
 *
 * `WorkspaceGuard` proves the caller holds the workspace. It does NOT prove the
 * `:id` in the path belongs to it — the guard never reads the row. Without this
 * check every `/ops/<thing>/:id/<command>` route is a cross tenant hole that no
 * lint rule can see, because forgetting it is an absence rather than a mistake.
 *
 * 404, never 403. A 403 confirms the row exists and belongs to someone else,
 * which turns the id space into a directory a competitor can walk. A 404 says
 * only "not here", which is also true.
 *
 * Every service behind a nested `/ops` or `/admin` route calls this.
 */
export function assertOwned<T extends { workspaceId: string }>(
  row: T | undefined | null,
  ws: Pick<WorkspaceAccess, 'workspaceId'>,
): T {
  if (!row || row.workspaceId !== ws.workspaceId) {
    throw new NotFoundException();
  }
  return row;
}

/**
 * The same rule for a row that hangs off an org rather than a workspace.
 *
 * Most operational tables key on the org, not the workspace row, so the check
 * has to compare the field the row actually carries. Refusing when the access
 * has no `orgId` is deliberate: a broker or personal workspace holds no org, so
 * an org scoped row can never be theirs.
 */
export function assertOwnedByOrg<T extends { orgId: string }>(
  row: T | undefined | null,
  ws: Pick<WorkspaceAccess, 'orgId'>,
): T {
  if (!row || !ws.orgId || row.orgId !== ws.orgId) {
    throw new NotFoundException();
  }
  return row;
}
