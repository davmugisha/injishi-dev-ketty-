import type { InvitableOrgRole, OrgRole } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { type SQL, and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';

import {
  auditEvents,
  orgInvitations,
  orgMembershipBranches,
  orgMemberships,
  orgs,
  properties,
  users,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { ensureStaffFileTx } from '../../hr/infrastructure/staff-file';

/** Any reason an acceptance writes nothing. Rolls the transaction back. */
export class StaffInvitationRefused extends Error {
  constructor(
    readonly why:
      | 'no_live_invitation'
      | 'wrong_account'
      | 'already_member'
      | 'branches_gone',
    readonly existingRole?: OrgRole,
  ) {
    super(`Staff invitation refused: ${why}`);
  }
}

export interface StaffInvitationRow {
  id: string;
  email: string;
  orgRole: OrgRole;
  status: 'sent' | 'accepted' | 'revoked' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  branchIds: string[] | null;
  name: string | null;
}

/**
 * Staff invitations: `org_invitations` rows with purpose `staff`.
 *
 * The table and its `staff` purpose were in the schema from the start and
 * nothing wrote one, so an approved owner had no way to put a receptionist on
 * their business at all (`TeamService` says as much). This is that flow: the
 * owner or manager invites by email and role, the invitee signs in with that
 * address and accepts, and the membership is written in one transaction with
 * the invitation spent.
 */
@Injectable()
export class StaffInvitationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForOrg(orgId: string): Promise<StaffInvitationRow[]> {
    return this.db
      .select({
        id: orgInvitations.id,
        email: orgInvitations.email,
        orgRole: orgInvitations.orgRole,
        status: orgInvitations.status,
        expiresAt: orgInvitations.expiresAt,
        createdAt: orgInvitations.createdAt,
        branchIds: orgInvitations.branchPropertyIds,
        name: orgInvitations.inviteeName,
      })
      .from(orgInvitations)
      .where(and(eq(orgInvitations.orgId, orgId), eq(orgInvitations.purpose, 'staff')))
      .orderBy(desc(orgInvitations.createdAt));
  }

  /** The active member holding this address on this business, if any. */
  async memberByEmail(orgId: string, email: string): Promise<{ orgRole: OrgRole } | null> {
    const [row] = await this.db
      .select({ orgRole: orgMemberships.orgRole })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.status, 'active'),
          sql`${orgMemberships.removedAt} is null`,
          sql`lower(${users.email}) = ${email.toLowerCase()}`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Whether every id names a live branch of this org (ADR-054 AC-T1): `foreign`
   * when one is missing or belongs to another org, `archived` when one is
   * retired, null when all hold.
   */
  async branchRefusal(
    orgId: string,
    branchIds: readonly string[],
  ): Promise<'foreign' | 'archived' | null> {
    const found = await this.db
      .select({ orgId: properties.orgId, archivedAt: properties.archivedAt })
      .from(properties)
      .where(inArray(properties.id, [...branchIds]));
    if (found.length !== branchIds.length || found.some((p) => p.orgId !== orgId)) {
      return 'foreign';
    }
    return found.some((p) => p.archivedAt !== null) ? 'archived' : null;
  }

  /**
   * Issue an invitation, first revoking any still-live one to the same address.
   *
   * One live invitation per address per business, so a resend replaces the
   * link rather than leaving two working links in two inboxes.
   */
  async issue(input: {
    orgId: string;
    email: string;
    orgRole: InvitableOrgRole;
    branchIds: readonly string[] | null;
    token: string;
    expiresAt: Date;
    invitedByUserId: string;
    name?: string | null;
  }): Promise<string> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(orgInvitations)
        .set({ status: 'revoked', updatedAt: new Date() })
        .where(
          and(
            eq(orgInvitations.orgId, input.orgId),
            eq(orgInvitations.purpose, 'staff'),
            eq(orgInvitations.status, 'sent'),
            sql`lower(${orgInvitations.email}) = ${input.email.toLowerCase()}`,
          ),
        );
      const [row] = await tx
        .insert(orgInvitations)
        .values({
          orgId: input.orgId,
          email: input.email.toLowerCase(),
          orgRole: input.orgRole,
          branchPropertyIds: input.branchIds ? [...input.branchIds] : null,
          inviteeName: input.name ?? null,
          purpose: 'staff',
          token: input.token,
          expiresAt: input.expiresAt,
        })
        .returning({ id: orgInvitations.id });
      if (!row) throw new Error('Invitation insert returned no row.');
      await tx.insert(auditEvents).values({
        actorUserId: input.invitedByUserId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: 'team.invitation_sent',
        payloadDiff: {
          invitationId: row.id,
          email: input.email,
          orgRole: input.orgRole,
          branchIds: input.branchIds,
        } as never,
        reason: null,
      });
      return row.id;
    });
  }

  /** Revoke one live invitation on this business. False when there was none. */
  async revoke(orgId: string, invitationId: string): Promise<boolean> {
    const rows = await this.db
      .update(orgInvitations)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(
        and(
          eq(orgInvitations.id, invitationId),
          eq(orgInvitations.orgId, orgId),
          eq(orgInvitations.purpose, 'staff'),
          eq(orgInvitations.status, 'sent'),
        ),
      )
      .returning({ id: orgInvitations.id });
    return rows.length > 0;
  }

  /** What the join page shows, for a live token on this business only. */
  async preview(
    orgId: string,
    token: string,
  ): Promise<{ legalName: string; orgRole: OrgRole; email: string } | null> {
    const [row] = await this.db
      .select({
        legalName: orgs.legalName,
        orgRole: orgInvitations.orgRole,
        email: orgInvitations.email,
      })
      .from(orgInvitations)
      .innerJoin(orgs, eq(orgs.id, orgInvitations.orgId))
      .where(liveInvitation(orgId, token))
      .limit(1);
    return row ?? null;
  }

  /**
   * Accept, all or nothing: re-assert the token, check the signed-in account IS
   * the invited address, write the membership, spend the invitation, audit.
   *
   * A person already active on the business is refused rather than silently
   * re-roled: an invitation must never be the way an owner becomes a
   * housekeeper, or a housekeeper a manager, by forwarding a mail.
   */
  async accept(input: {
    orgId: string;
    token: string;
    userId: string;
    userEmail: string;
  }): Promise<{ workspaceId: string; orgRole: OrgRole }> {
    return this.db.transaction(async (tx) => {
      const [invitation] = await tx
        .select({
          id: orgInvitations.id,
          email: orgInvitations.email,
          orgRole: orgInvitations.orgRole,
          branchPropertyIds: orgInvitations.branchPropertyIds,
        })
        .from(orgInvitations)
        .where(liveInvitation(input.orgId, input.token))
        .limit(1);
      if (!invitation) throw new StaffInvitationRefused('no_live_invitation');
      if (invitation.email.toLowerCase() !== input.userEmail.toLowerCase()) {
        throw new StaffInvitationRefused('wrong_account');
      }

      const [existing] = await tx
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
        .limit(1);
      if (existing && existing.status === 'active' && existing.removedAt === null) {
        throw new StaffInvitationRefused('already_member', existing.orgRole);
      }

      // The branches the invite named, less any archived since it was sent
      // (ADR-054, invite accept). A limit left with nothing would make a member
      // who covers no branch, so it is refused instead (409).
      let branchIds: string[] | null = null;
      if (invitation.branchPropertyIds && invitation.branchPropertyIds.length > 0) {
        const live = await tx
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(
              inArray(properties.id, invitation.branchPropertyIds),
              eq(properties.orgId, input.orgId),
              isNull(properties.archivedAt),
            ),
          )
          .for('share');
        if (live.length === 0) throw new StaffInvitationRefused('branches_gone');
        branchIds = live.map((p) => p.id);
      }

      let membershipId: string;
      if (existing) {
        membershipId = existing.id;
        // Somebody who used to work here comes back in the role they were
        // invited to now, on the same row, so their history stays in one place.
        await tx
          .update(orgMemberships)
          .set({
            orgRole: invitation.orgRole,
            status: 'active',
            removedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(orgMemberships.id, existing.id));
      } else {
        const [created] = await tx
          .insert(orgMemberships)
          .values({
            orgId: input.orgId,
            userId: input.userId,
            orgRole: invitation.orgRole,
          })
          .returning({ id: orgMemberships.id });
        if (!created) throw new Error('Membership insert returned no row.');
        membershipId = created.id;
      }

      // The invite decides the coverage, including for a returning member,
      // whose old limit must not outlive the role they left.
      await tx
        .delete(orgMembershipBranches)
        .where(eq(orgMembershipBranches.orgMembershipId, membershipId));
      if (branchIds) {
        await tx
          .insert(orgMembershipBranches)
          .values(branchIds.map((propertyId) => ({ orgMembershipId: membershipId, propertyId })));
      }

      const spent = await tx
        .update(orgInvitations)
        .set({ status: 'accepted', acceptedByUserId: input.userId, updatedAt: new Date() })
        .where(and(eq(orgInvitations.id, invitation.id), eq(orgInvitations.status, 'sent')))
        .returning({ id: orgInvitations.id });
      if (spent.length === 0) throw new StaffInvitationRefused('no_live_invitation');

      // Every way into a business ends with a file (ADR-058, 058-self-service
      // AC-J2): a thin one is written in this transaction when the membership
      // has no active file, so the Staff list never misses somebody who joined
      // through Team.
      await ensureStaffFileTx(tx, { orgId: input.orgId, membershipId });

      const [workspace] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.orgId, input.orgId), eq(workspaces.kind, 'business')))
        .limit(1);
      if (!workspace) throw new StaffInvitationRefused('no_live_invitation');

      await tx.insert(auditEvents).values({
        actorUserId: input.userId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: 'team.invitation_accepted',
        payloadDiff: {
          invitationId: invitation.id,
          orgRole: invitation.orgRole,
          branchIds,
        } as never,
        reason: null,
      });

      return { workspaceId: workspace.id, orgRole: invitation.orgRole };
    });
  }

  async legalName(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ legalName: orgs.legalName })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row?.legalName ?? null;
  }

  async displayName(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.name ?? null;
  }
}

/** The live invitation rule: this token, this business, staff, unspent, unexpired. */
function liveInvitation(orgId: string, token: string): SQL | undefined {
  return and(
    eq(orgInvitations.token, token),
    eq(orgInvitations.orgId, orgId),
    eq(orgInvitations.purpose, 'staff'),
    eq(orgInvitations.status, 'sent'),
    gt(orgInvitations.expiresAt, sql`now()`),
  );
}
