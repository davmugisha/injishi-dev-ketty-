import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AllocationError,
  kigaliToday,
  pastDateProblem,
  type LeaseChargeView,
  type LeasePaymentView,
  type RecordLeasePaymentRequest,
  type ReverseRentPaymentRequest,
  type WaiveChargeRequest,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { StorageService } from '../../storage/application/storage.service';
import { assertBuildingInScope, assertResidence, leaseStateConflict } from '../domain/residence';
import { LeasePaymentsRepository } from '../infrastructure/lease-payments.repository';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { PaymentReceiptsService } from './payment-receipts.service';
import { presentCharge, presentPayment } from './rent-presenters';

/** The lease statuses money may be recorded on: signed (the deposit), live, or ended (a late payment). */
const PAYABLE: readonly string[] = ['signed', 'active', 'ending', 'ended'];

/**
 * Money the landlord received outside Injishi (blueprint 1.4; WP 1.6a):
 * recording it, reversing a mistake, and forgiving a charge.
 *
 * A recorded payment is written and allocated in one transaction with the
 * lease and its charges locked: oldest due first, or exactly the charges
 * named; what is left is the tenant's credit, used on the next charge raised.
 * It gets a receipt number, the tenant is emailed a receipt, and it is never
 * paid out (the landlord already holds the money). Reversing releases its
 * allocations and reopens the charges; nothing is edited or deleted.
 */
@Injectable()
export class RentPaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payments: LeasePaymentsRepository,
    private readonly leases: LeasesRepository,
    private readonly storage: StorageService,
    private readonly receipts: PaymentReceiptsService,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected today(): string {
    return kigaliToday();
  }

  async record(ws: ScopedWorkspace, userId: string, clientKey: string, body: RecordLeasePaymentRequest): Promise<LeasePaymentView> {
    const r = assertResidence(ws);
    const key = `${r.workspaceId}:rent-record:${clientKey}`;
    const replay = await this.payments.findByKey(key);
    if (replay) {
      if (replay.leaseId !== body.leaseId) throw new ConflictException({ code: 'idempotency_key_reused', message: 'That key was used for another payment. Send a new one.' });
      return this.present(replay.id);
    }
    const record = await this.owned(ws, body.leaseId);
    const { lease } = record;
    if (!PAYABLE.includes(lease.status)) {
      throw leaseStateConflict(lease.status, lease.status === 'cancelled' ? 'Nothing can be paid on it.' : 'Money is recorded once both sides have signed.');
    }
    const problem = pastDateProblem(body.receivedOn, { today: this.today(), notBefore: lease.startDate, notBeforeLabel: 'Pick a day on or after the lease started.' });
    if (problem) throw new BadRequestException({ message: problem, path: ['receivedOn'] });

    const now = new Date();
    const paymentId = await this.db
      .transaction(async (tx) => {
        await this.leases.lock(tx, lease.id);
        const receiptNumber = await this.payments.nextReceiptNumber(tx, r.workspaceId, Number(body.receivedOn.slice(0, 4)));
        const payment = await this.payments.insert(tx, {
          workspaceId: r.workspaceId,
          propertyId: lease.propertyId,
          leaseId: lease.id,
          tenantId: lease.tenantId,
          channel: 'recorded',
          method: body.method,
          amountRwf: body.amountRwf,
          status: 'succeeded',
          reference: body.reference?.trim() || null,
          receivedOn: body.receivedOn,
          recordedByUserId: userId,
          succeededAt: now,
          receiptNumber,
          idempotencyKey: key,
          requestedChargeIds: body.chargeIds ?? null,
        });
        const outcome = await this.payments.allocate(tx, {
          paymentId: payment.id,
          leaseId: lease.id,
          amountRwf: body.amountRwf,
          chargeIds: body.chargeIds ?? null,
          paidAt: now,
        });
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: r.workspaceId,
          kind: 'payment_recorded',
          actorUserId: userId,
          actorRole: 'landlord',
          visibleToTenant: true,
          payload: {
            paymentId: payment.id,
            method: body.method,
            amountRwf: body.amountRwf,
            receivedOn: body.receivedOn,
            receiptNumber,
            allocations: outcome.allocations,
            creditRwf: outcome.creditRwf,
            paidChargeIds: outcome.paidChargeIds,
            note: body.note?.trim() || null,
          },
        });
        if (outcome.depositPaid) {
          await this.events.write(tx, {
            leaseId: lease.id,
            workspaceId: r.workspaceId,
            kind: 'deposit_received',
            actorUserId: userId,
            actorRole: 'landlord',
            visibleToTenant: true,
            payload: { paymentId: payment.id, recorded: true },
          });
        }
        await this.audit.write(tx, {
          actorUserId: userId,
          subjectType: 'payment',
          subjectId: payment.id,
          eventType: 'payment.recorded',
          diff: { leaseId: lease.id, reference: lease.reference, method: body.method, amountRwf: body.amountRwf, receivedOn: body.receivedOn, receiptNumber, allocations: outcome.allocations, creditRwf: outcome.creditRwf },
          reason: body.note?.trim() || null,
        });
        return payment.id;
      })
      .catch((cause: unknown) => {
        if (cause instanceof AllocationError) {
          if (cause.code === 'unknown_charge') throw new NotFoundException('One of the charges is not on this lease.');
          throw new ConflictException({ code: cause.code, message: cause.message });
        }
        throw cause;
      });
    void this.receipts.mailTenantReceipt(paymentId);
    return this.present(paymentId);
  }

  /** Undo a recorded payment: its allocations are released and the charges reopen. The row stays, reversed. */
  async reverse(ws: ScopedWorkspace, userId: string, paymentId: string, body: ReverseRentPaymentRequest): Promise<LeasePaymentView> {
    const r = assertResidence(ws);
    const row = await this.payments.find(paymentId);
    if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException('Payment not found.');
    await this.owned(ws, row.leaseId);
    if (row.channel !== 'recorded') {
      throw new ConflictException({ code: 'payment_not_recorded', message: 'Only a payment you recorded can be reversed. A payment made on Injishi is refunded, not reversed.' });
    }
    const now = new Date();
    await this.db.transaction(async (tx) => {
      const payment = await this.payments.lock(tx, paymentId);
      if (!payment) throw new NotFoundException('Payment not found.');
      if (payment.status === 'reversed') throw new ConflictException({ code: 'payment_reversed', message: 'This payment was already reversed.' });
      if (payment.status !== 'succeeded') throw new ConflictException({ code: 'payment_state', message: 'This payment cannot be reversed.' });
      await this.leases.lock(tx, payment.leaseId);
      const released = await this.payments.release(tx, paymentId, payment.leaseId, now);
      await this.payments.update(tx, paymentId, { status: 'reversed', reversedAt: now, reversedByUserId: userId, reverseReason: body.reason });
      await this.events.write(tx, {
        leaseId: payment.leaseId,
        workspaceId: r.workspaceId,
        kind: 'payment_reversed',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: true,
        payload: { paymentId, amountRwf: payment.amountRwf, receiptNumber: payment.receiptNumber, releasedRwf: released.releasedRwf, chargeIds: released.chargeIds, reason: body.reason },
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'payment',
        subjectId: paymentId,
        eventType: 'payment.reversed',
        diff: { leaseId: payment.leaseId, amountRwf: payment.amountRwf, releasedRwf: released.releasedRwf, chargeIds: released.chargeIds },
        reason: body.reason,
      });
    });
    void this.receipts.mailTenantReversed(paymentId, body.reason);
    return this.present(paymentId);
  }

  /** Attach a photo or scan of the slip to a recorded payment (multipart). */
  async attachSlip(
    ws: ScopedWorkspace,
    userId: string,
    paymentId: string,
    file: { body: Buffer; mime: string; filename: string },
  ): Promise<LeasePaymentView> {
    const r = assertResidence(ws);
    const row = await this.payments.find(paymentId);
    if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException('Payment not found.');
    await this.owned(ws, row.leaseId);
    if (row.channel !== 'recorded') throw new ConflictException({ code: 'payment_not_recorded', message: 'A slip goes on a payment you recorded.' });
    const stored = await this.storage.putPaymentSlip({ ...file, workspaceId: r.workspaceId, uploadedByUserId: userId });
    await this.payments.update(this.db, paymentId, { receiptObjectId: stored.id });
    await this.audit.write(this.db, {
      actorUserId: userId,
      subjectType: 'payment',
      subjectId: paymentId,
      eventType: 'payment.slip_attached',
      diff: { objectId: stored.id, mime: file.mime },
    });
    return this.present(paymentId);
  }

  /** Forgive an open charge, with the reason. What was paid on it stays paid. */
  async waive(ws: ScopedWorkspace, userId: string, chargeId: string, body: WaiveChargeRequest): Promise<LeaseChargeView> {
    const r = assertResidence(ws);
    const charge = await this.payments.charge(chargeId);
    if (!charge) throw new NotFoundException('Charge not found.');
    const record = await this.owned(ws, charge.leaseId);
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await this.leases.lock(tx, charge.leaseId);
      const before = await this.payments.waive(tx, chargeId, body.reason, now);
      if (!before) throw new NotFoundException('Charge not found.');
      if (before.status !== 'open') {
        throw new ConflictException({ code: 'charge_not_open', message: before.status === 'paid' ? 'This charge is already paid.' : 'This charge was already waived.' });
      }
      await this.events.write(tx, {
        leaseId: charge.leaseId,
        workspaceId: r.workspaceId,
        kind: 'charge_waived',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: true,
        payload: { chargeId, kind: charge.kind, periodStart: charge.periodStart, dueOn: charge.dueOn, amountRwf: charge.amountRwf, paidRwf: charge.paidRwf, forgivenRwf: charge.amountRwf - charge.paidRwf, reason: body.reason },
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: charge.leaseId,
        eventType: 'charge.waived',
        diff: { chargeId, kind: charge.kind, amountRwf: charge.amountRwf, paidRwf: charge.paidRwf },
        reason: body.reason,
      });
    });
    const fresh = await this.payments.charge(chargeId);
    if (!fresh) throw new NotFoundException('Charge not found.');
    return presentCharge(fresh, record.lease.graceDays, this.today());
  }

  private async present(paymentId: string): Promise<LeasePaymentView> {
    const record = await this.payments.record(paymentId);
    if (!record) throw new NotFoundException('Payment not found.');
    const lease = await this.leases.find(record.payment.leaseId);
    if (!lease) throw new NotFoundException('Payment not found.');
    return presentPayment(record, {
      leaseReference: lease.lease.reference,
      tenantId: lease.tenant.id,
      tenantName: lease.tenant.fullName,
      unitId: lease.lease.unitId,
      unitLabel: lease.unitLabel,
      propertyName: lease.propertyName,
    });
  }

  private async owned(ws: ScopedWorkspace, leaseId: string): Promise<LeaseRecord> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    return record;
  }
}
