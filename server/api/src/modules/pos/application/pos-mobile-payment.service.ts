import { randomBytes } from 'node:crypto';

import { checkPayment, demoPaymentReference, maskCustomerPhone, type PosOrder } from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm';

import {
  cashierShifts,
  customers,
  posOrderLines,
  posOrders,
  posPaymentEvents,
  posPayments,
  restaurantTables,
  tableSessions,
} from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import {
  cleanPhone,
  isManualMobile,
  maskEmail,
  MOBILE_LABEL,
  receiptMail,
  type ConfirmMobilePaymentRequest,
  type EmailReceiptRequest,
  type PosAwaitingPayment,
  type PosAwaitingPayments,
  type PosPaymentDecision,
  type PosPaymentUpdate,
  type RejectMobilePaymentRequest,
  type StartMobilePaymentRequest,
} from '../domain/mobile-payment';
import { maskPhone } from '../domain/payment-simulator';
import { presentOrder } from '../infrastructure/pos-present';
import {
  audit,
  namesOf,
  orderInScope,
  outletInScope,
  refreshOrderStatus,
  settingsFor,
  settlementFor,
  type Tx,
} from '../infrastructure/pos-support';

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

function token(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, 'X').slice(0, 8);
}

/** How far back the desk's history and the waiter's updates reach. */
const RECENT_MS = 12 * 60 * 60 * 1000;
const IN_FLIGHT = ['initiated', 'pending'] as const;
const ANSWERED = ['successful', 'failed', 'expired'] as const;

/**
 * Mobile money paid from the customer's phone and confirmed by the cashier (see `domain/mobile-payment.ts`).
 *
 * NO PROVIDER IS CONTACTED and none is pretended: a payment is PENDING until a cashier who saw the money arrive
 * confirms it, and that confirmation is recorded as a person's check, with their name and the instant, in the
 * payment's events and the audit log.
 */
@Injectable()
export class PosMobilePaymentService {
  private static readonly SEND_TIMEOUT_MS = 8_000;
  private readonly logger = new Logger(PosMobilePaymentService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {}

  private async answer(ws: ScopedWorkspace, orderId: string): Promise<PosOrder> {
    return presentOrder(this.db, await orderInScope(this.db, ws, orderId));
  }

  private async openShiftOf(tx: Tx, outletId: string, userId: string): Promise<string | null> {
    const [shift] = await tx
      .select({ id: cashierShifts.id })
      .from(cashierShifts)
      .where(and(eq(cashierShifts.outletId, outletId), eq(cashierShifts.cashierUserId, userId), eq(cashierShifts.status, 'open')))
      .limit(1);
    return shift?.id ?? null;
  }

  /**
   * The waiter (or the cashier) presses Pay: the customer pays from their phone, and the payment waits as PENDING
   * for the cashier. It is never recorded as paid here. Idempotent by the press's key.
   */
  async start(ws: ScopedWorkspace, orderId: string, body: StartMobilePaymentRequest, userId: string): Promise<PosOrder> {
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
    const phone = cleanPhone(body.payerPhone);
    if (!phone) throw new UnprocessableEntityException('Enter the phone number the customer pays from.');

    try {
      await this.db.transaction(async (tx) => {
        const order = await orderInScope(tx, ws, orderId, true);
        if (order.status === 'cancelled') throw new ConflictException(`${order.orderNumber} was cancelled.`);
        if (order.status === 'completed') throw new ConflictException(`${order.orderNumber} is already paid and closed.`);
        const settings = await settingsFor(tx, { id: order.outletId, workspaceId: order.workspaceId });
        if (!settings.enabledMethods.includes(body.method)) {
          throw new UnprocessableEntityException(`${MOBILE_LABEL[body.method]} is not enabled at this outlet.`);
        }
        if (order.totalRwf === 0) throw new ConflictException('This bill has nothing on it to pay.');
        const settlement = await settlementFor(tx, order);
        const check = checkPayment(settlement, body.method, body.amountRwf, null);
        if (!check.ok) {
          throw new ConflictException(
            settlement.payableRwf === 0 && settlement.pendingRwf > 0
              ? 'A payment for this bill is already waiting for the cashier. Ask the cashier to confirm it, or to mark it not received.'
              : check.problem,
          );
        }
        const shiftId = await this.openShiftOf(tx, order.outletId, userId);
        const masked = maskPhone(phone);
        const [payment] = await tx
          .insert(posPayments)
          .values({
            workspaceId: ws.workspaceId,
            outletId: order.outletId,
            orderId: order.id,
            shiftId,
            method: body.method,
            amountRwf: body.amountRwf,
            tenderedRwf: null,
            changeRwf: 0,
            tipRwf: 0,
            status: 'pending',
            demoReference: demoPaymentReference(body.method, token()),
            // No provider is involved at all: the money is checked by a person, as cash is.
            simulated: false,
            payerPhoneMasked: masked,
            failureReason: null,
            idempotencyKey: key,
            createdByUserId: userId,
            settledAt: null,
          })
          .returning();
        if (!payment) throw new Error('The payment did not save.');
        await tx.insert(posPaymentEvents).values({
          paymentId: payment.id,
          toStatus: 'pending',
          note: `The customer pays by ${MOBILE_LABEL[body.method]} from ${masked ?? 'their phone'}. Waiting for the cashier to see the money arrive. No provider is contacted.`,
          actorUserId: userId,
        });
        await audit(tx, {
          workspaceId: ws.workspaceId,
          outletId: order.outletId,
          actorUserId: userId,
          action: 'payment.started',
          entityType: 'pos_payment',
          entityId: payment.id,
          after: {
            orderNumber: order.orderNumber,
            method: body.method,
            amountRwf: body.amountRwf,
            status: 'pending',
            reference: payment.demoReference,
            payerPhone: masked,
            verification: 'manual_by_cashier',
          },
        });
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

  private async lockedPayment(tx: Tx, ws: ScopedWorkspace, paymentId: string): Promise<typeof posPayments.$inferSelect> {
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

  /** Why a payment that is no longer in flight cannot be answered again, with who answered it and when. */
  private async alreadyAnswered(tx: Tx, payment: typeof posPayments.$inferSelect): Promise<ConflictException> {
    const [last] = await tx
      .select({ actor: posPaymentEvents.actorUserId, at: posPaymentEvents.occurredAt })
      .from(posPaymentEvents)
      .where(and(eq(posPaymentEvents.paymentId, payment.id), eq(posPaymentEvents.toStatus, payment.status)))
      .orderBy(desc(posPaymentEvents.occurredAt))
      .limit(1);
    const who = last?.actor ? (await namesOf(tx, [last.actor])).get(last.actor) : null;
    const when = last?.at
      ? last.at.toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali', hour: '2-digit', minute: '2-digit' })
      : null;
    const done = payment.status === 'successful' || payment.status === 'refunded' ? 'already confirmed' : `already ${payment.status}`;
    return new ConflictException(`This payment was ${done}${who ? ` by ${who}` : ''}${when ? ` at ${when}` : ''}.`);
  }

  /**
   * The cashier saw the money arrive: the payment becomes successful, the bill settles if nothing else is owed, and
   * the cashier and the instant are recorded. Refused twice (the row is locked and must still be in flight).
   */
  async confirm(ws: ScopedWorkspace, paymentId: string, body: ConfirmMobilePaymentRequest, userId: string): Promise<PosOrder> {
    const orderId = await this.db.transaction(async (tx) => {
      const payment = await this.lockedPayment(tx, ws, paymentId);
      if (!isManualMobile(payment.method)) {
        throw new ConflictException('Only MTN MoMo and Airtel Money payments are confirmed here.');
      }
      const order = await orderInScope(tx, ws, payment.orderId, true);
      if (!(IN_FLIGHT as readonly string[]).includes(payment.status)) throw await this.alreadyAnswered(tx, payment);
      if (order.status === 'cancelled') {
        throw new ConflictException(`${order.orderNumber} was cancelled. Mark this payment not received and refund the customer if money arrived.`);
      }
      const settlement = await settlementFor(tx, order);
      if (payment.amountRwf > settlement.outstandingRwf) {
        throw new ConflictException(
          `The bill changed: only ${`RWF ${settlement.outstandingRwf.toLocaleString('en-US')}`} is still owed, less than this payment. Mark it not received and start a new one.`,
        );
      }
      const now = new Date();
      const shiftId = payment.shiftId ?? (await this.openShiftOf(tx, payment.outletId, userId));
      const tx_id = body.transactionId?.trim() || null;
      await tx
        .update(posPayments)
        .set({ status: 'successful', settledAt: now, shiftId, failureReason: null, updatedAt: now })
        .where(eq(posPayments.id, payment.id));
      await tx.insert(posPaymentEvents).values({
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: 'successful',
        note: `Confirmed by the cashier, who saw the money arrive on the venue's ${MOBILE_LABEL[payment.method]} account${tx_id ? ` (transaction ID ${tx_id})` : ''}. Checked by a person, not by the provider.`,
        actorUserId: userId,
        occurredAt: now,
      });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: payment.outletId,
        actorUserId: userId,
        action: 'payment.confirmed',
        entityType: 'pos_payment',
        entityId: payment.id,
        before: { status: payment.status },
        after: {
          status: 'successful',
          orderNumber: order.orderNumber,
          amountRwf: payment.amountRwf,
          method: payment.method,
          reference: payment.demoReference,
          transactionId: tx_id,
          confirmedByUserId: userId,
          confirmedAt: now.toISOString(),
          verification: 'manual_by_cashier',
        },
      });
      await refreshOrderStatus(tx, order.id, userId);
      return order.id;
    });
    return this.answer(ws, orderId);
  }

  /** The money did not arrive: the payment fails with the cashier's reason, and the bill is owed again. */
  async reject(ws: ScopedWorkspace, paymentId: string, body: RejectMobilePaymentRequest, userId: string): Promise<PosOrder> {
    const orderId = await this.db.transaction(async (tx) => {
      const payment = await this.lockedPayment(tx, ws, paymentId);
      if (!isManualMobile(payment.method)) {
        throw new ConflictException('Only MTN MoMo and Airtel Money payments are answered here.');
      }
      const order = await orderInScope(tx, ws, payment.orderId, true);
      if (!(IN_FLIGHT as readonly string[]).includes(payment.status)) throw await this.alreadyAnswered(tx, payment);
      const now = new Date();
      const reason = `Not received: ${body.reason}`;
      await tx
        .update(posPayments)
        .set({ status: 'failed', failureReason: reason.slice(0, 300), settledAt: null, updatedAt: now })
        .where(eq(posPayments.id, payment.id));
      await tx.insert(posPaymentEvents).values({
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: 'failed',
        note: `Marked not received by the cashier: ${body.reason}`,
        actorUserId: userId,
        occurredAt: now,
      });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: payment.outletId,
        actorUserId: userId,
        action: 'payment.not_received',
        entityType: 'pos_payment',
        entityId: payment.id,
        before: { status: payment.status },
        after: { status: 'failed', orderNumber: order.orderNumber, amountRwf: payment.amountRwf, method: payment.method },
        reason: body.reason,
      });
      await refreshOrderStatus(tx, order.id, userId);
      return order.id;
    });
    return this.answer(ws, orderId);
  }

  /** The Cashier Desk's list: every payment in flight at this outlet, oldest first, and what was answered lately. */
  async awaiting(ws: ScopedWorkspace, outletId: string): Promise<PosAwaitingPayments> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const rows = await this.db
      .select({
        p: posPayments,
        orderNumber: posOrders.orderNumber,
        orderType: posOrders.orderType,
        waiterUserId: posOrders.waiterUserId,
        tableLabel: restaurantTables.label,
        customerName: customers.fullName,
        customerPhone: customers.phoneE164,
        customerStatus: customers.status,
      })
      .from(posPayments)
      .innerJoin(posOrders, eq(posOrders.id, posPayments.orderId))
      .leftJoin(tableSessions, eq(tableSessions.id, posOrders.tableSessionId))
      .leftJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
      .leftJoin(customers, and(eq(customers.id, posOrders.customerId), eq(customers.workspaceId, posOrders.workspaceId)))
      .where(
        and(
          eq(posPayments.outletId, outlet.id),
          inArray(posPayments.status, [...IN_FLIGHT]),
          ne(posOrders.status, 'cancelled'),
        ),
      )
      .orderBy(asc(posPayments.createdAt))
      .limit(200);

    const since = new Date(Date.now() - RECENT_MS);
    const decided = await this.db
      .select({
        eventId: posPaymentEvents.id,
        toStatus: posPaymentEvents.toStatus,
        actor: posPaymentEvents.actorUserId,
        at: posPaymentEvents.occurredAt,
        note: posPaymentEvents.note,
        paymentId: posPayments.id,
        method: posPayments.method,
        amountRwf: posPayments.amountRwf,
        orderId: posOrders.id,
        orderNumber: posOrders.orderNumber,
        tableLabel: restaurantTables.label,
      })
      .from(posPaymentEvents)
      .innerJoin(posPayments, eq(posPayments.id, posPaymentEvents.paymentId))
      .innerJoin(posOrders, eq(posOrders.id, posPayments.orderId))
      .leftJoin(tableSessions, eq(tableSessions.id, posOrders.tableSessionId))
      .leftJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
      .where(
        and(
          eq(posPayments.outletId, outlet.id),
          inArray(posPayments.method, ['mtn_momo', 'airtel_money']),
          inArray(posPaymentEvents.fromStatus, [...IN_FLIGHT]),
          inArray(posPaymentEvents.toStatus, [...ANSWERED]),
          gt(posPaymentEvents.occurredAt, since),
        ),
      )
      .orderBy(desc(posPaymentEvents.occurredAt))
      .limit(10);

    const names = await namesOf(this.db, [
      ...rows.flatMap((r) => [r.p.createdByUserId, r.waiterUserId]),
      ...decided.map((d) => d.actor),
    ]);
    const awaiting: PosAwaitingPayment[] = rows.map((r) => ({
      paymentId: r.p.id,
      orderId: r.p.orderId,
      orderNumber: r.orderNumber,
      orderType: r.orderType,
      tableLabel: r.tableLabel ?? null,
      customerName: r.customerName ?? null,
      customerPhoneMasked:
        r.customerPhone && r.customerStatus !== 'erased' ? maskCustomerPhone(r.customerPhone) || null : null,
      payerPhoneMasked: r.p.payerPhoneMasked,
      method: r.p.method,
      amountRwf: r.p.amountRwf,
      reference: r.p.demoReference,
      status: r.p.status,
      startedAt: r.p.createdAt.toISOString(),
      startedByName: names.get(r.p.createdByUserId) ?? null,
      waiterName: r.waiterUserId ? (names.get(r.waiterUserId) ?? null) : null,
      confirmable: isManualMobile(r.p.method),
    }));
    const recent: PosPaymentDecision[] = decided.map((d) => ({
      paymentId: d.paymentId,
      orderId: d.orderId,
      orderNumber: d.orderNumber,
      tableLabel: d.tableLabel ?? null,
      method: d.method,
      amountRwf: d.amountRwf,
      outcome: d.toStatus === 'successful' ? 'confirmed' : 'not_received',
      byName: d.actor ? (names.get(d.actor) ?? null) : null,
      at: d.at.toISOString(),
      note: d.note,
    }));
    return { awaiting, recent };
  }

  /**
   * What the waiter is told: payments on the waiter's own bills (or started by them) that someone else answered,
   * since `since` (at most 12 hours back). A cash or card payment the cashier took counts too: the bill is paid.
   */
  async updates(ws: ScopedWorkspace, outletId: string, userId: string, since: Date | null): Promise<PosPaymentUpdate[]> {
    const outlet = await outletInScope(this.db, ws, outletId);
    const floor = new Date(Date.now() - RECENT_MS);
    const from = since && since > floor ? since : floor;
    const rows = await this.db
      .select({
        eventId: posPaymentEvents.id,
        fromStatus: posPaymentEvents.fromStatus,
        toStatus: posPaymentEvents.toStatus,
        actor: posPaymentEvents.actorUserId,
        at: posPaymentEvents.occurredAt,
        paymentId: posPayments.id,
        method: posPayments.method,
        amountRwf: posPayments.amountRwf,
        order: posOrders,
        tableLabel: restaurantTables.label,
        tableId: restaurantTables.id,
        tableStatus: restaurantTables.status,
        sessionStatus: tableSessions.status,
      })
      .from(posPaymentEvents)
      .innerJoin(posPayments, eq(posPayments.id, posPaymentEvents.paymentId))
      .innerJoin(posOrders, eq(posOrders.id, posPayments.orderId))
      .leftJoin(tableSessions, eq(tableSessions.id, posOrders.tableSessionId))
      .leftJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
      .where(
        and(
          eq(posPayments.outletId, outlet.id),
          or(eq(posOrders.waiterUserId, userId), eq(posPayments.createdByUserId, userId)),
          gt(posPaymentEvents.occurredAt, from),
          inArray(posPaymentEvents.toStatus, [...ANSWERED]),
          or(
            // A pending payment answered by the cashier, either way.
            inArray(posPaymentEvents.fromStatus, [...IN_FLIGHT]),
            // A payment the cashier took that settled at once (cash, a voucher).
            and(isNull(posPaymentEvents.fromStatus), eq(posPaymentEvents.toStatus, 'successful')),
          ),
          or(isNull(posPaymentEvents.actorUserId), ne(posPaymentEvents.actorUserId, userId)),
        ),
      )
      .orderBy(asc(posPaymentEvents.occurredAt))
      .limit(50);
    if (rows.length === 0) return [];
    const names = await namesOf(this.db, rows.map((r) => r.actor));
    const settlements = new Map<string, Awaited<ReturnType<typeof settlementFor>>>();
    for (const r of rows) {
      if (!settlements.has(r.order.id)) settlements.set(r.order.id, await settlementFor(this.db, r.order));
    }
    return rows.map((r): PosPaymentUpdate => {
      const s = settlements.get(r.order.id);
      return {
        id: r.eventId,
        paymentId: r.paymentId,
        orderId: r.order.id,
        orderNumber: r.order.orderNumber,
        orderType: r.order.orderType,
        tableLabel: r.tableLabel ?? null,
        tableId: r.tableId ?? null,
        tableSessionId: r.order.tableSessionId,
        sessionOpen: r.sessionStatus === 'open',
        tableStatus: r.tableStatus ?? null,
        method: r.method,
        amountRwf: r.amountRwf,
        outcome: r.toStatus === 'successful' ? 'confirmed' : 'not_received',
        billFullyPaid: !!s?.settled && r.order.totalRwf > 0,
        outstandingRwf: s?.outstandingRwf ?? 0,
        byName: r.actor ? (names.get(r.actor) ?? null) : null,
        at: r.at.toISOString(),
      };
    });
  }

  /**
   * Mail the customer a copy of the receipt of a paid bill, only when they ask. The address is used for this one mail
   * and kept nowhere but masked in the audit log. Built here from the stored bill: nothing in it comes from a client.
   */
  async emailReceipt(ws: ScopedWorkspace, orderId: string, body: EmailReceiptRequest, userId: string): Promise<{ sent: true; to: string }> {
    const order = await orderInScope(this.db, ws, orderId);
    const outlet = await outletInScope(this.db, ws, order.outletId);
    const settlement = await settlementFor(this.db, order);
    if (!settlement.settled || order.totalRwf === 0) {
      throw new ConflictException('A receipt is sent once the bill is fully paid and confirmed.');
    }
    const [settings, lines, payments, table] = await Promise.all([
      settingsFor(this.db, outlet),
      this.db
        .select({ name: posOrderLines.nameSnapshot, quantity: posOrderLines.quantity, totalRwf: posOrderLines.totalRwf, status: posOrderLines.status })
        .from(posOrderLines)
        .where(eq(posOrderLines.orderId, order.id))
        .orderBy(asc(posOrderLines.createdAt), asc(posOrderLines.id)),
      this.db
        .select({ method: posPayments.method, amountRwf: posPayments.amountRwf, reference: posPayments.demoReference, status: posPayments.status })
        .from(posPayments)
        .where(eq(posPayments.orderId, order.id))
        .orderBy(asc(posPayments.createdAt)),
      order.tableSessionId
        ? this.db
            .select({ label: restaurantTables.label })
            .from(tableSessions)
            .innerJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
            .where(eq(tableSessions.id, order.tableSessionId))
            .limit(1)
        : Promise.resolve([]),
    ]);
    const mail = receiptMail({
      venueName: outlet.name,
      venueTin: settings.venueTin,
      venuePhone: settings.venuePhone,
      venueAddress: settings.venueAddress,
      footer: settings.receiptFooter,
      orderNumber: order.orderNumber,
      tableLabel: table[0]?.label ?? null,
      orderType: order.orderType,
      at: order.settledAt ?? new Date(),
      lines: lines.filter((l) => l.status !== 'voided' && l.status !== 'draft'),
      taxMode: order.taxMode,
      grossRwf: order.grossRwf,
      discountRwf: order.discountRwf,
      taxRwf: order.taxRwf,
      totalRwf: order.totalRwf,
      payments: payments.filter((p) => p.status === 'successful' || p.status === 'refunded'),
    });
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to: body.email, ...mail }),
        new Promise<never>((_r, reject) => {
          timer = setTimeout(() => reject(new Error('mail transport did not respond in time')), PosMobilePaymentService.SEND_TIMEOUT_MS);
        }),
      ]);
    } catch (cause) {
      this.logger.error(`Receipt ${order.orderNumber} was not mailed: ${cause instanceof Error ? cause.message : 'mail failed'}.`);
      throw new ServiceUnavailableException('The receipt email could not be sent. Print it instead, or try again.');
    } finally {
      if (timer) clearTimeout(timer);
    }
    const to = maskEmail(body.email);
    await this.db.transaction(async (tx) =>
      audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: 'receipt.emailed',
        entityType: 'pos_order',
        entityId: order.id,
        after: { orderNumber: order.orderNumber, to },
      }),
    );
    return { sent: true, to };
  }
}
