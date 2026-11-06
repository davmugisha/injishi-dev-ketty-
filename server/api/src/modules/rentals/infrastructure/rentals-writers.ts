import { Injectable } from '@nestjs/common';
import type { LeaseActorRole, LeaseEventKind } from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import { leaseEvents } from '../../../database/drizzle/schema';
import { AuditWriter } from '../../../shared/audit/audit-writer';
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
export type RentalsAuditSubject =
  | 'lease'
  | 'tenant'
  | 'rental_unit'
  | 'payout_account'
  | 'deposit'
  | 'payment'
  // P4 (migration 0087): a fault's moves and payments, an expense, a tax declaration.
  | 'maintenance_ticket'
  | 'expense'
  | 'tax_declaration'
  // The business itself: whether it lets as a person or a company (WP 4.4).
  | 'org';

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
 * One row per act, by subject, in the same transaction as the act, written
 * through the platform's `AuditWriter` (ADR-076 G16): a landlord's act carries
 * the business grant it was done under, a tenant's `self`, and a job's none.
 * `audit_events` has a `prev_hash` column that nothing chains yet; chaining
 * belongs in `AuditWriter`, not in one module's writer.
 */
@Injectable()
export class RentalsAuditWriter {
  async write(tx: DbOrTx, entry: RentalsAuditInput): Promise<void> {
    await AuditWriter.write(tx, {
      actorUserId: entry.actorUserId,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      eventType: entry.eventType,
      payloadDiff: entry.diff ?? null,
      reason: entry.reason ?? null,
    });
  }
}
