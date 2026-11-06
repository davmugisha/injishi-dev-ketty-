import { type BoardId, type Persona, screens } from "@injishi/data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { screenDecision } from "@/server/access";
import { type ApiClient, ApiError, createApiClient, type SessionCookie } from "@/server/api";
import { type Account, accountFor, OTP_TTL_SECONDS } from "@/server/auth";
import { expiredAuthCookies, type ForwardedCookie, sessionCookieHeader } from "@/server/session-cookies";
import { safePath } from "./return-to";
import { accessSubject } from "./screen-access";

/**
 * Where the app kept the API's session before it shared the browser's Better Auth cookie with web.
 * Never read; cleared on sign-in and sign-out so it does not linger in a browser.
 */
export const LEGACY_SESSION_COOKIE = "ij_session";
/** The email a code was sent to, between the sign-in and verify steps. */
export const OTP_COOKIE = "ij_otp";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Hand the browser the cookies the API set (sign-in) or cleared (sign-out), with every attribute the API
 * chose. Works on `cookies()` in a Server Action and on `response.cookies` in a route handler.
 */
export function applyApiCookies(store: Pick<CookieStore, "set">, forwarded: readonly ForwardedCookie[]): void {
  for (const { name, value, ...options } of forwarded) store.set({ name, value, ...options });
}

/** The browser's Better Auth session as a `Cookie` header for the API, or null. */
export const currentSessionCookie = cache(async (): Promise<SessionCookie | null> => {
  return sessionCookieHeader((await cookies()).getAll());
});

/**
 * Clear every Better Auth cookie this origin can see, for when the API cannot be asked to, on the domain
 * the API sets them on (`expiredAuthCookies` says why a plain delete is not enough).
 */
export function clearAuthCookies(
  store: Pick<CookieStore, "getAll" | "set" | "delete">,
  domain: string | undefined = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
): void {
  applyApiCookies(
    store,
    expiredAuthCookies(
      store.getAll().map((c) => c.name),
      domain,
    ),
  );
  store.delete(LEGACY_SESSION_COOKIE);
}

/**
 * Who is signed in, resolved by the API once per request (React cache). Null when there is no
 * session or the API says it ended. An unreachable API throws: an outage is not a sign-out.
 */
export const currentAccount = cache(async (): Promise<Account | null> => {
  const cookie = await currentSessionCookie();
  if (!cookie) return null;
  try {
    return await accountFor(cookie);
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) return null;
    throw error;
  }
});

/** The signed-in persona (the interface shell this person gets), or null. */
export async function currentPersona(): Promise<Persona | null> {
  return (await currentAccount())?.persona ?? null;
}

/** An API client carrying this request's session. */
export const currentApi = cache(async (): Promise<ApiClient> => createApiClient(await currentSessionCookie()));

/**
 * Gate a screen: public screens return the persona (or null); protected screens redirect
 * signed-out visitors to sign-in and people without access to the access-denied screen, which
 * names the layer that refused (ADR-076 G14).
 * Call it first in every page: `const persona = await requireScreen("CheckIn")`.
 *
 * A real person is judged by what the API granted: the screen's product must be on for their business
 * and their grant must hold one of the screen's permissions (`SCREEN_REQUIRES`). A demo persona, on the
 * demo only, by its story.
 */
export async function requireScreen(board: BoardId): Promise<Persona | null> {
  const account = await currentAccount();
  const persona = account?.persona ?? null;
  const screen = screens[board];
  if (screen.persona === null) return persona;
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(screen.href)}`);
  const decision = screenDecision(accessSubject(account), board);
  if (!decision.ok) redirect(`/access-denied?from=${board}&layer=${decision.layer}`);
  return account.persona;
}

/** Same as requireScreen for screens that always need a person (narrows the type). */
export async function requirePersona(board: BoardId): Promise<Persona> {
  const persona = await requireScreen(board);
  if (!persona) redirect(`/sign-in?next=${encodeURIComponent(screens[board].href)}`);
  return persona;
}

/** What the code step needs between requests: who the code went to and when. */
export interface PendingSignIn {
  email: string;
  sentAt: number;
}

export function readPendingSignIn(value: string | undefined): PendingSignIn | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PendingSignIn;
    if (typeof parsed.email !== "string" || typeof parsed.sentAt !== "number") return null;
    return Date.now() - parsed.sentAt < OTP_TTL_SECONDS * 1000 ? parsed : null;
  } catch {
    return null;
  }
}

/** Only allow same-origin paths, as a browser would resolve them (`return-to.ts` says why). */
export function safeNext(next: string | null | undefined): string | null {
  return safePath(next);
}
