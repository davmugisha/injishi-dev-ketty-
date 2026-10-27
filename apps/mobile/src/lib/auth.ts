// Sign-in on the phone, against the API's Better Auth: an emailed code, or Google. The web preview build
// keeps the local fixture sign-in instead (auth.web.ts); Metro picks the file by platform.
//
// The session is Better Auth's own cookie, kept by @better-auth/expo in expo-secure-store (the iOS
// keychain, Android's encrypted preferences) and nowhere else. It is never logged and never put in a url
// by this app. Every API call carries it as a `Cookie` header with `credentials: "omit"`: the native fetch
// keeps a cookie jar of its own, and a jar cookie sent without an Origin is refused by Better Auth's CSRF
// check, which is how the previous phone app's second sign-in on a device used to fail.

import { expoClient } from "@better-auth/expo/client";
import { type Persona, personaByEmail, personas } from "@injishi/data/personas";
import type { PersonaId } from "@injishi/data/types";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./env";

const TIMEOUT_MS = 15_000;

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/api/auth",
  fetchOptions: { timeout: TIMEOUT_MS },
  plugins: [
    expoClient({
      // No `scheme`: the client takes the build's own from app.config.ts (injishi, injishi-preview or
      // injishi-dev), so the API sees the origin it trusts for that build and Google returns to this app.
      storagePrefix: "injishi",
      // Production's cookie, and the demo stack's (ADR-043): a build talks to one of them.
      cookiePrefix: ["better-auth", "injishi-demo"],
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});

export interface SignInOptions {
  /** The API is the demo: every code is 123456 and the persona list may be shown. */
  demo: boolean;
  /** When the demo's data was last reset, or null. */
  seededAt: string | null;
  /** The API has Google credentials, so its Google provider is mounted. */
  google: boolean;
}

/** Asked of the API (`GET /api/v1/platform`), never assumed. Null when it cannot be reached. */
export async function signInOptions(): Promise<SignInOptions | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/platform`, {
      credentials: "omit",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { environment?: string; seededAt?: string | null; googleSignIn?: boolean };
    return { demo: body.environment === "demo", seededAt: body.seededAt ?? null, google: body.googleSignIn === true };
  } catch {
    return null;
  }
}

export type SendOutcome = { ok: true } | { ok: false; reason: "invalid-email" | "too-many" | "unavailable" };

/** Ask the API to email a sign-in code. */
export async function requestCode(email: string): Promise<SendOutcome> {
  try {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim().toLowerCase(),
      type: "sign-in",
    });
    if (!error) return { ok: true };
    if (error.status === 429) return { ok: false, reason: "too-many" };
    if (error.status === 400 || error.status === 422) return { ok: false, reason: "invalid-email" };
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type VerifyOutcome = { ok: true } | { ok: false; reason: "wrong-code" | "expired" | "too-many" | "unavailable" };

/** Check a code with the API; on success the session is in the keychain. */
export async function verifyCode(email: string, code: string): Promise<VerifyOutcome> {
  try {
    const { error } = await authClient.signIn.emailOtp({
      email: email.trim().toLowerCase(),
      otp: code.replace(/\D/g, ""),
    });
    if (!error) return { ok: true };
    if (error.status === 429 || error.code === "TOO_MANY_ATTEMPTS") return { ok: false, reason: "too-many" };
    if (error.code === "OTP_EXPIRED") return { ok: false, reason: "expired" };
    if (!error.status || error.status >= 500) return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "wrong-code" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type GoogleOutcome = { ok: true } | { ok: false; reason: "cancelled" | "failed" };

/**
 * Google, in the system's sign-in browser. The API's callback lands on this app's deep link carrying the
 * new session, which the Expo client stores; the promise settles once that browser closes.
 */
export async function signInWithGoogle(): Promise<GoogleOutcome> {
  try {
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (error) return { ok: false, reason: "failed" };
    return authClient.getCookie() ? { ok: true } : { ok: false, reason: "cancelled" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** One grant from `GET /api/v1/me/workspaces` (the fields this app reads). */
interface Workspace {
  kind: string;
  orgRole: string | null;
}

export type SessionState =
  | { status: "signed-in"; persona: Persona }
  | { status: "signed-out" }
  /** The API did not answer. Not a sign-out: the person keeps the shell they last had, if any. */
  | { status: "unreachable"; persona: Persona | null };

const LAST_PERSONA_KEY = "injishi_last_persona";

/**
 * Which phone app this person gets. A demo persona is matched by email, as the operator app does; a real
 * housekeeper gets the housekeeping app; everyone else the guest app, under their own name.
 */
function phonePersonaFor(user: { name?: string | null; email: string }, workspaces: Workspace[]): Persona {
  const demo = personaByEmail(user.email);
  if (demo?.app.kind === "phone") return demo;
  const housekeeper = workspaces.some((w) => w.kind === "business" && w.orgRole === "housekeeper");
  const shell = personas[housekeeper ? "housekeeper" : "guest"];
  const name = user.name?.trim() || user.email.split("@")[0];
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
  return { ...shell, name, firstName: parts[0] ?? name, initials: initials || "?", email: user.email };
}

function remember(persona: Persona | null): void {
  try {
    if (persona) {
      SecureStore.setItem(
        LAST_PERSONA_KEY,
        JSON.stringify({
          id: persona.id,
          name: persona.name,
          firstName: persona.firstName,
          initials: persona.initials,
          email: persona.email,
        }),
      );
    } else {
      void SecureStore.deleteItemAsync(LAST_PERSONA_KEY);
    }
  } catch {
    // Losing the remembered shell costs an offline start its screens, nothing more.
  }
}

function remembered(): Persona | null {
  try {
    const raw = SecureStore.getItem(LAST_PERSONA_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Pick<Persona, "name" | "firstName" | "initials" | "email"> & { id: PersonaId };
    const shell = personas[saved.id];
    return shell ? { ...shell, ...saved } : null;
  } catch {
    return null;
  }
}

/** Who is signed in on this phone, asked of the API. */
export async function loadSession(): Promise<SessionState> {
  // No stored session is a settled answer; no round trip.
  if (!authClient.getCookie()) return { status: "signed-out" };
  try {
    const { data, error } = await authClient.getSession();
    if (error) {
      return error.status === 401 ? { status: "signed-out" } : { status: "unreachable", persona: remembered() };
    }
    if (!data?.user) {
      remember(null);
      return { status: "signed-out" };
    }
    const response = await fetch(`${API_URL}/api/v1/me/workspaces`, {
      headers: { cookie: authClient.getCookie(), accept: "application/json" },
      credentials: "omit",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = response.ok ? ((await response.json()) as { workspaces?: Workspace[] }) : null;
    const persona = phonePersonaFor(data.user, body?.workspaces ?? []);
    remember(persona);
    return { status: "signed-in", persona };
  } catch {
    return { status: "unreachable", persona: remembered() };
  }
}

/**
 * Sign out. The API session ends when the call lands; the phone forgets it either way, because a person
 * who pressed sign out on a shared phone is signed out whether or not the network was there.
 */
export async function signOut(): Promise<void> {
  try {
    await authClient.signOut();
  } catch {
    // The Expo client cleared the stored session before the request went out.
  }
  remember(null);
}

/** Preview builds only (`/sign-in?as=`); a phone always signs in through the API. */
export function signInAs(_personaId: PersonaId): boolean {
  return false;
}
