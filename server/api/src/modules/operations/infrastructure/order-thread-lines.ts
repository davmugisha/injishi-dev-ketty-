import type { ServiceOrderStatus } from '@injishi/contracts';
import { eq } from 'drizzle-orm';

import {
  departments,
  messages,
  outlets,
  serviceOrders,
  threads,
} from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * The sentence a conversation shows for one order status (ADR-050 D-s).
 *
 * Written from the guest's side, because the guest is who the line is for; the
 * staff side reads the same row and the order number makes it unambiguous.
 */
export function orderLineText(
  status: ServiceOrderStatus,
  order: { orderNumber: string; placeName: string; departmentName: string | null },
): string {
  const n = `Order ${order.orderNumber}`;
  const who = order.departmentName ?? order.placeName;
  switch (status) {
    case 'submitted':
      return `${n} was sent to ${order.placeName}.`;
    case 'pending_payment':
      return `${n} is waiting for payment.`;
    case 'payment_failed':
      return `The payment for ${n} did not go through.`;
    case 'acknowledged':
      return `${who} has your order ${order.orderNumber} and is on it.`;
    case 'in_progress':
      return `${n} is being prepared.`;
    case 'ready':
      return `${n} is ready.`;
    case 'delivered':
      return `${n} was delivered.`;
    case 'completed':
      return `${n} is complete.`;
    case 'cancelled':
      return `${n} was cancelled.`;
    case 'rejected':
      return `${who} could not take your order ${order.orderNumber}.`;
  }
}

/**
 * Write the conversation line for an order's new status, IN the transaction
 * that moved the order (ADR-050 D-s, key invariant: "a system message is
 * written in the same transaction as the order event it reports").
 *
 * Does nothing for an order raised outside a conversation: those have
 * `thread_id` null and their home is the order screen. The line has no sender,
 * so it never reads as a member of staff answering, and it touches the thread
 * so the conversation rises to the top of both inboxes.
 */
export async function writeOrderThreadLineTx(
  tx: Tx,
  orderId: string,
  status: ServiceOrderStatus,
): Promise<void> {
  const [order] = await tx
    .select({
      threadId: serviceOrders.threadId,
      orderNumber: serviceOrders.orderNumber,
      outletName: outlets.name,
      departmentName: departments.name,
    })
    .from(serviceOrders)
    .leftJoin(outlets, eq(outlets.id, serviceOrders.outletId))
    .leftJoin(departments, eq(departments.id, serviceOrders.departmentId))
    .where(eq(serviceOrders.id, orderId))
    .limit(1);
  if (!order?.threadId) return;

  const body = orderLineText(status, {
    orderNumber: order.orderNumber,
    placeName: order.outletName ?? order.departmentName ?? 'the hotel',
    departmentName: order.departmentName,
  });
  await tx.insert(messages).values({
    threadId: order.threadId,
    senderUserId: null,
    bodyType: 'system',
    body,
    serviceOrderId: orderId,
  });
  await tx
    .update(threads)
    .set({ updatedAt: new Date() })
    .where(eq(threads.id, order.threadId));
}
