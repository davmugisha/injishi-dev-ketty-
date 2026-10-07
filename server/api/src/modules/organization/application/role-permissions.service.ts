import {
  CustomisableOrgRole,
  LOCKED_PERMISSION_REASON,
  LOCKED_PERMISSIONS,
  ORG_ROLE_LABEL,
  OrgRole,
  Permission,
  type OperatorRoleList,
  type OperatorRolePermissions,
  type RolePermissionOverride,
  type SetRolePermissionsRequest,
  type WorkspaceAccess,
  effectivePermissionsForRole,
  isCustomisableOrgRole,
  isLockedPermission,
  parseRolePermissionOverride,
  permissionsForRole,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RolePermissionsRepository } from '../infrastructure/role-permissions.repository';

/**
 * What each staff role may do AT THIS BUSINESS (ADR-055).
 *
 * The default roles were the whole model: what the platform means by
 * "receptionist", the same in every hotel in the country. There are six since
 * ADR-069 added `finance` and `hr`, and every one but `owner` is listed
 * and edited here the same way: nothing below names a role, so a role the
 * model gains is customisable the day it lands. Two real properties
 * never agree with that — one lets the front desk read the month's takings,
 * another will not let a manager withdraw a signed receipt — so a business may
 * now move a permission on or off any of its own staff roles, and the platform's
 * set becomes the starting point rather than the ceiling.
 *
 * **It stores a DELTA, never a permission list**, and that is the decision this
 * service exists to keep. The client sends the whole set it wants; the service
 * diffs it against `permissionsForRole` and stores only the departures. A stored
 * list would freeze each role at the day it was last edited: a permission added
 * to the platform next quarter would reach every business that had never opened
 * this screen and no business that had.
 *
 * **Two refusals are the security boundary and neither is cosmetic:**
 *
 *  - `owner` cannot be edited. This screen is behind `team.manage`, which only
 *    an owner holds, so an owner able to edit `owner` could withdraw their own
 *    way back to it. There is no second door.
 *  - `team.manage` cannot be granted. It would hand the recipient this screen,
 *    from which they could grant themselves the rest and re-role the owner out
 *    of their own business.
 *
 * Both are refused here, CHECKed by the table, and ignored again by
 * `effectivePermissionsForRole` when it resolves a grant. Three layers for one
 * rule is not duplication: the request validator protects the API, the CHECK
 * protects the database from a script, and the model protects every consumer
 * from a row that got in anyway.
 */
@Injectable()
export class RolePermissionsService {
  constructor(private readonly roles: RolePermissionsRepository) {}

  /**
   * Every role of this business, with the platform's answer and this
   * business's beside it.
   *
   * `owner` is listed and marked not customisable rather than omitted. An owner
   * asking "why can nobody else close the month" has to be able to see the
   * owner's own set to answer it.
   */
  async list(ws: WorkspaceAccess): Promise<OperatorRoleList> {
    const orgId = this.orgOf(ws);
    const [overrides, counts] = await Promise.all([
      this.roles.listForOrg(orgId),
      this.roles.memberCounts(ws.workspaceId),
    ]);
    const parsed = this.parseStored(overrides);

    return {
      roles: OrgRole.options.map((role) =>
        this.present(role, parsed, counts[role] ?? 0),
      ),
    };
  }

  /**
   * Set what one role may do here.
   *
   * The body is the WHOLE set the role should hold. Anything in it that the
   * default withholds becomes a grant; anything the default gives that is not in
   * it becomes a withdrawal; everything else stores nothing at all, so a role
   * left at its defaults carries no rows and keeps inheriting.
   */
  async set(
    ws: WorkspaceAccess,
    role: string,
    body: SetRolePermissionsRequest,
    actorUserId: string,
  ): Promise<OperatorRolePermissions> {
    const orgId = this.orgOf(ws);
    const orgRole = this.parseRole(role);

    const wanted = new Set<Permission>(body.permissions);

    /*
     * The locked permission is refused loudly rather than dropped quietly.
     *
     * A screen that silently discarded it would tell the owner they had granted
     * something they had not, and the next person to read the roster would see
     * a role that did not match what they remembered doing.
     */
    for (const permission of wanted) {
      if (isLockedPermission(permission)) {
        throw new ConflictException(
          LOCKED_PERMISSION_REASON[permission] ??
            `${permission} cannot be granted to another role.`,
        );
      }
    }

    const base = new Set<Permission>(permissionsForRole(orgRole));
    const overrides: { permission: string; granted: boolean }[] = [];
    for (const permission of Permission.options) {
      // Never stored in either direction, so it can never resolve into a grant.
      if (isLockedPermission(permission)) continue;
      const has = wanted.has(permission);
      if (has === base.has(permission)) continue;
      overrides.push({ permission, granted: has });
    }

    /*
     * What the role held BEFORE this edit, read before the write, for the audit
     * row. Resolved through the model rather than taken from the request, so the
     * trail records what the API was actually enforcing a moment ago — including
     * a locked row that the resolver was already ignoring.
     */
    const from = effectivePermissionsForRole(
      orgRole,
      this.parseStored(await this.roles.listForOrg(orgId)),
    );

    await this.roles.replaceForRole({
      orgId,
      orgRole,
      overrides,
      setByUserId: actorUserId,
      effective: {
        from,
        to: effectivePermissionsForRole(
          orgRole,
          overrides.map((o) => ({
            orgRole,
            permission: o.permission as Permission,
            granted: o.granted,
          })),
        ),
      },
    });

    const [stored, counts] = await Promise.all([
      this.roles.listForOrg(orgId),
      this.roles.memberCounts(ws.workspaceId),
    ]);
    return this.present(
      orgRole,
      this.parseStored(stored),
      counts[orgRole] ?? 0,
    );
  }

  /**
   * The overrides of a set of orgs, ready for `permissionsForWorkspace`.
   *
   * `WorkspaceService` calls this on the path that resolves every grant, which
   * is why it is bulk and why it is the only method here that does not need a
   * workspace: the caller has already proven what it is resolving.
   */
  async overridesForOrgs(
    orgIds: readonly string[],
  ): Promise<Map<string, RolePermissionOverride[]>> {
    const rows = await this.roles.listForOrgs(orgIds);
    const parsed = new Map<string, RolePermissionOverride[]>();
    for (const [orgId, list] of rows) parsed.set(orgId, this.parseStored(list));
    return parsed;
  }

  private present(
    role: OrgRole,
    overrides: readonly RolePermissionOverride[],
    memberCount: number,
  ): OperatorRolePermissions {
    return {
      orgRole: role,
      label: ORG_ROLE_LABEL[role],
      customisable: isCustomisableOrgRole(role),
      basePermissions: permissionsForRole(role),
      permissions: effectivePermissionsForRole(role, overrides),
      // Locked applies to a customisable role only. The owner's row is read
      // only in its entirety, so singling out one permission there would say
      // something untrue about every other permission it holds.
      lockedPermissions: isCustomisableOrgRole(role)
        ? [...LOCKED_PERMISSIONS]
        : [],
      memberCount,
    };
  }

  /**
   * Stored rows, narrowed to the ones the model recognises.
   *
   * Through `parseRolePermissionOverride` rather than a local narrow, so this
   * service and `WorkspaceService` — which resolves the same rows on every
   * guarded request — cannot read one row two ways.
   */
  private parseStored(
    rows: readonly { orgRole: string; permission: string; granted: boolean }[],
  ): RolePermissionOverride[] {
    const overrides: RolePermissionOverride[] = [];
    for (const row of rows) {
      const parsed = parseRolePermissionOverride(row);
      if (parsed) overrides.push(parsed);
    }
    return overrides;
  }

  /** The role named in the path, or a 404 for anything that is not one. */
  private parseRole(role: string): CustomisableOrgRole {
    const parsed = CustomisableOrgRole.safeParse(role);
    if (parsed.success) return parsed.data;
    // `owner` is a real role and a deliberate refusal, so it gets its own words
    // rather than reading as a typo.
    if (OrgRole.safeParse(role).success) {
      throw new ConflictException(
        "An owner's own access cannot be changed here. It is the only way back into this screen.",
      );
    }
    throw new NotFoundException(`There is no ${role} role.`);
  }

  /** A business workspace, or the refusal that says why this cannot apply. */
  private orgOf(ws: WorkspaceAccess): string {
    if (!ws.orgId) {
      throw new BadRequestException(
        'Only a business workspace has staff roles to set.',
      );
    }
    return ws.orgId;
  }
}
