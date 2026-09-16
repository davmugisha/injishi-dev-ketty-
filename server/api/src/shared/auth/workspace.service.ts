import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  NO_STAFF_ACCESS,
  OVERSIGHT_COUNTRY_SCOPE_LABEL,
  type WorkspaceBranch,
  type DepartmentCategory,
  type OversightConsoleGrant,
  type OversightGrant,
  type Permission,
  type RolePermissionOverride,
  type StaffAccess,
  type WorkspaceAccess,
  mayElevate,
  oversightConsoleFor,
  parseRolePermissionOverride,
  permissionsForWorkspace,
  staffPermissionsForRoles,
} from '@injishi/contracts';

import { DRIZZLE, type Database } from '../database/database.module';
import {
  adminUsers,
  departments,
  districts,
  governmentBodies,
  identityDocuments,
  orgMemberships,
  orgRolePermissions,
  orgs,
  oversightAssignments,
  properties,
  provinces,
  sessions,
  verifiedIdentities,
  workspaces,
} from '../../database/drizzle/schema';

/**
 * Resolves what a signed-in person may actually do (Spec 0004).
 *
 * This is the ONLY place that answers "which workspaces does this user hold".
 * Everything downstream — the guard, the endpoints, the client — reads its
 * answer rather than deriving its own, which is what stops the operator app's
 * local `role` state from being the control it used to be.
 *
 * Two grant paths reach a workspace and both are checked:
 *   - own workspaces (`broker`, `personal`) via `workspaces.user_id`
 *   - `business` workspaces via an ACTIVE `org_memberships` row
 *
 * A person legitimately holds several. Samuel Kayitare in the demo roster holds
 * three across all three kinds, which is the case this must never flatten.
 */
// A singleton. It was REQUEST scoped while `DRIZZLE` followed the request host
// to one of two databases; a process has one database now (ADR-043), so there
// is no per request handle for a singleton to pin.
@Injectable()
export class WorkspaceService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Every workspace this user may act in, each with the permissions that apply there. */
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
     * Active branches only, head office first then by name. Coverage is `all`
     * for every member until branch limits are read (ADR-054 slice 4), so the
     * list is every active branch of the org.
     */
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

    const fromOrg: WorkspaceAccess[] = viaOrg.map((w) => {
      const branches = branchesByWorkspace.get(w.workspaceId) ?? [];
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
        branchCoverage: 'all' as const,
      };
    });

    return [...fromOwn, ...fromOrg];
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
   * Every property of a workspace, archived ones included, for the branch
   * scope `WorkspaceGuard` resolves (ADR-054). Archived branches stay in it so
   * their history is still readable; the switcher offers only `branches`.
   */
  async propertyIdsForWorkspace(workspaceId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.workspaceId, workspaceId));
    return rows.map((r) => r.id);
  }

  /**
   * Active oversight grants. A revoked grant is absent, which is precisely why
   * "no assignment" and "no console" are the same outcome.
   */
  async oversightGrantsForUser(userId: string): Promise<OversightGrant[]> {
    const rows = await this.db
      .select({
        oversightRole: oversightAssignments.oversightRole,
        governmentBodyCode: oversightAssignments.governmentBodyCode,
        governmentTitle: oversightAssignments.governmentTitle,
        scopeLevel: oversightAssignments.scopeLevel,
        provinceId: oversightAssignments.provinceId,
        districtId: oversightAssignments.districtId,
      })
      .from(oversightAssignments)
      .where(
        and(
          eq(oversightAssignments.userId, userId),
          isNull(oversightAssignments.revokedAt),
        ),
      );
    return rows;
  }

  /**
   * The same grants, with the words the OFFICER'S CONSOLE renders (ADR-053, AC-G5).
   *
   * A separate method from `oversightGrantsForUser` above rather than a widening
   * of it, because that one feeds `OversightGuard` and a scope check: three joins
   * for display names on the hot path of every guarded oversight request would be
   * paid on every call to buy nothing the guard asks about.
   *
   * `government_bodies` is joined INNER, as it is everywhere else a grant is read:
   * a grant naming a body that no longer exists should not read as a seat.
   */
  async oversightConsoleGrantsForUser(
    userId: string,
  ): Promise<OversightConsoleGrant[]> {
    const rows = await this.db
      .select({
        assignmentId: oversightAssignments.id,
        oversightRole: oversightAssignments.oversightRole,
        bodyCode: oversightAssignments.governmentBodyCode,
        bodyName: governmentBodies.nameEn,
        title: oversightAssignments.governmentTitle,
        scopeLevel: oversightAssignments.scopeLevel,
        provinceId: oversightAssignments.provinceId,
        districtId: oversightAssignments.districtId,
        provinceName: provinces.name,
        districtName: districts.name,
      })
      .from(oversightAssignments)
      .innerJoin(
        governmentBodies,
        eq(governmentBodies.code, oversightAssignments.governmentBodyCode),
      )
      .leftJoin(provinces, eq(provinces.id, oversightAssignments.provinceId))
      .leftJoin(districts, eq(districts.id, oversightAssignments.districtId))
      .where(
        and(
          eq(oversightAssignments.userId, userId),
          isNull(oversightAssignments.revokedAt),
        ),
      );

    return rows.map((row) => ({
      assignmentId: row.assignmentId,
      console: oversightConsoleFor(row.oversightRole),
      oversightRole: row.oversightRole,
      bodyCode: row.bodyCode,
      bodyName: row.bodyName,
      title: row.title,
      scopeLevel: row.scopeLevel,
      provinceId: row.provinceId,
      districtId: row.districtId,
      // A region an officer can READ. A country grant says Rwanda rather than
      // nothing, because "no region shown" and "every region" look identical on a
      // screen and only one of them is a bug. A name that failed to resolve falls
      // back to the level itself rather than to an empty string.
      scopeLabel:
        row.scopeLevel === 'country'
          ? OVERSIGHT_COUNTRY_SCOPE_LABEL
          : row.scopeLevel === 'province'
            ? (row.provinceName ?? 'Province')
            : (row.districtName ?? 'District'),
    }));
  }

  /**
   * May this person take on a privileged role? Verified KYC plus at least one
   * active government document. Browsing and booking never call this.
   */
  async mayElevate(userId: string): Promise<boolean> {
    const [identity] = await this.db
      .select({ kycStatus: verifiedIdentities.kycStatus })
      .from(verifiedIdentities)
      .where(eq(verifiedIdentities.userId, userId));
    if (!identity) return false;

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(identityDocuments)
      .where(
        and(
          eq(identityDocuments.identityId, userId),
          eq(identityDocuments.status, 'active'),
        ),
      );

    return mayElevate({
      kycStatus: identity.kycStatus,
      activeDocumentCount: counted?.n ?? 0,
    });
  }

  /**
   * Persist which workspace a session is acting in.
   *
   * The column already existed and was written by nothing, which meant the
   * switch endpoint could answer 201 while the server still had no idea which
   * workspace the caller was in. Returns the number of rows written so a caller
   * can tell a real switch from a no op.
   */
  /**
   * The workspace this session last acted in, or null when it never switched.
   *
   * Read back so the redirect shim can break a tie between two workspaces of
   * the same kind (ADR-018, D-m). An owner holding three hotels ranks the same
   * on kind, and "whichever the query listed first" is not an answer anybody
   * would choose on purpose; the one they were last working in is.
   *
   * It is a HINT, never a grant. The caller must still be holding the workspace
   * for it to be used, and `WorkspaceGuard` refuses the request either way.
   */
  async activeWorkspaceIdFor(sessionId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ activeWorkspaceId: sessions.activeWorkspaceId })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return row?.activeWorkspaceId ?? null;
  }

  async setActiveWorkspace(
    sessionId: string,
    workspaceId: string,
  ): Promise<number> {
    const updated = await this.db
      .update(sessions)
      .set({ activeWorkspaceId: workspaceId })
      .where(eq(sessions.id, sessionId))
      .returning({ id: sessions.id });
    return updated.length;
  }

  /**
   * Is this person platform staff, and what does that get them?
   *
   * The admin console could not ask this before — there was no route and no
   * reader — so it fell back to `roleLens`, a UI preview control that defaults
   * to `super_admin`. Every visitor to the console's origin was therefore shown
   * the whole platform wearing the highest role in the system.
   *
   * A REVOKED row is not staff. `revoked_at` is checked here rather than left
   * to the caller, because "the row exists" and "the grant is live" are the
   * kind of pair that gets conflated exactly once and then never noticed.
   *
   * Permissions are resolved HERE, not in the browser. The console renders the
   * array it is given; it never turns a role into powers itself.
   */
  async staffAccessForUser(userId: string): Promise<StaffAccess> {
    const [row] = await this.db
      .select({ staffRoles: adminUsers.staffRoles })
      .from(adminUsers)
      .where(and(eq(adminUsers.userId, userId), isNull(adminUsers.revokedAt)));

    if (!row) return NO_STAFF_ACCESS;

    const roles = row.staffRoles ?? [];
    return {
      isStaff: true,
      roles,
      permissions: staffPermissionsForRoles(roles),
    };
  }

  /** Convenience for a guard: does this user hold this permission HERE? */
  async userHasPermissionIn(
    userId: string,
    workspaceId: string,
    permission: Permission,
  ): Promise<boolean> {
    const access = await this.resolveForUser(userId, workspaceId);
    return access?.permissions.includes(permission) ?? false;
  }
}
