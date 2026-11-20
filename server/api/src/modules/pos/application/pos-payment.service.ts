import { randomBytes } from 'node:crypto';

import {
  canMovePayment,
  checkPayment,
  demoPaymentReference,
  type PosOrder,
  type RefundPosPaymentRequest,
  type ResolvePosPaymentRequest,
  type TakePosPaymentRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { cashierShifts, posPaymentEvents, posPayments, posRefunds } from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isManualMobile, MOBILE_LABEL } from '../domain/mobile-payment';
import { maskPhone, POS_PAYMENT_PORT, type PosPaymentPort } from '../domain/payment-simulator';
import { presentOrder } from '../infrastructure/pos-present';
import {
  audit,
  orderInScope,
  outletInScope,
  refreshOrderStatus,
  settingsFor,
  settlementFor,
  type Tx,
} from '../infrastructure/pos-support';

/** Postgres' unique violation, raised when two presses race on one idempotency key. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

/** Eight characters no provider would ever hand out, for a demo reference. */
function token(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, 'X').slice(0, 8);
}

/**
 * Payments and refunds on a POS order (POS spec §5 checkout, §9). Several
 * payments may settle one order, by any mix of methods; every non cash method
 * is answered by the DEMO simulator behind `POS_PAYMENT_PORT`, which contacts
 * no provider.
 *
 * IDEMPOTENT. Each press of "Take payment" and "Refund" carries a key, stored
 * unique: the same key answers with what the first press made, so a retried
 * request never pays or refunds twice. A pending payment's callback is
 * idempotent too: the same answer again changes nothing.
 */
@Injectable()
export class PosPaymentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(POS_PAYMENT_PORT) private readonly provider: PosPaymentPort,
  ) {}

  private has(ws: ScopedWorkspace, permission: string): boolean {
    return (ws.permissions as readonly string[]).includes(permission);
  }

  private async answer(ws: ScopedWorkspace, orderId: string): Promise<PosOrder> {
    return presentOrder(this.db, await orderInScope(this.db, ws, orderId));
  }

  /** The caller's own open shift at this outlet, locked, or null. */
  private async myOpenShift(tx: Tx, outletId: string, userId: string): Promise<typeof cashierShifts.$inferSelect | null> {
    const [shift] = await tx
      .select()
      .from(cashierShifts)
      .where(and(eq(cashierShifts.outletId, outletId), eq(cashierShifts.cashierUserId, userId), eq(cashierShifts.status, 'open')))
      .limit(1)
      .for('update');
    return shift ?? null;
  }

  async take(ws: ScopedWorkspace, orderId: string, body: TakePosPaymentRequest, userId: string): Promise<PosOrder> {
    const key = `${ws.workspaceId}:${body.idempotencyKey}`;
    const replay = async (): Promise<PosOrder | null> => {
      const [prior] = await this.db
        .select({ orderId: posPayments.orderId })
        .from(posPayments)
        .where(eq(posPayments.idempotencyKey, key))
        .limit(1);
      if (!prior) return null;
      if (prior.orderId !== orderId) throw new ConflictException('That payment key was already used on another order.');
      return this.answer(ws, orderId);
    };
    const first = await replay();
    if (first) return first;

    try {
      await this.db.transaction(async (tx) => {
        const order = await orderInScope(tx, ws, orderId, true);
        if (order.status === 'cancelled') throw new ConflictException(`${order.orderNumber} was cancelled.`);
        const settings = await settingsFor(tx, { id: order.outletId, workspaceId: order.workspaceId });
        if (!settings.enabledMethods.includes(body.method)) {
          throw new UnprocessableEntityException('That payment method is not enabled at this outlet.');
        }
        if (body.method === 'customer_credit') {
          throw new UnprocessableEntityException('Customer credit arrives with customer accounts, in a later phase.');
        }
        if (body.method === 'voucher' && !body.voucherCode) {
          throw new UnprocessableEntityException('Enter the voucher code.');
        }
        if (order.totalRwf === 0) throw new ConflictException('This bill has nothing on it to pay.');

        const tip = body.tipRwf;
        if (body.method !== 'cash' && body.tenderedRwf !== undefined) {
          throw new UnprocessableEntityException('Only cash gives change.');
        }
        if (body.method === 'cash' && body.tenderedRwf !== undefined && body.tenderedRwf < body.amountRwf + tip) {
          throw new UnprocessableEntityException('The cash handed over is less than the amount and the tip.');
        }
        const settlement = await settlementFor(tx, order);
        const check = checkPayment(
          settlement,
          body.method,
          body.amountRwf,
          body.method === 'cash' && body.tenderedRwf !== undefined ? body.tenderedRwf - tip : null,
        );
        if (!check.ok) throw new ConflictException(check.problem);

        const shift = await this.myOpenShift(tx, order.outletId, userId);
        if (body.method === 'cash' && !shift) {
          throw new ConflictException('Open your cashier shift before taking cash: cash has to land in a drawer.');
        }

        // MTN MoMo and Airtel Money are paid from the customer's phone and confirmed by the cashier on the Cashier
        // Desk once the money is seen: they always start PENDING, and no provider answer is ever simulated for them.
        const answer = isManualMobile(body.method)
          ? {
              status: 'pending' as const,
              note: `The customer pays by ${MOBILE_LABEL[body.method]}. Waiting for the cashier to see the money arrive. No provider is contacted.`,
              failureReason: null,
            }
          : this.provider.start(body.method, body.simulate);
        const now = new Date();
        const [payment] = await tx
          .insert(posPayments)
          .values({
            workspaceId: ws.workspaceId,
            outletId: order.outletId,
            orderId: order.id,
            shiftId: shift?.id ?? null,
            method: body.method,
            amountRwf: body.amountRwf,
            tenderedRwf: body.method === 'cash' ? (body.tenderedRwf ?? null) : null,
            changeRwf: check.changeRwf,
            tipRwf: tip,
            status: answer.status,
            demoReference: demoPaymentReference(body.method, token()),
            simulated: body.method !== 'cash' && !isManualMobile(body.method),
            payerPhoneMasked: maskPhone(body.payerPhone),
            voucherCode: body.method === 'voucher' ? (body.voucherCode ?? null) : null,
            failureReason: answer.failureReason,
            idempotencyKey: key,
            createdByUserId: userId,
            settledAt: answer.status === 'successful' ? now : null,
          })
          .returning();
        if (!payment) throw new Error('The payment did not save.');
        await tx.insert(posPaymentEvents).values({ paymentId: payment.id, toStatus: answer.status, note: answer.note, actorUserId: userId });
        await audit(tx, {
          workspaceId: ws.workspaceId,
          outletId: order.outletId,
          actorUserId: userId,
          action: 'payment.taken',
          entityType: 'pos_payment',
          entityId: payment.id,
          after: {
            orderNumber: order.orderNumber,
            method: body.method,
            amountRwf: body.amountRwf,
            tipRwf: tip,
            status: answer.status,
            reference: payment.demoReference,
            simulated: payment.simulated,
          },
        });
        await refreshOrderStatus(tx, order.id, userId);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await replay();
        if (raced) return raced;
      }
      throw error;
    }
    return this.answer(ws, orderId);
  }

  private async payment(tx: Tx, ws: ScopedWorkspace, paymentId: string): Promise<typeof posPayments.$inferSelect> {
    const [row] = await tx
      .select()
      .from(posPayments)
      .where(and(eq(posPayments.id, paymentId), eq(posPayments.workspaceId, ws.workspaceId)))
      .limit(1)
      .for('update');
    if (!row) throw new NotFoundException('That payment is not available to you.');
    await outletInScope(tx, ws, row.outletId);
    return row;
  }

  /** The simulated provider's callback for a pending payment. */
  async resolve(ws: ScopedWorkspace, paymentId: string, body: ResolvePosPaymentRequest, userId: string): Promise<PosOrder> {
    const orderId = await this.db.transaction(async (tx) => {
      const payment = await this.payment(tx, ws, paymentId);
      if (isManualMobile(payment.method)) {
        // Nobody may claim MTN or Airtel answered: the cashier confirms the money by hand on the Cashier Desk.
        throw new ConflictException(
          `${MOBILE_LABEL[payment.method]} payments are confirmed on the Cashier Desk once the money has arrived.`,
        );
      }
      await orderInScope(tx, ws, payment.orderId, true);
      const answer = this.provider.resolve(payment.method, body.outcome);
      if (payment.status === answer.status) return payment.orderId;
      if (!canMovePayment(payment.status, answer.status)) {
        throw new ConflictException(`This payment was already answered: ${payment.status}.`);
      }
      const now = new Date();
      await tx
        .update(posPayments)
        .set({
          status: answer.status,
          failureReason: answer.failureReason,
          settledAt: answer.status === 'successful' ? now : null,
          updatedAt: now,
        })
        .where(eq(posPayments.id, payment.id));
      await tx.insert(posPaymentEvents).values({
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: answer.status,
        note: answer.note,
        actorUserId: userId,
      });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: payment.outletId,
        actorUserId: userId,
        action: 'payment.resolved',
        entityType: 'pos_payment',
        entityId: payment.id,
        before: { status: payment.status },
        after: { status: answer.status, simulated: true },
      });
      await refreshOrderStatus(tx, payment.orderId, userId);
      return payment.orderId;
    });
    return this.answer(ws, orderId);
  }

  /**
   * Refund part or all of a collected payment, with a reason. Cash leaves a
   * drawer: the refunder's own open shift, or failing that the shift the cash
   * came in on if it is still open. Otherwise the refund waits for a shift.
   */
  async refund(ws: ScopedWorkspace, paymentId: string, body: RefundPosPaymentRequest, userId: string): Promise<PosOrder> {
    if (!this.has(ws, 'pos.refund')) throw new ForbiddenException('Refunds need a manager.');
    const key = `${ws.workspaceId}:${body.idempotencyKey}`;
    const [prior] = await this.db
      .select({ paymentId: posRefunds.paymentId })
      .from(posRefunds)
      .where(eq(posRefunds.idempotencyKey, key))
      .limit(1);
    if (prior) {
      if (prior.paymentId !== paymentId) throw new ConflictException('That refund key was already used on another payment.');
      const [p] = await this.db.select({ orderId: posPayments.orderId }).from(posPayments).where(eq(posPayments.id, paymentId));
      if (!p) throw new NotFoundException('That payment is not available to you.');
      return this.answer(ws, p.orderId);
    }

    let orderId: string;
    try {
      orderId = await this.db.transaction(async (tx) => {
        const payment = await this.payment(tx, ws, paymentId);
        const order = await orderInScope(tx, ws, payment.orderId, true);
        if (payment.status !== 'successful') throw new ConflictException('Only a collected payment can be refunded.');
        // A refund corrects a settled sale; an unsettled bill is corrected by voiding or discounting instead.
        const settlement = await settlementFor(tx, order);
        if (!settlement.settled) {
          throw new ConflictException('Refunds correct a settled bill. Take the rest of the payment first, or void the line.');
        }
        const left = payment.amountRwf - payment.refundedRwf;
        if (body.amountRwf > left) {
          throw new UnprocessableEntityException(`At most RWF ${left.toLocaleString('en-US')} of this payment is left to refund.`);
        }
        let shiftId: string | null = null;
        if (payment.method === 'cash') {
          const mine = await this.myOpenShift(tx, payment.outletId, userId);
          if (mine) shiftId = mine.id;
          else if (payment.shiftId) {
            const [origin] = await tx.select().from(cashierShifts).where(eq(cashierShifts.id, payment.shiftId)).limit(1);
            if (origin?.status === 'open') shiftId = origin.id;
          }
          if (!shiftId) throw new ConflictException('Cash comes back out of a drawer. Open a shift to refund cash.');
        }
        const refunded = payment.refundedRwf + body.amountRwf;
        const status = refunded === payment.amountRwf ? 'refunded' : 'successful';
        const now = new Date();
        await tx.update(posPayments).set({ refundedRwf: refunded, status, updatedAt: now }).where(eq(posPayments.id, payment.id));
        const [refund] = await tx
          .insert(posRefunds)
          .values({
            workspaceId: ws.workspaceId,
            paymentId: payment.id,
            shiftId,
            amountRwf: body.amountRwf,
            reason: body.reason,
            demoReference: `DEMO-RFND-${token().toUpperCase()}`,
            idempotencyKey: key,
            refundedByUserId: userId,
          })
          .returning({ id: posRefunds.id, demoReference: posRefunds.demoReference });
        await tx.insert(posPaymentEvents).values({
          paymentId: payment.id,
          fromStatus: payment.status,
          toStatus: status,
          note: `Refunded RWF ${body.amountRwf.toLocaleString('en-US')}${payment.simulated ? ' (simulated)' : ''}.`,
          actorUserId: userId,
        });
        await audit(tx, {
          workspaceId: ws.workspaceId,
          outletId: payment.outletId,
          actorUserId: userId,
          action: 'payment.refunded',
          entityType: 'pos_payment',
          entityId: payment.id,
          before: { refundedRwf: payment.refundedRwf, status: payment.status },
          after: { refundedRwf: refunded, status, refund: refund?.demoReference, orderNumber: order.orderNumber },
          reason: body.reason,
        });
        return payment.orderId;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const [p] = await this.db.select({ orderId: posPayments.orderId }).from(posPayments).where(eq(posPayments.id, paymentId));
        if (p) return this.answer(ws, p.orderId);
      }
      throw error;
    }
    return this.answer(ws, orderId);
  }
}
