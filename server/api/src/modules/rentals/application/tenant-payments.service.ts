import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AllocationError,
  GATEWAY_PROMPT_MINUTES,
  allocatePayment,
  kigaliToday,
  maxGatewayPaymentRwf,
  momoNetworkOf,
  nationalMsisdn,
  normalizeMomoNumber,
  outstandingRwf,
  type TenantChargeList,
  type TenantPayRequest,
  type TenantPaymentList,
  type TenantPaymentView,
} from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  maskDestination,
  type PaymentPort,
} from '../../pay/domain/payment-port';
import { leaseStateConflict } from '../domain/residence';
import { LeasePaymentsRepository, type PaymentRow } from '../infrastructure/lease-payments.repository';
import { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import { PaymentReceiptsService } from './payment-receipts.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { presentCharge, presentTenantPayment } from './rent-presenters';
import { TenanciesService, type TenancyRef } from './tenancies.service';

/** The lease statuses a tenant may pay on: signed (the deposit before moving in), active, ending. */
const PAYABLE: readonly string[] = ['signed', 'active', 'ending'];

/** The delayed look at a new prompt: a little after the mock customer approves (6 s by default). */
const FIRST_LOOK_MS = 8_000;

/**
 * The tenant paying through Injishi (blueprint 2.4; WP 1.6b): what they owe,
 * a payment by MTN MoMo or Airtel Money, polling it, their history and the
 * receipt PDF.
 *
 * The pending payment is written before the provider is asked, so a prompt on
 * a phone is on record; the money lands on the charges only when the provider
 * says it settled (`PaymentSettlementService`). One prompt at a time per
 * lease; a retried press with the same key answers the first payment.
 */
@Injectable()
export class TenantPaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenancies: TenanciesService,
    private readonly payments: LeasePaymentsRepository,
    private readonly settlement: PaymentSettlementService,
    private readonly receipts: PaymentReceiptsService,
    private readonly queue: RentalsMoneyQueue,
    @Inject(PAYMENT_PORT) private readonly port: PaymentPort,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async charges(ref: TenancyRef): Promise<TenantChargeList> {
    const record = await this.tenancies.record(ref);
    const today = kigaliToday(this.now());
    const [charges, credits, pending] = await Promise.all([
      this.payments.chargesOf(ref.leaseId),
      this.payments.credits(ref.leaseId),
      this.payments.pendingForLease(ref.leaseId),
    ]);
    const views = charges.map((c) => presentCharge(c, record.lease.graceDays, today));
    const outstanding = views.reduce((s, c) => s + c.outstandingRwf, 0);
    return {
      charges: views,
      outstandingRwf: outstanding,
      overdueRwf: views.filter((c) => c.overdue).reduce((s, c) => s + c.outstandingRwf, 0),
      creditRwf: credits.reduce((s, c) => s + c.amountRwf, 0),
      pendingPaymentId: pending?.id ?? null,
      maxPaymentRwf: PAYABLE.includes(record.lease.status) ? maxGatewayPaymentRwf(outstanding, record.lease.monthlyRentRwf) : 0,
    };
  }

  async list(ref: TenancyRef): Promise<TenantPaymentList> {
    await this.tenancies.record(ref);
    const rows = await this.payments.forLease(ref.leaseId);
    const records = await this.payments.records(rows);
    return { payments: records.map(presentTenantPayment) };
  }

  /** Pay by mobile money. The answer is the payment to poll. */
  async pay(ref: TenancyRef, user: { id: string }, clientKey: string, body: TenantPayRequest): Promise<TenantPaymentView> {
    const key = `${ref.workspaceId}:rent-collect:${clientKey}`;
    const replay = await this.payments.findByKey(key);
    if (replay) {
      if (replay.leaseId !== ref.leaseId) throw new ConflictException({ code: 'idempotency_key_reused', message: 'That key was used for another payment. Send a new one.' });
      return this.present(await this.settlement.resolve(replay, this.now()));
    }
    const record = await this.tenancies.record(ref);
    const { lease } = record;
    if (!PAYABLE.includes(lease.status)) {
      throw leaseStateConflict(lease.status, lease.status === 'pending_signature' || lease.status === 'draft' ? 'Both sides sign before anything is paid.' : 'Nothing can be paid on it.');
    }
    const msisdn = normalizeMomoNumber(body.msisdn);
    if (!msisdn) throw new BadRequestException({ message: 'Enter a Rwandan mobile number, like 0788 123 456.', path: ['msisdn'] });
    const network = momoNetworkOf(msisdn);
    const wanted = body.method === 'mtn_momo' ? 'mtn' : 'airtel';
    if (network !== wanted) {
      throw new BadRequestException({ message: body.method === 'mtn_momo' ? 'MTN numbers start 078 or 079.' : 'Airtel numbers start 072 or 073.', path: ['msisdn'] });
    }
    const pending = await this.payments.pendingForLease(ref.leaseId);
    if (pending) {
      const fresh = await this.settlement.resolve(pending, this.now());
      if (fresh.status === 'pending') {
        throw new ConflictException({ code: 'payment_pending', paymentId: fresh.id, message: 'A payment is waiting on your phone. Approve or decline it first.' });
      }
    }
    const charges = await this.payments.chargesOf(ref.leaseId);
    const open = charges.filter((c) => c.status === 'open');
    const chosen = body.chargeIds ? open.filter((c) => body.chargeIds?.includes(c.id)) : open;
    if (body.chargeIds && chosen.length !== new Set(body.chargeIds).size) throw new NotFoundException('One of the charges is not open on this lease.');
    const owed = chosen.reduce((s, c) => s + outstandingRwf(c), 0);
    if (owed <= 0) throw new ConflictException({ code: 'nothing_owed', message: 'Nothing is owed right now.' });
    const amountRwf = body.amountRwf ?? owed;
    const max = maxGatewayPaymentRwf(owed, lease.monthlyRentRwf);
    if (amountRwf > max) {
      throw new BadRequestException({ message: `You can pay up to RWF ${max.toLocaleString('en-US')}: what is owed plus one month ahead.`, path: ['amountRwf'] });
    }
    // Only to refuse early what allocation would refuse at settlement.
    try {
      allocatePayment(amountRwf, chosen.map((c) => ({ id: c.id, dueOn: c.dueOn, amountRwf: c.amountRwf, paidRwf: c.paidRwf, status: c.status, periodStart: c.periodStart, kind: c.kind })), body.chargeIds ? { chargeIds: body.chargeIds } : {});
    } catch (cause) {
      if (cause instanceof AllocationError) throw new ConflictException({ code: cause.code, message: cause.message });
      throw cause;
    }

    const now = this.now();
    const row = await this.payments.insert(this.db, {
      workspaceId: ref.workspaceId,
      propertyId: lease.propertyId,
      leaseId: lease.id,
      tenantId: ref.tenantId,
      channel: 'gateway',
      method: body.method,
      amountRwf,
      status: 'pending',
      payerUserId: user.id,
      payerMasked: maskDestination(nationalMsisdn(msisdn)),
      adapterMode: this.port.mode,
      expiresAt: new Date(now.getTime() + GATEWAY_PROMPT_MINUTES * 60_000),
      idempotencyKey: key,
      requestedChargeIds: body.chargeIds ?? null,
    });

    try {
      const receipt = await this.port.collectRent({
        kind: 'rent_collect',
        idempotencyKey: `${ref.workspaceId}:rent-collect:${row.id}`,
        amountRwf,
        currency: 'RWF',
        workspaceId: ref.workspaceId,
        memo: `Lease ${lease.reference}, unit ${record.unitLabel}`,
        instrument: { kind: 'mobile_money', network: body.method, msisdn: nationalMsisdn(msisdn) },
        leaseRef: lease.id,
        paymentRef: row.id,
      });
      await this.payments.update(this.db, row.id, { adapterRef: receipt.adapterRef });
      if (receipt.settlement === 'settled') {
        await this.settlement.settle(row.id, this.now());
      } else {
        await this.queue.settleLater(row.id, FIRST_LOOK_MS);
        await this.queue.settleLater(row.id, GATEWAY_PROMPT_MINUTES * 60_000 + 2_000);
      }
    } catch (cause) {
      if (cause instanceof PaymentDeclinedError) {
        await this.settlement.fail(row.id, `The payment was declined: ${cause.reason}. Nothing was taken.`, this.now());
      } else if (cause instanceof PaymentUnavailableError) {
        await this.settlement.fail(row.id, 'The payment service did not answer. Nothing was taken. Try again in a moment.', this.now());
      } else {
        throw cause;
      }
    }
    const fresh = await this.payments.find(row.id);
    if (!fresh) throw new NotFoundException('We could not find that payment.');
    return this.present(fresh);
  }

  /** Where one payment stands, asking the provider again if it is waiting. */
  async poll(ref: TenancyRef, paymentId: string): Promise<TenantPaymentView> {
    const row = await this.owned(ref, paymentId);
    return this.present(await this.settlement.resolve(row, this.now()));
  }

  /** The receipt PDF of a succeeded payment. */
  async receipt(ref: TenancyRef, paymentId: string): Promise<{ body: Buffer; filename: string }> {
    const row = await this.owned(ref, paymentId);
    if (row.status !== 'succeeded') throw new NotFoundException('There is no receipt for this payment yet.');
    const { body, filename } = await this.receipts.pdf(row.id);
    return { body, filename };
  }

  private async owned(ref: TenancyRef, paymentId: string): Promise<PaymentRow> {
    await this.tenancies.record(ref);
    const row = await this.payments.find(paymentId);
    if (!row || row.leaseId !== ref.leaseId) throw new NotFoundException('We could not find that payment.');
    return row;
  }

  private async present(row: PaymentRow): Promise<TenantPaymentView> {
    const record = await this.payments.record(row.id);
    if (!record) throw new NotFoundException('We could not find that payment.');
    return presentTenantPayment(record);
  }
}
