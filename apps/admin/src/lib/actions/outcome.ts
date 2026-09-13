import {
  STAFF_PERMISSION_LABEL,
  type StaffPermission,
} from "@injishi/contracts";
import type { ToastTone } from "@injishi/ui";

import type { ApiWriteFailure, ApiWriteResult } from "@/lib/api/server";

/**
 * What a console write reports back to the button that asked for it.
 *
 * WHY THIS FILE EXISTS. Every write button in this console used to toast a
 * success it had written itself — "All sessions revoked", "TIN re-check
 * queued" — while no write route existed. `notBuilt` replaced those with an
 * admission. This replaces the admission, for the writes that now exist, with
 * the platform's actual answer, and it is the ONE place that answer is turned
 * into words, so no button can drift back into claiming what it did not see.
 *
 * The rule every sentence below keeps: success is only ever worded from a
 * response the API returned and this console parsed. Every other outcome says
 * what the staffer can rely on — and never that the change happened.
 *
 * NOT a `"use server"` module. Those may export only async functions, and this
 * holds the plain helpers the action files share. The client imports it for its
 * types alone.
 */

/** Refused before sending: the reason or the id did not meet the contract. */
export type WriteFailure = ApiWriteFailure | "bad_input";

export type WriteOutcome<T> =
  | { ok: true; data: T; message: string; tone: ToastTone }
  | { ok: false; reason: WriteFailure; message: string; tone: ToastTone };

/** How one write is worded. */
export interface WriteSpec<T> {
  /** The act, as a noun phrase that fits "Couldn't confirm ___". */
  what: string;
  /** The staff permission the route declares — named when it is refused. */
  permission: StaffPermission;
  /** The sentence for a confirmed success, from the parsed response. */
  success: (data: T) => string;
  /**
   * The tone of a confirmed success, when the write landed but its news is
   * not good: a TIN re-check RRA never answered is recorded, not resolved.
   */
  successTone?: (data: T) => ToastTone;
  /**
   * Words for a 409 or 422 that is a BUSINESS RULE rather than a contract bug,
   * given the API's own sentence when it sent one (`detail`). Return
   * `undefined` to fall back to the generic wording.
   *
   * Opt-in, because for most writes in this console a 422 can only mean the
   * console sent a malformed body. Training is the exception (ADR-049): "that
   * venue is retired", "a session has to end after it starts" and "that session
   * is cancelled" are refusals a staffer causes and can fix, and "a bug on our
   * side" would send them looking in the wrong place.
   */
  refusal?: (
    reason: "conflict" | "rejected" | "denied",
    detail: string | undefined,
  ) => string | undefined;
}

/**
 * What kind of news a failure is, for the toast's icon and dwell.
 *
 * `warning` is kept for the two outcomes where the write may have happened —
 * the platform went quiet, or answered in a shape we could not read — because
 * those are the ones a staffer must go and check. Every other failure is a
 * definite "nothing changed", which is `danger`.
 */
function failureTone(reason: WriteFailure): ToastTone {
  return reason === "unreachable" || reason === "invalid" ? "warning" : "danger";
}

/** Turn the platform's answer into the outcome a button toasts. */
export function outcomeOf<T>(
  result: ApiWriteResult<T>,
  spec: WriteSpec<T>,
): WriteOutcome<T> {
  if (result.ok) {
    return {
      ok: true,
      data: result.data,
      message: spec.success(result.data),
      tone: spec.successTone?.(result.data) ?? "success",
    };
  }
  const worded =
    (result.reason === "conflict" ||
      result.reason === "rejected" ||
      result.reason === "denied") &&
    spec.refusal
      ? spec.refusal(result.reason, result.detail)
      : undefined;
  return {
    ok: false,
    reason: result.reason,
    // The action's own wording first. Then a decision the platform explained (a
    // 409 overlap, a 422 past date, a 404 with a sentence) in its own words, plus
    // what did not happen. The generic wording stays for everything else.
    message:
      worded ??
      (result.message && (result.reason === "conflict" || result.reason === "rejected" || result.reason === "missing")
        ? `${result.message} Nothing changed.`
        : failureMessage(result.reason, spec)),
    tone: failureTone(result.reason),
  };
}

/**
 * The request never left: the reason was too short or too long, or the id was
 * not one. Said plainly, because the API would have answered 400 and the
 * console reads every unexplained non-2xx as the platform failing to answer.
 */
export function badInput<T>(spec: WriteSpec<T>): WriteOutcome<T> {
  return {
    ok: false,
    reason: "bad_input",
    message: `Nothing was sent: ${spec.what} needs a reason of 4 to 500 characters, written for the audit trail.`,
    tone: failureTone("bad_input"),
  };
}

function failureMessage<T>(reason: ApiWriteFailure, spec: WriteSpec<T>): string {
  switch (reason) {
    case "anonymous":
      return `Your session has ended, so ${spec.what} was not made. Sign in again to carry on.`;
    case "denied":
      // Names the missing power in the model's own words, so the staffer knows
      // exactly what to ask for rather than that "something" was refused.
      return `This account can't ${STAFF_PERMISSION_LABEL[spec.permission]}, so ${spec.what} was refused and nothing changed.`;
    case "step_up":
      return `Enter the code we emailed you first. Your access is intact, but ${spec.what} was not made until you do.`;
    case "missing":
      return `That record no longer exists, so ${spec.what} was not made.`;
    case "conflict":
      // A 409: the platform answered and refused the MOVE, not the person.
      // The record is not in a state that allows it — most often because
      // someone else changed it after this page loaded. Nothing changed.
      return `${spec.what[0].toUpperCase()}${spec.what.slice(1)} isn't possible from the record's current state, so nothing changed. It may have been changed since this page loaded — reload to see where it stands.`;
    case "rejected":
      // A 400/422 that got past the console's own checks: the two sides
      // disagree about the request's shape. Nothing changed, and it is ours.
      return `The platform turned down ${spec.what} as malformed, so nothing changed. That's a bug on our side, not something you did.`;
    case "unreachable":
      /*
       * The platform did not answer — refused, dead, or past the ceiling. A 409
       * no longer lands here (it is `conflict`, above), so this is now only the
       * genuinely unknown case. It still never claims the change happened, and
       * never promises it did not: a request that timed out may have landed
       * after the console stopped waiting.
       */
      return `Couldn't confirm ${spec.what}: the platform didn't answer. Don't assume it happened — reload to see where it stands.`;
    case "invalid":
      // A 2xx whose body would not parse: the write very likely happened.
      return `The platform answered, but this console couldn't read the reply, so ${spec.what} may well have gone through. Reload to check before trying again.`;
  }
}
