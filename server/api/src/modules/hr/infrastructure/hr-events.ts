import { outboxEvents } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * The closed list of HR triggers (058-reports-automations AC-AU1). Each module
 * writes its own as it is built; the automations slice adds the rules that turn
 * them into email and SMS. Until then the rows wait in the outbox, which is
 * harmless: nothing reads them yet.
 */
export type HrTrigger =
  | 'leave.requested'
  | 'leave.step2_pending'
  | 'leave.decided'
  | 'allocation.decided'
  | 'roster.published'
  | 'roster.changed'
  | 'shift_request.decided'
  | 'swap.requested'
  | 'attendance.flagged'
  | 'attendance_request.decided'
  | 'document.requested'
  | 'document.expiring'
  | 'contract.ending'
  | 'payslip.confirmed'
  | 'claim.decided'
  | 'pay_account.changed'
  | 'ticket.created'
  | 'ticket.status_changed'
  | 'interview.scheduled'
  | 'offer.sent'
  | 'onboarding.link_sent'
  | 'resignation.decided'
  | 'asset.expiring'
  | 'announcement.published'
  | 'feedback.requested'
  | 'exit_task.assigned'
  | 'onboarding_task.assigned';

/**
 * Write one HR trigger to `outbox_events`, INSIDE the transaction that made the
 * change (index contract 12).
 *
 * IDS ONLY in the payload: never a name, a phone, an amount or a link (the
 * outbox rule of ADR-050 D-v). The consumer reads the rows it needs. A list
 * holds ids or codes too, such as the `reasons` a flagged punch waits for
 * (mobile spec 0003, D-ao).
 * `dedupe_key` is `<trigger>:<aggregate id>:<change>`, so one real event is one
 * row and a replay writes nothing.
 */
export async function writeHrEvent(
  tx: Tx | Database,
  event: {
    trigger: HrTrigger;
    aggregateType: string;
    aggregateId: string;
    change: string;
    workspaceId: string | null;
    payload: Record<string, string | readonly string[] | null>;
  },
): Promise<void> {
  await tx
    .insert(outboxEvents)
    .values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.trigger,
      payload: event.payload,
      workspaceId: event.workspaceId,
      dedupeKey: `${event.trigger}:${event.aggregateId}:${event.change}`,
    })
    .onConflictDoNothing({ target: outboxEvents.dedupeKey });
}
