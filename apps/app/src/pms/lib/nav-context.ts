import type { DepartmentCategory } from "@injishi/contracts";

import type { NavContext } from "./nav";

/**
 * Assemble the nav context.
 *
 * `AppShell`, `CommandBar` and `Sidebar` each used to write this object out by
 * hand. Three copies of "what a workspace is" is three chances for the route
 * guard, the command palette and the sidebar to disagree about which screens
 * exist, and the guard is the one that refuses a URL, so a drift there is a
 * locked door rather than a cosmetic bug.
 *
 * **The departments come from the GRANT now** (ADR-035, D-a). They used to be
 * lifted out of `state.db`, the demo fixture, which meant a made up property
 * decided whether a real hotel had a Services section and therefore whether a
 * real person could open that URL. They arrive on the same row as the role and
 * the permission array, so all three are one read.
 *
 * A grant that has not arrived yields an EMPTY department list, which is a nav
 * with no optional sections. That is the right way for this to fail: a door
 * that has not been granted yet stays shut, and appears the moment the answer
 * lands. The alternative — falling back to a fixture's departments — is the bug
 * this change removes.
 */

/** The store slice a nav is built from. */
interface NavSource {
  state: Pick<NavContext, "ws" | "role" | "workspaceId"> & {
    grants: readonly { workspaceId: string | null; departments: DepartmentCategory[] }[] | null;
  };
}

export function navContextOf(
  pms: NavSource,
  workspaceId: string | null,
): NavContext {
  // BY ID, never by kind, once the route has named one (ADR-018, invariant 1).
  // Two hotels are two grants with the same `key`, and matching on kind hands
  // the second hotel the first one's sections.
  const grant =
    pms.state.grants?.find((g) =>
      workspaceId ? g.workspaceId === workspaceId : g.workspaceId === pms.state.workspaceId,
    ) ?? null;

  return {
    ws: pms.state.ws,
    // From the URL, never from the store (ADR-018, invariant 1). Passed in
    // rather than read here so this file keeps importing no runtime module.
    workspaceId,
    role: pms.state.role,
    departments: grant?.departments ?? [],
    // No counts yet. Every pill stays absent until a live query answers it
    // (ADR-035, D-a); a fixture supplied number is not a count.
    counts: undefined,
  };
}
