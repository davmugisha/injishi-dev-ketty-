/**
 * How a count of live stays is said on the public pages.
 *
 * Production opened with an empty catalogue, and the home page printed
 * "0 stays" on every card, pill and button that carried a number: ten zeros
 * above the fold of a marketplace asking to be trusted. A zero is not a fact
 * worth advertising, so it is never printed. Callers draw their empty state
 * instead, and the usual one is an invitation to list (`OPENING_LINE`), since
 * the plan is supply first, district by district.
 */

/** "1 stay" or "3 stays"; `null` for none, so the caller draws its empty state. */
export function stayCount(count: number): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? "stay" : "stays"}`;
}

/** The line a district with nothing listed shows in place of a count. */
export const OPENING_LINE = "Hosts joining now";

/** Where an empty district sends an owner who could fill it. */
export const LIST_HREF = "/host";
