"use client";

/**
 * Sign out for the restored oversight / PSF console.
 *
 * The new apps/app keeps the Better Auth session via server actions
 * (`signOut` in `@/lib/auth-actions`), which clears cookies and redirects to
 * `/sign-in`. This hook is the button-side wrapper those consoles already call.
 */

import { useCallback, useState, useTransition } from "react";

import { signOut as signOutSession } from "@/lib/auth-actions";

export interface SignOut {
  signOut: () => void;
  /** True from the press until the document navigation replaces the page. */
  signingOut: boolean;
}

export function useSignOut(): SignOut {
  const [signingOut, setSigningOut] = useState(false);
  const [, startTransition] = useTransition();

  const signOut = useCallback(() => {
    if (signingOut) return;
    setSigningOut(true);
    startTransition(() => {
      void signOutSession();
    });
  }, [signingOut, startTransition]);

  return { signOut, signingOut };
}
