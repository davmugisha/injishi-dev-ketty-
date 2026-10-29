import { preferredWorkspace } from "../lib/nav";
import { currentGrant, withToast } from "./helpers";
import type { Action, State } from "./types";

/**
 * Session, workspace and presentation.
 *
 * Returns null for an action it does not own, so `reducer` in ../store.tsx can
 * try each slice in turn. Behaviour is the original switch verbatim — the cases
 * moved, nothing about them changed.
 */
export function sessionReducer(s: State, a: Action): State | null {
  switch (a.type) {
    case "grantsResolved": {
      const { status, workspaces, activeWorkspaceId, twoFactor } = a.me;

      // `unreachable` leaves the demo defaults alone, so the app still runs
      // standalone and a network blip never looks like losing access. So does
      // `anonymous`: there is nothing to render either way, and the middleware
      // gate is what sends that person to sign in.
      if (status !== "resolved") {
        return { ...s, grantsStatus: status };
      }

      // Resolved and EMPTY is a real answer, and it must land here rather than
      // above. It means the person is signed in and holds nothing yet — a new
      // account, or an owner whose business is still in the registration
      // pipeline. Leaving the demo defaults standing for them is the bug this
      // whole change is about: it showed a stranger a working hotel.
      //
      // `grants: []` (not null) is what says "asked and answered, nothing
      // here", which is what `currentGrant` and the shell read.
      if (workspaces.length === 0) {
        return { ...s, grants: [], grantsStatus: status, activeWorkspaceId, twoFactor };
      }

      // Keep the workspace already in view if it is really held (a refetch
      // must not move an operator mid-task); otherwise open the one this app
      // ranks highest, NOT whichever the API listed first — personal is
      // granted to everyone and always sorts first on the wire.
      //
      // "Held" is answered by ID when the route has named one. Two hotels
      // share a kind, so a refetch that checked the kind kept the operator on
      // the right screen while quietly re-reading the wrong hotel's grant.
      const viewed = s.workspaceId
        ? workspaces.find((w) => w.workspaceId === s.workspaceId)
        : workspaces.find((w) => w.key === s.ws);
      const landing =
        viewed?.key ?? preferredWorkspace(workspaces.map((w) => w.key)) ?? s.ws;
      const grant = viewed ?? workspaces.find((w) => w.key === landing);
      return {
        ...s,
        grants: workspaces,
        grantsStatus: status,
        activeWorkspaceId,
        twoFactor,
        ws: landing,
        // A revoked id is no longer in view. The layout 404s it; the store
        // must not keep pointing at a grant that no longer exists.
        workspaceId: viewed ? s.workspaceId : null,
        // The role comes from the grant now, not from a picker.
        role: grant?.role ?? s.role,
      };
    }

    case "setWorkspace": {
      // Affordance, not the boundary: the API refuses this too (Spec 0004,
      // D-e). Refusing here keeps the app from rendering a workspace the
      // server will not serve.
      //
      // With an id the check is exact. Without one (the demo fixtures carry
      // none) it falls back to kind, which is all a fixture can be matched on.
      const workspaceId = a.workspaceId ?? null;
      const grant = s.grants
        ? workspaceId
          ? s.grants.find((w) => w.workspaceId === workspaceId)
          : s.grants.find((w) => w.key === a.ws)
        : undefined;
      if (s.grants && !grant) {
        return withToast(s, "That workspace is not available to you.", "bad");
      }
      // The grant's own kind wins over what the caller said: an id that names
      // a residence is a landlord workspace whatever the button was labelled.
      const ws = grant?.key ?? a.ws;
      return { ...s, ws, workspaceId, role: grant?.role ?? s.role };
    }

    case "setProperty":
      return { ...s, prop: a.prop };

    case "setRole": {
      // Once the API has answered, the role is a fact of the grant rather than
      // a costume. The picker stays for the demo defaults only.
      if (s.grants) {
        const grant = currentGrant(s);
        if (grant && grant.role !== a.role) {
          return withToast(s, "Your role here is set by your grant.", "bad");
        }
      }
      return { ...s, role: a.role };
    }

    case "platformResolved":
      // The API's answer, never a switch in the browser (ADR-043, AC-22).
      return { ...s, platform: a.platform };

    case "setTheme":
      return { ...s, theme: a.theme };

    case "toast":
      return withToast(s, a.txt, a.intent ?? "ok");

    case "dismissToast":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };


    default:
      return null;
  }
}
