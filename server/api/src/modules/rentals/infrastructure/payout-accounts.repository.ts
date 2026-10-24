import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';

import { payoutAccounts } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx, Tx } from './rentals-writers';

export type PayoutAccountRow = typeof payoutAccounts.$inferSelect;

/** What a write stores: one kind's fields, the others null, the number already sealed. */
export interface PayoutAccountStored {
  kind: PayoutAccountRow['kind'];
  accountName: string;
  bankName: string | null;
  accountNumberCiphertext: string | null;
  accountLast4: string | null;
  momoNetwork: PayoutAccountRow['momoNetwork'];
  momoPhone: string | null;
  merchantCode: string | null;
}

/**
 * Where a business's rent is paid out (ported from feat/rentals'
 * `payout-accounts.repository.ts`). One active primary per org is held by a
 * partial unique index, so every change of primary clears the old one in the
 * same transaction, under a lock on the org's accounts.
 */
@Injectable()
export class PayoutAccountsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Active accounts, the primary on top, then the newest. Retired ones are not listed. */
  async list(orgId: string, db: DbOrTx = this.db): Promise<PayoutAccountRow[]> {
    return db
      .select()
      .from(payoutAccounts)
      .where(and(eq(payoutAccounts.orgId, orgId), eq(payoutAccounts.status, 'active')))
      .orderBy(desc(payoutAccounts.isPrimary), desc(payoutAccounts.createdAt));
  }

  async find(id: string, db: DbOrTx = this.db): Promise<PayoutAccountRow | null> {
    const [row] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.id, id)).limit(1);
    return row ?? null;
  }

  /** Lock the org's active accounts for the rest of the transaction. */
  async lockOrg(tx: Tx, orgId: string): Promise<PayoutAccountRow[]> {
    return tx
      .select()
      .from(payoutAccounts)
      .where(and(eq(payoutAccounts.orgId, orgId), eq(payoutAccounts.status, 'active')))
      .for('update');
  }

  async insert(
    tx: DbOrTx,
    values: PayoutAccountStored & { id: string; orgId: string; workspaceId: string; createdByUserId: string; isPrimary: boolean },
  ): Promise<void> {
    await tx.insert(payoutAccounts).values({ ...values, status: 'active' });
  }

  async update(tx: DbOrTx, id: string, values: PayoutAccountStored): Promise<void> {
    await tx
      .update(payoutAccounts)
      .set({ ...values, verifiedName: null, updatedAt: new Date() })
      .where(and(eq(payoutAccounts.id, id), eq(payoutAccounts.status, 'active')));
  }

  /** The org has no primary account until the caller names one. */
  async clearPrimary(tx: DbOrTx, orgId: string): Promise<void> {
    await tx
      .update(payoutAccounts)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(payoutAccounts.orgId, orgId), eq(payoutAccounts.isPrimary, true)));
  }

  /** Make `id` the org's one primary account. */
  async makePrimary(tx: DbOrTx, orgId: string, id: string): Promise<void> {
    const now = new Date();
    await tx
      .update(payoutAccounts)
      .set({ isPrimary: false, updatedAt: now })
      .where(and(eq(payoutAccounts.orgId, orgId), eq(payoutAccounts.isPrimary, true), ne(payoutAccounts.id, id)));
    await tx
      .update(payoutAccounts)
      .set({ isPrimary: true, updatedAt: now })
      .where(and(eq(payoutAccounts.id, id), eq(payoutAccounts.status, 'active')));
  }

  async retire(tx: DbOrTx, id: string, userId: string): Promise<void> {
    const now = new Date();
    await tx
      .update(payoutAccounts)
      .set({ status: 'retired', isPrimary: false, retiredAt: now, retiredByUserId: userId, updatedAt: now })
      .where(and(eq(payoutAccounts.id, id), eq(payoutAccounts.status, 'active')));
  }
}
