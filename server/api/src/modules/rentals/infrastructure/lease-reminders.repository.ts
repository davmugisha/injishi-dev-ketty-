import { Inject, Injectable } from '@nestjs/common';
import type { LeaseReminderChannel, LeaseReminderKind } from '@injishi/contracts';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { leaseCharges, leaseReminders, leases, tenants, users } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

export type ReminderRow = typeof leaseReminders.$inferSelect;

/** An open charge of a live lease with what the reminder job needs to word it. */
export interface RemindableCharge {
  chargeId: string;
  kind: 'rent' | 'deposit';
  periodStart: string | null;
  dueOn: string;
  amountRwf: number;
  paidRwf: number;
  leaseId: string;
  workspaceId: string;
  propertyId: string;
  graceDays: number;
}

/**
 * Reminders about rent owed (blueprint 1.2; WP 1.6a): claiming one before it
 * is sent (the unique index on charge, kind and stage refuses a second), the
 * manual per day rule, and the reads.
 */
@Injectable()
export class LeaseRemindersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Open charges on active or ending leases, due at or before `dueBy`: what the job looks at. */
  async remindable(dueBy: string, db: DbOrTx = this.db): Promise<RemindableCharge[]> {
    return db
      .select({
        chargeId: leaseCharges.id,
        kind: leaseCharges.kind,
        periodStart: leaseCharges.periodStart,
        dueOn: leaseCharges.dueOn,
        amountRwf: leaseCharges.amountRwf,
        paidRwf: leaseCharges.paidRwf,
        leaseId: leases.id,
        workspaceId: leases.workspaceId,
        propertyId: leases.propertyId,
        graceDays: leases.graceDays,
      })
      .from(leaseCharges)
      .innerJoin(leases, eq(leases.id, leaseCharges.leaseId))
      .where(and(eq(leaseCharges.status, 'open'), inArray(leases.status, ['active', 'ending']), sql`${leaseCharges.dueOn} <= ${dueBy}::date`))
      .orderBy(leaseCharges.dueOn, leaseCharges.id);
  }

  /**
   * Claim an automatic reminder: the row is written first, and a second
   * worker or a second run finds it taken. Answers the id, or null when it
   * was already claimed.
   */
  async claim(
    db: DbOrTx,
    input: {
      workspaceId: string;
      propertyId: string;
      leaseId: string;
      chargeId: string;
      kind: Exclude<LeaseReminderKind, 'manual'>;
      stage: number;
      channel: LeaseReminderChannel;
      note: string;
    },
  ): Promise<string | null> {
    const [row] = await db
      .insert(leaseReminders)
      .values({ ...input, sentByUserId: null })
      .onConflictDoNothing()
      .returning({ id: leaseReminders.id });
    return row?.id ?? null;
  }

  /** A manual reminder, by a person. */
  async insertManual(
    db: DbOrTx,
    input: { workspaceId: string; propertyId: string; leaseId: string; chargeId: string; channel: LeaseReminderChannel; note: string; sentByUserId: string },
  ): Promise<string> {
    const [row] = await db
      .insert(leaseReminders)
      .values({ ...input, kind: 'manual', stage: 0 })
      .returning({ id: leaseReminders.id });
    if (!row) throw new Error('reminder insert returned nothing');
    return row.id;
  }

  /** Undo a claim whose email did not go, so the next run tries again. */
  async withdraw(db: DbOrTx, id: string): Promise<void> {
    await db.delete(leaseReminders).where(eq(leaseReminders.id, id));
  }

  /** How many manual reminders went out for the charge since `since`. */
  async manualCountSince(chargeId: string, since: Date, db: DbOrTx = this.db): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(leaseReminders)
      .where(and(eq(leaseReminders.chargeId, chargeId), eq(leaseReminders.kind, 'manual'), gte(leaseReminders.sentAt, since)));
    return Number(row?.n ?? 0);
  }

  /** The reminders of a workspace, newest first, by lease or by the month they were sent. */
  async list(
    input: { workspaceId: string; leaseId: string | null; month: string | null; propertyIds: readonly string[] | null },
    db: DbOrTx = this.db,
  ): Promise<
    (ReminderRow & {
      leaseReference: string;
      tenantName: string;
      chargeKind: 'rent' | 'deposit' | null;
      chargePeriodStart: string | null;
      chargeDueOn: string | null;
      sentByName: string | null;
    })[]
  > {
    const rows = await db
      .select({
        reminder: leaseReminders,
        leaseReference: leases.reference,
        tenantName: tenants.fullName,
        chargeKind: leaseCharges.kind,
        chargePeriodStart: leaseCharges.periodStart,
        chargeDueOn: leaseCharges.dueOn,
        sentByName: users.name,
      })
      .from(leaseReminders)
      .innerJoin(leases, eq(leases.id, leaseReminders.leaseId))
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .leftJoin(leaseCharges, eq(leaseCharges.id, leaseReminders.chargeId))
      .leftJoin(users, eq(users.id, leaseReminders.sentByUserId))
      .where(
        and(
          eq(leaseReminders.workspaceId, input.workspaceId),
          input.leaseId ? eq(leaseReminders.leaseId, input.leaseId) : undefined,
          input.month ? sql`to_char(${leaseReminders.sentAt} at time zone 'Africa/Kigali', 'YYYY-MM') = ${input.month}` : undefined,
          input.propertyIds === null ? undefined : input.propertyIds.length > 0 ? inArray(leaseReminders.propertyId, [...input.propertyIds]) : sql`false`,
        ),
      )
      .orderBy(desc(leaseReminders.sentAt), desc(leaseReminders.id))
      .limit(500);
    return rows.map((r) => ({ ...r.reminder, leaseReference: r.leaseReference, tenantName: r.tenantName, chargeKind: r.chargeKind, chargePeriodStart: r.chargePeriodStart, chargeDueOn: r.chargeDueOn, sentByName: r.sentByName }));
  }

  /** The last reminder sent about each of `chargeIds`. */
  async lastFor(chargeIds: readonly string[], db: DbOrTx = this.db): Promise<Map<string, { kind: LeaseReminderKind; sentAt: Date }>> {
    if (chargeIds.length === 0) return new Map();
    const rows = await db
      .select({ chargeId: leaseReminders.chargeId, kind: leaseReminders.kind, sentAt: leaseReminders.sentAt })
      .from(leaseReminders)
      .where(inArray(leaseReminders.chargeId, [...chargeIds]))
      .orderBy(desc(leaseReminders.sentAt));
    const out = new Map<string, { kind: LeaseReminderKind; sentAt: Date }>();
    for (const r of rows) if (r.chargeId && !out.has(r.chargeId)) out.set(r.chargeId, { kind: r.kind, sentAt: r.sentAt });
    return out;
  }
}
