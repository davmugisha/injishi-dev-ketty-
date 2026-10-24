import { Injectable } from '@nestjs/common';
import type { LeaseActorRole, LeaseEventKind } from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import { auditEvents, leaseEvents } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

/** The transaction handle Drizzle hands a `db.transaction` callback. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
/** A write that may run inside a transaction or on its own. */
export type DbOrTx = Database | Tx;

/** One row of a lease's timeline. */
export interface LeaseEventInput {
  leaseId: string;
  workspaceId: string;
  kind: LeaseEventKind;
  /** Null only for the system. */
  actorUserId: string | null;
  actorRole: LeaseActorRole;
  /** Whether the tenant's own timeline shows it. */
  visibleToTenant?: boolean;
  /** Ids and figures only: never personal data the row does not need. */
  payload?: Record<string, unknown>;
}

/**
 * The lease timeline's one writer (`lease_events`, blueprint 1.2). Called
 * with the transaction that made the change, so a change and its event land
 * together or not at all.
 */
@Injectable()
export class LeaseEventsWriter {
  async write(tx: DbOrTx, event: LeaseEventInput): Promise<void> {
    await tx.insert(leaseEvents).values({
      leaseId: event.leaseId,
      workspaceId: event.workspaceId,
      kind: event.kind,
      actorUserId: event.actorUserId,
      actorRole: event.actorRole,
      visibleToTenant: event.visibleToTenant ?? false,
      payload: event.payload ?? {},
      // The wall clock, not the transaction's start: several events written in
      // one transaction (signed, then the invitation sent) keep their order.
      occurredAt: sql`clock_timestamp()`,
    });
  }
}

/** What a rentals audit row is about. */
export type RentalsAuditSubject = 'lease' | 'tenant' | 'rental_unit' | 'payout_account' | 'deposit';

export interface RentalsAuditInput {
  /** Null for an act of the system (a job starting a lease on its start date). */
  actorUserId: string | null;
  subjectType: RentalsAuditSubject;
  subjectId: string;
  /** `lease.cancelled`, `payout_account.added`, ... */
  eventType: string;
  /** What changed: field names and figures, never an account number or an ID number. */
  diff?: Record<string, unknown>;
  reason?: string | null;
}

/**
 * The rentals audit writer (blueprint 1.2, "Messages and audit"): signatures,
 * cancellations, tenant record changes, payout account changes, unit
 * retirements, later recorded and reversed payments and deposit settlements.
 *
 * `audit_events` has a `prev_hash` column, but nothing in the platform chains
 * it yet (every writer leaves it null), so these rows follow that: one row per
 * act, by subject, in the same transaction as the act. Chaining belongs in a
 * shared writer for every audit row, not in one module's.
 */
@Injectable()
export class RentalsAuditWriter {
  async write(tx: DbOrTx, entry: RentalsAuditInput): Promise<void> {
    await tx.insert(auditEvents).values({
      actorUserId: entry.actorUserId,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      eventType: entry.eventType,
      payloadDiff: (entry.diff ?? null) as never,
      reason: entry.reason ?? null,
    });
  }
}
