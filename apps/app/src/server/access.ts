/**
 * What a signed-in person may open here, and where they land, from what the API told us (ADR-076 G12 to
 * G14). No `next/*` imports: the session helpers, the layouts and the tests all read it.
 *
 * Outside the demo nothing here decides from a persona, a role name or a fixture. Business screens open
 * from the `grants` on the person's workspace (the products the business has on and the permissions their
 * role holds, under the new names); staff and oversight screens from the API's own staff and oversight
 * answers. A demo persona, matched by email on the demo only, keeps the story written for it
 * (`canAccess`). Every one of these checks is an affordance: the API refuses the same people.
 */
import {
  type BoardId,
  canAccess,
  homeHref,
  PRODUCT_HOME,
  SCREEN_REQUIRES,
  type ScreenProduct,
  screens,
  type WorkspaceContext,
} from "@injishi/data";
import { setupPath } from "../lib/setup-path";

/** One product a business has on, already narrowed to the branches this person covers. */
export interface EnabledProduct {
  id: string;
  branches: "all" | string[];
}

/** A role scope: only `branch` exists until a product names what another kind restricts. */
export interface RoleScope {
  kind: string;
  ids: string[];
}

/**
 * What a person holds at one business (`WorkspaceGrants` in @injishi/contracts, which this app does not
 * depend on; the fields it reads, copied by hand like `Workspace` beside it).
 */
export interface WorkspaceGrants {
  family: "business";
  products: EnabledProduct[];
  roles: { roleId: string | null; key: string; name: string; kind: string; scopes: RoleScope[] }[];
  permissions: { key: string; scopes: RoleScope[] }[];
}

/** One branch of a business as the grant carries it. */
export interface WorkspaceBranch {
  id: string;
  name: string;
  districtName: string | null;
  isHeadOffice: boolean;
}

/** One workspace from GET /api/v1/me/workspaces (the fields this app reads). */
export interface Workspace {
  workspaceId: string;
  kind: "personal" | "business" | "broker" | string;
  orgId: string | null;
  orgName: string | null;
  domain: "hospitality" | "residence" | string | null;
  orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | string | null;
  registrationStatus: string | null;
  permissions: string[];
  branches: WorkspaceBranch[];
  branchCoverage?: "all" | "limited" | null;
  label: string;
  /** Set on every business workspace by an API that has ADR-076 slice G; absent on an older one. */
  grants?: WorkspaceGrants;
}

/** Why a screen was refused, named so the access-denied screen can say it (G14). */
export type ScreenRefusal = "session" | "workspace" | "operational" | "entitlement" | "permission";
export type ScreenDecision = { ok: true } | { ok: false; layer: ScreenRefusal };

/** What the decisions read about the signed-in person. */
export interface AccessSubject {
  /** A demo persona on the demo: judged by its story, never by grants. */
  demo: boolean;
  personaId: Parameters<typeof canAccess>[0];
  workspaces: Workspace[];
  /** The business workspace the shell acts in, or null. */
  active: Workspace | null;
  staff: boolean;
  oversight: boolean;
}

/** Is this product on in the grant, at this branch or anywhere the person covers? A lookup, never a rule. */
export function productOn(grants: WorkspaceGrants | undefined, product: string, branchId?: string | null): boolean {
  const held = grants?.products.find((p) => p.id === product);
  if (!held) return false;
  if (!branchId || held.branches === "all") return true;
  return held.branches.includes(branchId);
}

/** Does the grant hold any of these permissions (new names)? */
export function holdsAny(grants: WorkspaceGrants | undefined, keys: readonly string[]): boolean {
  return keys.some((key) => grants?.permissions.some((p) => p.key === key) ?? false);
}

/** Does the grant hold any permission of this product (`pms.` and the like)? */
function holdsIn(grants: WorkspaceGrants | undefined, product: string): boolean {
  return grants?.permissions.some((p) => p.key.startsWith(`${product}.`)) ?? false;
}

/** May this person open this screen, and if not, which layer refused (G14)? */
export function screenDecision(subject: AccessSubject | null, board: BoardId): ScreenDecision {
  const requires = SCREEN_REQUIRES[board];
  if (requires.family === "public") return { ok: true };
  if (!subject) return { ok: false, layer: "session" };
  if (subject.demo) return canAccess(subject.personaId, board) ? { ok: true } : { ok: false, layer: "permission" };
  switch (requires.family) {
    case "self":
      return { ok: true };
    case "staff":
      return subject.staff ? { ok: true } : { ok: false, layer: "workspace" };
    case "oversight":
      return subject.oversight ? { ok: true } : { ok: false, layer: "workspace" };
    case "broker":
      return subject.workspaces.some((w) => w.kind === "broker") ? { ok: true } : { ok: false, layer: "workspace" };
    case "business": {
      const active = subject.active;
      if (!active) return { ok: false, layer: "workspace" };
      const needsPower = requires.product !== "account" || requires.anyPermission !== undefined;
      if (active.registrationStatus !== "active" && needsPower) return { ok: false, layer: "operational" };
      if (requires.product && !productOn(active.grants, requires.product)) return { ok: false, layer: "entitlement" };
      if (requires.anyPermission && !holdsAny(active.grants, requires.anyPermission)) {
        return { ok: false, layer: "permission" };
      }
      return { ok: true };
    }
  }
}

/**
 * Where this person lands (G14). A demo persona keeps its home. A business that is not active yet opens
 * its setup page, which says where it stands. An owner or a manager keeps their own home; anyone else
 * keeps their role's home while they can open it. When they cannot (its product is off, or their role
 * has no shell of its own), they land on the first of PMS, Residence, Outlets, POS, HR and Finance that is
 * on and that they hold a permission in. Staff, officers and brokers keep the home of their shell; a
 * person holding none of these returns `fallback` (web's own workspace).
 */
export function homeFor(subject: AccessSubject, shellHome: BoardId, shellId: string, fallback: string): string {
  if (subject.demo) return homeHref(subject.personaId ?? "guest");
  const active = subject.active;
  if (active) {
    if (active.registrationStatus !== "active") return setupPath(active.workspaceId);
    if (screenDecision(subject, shellHome).ok) return screens[shellHome].href;
    if (shellId === "owner" || shellId === "manager") return screens.Account.href;
    for (const { product, board } of PRODUCT_HOME) {
      if (productOn(active.grants, product) && holdsIn(active.grants, product) && screenDecision(subject, board).ok) {
        return screens[board].href;
      }
    }
    return screens.Account.href;
  }
  if (shellId === "guest") return fallback;
  return screens[shellHome].href;
}

/** The product of a screen, for the navigation filter and the access-denied wording. */
export function productOf(board: BoardId): ScreenProduct | undefined {
  return SCREEN_REQUIRES[board].product;
}

const ROLE_WORDS: Record<string, string> = {
  owner: "the owner",
  manager: "a manager",
  receptionist: "on the front desk",
  finance: "in finance",
  hr: "in HR",
  housekeeper: "in housekeeping",
};

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter((p) => /[A-Za-z0-9]/.test(p));
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function roleName(w: Workspace): string {
  return w.grants?.roles[0]?.name ?? (w.orgRole ? w.orgRole.charAt(0).toUpperCase() + w.orgRole.slice(1) : "Member");
}

/**
 * The switcher's context, built from the person's own workspaces (G13): the business in view with the
 * branches they cover, and every other business they hold, each linking to its own address. Never a demo
 * persona's businesses. Null when the person holds no business.
 */
export function switcherFor(workspaces: Workspace[], active: Workspace | null): WorkspaceContext | null {
  if (!active) return null;
  const name = active.orgName ?? active.label;
  const covered = active.branches ?? [];
  const many = covered.length > 1;
  const kind = active.domain === "residence" ? "Residence" : "Hospitality";
  const roleKey = active.grants?.roles[0]?.key ?? active.orgRole ?? "";
  return {
    kind: "business",
    workspaceId: active.workspaceId,
    ini: initialsOf(name),
    name,
    meta: `${kind} · ${covered.length} ${covered.length === 1 ? "branch" : "branches"}`,
    role: roleName(active),
    rolePhrase: ROLE_WORDS[roleKey] ? `You are ${ROLE_WORDS[roleKey]} here.` : undefined,
    branches: [
      ...(many ? [{ id: "all", name: "All branches", meta: `${covered.length} branches` }] : []),
      ...covered.map((b) => ({
        id: b.id,
        name: b.name,
        meta: b.districtName ?? (b.isHeadOffice ? "Head office" : ""),
      })),
    ],
    currentBranch: many ? "all" : (covered[0]?.id ?? ""),
    // "Manage branches" opens business settings, which keeps the branches.
    canManage: holdsAny(active.grants, ["property.listing.manage", "account.team.manage"]),
    others: workspaces
      .filter((w) => w.kind === "business" && w.workspaceId !== active.workspaceId)
      .map((w) => {
        const other = w.orgName ?? w.label;
        return {
          ini: initialsOf(other),
          name: other,
          meta: w.registrationStatus === "active" ? roleName(w) : `${roleName(w)} · registration in progress`,
          href: `/w/${w.workspaceId}`,
        };
      }),
    invite: null,
  };
}
