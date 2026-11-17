import type {
  TeamRolesInviteDraft,
  TeamRolesMember,
  TeamRolesMemberStatus,
  TeamRolesPermissionArea,
  TeamRolesRole,
  TeamRolesRoleId,
  TeamRolesScope,
  Tone,
} from "@injishi/data/fixtures/owner";
import type { AccessRequestView } from "@injishi/data/fixtures/people";
import type { OwnershipTransferInfo, TransferEligible } from "@/server/ownership-transfer";

/** Everything Team and roles reads, all of it from the API. */
export interface TeamRolesData {
  members: TeamRolesMember[];
  roles: TeamRolesRole[];
  areas: TeamRolesPermissionArea[];
  /** The live businesses and branches a grant can name (sources/owner.ts `teamScopes`). */
  scopes: TeamRolesScope[];
  invite: TeamRolesInviteDraft;
  /** Logins HR asked for while putting people on file, which the owner decides (HR onboarding). */
  accessRequests?: AccessRequestView[];
  /** The business or businesses this team belongs to, as the API names them. */
  businessName: string;
  /** Emails on active employee files in People, or null when People was not read (no `people.view`). */
  employeeFiles: string[] | null;
  /** Whether the person viewing is the business's owner: only they may transfer it. */
  viewerIsOwner?: boolean;
  /** The ownership transfer waiting for an answer, read for the owner only (migration 0155). */
  ownershipTransfer?: OwnershipTransferInfo | null;
  /** Who the owner could ask: active members with a verified identity by the platform's rule (from the API). */
  transferEligible?: TransferEligible[];
}

export const TEAM_ROLES_STATUS: Record<TeamRolesMemberStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invited", tone: "accent" },
  pending: { label: "Awaiting your approval", tone: "warning" },
  revoked: { label: "Revoked", tone: "default" },
};

/** Help line of the Manage Member panel, by the member's situation. */
export const TEAM_ROLES_HELP = {
  owner: "The owner cannot be revoked. Use ownership transfer to hand over the business.",
  active:
    "Revoking access from this screen is not available yet: access ends when the person's staff file is offboarded. You can change their role or the properties they cover.",
  invited: "Cancelling makes the invite link stop working. They never had access.",
  pending: "This invite waits for your approval. Nothing has been sent yet.",
  revoked: "No access. Kept on the list as the record of who had access.",
} as const;

/** Role presets as permission keys per role (the saved baseline the matrix edits are compared with). */
export type TeamRolesPresets = Record<TeamRolesRoleId, string[]>;

/** Unsaved matrix edits, keyed "role:permission". */
export type TeamRolesEdits = Record<string, boolean>;

export function presetsOf(roles: TeamRolesRole[]): TeamRolesPresets {
  return Object.fromEntries(roles.map((r) => [r.id, r.permissions])) as TeamRolesPresets;
}

export function allPermissionKeys(areas: TeamRolesPermissionArea[]): string[] {
  return areas.flatMap((a) => a.permissions.map((p) => p.key));
}

/** Whether a role includes a permission, counting unsaved edits. */
export function makeHas(presets: TeamRolesPresets, edits: TeamRolesEdits) {
  return (role: TeamRolesRoleId, permission: string): boolean => {
    const edit = edits[`${role}:${permission}`];
    return edit !== undefined ? edit : (presets[role] ?? []).includes(permission);
  };
}

/** Number of edits that differ from the saved presets. */
export function editCount(presets: TeamRolesPresets, edits: TeamRolesEdits): number {
  return Object.entries(edits).filter(([key, on]) => {
    const [role, permission] = key.split(":") as [TeamRolesRoleId, string];
    return on !== (presets[role] ?? []).includes(permission);
  }).length;
}

/** Saved presets with the edits applied. */
export function applyEdits(presets: TeamRolesPresets, edits: TeamRolesEdits, all: string[]): TeamRolesPresets {
  const has = makeHas(presets, edits);
  return Object.fromEntries(
    Object.keys(presets).map((role) => {
      const id = role as TeamRolesRoleId;
      const known = all.filter((p) => has(id, p));
      const other = presets[id].filter((p) => !all.includes(p));
      return [id, [...known, ...other]];
    }),
  ) as TeamRolesPresets;
}

/** A six-digit step-up code (spaces allowed). */
export function isCode(value: string): boolean {
  return value.replace(/\D/g, "").length === 6;
}

/** Scope text for a selection of scope rows: "All properties" or the selected names. */
export function scopeText(scopes: TeamRolesScope[], ids: string[]): string {
  const grantable = scopes.filter((s) => s.kind === "property" || s.kind === "outlet");
  if (grantable.every((s) => ids.includes(s.id))) return "All properties";
  return grantable
    .filter((s) => ids.includes(s.id))
    .map((s) => s.label)
    .join(", ");
}
