import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { brokers, workspaces } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** This national ID already registered as a broker (F-R09 §9). */
export class DuplicateBrokerError extends Error {
  constructor() {
    super('An account with this national ID is already registered as a broker.');
  }
}

export interface CreateBrokerRow {
  userId: string;
  nationalId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  /** The district the free plan shows (2026-10-25). */
  homeDistrictId: number;
  /** The paid registration fee this registration uses; tied to the broker in the same transaction. */
  feePaymentId: string;
}

/** The registration fee named is not this person's paid, unused one. */
export class FeeNotPaidError extends Error {
  constructor(readonly waiting: boolean) {
    super(waiting ? 'Your payment is still waiting. Approve the prompt on your phone, then try again.' : 'Pay the registration fee first.');
  }
}

export interface CreatedBroker {
  brokerId: string;
  workspaceId: string;
  name: string | null;
}

/**
 * The broker write path (F-R09, ADR-026 assumption 2).
 *
 * Separate from `OrganizationRepository` because a broker is separate from an
 * org in every way that matters: no `orgs` row, no domain, no TIN or UPI, no
 * registration status, no invoice, and none of the two government gates. The
 * only thing the two paths share is that both end in a workspace, and that is
 * not enough to share a repository.
 *
 * There is no fee here. `registration_fees` still carries a `broker` row and it
 * is deliberately unread: `subscription_invoices.org_id` is NOT NULL, so a
 * broker fee invoice cannot be written without a migration on a money table,
 * and ADR-026 records that as an assumption rather than running that migration
 * under an undeliberated decision.
 */
@Injectable()
export class BrokerRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The broker row this user already holds, if any. */
  async findByUser(userId: string): Promise<CreatedBroker | null> {
    const [row] = await this.db
      .select({ id: brokers.id, name: brokers.name })
      .from(brokers)
      .where(eq(brokers.userId, userId))
      .limit(1);
    if (!row) return null;

    // Keyed by the USER, not the broker: `workspaces_kind_shape` gives a
    // broker workspace a `user_id` and forbids it an `org_id`, and
    // `workspaces_broker_user_uk` makes it one per person.
    const [ws] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.userId, userId), eq(workspaces.kind, 'broker')))
      .limit(1);
    if (!ws) return null;

    return { brokerId: row.id, workspaceId: ws.id, name: row.name };
  }

  /**
   * Create the broker and its workspace, in one transaction.
   *
   * A broker with no workspace has nowhere to work from, and a broker
   * workspace with no broker is a row pointing at nothing — so the pair is one
   * act, the same reasoning `createRegistration` runs on.
   */
  async districtExists(districtId: number): Promise<boolean> {
    return districtExists(this.db, districtId);
  }

  async create(input: CreateBrokerRow): Promise<CreatedBroker> {
    // Checked before the transaction so the clash is reported as its own
    // sentence. `brokers_national_id_uk` still enforces it; this only decides
    // which message a person reads.
    const [clash] = await this.db
      .select({ id: brokers.id })
      .from(brokers)
      .where(eq(brokers.nationalId, input.nationalId))
      .limit(1);
    if (clash) throw new DuplicateBrokerError();

    return this.db.transaction(async (tx) => {
      const [broker] = await tx
        .insert(brokers)
        .values({
          userId: input.userId,
          nationalId: input.nationalId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          homeDistrictId: input.homeDistrictId,
          // `active` takes its default. A broker passes no government gate, so
          // there is no stage to hold them at (ADR-026 assumption 2).
        })
        .returning({ id: brokers.id, name: brokers.name });
      if (!broker) throw new Error('Broker insert returned no row.');

      const claimed = await tx.execute<{ id: string }>(sql`
        update broker_registration_payments set broker_id = ${broker.id}, updated_at = now()
         where id = ${input.feePaymentId} and user_id = ${input.userId} and status = 'paid' and broker_id is null
        returning id
      `);
      if (claimed.rows.length === 0) {
        const waiting = await tx.execute(sql`
          select 1 from broker_registration_payments where id = ${input.feePaymentId} and user_id = ${input.userId} and status = 'pending'
        `);
        throw new FeeNotPaidError(waiting.rows.length > 0);
      }

      const [workspace] = await tx
        .insert(workspaces)
        .values({ kind: 'broker', userId: input.userId })
        .returning({ id: workspaces.id });
      if (!workspace) throw new Error('Workspace insert returned no row.');

      return {
        brokerId: broker.id,
        workspaceId: workspace.id,
        name: broker.name,
      };
    });
  }
}

/** Whether a district id names a district. */
export async function districtExists(db: Database, districtId: number): Promise<boolean> {
  const result = await db.execute(sql`select 1 from districts where id = ${districtId}`);
  return result.rows.length > 0;
}
