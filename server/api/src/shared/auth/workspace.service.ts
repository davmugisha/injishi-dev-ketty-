import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  NO_STAFF_ACCESS,
  OVERSIGHT_COUNTRY_SCOPE_LABEL,
  type OversightConsoleGrant,
  type OversightGrant,
  type StaffAccess,
  type WorkspaceAccess,
  mayElevate,
  oversightConsoleFor,
  staffPermissionsForGrants,
  tidyPlaceName,
} from '@injishi/contracts';

import { DRIZZLE, type Database } from '../database/database.module';
import type { CoveredProperties } from './branch-scope';
import {
  accessFromFacts,
  coveredFromFacts,
  factsFromRow,
  workspaceFactsQuery,
  type FactsRow,
  type WorkspaceFacts,
} from './workspace-facts';
import {
  adminUsers,
  cells,
  districts,
  governmentBodies,
  identityDocuments,
  oversightAssignments,
  provinces,
  sectors,
  sessions,
  staffCustomRolePermissions,
  staffCustomRoles,
  userStaffCustomRoles,
  verifiedIdentities,
  villages,
} from '../../database/drizzle/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One workspace as a guard needs it: the grant the client is told about, what
 * the member covers, and the facts both were built from (the membership and the
 * open entitlements, which later layers read). Resolved in one statement.
 */
export interface ResolvedWorkspace {
  readonly access: WorkspaceAccess;
  readonly covered: CoveredProperties;
  readonly facts: WorkspaceFacts;
}

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

  /**
   * Every workspace this user may act in, each with the permissions that apply
   * there and, on a business workspace, the grants (ADR-076 G1). One statement
   * (`workspaceFactsQuery`), the same one the guard runs for a single workspace.
   */
  async listForUser(userId: string): Promise<WorkspaceAccess[]> {
    return (await this.factsFor(userId, null)).map((facts) =>
      accessFromFacts(userId, facts),
    );
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
    return (await this.accessFor(userId, workspaceId))?.access ?? null;
  }

  /**
   * One workspace with what the member covers and the facts behind both, or
   * null when the user does not hold it, in ONE query (ADR-076 A-17). This is
   * what `WorkspaceGuard` resolves, once per request.
   *
   * A workspace id that is not a uuid is answered exactly like one the user
   * does not hold, before it reaches the database: a probe learns nothing, and
   * a malformed header is a 403 rather than a cast error.
   */
  async accessFor(
    userId: string,
    workspaceId: string,
  ): Promise<ResolvedWorkspace | null> {
    if (!UUID.test(workspaceId)) return null;
    const [facts] = await this.factsFor(userId, workspaceId);
    if (!facts) return null;
    return {
      access: accessFromFacts(userId, facts),
      covered: coveredFromFacts(facts),
      facts,
    };
  }

  private async factsFor(
    userId: string,
    workspaceId: string | null,
  ): Promise<WorkspaceFacts[]> {
    const result = await this.db.execute<FactsRow>(
      workspaceFactsQuery(userId, workspaceId),
    );
    return result.rows.map(factsFromRow);
  }

  /**
   * Active oversight grants. A revoked grant is absent, which is precisely why
   * "no assignment" and "no console" are the same outcome.
   */
  async oversightGrantsForUser(userId: string): Promise<OversightGrant[]> {
    const rows = await this.db
      .select({
        assignmentId: oversightAssignments.id,
        oversightRole: oversightAssignments.oversightRole,
        governmentBodyCode: oversightAssignments.governmentBodyCode,
        governmentTitle: oversightAssignments.governmentTitle,
        scopeLevel: oversightAssignments.scopeLevel,
        provinceId: oversightAssignments.provinceId,
        districtId: oversightAssignments.districtId,
        // A local leader's post (P5) names its sector, cell and village too.
        sectorId: oversightAssignments.sectorId,
        cellId: oversightAssignments.cellId,
        villageId: oversightAssignments.villageId,
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
        sectorId: oversightAssignments.sectorId,
        cellId: oversightAssignments.cellId,
        villageId: oversightAssignments.villageId,
        provinceName: provinces.name,
        districtName: districts.name,
        sectorName: sectors.name,
        cellName: cells.name,
        villageName: villages.name,
      })
      .from(oversightAssignments)
      .innerJoin(
        governmentBodies,
        eq(governmentBodies.code, oversightAssignments.governmentBodyCode),
      )
      .leftJoin(provinces, eq(provinces.id, oversightAssignments.provinceId))
      .leftJoin(districts, eq(districts.id, oversightAssignments.districtId))
      .leftJoin(sectors, eq(sectors.id, oversightAssignments.sectorId))
      .leftJoin(cells, eq(cells.id, oversightAssignments.cellId))
      .leftJoin(villages, eq(villages.id, oversightAssignments.villageId))
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
      sectorId: row.sectorId,
      cellId: row.cellId,
      villageId: row.villageId,
      // A region an officer can READ. A country grant says Rwanda rather than
      // nothing, because "no region shown" and "every region" look identical on a
      // screen and only one of them is a bug. A name that failed to resolve falls
      // back to the level itself rather than to an empty string.
      scopeLabel:
        row.scopeLevel === 'country'
          ? OVERSIGHT_COUNTRY_SCOPE_LABEL
          : row.scopeLevel === 'province'
            ? tidyPlaceName(row.provinceName ?? 'Province')
            : row.scopeLevel === 'district'
              ? tidyPlaceName(row.districtName ?? 'District')
              : // A local leader's post (P5): its own place, then the district.
                [
                  row.scopeLevel === 'village' ? `${tidyPlaceName(row.villageName ?? 'Village')} village` : null,
                  row.scopeLevel === 'village' || row.scopeLevel === 'cell'
                    ? `${tidyPlaceName(row.cellName ?? 'Cell')} cell`
                    : null,
                  `${tidyPlaceName(row.sectorName ?? 'Sector')} sector`,
                  row.districtName ? tidyPlaceName(row.districtName) : null,
                ]
                  .filter((part): part is string => Boolean(part))
                  .join(', '),
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

    // Custom roles (2026-11-02): the live assignments to live (unarchived)
    // roles, and the permissions each bundles. Read here, in the ONE resolver,
    // so `StaffGuard` and `/me/staff` pick them up together. The stored
    // permission strings go through `staffPermissionsForGrants`, which keeps
    // only what the code defines and never a reserved power.
    const custom = await this.db
      .select({
        id: staffCustomRoles.id,
        name: staffCustomRoles.name,
        permission: staffCustomRolePermissions.permission,
      })
      .from(userStaffCustomRoles)
      .innerJoin(staffCustomRoles, eq(staffCustomRoles.id, userStaffCustomRoles.roleId))
      .leftJoin(staffCustomRolePermissions, eq(staffCustomRolePermissions.roleId, staffCustomRoles.id))
      .where(
        and(
          eq(userStaffCustomRoles.userId, userId),
          isNull(userStaffCustomRoles.revokedAt),
          isNull(staffCustomRoles.archivedAt),
        ),
      );

    const customRoles = new Map<string, string>();
    for (const c of custom) customRoles.set(c.id, c.name);

    const roles = row.staffRoles ?? [];
    return {
      isStaff: true,
      roles,
      permissions: staffPermissionsForGrants(
        roles,
        custom.flatMap((c) => (c.permission ? [c.permission] : [])),
      ),
      customRoles: [...customRoles].map(([id, name]) => ({ id, name })),
    };
  }
}
