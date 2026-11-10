import { NotFoundException } from '@nestjs/common';
import { NEEDS_EVERY_BRANCH_MESSAGE, type WorkspaceAccess } from '@injishi/contracts';
import { inArray, isNull, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import { accessRefusal } from './access-refusal';

/**
 * Which branches a request may touch (ADR-054, Branch scope enforcement).
 *
 * `WorkspaceGuard` answers "does the caller hold this workspace". This answers
 * the next question down: "which of its branches". It is resolved once, in the
 * guard, and every ops and inventory repository filters by the SAME concrete
 * list, so a missed join is the only way a row of another branch can leak.
 *
 * - `coverage`: `all` when the membership carries no `org_membership_branches`
 *   row, else `limited`. An owner is always `all` (invariant 5).
 * - `selectedPropertyId`: the branch named by `x-branch-id`, or null.
 * - `propertyIds`: the one selected branch, or every covered property of the
 *   workspace. Archived ones are included, so history stays readable.
 * - `includesUnbranched`: whether a row that belongs to no branch (a corporate
 *   department, a standalone outlet, a thread tied to nothing) may be seen.
 *   Only a member covering every branch sees them (AC-T3), and only while no
 *   single branch is in view, because a chosen branch means "only that branch"
 *   (AC-S1).
 */
export interface BranchScope {
  readonly coverage: 'all' | 'limited';
  readonly selectedPropertyId: string | null;
  readonly propertyIds: readonly string[];
  readonly includesUnbranched: boolean;
}

/**
 * The workspace as an ops or inventory route sees it: the grant plus its branch
 * scope. `@CurrentWorkspace()` returns this shape, and every service that reads
 * or writes branch rows asks for it by type, so a call site that never received
 * a scope fails the typecheck instead of reading every branch.
 */
export type ScopedWorkspace = WorkspaceAccess & { readonly branchScope: BranchScope };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What a member covers, as `WorkspaceService.coveredProperties` reads it. */
export interface CoveredProperties {
  readonly coverage: 'all' | 'limited';
  /** Every covered property of the workspace, archived ones included. */
  readonly propertyIds: readonly string[];
}

/**
 * Resolve the scope from the member's covered properties and the header.
 *
 * A header naming a malformed id, a property of another workspace, or a branch
 * the member does not cover answers 404 (AC-S2): the same answer for all three,
 * so a probe cannot learn which ids exist. An absent or empty header means
 * every covered branch.
 */
export function resolveBranchScope(
  { coverage, propertyIds: covered }: CoveredProperties,
  header: string | string[] | undefined,
): BranchScope {
  const raw = Array.isArray(header) ? header[0] : header;
  const claimed = raw?.trim() ?? '';
  if (claimed === '') {
    return {
      coverage,
      selectedPropertyId: null,
      propertyIds: covered,
      // A row of no branch belongs to the whole business, so only a member
      // covering every branch sees it (AC-T3).
      includesUnbranched: coverage === 'all',
    };
  }

  const match = UUID.test(claimed)
    ? covered.find((id) => id.toLowerCase() === claimed.toLowerCase())
    : undefined;
  if (!match) {
    // `layer: "scope"`, `code: "not_found"` (ADR-076 G11), status unchanged.
    throw accessRefusal('not_found', 'That branch is not available to you.');
  }
  return {
    coverage,
    selectedPropertyId: match,
    propertyIds: [match],
    includesUnbranched: false,
  };
}

/**
 * The repository filter: `column` is one of the scope's properties, or null
 * when the scope may see unbranched rows.
 *
 * `column` may be an expression, such as a coalesce of a row's own property
 * and its outlet's. Pass a NOT NULL column (`rooms.property_id`) and the null arm simply matches
 * nothing. An empty list matches nothing rather than everything, which is what
 * `inArray` with no values would otherwise leave to the driver.
 */
export function inBranchScope(column: AnyColumn | SQL, scope: BranchScope): SQL {
  const ids = [...scope.propertyIds];
  // `inArray` renders an expression exactly as it renders a column; its types
  // only admit the SQL overload with SQL values, hence the narrowing cast.
  const listed = ids.length > 0 ? inArray(column as AnyColumn, ids) : sql`false`;
  if (!scope.includesUnbranched) return listed;
  return or(listed, isNull(column)) ?? listed;
}

/** May this scope see a row that belongs to `propertyId` (null: no branch)? */
export function coversProperty(scope: BranchScope, propertyId: string | null | undefined): boolean {
  if (propertyId === null || propertyId === undefined) return scope.includesUnbranched;
  return scope.propertyIds.includes(propertyId);
}

/**
 * The single row check, next to `assertOwned`: a row of a branch outside the
 * scope answers 404, never 403 (AC-T2), for the same reason `assertOwned` does.
 */
export function assertInBranchScope(
  ws: Pick<ScopedWorkspace, 'branchScope'>,
  propertyId: string | null | undefined,
  what?: string,
): void {
  if (!coversProperty(ws.branchScope, propertyId)) {
    throw what ? new NotFoundException(`${what} not found.`) : new NotFoundException();
  }
}

/**
 * Refuse a member limited to some branches an org wide action (ADR-054 AC-M6).
 *
 * A 403 in plain words rather than a 404: the member knows the action exists,
 * and what they lack is coverage, not knowledge of the row. Routes declare it
 * with `@RequireEveryBranch()`; a service calls it where the need depends on
 * the request, as branch create does.
 */
export function assertCoversEveryBranch(ws: Pick<WorkspaceAccess, 'branchCoverage'>): void {
  if (ws.branchCoverage === 'limited') {
    throw accessRefusal('out_of_scope', NEEDS_EVERY_BRANCH_MESSAGE);
  }
}
