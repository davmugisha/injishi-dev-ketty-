import {
  AdminClaimCodeReissued,
  AdminSessionsRevoked,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import {
  auditEvents,
  guestStays,
  properties,
  rooms,
  sessions,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
/*
 * §6.8 moved these three into the operations domain. Check in now mints the
 * FIRST code at the counter, so this console is no longer the only caller, and
 * two copies of a bearer-credential generator is two places for one of them to
 * quietly become `Math.random`.
 */
import {
  CLAIM_CODE_RETRIES,
  isClaimCodeCollision,
  mintClaimCode,
} from '../../../modules/pms/domain/stay-claim';

/**
 * The two Users-section writes: end every session a person holds, and give an
 * unclaimed walk-in stay a new claim code.
 *
 * Kept apart from `AdminUsersService`, which is the PII reader, so the audit
 * obligation for this area sits in one short file: each successful write here
 * commits exactly one `audit_events` row in the same transaction as the change,
 * carrying the staffer, the subject, the event and the reason they wrote.
 */
@Injectable()
export class AdminUserActionsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * End every session this person holds, and record it, in ONE transaction.
   *
   * DELETED, NOT EXPIRED. `SessionGuard` resolves a cookie by looking its token
   * up in `sessions`; Better Auth is configured with no cookie cache and no
   * secondary store, so a row that is gone is a cookie that stops working on
   * its very next request. Setting `expires_at` would do the same and leave a
   * row behind that looks alive to anyone reading the table. The step-up
   * challenges hanging off those sessions go with them (`ON DELETE CASCADE`).
   *
   * REFUSED FOR YOUR OWN ACCOUNT (409). A staffer who signs themselves out in
   * the middle of acting on an incident has created a support call and ended
   * the investigation; ending your own sessions is what sign-out is for.
   *
   * Zero sessions is a success, not a refusal: it is idempotent, and a staffer
   * locking out a compromised account has done their job whether or not the
   * attacker was signed in at that moment. The audit row records that they did.
   */
  async revokeSessions(
    userId: string,
    actorUserId: string,
    reason: string,
  ): Promise<AdminSessionsRevoked> {
    if (userId === actorUserId) {
      throw new ConflictException({
        code: 'self_revocation',
        message:
          'You cannot end your own sessions from the console. Sign out instead — this route is for somebody else’s account.',
      });
    }

    return this.db.transaction(async (tx) => {
      const [person] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!person) throw new NotFoundException('No user has that id.');

      const revoked = await tx
        .delete(sessions)
        .where(eq(sessions.userId, userId))
        .returning({ id: sessions.id });

      const [audit] = await tx
        .insert(auditEvents)
        .values({
          actorUserId,
          subjectType: 'user',
          subjectId: userId,
          eventType: 'admin.user.sessions_revoked',
          // The count, never the tokens. A session token is a credential, and
          // an audit log that stored them would be a log of live keys.
          payloadDiff: { sessions: { revoked: revoked.length } } as never,
          reason,
        })
        .returning({ id: auditEvents.id });

      return AdminSessionsRevoked.parse({
        userId,
        revokedCount: revoked.length,
        auditEventId: audit?.id,
      });
    });
  }

  /**
   * Replace an unclaimed stay's claim code, and record it, in ONE transaction.
   *
   * Replacing is the point: the old code stops working the moment the new one
   * is written, because `claim_code` holds one value. A guest who lost the slip,
   * or a slip that was photographed by the wrong person, is fixed by this.
   *
   * REFUSED FOR A CLAIMED STAY (409). Once a stay belongs to somebody, a new
   * code would be a second key to a door that is already somebody's, and
   * redeeming it would move their stay — identity and all — to whoever held it.
   *
   * THE AUDIT ROW NAMES NO CODE. It records that a code was replaced and whether
   * there was one before; the code itself goes back to the staffer and nowhere
   * else, because everybody who may read the audit log would otherwise hold it.
   *
   * THE AUDIT SUBJECT TYPE IS NULL, AND THAT IS A GAP, NOT A CHOICE.
   * `audit_subject_type` has no value for a guest stay and adding one is a
   * migration. The stay's id goes in `subject_id` and the payload names it
   * `guest_stay`; a walk-in has no booking and often no account, so borrowing
   * `booking` or `user` would file the row against something it is not about.
   */
  async reissueClaimCode(
    stayId: string,
    actorUserId: string,
    reason: string,
  ): Promise<AdminClaimCodeReissued> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.reissueOnce(stayId, actorUserId, reason, mintClaimCode());
      } catch (err) {
        // A collision says nothing about the request, so it — and only it — is
        // retried with a fresh draw. It aborted its whole transaction, so the
        // failed attempt left neither a code nor an audit row behind.
        if (!isClaimCodeCollision(err) || attempt >= CLAIM_CODE_RETRIES) throw err;
      }
    }
  }

  private async reissueOnce(
    stayId: string,
    actorUserId: string,
    reason: string,
    claimCode: string,
  ): Promise<AdminClaimCodeReissued> {
    return this.db.transaction(async (tx) => {
      // Locked, so a guest redeeming the old code at this instant either lands
      // before this (and the stay is claimed: 409) or after (and the old code
      // no longer exists). Never both.
      const [stay] = await tx
        .select({
          claimStatus: guestStays.claimStatus,
          claimCode: guestStays.claimCode,
          roomId: guestStays.roomId,
        })
        .from(guestStays)
        .where(eq(guestStays.id, stayId))
        .limit(1)
        .for('update');
      if (!stay) throw new NotFoundException('No stay has that id.');
      if (stay.claimStatus !== 'unclaimed') {
        throw new ConflictException({
          code: 'illegal_transition',
          current: stay.claimStatus,
          message:
            'This stay has already been claimed. A new code would be a second key to somebody else’s record.',
        });
      }

      await tx
        .update(guestStays)
        .set({ claimCode, updatedAt: new Date() })
        .where(
          and(eq(guestStays.id, stayId), eq(guestStays.claimStatus, 'unclaimed')),
        );

      // The district of the building, for district reporting, as every other
      // audit writer copies one on. Null when the property has none yet.
      const [where] = await tx
        .select({ districtId: properties.districtId })
        .from(rooms)
        .innerJoin(properties, eq(properties.id, rooms.propertyId))
        .where(eq(rooms.id, stay.roomId))
        .limit(1);

      const [audit] = await tx
        .insert(auditEvents)
        .values({
          actorUserId,
          // `guest_stay` exists as a subject since migration 0029. Before it,
          // this row carried a NULL subject type with the stay id in
          // `subject_id` — findable by nobody who queried by subject, which is
          // how an audit trail is read.
          subjectType: 'guest_stay',
          subjectId: stayId,
          eventType: 'admin.stay.claim_code_reissued',
          payloadDiff: {
            claimCode: {
              from: stay.claimCode === null ? 'none' : 'replaced',
              to: 'issued',
            },
          } as never,
          reason,
          districtId: where?.districtId ?? null,
        })
        .returning({ id: auditEvents.id });

      return AdminClaimCodeReissued.parse({
        stayId,
        claimCode,
        auditEventId: audit?.id,
      });
    });
  }
}
