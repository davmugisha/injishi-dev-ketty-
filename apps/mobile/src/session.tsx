/**
 * Session — the real one.
 *
 * ADR-038 child 0 replaced the stub this file used to be. It held a flag in the
 * keychain standing exactly where the credential would go; the credential is
 * now there, owned by `src/lib/auth.ts`, and this file holds only the question
 * a screen actually asks: is somebody signed in?
 *
 * **Three states, not two, and that has not changed.** `loading` is what the
 * splash covers. Merging it into `anonymous` is the bug the web
 * `WorkspaceBoundary` exists to prevent: a session that has not resolved yet is
 * not a signed-out visitor, and treating it as one bounces a signed-in person
 * to sign in on every cold start.
 *
 * **What a stored token proves, and what it does not** (AC-S2). Its presence is
 * enough to open the shell, because the alternative is showing sign in to
 * somebody who is signed in, every launch, while a round trip completes. It is
 * NOT enough to render rows: the server may have dropped the session since.
 * So the shell opens optimistically and the first `/me/workspaces` call is what
 * confirms it — a 401 there clears the token and lands on sign in. Nothing
 * populated renders in between, because every workspace scoped query is gated
 * on the workspace having resolved, and it never does if that call fails.
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setUnauthenticatedHandler } from './lib/api';
import { currentToken, readStoredToken, signOut as signOutRequest } from './lib/auth';
import { clearPersonState } from './lib/device-reset';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';
export type ResolvedSession = Exclude<SessionStatus, 'loading'>;

/**
 * Why the last session ended, said once on the sign-in screen (mobile audit
 * SA-34). A person dropped on sign in with no sentence cannot tell an expired
 * session from a bug, and one who signed out with no signal does not know the
 * server may still hold the session.
 *
 *   revoked  the server answered 401: the session ended elsewhere or expired
 *   offline  signed out on this phone, but the server could not be told
 *
 * Module state rather than context: it has to survive the tree flipping to
 * anonymous, and it is read exactly once.
 */
export type SignOutReason = 'revoked' | 'offline';
let lastSignOutReason: SignOutReason | null = null;

/** The reason the last session ended, once; null after it has been read. */
export function consumeSignOutReason(): SignOutReason | null {
  const reason = lastSignOutReason;
  lastSignOutReason = null;
  return reason;
}

/**
 * Resolved during bootstrap, before the shell paints.
 *
 * A token in the keychain reads as `authenticated`. The two arms that cannot
 * answer — web, which has no keychain, and a read that throws — return
 * `anonymous`, because an unreadable session is one nobody proved and the cost
 * of getting it wrong is one sign-in rather than an unauthenticated shell.
 */
export async function readStoredSession(): Promise<ResolvedSession> {
  const token = await readStoredToken();
  return token ? 'authenticated' : 'anonymous';
}

export interface SessionState {
  status: SessionStatus;
  /**
   * Mark the session signed in.
   *
   * Called by `(auth)/verify-otp` AFTER `verifySignInCode()` has stored a
   * token. It does not sign anybody in itself: the token is what does that, and
   * this only tells the tree the token is there. With no token it refuses and
   * returns false: the old fixture activate screen called it bare and opened the
   * shell with no credential at all (mobile audit SA-20).
   */
  signIn: () => boolean;
  /**
   * Sign out, locally for certain and on the server if it can be reached.
   *
   * Resolves once the local clear is done, which is always, so a caller can
   * navigate on it. See `lib/auth.ts` for why the server's answer is not waited
   * on beyond a short timeout.
   */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({
  initial,
  children,
}: {
  initial: ResolvedSession;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<SessionStatus>(initial);
  const queryClient = useQueryClient();

  const signIn = useCallback(() => {
    if (!currentToken()) return false;
    lastSignOutReason = null;
    setStatus('authenticated');
    return true;
  }, []);

  const signOut = useCallback(async () => {
    // Local state first, so the tree stops rendering signed-in surfaces while
    // the best-effort server call is still in flight.
    setStatus('anonymous');
    queryClient.clear();
    clearPersonState();
    const { serverConfirmed } = await signOutRequest();
    lastSignOutReason = serverConfirmed ? null : 'offline';
  }, [queryClient]);

  /**
   * A 401 from anywhere ends the session, once.
   *
   * `api.ts` has already cleared the token and de-duplicated the burst by the
   * time this runs; what is left is the part only React can do — drop every
   * cached row and flip the tree to anonymous. Clearing the cache matters as
   * much as the flag: without it the next person to sign in on this phone would
   * briefly see the previous one's rows.
   */
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      lastSignOutReason = 'revoked';
      setStatus('anonymous');
      queryClient.clear();
      clearPersonState();
    });
    return () => setUnauthenticatedHandler(null);
  }, [queryClient]);

  const value = useMemo<SessionState>(
    () => ({ status, signOut, signIn }),
    [status, signOut, signIn],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}

/**
 * The session, or `null` when there is no provider above.
 *
 * The twin of `useOptionalWorkspace()` in `workspace.tsx`, and it exists for
 * the same reason: a hook that may be reached from OUTSIDE the signed-in shell
 * must be able to say "nobody has resolved a session here" rather than crash.
 *
 * `useMyIdentity()` is the caller. It gates `GET /api/v1/me/profile` on the
 * session being authenticated, and it is used by a component (the account
 * identity card) that a screen test renders on its own, with no provider stack
 * around it. The throwing form would turn every one of those tests into a
 * crash, and — worse in the app — would make the hook unusable anywhere a
 * signed-out person can stand, where firing a `/me/` call would earn a 401 and
 * trip the sign-out path on somebody who was merely on the sign-in screen.
 */
export function useOptionalSession(): SessionState | null {
  return useContext(SessionContext);
}
