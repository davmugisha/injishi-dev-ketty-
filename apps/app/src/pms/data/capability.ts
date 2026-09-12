"use client";

/**
 * What a screen may do, and what to say when it may not (ADR-012).
 *
 * A screen ASKS; it never works it out:
 *
 *   const { can, reasonFor } = useCapability();
 *   <Button
 *     isDisabled={!can("stay.checkin")}
 *     title={reasonFor("stay.checkin")}
 *     onPress={() => checkIn.mutate({ stayId })}
 *   />
 *
 * That is the whole client half of the standard. The answer is the array the
 * server resolved on `GET /api/v1/me/workspaces`; nothing here consults a role.
 *
 * It reads through the store rather than reaching into the query cache a second
 * time, on purpose. The store is already fed by that same query (see
 * `store.tsx`), so there is exactly one copy of the array in the app and a
 * refetch reaches a button and the reducer at the same moment. Two readers of
 * one array; never two arrays.
 *
 * The freshness of that array is bounded by the three triggers in
 * `queries.ts`. Between a revocation and the next 403, focus event, or 60
 * second window, a control may still look enabled. The server refuses it, so
 * the worst case is a confusing refusal rather than an unauthorized action.
 */

import { useParams } from "next/navigation";
import { useMemo } from "react";

import type { Permission } from "../authz";
import {
  currentGrant,
  permissionsOf,
  refusalFor,
  type CapabilityView,
} from "../store/helpers";
import { usePms } from "../store";
import type { MeStatus } from "./me";

/**
 * The workspace id every command must name, or null when there is none.
 *
 * THE URL IS THE SOURCE (ADR-018, invariant 1). A screen under
 * `/w/[workspaceId]/...` reads the id out of the address bar, so two tabs on
 * two hotels each read and write their own, and a store that has not caught up
 * with the route cannot make one tab act on the other's rows. The store may
 * cache the id; it may never be where the id comes from.
 *
 * The grant is the fallback for a route that carries no param.
 *
 * Null has one meaning and it is not an error: nothing on the server answers
 * for this view, which is the standalone demo (the API never replied, or was
 * never running). A screen reads null as "work from the demo store and say so",
 * never as "you are signed out".
 */
export function useWorkspaceId(): string | null {
  const { state } = usePms();
  const params = useParams<{ workspaceId?: string | string[] }>();
  const fromRoute = params?.workspaceId;
  if (typeof fromRoute === "string" && fromRoute) return fromRoute;
  return currentGrant(state)?.workspaceId ?? null;
}

export interface Capability {
  /** Does the caller hold this permission in the workspace in view? */
  can: (permission: Permission) => boolean;
  /**
   * Plain wording for why not, or undefined when they may.
   *
   * Undefined rather than an empty string so it can be handed straight to a
   * `title` prop: a tooltip that says nothing should not exist at all.
   */
  reasonFor: (permission: Permission) => string | undefined;
  /**
   * How the answer was arrived at.
   *
   * `unreachable` is NOT `anonymous`, and a screen must never render the first
   * as "you have no access" (AC-13). A network blip is not a sign out.
   */
  status: MeStatus;
  /** True while the first answer is still in flight. */
  isLoading: boolean;
}

export function useCapability(): Capability {
  const { state } = usePms();
  // Only the inputs the answer is a function of. This used to depend on the
  // whole `state`, so every toast, every keystroke and every drag on the
  // calendar handed a fresh `can` to every button in the app and re-rendered
  // all of them. Nothing outside these five fields can change the answer.
  const { grants, grantsStatus, ws, workspaceId, role } = state;

  return useMemo(() => {
    const view: CapabilityView = { grants, grantsStatus, ws, workspaceId, role };
    const held = new Set<Permission>(permissionsOf(view));
    const can = (permission: Permission): boolean => held.has(permission);
    return {
      can,
      reasonFor: (permission: Permission) =>
        can(permission) ? undefined : refusalFor(view, permission),
      status: grantsStatus,
      isLoading: grantsStatus === "loading",
    };
  }, [grants, grantsStatus, ws, workspaceId, role]);
}
