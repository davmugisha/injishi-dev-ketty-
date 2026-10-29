"use server";

import { type PersonaId, personas } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "@/server/api";
import {
  accountFor,
  demoSignInCode,
  OTP_TTL_SECONDS,
  revokeOtherSessions,
  revokeSession,
  sendSignInCode,
  signOutOfApi,
  verifySignInCode,
} from "@/server/auth";
import { destinationAfterSignIn, safeReturn } from "./return-to";
import {
  applyApiCookies,
  clearAuthCookies,
  currentSessionCookie,
  LEGACY_SESSION_COOKIE,
  OTP_COOKIE,
  type PendingSignIn,
  readPendingSignIn,
} from "./session";
import { SEND_ERRORS, VERIFY_ERRORS } from "./sign-in-messages";

export type SignInState = { error?: string; email?: string };

const secure = process.env.NODE_ENV === "production";

/**
 * The visitor's address as the edge recorded it. The edge (Traefik) strips whatever a client sent in
 * `x-forwarded-for` and writes the real address, so its first entry is the visitor. Locally there is no
 * edge and nothing to forward; the API then counts every laptop request as itself.
 */
async function visitorIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
}

type SendFailure = keyof typeof SEND_ERRORS;

/**
 * Ask the API to send a code, remember who it went to, and move to the code step. The address rides in
 * a short-lived httpOnly cookie, never the url, where it would end up in logs and history. Returns only
 * when no code went out, saying why; the caller words it for its own screen.
 */
async function beginChallenge(email: string, returnTo: string | null): Promise<SendFailure> {
  const sent = await sendSignInCode(email, await visitorIp());
  if (!sent.ok) return sent.reason;
  const pending: PendingSignIn = { email: email.trim().toLowerCase(), sentAt: Date.now() };
  (await cookies()).set(OTP_COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
  redirect(returnTo ? `/verify?${new URLSearchParams({ next: returnTo }).toString()}` : "/verify");
}

/** "Continue" on the sign-in form: send a one-time code to the typed email. */
export async function startSignIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const next = safeReturn(String(form.get("next") ?? ""));
  if (!email) return { error: "Enter your email to continue.", email };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: SEND_ERRORS["invalid-email"], email };
  return { error: SEND_ERRORS[await beginChallenge(email, next)], email };
}

/** "Sign in as …" on a demo persona card: same code step, for that persona's email. */
export async function signInAs(personaId: PersonaId, next?: string): Promise<void> {
  const persona = personas[personaId];
  // Only the demo has personas to sign in as; anywhere else this would mail a code to an address nobody owns.
  if (!persona || !(await demoSignInCode())) redirect("/sign-in");
  redirect(`/sign-in?error=${await beginChallenge(persona.email, safeReturn(next))}`);
}

export type VerifyState = { error?: string; attemptsLeft?: number };

/**
 * "Verify and continue" on the code step: the API checks the code and opens a session, and the browser
 * is handed that session's cookie exactly as the API wrote it, so web reads the same sign-in.
 */
export async function verifyCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const store = await cookies();
  const pending = readPendingSignIn(store.get(OTP_COOKIE)?.value);
  const code = String(form.get("code") ?? "");
  if (!pending) return { error: VERIFY_ERRORS.expired };
  if (code.replace(/\D/g, "").length !== 6) return { error: "Enter all 6 digits of the code." };
  const result = await verifySignInCode(pending.email, code, await visitorIp(), (await headers()).get("user-agent"));
  if (!result.ok) return { error: VERIFY_ERRORS[result.reason] };
  applyApiCookies(store, result.setCookies);
  store.delete(LEGACY_SESSION_COOKIE);
  store.delete(OTP_COOKIE);
  const account = await accountFor(result.cookie);
  redirect(
    destinationAfterSignIn(
      account?.persona.id ?? "guest",
      String(form.get("next") ?? ""),
      account?.user.email,
      account?.persona.home,
    ),
  );
}

/** "Resend code" on the code step, to the address the first code went to. Says why when it cannot. */
export async function resendCode(next?: string): Promise<{ error?: string }> {
  const pending = readPendingSignIn((await cookies()).get(OTP_COOKIE)?.value);
  if (!pending) return { error: VERIFY_ERRORS.expired };
  return { error: SEND_ERRORS[await beginChallenge(pending.email, safeReturn(next))] };
}

type SessionsState = { error?: string };

const SESSIONS_UNREACHABLE = "We couldn’t reach Injishi to sign that out. Try again in a moment.";

/**
 * Run one change to the person's sessions, then have the account screen read them again. A session that
 * is no longer signed in goes to sign-in; an outage says so and changes nothing.
 */
async function changeSessions(change: (cookie: string) => Promise<string | undefined>): Promise<SessionsState> {
  const cookie = await currentSessionCookie();
  if (!cookie) redirect("/sign-in");
  let error: string | undefined;
  try {
    error = await change(cookie);
  } catch (failure) {
    if (failure instanceof ApiError && failure.unauthenticated) redirect("/sign-in");
    error = SESSIONS_UNREACHABLE;
  }
  revalidatePath("/account");
  return error ? { error } : {};
}

/** "Sign out" on one row of Sign-in & sessions: ends that session on the API, wherever it is. */
export async function signOutSession(id: string): Promise<SessionsState> {
  return changeSessions(async (cookie) =>
    (await revokeSession(cookie, id)) ? undefined : "That session had already ended.",
  );
}

/** "Sign out all other sessions": ends every session of this person but this browser's. */
export async function signOutOtherSessions(): Promise<SessionsState> {
  return changeSessions(async (cookie) => {
    await revokeOtherSessions(cookie);
    return undefined;
  });
}

/**
 * Sign out (also "Switch user"): ends the API session and clears its cookie, which signs the person out
 * of web as well. The API writes the clearing cookies with the domain the session was set on; when it
 * cannot be reached, the app clears what this origin can see.
 */
export async function signOut(next?: string): Promise<void> {
  const store = await cookies();
  const cookie = await currentSessionCookie();
  const cleared = cookie ? await signOutOfApi(cookie) : [];
  if (cleared.length > 0) applyApiCookies(store, cleared);
  else clearAuthCookies(store);
  store.delete(LEGACY_SESSION_COOKIE);
  // Back to a page of this app after signing in again (an invitation link), never to another site.
  const back = next && /^\/(?![/\\])/.test(next) ? next : null;
  redirect(back ? `/sign-in?next=${encodeURIComponent(back)}` : "/sign-in");
}
