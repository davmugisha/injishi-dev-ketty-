import { ConflictException, NotFoundException } from '@nestjs/common';
import { LEASE_STATUS_LABEL, type LeaseStatus, type WorkspaceAccess } from '@injishi/contracts';
import { eq, inArray, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import type { BranchScope, ScopedWorkspace } from '../../../shared/auth/branch-scope';

/** The workspace a rentals service acts in: a residence business, with its org. */
export interface ResidenceWorkspace {
  readonly workspaceId: string;
  readonly orgId: string;
}

/** What a non-residence business is told by every rentals route. */
export const NOT_RESIDENCE_MESSAGE = 'There is no rentals business here.';

/**
 * Refuse anything that is not a residence business (blueprint 1.1).
 *
 * Permissions do not know the domain: a hotel manager holds `unit.manage` and
 * `lease.manage` like a landlord's manager does. So every rentals service
 * calls this first, and a hotel, a broker workspace or a personal one is
 * answered 404: there is nothing of this kind here, which is also true.
 */
export function assertResidence(
  ws: Pick<WorkspaceAccess, 'kind' | 'domain' | 'orgId' | 'workspaceId'>,
): ResidenceWorkspace {
  if (ws.kind !== 'business' || ws.domain !== 'residence' || !ws.orgId) {
    throw new NotFoundException(NOT_RESIDENCE_MESSAGE);
  }
  return { workspaceId: ws.workspaceId, orgId: ws.orgId };
}

/**
 * Does the caller's branch scope cover this building?
 *
 * A building is a `properties` row, a branch. A member limited to some
 * branches sees only theirs; a selected branch (`x-branch-id`) narrows to it.
 * A member covering every branch covers a building the rentals module made in
 * this very request (the scope was resolved before it existed), which is why
 * this is not `coversProperty`.
 */
export function coversBuilding(scope: BranchScope, propertyId: string): boolean {
  if (scope.selectedPropertyId) return scope.selectedPropertyId === propertyId;
  if (scope.coverage === 'all') return true;
  return scope.propertyIds.includes(propertyId);
}

/** 404 for a row of a building outside the caller's scope, in the words of `what`. */
export function assertBuildingInScope(ws: Pick<ScopedWorkspace, 'branchScope'>, propertyId: string, what: string): void {
  if (!coversBuilding(ws.branchScope, propertyId)) throw new NotFoundException(`${what} not found.`);
}

/** The list filter matching `coversBuilding`: null when every building of the workspace is covered. */
export function buildingFilter(column: AnyColumn | SQL, scope: BranchScope): SQL | null {
  if (scope.selectedPropertyId) return eq(column as AnyColumn, scope.selectedPropertyId);
  if (scope.coverage === 'all') return null;
  return scope.propertyIds.length > 0 ? inArray(column as AnyColumn, [...scope.propertyIds]) : sql`false`;
}

/**
 * A 409 that says where the lease stands, in words, and what can be done
 * instead. The current status rides along for a client that branches on it.
 */
export function leaseStateConflict(status: LeaseStatus, sentence: string): ConflictException {
  return new ConflictException({
    code: 'lease_state',
    current: status,
    currentLabel: LEASE_STATUS_LABEL[status],
    message: `This lease is ${LEASE_STATE_WORDS[status]}. ${sentence}`,
  });
}

/** Where a lease stands, as the second half of "This lease is …". */
export const LEASE_STATE_WORDS: Readonly<Record<LeaseStatus, string>> = {
  draft: 'a draft',
  pending_signature: "out for the tenant's signature",
  signed: 'signed and has not started yet',
  active: 'active',
  ending: 'ending',
  ended: 'ended',
  cancelled: 'cancelled',
};
