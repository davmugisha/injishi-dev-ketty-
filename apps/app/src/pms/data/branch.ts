/**
 * The branch in view, as the data layer sees it.
 *
 * Slimmed for the restored PSF / oversight console: only the header helper
 * the shared `api.ts` client needs. Branch switching UI is not on this surface.
 */

let branchInView: string | null = null;

/** Written by a branch scope provider when one mounts; unused on PSF consoles. */
export function setBranchInView(branchId: string | null): void {
  branchInView = branchId;
}

export function getBranchInView(): string | null {
  return branchInView;
}

/**
 * The header for a request. Empty with no branch chosen (every covered branch),
 * and empty when a caller asks for the whole business.
 */
export function branchHeader(allBranches = false): Record<string, string> {
  return !allBranches && branchInView ? { "x-branch-id": branchInView } : {};
}
