import { Inject, Injectable } from '@nestjs/common';
import type { LeaseSignerRole } from '@injishi/contracts';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';

import {
  accounts,
  leaseInvitations,
  leaseSignatures,
  leaseSigningCodes,
  leases,
  orgs,
  properties,
  rentalUnits,
  tenants,
  users,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

export type SigningCodeRow = typeof leaseSigningCodes.$inferSelect;
export type InvitationRow = typeof leaseInvitations.$inferSelect;
export type SignatureInsert = typeof leaseSignatures.$inferInsert;

/** An invitation waiting for an email, with what its list row shows. */
export interface OpenInvitationRow {
  invitationId: string;
  leaseId: string;
  landlordName: string;
  propertyName: string;
  unitLabel: string;
  monthlyRentRwf: number;
  startDate: string;
  endDate: string;
  sentAt: Date;
  expiresAt: Date;
}

/**
 * What signing writes (WP 1.5b): the emailed codes, the signatures, the
 * invitation, and the link from a tenant record to the account that accepted
 * it. Each write takes the caller's transaction; the caller holds the lease
 * row locked.
 */
@Injectable()
export class SigningRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Signing codes -----------------------------------------------------------------

  /** The code still live for this signer on this lease, if any. */
  async liveCode(leaseId: string, role: LeaseSignerRole, userId: string, db: DbOrTx = this.db): Promise<SigningCodeRow | null> {
    const [row] = await db
      .select()
      .from(leaseSigningCodes)
      .where(
        and(
          eq(leaseSigningCodes.leaseId, leaseId),
          eq(leaseSigningCodes.signerRole, role),
          eq(leaseSigningCodes.userId, userId),
          isNull(leaseSigningCodes.consumedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Replace this signer's live code with a new one (one live code per signer per lease). */
  async replaceCode(
    tx: DbOrTx,
    values: Pick<SigningCodeRow, 'leaseId' | 'versionId' | 'signerRole' | 'userId' | 'email' | 'codeHash' | 'expiresAt'>,
  ): Promise<string> {
    await tx
      .delete(leaseSigningCodes)
      .where(
        and(
          eq(leaseSigningCodes.leaseId, values.leaseId),
          eq(leaseSigningCodes.signerRole, values.signerRole),
          eq(leaseSigningCodes.userId, values.userId),
          isNull(leaseSigningCodes.consumedAt),
        ),
      );
    const [row] = await tx.insert(leaseSigningCodes).values(values).returning({ id: leaseSigningCodes.id });
    if (!row) throw new Error('signing code insert returned nothing');
    return row.id;
  }

  /** Drop a code that could not be mailed, so the signer can ask again at once. */
  async deleteCode(id: string): Promise<void> {
    await this.db.delete(leaseSigningCodes).where(and(eq(leaseSigningCodes.id, id), isNull(leaseSigningCodes.consumedAt)));
  }

  /** Count one wrong try, on its own (it must stand though the signing fails). Answers the tries made. */
  async countWrongTry(id: string): Promise<number> {
    const [row] = await this.db
      .update(leaseSigningCodes)
      .set({ attempts: sql`least(${leaseSigningCodes.attempts} + 1, 5)` })
      .where(eq(leaseSigningCodes.id, id))
      .returning({ attempts: leaseSigningCodes.attempts });
    return row?.attempts ?? 5;
  }

  /** Use a code up. False when another request used it first. */
  async consumeCode(tx: DbOrTx, id: string): Promise<boolean> {
    const rows = await tx
      .update(leaseSigningCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(leaseSigningCodes.id, id), isNull(leaseSigningCodes.consumedAt)))
      .returning({ id: leaseSigningCodes.id });
    return rows.length > 0;
  }

  /** Use up every live code on a lease (it was cancelled). Answers how many. */
  async consumeLiveCodes(tx: DbOrTx, leaseId: string): Promise<number> {
    const rows = await tx
      .update(leaseSigningCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(leaseSigningCodes.leaseId, leaseId), isNull(leaseSigningCodes.consumedAt)))
      .returning({ id: leaseSigningCodes.id });
    return rows.length;
  }

  // --- Accounts ---------------------------------------------------------------------

  /** An account's email, lower case: where a tenant who already has the lease on their account is written to. */
  async accountEmail(userId: string): Promise<string | null> {
    const [row] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    return row?.email?.toLowerCase() ?? null;
  }

  // --- Passwords -------------------------------------------------------------------

  /** The password hash Better Auth keeps for this account, when it has one. */
  async passwordHash(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ password: accounts.password })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
      .limit(1);
    return row?.password ?? null;
  }

  // --- Signatures --------------------------------------------------------------------

  async insertSignature(tx: DbOrTx, values: SignatureInsert): Promise<string> {
    const [row] = await tx.insert(leaseSignatures).values(values).returning({ id: leaseSignatures.id });
    if (!row) throw new Error('signature insert returned nothing');
    return row.id;
  }

  /** The signatures standing on one version. */
  async liveSignatures(versionId: string, db: DbOrTx = this.db): Promise<(typeof leaseSignatures.$inferSelect)[]> {
    return db
      .select()
      .from(leaseSignatures)
      .where(and(eq(leaseSignatures.versionId, versionId), isNull(leaseSignatures.voidedAt)))
      .orderBy(asc(leaseSignatures.signedAt));
  }

  /** Void every signature still standing on the lease, both sides. Answers their ids. */
  async voidLiveSignatures(tx: DbOrTx, leaseId: string, note: string): Promise<string[]> {
    const rows = await tx
      .update(leaseSignatures)
      .set({ voidedAt: new Date(), note })
      .where(and(eq(leaseSignatures.leaseId, leaseId), isNull(leaseSignatures.voidedAt)))
      .returning({ id: leaseSignatures.id });
    return rows.map((r) => r.id);
  }

  // --- The invitation ------------------------------------------------------------------

  /** The invitation still out on a lease (`sent`), if any. */
  async liveInvitation(leaseId: string, db: DbOrTx = this.db): Promise<InvitationRow | null> {
    const [row] = await db
      .select()
      .from(leaseInvitations)
      .where(and(eq(leaseInvitations.leaseId, leaseId), eq(leaseInvitations.status, 'sent')))
      .limit(1);
    return row ?? null;
  }

  async insertInvitation(tx: DbOrTx, values: typeof leaseInvitations.$inferInsert): Promise<string> {
    const [row] = await tx.insert(leaseInvitations).values(values).returning({ id: leaseInvitations.id });
    if (!row) throw new Error('invitation insert returned nothing');
    return row.id;
  }

  /** Send a live invitation again: a fresh token (the old link stops working), a fresh 14 days. */
  async refreshInvitation(tx: DbOrTx, id: string, values: { tokenHash: string; expiresAt: Date; email: string }): Promise<void> {
    const now = new Date();
    await tx
      .update(leaseInvitations)
      .set({
        tokenHash: values.tokenHash,
        email: values.email,
        expiresAt: values.expiresAt,
        lastSentAt: now,
        sendCount: sql`${leaseInvitations.sendCount} + 1`,
        updatedAt: now,
      })
      .where(eq(leaseInvitations.id, id));
  }

  /** Note one more email about an accepted invitation (a reminder to sign); the token is not used any more. */
  async touchInvitation(tx: DbOrTx, id: string): Promise<void> {
    const now = new Date();
    await tx
      .update(leaseInvitations)
      .set({ lastSentAt: now, sendCount: sql`${leaseInvitations.sendCount} + 1`, updatedAt: now })
      .where(eq(leaseInvitations.id, id));
  }

  /** Withdraw one invitation that is still out. */
  async revokeInvitation(tx: DbOrTx, id: string): Promise<void> {
    const now = new Date();
    await tx
      .update(leaseInvitations)
      .set({ status: 'revoked', revokedAt: now, updatedAt: now })
      .where(and(eq(leaseInvitations.id, id), eq(leaseInvitations.status, 'sent')));
  }

  /** Mark a lapsed invitation expired, so a fresh one can be sent in its place. */
  async expireInvitation(tx: DbOrTx, id: string): Promise<void> {
    await tx
      .update(leaseInvitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(eq(leaseInvitations.id, id), eq(leaseInvitations.status, 'sent')));
  }

  async invitationByTokenHash(tokenHash: string): Promise<InvitationRow | null> {
    const [row] = await this.db.select().from(leaseInvitations).where(eq(leaseInvitations.tokenHash, tokenHash)).limit(1);
    return row ?? null;
  }

  async invitationById(id: string): Promise<InvitationRow | null> {
    const [row] = await this.db.select().from(leaseInvitations).where(eq(leaseInvitations.id, id)).limit(1);
    return row ?? null;
  }

  async lockInvitation(tx: DbOrTx, id: string): Promise<InvitationRow | null> {
    const [row] = await tx.select().from(leaseInvitations).where(eq(leaseInvitations.id, id)).for('update').limit(1);
    return row ?? null;
  }

  async markAccepted(tx: DbOrTx, id: string, userId: string): Promise<void> {
    const now = new Date();
    await tx
      .update(leaseInvitations)
      .set({ status: 'accepted', acceptedAt: now, acceptedByUserId: userId, updatedAt: now })
      .where(eq(leaseInvitations.id, id));
  }

  /** The newest invitation on a lease, whatever its status. */
  async latestInvitation(leaseId: string, db: DbOrTx = this.db): Promise<InvitationRow | null> {
    const [row] = await db
      .select()
      .from(leaseInvitations)
      .where(eq(leaseInvitations.leaseId, leaseId))
      .orderBy(desc(leaseInvitations.lastSentAt))
      .limit(1);
    return row ?? null;
  }

  /** Leases sent to this email and waiting to be accepted, the newest first. */
  async openInvitationsFor(email: string, now: Date): Promise<OpenInvitationRow[]> {
    return this.db
      .select({
        invitationId: leaseInvitations.id,
        leaseId: leases.id,
        landlordName: orgs.legalName,
        propertyName: properties.name,
        unitLabel: rentalUnits.label,
        monthlyRentRwf: leases.monthlyRentRwf,
        startDate: leases.startDate,
        endDate: leases.endDate,
        sentAt: leaseInvitations.lastSentAt,
        expiresAt: leaseInvitations.expiresAt,
      })
      .from(leaseInvitations)
      .innerJoin(leases, eq(leases.id, leaseInvitations.leaseId))
      .innerJoin(orgs, eq(orgs.id, leases.orgId))
      .innerJoin(properties, eq(properties.id, leases.propertyId))
      .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
      .where(
        and(
          eq(leaseInvitations.email, email.trim().toLowerCase()),
          eq(leaseInvitations.status, 'sent'),
          gt(leaseInvitations.expiresAt, now),
          eq(leases.status, 'pending_signature'),
        ),
      )
      .orderBy(desc(leaseInvitations.lastSentAt));
  }

  // --- The tenant's account ----------------------------------------------------------------

  /**
   * Link a tenant record to the account that accepted its invitation. False
   * when the record is already linked to another account.
   */
  async linkTenant(tx: DbOrTx, tenantId: string, userId: string): Promise<boolean> {
    const rows = await tx
      .update(tenants)
      .set({ userId, updatedAt: new Date() })
      .where(and(eq(tenants.id, tenantId), or(isNull(tenants.userId), eq(tenants.userId, userId))))
      .returning({ id: tenants.id });
    return rows.length > 0;
  }
}
