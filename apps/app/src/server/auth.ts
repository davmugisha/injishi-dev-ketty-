/**
 * Sign-in against the API's Better Auth (email one-time code), and who the signed-in person is.
 * No `next/*` imports: the session helpers in lib/session.ts and the verify scripts both use it.
 *
 * On the demo stack the API accepts the fixed code 123456 for every account (ADR-043); in
 * production it mails a random code. This file does not know which: it forwards what was typed.
 */

import { DEMO_OTP, type Persona, type PersonaId, personaByEmail, personas } from "@injishi/data";
import { ApiError, apiBaseUrl, apiOrigin, apiRequest, type SessionCookie } from "./api";

const AUTH = "/api/auth";

/** One-time codes expire after this long (`OTP_EXPIRY_SECONDS` in @injishi/auth). */
export const OTP_TTL_SECONDS = 600;

/**
 * The fixed sign-in code when the API runs as the demo, else null. Asked of the API
 * (`GET /api/v1/platform`), never assumed: production must never pre-fill or print a code.
 */
export async function demoSignInCode(): Promise<string | null> {
  return (await demoPlatform())?.code ?? null;
}

/** What the sign-in page may say about the demo: its code and when its data was last seeded. Null outside the demo. */
export async function demoPlatform(): Promise<{ code: string; seededAt: string | null } | null> {
  try {
    const platform = await apiRequest<{ environment?: string; seededAt?: string | null }>(null, "/api/v1/platform");
    return platform.environment === "demo" ? { code: DEMO_OTP, seededAt: platform.seededAt ?? null } : null;
  } catch {
    return null;
  }
}

export type SendResult = { ok: true } | { ok: false; reason: "invalid-email" | "too-many" | "unavailable" };

/** "Continue" on the sign-in form: ask the API to send a code to this email. */
export async function sendSignInCode(email: string): Promise<SendResult> {
  try {
    await apiRequest(null, `${AUTH}/email-otp/send-verification-otp`, {
      method: "POST",
      body: { email: email.trim().toLowerCase(), type: "sign-in" },
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
  | { ok: true; cookie: SessionCookie; expiresAt: Date }
  | { ok: false; reason: "wrong-code" | "expired" | "too-many" | "unavailable" };

const SESSION_COOKIE_PART = /session_(token|data)$/;

/** Keep the session cookies the API set, as one `name=value; name=value` header value. */
function sessionCookieFrom(response: Response): { cookie: string; expiresAt: Date } | null {
  const pairs: string[] = [];
  let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  for (const line of response.headers.getSetCookie()) {
    const [pair, ...attrs] = line.split(";").map((p) => p.trim());
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    const name = pair.slice(0, eq);
    if (!SESSION_COOKIE_PART.test(name)) continue;
    pairs.push(pair);
    if (name.endsWith("session_token")) {
      for (const attr of attrs) {
        const [k, v] = attr.split("=");
        if (k.toLowerCase() === "max-age" && Number(v) > 0) expiresAt = new Date(Date.now() + Number(v) * 1000);
        if (k.toLowerCase() === "expires" && v) expiresAt = new Date(attr.slice(attr.indexOf("=") + 1));
      }
    }
  }
  return pairs.some((p) => p.split("=")[0].endsWith("session_token")) ? { cookie: pairs.join("; "), expiresAt } : null;
}

/** "Verify and continue": exchange the typed code for the API's session cookie. */
export async function verifySignInCode(email: string, code: string): Promise<VerifyResult> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${AUTH}/sign-in/email-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", origin: apiOrigin() },
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
  const session = sessionCookieFrom(response);
  if (!session) return { ok: false, reason: "unavailable" };
  return { ok: true, cookie: session.cookie, expiresAt: session.expiresAt };
}

/** End the API session. A failure is ignored: the app forgets the cookie either way. */
export async function signOutOfApi(cookie: SessionCookie): Promise<void> {
  try {
    await apiRequest(cookie, `${AUTH}/sign-out`, { method: "POST", body: {} });
  } catch {
    // The cookie is dropped by the caller regardless.
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
}

interface SessionBody {
  user: ApiUser;
  session: { expiresAt: string };
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
  const { workspaces } = await apiRequest<{ workspaces: Workspace[] }>(cookie, "/api/v1/me/workspaces");
  const shell = await personaFor(cookie, session.user, workspaces);
  return { user: session.user, workspaces, persona: asPerson(shell, session.user) };
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
