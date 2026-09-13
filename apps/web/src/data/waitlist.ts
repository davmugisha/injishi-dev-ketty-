import type {
  WaitlistSignupInput,
  WaitlistSignupResult,
} from "@injishi/contracts";

import { apiFetch } from "@/lib/api";

/**
 * The waitlist's only client (ADR-048).
 *
 * Bounded the way every call from this app is bounded, by going through
 * `apiFetch`: a request with no ceiling under a button somebody is watching
 * leaves that button spinning forever instead of failing. On a launch page
 * that is the difference between a signup and a closed tab.
 *
 * The outcomes below are named after what the PERSON experiences, not after
 * HTTP. "Already on the list" is a success as far as the visitor is concerned,
 * and the screen says so in ADR-048's words; collapsing it into an error would
 * tell somebody who did everything right that they did something wrong.
 */

export type WaitlistJoinOutcome =
  /** The row was written, and a welcome email is on its way. */
  | { status: "joined" }
  /** This address was already stored. No second row, no second email. */
  | { status: "already-joined" }
  /** Too many attempts from this client or for this mailbox within the hour. */
  | { status: "throttled" }
  /** The server refused the body, with a sentence meant for a person. */
  | { status: "refused"; message: string }
  /** Unreachable, timed out, or an answer we could not read. */
  | { status: "failed" };

export async function joinWaitlist(
  input: WaitlistSignupInput,
): Promise<WaitlistJoinOutcome> {
  const res = await apiFetch<WaitlistSignupResult>("/api/v1/waitlist/signups", {
    method: "POST",
    body: input,
  });

  switch (res.status) {
    case "ok":
      return res.data.alreadyJoined
        ? { status: "already-joined" }
        : { status: "joined" };
    case "refused":
      // 429 gets its own branch because it is the one refusal with copy of its
      // own (ADR-048 copy.md §3) and the one the visitor can act on: wait.
      return res.httpStatus === 429
        ? { status: "throttled" }
        : { status: "refused", message: res.message };
    // `unauthenticated` cannot happen on a public write, but the union is
    // exhaustive and a silent fallthrough here would render nothing at all.
    case "unauthenticated":
    case "failed":
      return { status: "failed" };
  }
}

/**
 * Leave the list.
 *
 * There is deliberately no failure branch the page renders differently. A
 * known token, an unknown one and one already spent all reach the same
 * confirmation, because any difference between them tells whoever opened the
 * link whether that address is on the list (AC-12). A transport failure is the
 * only thing worth retrying, and it is reported as `false` so the button can
 * say so rather than claim a removal that did not happen.
 */
export async function leaveWaitlist(token: string): Promise<boolean> {
  const res = await apiFetch<{ ok: true }>(
    `/api/v1/waitlist/unsubscribe/${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  return res.status === "ok";
}
