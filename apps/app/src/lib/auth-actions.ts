"use server";

import { canAccess, homeHref, type PersonaId, personas, screenByPath } from "@injishi/data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  accountFor,
  demoSignInCode,
  OTP_TTL_SECONDS,
  sendSignInCode,
  signOutOfApi,
  verifySignInCode,
} from "@/server/auth";
import {
  currentSessionCookie,
  encodeSessionCookie,
  OTP_COOKIE,
  type PendingSignIn,
  readPendingSignIn,
  SESSION_COOKIE,
  safeNext,
} from "./session";

export type SignInState = { error?: string; email?: string };

const secure = process.env.NODE_ENV === "production";

const SEND_ERRORS = {
  "invalid-email": "That doesn’t look like an email address.",
  "too-many": "Too many codes for this email. Wait an hour, or use the newest code we sent.",
  unavailable: "We couldn’t reach Injishi to send your code. Try again in a moment.",
} as const;

/** Ask the API to send a code, remember who it went to, and move to the code step. */
async function beginChallenge(email: string, next: string | null): Promise<SignInState> {
  const sent = await sendSignInCode(email);
  if (!sent.ok) return { error: SEND_ERRORS[sent.reason], email };
  const pending: PendingSignIn = { email: email.trim().toLowerCase(), sentAt: Date.now() };
  (await cookies()).set(OTP_COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
  const params = new URLSearchParams({ email: pending.email });
  if (next) params.set("next", next);
  redirect(`/verify?${params.toString()}`);
}

/** "Continue" on the sign-in form: send a one-time code to the typed email. */
export async function startSignIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const next = safeNext(String(form.get("next") ?? ""));
  if (!email) return { error: "Enter your email to continue.", email };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: SEND_ERRORS["invalid-email"], email };
  return beginChallenge(email, next);
}

/** "Sign in as …" on a demo persona card: same code step, for that persona's email. */
export async function signInAs(personaId: PersonaId, next?: string): Promise<void> {
  const persona = personas[personaId];
  // Only the demo has personas to sign in as; anywhere else this would mail a code to an address nobody owns.
  if (!persona || !(await demoSignInCode())) redirect("/sign-in");
  const failed = await beginChallenge(persona.email, safeNext(next));
  if (failed.error) redirect(`/sign-in?error=${encodeURIComponent(failed.error)}`);
}

export type VerifyState = { error?: string; attemptsLeft?: number };

const VERIFY_ERRORS = {
  "wrong-code": "That code didn’t match. Use the newest message we sent.",
  expired: "This code has expired. Go back and ask for a new one.",
  "too-many": "Too many wrong codes. Ask for a new code.",
  unavailable: "We couldn’t reach Injishi to check your code. Try again in a moment.",
} as const;

/** "Verify and continue" on the code step: the API checks the code and opens a session. */
export async function verifyCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const store = await cookies();
  const pending = readPendingSignIn(store.get(OTP_COOKIE)?.value);
  const code = String(form.get("code") ?? "");
  if (!pending) return { error: VERIFY_ERRORS.expired };
  if (code.replace(/\D/g, "").length !== 6) return { error: "Enter all 6 digits of the code." };
  const result = await verifySignInCode(pending.email, code);
  if (!result.ok) return { error: VERIFY_ERRORS[result.reason] };
  store.set(SESSION_COOKIE, encodeSessionCookie(result.cookie), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: result.expiresAt,
  });
  store.delete(OTP_COOKIE);
  const account = await accountFor(result.cookie);
  const personaId = account?.persona.id ?? "guest";
  const next = safeNext(String(form.get("next") ?? ""));
  const target = next && canAccessPath(personaId, next) ? next : homeHref(personaId);
  redirect(target);
}

function canAccessPath(personaId: PersonaId, path: string): boolean {
  const screen = screenByPath(path.split("?")[0]);
  return screen ? canAccess(personaId, screen.board) : false;
}

/** Request a fresh code for the email on the code step. */
export async function resendCode(email: string, next?: string): Promise<void> {
  const failed = await beginChallenge(email, safeNext(next));
  if (failed.error) redirect("/sign-in");
}

/** Sign out (also "Switch user"): ends the API session and returns to the persona list. */
export async function signOut(): Promise<void> {
  const cookie = await currentSessionCookie();
  if (cookie) await signOutOfApi(cookie);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in");
}
