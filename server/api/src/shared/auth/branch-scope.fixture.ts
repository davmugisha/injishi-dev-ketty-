import type { BranchScope } from './branch-scope';

/**
 * A branch scope for a spec: every branch listed, as `WorkspaceGuard` resolves
 * it for a member covering every branch with no `x-branch-id` (ADR-054).
 * Specs only; nothing in the app imports this.
 */
export function everyBranch(...propertyIds: string[]): BranchScope {
  return {
    coverage: 'all',
    selectedPropertyId: null,
    propertyIds,
    includesUnbranched: true,
  };
}
