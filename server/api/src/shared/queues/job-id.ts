import { createHash } from 'node:crypto';

/**
 * A BullMQ job id made from any idempotency key.
 *
 * BullMQ 5 refuses a custom id that contains a colon ("Custom Id cannot
 * contain :"), unless the id has exactly three colon separated parts, which is
 * the shape it keeps for repeatable jobs. Our money keys are written as
 * `<workspace>:<operation>:<token>`, and every key derived from one adds a
 * prefix (`void:`, `refund:`, `escrow-release:`), so they have four or more
 * parts. Used as job ids, every one of them was refused: `queue.add` threw, the
 * caller logged a warning, the row sat in `payment_compensations`, and the
 * minute drain failed the same way for ever. No void and no refund from the
 * booking path ever ran (booking audit, 2026-09-13).
 *
 * The id is the SHA-256 of the key. It is deterministic, so the queue still
 * deduplicates a key enqueued twice; it contains no colon at all, so it never
 * leans on the three part exception; and the key itself stays readable in the
 * job data and in the table, which is where a person looks for it.
 */
export function queueJobId(key: string): string {
  return `k_${createHash('sha256').update(key).digest('hex')}`;
}
