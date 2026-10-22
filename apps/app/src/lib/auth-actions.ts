"use server";

import { type PersonaId, personas } from "@injishi/data";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  accountFor,
  demoSignInCode,
  OTP_TTL_SECONDS,
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
  const result = await verifySignInCode(pending.email, code, await visitorIp());
  if (!result.ok) return { error: VERIFY_ERRORS[result.reason] };
  applyApiCookies(store, result.setCookies);
  store.delete(LEGACY_SESSION_COOKIE);
  store.delete(OTP_COOKIE);
  const account = await accountFor(result.cookie);
  redirect(destinationAfterSignIn(account?.persona.id ?? "guest", String(form.get("next") ?? "")));
}

/** "Resend code" on the code step, to the address the first code went to. Says why when it cannot. */
export async function resendCode(next?: string): Promise<{ error?: string }> {
  const pending = readPendingSignIn((await cookies()).get(OTP_COOKIE)?.value);
  if (!pending) return { error: VERIFY_ERRORS.expired };
  return { error: SEND_ERRORS[await beginChallenge(pending.email, safeReturn(next))] };
}

/**
 * Sign out (also "Switch user"): ends the API session and clears its cookie, which signs the person out
 * of web as well. The API writes the clearing cookies with the domain the session was set on; when it
 * cannot be reached, the app clears what this origin can see.
 */
export async function signOut(): Promise<void> {
  const store = await cookies();
  const cookie = await currentSessionCookie();
  const cleared = cookie ? await signOutOfApi(cookie) : [];
  if (cleared.length > 0) applyApiCookies(store, cleared);
  else clearAuthCookies(store);
  store.delete(LEGACY_SESSION_COOKIE);
  redirect("/sign-in");
}
