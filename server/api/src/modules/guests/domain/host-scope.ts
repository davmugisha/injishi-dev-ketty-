import type { BranchScope } from '../../../shared/auth/branch-scope';

/**
 * A landlord's guests follow the rentals rules: residence businesses only
 * (404 otherwise), and a member limited to some buildings sees only theirs.
 */
export { assertResidence, coversBuilding } from '../../rentals/domain/residence';

/** The buildings a list is limited to: null when every building of the workspace is covered. */
export function buildingFilterIds(scope: BranchScope): readonly string[] | null {
  if (scope.selectedPropertyId) return [scope.selectedPropertyId];
  if (scope.coverage === 'all') return null;
  return scope.propertyIds;
}
