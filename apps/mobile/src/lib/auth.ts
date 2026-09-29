/**
 * Sign in, the stored bearer token, the auth header, and sign out.
 *
 * ADR-038 child 0 replaces ADR-030's `Cookie` header with a bearer token minted
 * by Better Auth's `bearer()` plugin. The token is bound to the same session
 * Better Auth already manages, so lifetime, revocation and the OTP hashing at
 * rest are unchanged; only the transport differs.
 *
 * **The token is read from and written to `expo-secure-store` and nowhere
 * else** (AC-S3). It never reaches `AsyncStorage`, a log line, an error report
 * or a query key. `expo-secure-store` is the platform keychain on iOS and
 * EncryptedSharedPreferences on Android — the only encrypted option, and the
 * right one for an app carrying lease and payment surfaces.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { AUTH_BASE, REQUEST_TIMEOUT_MS } from './env';
import { logFailure } from './log';

/**
 * Web has no secure store, so nothing is persisted there.
 *
 * The same guard the rest of the app already uses (`session.tsx`,
 * `domain.tsx`). On web the token lives for the life of the tab and no longer,
 * which is the honest behaviour: there is no encrypted place to put it, and
 * `localStorage` is not one however convenient.
 */
const persistable = Platform.OS !== 'web';

const TOKEN_KEY = 'injishi.auth-token';

/**
 * The in-memory copy.
 *
 * `api.ts` attaches the header on every call and cannot await a keychain read
 * each time, so the token is held here once bootstrap has read it. The store is
 * the durable copy; this is the fast one, and they are written together.
 */
let cachedToken: string | null = null;

/** Read the stored token. Called once at bootstrap, before the first render. */
export async function readStoredToken(): Promise<string | null> {
  if (!persistable) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // A keychain that will not open is a signed out person, not a crash.
    cachedToken = null;
  }
  return cachedToken;
}

/** The token as `api.ts` needs it, with no await. */
export function currentToken(): string | null {
  return cachedToken;
}

async function writeStoredToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (!persistable) return;
  try {
    if (token === null) await SecureStore.deleteItemAsync(TOKEN_KEY);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Losing the durable copy costs a re-sign-in next launch, nothing more.
  }
}

/**
 * The auth header, or nothing.
 *
 * Returns an EMPTY object rather than `Authorization: Bearer null` when there
 * is no token. A malformed header is worse than an absent one: Better Auth's
 * bearer plugin would try to verify it, fail, and the call would be refused in
 * a way that reads like a bad token rather than no token.
 */
export function authHeaders(): Record<string, string> {
  return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
}

/** Clear the token. Used by sign out and by the 401 path in `api.ts`. */
export function clearToken(): Promise<void> {
  return writeStoredToken(null);
}

/** What a sign-in step can answer. Mirrors `ApiResult`'s vocabulary. */
export type AuthOutcome =
  | { status: 'ok' }
  | { status: 'refused'; message: string }
  | { status: 'failed' };

/** Read Nest's and Better Auth's refusal bodies the one way `api.ts` does. */
function messageOf(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      const joined = message.filter((m) => typeof m === 'string').join(' ');
      if (joined.trim()) return joined;
    }
  }
  return fallback;
}

/**
 * One bounded POST to Better Auth.
 *
 * `credentials: 'omit'` is load bearing. Expo installs `expo/fetch` as the
 * global `fetch`, and it defaults to `'include'`: the native client keeps every
 * cookie an answer sets and replays it on the next call to that host. Sign in
 * answers with the session cookie as well as `set-auth-token`, so from then on
 * every POST here carried that cookie and no Origin, which Better Auth's CSRF
 * check refuses as "Missing or null Origin". The first sign in on a device
 * worked and every later one failed. Identity here is the bearer token alone,
 * so the jar has no job: `'omit'` neither sends a stored cookie nor keeps a new
 * one, on Android and iOS alike.
 */
async function authCall(
  path: string,
  body: Record<string, unknown>,
): Promise<{ outcome: AuthOutcome; response?: Response }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${AUTH_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      signal: controller.signal,
    });

    if (response.ok) return { outcome: { status: 'ok' }, response };

    const parsed = await response.json().catch(() => null);
    return {
      outcome: {
        status: 'refused',
        message: messageOf(parsed, 'That did not work. Try again.'),
      },
      response,
    };
  } catch {
    // Reachability, not refusal. The caller must not retype a code over this.
    logFailure('auth call could not reach the server', {
      method: 'POST',
      url: `${AUTH_BASE}${path}`,
      outcome: 'failed',
    });
    return { outcome: { status: 'failed' } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask for a sign-in code by email.
 *
 * Email rather than phone. The prototype's sign in screen collected a phone
 * number, but `emailOTP` is what the API has, and the demo personas are
 * addressed by email.
 */
export function requestSignInCode(email: string): Promise<AuthOutcome> {
  return authCall('/email-otp/send-verification-otp', {
    email: email.trim().toLowerCase(),
    type: 'sign-in',
  }).then((r) => r.outcome);
}

/**
 * Verify a code and keep the token it returns.
 *
 * The token comes from the `set-auth-token` RESPONSE HEADER, which is what
 * `bearer()` sets on any answer carrying a live session cookie. Deliberately
 * not the `token` field in the body: that one is the raw session id, unsigned,
 * and the plugin would have to re-sign it on every call. The header carries the
 * signed form, which is what the plugin verifies by HMAC.
 */
export async function verifySignInCode(
  email: string,
  code: string,
): Promise<AuthOutcome> {
  const { outcome, response } = await authCall('/sign-in/email-otp', {
    email: email.trim().toLowerCase(),
    otp: code.trim(),
  });

  if (outcome.status !== 'ok') return outcome;

  const token = response?.headers.get('set-auth-token');
  if (!token) {
    // A 200 with no token means the server verified the code and then failed to
    // hand over a credential — almost always `bearer()` missing from
    // packages/auth/dist/server.js, which `pnpm install` can silently revert
    // (ADR-038 Consequences). Saying so beats a blank signed-in screen.
    logFailure('verify succeeded but returned no set-auth-token header', {
      method: 'POST',
      url: `${AUTH_BASE}/sign-in/email-otp`,
      outcome: 'refused',
    });
    return {
      status: 'refused',
      message: 'Signed in, but no session was issued. Try again.',
    };
  }

  await writeStoredToken(token);
  return { status: 'ok' };
}

/**
 * Sign out (AC-S9).
 *
 * Best effort on the server, unconditional locally. The server call is given a
 * SHORT timeout of its own and its answer is ignored, because a person who
 * tapped sign out is signed out: blocking that on a network round trip means an
 * unreachable server keeps them signed in, which is the opposite of what they
 * asked for and worse for them if the phone is not theirs.
 *
 * What this cannot promise is stated rather than hidden: whether the token is
 * dead SERVER side depends on the call landing. Locally it is gone either way.
 */
export async function signOut(): Promise<{ serverConfirmed: boolean }> {
  let serverConfirmed = false;

  if (cachedToken) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(`${AUTH_BASE}/sign-out`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        // An empty object, never no body. The API runs on Fastify, which answers
        // a JSON content type over an empty body with a 400 before Better Auth
        // sees the request, so the session was never ended server side.
        body: JSON.stringify({}),
        // Never the cookie jar; `authCall` records why.
        credentials: 'omit',
        signal: controller.signal,
      });
      serverConfirmed = response.ok;
    } catch {
      serverConfirmed = false;
    } finally {
      clearTimeout(timer);
    }
  }

  await writeStoredToken(null);
  return { serverConfirmed };
}
