// Sign-in on the phone, against the API's Better Auth: an emailed code, or Google. The web preview build
// keeps the local fixture sign-in instead (auth.web.ts); Metro picks the file by platform.
//
// The session is Better Auth's own cookie, kept by @better-auth/expo in expo-secure-store (the iOS
// keychain, Android's encrypted preferences) and nowhere else. It is never logged and never put in a url
// by this app. Every API call carries it as a `Cookie` header with `credentials: "omit"`: the native fetch
// keeps a cookie jar of its own, and a jar cookie sent without an Origin is refused by Better Auth's CSRF
// check, which is how the previous phone app's second sign-in on a device used to fail.

import { expoClient } from "@better-auth/expo/client";
import { MyWorkspaces, PlatformInfo } from "@injishi/contracts";
import { type Persona, personaByEmail, personas } from "@injishi/data/personas";
import type { PersonaId } from "@injishi/data/types";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { api, setSessionCookieSource } from "./api";
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

// Every API call made through `lib/api.ts` carries this session's cookie.
setSessionCookieSource(() => authClient.getCookie() || null);

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
  const answer = await api.requestParsed(PlatformInfo, "/api/v1/platform", { timeoutMs: TIMEOUT_MS });
  if (answer.status !== "ok") return null;
  const body = answer.data;
  return { demo: body.environment === "demo", seededAt: body.seededAt ?? null, google: body.googleSignIn === true };
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

/**
 * The signed in account, as the API knows it (mobile spec 0003, D-af, D-at): the ids every cache key
 * and outbox row is scoped to, the business workspace where the person is a housekeeper, and the
 * emailed step up this session owes.
 */
export interface Account {
  userId: string;
  /** Better Auth's session row: the step up is kept against it. */
  sessionId: string;
  name: string;
  email: string;
  /** The business workspace where the person is a housekeeper (the shell rule), or null. */
  workspace: { workspaceId: string; orgId: string } | null;
  /** `verified` here may come from this phone's own record of a code, trusted offline (D-at). */
  twoFactor: { required: boolean; verified: boolean };
}

export type SessionState =
  | { status: "signed-in"; persona: Persona; account: Account }
  | { status: "signed-out" }
  /** The API did not answer. Not a sign-out: the person keeps the shell and account they last had, if any. */
  | { status: "unreachable"; persona: Persona | null; account: Account | null };

const LAST_PERSONA_KEY = "injishi_last_persona";
/** The session id that presented a step up code on this phone (D-at). */
const STEP_UP_KEY = "injishi_step_up_session";

/**
 * Which phone app this person gets (ADR-076 G15). A demo persona is matched by email only when the API
 * runs as the demo, as the operator app does; outside it, a persona's email is a person with grants of
 * their own. A housekeeper, by the role their business grant names, gets the housekeeping app; everyone
 * else the guest app, under their own name.
 */
function phonePersonaFor(
  user: { name?: string | null; email: string },
  workspaces: MyWorkspaces["workspaces"],
  demo: boolean,
): Persona {
  const persona = demo ? personaByEmail(user.email) : undefined;
  if (persona?.app.kind === "phone") return persona;
  const housekeeper = workspaces.some(
    (w) => w.kind === "business" && (w.grants?.roles[0]?.key ?? w.orgRole) === "housekeeper",
  );
  const shell = personas[housekeeper ? "housekeeper" : "guest"];
  const name = user.name?.trim() || user.email.split("@")[0];
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
  return { ...shell, name, firstName: parts[0] ?? name, initials: initials || "?", email: user.email };
}

/** The business workspace where the person is a housekeeper, the current shell rule (D-af). */
function housekeepingWorkspace(workspaces: MyWorkspaces["workspaces"]): Account["workspace"] {
  const found = workspaces.find((w) => w.kind === "business" && w.orgRole === "housekeeper" && w.orgId);
  return found?.orgId ? { workspaceId: found.workspaceId, orgId: found.orgId } : null;
}

interface Remembered {
  persona: Persona;
  account: Account | null;
}

function remember(saved: Remembered | null): void {
  try {
    if (saved) {
      const { persona, account } = saved;
      SecureStore.setItem(
        LAST_PERSONA_KEY,
        JSON.stringify({
          id: persona.id,
          name: persona.name,
          firstName: persona.firstName,
          initials: persona.initials,
          email: persona.email,
          account,
        }),
      );
    } else {
      void SecureStore.deleteItemAsync(LAST_PERSONA_KEY);
    }
  } catch {
    // Losing the remembered shell costs an offline start its screens, nothing more.
  }
}

function remembered(): Remembered | null {
  try {
    const raw = SecureStore.getItem(LAST_PERSONA_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Pick<Persona, "name" | "firstName" | "initials" | "email"> & {
      id: PersonaId;
      account?: Account | null;
    };
    const shell = personas[saved.id];
    if (!shell) return null;
    const { account, ...fields } = saved;
    const offline = account
      ? { ...account, twoFactor: { ...account.twoFactor, verified: stepUpKept(account.sessionId) } }
      : null;
    return { persona: { ...shell, ...fields }, account: offline };
  } catch {
    return null;
  }
}

/** The account last signed in on this phone, even after its session expired: whose unsent writes these are. */
export function lastAccount(): Account | null {
  return remembered()?.account ?? null;
}

/** Did this session present a step up code on this phone? Trusted offline (D-at). */
function stepUpKept(sessionId: string): boolean {
  try {
    return SecureStore.getItem(STEP_UP_KEY) === sessionId;
  } catch {
    return false;
  }
}

/** Keep that this session presented a code, so an offline start goes straight to Today. */
export function keepStepUp(sessionId: string): void {
  try {
    SecureStore.setItem(STEP_UP_KEY, sessionId);
  } catch {
    // Without it, the next offline start asks to connect for a code; nothing is lost.
  }
}

/** Forget it: at sign out, and when the API says this session must step up again. */
export function forgetStepUp(): void {
  void SecureStore.deleteItemAsync(STEP_UP_KEY).catch(() => {});
}

/** Who is signed in on this phone, asked of the API. */
export async function loadSession(): Promise<SessionState> {
  // No stored session is a settled answer; no round trip.
  if (!authClient.getCookie()) return { status: "signed-out" };
  const offline = (): SessionState => {
    const saved = remembered();
    return { status: "unreachable", persona: saved?.persona ?? null, account: saved?.account ?? null };
  };
  try {
    const { data, error } = await authClient.getSession();
    // A 401 keeps the remembered account: its unsent writes still name it on the sign in screen.
    if (error) return error.status === 401 ? { status: "signed-out" } : offline();
    if (!data?.user) {
      remember(null);
      return { status: "signed-out" };
    }
    // A demo persona applies only when the API says it is the demo (ADR-076 G15).
    const [answer, options] = await Promise.all([
      api.requestParsed(MyWorkspaces, "/api/v1/me/workspaces"),
      signInOptions(),
    ]);
    if (answer.status === "unauthenticated") return { status: "signed-out" };
    if (answer.status !== "ok") {
      const saved = offline();
      // Only this person's own last account stands in for the answer.
      return saved.status === "unreachable" && saved.account?.userId !== data.user.id
        ? { status: "unreachable", persona: null, account: null }
        : saved;
    }
    const { workspaces, twoFactor } = answer.data;
    const sessionId = data.session.id;
    if (twoFactor.required && twoFactor.verified) keepStepUp(sessionId);
    const persona = phonePersonaFor(data.user, workspaces, options?.demo === true);
    const account: Account = {
      userId: data.user.id,
      sessionId,
      name: data.user.name?.trim() || data.user.email,
      email: data.user.email,
      workspace: housekeepingWorkspace(workspaces),
      twoFactor: { required: twoFactor.required, verified: twoFactor.verified },
    };
    remember({ persona, account });
    return { status: "signed-in", persona, account };
  } catch {
    return offline();
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
  forgetStepUp();
}

/** Preview builds only (`/sign-in?as=`); a phone always signs in through the API. */
export function signInAs(_personaId: PersonaId): boolean {
  return false;
}
