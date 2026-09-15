/**
 * The branch in view, as the data layer sees it (ADR-054 AC-S1, AC-S2).
 *
 * THE URL IS THE SOURCE. `?branch=<id>` decides which branch the screens show,
 * and `BranchScope` (components/branch-scope.tsx) is the one writer of the value
 * below: it resolves the parameter against the grant while it renders, before
 * any screen under it asks for data. Everything here only reads.
 *
 * It is module state rather than context because the fetch helpers are plain
 * functions called from query functions, not hooks. There is one operator
 * surface per tab, so one value per tab is exactly the right size.
 *
 * THE API IS THE BOUNDARY. `WorkspaceGuard` narrows every ops and inventory row
 * to the branch this header names, and refuses one the member does not cover
 * with a 404. Sending it is how a screen asks; it is never how access is decided.
 */

import { hashKey } from "@tanstack/react-query";

let branchInView: string | null = null;

/** Written by `BranchScope` only. */
export function setBranchInView(branchId: string | null): void {
  branchInView = branchId;
}

export function getBranchInView(): string | null {
  return branchInView;
}

/**
 * The header for a request. Empty with no branch chosen (every covered branch),
 * and empty when a caller asks for the whole business: the Branches screen
 * manages every branch whichever one the switcher shows.
 */
export function branchHeader(allBranches = false): Record<string, string> {
  return !allBranches && branchInView ? { "x-branch-id": branchInView } : {};
}

/**
 * The query key hash, with the branch folded in.
 *
 * Two branches must never share a cache entry: without this, switching from
 * Rubavu to Musanze would paint Rubavu's arrivals under Musanze's name until the
 * refetch landed. Folding the branch into the HASH, rather than into every key,
 * keeps prefix invalidation (`["inventory"]`) working across branches.
 */
export function branchQueryKeyHash(queryKey: readonly unknown[]): string {
  // `hashKey` is TanStack's own stable hash (object keys sorted), so a key built
  // in a different property order still lands on the same entry.
  if (BRANCH_FREE_ROOTS.has(queryKey[0])) return hashKey(queryKey);
  return hashKey([branchInView ?? "all", ...queryKey]);
}

/**
 * Answers that do not depend on the branch. `me` is the grant itself: folding
 * the branch into it would refetch who the person is on every switch, and
 * while that refetch was pending the workspace boundary would blank the app.
 */
const BRANCH_FREE_ROOTS = new Set<unknown>(["me", "platform"]);
