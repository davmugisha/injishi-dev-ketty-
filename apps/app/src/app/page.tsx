"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Centered } from "@/pms/components/workspace-boundary";
import { preferredWorkspaceId, workspaceHome } from "@/pms/lib/nav";
import { usePms } from "@/pms/store";

/**
 * Where the operator lands (F-S01, Spec 0004, ADR-018).
 *
 * This route used to be one line — `redirect("/host/today")` — which is why a
 * landlord signing in got a hotel front desk. The workspace a person holds was
 * never consulted, because at that point nothing had asked the API who they
 * were.
 *
 * It asks now, and it names a WORKSPACE rather than a kind. `preferredWorkspace`
 * could only ever answer "a host", which is no answer at all to somebody
 * running three hotels; `preferredWorkspaceId` answers with the one they were
 * last working in (D-m).
 *
 * `WorkspaceBoundary` above has already settled the four states, so by the time
 * this renders with grants there is a real answer, and the only job left is to
 * name the door.
 *
 * `replace` rather than `push`, so Back leaves the app instead of bouncing off
 * this resolver forever.
 */
export default function Page() {
  const router = useRouter();
  const { state } = usePms();
  const { grants, grantsStatus, activeWorkspaceId } = state;
  /** Resolved, holding grants, and still no door to open. */
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    // Only a RESOLVED answer names a door. `loading` has not answered yet, and
    // `anonymous` and `unreachable` are both being sent to sign-in by
    // `WorkspaceBoundary` — opening a workspace underneath that redirect is how
    // the demo fixtures used to get on screen without a session.
    if (grantsStatus !== "resolved") return;

    // Signed in and holding nothing. There is no door to open, and
    // `WorkspaceBoundary` is already saying so — stay put.
    if (!grants || grants.length === 0) return;

    const workspaceId = preferredWorkspaceId(grants, activeWorkspaceId);
    // Grants that name no workspace we can open. `WorkspaceBoundary` has
    // nothing to say about it — it sees a non-empty list — so this used to sit
    // on a blank page for ever, which is the one outcome a person cannot act
    // on. The refusal below is the same one they would get holding nothing.
    if (!workspaceId) {
      setStuck(true);
      return;
    }

    const grant = grants.find((g) => g.workspaceId === workspaceId);
    if (!grant) {
      setStuck(true);
      return;
    }
    router.replace(workspaceHome(grant.key, workspaceId));
  }, [grants, grantsStatus, activeWorkspaceId, router]);

  if (stuck) {
    return (
      <Centered
        title="We can't work out which workspace to open"
        body="Your account holds a workspace we can't open from here. Sign out and back in, and if it keeps happening the business owner can check your access."
        showSignOut
      />
    );
  }

  /*
   * NOT BLANK WHILE IT RESOLVES.
   *
   * This route is a redirect that has to ask the API first, so there is a real
   * wait here — and it used to be a white screen. An operator opening the app
   * on a slow property connection watched nothing at all, which is
   * indistinguishable from a broken app.
   */
  return <Centered title="Opening your workspace" />;
}
