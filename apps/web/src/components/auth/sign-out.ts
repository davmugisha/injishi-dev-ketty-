"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Signing out, in one place, because four controls do it.
 *
 * The sidebar's "Sign out" was an `<a href="/sign-in">` — it signed nobody out,
 * it walked you to a screen that would have let you straight back in with the
 * session you still held. The two header menus did it properly, the account
 * screen did it without leaving the page, and none of the three said anything
 * about it afterwards: you pressed, and the page you were on stayed exactly as
 * it was until it did not.
 *
 * So there is ONE landing url carrying a flag the marketplace header reads on
 * arrival (`SignedOutNotice` in `components/layout/account-menu.tsx`), and one
 * hook holding the pending state. It lives in its own module so the sidebar can
 * reuse it without importing the header's dropdown.
 */
const SIGNED_OUT_FLAG = "signed-out";

/** Where every sign-out lands, and the flag that makes the landing say so. */
export const SIGNED_OUT_LANDING = `/?${SIGNED_OUT_FLAG}=1`;

/** Read once, on arrival: `true` when this page load followed a sign-out. */
export function takeSignedOutFlag(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get(SIGNED_OUT_FLAG) !== "1") return false;
  // Stripped as it is read, so a reload — or a shared link — does not announce
  // a sign-out that happened ten minutes ago to somebody else.
  url.searchParams.delete(SIGNED_OUT_FLAG);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
  return true;
}

/**
 * The pending half of a sign-out.
 *
 * Takes the `signOut` off an existing `useSessionUser()` rather than calling the
 * hook again: every call is its own session lookup, and asking the API who you
 * are in order to stop being you is one request too many.
 *
 * The navigation is a full document load, not a client transition — the session
 * cookie has just stopped existing and every server component that read it has
 * to be asked again.
 */
export function useSignOutAndLeave(signOut: () => Promise<boolean>): {
  signingOut: boolean;
  signOutAndLeave: () => void;
} {
  const [signingOut, setSigningOut] = useState(false);
  const running = useRef(false);

  const signOutAndLeave = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setSigningOut(true);
    // The flag travels only on a CONFIRMED sign-out. If the call stalled, the
    // session may still be alive, so the landing page must not greet them with
    // "You're signed out" — it would be a claim the very next request disproves.
    void signOut().then((confirmed) =>
      window.location.assign(confirmed ? SIGNED_OUT_LANDING : "/"),
    );
  }, [signOut]);

  return { signingOut, signOutAndLeave };
}
