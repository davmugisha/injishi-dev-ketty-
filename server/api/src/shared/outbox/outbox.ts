import { outboxEvents } from '../../database/drizzle/schema';
import type { Database } from '../database/database.module';

/** The transaction handle Drizzle hands a `db.transaction` callback. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * The six realtime event names (ADR-050 D-v). The name IS the channel a client
 * subscribes to, which is why they are dotted.
 */
export type RealtimeEventType =
  | 'order.status'
  | 'thread.message'
  | 'housekeeping.task'
  | 'folio.balance'
  | 'ebm.health'
  | 'ebm.sale';

/**
 * Which rooms an event fans out to. IDS ONLY: no message body, no name, no
 * phone number and no amount ever enters Redis (ADR-050 D-v, the rule ADR-047
 * D-g set for mail jobs). A client treats every event as a hint to re-read.
 */
export interface RealtimeEventPayload {
  status?: string;
  propertyId?: string | null;
  departmentId?: string | null;
  folioId?: string | null;
  roomId?: string | null;
  userId?: string | null;
  orderId?: string | null;
  emissionId?: string | null;
}

/**
 * Write one `outbox_events` row, INSIDE the transaction that made the change
 * (ADR-050, cross child contract 4).
 *
 * Nothing publishes directly. Slice 6's `OutboxFanout` reads pending rows in
 * order and publishes them; until it exists these rows simply wait, which is
 * harmless, because realtime carries no truth.
 *
 * `dedupe_key` is globally unique and minted as
 * `<eventType>:<aggregateId>:<change>`, so one real state change is one row.
 * `change` is the new status wherever the aggregate has one. A folio balance
 * has no status and changes many times, so its callers pass the id of the
 * charge that moved it: keying it on a status would collapse every later
 * change into the first one's row.
 *
 * A replayed command that reaches here twice writes nothing the second time.
 */
export async function writeOutboxTx(
  tx: Database | Tx,
  event: {
    eventType: RealtimeEventType;
    aggregateType: string;
    aggregateId: string;
    change: string;
    workspaceId: string | null;
    payload: RealtimeEventPayload;
  },
): Promise<void> {
  await tx
    .insert(outboxEvents)
    .values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      workspaceId: event.workspaceId,
      dedupeKey: `${event.eventType}:${event.aggregateId}:${event.change}`,
    })
    .onConflictDoNothing({ target: outboxEvents.dedupeKey });
}
