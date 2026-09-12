import { DEMO_PERMISSIONS, buildDb, workspaces } from "../data/demo";
import type { MyWorkspace } from "../data/me";
import type { HospitalityProperty, Intent, PropertyKey, ResidenceProperty } from "../data/types";
import {
  PERMISSION_LABEL,
  REGISTRATION_STAGE_MESSAGE,
  isOperational,
  type Permission,
} from "../authz";
import { readTheme } from "../lib/theme";
import type { State } from "./types";

/**
 * The reducer's shared machinery: how a transition reads the current property,
 * refuses an unpermitted mutation, and speaks back through a toast.
 *
 * These were file-local to store.tsx while the reducer was one switch. They are
 * exported now because the domain slices need them, and they stay in one place
 * so `authorize` remains the single choke point it was.
 */

/** Which property the current workspace is looking at. */
export function propertyKey(s: Pick<State, "ws" | "prop">): PropertyKey | "residence" {
  return s.ws === "landlord" ? "residence" : s.prop;
}

export function initialState(): State {
  return {
    db: buildDb(),
    // Unknown until `GET /api/v1/platform` answers, and unknown refuses a
    // fixture money action and hides the mock banner (ADR-043).
    platform: null,
    ws: "host",
    workspaceId: null,
    prop: "hotel",
    role: "manager",
    // Unknown until the API answers. The demo defaults above keep the app
    // usable standalone; a real answer overrides them.
    grants: null,
    grantsStatus: "loading",
    twoFactor: null,
    activeWorkspaceId: null,
    // Seeded from the class the pre paint boot script left on <html>, which
    // read `localStorage["injishi-theme"]`, the key `apps/web` writes
    // (ADR-037 call 5). On the server there is no document and this is light,
    // which is also what an absent key means.
    theme: readTheme(),
    deductions: {},
    toasts: [],
    toastSeq: 0,
  };
}

/** The fields a capability answer is a function of. Nothing else moves it. */
export type CapabilityView = Pick<State, "grants" | "grantsStatus" | "ws" | "workspaceId" | "role">;

/**
 * The grant for the workspace in view, or undefined before the API answers.
 *
 * BY ID, NEVER BY KIND, once the route has named one (ADR-018, invariant 1).
 * Two hotels are two grants with the same `key`; matching on `ws` handed the
 * second hotel the first hotel's permissions, role and refusal wording, and the
 * "View as" guard compared against the wrong grant. The kind fallback stays
 * only for the moment before a workspace route has resolved, when there is no
 * id to match.
 */
export function currentGrant(s: CapabilityView): MyWorkspace | undefined {
  if (!s.grants) return undefined;
  if (s.workspaceId) return s.grants.find((w) => w.workspaceId === s.workspaceId);
  return s.grants.find((w) => w.key === s.ws);
}

/**
 * What to call the workspace in view (ADR-018, AC-14).
 *
 * `label` on the grant is `workspaceLabel()` from `@injishi/contracts`: the
 * org's own name for a business, and the literal "Personal" or "Broker" for the
 * two kinds that carry no org. One definition, computed server side and
 * recomputed from validated fields client side, so the chrome and the API
 * cannot call the same workspace two different things.
 *
 * It matters more than it used to. The address no longer says which kind of
 * workspace you are in, let alone which business, so the chrome is the only
 * place left that says.
 *
 * Falls back to the demo fixture's name only while the API has not answered.
 */
export function workspaceName(s: State): string {
  const grant = currentGrant(s);
  if (grant) return grant.label;
  return workspaces.find((w) => w.key === s.ws)?.name ?? "Workspace";
}

/**
 * What this person may do in the workspace in view.
 *
 * An ARRAY, resolved by the server, never a role run through a table
 * (ADR-012, AC-4). The app used to ask `can(role, permission)`, which meant the
 * browser held its own copy of the permission matrix and could disagree with
 * the API. Worse, it skipped the registration gate entirely: the owner of a
 * business still at `submitted` was offered all 21 powers, every one of which
 * the server refuses.
 *
 * Before the API answers there is nothing server resolved to read, so the demo
 * fixture stands in and the app keeps working standalone (AC-12). That fixture
 * is data, not a model — see `DEMO_PERMISSIONS`.
 */
export function permissionsOf(s: CapabilityView): readonly Permission[] {
  const grant = currentGrant(s);
  if (grant) return grant.permissions;
  // The fixture stands in only while there is NO server answer. Once the API
  // has answered, a workspace with no grant behind it holds nothing: falling
  // through to the manager fixture here is how a resolved session with no
  // grant for the id in view was offered every button the server refuses.
  if (s.grants !== null) return [];
  return DEMO_PERMISSIONS[s.role] ?? [];
}

/**
 * Why a permission is missing, worded from its CAUSE (ADR-012, AC-2).
 *
 * "Your role cannot do this" and "your business is not approved yet" both
 * arrive as an empty permission array, and they need opposite messages. A
 * registrant watching their own pipeline holds the role already; telling them
 * to fix it sends them somewhere there is nothing to fix. This mirrors the
 * branch `WorkspaceGuard` takes server side, so the toast and the refusal say
 * the same thing.
 */
export function refusalFor(s: CapabilityView, permission: Permission): string {
  const grant = currentGrant(s);
  if (grant?.registrationStatus && !isOperational(grant.registrationStatus)) {
    return REGISTRATION_STAGE_MESSAGE[grant.registrationStatus];
  }
  return `You don't have permission to ${PERMISSION_LABEL[permission]}.`;
}

/**
 * Authorization choke point. A mutation that needs a permission the caller
 * does not hold is refused here — the single place it cannot be routed around.
 * Returns the state unchanged plus a plain denial toast when blocked.
 *
 * This runs in the browser, so it is a product correctness control and not a
 * security boundary. `WorkspaceGuard` is the boundary. What changed is where
 * the answer comes from: the server, now, rather than a table shipped to the
 * client.
 */
export function authorize(s: State, permission: Permission): State | null {
  if (permissionsOf(s).includes(permission)) return null;
  return withToast(s, refusalFor(s, permission), "bad");
}

/** Push a toast as part of the same transition that changed the data. */
export function withToast(s: State, txt: string, intent: Intent = "ok"): State {
  const id = s.toastSeq + 1;
  return { ...s, toastSeq: id, toasts: [...s.toasts, { id, txt, intent }] };
}

export function updateHost(s: State, fn: (p: HospitalityProperty) => HospitalityProperty): State {
  const key = propertyKey(s);
  if (key === "residence") return s;
  return { ...s, db: { ...s.db, [key]: fn(s.db[key]) } };
}

export function updateResidence(s: State, fn: (p: ResidenceProperty) => ResidenceProperty): State {
  return { ...s, db: { ...s.db, residence: fn(s.db.residence) } };
}

export function hostProperty(s: State): HospitalityProperty | null {
  const key = propertyKey(s);
  return key === "residence" ? null : s.db[key];
}
