"use client";

import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * The one place the web app reads the Better Auth session (F-S01).
 *
 * `MarketplaceIdentity`, `SessionIdentity` and the booking flow each used to
 * call `authClient.getSession()` and narrow the response themselves, which meant
 * three private views of the same fact and three different answers to "what if
 * the API is down".
 *
 * That last question is the reason this returns a status rather than
 * `User | null`. **Unreachable is not signed out.** Treating a network failure
 * as "anonymous" would push a guest who is already signed in back through the
 * sign-in gate — and on the booking flow, which keeps a demo capture path for
 * when the API is down, it would gate a step that does not even need a session
 * to complete. The two cases have to stay distinguishable at the call site.
 */
export interface SessionUser {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export type SessionStatus =
  /** Still asking. Render neither the signed-in nor the signed-out branch yet. */
  | "loading"
  /** A real session cookie resolved to a real user. */
  | "authenticated"
  /** The API answered, and there is no session. */
  | "anonymous"
  /** The API could not be reached. Says nothing either way about the session. */
  | "unreachable";

export interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
}

/**
 * How long to wait for the session before giving up on it.
 *
 * This is not a nicety. `authClient.getSession()` does not reliably settle when
 * the auth origin refuses the connection — it can stay pending indefinitely,
 * and anything gating render on the result then hangs forever rather than
 * failing. A session lookup is on the critical path of a page the visitor is
 * already looking at, so it gets a ceiling and a definite answer.
 */
const SESSION_TIMEOUT_MS = 6_000;

const TIMED_OUT = Symbol("session-timeout");

/**
 * Resolve the session once. Never throws and always settles — a transport
 * failure or a stall is reported as `unreachable`, which callers must not
 * confuse with `anonymous`.
 */
async function fetchSessionUser(): Promise<SessionState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      authClient.getSession(),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), SESSION_TIMEOUT_MS);
      }),
    ]);
    if (res === TIMED_OUT) return { status: "unreachable", user: null };

    const user = (res?.data as { user?: SessionUser } | null)?.user;
    return user?.id || user?.email
      ? { status: "authenticated", user }
      : { status: "anonymous", user: null };
  } catch {
    return { status: "unreachable", user: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Reactive form of {@link fetchSessionUser}, plus refresh and sign-out. */
export function useSessionUser(): SessionState & {
  refresh: () => Promise<SessionState>;
  /** Resolves `true` only when the server confirmed the sign-out. */
  signOut: () => Promise<boolean>;
} {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    user: null,
  });

  const refresh = useCallback(async () => {
    const next = await fetchSessionUser();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchSessionUser();
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Sign out, and say whether the SERVER agreed.
   *
   * Bounded like every other auth call here, and for the reason this file
   * already gives: a request with no ceiling under a button someone is watching
   * leaves that button waiting forever. `authClient.signOut()` had no ceiling,
   * so a stalled API left "Signing out…" on screen with nothing to retry.
   *
   * The boolean matters because of what a caller does next. Local state drops
   * to anonymous either way — the UI must stop claiming an identity it can no
   * longer prove — but only a CONFIRMED sign-out may tell the person they are
   * signed out. If the call stalled, the session cookie may well be alive, and
   * "You're signed out. See you soon." would be a lie the next page disproves.
   */
  const signOut = useCallback(async (): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let confirmed = false;
    try {
      const res = await Promise.race([
        authClient.signOut().then(() => true as const),
        new Promise<typeof TIMED_OUT>((resolve) => {
          timer = setTimeout(() => resolve(TIMED_OUT), SESSION_TIMEOUT_MS);
        }),
      ]);
      confirmed = res === true;
    } catch {
      confirmed = false;
    } finally {
      if (timer) clearTimeout(timer);
    }
    setState({ status: "anonymous", user: null });
    return confirmed;
  }, []);

  return { ...state, refresh, signOut };
}

/** Display name for a session user, falling back to the email's local part. */
export function sessionDisplayName(user: SessionUser | null): string {
  if (!user) return "";
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim() ?? "";
  return email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
}
