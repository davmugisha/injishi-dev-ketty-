import type {
  Db,
  HkStatus,
  Intent,
  OrgRole,
  PropertyKey,
  WorkspaceKey,
} from "../data/types";
import type { PlatformInfo } from "@injishi/contracts";

import type { MeState, MyWorkspace } from "../data/me";

/**
 * The store's shape: state, the action union, and the payload types screens
 * hand it.
 *
 * Split out of store.tsx so the domain reducers under this directory can import
 * them without importing the provider — and without a cycle back through it.
 * `State` is exported here for those reducers only; ../store.tsx deliberately
 * does not re-export it, so the module's public surface is unchanged.
 */

export type Theme = "light" | "dark";

export interface Toast {
  id: number;
  txt: string;
  intent: Intent;
}

/** Deposit deductions staged during a move-out review, keyed by lease. */
export type Deductions = Record<string, [string, number][]>;

export interface State {
  /** The fixture database the screens not yet on the API still read. */
  db: Db;
  /**
   * What `GET /api/v1/platform` said (ADR-043), or null until it answers and
   * whenever it could not be read. It replaced the client side Production/Demo
   * pill: a fixture money action proceeds only when this says `demo`, and the
   * mock banner shows only when it says `sampleData`. Null refuses and hides.
   */
  platform: PlatformInfo | null;
  ws: WorkspaceKey;
  /**
   * The workspace in view, cached from the route (ADR-018, invariant 1).
   *
   * The URL is the source; the workspace layout writes this and nothing reads
   * it back to decide a route. It exists because `ws` alone names a KIND, and
   * an owner running two hotels holds two grants of the same kind: without the
   * id, `currentGrant` picked whichever the API listed first and the second
   * hotel rendered the first hotel's role, permissions and refusal wording.
   *
   * Null before a workspace route has resolved, in which case the lookup falls
   * back to kind for the demo fixtures only.
   */
  workspaceId: string | null;
  prop: PropertyKey;
  role: OrgRole;
  /**
   * The workspaces the API says this person actually holds (Spec 0004, AC-6).
   *
   * Null while unknown, which covers two different situations on purpose: the
   * request is still in flight, or it could not be reached. `grantsStatus` tells
   * them apart, and a network failure must never be read as "you hold nothing".
   * When this is a real list it becomes authoritative: `setWorkspace` and
   * `setRole` below refuse anything not in it.
   */
  grants: MyWorkspace[] | null;
  grantsStatus: MeState["status"];
  /** The second-factor answer that came with the grants (F-S02). */
  twoFactor: MeState["twoFactor"];
  /**
   * The workspace this session last acted in, straight from the API (D-m).
   *
   * The tiebreak when several workspaces of the same kind rank equally. A hint
   * about order only; every route is still refused by `WorkspaceGuard`.
   */
  activeWorkspaceId: string | null;
  theme: Theme;
  /** Staged, not yet returned — a deduction is only real once the deposit goes back. */
  deductions: Deductions;
  toasts: Toast[];
  toastSeq: number;
}

export type Action =
  | { type: "grantsResolved"; me: MeState }
  | { type: "setWorkspace"; ws: WorkspaceKey; workspaceId?: string | null }
  | { type: "setProperty"; prop: PropertyKey }
  | { type: "setRole"; role: OrgRole }
  | { type: "platformResolved"; platform: PlatformInfo | null }
  | { type: "setTheme"; theme: Theme }
  | { type: "toast"; txt: string; intent?: Intent }
  | { type: "dismissToast"; id: number }
  | { type: "approve"; id: string }
  | { type: "decline"; id: string }
  | { type: "checkout"; id: string }
  | { type: "moveReservation"; id: string; room: string; start: number; nights: number; mode: DragMode }
  | { type: "unassignRoom"; id: string }
  | { type: "setHk"; room: string; hk: HkStatus }
  | { type: "advanceTicket"; id: string }
  | { type: "advanceOrder"; id: string }
  | { type: "addCharge"; resId: string; dept: string; label: string; amount: number }
  | { type: "recordPayment"; resId: string; method: string; amount: number }
  | { type: "toggleMenuItem"; dept: string; index: number }
  | { type: "addMenuItem"; dept: string; name: string; price: number }
  | { type: "recordRent"; id: string }
  | { type: "advanceLease"; id: string }
  /* Landlord — property side */
  | { type: "setUnitRent"; unit: string; rent: number }
  | { type: "toggleListing"; unit: string }
  | { type: "addDeduction"; leaseId: string; label: string; amount: number }
  | { type: "returnDeposit"; leaseId: string }
  /* Conversations — the same action across host, landlord and personal */
  | { type: "sendMessage"; scope: ThreadScope; threadId: string; text: string }
  | { type: "readThread"; scope: ThreadScope; threadId: string }
  /* Housekeeping board */
  | { type: "assignTask"; room: string; who: string | null }
  /* What you offer */
  | { type: "toggleAmenity"; scope: "prop" | "room"; code: string; typeKey?: string }
  | { type: "toggleShared"; label: string }
  /* Personal */
  | { type: "payOwnRent" }
;

/** Which workspace's inbox a message action is about. */
export type ThreadScope = "host" | "landlord" | "personal";

export type DragMode = "move" | "resize" | "tray";

export interface CheckInDraft {
  resId: string | null;
  walk: boolean;
  name: string;
  nid: string;
  phone: string;
  room: string;
  nights: number;
  rate: string;
}
