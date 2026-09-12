"use client";

/**
 * The workspace in view, resolved from the address bar (ADR-018, AC-1, AC-2).
 *
 * Every operator screen sits under this layout, so this is the one place the
 * `[workspaceId]` param turns into a workspace. Two tabs on two hotels each
 * resolve their own here, which is why neither can move the other.
 *
 * THE PARAM IS THE SOURCE (invariant 1). The store may hold a copy of which
 * workspace is open; it is never where the answer comes from. Before this
 * layout existed the store held the answer and the URL only hinted at it, so a
 * store that had not caught up rendered one workspace's screens against
 * another's data.
 *
 * AN ID THE CALLER DOES NOT HOLD IS A 404, never a redirect into one they do
 * hold (ADR-017, D-c). A redirect would confirm the id exists and would quietly
 * move somebody's money screens under them. A malformed id gets the same
 * answer, so a probe learns nothing either way.
 *
 * THE GUARD IS STILL THE BOUNDARY. Everything here runs in the browser and is
 * an affordance. `WorkspaceGuard` on the API refuses the request, and it now
 * refuses against this same param (D-j).
 */

import { notFound, useParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Centered } from "@/pms/components/workspace-boundary";
import { setActiveWorkspace } from "@/pms/data/me";
import { usePms } from "@/pms/store";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId =
    typeof params.workspaceId === "string" ? params.workspaceId : "";
  const { state, dispatch } = usePms();

  const grant = state.grants?.find((g) => g.workspaceId === workspaceId);

  // Keep the store's copy in step with the address. It is a cache of the route,
  // so the route writes it and never reads it back.
  //
  // The ID travels too. Writing only the kind left the store unable to tell
  // two hotels apart, so `currentGrant` served the first hotel's permissions
  // on the second hotel's screens.
  useEffect(() => {
    if (grant && (state.ws !== grant.key || state.workspaceId !== workspaceId)) {
      dispatch({ type: "setWorkspace", ws: grant.key, workspaceId });
    }
  }, [grant, state.ws, state.workspaceId, workspaceId, dispatch]);

  /*
   * Record which workspace this session is acting in (Spec 0004, AC-3).
   *
   * From the ROUTE, which is why it lives here rather than in the provider. It
   * used to be `grants.find((w) => w.key === state.ws)`, a lookup by KIND: with
   * two hotels open in two tabs, both tabs wrote the first hotel's id, so the
   * server's record of "the workspace you were last in" named a workspace one
   * of them was not looking at. That record is what breaks the shim's tie
   * between two workspaces of the same kind (D-m), so it has to be the one on
   * screen.
   *
   * The server refuses a workspace the caller does not hold, which is the
   * control; this only asks.
   */
  useEffect(() => {
    if (!grant?.workspaceId) return;
    void setActiveWorkspace(grant.workspaceId);
  }, [grant?.workspaceId]);

  // `WorkspaceBoundary` above is already saying "Opening your workspace" and it
  // owns that wait; two messages would compete. This one is the SAME wait seen
  // from one layer down, so it renders nothing rather than a second screen.
  if (state.grantsStatus !== "resolved") return null;

  if (!grant) notFound();

  /*
   * One tick, while the effect above lands. Rendering the previous workspace's
   * shell for that tick is how a switch used to flash the wrong hotel — and,
   * between two hotels, how it read the wrong one's grant.
   *
   * Switching between two properties is the one case where this is VISIBLE: the
   * old shell has already gone, so a blank frame here reads as the app dropping
   * out. It says which workspace it is opening instead.
   */
  if (state.ws !== grant.key || state.workspaceId !== workspaceId) {
    return <Centered title={`Opening ${grant.propertyName ?? "your workspace"}`} />;
  }

  return <>{children}</>;
}
