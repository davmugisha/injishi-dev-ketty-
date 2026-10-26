import type { OrgRole } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { sessions, users } from '../../../database/drizzle/auth';
import {
  auditEvents,
  orgMembershipBranches,
  orgMemberships,
  properties,
  userProfiles,
  verifiedIdentities,
  workspaces,
} from '../../../database/drizzle/schema';

/** One membership row, joined to the person it names. */
export interface TeamMemberRow {
  userId: string;
  name: string | null;
  email: string | null;
  orgRole: OrgRole;
  status: string;
  joinedAt: Date;
  /** Null: every branch. An owner is always null (ADR-054 invariant 5). */
  branchIds: string[] | null;
  /** The newest of their sessions' last use, or null when they never signed in. */
  lastActiveAt: Date | null;
  removedAt: Date | null;
  identityVerified: boolean;
}

/** Why a member's role was not changed. Nothing is written for any of them. */
export type MemberRoleResult =
  | { kind: 'done'; from: OrgRole }
  | { kind: 'missing' }
  | { kind: 'owner' }
  | { kind: 'same' };

/** Why a member's branches were not changed. Nothing is written for any of them. */
export type MemberBranchesResult =
  | { kind: 'done' }
  | { kind: 'missing' }
  | { kind: 'owner' }
  | { kind: 'foreign' }
  | { kind: 'archived' };

/**
 * Who works at a business (ADR-035, wave 2 follow-up).
 *
 * **This repository exists because nothing read `org_memberships` for anybody
 * but the caller.** `WorkspaceService` queries it to resolve your own grant and
 * stops there, so the operator app had no way to list its own staff and the
 * screen that tried showed invented people.
 *
 * IT RESOLVES THE ORG FROM THE WORKSPACE, not from a caller supplied org id.
 * A workspace belongs to exactly one org, and taking the org from the request
 * would let somebody who holds workspace A ask for the staff of org B. The
 * guard proves the workspace; this derives everything else from it.
 *
 * REMOVED MEMBERS ARE RETURNED, not filtered out. A membership is never
 * deleted — `status` goes to `removed` and `removed_at` is stamped — because
 * the rows they posted, charged and voided still name them. The screen decides
 * whether to show them; the repository does not get to hide history.
 */
@Injectable()
export class TeamRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForWorkspace(workspaceId: string): Promise<TeamMemberRow[]> {
    const rows = await this.db
      .select({
        membershipId: orgMemberships.id,
        userId: orgMemberships.userId,
        // The profile's display name first, the auth record's second. A person
        // who has completed Step 1 chose the first; the second is whatever the
        // sign-in gave us, and it is better than nothing.
        displayName: userProfiles.displayName,
        authName: users.name,
        email: users.email,
        orgRole: orgMemberships.orgRole,
        status: orgMemberships.status,
        joinedAt: orgMemberships.createdAt,
        removedAt: orgMemberships.removedAt,
        kycStatus: verifiedIdentities.kycStatus,
        // A session row is touched each time it is refreshed, so its newest
        // `updated_at` is when the person last used the product, near enough.
        lastActiveAt: sql<Date | null>`(
          select max(${sessions.updatedAt}) from ${sessions}
           where ${sessions.userId} = ${orgMemberships.userId}
        )`.mapWith((v: string | Date | null) => (v ? new Date(v) : null)),
      })
      .from(orgMemberships)
      .innerJoin(workspaces, eq(workspaces.orgId, orgMemberships.orgId))
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .leftJoin(userProfiles, eq(userProfiles.userId, orgMemberships.userId))
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, orgMemberships.userId))
      .where(eq(workspaces.id, workspaceId))
      .orderBy(asc(orgMemberships.orgRole), asc(users.email));

    // The branch limits in one more query rather than a join, which would
    // repeat each member once per branch (ADR-054 AC-T1).
    const limits = new Map<string, string[]>();
    if (rows.length > 0) {
      const limitRows = await this.db
        .select({
          membershipId: orgMembershipBranches.orgMembershipId,
          propertyId: orgMembershipBranches.propertyId,
        })
        .from(orgMembershipBranches)
        .where(
          inArray(
            orgMembershipBranches.orgMembershipId,
            rows.map((r) => r.membershipId),
          ),
        );
      for (const row of limitRows) {
        const list = limits.get(row.membershipId) ?? [];
        list.push(row.propertyId);
        limits.set(row.membershipId, list);
      }
    }

    return rows.map((row) => ({
      userId: row.userId,
      name: row.displayName ?? row.authName,
      email: row.email,
      orgRole: row.orgRole,
      status: row.status,
      joinedAt: row.joinedAt,
      branchIds:
        row.orgRole === 'owner' ? null : (limits.get(row.membershipId) ?? null),
      lastActiveAt: row.lastActiveAt,
      removedAt: row.removedAt,
      identityVerified: row.kycStatus === 'verified',
    }));
  }

  /**
   * Move one active member to another staff role, and audit it in the same
   * transaction.
   *
   * The membership row is locked first, so two owners changing the same person
   * at once apply one after the other and each audit row's `from` is what the
   * other actually wrote. An owner is refused here as well as by the request
   * schema: the schema stops a caller MAKING somebody owner, this stops a caller
   * UNMAKING one. Ownership moves only through the owner claim.
   */
  async setMemberRole(input: {
    orgId: string;
    userId: string;
    orgRole: Exclude<OrgRole, 'owner'>;
    actorUserId: string;
  }): Promise<MemberRoleResult> {
    return this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select({
          id: orgMemberships.id,
          orgRole: orgMemberships.orgRole,
          status: orgMemberships.status,
          removedAt: orgMemberships.removedAt,
        })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, input.orgId),
            eq(orgMemberships.userId, input.userId),
          ),
        )
        .for('update')
        .limit(1);
      if (!membership || membership.status !== 'active' || membership.removedAt) {
        return { kind: 'missing' };
      }
      if (membership.orgRole === 'owner') return { kind: 'owner' };
      if (membership.orgRole === input.orgRole) return { kind: 'same' };

      await tx
        .update(orgMemberships)
        .set({ orgRole: input.orgRole, updatedAt: new Date() })
        .where(eq(orgMemberships.id, membership.id));

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'user',
        subjectId: input.userId,
        eventType: 'team.member_role_changed',
        payloadDiff: {
          orgId: input.orgId,
          orgRole: { from: membership.orgRole, to: input.orgRole },
        } as never,
        reason: null,
      });
      return { kind: 'done', from: membership.orgRole };
    });
  }

  /**
   * Set which branches one active member covers (ADR-054 AC-T1, AC-A1).
   *
   * All or nothing, on the membership row locked first, so two owners editing
   * the same person at once apply one after the other and each audit row's
   * `from` is what the other actually wrote. `branchIds` null clears the limit.
   * Ids are checked HERE, under the same lock, because a branch archived between
   * a check and the write would otherwise leave a member covering nothing.
   */
  async setMemberBranches(input: {
    orgId: string;
    userId: string;
    branchIds: readonly string[] | null;
    actorUserId: string;
  }): Promise<MemberBranchesResult> {
    return this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select({
          id: orgMemberships.id,
          orgRole: orgMemberships.orgRole,
          status: orgMemberships.status,
          removedAt: orgMemberships.removedAt,
        })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, input.orgId),
            eq(orgMemberships.userId, input.userId),
          ),
        )
        .for('update')
        .limit(1);
      if (!membership || membership.status !== 'active' || membership.removedAt) {
        return { kind: 'missing' };
      }
      if (membership.orgRole === 'owner') return { kind: 'owner' };

      if (input.branchIds) {
        const found = await tx
          .select({
            id: properties.id,
            orgId: properties.orgId,
            archivedAt: properties.archivedAt,
          })
          .from(properties)
          .where(inArray(properties.id, [...input.branchIds]))
          .for('share');
        if (
          found.length !== input.branchIds.length ||
          found.some((p) => p.orgId !== input.orgId)
        ) {
          return { kind: 'foreign' };
        }
        if (found.some((p) => p.archivedAt !== null)) return { kind: 'archived' };
      }

      const before = await tx
        .select({ propertyId: orgMembershipBranches.propertyId })
        .from(orgMembershipBranches)
        .where(eq(orgMembershipBranches.orgMembershipId, membership.id));

      await tx
        .delete(orgMembershipBranches)
        .where(eq(orgMembershipBranches.orgMembershipId, membership.id));
      if (input.branchIds) {
        await tx.insert(orgMembershipBranches).values(
          input.branchIds.map((propertyId) => ({
            orgMembershipId: membership.id,
            propertyId,
          })),
        );
      }

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        subjectType: 'user',
        subjectId: input.userId,
        eventType: 'team.member_branches_changed',
        payloadDiff: {
          orgId: input.orgId,
          branchIds: {
            from: before.length > 0 ? before.map((r) => r.propertyId).sort() : null,
            to: input.branchIds ? [...input.branchIds].sort() : null,
          },
        } as never,
        reason: null,
      });
      return { kind: 'done' };
    });
  }
}
