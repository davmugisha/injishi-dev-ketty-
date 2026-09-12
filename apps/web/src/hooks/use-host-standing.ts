"use client";

import { useEffect, useState } from "react";
import { isOperational } from "@injishi/contracts";

import { fetchMyWorkspaces, type LabelledWorkspace } from "@/data/me";

/**
 * What the header's one host-side action should say, and where it should go.
 *
 * THE CONTROL IS NOT KEYED ON THE SESSION, and that is the whole design.
 * "Signed in" says nothing about whether somebody hosts: most signed-in people
 * on the marketplace are guests, and swapping the CTA the moment a session
 * resolves would tell every guest they run a business. What decides it is what
 * `GET /api/v1/me/workspaces` says they actually HOLD — the same grant the API
 * refuses from, carrying `registrationStatus` on the wire precisely so a client
 * can render the pipeline (see `WorkspaceAccess` in `@injishi/contracts`).
 *
 * Three standings, and the middle one is the reason this exists at all:
 *
 *  - `prospect` — no business workspace, or no session, or no API. The CTA is
 *    unchanged, because /host is the right page for all three.
 *  - `registering` — a business workspace that is not `active`. Showing this
 *    person "List Accommodation" invites them to start over on a registration
 *    they have already paid a fee for. `register-wizard.tsx` already detects an
 *    in-flight org and opens on its resume phase, so /register is a real
 *    destination and not a new screen.
 *  - `hosting` — an `active` business workspace. They are an operator, so the
 *    slot becomes wayfinding into the operator app rather than a pitch.
 *
 * ONE REQUEST, NOT TWO. This deliberately does not call `useSessionUser`:
 * `fetchMyWorkspaces` already reports `unauthenticated` on a 401, which answers
 * the session question for this control's purposes. A second `getSession()`
 * beside `AccountMenu`'s would be two round trips to learn one thing.
 *
 * WHY THIS RESOLVES OPTIMISTICALLY AND `AccountMenu` DOES NOT. That component
 * renders a placeholder rather than its signed-out branch while the answer is
 * in flight, and says why: a wrong answer that corrects itself is worse than a
 * placeholder. The asymmetry is real and worth stating, because the two sit
 * side by side in the same bar and a reader will otherwise "fix" one to match
 * the other. "Sign In" shown to a signed-in person is a FALSE CLAIM ABOUT THEM.
 * "List Accommodation" claims nothing about anybody: it is the right invitation
 * for every visitor who is not already a host, which includes every visitor
 * whose answer has not arrived yet. Holding it back costs the marketplace's
 * primary call to action — above the fold, absent from the server-rendered
 * HTML, replaced by a pulsing rectangle — on every cold load, to spare existing
 * hosts one relabel. So `prospect` renders immediately and the two host
 * standings arrive late.
 *
 * ONE RELABEL PER PAGE LOAD, NOT PER NAVIGATION. The answer is memoised at
 * module scope, so the header — which lives in a layout and is not remounted by
 * client-side navigation — asks once. A `prospect` cached from a transient
 * failure lives only as long as the tab's current document, and signing in or
 * out is a full page load, so there is nothing to invalidate by hand.
 *
 * This is an AFFORDANCE. `WorkspaceGuard` is the control, and a person holding
 * a non-`active` org has an empty permission set whatever this renders.
 */
export type HostStanding =
  | { state: "prospect" }
  | { state: "registering"; workspace: LabelledWorkspace }
  | { state: "hosting"; workspace: LabelledWorkspace };

const PROSPECT: HostStanding = { state: "prospect" };

/** How long to wait before settling on `prospect` anyway. */
const WORKSPACES_TIMEOUT_MS = 6_000;

/**
 * Pick the workspace the CTA should speak for.
 *
 * ACTIVE WINS over in-flight. A person can hold both — an operator registering
 * a second hotel is the ordinary case — and for them the header's job is to get
 * them back into the business that already runs. The pipeline for the new one
 * is legible from inside the operator app, which is where they are going.
 */
function standingFrom(workspaces: LabelledWorkspace[]): HostStanding {
  const businesses = workspaces.filter(
    (w) => w.kind === "business" && w.orgId !== null,
  );

  const active = businesses.find((w) => isOperational(w.registrationStatus));
  if (active) return { state: "hosting", workspace: active };

  const inFlight = businesses.find((w) => w.registrationStatus !== null);
  if (inFlight) return { state: "registering", workspace: inFlight };

  return PROSPECT;
}

/** Asked once per document, shared by every mount. */
let pending: Promise<HostStanding> | null = null;

function loadStanding(): Promise<HostStanding> {
  pending ??= fetchMyWorkspaces(AbortSignal.timeout(WORKSPACES_TIMEOUT_MS)).then(
    (outcome) =>
      // `unauthenticated` and `unavailable` are different facts, and the
      // difference does not reach this control: both mean "we cannot say this
      // person hosts", and the prospect CTA is the only one that helps either.
      outcome.status === "ok" ? standingFrom(outcome.workspaces) : PROSPECT,
  );
  return pending;
}

/** Never null: `prospect` until the server says otherwise. */
export function useHostStanding(): HostStanding {
  const [standing, setStanding] = useState<HostStanding>(PROSPECT);

  useEffect(() => {
    let cancelled = false;
    void loadStanding().then((next) => {
      if (!cancelled) setStanding(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return standing;
}
