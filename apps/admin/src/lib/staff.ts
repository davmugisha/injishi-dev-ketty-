import {
  NO_STAFF_ACCESS,
  staffStepUpOwed,
  type StaffAccess,
} from "@injishi/contracts";
import { cache } from "react";

import { getStaffAccess } from "@/lib/api/me";

/**
 * Who is looking at the admin console, and whether they may (F-S01, ADR-012).
 *
 * This used to be a React hook: the console painted, then asked the browser's
 * `fetch` whether the person watching it was allowed to see what they were
 * already seeing. That is now a SERVER read (`lib/api/me.ts` through
 * `lib/api/server.ts`), for the reason ADR-029 gives — a sidebar listing
 * Finance and Compliance is itself a disclosure, and a client-side gate
 * necessarily paints something before it can refuse.
 *
 * WHAT MOVED WITH IT, and must not be lost: the status is FOUR-VALUED. Merging
 * any two of these produces a wrong sentence, and two of the wrong sentences
 * are loops.
 *
 *   anonymous    401. The cookie the middleware saw does not resolve to a live
 *                session. The one state that means "sign in".
 *   denied       Answered, and this account is not staff. NOT a sign-in
 *                problem — sending them to sign in bounces them straight back
 *                into the console, which bounces them out again.
 *   staff        Answered, and they may be here.
 *   unreachable  We could not ask. Says nothing either way about their access,
 *                so it must never be rendered as a refusal — and must never
 *                redirect, or a staffer is signed out because the API blinked.
 *
 * The old fifth value, `loading`, is gone with the hook. A server component has
 * the answer before it renders anything, so there is no state in which the
 * console is painted and the question is still open. That absence is the whole
 * point of the move.
 */
/**
 * `step_up` is the fifth: signed in, staff, and asked for the emailed code
 * (F-S02) before the console will open. It is its own state because both
 * neighbours are wrong for it — `denied` would tell a staffer who holds the
 * power that they do not, and `anonymous` would send someone already signed in
 * back to a sign-in screen they have passed.
 *
 * It is decided BEFORE the console renders, from `/me/staff` itself: that route
 * reports `twoFactor` beside the grant, and `staffStepUpOwed` reads it with the
 * same rule `StaffGuard` enforces. The route cannot answer with the guard's 403
 * — it sits behind `SessionGuard` alone so that it can say `isStaff: false` to a
 * non-staffer — so without that field the console would only learn a code was
 * owed when a page's read came back refused halfway through painting.
 */
export type StaffStatus = "anonymous" | "denied" | "staff" | "unreachable" | "step_up";

export interface StaffState {
  status: StaffStatus;
  access: StaffAccess;
}

/**
 * Ask the API once, on the server, as the caller. Never throws, always settles.
 *
 * `denied` arrives two ways and they are the same answer: a 403 from a guard,
 * and a 200 whose body says `isStaff: false`. `/api/v1/me/staff` answers with
 * the second, because it is reachable by design for a signed-in non-staffer;
 * the 403 branch is here so that a future guard change cannot silently turn a
 * refusal into "we could not ask".
 *
 * `invalid` — the API answered with something we could not parse — lands on
 * `unreachable` rather than on `denied`. Both are "no data", but only one of
 * them may be worded as a statement about this person, and a shape we cannot
 * vouch for says nothing about them at all.
 *
 * MEMOISED FOR THE REQUEST, and that is what makes a second gate free.
 *
 * Two server components ask this question while one page renders:
 * `StaffBoundary` asks whether the caller is staff at all, and
 * `SectionBoundary` asks whether they hold this section (ADR-049 AC-25).
 * Without `cache` that is two round trips to `/me/staff` on every console
 * navigation, and worse, two answers — an API that blinks between them would
 * have the console refuse a section it had just admitted the person to.
 *
 * `cache` is per render pass, so nothing is held between requests and no
 * staffer ever reads another's answer.
 */
export const readStaffAccess = cache(async function readStaffAccess(): Promise<StaffState> {
  const result = await getStaffAccess();

  if (!result.ok) {
    switch (result.reason) {
      case "anonymous":
        return { status: "anonymous", access: NO_STAFF_ACCESS };
      case "denied":
        return { status: "denied", access: NO_STAFF_ACCESS };
      case "step_up":
        return { status: "step_up", access: NO_STAFF_ACCESS };
      case "unreachable":
      case "invalid":
      // `missing` on THIS route is not a mistyped id — `/me/staff` takes no
      // parameter. It means the endpoint itself is not there: an API too old
      // to serve it, or a proxy swallowing the path. That is the platform
      // failing to answer, so it reads as `unreachable` rather than as a
      // statement about this account. Detail screens, which can genuinely be
      // asked for a record that does not exist, word it as its own state.
      case "missing":
        return { status: "unreachable", access: NO_STAFF_ACCESS };
    }
  }

  // Staff, but this session has not presented the emailed code. Checked before
  // the `staff` answer below, or the console would render and every read on it
  // would then be refused. `staffStepUpOwed` is false for a non-staffer, so a
  // person who is not staff is still told so rather than asked for a code; and
  // it is false when an older API omits `twoFactor`, because an API that does
  // not report the step-up is not enforcing it either — and if it were, a
  // page's read would still come back `step_up` from the 403 branch above.
  if (staffStepUpOwed(result.data)) {
    return { status: "step_up", access: result.data };
  }

  // `isStaff` is read rather than inferred from `roles.length`, because the
  // contract carries it explicitly so that "asked, and you are not staff" stays
  // distinguishable from "asked, and you hold no role yet" without counting
  // rows to guess which.
  return {
    status: result.data.isStaff ? "staff" : "denied",
    access: result.data,
  };
});
