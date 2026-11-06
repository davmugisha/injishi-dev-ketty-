import type { CustomisableOrgRole } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { AuditWriter } from '../../../shared/audit/audit-writer';
import {
  orgMemberships,
  orgRolePermissions,
  workspaces,
} from '../../../database/drizzle/schema';

/** One stored departure from the platform's default set. */
export interface RoleOverrideRow {
  orgRole: CustomisableOrgRole;
  permission: string;
  granted: boolean;
}

/** How many active people hold each role, keyed by role. */
export type RoleMemberCounts = Readonly<Record<string, number>>;

/**
 * What a business decided its staff roles mean (ADR-055).
 *
 * **Reads take an ORG id, writes take an org id, and neither takes a role from
 * anywhere but the caller's own workspace.** The controller proves the
 * workspace, the service derives the org from it, and this never sees a request
 * body — the same rule `TeamRepository` beside it follows, and for the same
 * reason: an org id on the wire would let somebody who holds workspace A edit
 * the roles of org B.
 *
 * `listForOrgs` is the bulk read, and it is bulk because `WorkspaceService`
 * resolves every workspace a person holds in one pass. A person legitimately
 * holds several businesses; asking per org would put a query per workspace on
 * the hot path of every guarded request.
 */
@Injectable()
export class RolePermissionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Every override for a set of orgs, grouped by org id.
   *
   * Returns an empty map for an empty input rather than querying with an empty
   * `IN ()`, which is both a wasted round trip and, in some drivers, a syntax
   * error.
   */
  async listForOrgs(
    orgIds: readonly string[],
  ): Promise<Map<string, RoleOverrideRow[]>> {
    const byOrg = new Map<string, RoleOverrideRow[]>();
    if (orgIds.length === 0) return byOrg;

    const rows = await this.db
      .select({
        orgId: orgRolePermissions.orgId,
        orgRole: orgRolePermissions.orgRole,
        permission: orgRolePermissions.permission,
        granted: orgRolePermissions.granted,
      })
      .from(orgRolePermissions)
      .where(inArray(orgRolePermissions.orgId, [...orgIds]));

    for (const row of rows) {
      // `owner` cannot be stored — the table CHECKs it — so the narrowing below
      // restates a database invariant rather than trusting the row.
      if (row.orgRole === 'owner') continue;
      const list = byOrg.get(row.orgId) ?? [];
      list.push({
        orgRole: row.orgRole,
        permission: row.permission,
        granted: row.granted,
      });
      byOrg.set(row.orgId, list);
    }
    return byOrg;
  }

  /** The overrides of one org. */
  async listForOrg(orgId: string): Promise<RoleOverrideRow[]> {
    return (await this.listForOrgs([orgId])).get(orgId) ?? [];
  }

  /** The org a workspace belongs to, or null when it holds none. */
  async orgIdForWorkspace(workspaceId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ orgId: workspaces.orgId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
    return row?.orgId ?? null;
  }

  /** Active memberships per role, for the business behind a workspace. */
  async memberCounts(workspaceId: string): Promise<RoleMemberCounts> {
    const rows = await this.db
      .select({
        orgRole: orgMemberships.orgRole,
        n: sql<number>`count(*)::int`,
      })
      .from(orgMemberships)
      .innerJoin(workspaces, eq(workspaces.orgId, orgMemberships.orgId))
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(orgMemberships.status, 'active'),
        ),
      )
      .groupBy(orgMemberships.orgRole);

    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.orgRole] = row.n;
    return counts;
  }

  /**
   * Replace one role's overrides with exactly this set, in one transaction.
   *
   * DELETE then INSERT rather than an upsert per permission, because the input
   * is the whole policy for that role: a permission that used to carry an
   * override and no longer does must lose its row, and an upsert cannot express
   * a removal. Both statements are scoped to the one role of the one org, so a
   * concurrent edit of a DIFFERENT role is untouched.
   *
   * Two owners editing the SAME role at the same time still race, and the last
   * writer wins whole rather than interleaving — which is the honest outcome for
   * a screen that saves a complete policy.
   */
  async replaceForRole(input: {
    orgId: string;
    orgRole: CustomisableOrgRole;
    overrides: readonly { permission: string; granted: boolean }[];
    setByUserId: string;
    /** What the role held before and after, for the audit row. */
    effective: { from: readonly string[]; to: readonly string[] };
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(orgRolePermissions)
        .where(
          and(
            eq(orgRolePermissions.orgId, input.orgId),
            eq(orgRolePermissions.orgRole, input.orgRole),
          ),
        );

      if (input.overrides.length > 0) {
        await tx.insert(orgRolePermissions).values(
          input.overrides.map((o) => ({
            orgId: input.orgId,
            orgRole: input.orgRole,
            permission: o.permission,
            granted: o.granted,
            setByUserId: input.setByUserId,
          })),
        );
      }

      /*
       * One `audit_events` row, on the SAME transaction (ADR-054's rule for a
       * branch move, and this is at least as consequential: it decides which
       * named colleague may take money, close a bill or withdraw a signed RRA
       * receipt). A change with no row is a change nobody can explain later, and
       * a row for a change that rolled back is a trail that lies.
       *
       * The subject is the ORG rather than the role, because `org_role` is an
       * enum value and not a row with an id — "every audit row about this
       * business" is the question somebody actually asks.
       *
       * The diff is the EFFECTIVE sets, not the stored deltas. An owner reading
       * this back wants "the receptionist gained view money", not "a row was
       * written"; and the effective set is the thing the API then enforces.
       */
      const before = new Set(input.effective.from);
      const after = new Set(input.effective.to);
      await AuditWriter.write(tx, {
        actorUserId: input.setByUserId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: 'org.role_permissions_changed',
        payloadDiff: {
          orgRole: input.orgRole,
          granted: input.effective.to.filter((p) => !before.has(p)),
          withdrawn: input.effective.from.filter((p) => !after.has(p)),
          permissions: { from: input.effective.from, to: input.effective.to },
        } as never,
      });
    });
  }
}
