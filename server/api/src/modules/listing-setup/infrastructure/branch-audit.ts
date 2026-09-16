import { auditEvents } from '../../../database/drizzle/governance';
import type { Tx } from './insert-property';

/** What moved on a branch, and what it became (ADR-054 AC-A1). */
export type BranchEvent =
  | 'branch.created'
  | 'branch.updated'
  | 'branch.rra_branch_id_changed'
  | 'branch.archived'
  | 'branch.restored'
  | 'branch.head_office_changed';

/**
 * One `audit_events` row for one branch change, on the CALLER'S transaction.
 *
 * A branch decides where sales are declared and who sees guest data, so every
 * move is recorded (ADR-054 Security model). The row is written on the same
 * transaction as the change: a change with no row is a move nobody can explain,
 * and a row for a change that rolled back is a trail that lies.
 *
 * `diff` carries only the fields that moved, each as `{ from, to }`, taken from
 * the row as read under lock and as written.
 */
export async function recordBranchEvent(
  tx: Tx,
  event: {
    actorUserId: string;
    propertyId: string;
    districtId: number | null;
    eventType: BranchEvent;
    diff: Record<string, { from: unknown; to: unknown }>;
  },
): Promise<void> {
  await tx.insert(auditEvents).values({
    actorUserId: event.actorUserId,
    subjectType: 'property',
    subjectId: event.propertyId,
    eventType: event.eventType,
    payloadDiff: event.diff as never,
    districtId: event.districtId,
  });
}

/** The fields that differ between two reads, as `{ from, to }` pairs. */
export function diffOf<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after) as (keyof T & string)[]) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    if (from !== to) out[key] = { from, to };
  }
  return out;
}
