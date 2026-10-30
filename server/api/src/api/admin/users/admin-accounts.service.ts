import {
  AdminCreateUserResponse,
  AdminMemberChange,
  AdminStaffRolesResponse,
  ORG_ROLE_LABEL,
  type AdminAddMemberRequest,
  type AdminChangeMemberRoleRequest,
  type AdminCreateUserRequest,
  type AdminSetStaffRolesRequest,
  type OrgRole,
  type StaffRole,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';

import { adminUsers, auditEvents, orgMemberships, orgs, users } from '../../../database/drizzle/schema';
import { compose, greeting } from '../../../modules/organization/domain/registration-mail';
import { GuestNotifier } from '../../../modules/guests/infrastructure/guest-notifier';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * The account writes of the admin console (2026-10-29): create a person, set
 * their platform staff roles, and put them in a business, change their role
 * there or take them out.
 *
 * Every write commits exactly one `audit_events` row in the same transaction as
 * the change, with the staffer, the subject, what moved and the reason they
 * wrote, the rule `AdminUserActionsService` follows. A mail that a change
 * prompts goes after the commit and never undoes it.
 *
 * A person is found by email, case-insensitively, and created when there is no
 * account yet: Better Auth's email code sign-in then signs them into the row
 * made here, as it does for an appointed local leader.
 */
@Injectable()
export class AdminAccountsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notifier: GuestNotifier,
  ) {}

  /** Create an account by email, or answer the one that address already has. */
  async createUser(input: AdminCreateUserRequest, actorUserId: string): Promise<AdminCreateUserResponse> {
    const result = await this.db.transaction(async (tx) => {
      const person = await this.findOrCreate(tx, input.email, input.name);
      if (person.created) {
        await this.audit(tx, actorUserId, 'user', person.userId, 'admin.user.created', { email: input.email }, input.reason);
      }
      return person;
    });
    if (result.created) {
      await this.notifier.send(
        input.email,
        compose({
          subject: 'Your Injishi account is ready',
          heading: 'Your Injishi account is ready',
          greeting: greeting({ name: input.name }),
          paragraphs: [
            'An Injishi account has been made for this email address. There is no password: you sign in with a code we email you each time.',
          ],
          cta: { label: 'Sign in to Injishi', href: `${this.notifier.appUrl}/sign-in` },
        }),
        'account created',
      );
    }
    return AdminCreateUserResponse.parse(result);
  }

  /**
   * Set a person's platform staff roles: the whole set, an empty one ending
   * their staff access.
   *
   * Two refusals keep the console from locking itself out: nobody changes
   * their own roles (a second super admin does it), and the last super admin
   * cannot lose the role.
   */
  async setStaffRoles(
    userId: string,
    input: AdminSetStaffRolesRequest,
    actorUserId: string,
  ): Promise<AdminStaffRolesResponse> {
    if (userId === actorUserId) {
      throw new ConflictException({
        code: 'self_grant',
        message: 'You cannot change your own staff roles. Ask another super admin.',
      });
    }
    const roles = [...new Set(input.roles)] as StaffRole[];
    return this.db.transaction(async (tx) => {
      await this.requireUser(tx, userId);
      const [current] = await tx
        .select({ staffRoles: adminUsers.staffRoles, revokedAt: adminUsers.revokedAt })
        .from(adminUsers)
        .where(eq(adminUsers.userId, userId))
        .limit(1);
      const before: StaffRole[] = current && !current.revokedAt ? (current.staffRoles as StaffRole[]) : [];

      if (before.includes('super_admin') && !roles.includes('super_admin')) {
        const [others] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(adminUsers)
          .where(
            and(
              ne(adminUsers.userId, userId),
              isNull(adminUsers.revokedAt),
              sql`'super_admin' = any(${adminUsers.staffRoles})`,
            ),
          );
        if ((others?.n ?? 0) === 0) {
          throw new ConflictException({
            code: 'last_super_admin',
            message: 'This is the only super admin. Make someone else a super admin first.',
          });
        }
      }

      const now = new Date();
      if (roles.length === 0) {
        if (current) await tx.update(adminUsers).set({ revokedAt: now, updatedAt: now }).where(eq(adminUsers.userId, userId));
      } else if (current) {
        await tx
          .update(adminUsers)
          .set({ staffRoles: roles, revokedAt: null, grantedByUserId: actorUserId, updatedAt: now })
          .where(eq(adminUsers.userId, userId));
      } else {
        await tx.insert(adminUsers).values({ userId, staffRoles: roles, grantedByUserId: actorUserId });
      }

      const auditEventId = await this.audit(
        tx,
        actorUserId,
        'user',
        userId,
        'admin.user.staff_roles_set',
        { staffRoles: { from: before, to: roles } },
        input.reason,
      );
      return AdminStaffRolesResponse.parse({ userId, staffRoles: roles, auditEventId });
    });
  }

  /**
   * Put a person in a business with a role, directly: they are a member at
   * once (owner decision, 2026-10-29), and are mailed that they were added.
   * A removed member is brought back with the new role. Making someone the
   * owner makes the business's current owner a manager.
   */
  async addMember(orgId: string, input: AdminAddMemberRequest, actorUserId: string): Promise<AdminMemberChange> {
    const outcome = await this.db.transaction(async (tx) => {
      const org = await this.requireOrg(tx, orgId);
      const person = await this.findOrCreate(tx, input.email, input.name ?? null);
      const [existing] = await tx
        .select({ id: orgMemberships.id, orgRole: orgMemberships.orgRole, status: orgMemberships.status })
        .from(orgMemberships)
        .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, person.userId)))
        .limit(1);
      if (existing && existing.status === 'active') {
        throw new ConflictException({
          code: 'already_member',
          message: `This person is already in ${org.legalName} as ${ORG_ROLE_LABEL[existing.orgRole as OrgRole]}. Change their role instead.`,
        });
      }

      const demotedOwnerIds = input.orgRole === 'owner' ? await this.demoteOwners(tx, orgId, person.userId) : [];
      const now = new Date();
      if (existing) {
        await tx
          .update(orgMemberships)
          .set({ orgRole: input.orgRole, status: 'active', removedAt: null, invitedByUserId: actorUserId, updatedAt: now })
          .where(eq(orgMemberships.id, existing.id));
      } else {
        await tx.insert(orgMemberships).values({
          orgId,
          userId: person.userId,
          orgRole: input.orgRole,
          status: 'active',
          invitedByUserId: actorUserId,
        });
      }

      const auditEventId = await this.audit(
        tx,
        actorUserId,
        'org',
        orgId,
        'admin.org.member_added',
        { userId: person.userId, orgRole: input.orgRole, demotedOwnerIds, createdUser: person.created },
        input.reason,
      );
      return { org, userId: person.userId, demotedOwnerIds, auditEventId };
    });

    await this.notifier.send(
      input.email,
      compose({
        subject: `You were added to ${outcome.org.legalName} on Injishi`,
        heading: `You were added to ${outcome.org.legalName}`,
        greeting: greeting({ name: input.name ?? null }),
        paragraphs: [
          `Injishi added you to ${outcome.org.legalName} as ${ORG_ROLE_LABEL[input.orgRole]}.`,
          'Sign in with this email address: we email you a code each time, there is no password.',
        ],
        cta: { label: 'Open Injishi', href: `${this.notifier.appUrl}/sign-in` },
      }),
      'member added',
    );

    return AdminMemberChange.parse({
      orgId,
      userId: outcome.userId,
      orgRole: input.orgRole,
      status: 'active',
      demotedOwnerIds: outcome.demotedOwnerIds,
      auditEventId: outcome.auditEventId,
    });
  }

  /**
   * Change a member's role. The only owner cannot be made anything else: the
   * business would be left with nobody who may run it. Making someone the owner
   * makes the current owner a manager.
   */
  async changeMemberRole(
    orgId: string,
    userId: string,
    input: AdminChangeMemberRoleRequest,
    actorUserId: string,
  ): Promise<AdminMemberChange> {
    return this.db.transaction(async (tx) => {
      await this.requireOrg(tx, orgId);
      const member = await this.requireMember(tx, orgId, userId);
      if (member.orgRole === input.orgRole) {
        throw new ConflictException({ code: 'unchanged', message: 'This person already has that role.' });
      }
      if (member.orgRole === 'owner') await this.refuseIfOnlyOwner(tx, orgId, userId, 'make the only owner anything else');

      const demotedOwnerIds = input.orgRole === 'owner' ? await this.demoteOwners(tx, orgId, userId) : [];
      await tx
        .update(orgMemberships)
        .set({ orgRole: input.orgRole, updatedAt: new Date() })
        .where(eq(orgMemberships.id, member.id));

      const auditEventId = await this.audit(
        tx,
        actorUserId,
        'org',
        orgId,
        'admin.org.member_role_changed',
        { userId, orgRole: { from: member.orgRole, to: input.orgRole }, demotedOwnerIds },
        input.reason,
      );
      return AdminMemberChange.parse({ orgId, userId, orgRole: input.orgRole, status: 'active', demotedOwnerIds, auditEventId });
    });
  }

  /** Take a person out of a business. The only owner cannot be removed. */
  async removeMember(orgId: string, userId: string, reason: string, actorUserId: string): Promise<AdminMemberChange> {
    return this.db.transaction(async (tx) => {
      await this.requireOrg(tx, orgId);
      const member = await this.requireMember(tx, orgId, userId);
      if (member.orgRole === 'owner') await this.refuseIfOnlyOwner(tx, orgId, userId, 'remove the only owner');
      const now = new Date();
      await tx
        .update(orgMemberships)
        .set({ status: 'removed', removedAt: now, updatedAt: now })
        .where(eq(orgMemberships.id, member.id));
      const auditEventId = await this.audit(
        tx,
        actorUserId,
        'org',
        orgId,
        'admin.org.member_removed',
        { userId, orgRole: member.orgRole },
        reason,
      );
      return AdminMemberChange.parse({ orgId, userId, orgRole: null, status: 'removed', demotedOwnerIds: [], auditEventId });
    });
  }

  // --- Helpers -----------------------------------------------------------------------------

  private async findOrCreate(tx: Tx, rawEmail: string, name: string | null): Promise<{ userId: string; created: boolean }> {
    const email = rawEmail.trim().toLowerCase();
    const [found] = await tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (found) {
      if (!found.name?.trim() && name) await tx.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, found.id));
      return { userId: found.id, created: false };
    }
    const [created] = await tx.insert(users).values({ email, emailVerified: false, name }).returning({ id: users.id });
    if (!created) throw new Error('User insert returned no row.');
    return { userId: created.id, created: true };
  }

  /** Every other active owner becomes a manager; their ids are returned for the audit row. */
  private async demoteOwners(tx: Tx, orgId: string, newOwnerId: string): Promise<string[]> {
    const demoted = await tx
      .update(orgMemberships)
      .set({ orgRole: 'manager', updatedAt: new Date() })
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.orgRole, 'owner'),
          eq(orgMemberships.status, 'active'),
          ne(orgMemberships.userId, newOwnerId),
        ),
      )
      .returning({ userId: orgMemberships.userId });
    return demoted.map((d) => d.userId);
  }

  private async refuseIfOnlyOwner(tx: Tx, orgId: string, userId: string, what: string): Promise<void> {
    const [others] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.orgRole, 'owner'),
          eq(orgMemberships.status, 'active'),
          ne(orgMemberships.userId, userId),
        ),
      );
    if ((others?.n ?? 0) === 0) {
      throw new ConflictException({
        code: 'only_owner',
        message: `You cannot ${what}. Make someone else the owner first.`,
      });
    }
  }

  private async requireUser(tx: Tx, userId: string): Promise<void> {
    const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!row) throw new NotFoundException('No user has that id.');
  }

  private async requireOrg(tx: Tx, orgId: string): Promise<{ legalName: string }> {
    const [row] = await tx.select({ legalName: orgs.legalName }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!row) throw new NotFoundException('No business has that id.');
    return row;
  }

  private async requireMember(tx: Tx, orgId: string, userId: string) {
    const [row] = await tx
      .select({ id: orgMemberships.id, orgRole: orgMemberships.orgRole })
      .from(orgMemberships)
      .where(
        and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId), eq(orgMemberships.status, 'active')),
      )
      .limit(1);
    if (!row) throw new NotFoundException('This person is not a member of that business.');
    return row;
  }

  private async audit(
    tx: Tx,
    actorUserId: string,
    subjectType: 'user' | 'org',
    subjectId: string,
    eventType: string,
    payloadDiff: Record<string, unknown>,
    reason: string,
  ): Promise<string> {
    const [row] = await tx
      .insert(auditEvents)
      .values({ actorUserId, subjectType, subjectId, eventType, payloadDiff: payloadDiff as never, reason })
      .returning({ id: auditEvents.id });
    if (!row) throw new Error('Audit insert returned no row.');
    return row.id;
  }
}
