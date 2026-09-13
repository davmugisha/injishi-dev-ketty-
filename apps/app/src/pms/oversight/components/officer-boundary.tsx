"use client";

/**
 * What the console renders before it knows who is looking.
 *
 * The same four answers the operator app settles, for the same reason: merging
 * any two of them is the bug this component exists to prevent.
 *
 *   loading      Say nothing yet. Painting a district overview for the half
 *                second before the API answers is exactly the "it looks signed
 *                in" problem, just briefly.
 *   anonymous    The cookie is stale or forged. Back to web's sign in — the
 *                console stopped having one of its own in ADR-029.
 *   unreachable  We learned nothing, and that is not permission.
 *   resolved     Render. An EMPTY list means signed in and holding no
 *                assignment, which is a normal place to be and not an error.
 *
 * SECOND LINE, NOT THE FIRST. pms's `middleware.ts` verifies the session at the
 * edge, so none of these messages should be reachable by a signed out visitor.
 * It stays because a session can die DURING a visit, and because a boundary that
 * only holds while the gate in front of it holds is not one.
 *
 * IT IS NOT THE SECURITY BOUNDARY EITHER. `OversightGuard` on the API is, and it
 * refuses on the next request when an assignment is revoked mid session. Since
 * ADR-029 it is the ONLY one: the console no longer has a session of its own, so
 * "is this person an officer" is the whole question and "did this session come
 * through the officers' door" is a question nothing asks any more.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { ActionButton } from "../../components/ui";
import { useSignOut } from "../../data/sign-out";
import { signInUrl, twoFactorUrl } from "../../lib/sign-in-url";
import { OVERSIGHT_CONSOLE_NOT_BUILT_MESSAGE } from "@injishi/contracts";

import { fetchMyConsoles, type OfficerAccess } from "../data/me";
import type { OfficerKey } from "../data/types";

export function OfficerBoundary({
  requires,
  children,
}: {
  /** The console this route serves, or null on the resolver at the root. */
  requires: OfficerKey | null;
  children: ReactNode;
}) {
  const [access, setAccess] = useState<OfficerAccess>({
    status: "loading",
    consoles: [],
    grants: [],
    unbuiltConsoles: [],
    twoFactor: null,
  });

  /** Bumped by "Try again", which is the only thing that re-asks. */
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let live = true;
    setAsking(true);
    void fetchMyConsoles().then((next) => {
      if (!live) return;
      setAccess(next);
      setAsking(false);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // A dead cookie sends them to WEB's sign in, the same door every other pms
  // screen uses. This used to be the console's own screen, and the comment here
  // used to say a marketplace session must not open a queue that reviews the
  // marketplace. ADR-029 ended that: there is one session now, so sending them
  // anywhere else would mint a cookie this app cannot read.
  useEffect(() => {
    if (access.status === "anonymous") {
      window.location.replace(signInUrl(window.location.href));
    }
  }, [access.status]);

  // The emailed step-up before the console (F-S02); the API's OversightGuard
  // refuses every console route until it is satisfied.
  const factorOutstanding =
    access.status === "resolved" &&
    access.twoFactor !== null &&
    access.twoFactor.required &&
    !access.twoFactor.verified;
  useEffect(() => {
    if (!factorOutstanding) return;
    window.location.replace(twoFactorUrl(window.location.href));
  }, [factorOutstanding]);

  if (access.status === "loading" || access.status === "anonymous" || factorOutstanding) {
    return <Centered title="Opening your console" />;
  }

  /*
   * WE COULD NOT ASK, which is neither "you have no console" nor "you are
   * signed out". The screen says so and offers the only two things that help:
   * ask again, or leave the machine properly.
   */
  if (access.status === "unreachable") {
    return (
      <Centered
        title="We can't reach Injishi right now"
        body="You are still signed in — we simply couldn't ask what your assignment covers. Nothing has been lost."
        onRetry={retry}
        retrying={asking}
        showSignOut
      />
    );
  }

  /*
   * A POSTING WE RECORDED AND DID NOT BUILD (ADR-053, AC-G7).
   *
   * `tax_compliance_officer` is a real appointment: admin can enter an RRA tax
   * compliance posting, and recording it is right. The console for it does not
   * exist, and before this the holder was shown the "no console yet" screen below
   * — which says they hold no assignment, when they do. That reads as "your access
   * is broken" and sends somebody to support over a feature nobody has written.
   *
   * Checked BEFORE the empty case, because it is a more specific answer to the
   * same situation.
   */
  if (access.consoles.length === 0 && access.unbuiltConsoles.length > 0) {
    return (
      <Centered
        title="Console not built yet"
        body={OVERSIGHT_CONSOLE_NOT_BUILT_MESSAGE}
        showSignOut
      />
    );
  }

  if (access.consoles.length === 0) {
    return (
      <Centered
        title="No console yet"
        body={
          "You're signed in, but you don't hold a government oversight assignment " +
          "on this account. A console opens here once one is granted."
        }
        /* A DEAD END NEEDS BOTH WAYS OUT. This screen renders no shell, so
           without these an officer whose assignment was granted a minute ago
           had nothing to press but the browser reload, and somebody signed in
           on a shared machine had no way to sign out at all. */
        onRetry={retry}
        retrying={asking}
        showSignOut
      />
    );
  }

  // Holding an assignment for one console is not permission to open the other.
  // The API refuses either way; this is what stops the screen rendering first.
  if (requires !== null && !access.consoles.includes(requires)) {
    return (
      <Centered
        title="Not your console"
        body="Your assignment covers a different function. The console you do hold opens from the oversight home."
        showSignOut
      />
    );
  }

  return (
    <OfficerAccessContext.Provider value={access}>
      {children}
    </OfficerAccessContext.Provider>
  );
}

/**
 * The resolved grants, for the store that renders inside this gate (ADR-053).
 *
 * Published rather than fetched a second time. This component has ALREADY asked
 * `/api/v1/me/oversight` and refused every answer that is not a console, so by the
 * time children render the grant is known; asking again from the store would be a
 * second request for a fact already in hand, and a second chance for the two
 * copies to disagree about which seat is open.
 */
const OfficerAccessContext = createContext<OfficerAccess | null>(null);

/**
 * The grants this console was opened with.
 *
 * Null outside the gate, which callers must treat as "not known yet" rather than
 * as "no access": only `OfficerBoundary` decides the second one.
 */
export function useOfficerAccess(): OfficerAccess | null {
  return useContext(OfficerAccessContext);
}

/**
 * The one layout for every pre-console state, so they cannot drift apart.
 *
 * `onRetry` and `showSignOut` are off by default: most of these states are
 * transient and pass on their own. They are offered on the ones a person can
 * actually be STUCK in.
 */
function Centered({
  title,
  body,
  onRetry,
  retrying,
  showSignOut = false,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retrying?: boolean;
  showSignOut?: boolean;
}) {
  const { signOut, signingOut } = useSignOut();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div style={{ maxWidth: "38ch", textAlign: "center" }}>
        <p style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>{title}</p>
        {body ? (
          <p
            style={{
              marginTop: "10px",
              fontSize: "0.9rem",
              lineHeight: 1.55,
              opacity: 0.72,
            }}
          >
            {body}
          </p>
        ) : null}
        {(onRetry || showSignOut) && (
          <div style={{ marginTop: "18px", display: "flex", justifyContent: "center", gap: "10px" }}>
            {onRetry && (
              <ActionButton variant="primary" onClick={onRetry} pending={retrying}>
                {retrying ? "Trying again" : "Try again"}
              </ActionButton>
            )}
            {showSignOut && (
              <ActionButton onClick={signOut} pending={signingOut}>
                {signingOut ? "Signing out" : "Sign out"}
              </ActionButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
