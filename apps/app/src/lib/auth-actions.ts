"use server";

import { canAccess, homeHref, type PersonaId, personas, screenByPath } from "@injishi/data";
import { createSession, deleteSession, startOtp, verifyOtp } from "@injishi/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OTP_COOKIE, SESSION_COOKIE, safeNext } from "./session";

export type SignInState = { error?: string; email?: string };

const secure = process.env.NODE_ENV === "production";

async function beginChallenge(email: string, next: string | null) {
  const started = await startOtp(email);
  if (!started.ok) return started;
  (await cookies()).set(OTP_COOKIE, started.challengeId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 10 * 60,
  });
  const params = new URLSearchParams({ email: started.email });
  if (next) params.set("next", next);
  redirect(`/verify?${params.toString()}`);
}

/** "Continue" on the sign-in form: start a one-time-code challenge for the typed email. */
export async function startSignIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const next = safeNext(String(form.get("next") ?? ""));
  if (!email) return { error: "Enter your email to continue.", email };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That doesn’t look like an email address.", email };
  await beginChallenge(email, next);
  return {
    error: "There’s no demo account with that email. Choose someone from Explore the demo, or check the spelling.",
    email,
  };
}

/** "Sign in as …" on a demo persona card: same code step, with the demo code filled in. */
export async function signInAs(personaId: PersonaId, next?: string): Promise<void> {
  const persona = personas[personaId];
  if (!persona) redirect("/sign-in");
  await beginChallenge(persona.email, safeNext(next));
}

export type VerifyState = { error?: string; attemptsLeft?: number };

/** "Verify and continue" on the code step. */
export async function verifyCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const store = await cookies();
  const challengeId = store.get(OTP_COOKIE)?.value;
  const code = String(form.get("code") ?? "");
  if (!challengeId) return { error: "This code has expired. Go back and ask for a new one." };
  if (code.replace(/\D/g, "").length !== 6) return { error: "Enter all 6 digits of the code." };
  const result = await verifyOtp(challengeId, code);
  if (!result.ok) {
    if (result.reason === "wrong-code")
      return {
        error: `That code didn’t match. Use the newest message we sent. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`,
        attemptsLeft: result.attemptsLeft,
      };
    if (result.reason === "locked")
      return { error: "Too many wrong codes. Sign-in is paused for 15 minutes for this email.", attemptsLeft: 0 };
    return { error: "This code has expired. Go back and ask for a new one." };
  }
  const { token, expiresAt } = await createSession(result.personaId);
  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", expires: expiresAt });
  store.delete(OTP_COOKIE);
  const next = safeNext(String(form.get("next") ?? ""));
  const target =
    next && screenByPath(next.split("?")[0]) && canAccessPath(result.personaId, next)
      ? next
      : homeHref(result.personaId);
  redirect(target);
}

function canAccessPath(personaId: PersonaId, path: string): boolean {
  const screen = screenByPath(path.split("?")[0]);
  return screen ? canAccess(personaId, screen.board) : false;
}

/** Request a fresh code for the email on the code step. */
export async function resendCode(email: string, next?: string): Promise<void> {
  const started = await beginChallenge(email, safeNext(next));
  if (started && !started.ok) redirect("/sign-in");
}

/** Sign out (also "Switch user"): ends the session and returns to the persona list. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}
