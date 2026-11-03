import {
  AdminActivityResponse,
  AdminInvitationResent,
  AdminSessionEnded,
  AdminSignInsResponse,
  AdminSuspensionChange,
  type StaffAccess,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { aliasedTable, and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';

import {
  adminUsers,
  auditEvents,
  sessions,
  signInEvents,
  userSuspensions,
  users,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { AdminAccountsService } from './admin-accounts.service';
import { RecordAccessService } from './record-access.service';
import { audit } from './staff-roles.service';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const HISTORY_LIMIT = 50;
const ACTIVITY_LIMIT = 100;

/**
 * What stands between a person and signing in (2026-11-02): suspension, the
 * invitation, their sessions, and the record of what was done about them.
 *
 * Suspending ends every session in the same transaction and Better Auth asks
 * `AccountGate.maySignIn` before making a new one, so a suspended person is
 * out at once and stays out. A staff member is suspended only by a super
 * admin, and nobody suspends themselves.
 */
@Injectable()
export class AccountAccessService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly accounts: AdminAccountsService,
    private readonly access: RecordAccessService,
  ) {}

  async suspend(userId: string, reason: string, actor: { userId: string; access: StaffAccess }): Promise<AdminSuspensionChange> {
    if (userId === actor.userId) {
      throw new ConflictException({ code: 'self_suspend', message: 'You cannot suspend your own account.' });
    }
    return this.db.transaction(async (tx) => {
      await requireUser(tx, userId);
      await this.refuseStaffUnlessSuperAdmin(tx, userId, actor.access, 'suspend');
      const [live] = await tx
        .select({ id: userSuspensions.id })
        .from(userSuspensions)
        .where(and(eq(userSuspensions.userId, userId), isNull(userSuspensions.liftedAt)))
        .limit(1);
      if (live) throw new ConflictException({ code: 'already_suspended', message: 'This account is already suspended.' });
      await tx.insert(userSuspensions).values({ userId, suspendedByUserId: actor.userId, reason });
      const ended = await tx.delete(sessions).where(eq(sessions.userId, userId)).returning({ id: sessions.id });
      const auditEventId = await audit(tx, actor.userId, 'user', userId, 'admin.user.suspended', { endedSessions: ended.length }, reason);
      return AdminSuspensionChange.parse({ userId, status: 'suspended', endedSessions: ended.length, auditEventId });
    });
  }

  async reactivate(userId: string, reason: string, actor: { userId: string; access: StaffAccess }): Promise<AdminSuspensionChange> {
    return this.db.transaction(async (tx) => {
      const person = await requireUser(tx, userId);
      await this.refuseStaffUnlessSuperAdmin(tx, userId, actor.access, 'reactivate');
      const now = new Date();
      const [lifted] = await tx
        .update(userSuspensions)
        .set({ liftedAt: now, liftedByUserId: actor.userId, liftReason: reason })
        .where(and(eq(userSuspensions.userId, userId), isNull(userSuspensions.liftedAt)))
        .returning({ id: userSuspensions.id });
      if (!lifted) throw new ConflictException({ code: 'not_suspended', message: 'This account is not suspended.' });
      const auditEventId = await audit(tx, actor.userId, 'user', userId, 'admin.user.reactivated', {}, reason);
      return AdminSuspensionChange.parse({
        userId,
        status: person.emailVerified ? 'active' : 'invited',
        endedSessions: 0,
        auditEventId,
      });
    });
  }

  /** Mail the invitation again, while they have never signed in. */
  async resendInvitation(userId: string, reason: string, actorUserId: string): Promise<AdminInvitationResent> {
    const { person, auditEventId } = await this.db.transaction(async (tx) => {
      const person = await requireUser(tx, userId);
      if (person.emailVerified) {
        throw new ConflictException({
          code: 'already_signed_in',
          message: 'They have signed in already. They can sign in any time with a code sent to their email.',
        });
      }
      const [suspended] = await tx
        .select({ id: userSuspensions.id })
        .from(userSuspensions)
        .where(and(eq(userSuspensions.userId, userId), isNull(userSuspensions.liftedAt)))
        .limit(1);
      if (suspended) throw new ConflictException({ code: 'suspended', message: 'This account is suspended. Reactivate it first.' });
      const auditEventId = await audit(tx, actorUserId, 'user', userId, 'admin.user.invitation_resent', {}, reason);
      return { person, auditEventId };
    });
    await this.accounts.sendInvitation(person.email, person.name);
    return AdminInvitationResent.parse({ userId, auditEventId });
  }

  /** Recent sign ins and the devices signed in now. IP addresses are contact data, so the read is logged. */
  async signIns(userId: string, actorUserId: string, reason: string): Promise<AdminSignInsResponse> {
    await requireUser(this.db, userId);
    await this.access.recordRead({ actorUserId, subjectUserIds: [userId], dataClass: 'contact', reason });
    const [history, devices] = await Promise.all([
      this.db
        .select()
        .from(signInEvents)
        .where(eq(signInEvents.userId, userId))
        .orderBy(desc(signInEvents.occurredAt))
        .limit(HISTORY_LIMIT),
      this.db
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
        .orderBy(desc(sessions.updatedAt)),
    ]);
    return AdminSignInsResponse.parse({
      signIns: history.map((h) => ({
        occurredAt: h.occurredAt.toISOString(),
        method: h.method,
        ipAddress: h.ipAddress,
        userAgent: h.userAgent,
      })),
      devices: devices.map((d) => ({
        sessionId: d.id,
        signedInAt: d.createdAt.toISOString(),
        lastActiveAt: d.updatedAt.toISOString(),
        expiresAt: d.expiresAt.toISOString(),
        ipAddress: d.ipAddress,
        userAgent: d.userAgent,
      })),
    });
  }

  /** Sign one device out. */
  async endSession(userId: string, sessionId: string, reason: string, actorUserId: string): Promise<AdminSessionEnded> {
    return this.db.transaction(async (tx) => {
      const [ended] = await tx
        .delete(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
        .returning({ id: sessions.id });
      if (!ended) throw new NotFoundException('That device is not signed in.');
      const auditEventId = await audit(tx, actorUserId, 'user', userId, 'admin.user.session_ended', { sessionId }, reason);
      return AdminSessionEnded.parse({ userId, sessionId, auditEventId });
    });
  }

  /**
   * The audit trail about this person and by them: rows filed against them,
   * rows about a business that name them (`payload_diff.userId`), and what
   * they did themselves. Newest first.
   */
  async activity(userId: string): Promise<AdminActivityResponse> {
    await requireUser(this.db, userId);
    const actors = aliasedTable(users, 'actors');
    const rows = await this.db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        eventType: auditEvents.eventType,
        actorUserId: auditEvents.actorUserId,
        actorName: sql<string | null>`coalesce(nullif(btrim(${actors.name}), ''), ${actors.email})`,
        reason: auditEvents.reason,
      })
      .from(auditEvents)
      .leftJoin(actors, eq(actors.id, auditEvents.actorUserId))
      .where(
        or(
          and(eq(auditEvents.subjectType, 'user'), eq(auditEvents.subjectId, userId)),
          sql`${auditEvents.payloadDiff}->>'userId' = ${userId}`,
          eq(auditEvents.actorUserId, userId),
        ),
      )
      .orderBy(desc(auditEvents.occurredAt))
      .limit(ACTIVITY_LIMIT);
    return AdminActivityResponse.parse({
      items: rows.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        eventType: r.eventType,
        direction: r.actorUserId === userId ? 'by' : 'about',
        actorName: r.actorName,
        reason: r.reason,
      })),
    });
  }

  /** A live staff account is suspended or reactivated by a super admin only. */
  private async refuseStaffUnlessSuperAdmin(tx: Tx, userId: string, access: StaffAccess, what: string): Promise<void> {
    if (access.roles.includes('super_admin')) return;
    const [staff] = await tx
      .select({ userId: adminUsers.userId })
      .from(adminUsers)
      .where(and(eq(adminUsers.userId, userId), isNull(adminUsers.revokedAt)))
      .limit(1);
    if (staff) {
      throw new ForbiddenException({
        code: 'staff_target',
        message: `Only a super admin can ${what} a staff member.`,
      });
    }
  }
}

async function requireUser(
  db: Database | Tx,
  userId: string,
): Promise<{ email: string; name: string | null; emailVerified: boolean }> {
  const [row] = await db
    .select({ email: users.email, name: users.name, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new NotFoundException('No user has that id.');
  return row;
}
