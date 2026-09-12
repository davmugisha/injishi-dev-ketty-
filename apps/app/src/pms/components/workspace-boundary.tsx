"use client";

import { signInUrl, twoFactorUrl } from "../lib/sign-in-url";

import { useEffect, useState } from "react";

import { useSignOut } from "../data/sign-out";
import { useMyWorkspaces } from "../data/queries";
import { fetchMyConsoles } from "../oversight/data/me";
import { usePms } from "../store";
import { ActionButton } from "./ui";

/**
 * What the operator app renders before it knows who is looking (F-S01).
 *
 * Mounted once, around every route, because the alternative is each screen
 * deciding for itself and the demo fixtures leaking through whichever one
 * forgets. `middleware.ts` guarantees a session COOKIE reached us; this is
 * where we find out whether it stands for anything.
 *
 * The four answers are deliberately four, and merging any two of them is the
 * bug this component exists to prevent:
 *
 *   loading      Say nothing yet. Rendering the demo hotel for the half second
 *                before the API answers is exactly the "it looks signed in"
 *                problem, just briefly.
 *   anonymous    The cookie is stale or forged. Back to sign-in.
 *   unreachable  We learned nothing, and that is not permission. It renders NO
 *                app — an unreachable API once painted the whole demo operator
 *                surface for a signed-out visitor, fixtures they could not tell
 *                from real rows — and it is not read as signed out either: the
 *                person is almost certainly still signed in, so they get an
 *                owned screen and a retry rather than a bounce to a sign-in
 *                they could not complete while the API is down.
 *   resolved     Render the app. If the list is EMPTY, render the empty state
 *                rather than the app: this person is signed in and holds
 *                nothing, which is a normal place to be and not an error.
 *
 * SECOND LINE, NOT THE FIRST. `middleware.ts` now verifies the session at the
 * edge, so a stale cookie is refused before this component ever mounts, and none
 * of these messages should be reachable by a signed-out visitor any more. It
 * stays because a session can die DURING a visit, and because a boundary that
 * only holds while the gate in front of it holds is not a boundary.
 */
export function WorkspaceBoundary({ children }: { children: React.ReactNode }) {
  const { state } = usePms();
  const { grantsStatus, grants, twoFactor } = state;
  // The same query the store reads, so "try again" is one refetch rather than
  // a second client for the same answer. A full page reload would work too and
  // would throw away everything else the tab is holding.
  const workspacesQuery = useMyWorkspaces();
  const retry = () => void workspacesQuery.refetch();

  /**
   * The step-up stands before the app (F-S02). An operator whose session has
   * not presented an emailed code is sent to web's code screen and comes back
   * here afterwards. The API refuses every operator route in the meantime, so
   * this is the courteous door rather than the lock.
   */
  const factorOutstanding =
    grantsStatus === "resolved" &&
    twoFactor !== null &&
    twoFactor.required &&
    !twoFactor.verified;
  useEffect(() => {
    if (!factorOutstanding) return;
    window.location.replace(twoFactorUrl(window.location.href));
  }, [factorOutstanding]);
  const holdsNoWorkspace =
    grantsStatus === "resolved" && grants !== null && grants.length === 0;

  /**
   * Holding no workspace is not the same as holding nothing (ADR-029).
   *
   * pms serves government officers now, and an officer's authority is an
   * assignment against a district rather than a workspace row — so a pure
   * officer resolves to an EMPTY grants list and used to land on the dead end
   * below with no way out. `providers.tsx` already keeps this component off
   * `/oversight/*`, which makes the console reachable by URL; this makes it
   * reachable by ARRIVING, which is how anybody actually gets there.
   *
   * Asked only when the list is empty. An operator who holds a workspace never
   * pays for this round trip.
   */
  const [console_, setConsole] = useState<"unknown" | "none" | "has">("unknown");
  useEffect(() => {
    if (!holdsNoWorkspace) return;
    let live = true;
    void fetchMyConsoles().then((access) => {
      if (!live) return;
      // Only a resolved answer moves anybody. `unreachable` is not "no console",
      // and redirecting on it would bounce an officer out of a working app the
      // moment the API blinked.
      if (access.status === "resolved" && access.consoles.length > 0) {
        setConsole("has");
        window.location.replace("/oversight");
        return;
      }
      setConsole(access.status === "resolved" ? "none" : "unknown");
    });
    return () => {
      live = false;
    };
  }, [holdsNoWorkspace]);

  // A cookie that no longer resolves to a session. Nothing here is permission
  // to render an operator's day, and the sign-in screen is the whole message.
  useEffect(() => {
    if (grantsStatus === "anonymous") {
      window.location.replace(signInUrl(window.location.href));
    }
  }, [grantsStatus]);

  if (grantsStatus === "loading" || grantsStatus === "anonymous" || factorOutstanding) {
    return <Centered title="Opening your workspace" />;
  }

  /*
   * UNREACHABLE IS NOT SIGNED OUT, and it must not be answered as if it were.
   *
   * This branch used to fall into the redirect above, so a receptionist whose
   * hotel wifi blinked mid-shift was thrown out to the sign-in screen — where,
   * the API still being unreachable, they could not sign in either. They were
   * never signed out: the cookie is fine and the session is very likely fine.
   * The product rule is the one `me.ts` was built around, that a network
   * failure must never be read as "signed out" (AC-13).
   *
   * It still renders no app. Nothing behind this is known to be true, and the
   * demo fixtures must not appear because a request failed — that was the
   * other half of the original bug. So: an owned screen that says what we know,
   * and a way to ask again without losing the session.
   */
  if (grantsStatus === "unreachable") {
    return (
      <Centered
        title="We can't reach Injishi right now"
        body={
          "You are still signed in — we just couldn't load your workspace. " +
          "Nothing has been lost. Try again in a moment."
        }
        onRetry={retry}
        retrying={workspacesQuery.isFetching}
      />
    );
  }

  if (holdsNoWorkspace) {
    // Still asking whether they hold a console, or already leaving for one.
    // Painting the dead end first and correcting it a moment later is the
    // flicker this branch exists to avoid.
    if (console_ !== "none") return <Centered title="Opening your workspace" />;
    return (
      <Centered
        title="No workspace yet"
        body={
          "You're signed in, but you don't hold a workspace on this account. " +
          "If you've just registered a business, it opens here once it's approved."
        }
        /*
         * THE DEAD END NEEDS THE WAY OUT MOST (F-S01).
         *
         * This branch renders no shell, so the sign out in the sidebar is not
         * on screen — and this is the one state where a person is genuinely
         * stuck: signed in, holding nothing, with no nav, no workspace and
         * nothing to click. Before this button the only escape was clearing
         * cookies by hand, and the people who land here are new accounts and
         * owners waiting on approval, which is the worst possible audience for
         * that.
         */
        showSignOut
      />
    );
  }

  return <>{children}</>;
}

/**
 * The one layout for every pre-app state, so they cannot drift apart.
 *
 * Exported for `app/page.tsx`, the resolver that decides which workspace to
 * open: it waits on the same answer this boundary waits on, and a second
 * spelling of "Opening your workspace" would drift from this one.
 *
 * `showSignOut` is off by default on purpose. Most states here are transient —
 * "Opening your workspace" resolves in a moment — and offering to sign out of
 * a session that is still loading invites somebody to end it mid answer. Only
 * the dead end asks for it.
 */
export function Centered({
  title,
  body,
  showSignOut = false,
  onRetry,
  retrying,
}: {
  title: string;
  body?: string;
  showSignOut?: boolean;
  /** Offered where asking again is the actual way forward. */
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { signOut, signingOut } = useSignOut();
  return (
    <div
      style={{
        minHeight: "100dvh",
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
        {onRetry ? (
          <div style={{ marginTop: "18px" }}>
            <ActionButton variant="primary" onClick={onRetry} pending={retrying}>
              {retrying ? "Trying again" : "Try again"}
            </ActionButton>
          </div>
        ) : null}
        {showSignOut ? (
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            style={{
              marginTop: "18px",
              border: "1px solid var(--card-bd)",
              background: "var(--card)",
              color: "var(--foreground)",
              borderRadius: "var(--radius-surface)",
              padding: "9px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: signingOut ? "wait" : "pointer",
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
