import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  isPsfApplicant,
  PSF_DOMAINS,
  parseRolePermissionOverride,
  permissionsForWorkspace,
  type DepartmentCategory,
  type RolePermissionOverride,
  type WorkspaceAccess,
  type WorkspaceBranch,
} from '@injishi/contracts';

import type { Database } from '../database/database.module';
import type { CoveredProperties } from './branch-scope';
import {
  departments,
  districts,
  oboRegistrations,
  orgMembershipBranches,
  orgMemberships,
  orgRolePermissions,
  orgs,
  properties,
  workspaces,
} from '../../database/drizzle/schema';

/**
 * THE RESOLVER AS IT WAS BEFORE ADR-076 SLICE G, FROZEN, for the snapshot test
 * beside it and nothing else (G19).
 *
 * Copied verbatim from `WorkspaceService` at `3c79cda7` (listForUser, its
 * branch limit read, resolveForUser and coveredProperties: seven queries, then
 * one), with the one change `main` made to that code before the slice was ported
 * onto it (2026-11-06): PSF membership is offered on every domain in
 * `PSF_DOMAINS`, not on hospitality alone (PR #97). Main's other change to
 * `WorkspaceService` in that time, custom staff roles (PR #101), is in
 * `staffAccessForUser`, which this copy never held. The slice replaced it with
 * one statement; this copy is how the snapshot
 * proves the replacement gives every membership in the sample database the
 * same permissions, branches and coverage it had. Nothing in the server imports
 * it. Delete it with the snapshot test once the slice has run in production.
 */
export class PreSliceWorkspaceResolver {
  constructor(private readonly db: Database) {}

  async listForUser(userId: string): Promise<WorkspaceAccess[]> {
    const own = await this.db
      .select({
        workspaceId: workspaces.id,
        kind: workspaces.kind,
      })
      .from(workspaces)
      .where(eq(workspaces.userId, userId));

    const viaOrg = await this.db
      .select({
        workspaceId: workspaces.id,
        kind: workspaces.kind,
        orgId: orgs.id,
        orgName: orgs.legalName,
        domain: orgs.domain,
        orgRole: orgMemberships.orgRole,
        membershipId: orgMemberships.id,
        // Not decoration: this is what decides whether the caller holds any
        // permission here at all (D20, D23). Selected on the same row as the
        // role so the two can never be resolved from different reads.
        registrationStatus: orgs.registrationStatus,
      })
      .from(orgMemberships)
      .innerJoin(orgs, eq(orgs.id, orgMemberships.orgId))
      .innerJoin(workspaces, eq(workspaces.orgId, orgs.id))
      .where(
        and(
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.status, 'active'),
        ),
      );

    /*
     * Which departments each business workspace runs (ADR-035, D-a).
     *
     * On the grant because the operator app derives its nav SECTIONS from it,
     * and screen access is derived from the nav. Before this the app read the
     * answer out of `data/demo.ts`, so a fixture decided which doors a real
     * hotel had.
     *
     * One extra query rather than a join onto `viaOrg`: a business runs
     * several departments, so joining would multiply the membership rows and
     * every grant would then have to be de-duplicated back down. Skipped
     * entirely when the caller holds no business workspace, which is the
     * common case for a broker or a guest.
     *
     * ARCHIVED departments are excluded. A retired restaurant keeps its
     * revenue history, which is why the row is never deleted, but it must not
     * keep the Services door open.
     */
    const businessWorkspaceIds = viaOrg.map((w) => w.workspaceId);
    const departmentsByWorkspace = new Map<string, DepartmentCategory[]>();
    if (businessWorkspaceIds.length > 0) {
      const rows = await this.db
        .selectDistinct({
          workspaceId: departments.workspaceId,
          category: departments.departmentCategory,
        })
        .from(departments)
        .where(
          and(
            inArray(departments.workspaceId, businessWorkspaceIds),
            eq(departments.status, 'active'),
          ),
        );
      for (const row of rows) {
        const list = departmentsByWorkspace.get(row.workspaceId) ?? [];
        list.push(row.category);
        departmentsByWorkspace.set(row.workspaceId, list);
      }
    }

    /*
     * The branches each business workspace's member covers (ADR-054 AC-S3).
     *
     * On the grant for the same reason `departments` is: the topbar names the
     * branch on every screen, and reading it from `/inventory/properties`
     * meant a receptionist — who may not manage listings — took a 403 on every
     * page load for a name. Identity is not a listing operation.
     *
     * Active branches only, head office first then by name, narrowed to the
     * member's `org_membership_branches` rows when they have any.
     */
    const limits = await this.branchLimitsFor(viaOrg);
    const branchesByWorkspace = new Map<string, WorkspaceBranch[]>();
    if (businessWorkspaceIds.length > 0) {
      const rows = await this.db
        .select({
          workspaceId: properties.workspaceId,
          id: properties.id,
          name: properties.name,
          districtName: districts.name,
          isHeadOffice: properties.isHeadOffice,
        })
        .from(properties)
        .leftJoin(districts, eq(districts.id, properties.districtId))
        .where(
          and(
            inArray(properties.workspaceId, businessWorkspaceIds),
            isNull(properties.archivedAt),
          ),
        )
        .orderBy(desc(properties.isHeadOffice), asc(properties.name));
      for (const { workspaceId, ...branch } of rows) {
        const list = branchesByWorkspace.get(workspaceId) ?? [];
        list.push(branch);
        branchesByWorkspace.set(workspaceId, list);
      }
    }

    const fromOwn: WorkspaceAccess[] = own.map((w) => ({
      workspaceId: w.workspaceId,
      kind: w.kind,
      orgId: null,
      orgName: null,
      domain: null,
      orgRole: null,
      registrationStatus: null,
      permissions: permissionsForWorkspace({
        kind: w.kind,
        orgRole: null,
        registrationStatus: null,
      }),
      // Broker and Personal run no departments. Empty, never absent.
      departments: [],
      // And no property, so no branch. Null and empty, never absent.
      propertyName: null,
      branches: [],
      branchCoverage: null,
      // No business, so no PSF membership (ADR-056).
      psfMembership: null,
    }));

    /*
     * What each business decided its own staff roles mean (ADR-055).
     *
     * A DELTA table: one row per permission a business moved on or off one of
     * its roles. A role nothing names still resolves from the platform default,
     * so the common case — a business that has never opened the Roles screen —
     * reads zero rows and behaves exactly as it did before this existed.
     *
     * One extra query covering every business workspace at once, and keyed by
     * ORG rather than by workspace: the policy belongs to the business, so an
     * org with two workspaces must not be able to hold two answers. Skipped
     * entirely when the caller holds no business workspace, which is the common
     * case for a guest or a broker.
     *
     * ROWS THAT DO NOT NARROW ARE DROPPED, through the same helper the service
     * that writes them uses, so the read path and the write path cannot disagree
     * about what a row means. `permissionsForWorkspace` then applies them INSIDE the
     * registration gate, so a business still in the pipeline cannot grant its
     * way past its own approval.
     */
    const orgIds = [
      ...new Set(
        viaOrg.map((w) => w.orgId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const overridesByOrg = new Map<string, RolePermissionOverride[]>();
    if (orgIds.length > 0) {
      const rows = await this.db
        .select({
          orgId: orgRolePermissions.orgId,
          orgRole: orgRolePermissions.orgRole,
          permission: orgRolePermissions.permission,
          granted: orgRolePermissions.granted,
        })
        .from(orgRolePermissions)
        .where(inArray(orgRolePermissions.orgId, orgIds));
      for (const row of rows) {
        const parsed = parseRolePermissionOverride(row);
        if (!parsed) continue;
        const list = overridesByOrg.get(row.orgId) ?? [];
        list.push(parsed);
        overridesByOrg.set(row.orgId, list);
      }
    }

    /*
     * The on behalf registration of each business, for the PSF applicant rule
     * (ADR-056). The agent who registered stays an `owner` after the claim
     * (scope `_root` 40), so the rule has to read the claim to tell them apart
     * from the owner. One query for every business at once, skipped with none.
     */
    const oboByOrg = new Map<
      string,
      {
        registrantUserId: string;
        claimStatus: 'registrant_held' | 'owner_claimed' | 'expired';
      }
    >();
    if (orgIds.length > 0) {
      const rows = await this.db
        .select({
          orgId: oboRegistrations.orgId,
          registrantUserId: oboRegistrations.registrantUserId,
          claimStatus: oboRegistrations.claimStatus,
        })
        .from(oboRegistrations)
        .where(inArray(oboRegistrations.orgId, orgIds));
      for (const { orgId, ...obo } of rows) oboByOrg.set(orgId, obo);
    }

    const fromOrg: WorkspaceAccess[] = viaOrg.map((w) => {
      const limit = limits.get(w.membershipId);
      const branches = (branchesByWorkspace.get(w.workspaceId) ?? []).filter(
        (b) => !limit || limit.has(b.id),
      );
      return {
        workspaceId: w.workspaceId,
        kind: w.kind,
        orgId: w.orgId,
        orgName: w.orgName,
        domain: w.domain,
        orgRole: w.orgRole,
        registrationStatus: w.registrationStatus,
        permissions: permissionsForWorkspace({
          kind: w.kind,
          orgRole: w.orgRole,
          registrationStatus: w.registrationStatus,
          roleOverrides: w.orgId ? (overridesByOrg.get(w.orgId) ?? []) : [],
        }),
        departments: departmentsByWorkspace.get(w.workspaceId) ?? [],
        // Head office first, then by name, so the first covered branch is
        // the head office when covered and else the first by name (AC-S3).
        propertyName: branches[0]?.name ?? null,
        branches,
        branchCoverage: limit ? ('limited' as const) : ('all' as const),
        psfMembership:
          w.domain !== null && PSF_DOMAINS.includes(w.domain)
            ? {
                canManage: isPsfApplicant({
                  userId,
                  domain: w.domain,
                  orgRole: w.orgRole,
                  obo: w.orgId ? (oboByOrg.get(w.orgId) ?? null) : null,
                }),
              }
            : null,
      };
    });

    return [...fromOwn, ...fromOrg];
  }

  /**
   * The branch limit of each membership that has one, keyed by membership id.
   *
   * No rows means every branch (ADR-054, `org_membership_branches`). An owner's
   * rows, which the service never writes, are ignored rather than trusted:
   * an owner always covers every branch (invariant 5).
   */
  private async branchLimitsFor(
    memberships: readonly { membershipId: string; orgRole: string }[],
  ): Promise<Map<string, Set<string>>> {
    const ids = memberships
      .filter((m) => m.orgRole !== 'owner')
      .map((m) => m.membershipId);
    const limits = new Map<string, Set<string>>();
    if (ids.length === 0) return limits;
    const rows = await this.db
      .select({
        membershipId: orgMembershipBranches.orgMembershipId,
        propertyId: orgMembershipBranches.propertyId,
      })
      .from(orgMembershipBranches)
      .where(inArray(orgMembershipBranches.orgMembershipId, ids));
    for (const row of rows) {
      const set = limits.get(row.membershipId) ?? new Set<string>();
      set.add(row.propertyId);
      limits.set(row.membershipId, set);
    }
    return limits;
  }

  /**
   * The one workspace, or null when the user does not hold it.
   *
   * Returning null rather than an empty projection is deliberate: the caller
   * must refuse, not render a blank screen.
   */
  async resolveForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceAccess | null> {
    const all = await this.listForUser(userId);
    return all.find((w) => w.workspaceId === workspaceId) ?? null;
  }

  /**
   * The properties this member covers in a workspace, archived ones included,
   * for the branch scope `WorkspaceGuard` resolves (ADR-054). Archived branches
   * stay in it so their history is still readable; the switcher offers only
   * the grant's `branches`.
   *
   * `access` is the grant `resolveForUser` returned, so its coverage and this
   * list come from the same membership. A limited member's list is their limit
   * rows, joined to the workspace so a row naming another org's property (which
   * the service refuses to write) can never widen it.
   */
  async coveredProperties(
    userId: string,
    access: WorkspaceAccess,
  ): Promise<CoveredProperties> {
    if (access.branchCoverage !== 'limited' || !access.orgId) {
      const rows = await this.db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.workspaceId, access.workspaceId));
      return { coverage: 'all', propertyIds: rows.map((r) => r.id) };
    }
    const rows = await this.db
      .select({ id: properties.id })
      .from(orgMembershipBranches)
      .innerJoin(
        orgMemberships,
        eq(orgMemberships.id, orgMembershipBranches.orgMembershipId),
      )
      .innerJoin(properties, eq(properties.id, orgMembershipBranches.propertyId))
      .where(
        and(
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.orgId, access.orgId),
          eq(orgMemberships.status, 'active'),
          eq(properties.workspaceId, access.workspaceId),
        ),
      );
    return { coverage: 'limited', propertyIds: rows.map((r) => r.id) };
  }
}
