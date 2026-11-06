"use server";

/**
 * The password's Server Actions (tenants only, 2026-10-23): sign in with one, forgot it, create the
 * first one after accepting a lease invitation, and set or change it from the account.
 *
 * The sign-in screen offers "Sign in with your password" for any address, and every answer is the same
 * whether or not the address has an account or a password, so it reveals nothing.
 */

import { newPasswordProblem, PASSWORD_MESSAGES } from "@injishi/auth/client";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { accountFor } from "@/server/auth";
import {
  changePassword,
  createPassword,
  type PasswordResult,
  type PasswordStatus,
  passwordStatus,
  resetPasswordWithCode,
  sendPasswordCode,
  signInWithPassword,
} from "@/server/password";
import { destinationAfterSignIn } from "./return-to";
import { canOpen } from "./screen-access";
import { applyApiCookies, currentSessionCookie, LEGACY_SESSION_COOKIE, OTP_COOKIE } from "./session";

async function visitor(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null,
    userAgent: h.get("user-agent"),
  };
}

const EMAIL = /^\S+@\S+\.\S+$/;

export type PasswordSignInState = { error?: string; email?: string };

/** "Sign in" on the password form. Lands where an email-code sign-in would. */
export async function signInPassword(_prev: PasswordSignInState, form: FormData): Promise<PasswordSignInState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email)) return { error: "Enter your email address.", email };
  if (!password) return { error: PASSWORD_MESSAGES.missing, email };
  const { ip, userAgent } = await visitor();
  const result = await signInWithPassword(email, password, ip, userAgent);
  if (!result.ok) return { error: result.message, email };
  const store = await cookies();
  applyApiCookies(store, result.setCookies);
  store.delete(LEGACY_SESSION_COOKIE);
  store.delete(OTP_COOKIE);
  const account = await accountFor(result.cookie);
  // Where it lands is the account's own: its home and the screens its grants open (ADR-076 G14).
  const landing = account ? { home: account.home, canOpen: canOpen(account) } : {};
  redirect(
    destinationAfterSignIn(
      account?.persona.id ?? "guest",
      String(form.get("next") ?? ""),
      account?.user.email,
      landing,
    ),
  );
}

/** "Send a code" on Forgot password. Says "sent" for every well-formed address. */
export async function sendForgotCode(email: string): Promise<PasswordResult> {
  if (!EMAIL.test(email.trim())) return { ok: false, message: "Enter your email address." };
  return sendPasswordCode(email, (await visitor()).ip);
}

/** "Save password" on Forgot password: the emailed code and the new password, typed twice. */
export async function resetForgotPassword(input: {
  email: string;
  code: string;
  password: string;
  confirm: string;
}): Promise<PasswordResult> {
  const problem = newPasswordProblem(input.password, input.confirm);
  if (problem) return { ok: false, message: problem };
  if (input.code.replace(/\D/g, "").length !== 6) return { ok: false, message: PASSWORD_MESSAGES.codeIncomplete };
  return resetPasswordWithCode(input.email, input.code, input.password, (await visitor()).ip);
}

async function signedIn(): Promise<string> {
  const cookie = await currentSessionCookie();
  if (!cookie) redirect("/sign-in");
  return cookie;
}

/** Whether the signed-in person is offered a password and has one; null when the API did not answer. */
export async function myPasswordStatus(): Promise<PasswordStatus | null> {
  const cookie = await currentSessionCookie();
  if (!cookie) return null;
  return passwordStatus(cookie).catch(() => null);
}

/** "Create a password" after accepting a lease invitation. The API checks this person is a tenant. */
export async function createFirstPassword(input: { password: string; confirm: string }): Promise<PasswordResult> {
  const problem = newPasswordProblem(input.password, input.confirm);
  if (problem) return { ok: false, message: problem };
  const result = await createPassword(await signedIn(), input.password);
  if (result.ok) revalidatePath("/account");
  return result;
}

/** Email the signed-in tenant a code to set their first password from the account. */
export async function sendMyPasswordCode(): Promise<PasswordResult> {
  const account = await accountFor(await signedIn());
  if (!account) redirect("/sign-in");
  return sendPasswordCode(account.user.email, (await visitor()).ip);
}

/** "Save password" on the account, with the code just emailed. */
export async function setMyPasswordWithCode(input: {
  code: string;
  password: string;
  confirm: string;
}): Promise<PasswordResult> {
  const account = await accountFor(await signedIn());
  if (!account) redirect("/sign-in");
  const result = await resetForgotPassword({ email: account.user.email, ...input });
  if (result.ok) revalidatePath("/account");
  return result;
}

/** "Change password": needs the current one; optionally signs out every other device. */
export async function changeMyPassword(input: {
  current: string;
  password: string;
  confirm: string;
  signOutOthers: boolean;
}): Promise<PasswordResult> {
  if (!input.current) return { ok: false, message: PASSWORD_MESSAGES.missingCurrent };
  const problem = newPasswordProblem(input.password, input.confirm);
  if (problem) return { ok: false, message: problem };
  const result = await changePassword(await signedIn(), input.current, input.password, input.signOutOthers);
  if (!result.ok) return result;
  if (result.setCookies.length > 0) applyApiCookies(await cookies(), result.setCookies);
  revalidatePath("/account");
  return { ok: true };
}
