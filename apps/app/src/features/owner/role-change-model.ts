import type {
  TeamRolesMember,
  TeamRolesPermissionArea,
  TeamRolesRole,
  TeamRolesRoleId,
} from "@injishi/data/fixtures/owner";
import type { TeamRolesPresets } from "./TeamRolesModel";

/**
 * Changing a team member's role (Setup → Team → Manage → Change role): what the screen shows before the owner
 * confirms. Display only. Every permission and its wording come from the business's own role settings
 * (`GET /ops/roles`, as the page already reads them); nothing here grants anything. The API decides who may change a
 * role (the owner, by `team.manage`), refuses the owner's role and "owner" as a new role, and audits the change.
 */

export interface PermissionItem {
  key: string;
  /** The API's own words for it ("Take payment and settle bills"). */
  description: string;
}

export interface AreaChange {
  areaId: string;
  areaLabel: string;
  items: PermissionItem[];
}

export interface PermissionChange {
  gained: AreaChange[];
  lost: AreaChange[];
  /** How many permissions they hold before and after (unchanged). */
  kept: number;
}

/** The permissions a role holds in this business, as saved (never unsaved edits on the Roles tab). */
export function roleKeys(presets: TeamRolesPresets, role: TeamRolesRoleId): string[] {
  return [...(presets[role] ?? [])];
}

/**
 * What moving from one role to another adds and removes, grouped by the business's own permission areas, in their
 * order. A key the areas do not list (should not happen) is still shown, under "Other", by its key.
 */
export function permissionChange(
  areas: readonly TeamRolesPermissionArea[],
  fromKeys: readonly string[],
  toKeys: readonly string[],
): PermissionChange {
  const from = new Set(fromKeys);
  const to = new Set(toKeys);
  const group = (keys: Set<string>): AreaChange[] => {
    const out: AreaChange[] = [];
    const seen = new Set<string>();
    for (const a of areas) {
      const items = a.permissions
        .filter((p) => keys.has(p.key))
        .map((p) => ({ key: p.key, description: p.description }));
      for (const p of items) seen.add(p.key);
      if (items.length) out.push({ areaId: a.id, areaLabel: a.label, items });
    }
    const rest = [...keys].filter((k) => !seen.has(k)).sort();
    if (rest.length)
      out.push({ areaId: "other", areaLabel: "Other", items: rest.map((k) => ({ key: k, description: k })) });
    return out;
  };
  const gained = new Set([...to].filter((k) => !from.has(k)));
  const lost = new Set([...from].filter((k) => !to.has(k)));
  return { gained: group(gained), lost: group(lost), kept: [...to].filter((k) => from.has(k)).length };
}

/**
 * Permissions that deserve a second look before someone gets them: money, staff access, how the business is set up,
 * and customer data. Only real permission keys of the platform (`@injishi/contracts` authz); the reason is ours, the
 * permission's own wording stays the API's.
 */
const SENSITIVE: Readonly<Record<string, string>> = {
  "money.view": "Money",
  "register.operate": "Money",
  "shift.review": "Money",
  "pos.refund": "Money",
  "ebm.refund": "Money",
  "refund.decide": "Money",
  "pos.override": "Money",
  "payout.manage": "Money",
  "expense.manage": "Money",
  "deposit.return": "Money",
  "folio.close": "Money",
  "payroll.draft": "Money",
  "payroll.run": "Money",
  "team.manage": "Staff access",
  "team.invite": "Staff access",
  "people.manage": "Staff access",
  "outlet.manage": "Business setup",
  "menu.manage": "Business setup",
  "ebm.manage": "Business setup",
  "tax.manage": "Business setup",
  "lease.sign": "Business setup",
  "customer.admin": "Customer data",
};

export interface SensitiveGain extends PermissionItem {
  /** "Money", "Staff access", "Business setup" or "Customer data". */
  kind: string;
}

/** The sensitive permissions among those gained, in the order shown. */
export function sensitiveGains(change: PermissionChange): SensitiveGain[] {
  return change.gained.flatMap((a) =>
    a.items.filter((p) => SENSITIVE[p.key]).map((p) => ({ ...p, kind: SENSITIVE[p.key] as string })),
  );
}

export interface RoleChoice {
  id: TeamRolesRoleId;
  name: string;
  /** How many permissions it holds in this business. */
  count: number;
  proposed: boolean;
  current: boolean;
}

/**
 * The roles a member may be moved to: the business's own roles that can be granted (never the owner, never a role
 * still being defined), with the current one marked. `roles` is already narrowed to what this kind of business offers.
 */
export function roleChoices(
  roles: readonly TeamRolesRole[],
  presets: TeamRolesPresets,
  current: TeamRolesRoleId,
): RoleChoice[] {
  return roles
    .filter((r) => r.id !== "owner" && r.invitable && !r.beingDefined)
    .map((r) => ({
      id: r.id,
      name: r.name,
      count: roleKeys(presets, r.id).length,
      proposed: r.proposed,
      current: r.id === current,
    }));
}

/** What the Manage panel may offer for a member's role. */
export type RoleAction = "change" | "owner" | "invited" | "pending" | "revoked";

export function roleAction(m: Pick<TeamRolesMember, "role" | "status">): RoleAction {
  if (m.role === "owner") return "owner";
  if (m.status === "invited") return "invited";
  if (m.status === "pending") return "pending";
  if (m.status === "revoked") return "revoked";
  return "change";
}

/** Why the role of this member cannot be changed here, in words the owner can act on (null: it can). */
export const ROLE_ACTION_HELP: Readonly<Record<Exclude<RoleAction, "change">, string>> = {
  owner: "The owner's role cannot be changed. Ownership moves only through Transfer ownership.",
  invited:
    "An invitation cannot be changed once sent. To give them another role, cancel this invitation and send a new one with the right role.",
  pending: "This invitation is waiting for your approval. Approve or decline it first.",
  revoked: "This person no longer has access, so there is no role to change.",
};
