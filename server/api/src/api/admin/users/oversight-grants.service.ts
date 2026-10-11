import {
  type AdminOversightGrant,
  type CreateOversightGrantRequest,
  OVERSIGHT_ORG_ROLE_CONFLICT_MESSAGE,
  OVERSIGHT_ROLE_POSTING,
  OVERSIGHT_SCOPE_CONFLICT_MESSAGE,
  opposingGateRole,
  type OversightScope,
  oversightScopesOverlap,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import {
  auditEvents,
  districts,
  governmentBodies,
  orgMemberships,
  orgs,
  oversightAssignments,
  provinces,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * Appointing and revoking a government officer (ADR-053, AC-G1 to AC-G3, AC-G10).
 *
 * **Nothing wrote `oversight_assignments` before this.** The table, its enums and
 * its scope CHECK all existed, the guard read it, and the only way to create an
 * officer was a seed script — so MINALOC and PSF could not be staffed on a real
 * deployment without a release. This is the write path that closes that.
 *
 * ## Two refusals at grant time, and why the database cannot hold them
 *
 * **Separation of duties, by scope containment.** A person may not hold
 * `business_field_verifier` and `business_approver` over any of the same ground.
 * `oversight_assignments_active_uk` catches only the IDENTICAL pair, and its own
 * comment concedes this: a country-wide verifier plus a Gasabo approver is the
 * same person checking and approving their own work, and the two rows look
 * nothing alike. A partial unique index cannot express containment, so the
 * application owns the rule and the index stays as the backstop.
 *
 * **Conflict of interest.** A person holding an active role in a business inside
 * the proposed scope is refused. A hotelier confirming that their competitors down
 * the road are genuine businesses is exactly the conflict the gate exists to
 * prevent.
 *
 * Both are re-checked AT THE ACT as well, in `RegistrationService`, because a
 * grant check alone cannot hold: a person granted first can acquire the conflict
 * afterwards.
 *
 * ## Single signer, by decision
 *
 * `admin.user.role.grant` is held by `super_admin` only and is one of the two
 * `TWO_PERSON_STAFF_PERMISSIONS`, with `needsSecondSigner` declared and nothing
 * implementing it. That stays true after this service: the owner chose single
 * signer over building the second signer flow, and ADR-053 records the risk.
 */
@Injectable()
export class OversightGrantsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Appoint an officer.
   *
   * Everything happens in ONE transaction, the `audit_events` row included. An
   * appointment that was made and not recorded is the one outcome a compliance
   * scope under Law 058/2021 cannot tolerate, and a second write after commit is
   * a second chance to fail.
   */
  async grant(input: {
    actorUserId: string;
    userId: string;
    request: CreateOversightGrantRequest;
    reason: string;
  }): Promise<AdminOversightGrant> {
    const r = input.request;

    // ADR-056 AC-10: a role with a posting rule is appointed only where the
    // rule says. Only `psf_membership_officer` has one (PSF, country scope);
    // the registration roles have none and are unchanged.
    const posting = OVERSIGHT_ROLE_POSTING[r.oversightRole];
    if (
      posting &&
      (r.governmentBodyCode !== posting.governmentBodyCode ||
        !posting.scopeLevels.includes(r.scopeLevel))
    ) {
      throw new UnprocessableEntityException(posting.message);
    }

    return this.db.transaction(async (tx) => {
      const [person] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!person) throw new NotFoundException('No user has that id.');

      // The body has to exist AND be live. A soft retired body cannot be chosen
      // for a NEW grant, while every existing grant keeps naming it (AC-G4).
      const [body] = await tx
        .select({ code: governmentBodies.code, active: governmentBodies.active })
        .from(governmentBodies)
        .where(eq(governmentBodies.code, r.governmentBodyCode))
        .limit(1);
      if (!body) {
        throw new BadRequestException('No government body has that code.');
      }
      if (!body.active) {
        throw new ConflictException(
          'That government body is retired and cannot take new appointments.',
        );
      }

      const proposed = await this.resolveScope(tx, {
        scopeLevel: r.scopeLevel,
        provinceId: r.provinceId ?? null,
        districtId: r.districtId ?? null,
      });

      await this.assertNoScopeConflict(tx, {
        userId: input.userId,
        oversightRole: r.oversightRole,
        proposed,
      });
      await this.assertNoOrgRoleConflict(tx, {
        userId: input.userId,
        proposed,
      });

      const [created] = await tx
        .insert(oversightAssignments)
        .values({
          userId: input.userId,
          oversightRole: r.oversightRole,
          governmentBodyCode: r.governmentBodyCode,
          governmentTitle: r.governmentTitle,
          scopeLevel: r.scopeLevel,
          provinceId: r.scopeLevel === 'province' ? (r.provinceId ?? null) : null,
          districtId: r.scopeLevel === 'district' ? (r.districtId ?? null) : null,
          assignedByUserId: input.actorUserId,
        })
        .returning({ id: oversightAssignments.id });
      if (!created) throw new Error('Oversight grant insert returned no row.');

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'user',
        subjectId: input.userId,
        eventType: 'admin.user.oversight_granted',
        payloadDiff: {
          oversight: {
            assignmentId: created.id,
            oversightRole: r.oversightRole,
            governmentBodyCode: r.governmentBodyCode,
            governmentTitle: r.governmentTitle,
            scopeLevel: r.scopeLevel,
            provinceId: r.provinceId ?? null,
            districtId: r.districtId ?? null,
          },
        } as never,
        reason: input.reason,
        // The district the appointment covers, so a regional audit can be filtered
        // without re-resolving every grant's scope.
        districtId: proposed.districtId,
      });

      return this.read(tx, created.id);
    });
  }

  /**
   * Revoke an appointment.
   *
   * **`revoked_at`, never a delete.** A revoked posting has to keep explaining a
   * decision already taken: `org_registration_reviews` carries its own copies of
   * the body and title precisely so a decision survives the grant, and deleting
   * the grant would still erase the record that the person ever held the post.
   */
  async revoke(input: {
    actorUserId: string;
    userId: string;
    assignmentId: string;
    reason: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(oversightAssignments)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(oversightAssignments.id, input.assignmentId),
            // Scoped to the named user as well as the id, so a mistyped pair is a
            // 404 rather than revoking somebody else's posting.
            eq(oversightAssignments.userId, input.userId),
            isNull(oversightAssignments.revokedAt),
          ),
        )
        .returning({
          id: oversightAssignments.id,
          oversightRole: oversightAssignments.oversightRole,
          governmentBodyCode: oversightAssignments.governmentBodyCode,
          districtId: oversightAssignments.districtId,
        });

      const revoked = rows[0];
      if (!revoked) {
        throw new NotFoundException(
          'That person holds no such live appointment.',
        );
      }

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'user',
        subjectId: input.userId,
        eventType: 'admin.user.oversight_revoked',
        payloadDiff: {
          oversight: {
            assignmentId: revoked.id,
            oversightRole: revoked.oversightRole,
            governmentBodyCode: revoked.governmentBodyCode,
          },
        } as never,
        reason: input.reason,
        districtId: revoked.districtId,
      });
    });
  }

  /**
   * Fill in a district scope's province.
   *
   * Containment cannot be decided without it: a province grant contains a district
   * grant exactly when the district sits in that province, and the grant row only
   * records the district.
   */
  private async resolveScope(
    tx: Database,
    scope: OversightScope,
  ): Promise<OversightScope> {
    if (scope.scopeLevel !== 'district') return scope;
    const [row] = await tx
      .select({ provinceId: districts.provinceId })
      .from(districts)
      .where(eq(districts.id, scope.districtId!))
      .limit(1);
    if (!row) throw new BadRequestException('No district has that id.');
    return { ...scope, provinceId: row.provinceId };
  }

  /** AC-G2. The opposing gate role, anywhere inside the same ground. */
  private async assertNoScopeConflict(
    tx: Database,
    input: {
      userId: string;
      oversightRole: CreateOversightGrantRequest['oversightRole'];
      proposed: OversightScope;
    },
  ): Promise<void> {
    const opposing = opposingGateRole(input.oversightRole);
    // A tax compliance posting gates nothing in the registration pipeline, so it
    // opposes nothing and may sit alongside either gate role.
    if (opposing === null) return;

    const held = await tx
      .select({
        scopeLevel: oversightAssignments.scopeLevel,
        provinceId: oversightAssignments.provinceId,
        districtId: oversightAssignments.districtId,
        districtProvinceId: districts.provinceId,
      })
      .from(oversightAssignments)
      .leftJoin(districts, eq(districts.id, oversightAssignments.districtId))
      .where(
        and(
          eq(oversightAssignments.userId, input.userId),
          eq(oversightAssignments.oversightRole, opposing),
          isNull(oversightAssignments.revokedAt),
        ),
      );

    for (const row of held) {
      const existing: OversightScope = {
        scopeLevel: row.scopeLevel,
        // For a district grant the province comes from the JOIN, which is what
        // makes "is this district inside that province" answerable.
        provinceId:
          row.scopeLevel === 'district' ? row.districtProvinceId : row.provinceId,
        districtId: row.districtId,
      };
      if (oversightScopesOverlap(existing, input.proposed)) {
        throw new ConflictException({
          code: 'oversight_scope_conflict',
          message: OVERSIGHT_SCOPE_CONFLICT_MESSAGE,
        });
      }
    }
  }

  /** AC-G3. An active org role in a business inside the proposed scope. */
  private async assertNoOrgRoleConflict(
    tx: Database,
    input: { userId: string; proposed: OversightScope },
  ): Promise<void> {
    const memberships = await tx
      .select({
        orgId: orgs.id,
        legalName: orgs.legalName,
        districtId: orgs.districtId,
        districtProvinceId: districts.provinceId,
      })
      .from(orgMemberships)
      .innerJoin(orgs, eq(orgs.id, orgMemberships.orgId))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .where(
        and(
          eq(orgMemberships.userId, input.userId),
          eq(orgMemberships.status, 'active'),
        ),
      );

    for (const org of memberships) {
      const inScope = oversightScopesOverlap(input.proposed, {
        // A business sits in exactly one district, which is a district-level
        // scope of one. Comparing it with the same containment helper keeps one
        // definition of "inside".
        scopeLevel: 'district',
        provinceId: org.districtProvinceId,
        districtId: org.districtId,
      });
      if (inScope) {
        throw new ConflictException({
          code: 'oversight_org_role_conflict',
          message: OVERSIGHT_ORG_ROLE_CONFLICT_MESSAGE,
        });
      }
    }
  }

  /** The grant as the console shows it, read back after the write. */
  private async read(
    tx: Database,
    assignmentId: string,
  ): Promise<AdminOversightGrant> {
    const [row] = await tx
      .select({
        id: oversightAssignments.id,
        oversightRole: oversightAssignments.oversightRole,
        governmentBodyCode: oversightAssignments.governmentBodyCode,
        governmentBodyName: governmentBodies.nameEn,
        governmentTitle: oversightAssignments.governmentTitle,
        scopeLevel: oversightAssignments.scopeLevel,
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
      .where(eq(oversightAssignments.id, assignmentId))
      .limit(1);
    if (!row) throw new Error('Oversight grant vanished after insert.');

    return {
      id: row.id,
      oversightRole: row.oversightRole,
      governmentBodyCode: row.governmentBodyCode,
      governmentBodyName: row.governmentBodyName,
      governmentTitle: row.governmentTitle,
      scopeLevel: row.scopeLevel,
      // Null for a country grant, which names no region at all. An empty string
      // would read as "a region we failed to look up".
      scopeLabel:
        row.scopeLevel === 'district'
          ? (row.districtName ?? null)
          : row.scopeLevel === 'province'
            ? (row.provinceName ?? null)
            : null,
    };
  }
}
