import { WorkspaceAccess, workspaceLabel } from "@injishi/contracts";

/**
 * "Who am I, and what may I do" — the web client for `/api/v1/me/*` (Spec 0004).
 *
 * The API already resolves workspaces and permissions from real grants and
 * enforces them in `WorkspaceGuard`; nothing on the web app read them until now.
 * This is the read side of that: what the server says this person holds, never a
 * local guess. Anything built on the answer is an affordance — the guard is the
 * control — so this may inform a UI, and must never be the thing that protects
 * an action.
 *
 * `credentials: "include"` sends the Better Auth session cookie cross-origin
 * (web :3000 → api :8000), the same as `createBooking`.
 *
 * The response is validated with the contract's own `WorkspaceAccess` schema.
 * The endpoint also sends a `label`, but that is derived, and `workspaceLabel`
 * is exported from the same package — so the label is computed here from the
 * validated fields rather than trusted off the wire, and there is still exactly
 * one definition of it.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type LabelledWorkspace = WorkspaceAccess & { label: string };

export type WorkspacesOutcome =
  | { status: "ok"; workspaces: LabelledWorkspace[] }
  /** The session is missing or expired — the caller should re-gate on identity. */
  | { status: "unauthenticated" }
  /** API down, or a response that did not match the contract. Say nothing. */
  | { status: "unavailable" };

/**
 * Every workspace the caller actually holds. A person legitimately holds
 * several, so this is a list, and an empty list is a real answer — it means
 * "signed in, holds nothing yet", which is exactly the state someone about to
 * register their first business is in.
 */
export async function fetchMyWorkspaces(
  /**
   * A ceiling, for the callers that render behind this answer.
   *
   * `lib/session.ts` bounds every auth call it makes and says why: a request
   * that never settles leaves whatever gates on it pending forever, and this
   * one gates a control in the site header on every page. Aborting lands in the
   * `catch` below and reports `unavailable`, which is already the "say nothing"
   * branch — so a stall and a refused connection give the same definite answer.
   * Optional, because `register-wizard.tsx` calls this from an effect that has
   * its own cancellation and wants to wait.
   */
  signal?: AbortSignal,
): Promise<WorkspacesOutcome> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/me/workspaces`, {
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch {
    return { status: "unavailable" };
  }

  if (res.status === 401) return { status: "unauthenticated" };
  if (!res.ok) return { status: "unavailable" };

  const body = (await res.json().catch(() => null)) as
    | { workspaces?: unknown }
    | null;
  if (!body || !Array.isArray(body.workspaces)) return { status: "unavailable" };

  const parsed = WorkspaceAccess.array().safeParse(body.workspaces);
  // A contract drift is not something to render half of — treat it as
  // unavailable rather than showing a workspace list we cannot vouch for.
  if (!parsed.success) return { status: "unavailable" };

  return {
    status: "ok",
    workspaces: parsed.data.map((w) => ({ ...w, label: workspaceLabel(w) })),
  };
}
