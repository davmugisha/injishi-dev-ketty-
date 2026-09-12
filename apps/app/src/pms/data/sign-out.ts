"use client";

/**
 * The way out (F-S01).
 *
 * **There was no way out.** This app could sign a person in, gate them, refuse
 * them and step them up, and offered no control anywhere that ended the
 * session. `apps/web` has had one since it was built (`lib/session.ts`, the
 * account menu, the account screen); the operator app simply never grew one, so
 * an operator finishing a shift on a shared front desk machine had to close the
 * browser and hope.
 *
 * ONE Better Auth instance, so ONE `signOut`. It goes through
 * `makeAuthClient` from `@injishi/auth/client` — the same builder `apps/web`
 * uses — rather than a hand rolled `POST /api/auth/sign-out` here. A second
 * spelling of the same call is a second thing to keep in step with the server.
 *
 * WHY THE NAVIGATION IS A HARD ONE. `window.location.assign`, never
 * `router.push`. The session is gone, and everything this app is holding was
 * derived from it: the TanStack cache, the store's grants, the workspace in the
 * address bar. A client side navigation keeps all of that in memory, so the
 * next screen renders the departed person's workspaces for a moment before the
 * gate catches up. A document navigation throws it away, which is the only
 * honest thing to do with data that belonged to somebody who just left.
 *
 * WHY IT NAVIGATES EVEN WHEN THE CALL FAILS. If the API cannot be reached, the
 * cookie may well still be live — but the person asked to leave, and leaving
 * them on a screen full of their own data because the network blinked is the
 * wrong answer. The middleware verifies against the API on the next request, so
 * a session that survived is caught the moment anything is opened again.
 */

import { makeAuthClient } from "@injishi/auth/client";
import { useCallback, useState } from "react";

import { API_BASE } from "./api";
import { WEB_URL } from "../lib/sign-in-url";

const authClient = makeAuthClient(API_BASE);

export interface SignOut {
  signOut: () => void;
  /** True from the press until the document navigation replaces the page. */
  signingOut: boolean;
}

export function useSignOut(): SignOut {
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(() => {
    if (signingOut) return;
    setSigningOut(true);
    void (async () => {
      try {
        await authClient.signOut();
      } catch {
        // Best effort; the navigation below happens either way. See the header.
      }
      /*
       * Web's sign-in, with NO `?redirect=`.
       *
       * Every other bounce in this app carries a return url, because those are
       * interruptions: you were going somewhere and a gate stopped you. This is
       * not an interruption. Somebody said they were finished, and sending them
       * back to the screen they just left the moment they sign in again is the
       * opposite of what they asked for.
       */
      window.location.assign(new URL("/sign-in", WEB_URL).toString());
    })();
  }, [signingOut]);

  return { signOut, signingOut };
}
