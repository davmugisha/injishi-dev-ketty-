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

import { isLeaderRole, landlordBusiness, type MeContext, type MeContextBusiness } from "@injishi/contracts";
import {
  type BoardId,
  DEMO_OTP,
  type Persona,
  type PersonaId,
  personaByEmail,
  personas,
  screens,
  type WorkspaceContext,
} from "@injishi/data";
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

/** One person on the API's demo roster (`GET /api/v1/demo/personas`), the fields the sign-in page reads. */
export interface DemoRosterPerson {
  email: string;
  name: string;
  headline: string | null;
  roles: string[];
}

/**
 * The API's own demo roster (2026-10-26): the people the seeds create on `@demo.injishi.com`
 * (the PSF managers among them), beside this app's personas. Empty outside the demo, or when the
 * API does not answer, so the page never lists anyone a code could not reach.
 */
export async function demoRoster(): Promise<DemoRosterPerson[]> {
  try {
    const rows = await apiRequest<
      { email: string; name: string; seats?: { label?: string; role?: string }[]; story?: { headline?: string } }[]
    >(null, "/api/v1/demo/personas");
    return rows.map((r) => ({
      email: r.email,
      name: r.name,
      headline: r.story?.headline ?? null,
      roles: (r.seats ?? []).map((s) => [s.role, s.label].filter(Boolean).join(" · ")).filter(Boolean),
    }));
  } catch {
    return [];
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

type VerifyResult =
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
  /**
   * Who this person is across the product (`GET /me/context`): their businesses, the homes they rent,
   * leader or officer seats, broker record, staff roles, and where they land. Null only when the API
   * predates the route.
   */
  context: MeContext | null;
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
interface SessionSummary {
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
  const [{ workspaces, twoFactor }, context] = await Promise.all([
    apiRequest<{
      workspaces: Workspace[];
      twoFactor?: { required?: boolean; verified?: boolean };
    }>(cookie, "/api/v1/me/workspaces"),
    meContext(cookie),
  ]);
  const shell = await personaFor(cookie, session.user, workspaces, context);
  return {
    user: session.user,
    workspaces,
    context,
    persona: asPerson(shell, session.user, workspaces, context),
    twoFactor: { required: twoFactor?.required === true, verified: twoFactor?.verified === true },
  };
}

/** `GET /me/context`, or null from an API that does not have it yet (a 404). Other failures throw. */
async function meContext(cookie: SessionCookie): Promise<MeContext | null> {
  try {
    return await apiRequest<MeContext>(cookie, "/api/v1/me/context");
  } catch (error) {
    if (error instanceof ApiError && error.notFound) return null;
    throw error;
  }
}

/**
 * A demo persona is the person it describes. Anyone else borrows a shell (home, navigation) but keeps
 * their own name and email, so a real owner never sees "Didier Mugenzi" on their own workspace. A
 * landlord's or a hotel's switcher is their own businesses, read from the API, never the shell's: the
 * shell's is the demo's "Amahoro Hospitality Ltd".
 */
function asPerson(shell: Persona, user: ApiUser, workspaces: Workspace[], context: MeContext | null): Persona {
  if (shell.email && shell.email === user.email.toLowerCase()) return shell;
  const business = !context
    ? null
    : shell.id === "landlord"
      ? landlordBusiness(context.businesses, context.activeWorkspaceId)
      : HOTEL_SHELLS.has(shell.id)
        ? hotelBusiness(context)
        : null;
  // An account with no name of its own: the owner's lease signatory name (the owner signs for the
  // business), a broker's registered name, the landlord's business, and only then the email's first part.
  const signatory = business?.role === "owner" ? business.signatoryName?.trim() : "";
  const name =
    user.name?.trim() ||
    signatory ||
    context?.broker?.name?.trim() ||
    business?.orgName.trim() ||
    user.email.split("@")[0];
  const parts = name.split(/\s+/).filter(Boolean);
  const person = { ...shell, name, firstName: parts[0] ?? name, initials: initialsOf(name), email: user.email };
  if (!context || !business) return person;
  const role = ROLE_LABEL[business.role ?? ""] ?? "Member";
  return { ...person, role, workspace: businessSwitcher(business, workspaces, context) };
}

/** The shells a hotel role wears (`ROLE_PERSONA`), each of which gets the real business in its switcher. */
const HOTEL_SHELLS: ReadonlySet<string> = new Set([
  "owner",
  "manager",
  "frontdesk",
  "finance",
  "hr",
  "housekeeper",
  "waiter",
  "store",
]);

/**
 * The hospitality business in view: the one the session chose, else a running one, else one still
 * in review (its owner sets the listing up before approval).
 */
function hotelBusiness(context: MeContext): MeContextBusiness | null {
  const held = context.businesses.filter((b) => b.domain === "hospitality" && b.role !== null);
  return (
    held.find((b) => b.workspaceId === context.activeWorkspaceId) ?? held.find((b) => b.operational) ?? held[0] ?? null
  );
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
  return initials || "?";
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  receptionist: "Front desk",
  finance: "Finance",
  hr: "HR",
  housekeeper: "Housekeeping",
};

const ROLE_PHRASE: Record<string, string> = {
  owner: "You\u2019re the owner here.",
  manager: "You\u2019re a manager here.",
  finance: "You look after the money here.",
};

/** Where another business of this person opens: a residence business on its home, a hotel on the role's. */
function homeBoardOf(business: MeContextBusiness): BoardId {
  if (business.domain === "residence") return "ResidenceHome";
  const persona = ROLE_PERSONA[business.role ?? ""];
  return persona ? personas[persona].home : "OwnerHome";
}

/**
 * The business switcher, from real records: the business in view with its buildings (a landlord) or
 * branches (a hotel), the person's other businesses (each switched to with `POST /me/active-workspace`),
 * and their own home when they rent one too.
 */
function businessSwitcher(business: MeContextBusiness, workspaces: Workspace[], context: MeContext): WorkspaceContext {
  const grant = workspaces.find((w) => w.workspaceId === business.workspaceId);
  const rentals = business.domain === "residence";
  const unit = rentals ? "building" : "branch";
  const units = rentals ? "buildings" : "branches";
  // A residence workspace names its buildings by `propertyId`, a hotel's its branches by `id`.
  const branches = (grant?.branches ?? []).flatMap((b) => {
    if (typeof b !== "object" || b === null || !("name" in b)) return [];
    const id = "propertyId" in b ? b.propertyId : "id" in b ? b.id : null;
    return typeof id === "string" ? [{ id, name: String(b.name), meta: "" }] : [];
  });
  const all =
    branches.length > 1
      ? [{ id: "all", name: `All ${units}`, meta: `${branches.length} ${units}` }, ...branches]
      : branches;
  const others: WorkspaceContext["others"] = context.businesses
    .filter((b) => b.workspaceId !== business.workspaceId && b.role !== null)
    .map((b) => ({
      ini: initialsOf(b.orgName),
      name: b.orgName,
      meta: `${b.domain === "residence" ? "Rentals" : "Hospitality"} · ${ROLE_LABEL[b.role ?? ""] ?? "Member"}${
        b.operational ? "" : " · in review"
      }`,
      board: homeBoardOf(b),
      workspaceId: b.workspaceId,
    }));
  if (context.tenancies.length > 0) {
    others.push({ ini: "MH", name: "My home", meta: "The homes you rent", board: "TenantHome" });
  }
  const role = ROLE_LABEL[business.role ?? ""] ?? "Member";
  return {
    kind: "business",
    ini: initialsOf(business.orgName),
    name: business.orgName,
    meta: `${rentals ? "Rentals" : "Hospitality"} · ${branches.length === 1 ? `1 ${unit}` : `${branches.length} ${units}`}${
      business.operational ? "" : " · in review"
    }`,
    role,
    rolePhrase: ROLE_PHRASE[business.role ?? ""] ?? `You\u2019re a member here as ${role.toLowerCase()}.`,
    branches: all.length > 0 ? all : [{ id: business.workspaceId, name: business.orgName, meta: "" }],
    currentBranch: all[0]?.id ?? business.workspaceId,
    canManage: false,
    others,
    invite: null,
  };
}

const ROLE_PERSONA: Record<string, PersonaId> = {
  owner: "owner",
  manager: "manager",
  receptionist: "frontdesk",
  finance: "finance",
  hr: "hr",
  housekeeper: "housekeeper",
  // The bar and restaurant floor (POS spec, phase 1) wears the outlet staff's tablet shell.
  cashier: "waiter",
  waiter: "waiter",
  bartender: "waiter",
  kitchen: "waiter",
  stock_controller: "store",
};

/**
 * Where a floor role lands: the live floor, or for the kitchen its station board. The demo waiter keeps
 * the story written for her; a real cashier, waiter, bartender or cook lands on the screens that read
 * their outlet from the API.
 */
const ROLE_HOME: Partial<Record<string, BoardId>> = {
  cashier: "PosFloor",
  waiter: "PosFloor",
  bartender: "PosFloor",
  kitchen: "PosStations",
};

/**
 * Operator shell plus the oversight boards a dual-hat person also holds, so an
 * approved business owner who is a district manager can open `/w/…/setup` in the
 * owner portal and still deep-link to `/psf` or `/officer`.
 */
function withOversightBoards(shell: Persona, oversight: string[]): Persona {
  if (oversight.length === 0) return shell;
  const extra =
    oversight.includes("psf_membership_officer")
      ? (personas.psf.access ?? [])
      : oversight.includes("psf_business_officer")
        ? (personas.psfdbo.access ?? [])
        : (["OfficerHome", "OfficerCase", "DelegatedReports"] as const);
  const access = [...new Set([...(shell.access ?? []), ...extra])];
  return access.length === (shell.access?.length ?? 0) ? shell : { ...shell, access: [...access] };
}

/**
 * Which interface shell a person gets. A demo persona is matched by email (its story, home and
 * navigation are written for it); anyone else gets the shell of where they land (`/me/context`, from
 * real records): a running residence business is the landlord's; a hotel is the shell of the
 * person's role there; a tenancy is the tenant's home; then platform staff, an officer or leader, and
 * otherwise the guest side. A residence business still in review opens nothing yet.
 */
async function personaFor(
  cookie: SessionCookie,
  user: ApiUser,
  workspaces: Workspace[],
  context: MeContext | null,
): Promise<Persona> {
  const shell = await shellFor(cookie, user, workspaces, context);
  return personaByEmail(user.email) ? shell : withHats(shell, context);
}

/** Every screen of a persona, by the persona the screen belongs to. */
const boardsOf = (persona: PersonaId): BoardId[] =>
  (Object.values(screens) as { board: BoardId; persona: string | null }[])
    .filter((s) => s.persona === persona)
    .map((s) => s.board);

/**
 * THE OTHER HATS A PERSON WEARS (2026-10-30). A shell is the role they land in; the rest of what they
 * hold stays reachable: a landlord or a hotel owner who is also a village leader opens the guests in
 * their area, a tenant who brokers opens their placements, an officer who rents opens their home. Each
 * adds its screens to the persona's access (the sidebar then lists them, `withOversightNav`); the API
 * still decides what each read returns.
 */
function withHats(shell: Persona, context: MeContext | null): Persona {
  if (!context) return shell;
  const extra: BoardId[] = [];
  const seats = context.oversight.map((g) => g.oversightRole);
  if (shell.id !== "officer" && seats.some((r) => isLeaderRole(r))) extra.push("LeaderGuests", "LeaderReports");
  const reviews = seats.filter((r) => !isLeaderRole(r) && r !== "psf_membership_officer");
  if (shell.id !== "officer" && reviews.length > 0) extra.push("OfficerHome", "OfficerCase", "OfficerDecisions");
  if (shell.id !== "tenant" && context.tenancies.length > 0) extra.push(...boardsOf("tenant"));
  if (shell.id !== "broker" && context.broker?.status === "active") extra.push(...boardsOf("broker"));
  const withSeats = withOversightBoards(
    shell,
    seats.includes("psf_membership_officer") ? ["psf_membership_officer"] : [],
  );
  if (extra.length === 0) return withSeats;
  return { ...withSeats, access: [...new Set([...(withSeats.access ?? []), ...extra])] };
}

/** The shell a person lands in (see `personaFor`). */
async function shellFor(
  cookie: SessionCookie,
  user: ApiUser,
  workspaces: Workspace[],
  context: MeContext | null,
): Promise<Persona> {
  const demo = personaByEmail(user.email);
  if (demo) return demo;
  const landing = context?.landing;
  if (landing?.surface === "landlord") return personas.landlord;
  // A broker's workspace has kind `broker`, never a business: their landing says so (`/me/context`).
  if (landing?.surface === "broker") return personas.broker;
  // The shell of a role in a business, with the floor roles' own home (POS) where they have one.
  const shellFor = (role: string) => {
    const shell = personas[ROLE_PERSONA[role] as PersonaId];
    const home = ROLE_HOME[role];
    return home ? { ...shell, home } : shell;
  };
  if (landing?.surface === "business") {
    const chosen = workspaces.find((w) => w.workspaceId === landing.workspaceId);
    if (chosen?.orgRole && ROLE_PERSONA[chosen.orgRole]) return shellFor(chosen.orgRole);
  }
  const business = workspaces.filter((w) => w.kind === "business" && w.orgRole && w.domain !== "residence");
  const order = [
    "owner",
    "manager",
    "finance",
    "hr",
    "receptionist",
    "cashier",
    "bartender",
    "waiter",
    "stock_controller",
    "kitchen",
    "housekeeper",
  ];
  business.sort((a, b) => order.indexOf(a.orgRole ?? "") - order.indexOf(b.orgRole ?? ""));
  const active = business.filter((w) => w.registrationStatus === "active");
  const topActive = active[0];
  const top = business[0];
  if (top?.orgRole && ROLE_PERSONA[top.orgRole]) return shellFor(top.orgRole);
  if (landing?.surface === "tenant") return personas.tenant;
  if (context ? context.staff.isStaff : await holds(cookie, "/api/v1/me/staff")) return personas.ops;
  // A local leader or DGIE officer reviews no business: they land on the guests in their area.
  if (context && context.oversight.length > 0 && context.oversight.every((g) => isLeaderRole(g.oversightRole)))
    return { ...personas.officer, home: "LeaderGuests" };
  const oversight = context ? context.oversight.map((g) => g.oversightRole) : await oversightRoles(cookie);
  // A PSF District Manager's desk is the PSF console: membership, registration review and the overview.
  if (oversight.includes("psf_membership_officer")) return personas.psf;
  // A BDE, Business Development & Empowerment (2026-11-02): the PSF console, read only for now.
  if (oversight.includes("psf_business_officer")) return personas.psfdbo;
  if (oversight.length > 0) return personas.officer;
  return personas.guest;
}

/** The oversight roles a person holds, from GET /api/v1/me/oversight; none when it cannot be read. */
async function oversightRoles(cookie: SessionCookie): Promise<string[]> {
  try {
    const body = await apiRequest<{ consoles?: { oversightRole?: string }[] }>(cookie, "/api/v1/me/oversight");
    return (body?.consoles ?? []).map((c) => c.oversightRole ?? "").filter(Boolean);
  } catch {
    return [];
  }
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

/** The broker workspace of this person (kind `broker`, one per person), or null. */
export function brokerWorkspace(account: Pick<Account, "workspaces">): Workspace | null {
  return account.workspaces.find((w) => w.kind === "broker") ?? null;
}

/**
 * The business workspace a persona's screens act in, by org domain (owner Didier holds two). A
 * landlord acts in the residence business the session chose (the business switcher), else the first
 * running one.
 */
export function workspaceFor(
  account: Pick<Account, "workspaces"> & Partial<Pick<Account, "context">>,
  domain: "hospitality" | "residence" | "broker" = "hospitality",
): Workspace | null {
  const business = account.workspaces.filter((w) => w.kind === "business");
  if (domain === "residence" && account.context) {
    const chosen = landlordBusiness(account.context.businesses, account.context.activeWorkspaceId);
    const grant = chosen && business.find((w) => w.workspaceId === chosen.workspaceId);
    if (grant) return grant;
  }
  return business.find((w) => w.domain === domain) ?? business[0] ?? null;
}
