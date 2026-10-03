import { ForbiddenException, NotFoundException } from '@nestjs/common';

import {
  coversProperty,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';

/**
 * Who may see what of a file, and whose files a caller may act on (ADR-058,
 * cross child contract 4 and AC-T6).
 */

/** `basic` has no field for a sensitive value; `full` has them all (AC-P2). */
export type FileView = 'basic' | 'full';

/**
 * Only `people.manage` and `payroll.run` see date of birth, ID, RSSB number
 * and wages. Read from the grant `WorkspaceGuard` resolved, so an ADR-055
 * override moves it like any other permission.
 */
export function fileViewFor(ws: Pick<ScopedWorkspace, 'permissions'>): FileView {
  return ws.permissions.includes('people.manage') || ws.permissions.includes('payroll.run')
    ? 'full'
    : 'basic';
}

/** The business the workspace is. Every HR row carries it (AC-U4). */
export function orgOf(ws: Pick<ScopedWorkspace, 'orgId'>): string {
  if (!ws.orgId) {
    // A broker or personal workspace holds no business, so it has no staff.
    throw new NotFoundException('Only a business has staff files.');
  }
  return ws.orgId;
}

/**
 * Refuse a write on a person who works outside the caller's branches (AC-T6,
 * AC-L5).
 *
 * 403 in words rather than ADR-054's usual 404, because ADR-058 names it: the
 * person is on the business's file and the caller knows it; what they lack is
 * coverage of the branch. A read of a single file outside the scope stays a
 * 404 (`assertInBranchScope`), so the id space is not a directory.
 */
export function assertPersonInReach(
  ws: Pick<ScopedWorkspace, 'branchScope'>,
  workPropertyId: string | null,
): void {
  if (!coversProperty(ws.branchScope, workPropertyId)) {
    throw new ForbiddenException(
      'This person works at a branch outside yours, so only someone who covers it can do that.',
    );
  }
}

/** The same refusal for a branch named directly, as a shift template's. */
export function assertBranchInReach(
  ws: Pick<ScopedWorkspace, 'branchScope'>,
  propertyId: string,
): void {
  if (!coversProperty(ws.branchScope, propertyId)) {
    throw new ForbiddenException('That branch is outside yours.');
  }
}
