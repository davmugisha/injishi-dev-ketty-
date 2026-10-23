/**
 * Sign-in against the API's Better Auth (email one-time code), and who the signed-in person is.
 * No `next/*` imports: the session helpers in lib/session.ts and the verify scripts both use it.
 *
 * On the demo stack the API accepts the fixed code 123456 for every account (ADR-043); in
 * production it mails a random code. This file does not know which: it forwards what was typed.
 *
 * The session it opens is the API's own cookie, handed on to the browser (`session-cookies.ts`), so
 * the person is signed in on web and here at once.
 */

import { DEMO_OTP, type Persona, type PersonaId, personaByEmail, personas } from "@injishi/data";
import { ApiError, apiBaseUrl, apiOrigin, apiRequest, clientIpHeaders, type SessionCookie } from "./api";
import { authCookiesFrom, cookieHeaderFor, type ForwardedCookie } from "./session-cookies";

const AUTH = "/api/auth";

/** One-time codes expire after this long (`OTP_EXPIRY_SECONDS` in @injishi/auth). */
export const OTP_TTL_SECONDS = 600;

/** What the sign-in screens may offer, from `GET /api/v1/platform`. */
export interface SignInOptions {
  /** The demo's fixed code and last reset, or null outside the demo. */
  demo: { code: string; seededAt: string | null } | null;
  /** The API has Google credentials, so its Google provider is mounted. */
  google: boolean;
}

/**
 * Asked of the API, never assumed: production must never pre-fill or print a code, and a Google button
 * must not be pressable where the provider is not mounted. An unreachable API offers neither.
 */
export async function signInOptions(): Promise<SignInOptions> {
  try {
    const platform = await apiRequest<{
      environment?: string;
      seededAt?: string | null;
      googleSignIn?: boolean | null;
    }>(null, "/api/v1/platform");
    return {
      demo: platform.environment === "demo" ? { code: DEMO_OTP, seededAt: platform.seededAt ?? null } : null,
      google: platform.googleSignIn === true,
    };
  } catch {
    return { demo: null, google: false };
  }
}

/** The fixed sign-in code when the API runs as the demo, else null. */
export async function demoSignInCode(): Promise<string | null> {
  return (await signInOptions()).demo?.code ?? null;
}

export type SendResult = { ok: true } | { ok: false; reason: "invalid-email" | "too-many" | "unavailable" };

/** "Continue" on the sign-in form: ask the API to send a code to this email. */
export async function sendSignInCode(email: string, clientIp?: string | null): Promise<SendResult> {
  try {
    await apiRequest(null, `${AUTH}/email-otp/send-verification-otp`, {
      method: "POST",
      body: { email: email.trim().toLowerCase(), type: "sign-in" },
      clientIp,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) return { ok: false, reason: "too-many" };
      if (error.status === 400 || error.status === 422) return { ok: false, reason: "invalid-email" };
    }
    return { ok: false, reason: "unavailable" };
  }
}

export type VerifyResult =
  /** `cookie` is the session as a `Cookie` header; `setCookies` is what the browser must be given. */
  | { ok: true; cookie: SessionCookie; setCookies: ForwardedCookie[] }
  | { ok: false; reason: "wrong-code" | "expired" | "too-many" | "unavailable" };

/**
 * "Verify and continue": exchange the typed code for the API's session cookie. The visitor's browser is
 * named to the API (`userAgent`), because the session it opens records the user agent that asked for it,
 * and from this server that was Node's: every device on the account screen read "Unknown device".
 */
export async function verifySignInCode(
  email: string,
  code: string,
  clientIp?: string | null,
  userAgent?: string | null,
): Promise<VerifyResult> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${AUTH}/sign-in/email-otp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        origin: apiOrigin(),
        ...clientIpHeaders(clientIp),
        ...(userAgent ? { "user-agent": userAgent } : {}),
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp: code.replace(/\D/g, "") }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string } | null;
    const code = body?.code ?? "";
    if (response.status === 429 || code === "TOO_MANY_ATTEMPTS") return { ok: false, reason: "too-many" };
    if (code === "OTP_EXPIRED") return { ok: false, reason: "expired" };
    if (response.status >= 500) return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "wrong-code" };
  }
  const setCookies = authCookiesFrom(response);
  const cookie = cookieHeaderFor(setCookies);
  if (!cookie) return { ok: false, reason: "unavailable" };
  return { ok: true, cookie, setCookies };
}

/**
 * End the API session, and return the cookies that clear it in the browser: the API writes them with
 * the domain the session was set on, which this app could not name by itself. Empty when the API could
 * not be reached; the caller then clears what it can.
 */
export async function signOutOfApi(cookie: SessionCookie): Promise<ForwardedCookie[]> {
  try {
    const response = await fetch(`${apiBaseUrl()}${AUTH}/sign-out`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", origin: apiOrigin(), cookie },
      // An empty object, never no body: Fastify answers a JSON content type over an empty body with a 400.
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return authCookiesFrom(response);
  } catch {
    return [];
  }
}

// ── Who is signed in ─────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  name: string;
  email: string;
}

/** One grant from GET /api/v1/me/workspaces (fields the app reads). */
export interface Workspace {
  workspaceId: string;
  kind: "personal" | "business" | string;
  orgId: string | null;
  orgName: string | null;
  domain: "hospitality" | "residence" | "broker" | string | null;
  orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | string | null;
  registrationStatus: string | null;
  permissions: string[];
  branches: { propertyId: string; name: string }[] | unknown[];
  label: string;
}

export interface Account {
  user: ApiUser;
  workspaces: Workspace[];
  persona: Persona;
  /**
   * The emailed step-up (F-S02). An email-code session is stepped up when it opens; a Google session is
   * not, and the API refuses an operator's workspace calls until it is (`two_factor_required`).
   */
  twoFactor: { required: boolean; verified: boolean };
}

interface SessionBody {
  user: ApiUser;
  session: { id: string; expiresAt: string };
}

// ── The person's own sessions ───────────────────────────────────────────────

/** A session as Better Auth's `list-sessions` returns it. The token is the session: it never leaves the server. */
interface ApiSession {
  id: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** One of the person's active sessions, as the account screen may show it. */
export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  /** The session this browser holds. */
  current: boolean;
}

/** Every active session of the person behind this cookie, this one first, then the most recently used. */
export async function sessionsFor(cookie: SessionCookie): Promise<SessionSummary[]> {
  const [sessions, own] = await Promise.all([
    apiRequest<ApiSession[]>(cookie, `${AUTH}/list-sessions`),
    apiRequest<SessionBody | null>(cookie, `${AUTH}/get-session`),
  ]);
  return sessions
    .map((s) => ({
      id: s.id,
      userAgent: s.userAgent ?? null,
      ipAddress: s.ipAddress ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      current: s.id === own?.session.id,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/**
 * Sign one of the person's other sessions out. The page names it by id; the token is looked up here, among
 * this person's own sessions, so a forged id can only ever miss. This browser's own session is refused:
 * signing out of it is the Sign out button, which also clears the cookie.
 */
export async function revokeSession(cookie: SessionCookie, id: string): Promise<boolean> {
  const [sessions, own] = await Promise.all([
    apiRequest<ApiSession[]>(cookie, `${AUTH}/list-sessions`),
    apiRequest<SessionBody | null>(cookie, `${AUTH}/get-session`),
  ]);
  const target = sessions.find((s) => s.id === id);
  if (!target || target.id === own?.session.id) return false;
  await apiRequest(cookie, `${AUTH}/revoke-session`, { method: "POST", body: { token: target.token } });
  return true;
}

/** Sign out every session of this person except the one this browser holds. */
export async function revokeOtherSessions(cookie: SessionCookie): Promise<void> {
  await apiRequest(cookie, `${AUTH}/revoke-other-sessions`, { method: "POST", body: {} });
}

/** The person behind a session cookie, or null when the API says the session is gone. */
export async function accountFor(cookie: SessionCookie): Promise<Account | null> {
  let session: SessionBody | null;
  try {
    session = await apiRequest<SessionBody | null>(cookie, `${AUTH}/get-session`);
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) return null;
    throw error;
  }
  if (!session?.user) return null;
  const { workspaces, twoFactor } = await apiRequest<{
    workspaces: Workspace[];
    twoFactor?: { required?: boolean; verified?: boolean };
  }>(cookie, "/api/v1/me/workspaces");
  const shell = await personaFor(cookie, session.user, workspaces);
  return {
    user: session.user,
    workspaces,
    persona: asPerson(shell, session.user),
    twoFactor: { required: twoFactor?.required === true, verified: twoFactor?.verified === true },
  };
}

/**
 * A demo persona is the person it describes. Anyone else borrows a shell (home, navigation) but keeps
 * their own name and email, so a real owner never sees "Didier Mugenzi" on their own workspace.
 */
function asPerson(shell: Persona, user: ApiUser): Persona {
  if (shell.email === user.email.toLowerCase()) return shell;
  const name = user.name?.trim() || user.email.split("@")[0];
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
  return { ...shell, name, firstName: parts[0] ?? name, initials: initials || "?", email: user.email };
}

const ROLE_PERSONA: Record<string, PersonaId> = {
  owner: "owner",
  manager: "manager",
  receptionist: "frontdesk",
  finance: "finance",
  hr: "hr",
  housekeeper: "housekeeper",
};

/**
 * Which interface shell a person gets. A demo persona is matched by email (its story, home and
 * navigation are written for it); anyone else gets the shell of their strongest real grant, so a
 * real business owner signing in lands on the owner workspace of their own business.
 */
async function personaFor(cookie: SessionCookie, user: ApiUser, workspaces: Workspace[]): Promise<Persona> {
  const demo = personaByEmail(user.email);
  if (demo) return demo;
  const business = workspaces.filter((w) => w.kind === "business" && w.orgRole);
  const order = ["owner", "manager", "finance", "hr", "receptionist", "housekeeper"];
  business.sort((a, b) => order.indexOf(a.orgRole ?? "") - order.indexOf(b.orgRole ?? ""));
  const top = business[0];
  if (top?.domain === "broker") return personas.broker;
  if (top?.domain === "residence" && (top.orgRole === "owner" || top.orgRole === "manager")) return personas.residence;
  if (top?.orgRole && ROLE_PERSONA[top.orgRole]) return personas[ROLE_PERSONA[top.orgRole]];
  if (await holds(cookie, "/api/v1/me/staff")) return personas.ops;
  if (await holds(cookie, "/api/v1/me/oversight")) return personas.officer;
  return personas.guest;
}

/** True when a /me/* grant read answers with at least one grant. */
async function holds(cookie: SessionCookie, path: string): Promise<boolean> {
  try {
    const body = await apiRequest<unknown>(cookie, path);
    if (Array.isArray(body)) return body.length > 0;
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      for (const key of ["roles", "assignments", "consoles", "permissions"]) {
        const v = b[key];
        if (Array.isArray(v) && v.length > 0) return true;
      }
      return b.isStaff === true;
    }
    return false;
  } catch {
    return false;
  }
}

/** The business workspace a persona's screens act in, by org domain (owner Didier holds two). */
export function workspaceFor(
  account: Pick<Account, "workspaces">,
  domain: "hospitality" | "residence" | "broker" = "hospitality",
): Workspace | null {
  const business = account.workspaces.filter((w) => w.kind === "business");
  return business.find((w) => w.domain === domain) ?? business[0] ?? null;
}
