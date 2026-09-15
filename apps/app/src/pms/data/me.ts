import { WorkspaceAccess, workspaceLabel } from "@injishi/contracts";
import type {
  BranchCoverage,
  DepartmentCategory,
  OrgRegistrationStatus,
  Permission,
  WorkspaceBranch,
} from "@injishi/contracts";

import { API_BASE, REQUEST_TIMEOUT_MS, getJson } from "./api";
import type { OrgRole, WorkspaceKey } from "./types";

/**
 * The client for `/api/v1/me/*` (Spec 0004).
 *
 * This is what turns the workspace switcher from an opinion into a fact. The
 * app used to hold `ws` and `role` as free local state, so "who am I" was a
 * costume you picked. Here the answer comes from real grant rows, resolved and
 * enforced server side, and the app only renders it.
 *
 * The four workspaces this app shows are NOT four kinds of row. Host and
 * Landlord are both `business`, told apart by the org's domain. Mapping that
 * correctly is the whole job of this file.
 *
 * It no longer reads `/me/oversight`. The government consoles are a separate app
 * on a separate session (ADR-018, move 2), and an operator app that still asked
 * "which console do you hold" would be describing a surface it cannot open.
 */

export type MeStatus =
  /** Still asking. Render neither branch yet. */
  | "loading"
  /** The API answered with this person's grants. */
  | "resolved"
  /** The API answered, and nobody is signed in. */
  | "anonymous"
  /** The API could not be reached. Says nothing either way about the session. */
  | "unreachable";

/** One workspace the operator may open, in the app's own vocabulary. */
export interface MyWorkspace {
  key: WorkspaceKey;
  label: string;
  /** Null in Broker and Personal, which carry no org role. */
  role: OrgRole | null;
  /** Resolved for THIS workspace, never global to the person. */
  permissions: Permission[];
  /**
   * Where the business sits in the registration pipeline. Null outside a
   * business workspace.
   *
   * On the wire because it is what tells "your role never had this power" from
   * "your business is not approved yet" (ADR-012, AC-2). Both arrive as an
   * empty `permissions` array, and telling a registrant watching their own
   * pipeline that their role is wrong sends them to fix the wrong thing.
   */
  registrationStatus: OrgRegistrationStatus | null;
  /** Every workspace this app serves has one. */
  workspaceId: string | null;
  /**
   * The USALI department categories this business runs (ADR-035, D-a).
   *
   * The nav SECTIONS are a function of this, and screen access is a function
   * of the nav, so this is the server deciding which doors exist. It used to
   * come from `data/demo.ts`, which meant a fixture decided.
   *
   * Empty outside a business workspace, and empty for a business whose
   * departments are unseeded. Empty means "no optional section", never
   * "everything": a nav has to fail closed.
   */
  departments: DepartmentCategory[];
  /**
   * What this workspace's property is called (ADR-035).
   *
   * On the GRANT rather than read from `/inventory/properties`, because that
   * controller is gated on `listing.manage`: the topbar names the property on
   * every screen, and a receptionist was taking a 403 on every page load for a
   * name. Identity is not a listing operation.
   *
   * Null outside a business workspace, and null for a business with no
   * property yet.
   */
  propertyName: string | null;
  /**
   * Whether this member covers every branch of the business, or only some
   * (ADR-054). The Branches screen hides the org wide moves from a `limited`
   * member; the API refuses them either way. Null outside a business workspace.
   */
  branchCoverage: BranchCoverage | null;
  /**
   * The active branches this member covers, head office first (ADR-054 AC-S3).
   * The branch switcher reads this, never `/inventory/properties`: a
   * receptionist chooses a branch too, and may not manage listings. Empty
   * outside a business workspace.
   */
  branches: WorkspaceBranch[];
}

/**
 * Whether the emailed step-up stands between this session and the app (F-S02).
 *
 * No `enabled`: an emailed code needs nothing enrolled, so "required and not
 * yet verified" is the only outstanding state there is.
 */
export interface TwoFactorState {
  required: boolean;
  verified: boolean;
}

export interface MeState {
  status: MeStatus;
  workspaces: MyWorkspace[];
  /**
   * From the same answer as the grants, so the boundary can send a person to
   * enrol or to present a code BEFORE any operator route 403s on them. Null
   * when the API did not answer.
   */
  twoFactor: TwoFactorState | null;
  /**
   * The workspace this session last acted in, or null (ADR-018, D-m).
   *
   * A hint about ORDER, never about access: it only ever names one of the
   * workspaces above, and holding it grants nothing. It is what lets the app
   * tell three hotels apart when they all rank the same on kind.
   */
  activeWorkspaceId: string | null;
}

/** Unvalidated. The shape is only known after `WorkspaceAccess` parses it. */
interface WorkspacesResponse {
  workspaces?: unknown;
  activeWorkspaceId?: unknown;
  twoFactor?: unknown;
}

/** Read the two-factor answer defensively; a missing field is "not answered". */
export function toTwoFactorState(raw: unknown): TwoFactorState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.required !== "boolean" || typeof r.verified !== "boolean") {
    return null;
  }
  return { required: r.required, verified: r.verified };
}

/**
 * Which of the app's six workspaces an API workspace is.
 *
 * Pure and exported so the mapping can be tested without a server. Returns null
 * for a kind this app has no surface for, rather than guessing.
 */
export function toWorkspaceKey(
  access: Pick<WorkspaceAccess, "kind" | "domain">,
): WorkspaceKey | null {
  switch (access.kind) {
    case "business":
      // The one place Host and Landlord are told apart.
      return access.domain === "residence" ? "landlord" : "host";
    case "broker":
      return "broker";
    case "personal":
      // Personal is a real workspace and this app is not its home. It moved to
      // `apps/web` at plain paths (ADR-018, D-b), so the operator app has no
      // surface for it and says so rather than offering a door to nothing.
      return null;
    default:
      return null;
  }
}

/**
 * Every workspace this person may open, in the order the switcher shows them.
 *
 * Resolves once and always settles, into exactly one of three answers:
 *
 *   `anonymous`    the API returned 401. There is no session.
 *   `unreachable`  we could not ask. Says nothing either way about the session.
 *   `resolved`     the API answered. The list may be EMPTY, which means this
 *                  person holds nothing yet — not that they are signed out.
 *
 * Callers must not merge any two of these. A network blip is not a sign out,
 * and an empty list is not one either; showing the sign-in screen for either
 * one tells an operator to fix something that is not broken.
 */
export async function fetchMyWorkspaces(): Promise<MeState> {
  const ws = await getJson<WorkspacesResponse>("/me/workspaces");

  // "No session" is a real answer and "we could not ask" is not, so they are
  // checked in that order and only the first sends anyone to sign in.
  if (ws.outcome === "unauthenticated") {
    return { status: "anonymous", workspaces: [], activeWorkspaceId: null, twoFactor: null };
  }

  if (ws.outcome === "failed") {
    return { status: "unreachable", workspaces: [], activeWorkspaceId: null, twoFactor: null };
  }

  const workspaces: MyWorkspace[] = [];

  // Validate against the contract package own schema (Spec 0004, D-g). A drift
  // is not something to render half of: treat it as unreachable rather than
  // showing a workspace list we cannot vouch for.
  const parsed = WorkspaceAccess.array().safeParse(
    ws.outcome === "ok" ? (ws.data.workspaces ?? []) : [],
  );
  if (ws.outcome === "ok" && !parsed.success) {
    return { status: "unreachable", workspaces: [], activeWorkspaceId: null, twoFactor: null };
  }

  for (const w of parsed.success ? parsed.data : []) {
    const key = toWorkspaceKey(w);
    if (!key) continue;
    workspaces.push({
      key,
      // Derived, so computed here from validated fields using the one
      // definition of it. The endpoint also sends a label; that does not make
      // it a source of truth.
      label: workspaceLabel(w),
      role: w.orgRole,
      permissions: w.permissions,
      registrationStatus: w.registrationStatus,
      workspaceId: w.workspaceId,
      departments: w.departments,
      propertyName: w.propertyName,
      branchCoverage: w.branchCoverage,
      branches: w.branches,
    });
  }

  // The server answered, so this IS resolved — even with nothing in it.
  //
  // An empty list used to be reported as `anonymous`, which says "you are not
  // signed in". That is a different fact, and it is usually the wrong one: the
  // owner of a business still in the registration pipeline is signed in and
  // holds no workspace yet, and so is a brand new account. Telling either of
  // them to sign in sends them to fix something that is not broken, and behind
  // the middleware gate it loops, because they already have a session.
  const active =
    ws.outcome === "ok" && typeof ws.data.activeWorkspaceId === "string"
      ? ws.data.activeWorkspaceId
      : null;

  const twoFactor =
    ws.outcome === "ok" ? toTwoFactorState(ws.data.twoFactor) : null;

  return { status: "resolved", workspaces, activeWorkspaceId: active, twoFactor };
}

/**
 * Record which workspace this session is acting in.
 *
 * Returns false when the server refused, which is the case that matters: the
 * refusal is the control, and the app must not switch its own view on a no.
 */
export async function setActiveWorkspace(
  workspaceId: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1/me/active-workspace`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
