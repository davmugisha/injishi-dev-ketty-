import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import {
  identityDocuments,
  paymentAttempts,
  recordAccessLogs,
  userProfiles,
  verifiedIdentities,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * Who a refund pays (073-gtbank-payments AC-12): the person who paid the
 * collection, named as their verified identity names them.
 *
 * The payer is found through the attempt that waited on the collection (the
 * attempt's key IS the collection's key). Their name and ID come only from a
 * VERIFIED identity; a missing or unverified one answers null, and the refund
 * waits for the payer to supply them. Every read of an ID number writes a
 * `record_access_logs` row, the rule the identity tables carry; the payer is
 * both actor and subject, because the system reads it on their behalf to pay
 * them back.
 */
@Injectable()
export class PayeeIdentityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The payer and the booking a collection paid for, through its attempt. */
  async payerOf(collection: {
    id: string;
    idempotencyKey: string;
  }): Promise<{ userId: string | null; bookingId: string | null }> {
    const [row] = await this.db
      .select({ userId: paymentAttempts.guestUserId, bookingId: paymentAttempts.bookingId })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.idempotencyKey, collection.idempotencyKey))
      .limit(1);
    return { userId: row?.userId ?? null, bookingId: row?.bookingId ?? null };
  }

  /**
   * The payer's verified name, ID and phone, or null when they have no
   * verified identity with a primary active document.
   */
  async verifiedPayee(
    userId: string,
    reference: string,
  ): Promise<{ fullName: string; idType: 'national_id' | 'passport'; idNumber: string; phone: string | null } | null> {
    const [row] = await this.db
      .select({
        fullName: verifiedIdentities.legalFullName,
        kycStatus: verifiedIdentities.kycStatus,
        idType: identityDocuments.documentType,
        idNumber: identityDocuments.documentNumber,
        phone: userProfiles.phoneE164,
      })
      .from(verifiedIdentities)
      .innerJoin(
        identityDocuments,
        and(
          eq(identityDocuments.identityId, verifiedIdentities.userId),
          eq(identityDocuments.isPrimary, true),
          eq(identityDocuments.status, 'active'),
        ),
      )
      .leftJoin(userProfiles, eq(userProfiles.userId, verifiedIdentities.userId))
      .where(eq(verifiedIdentities.userId, userId))
      .limit(1);
    if (!row || row.kycStatus !== 'verified' || !row.fullName) return null;
    if (row.idType !== 'national_id' && row.idType !== 'passport') return null;

    await this.db.insert(recordAccessLogs).values({
      actorUserId: userId,
      subjectUserId: userId,
      subjectRef: null,
      dataClass: 'national_id',
      reason: `payments: payee details for refund ${reference}`,
    });
    return { fullName: row.fullName, idType: row.idType, idNumber: row.idNumber, phone: row.phone ?? null };
  }

  /** Whether the user holds a verified identity at all, without reading the ID. */
  async hasVerifiedIdentity(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ userId: verifiedIdentities.userId })
      .from(verifiedIdentities)
      .where(and(eq(verifiedIdentities.userId, userId), eq(verifiedIdentities.kycStatus, 'verified')))
      .limit(1);
    return row !== undefined;
  }
}
