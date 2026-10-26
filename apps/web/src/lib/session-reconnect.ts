import type { SessionStatus } from "./session";

/**
 * What a session-gated screen does while the API is not answering.
 *
 * `unreachable` used to be a dead end. The register gate asked once, waited six
 * seconds, and put "Check your connection and try again" in front of a visitor
 * whose connection was fine: the API was restarting. A restart is the common
 * case, not the rare one. `api:dev` respawns on a file change and is gone for
 * about thirty seconds, and while a deployed API restarts, the gateway in front
 * of it answers a CORS-less `404 page not found` that the browser reports as a
 * network failure. `retryWhileFailed` in `lib/api.ts` already heals a READ that
 * way; this is the same idea for the session lookup a gate waits on, with a
 * longer reach because a person is watching the screen rather than a widget.
 *
 * Kept pure, with no React and no browser globals, so the schedule and the
 * choice of screen are tested directly (tests/session-reconnect.test.mjs).
 */

/**
 * Gaps between session lookups after the one that failed. The gaps alone add up
 * to 41 s, which is what the run lasts when every lookup is refused at once (a
 * gateway 404, ECONNREFUSED): past a dev restart, measured at about 30 s. Each
 * lookup may also wait out `SESSION_TIMEOUT_MS` (6 s), so a run of hanging
 * lookups admits the outage after about 77 s rather than hiding it behind a
 * spinner. tests/session-reconnect.test.mjs holds both ends.
 */
export const RECONNECT_DELAYS_MS: readonly number[] = [2_000, 4_000, 8_000, 12_000, 15_000];

/** The gap before the next lookup, or `null` once the schedule is spent. */
export function nextReconnectDelay(failedRetries: number): number | null {
  return failedRetries >= 0 && failedRetries < RECONNECT_DELAYS_MS.length
    ? RECONNECT_DELAYS_MS[failedRetries]
    : null;
}

type GateView =
  /** The first lookup has not settled. */
  | "checking"
  /** The API has not answered yet, and we are still asking. Nothing to press. */
  | "reconnecting"
  /** The browser itself says it has no network. Only here is it their side. */
  | "offline"
  /** We stopped asking. The API is down, and the screen says so. */
  | "down"
  | "anonymous"
  | "authenticated";

/**
 * Which screen to show. `online` is `navigator.onLine`: when it is false the
 * failure is the visitor's network and saying so helps them; when it is true
 * nothing tells us whose side failed, so the copy must not guess theirs.
 */
export function gateView(
  status: SessionStatus,
  failedRetries: number,
  online: boolean,
): GateView {
  if (status !== "unreachable") return status === "loading" ? "checking" : status;
  if (!online) return "offline";
  return nextReconnectDelay(failedRetries) === null ? "down" : "reconnecting";
}
