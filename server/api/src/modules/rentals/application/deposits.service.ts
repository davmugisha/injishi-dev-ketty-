import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  GATEWAY_PROMPT_MINUTES,
  MOMO_NETWORK_LABEL,
  keptOf,
  kigaliToday,
  maskPayoutRef,
  momoNetworkOf,
  nationalMsisdn,
  nationalPhone,
  pastDateProblem,
  settlementProblem,
  type DepositList,
  type DepositView,
  type DisputeDepositRequest,
  type SettleDepositRequest,
} from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { PAYMENT_PORT, PaymentDeclinedError, PaymentUnavailableError, type CallbackEvent, type PaymentPort } from '../../pay/domain/payment-port';
import { depositDisputedLandlordMail, depositRefundFailedLandlordMail, depositSettledTenantMail } from '../domain/move-out-mail';
import { assertBuildingInScope, assertResidence, buildingFilter } from '../domain/residence';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { MoveOutsRepository, type DepositRow } from '../infrastructure/move-outs.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import { LeaseEventsWriter, RentalsAuditWriter, type Tx } from '../infrastructure/rentals-writers';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SigningRepository } from '../infrastructure/signing.repository';
import { presentDeposit } from './move-outs-presenters';
import type { TenancyRef } from './tenancies.service';

export const DEPOSIT_NOT_FOUND = 'Deposit not found.';

/** How long the prompt on the landlord's phone is waited for. */
const PROMPT_MS = GATEWAY_PROMPT_MINUTES * 60_000;
/** The first look after the prompt goes out: the mock approves in a few seconds. */
const FIRST_LOOK_MS = 8_000;

export const REFUND_EXPIRED_REASON = 'The prompt on your phone expired before it was approved. Nothing was taken.';

/** Why the rest of a deposit charge is let go at settlement. */
const SETTLED_CHARGE_REASON = 'The deposit was settled at move out.';

/**
 * Settling the deposit the landlord holds (blueprint 1.2 "lease_deposits",
 * 2.3; WP 1.7), and the tenant's dispute.
 *
 * At move out the landlord splits what the tenant paid on the deposit into
 * what is kept (deductions, each a label and an amount) and what goes back;
 * kept plus refunded must equal what was paid. The refund goes back:
 *
 *   - through Injishi: a prompt on the landlord's own phone (`vendor_payout`,
 *     keyed `<workspace>:deposit-refund:<Idempotency-Key>`), then the money to
 *     the tenant's MoMo. The deposit waits (held, the payout `queued`) until
 *     PaymentSettlement settles it (the minute sweep, a delayed look, or a
 *     callback): then it is settled and the tenant gets the breakdown. A
 *     refused transfer or a prompt left 10 minutes fails the payout with the
 *     reason, nothing moved, and the landlord can settle again;
 *   - recorded: paid outside Injishi, with the day and a reference;
 *   - none: nothing goes back.
 *
 * Rent never moves here: this is the landlord's own money going back.
 */
@Injectable()
export class DepositsService {
  private readonly log = new Logger(DepositsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly moveOuts: MoveOutsRepository,
    private readonly context: RentalsContextRepository,
    private readonly signing: SigningRepository,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
    private readonly mailer: RentalsMailer,
    private readonly queue: RentalsMoneyQueue,
    @Inject(PAYMENT_PORT) private readonly port: PaymentPort,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  /** `GET /ops/deposits`: every deposit of the business with its lease. */
  async list(ws: ScopedWorkspace): Promise<DepositList> {
    const r = assertResidence(ws);
    const rows = await this.moveOuts.deposits(r.workspaceId, buildingFilter(sql`l.property_id`, ws.branchScope));
    return {
      items: rows.map(({ deposit, lease }) => ({
        ...presentDeposit(deposit),
        reference: lease.reference,
        tenantName: lease.tenantName,
        unitLabel: lease.unitLabel,
        propertyName: lease.propertyName,
        leaseStatus: lease.status,
        endedOn: lease.endedOn,
      })),
    };
  }

  /** One deposit; a refund on the landlord's phone is asked about first, so the panel moves on once approved. */
  async detail(ws: ScopedWorkspace, id: string): Promise<DepositView> {
    const { deposit } = await this.owned(ws, id);
    if (deposit.refundPayoutId && deposit.payoutStatus === 'queued') {
      await this.resolve(deposit.refundPayoutId).catch((cause: unknown) => this.log.warn(`deposit ${id}: ${String(cause)}`));
    }
    return this.view(id);
  }

  /** Settle the deposit. A second press with the same key answers the deposit as it stands. */
  async settle(ws: ScopedWorkspace, userId: string, id: string, body: SettleDepositRequest, clientKey: string): Promise<DepositView> {
    const { deposit, record } = await this.owned(ws, id);
    const settleKey = `${deposit.workspaceId}:deposit-settle:${clientKey}`;
    if (deposit.idempotencyKey === settleKey) return this.detail(ws, id);
    if (deposit.status === 'settled') {
      throw new ConflictException({ code: 'deposit_settled', message: 'This deposit is already settled.' });
    }
    if (record.lease.status !== 'ended') {
      throw new ConflictException({ code: 'not_moved_out', message: 'Record the move out before you settle the deposit.' });
    }
    if (deposit.refundPayoutId && deposit.payoutStatus === 'queued') {
      await this.resolve(deposit.refundPayoutId);
      const fresh = await this.moveOuts.deposit(id);
      if (fresh?.status === 'settled') return presentDeposit(fresh);
      if (fresh?.payoutStatus === 'queued') {
        throw new ConflictException({ code: 'payment_pending', message: 'A refund is waiting on your phone. Approve or decline it first.' });
      }
    }
    const problem = settlementProblem({
      paidRwf: deposit.paidRwf,
      deductions: body.deductions,
      refundedRwf: body.refundedRwf,
      method: body.refund.method,
    });
    if (problem) throw new BadRequestException({ message: problem, issues: [{ path: ['refundedRwf'], message: problem }] });
    const keptRwf = keptOf(body.deductions);
    const refund = body.refund;
    let destinationMasked: string | null = null;
    let payerNetwork: 'mtn' | 'airtel' | null = null;
    if (refund.method === 'gateway') {
      const tenantNetwork = momoNetworkOf(refund.tenantPhone);
      if (!tenantNetwork) {
        throw new BadRequestException({
          message: "Enter the tenant's MTN or Airtel number.",
          issues: [{ path: ['refund', 'tenantPhone'], message: "Enter the tenant's MTN or Airtel number." }],
        });
      }
      payerNetwork = momoNetworkOf(refund.payerPhone);
      if (!payerNetwork) {
        throw new BadRequestException({
          message: 'Enter your MTN or Airtel number, like 0788 123 456.',
          issues: [{ path: ['refund', 'payerPhone'], message: 'Enter your MTN or Airtel number, like 0788 123 456.' }],
        });
      }
      destinationMasked = `${MOMO_NETWORK_LABEL[tenantNetwork]} ${maskPayoutRef(nationalPhone(refund.tenantPhone))}`;
    }
    if (refund.method === 'recorded') {
      const dayProblem = pastDateProblem(refund.paidOn, {
        today: kigaliToday(this.now()),
        notBefore: record.lease.endedOn,
        notBeforeLabel: 'Pick a day from the move out on.',
      });
      if (dayProblem) throw new BadRequestException({ message: dayProblem, issues: [{ path: ['refund', 'paidOn'], message: dayProblem }] });
    }

    const payoutKey = `${deposit.workspaceId}:deposit-refund:${clientKey}`;
    const claimed = await this.db.transaction(async (tx) => {
      const locked = await this.moveOuts.deposit(id, tx, true);
      if (!locked) throw new NotFoundException(DEPOSIT_NOT_FOUND);
      if (locked.status === 'settled') throw new ConflictException({ code: 'deposit_settled', message: 'This deposit is already settled.' });
      if (locked.paidRwf !== deposit.paidRwf) {
        throw new ConflictException({ code: 'deposit_changed', message: 'The deposit changed while you were settling it. Open it again.' });
      }
      const common = {
        keptRwf,
        refundedRwf: body.refundedRwf,
        deductions: body.deductions.map((d) => ({ label: d.label, amountRwf: d.amountRwf })),
        idempotencyKey: settleKey,
      };
      if (refund.method === 'gateway') {
        const payoutId = await this.moveOuts.claimRefundPayout(tx, {
          workspaceId: deposit.workspaceId,
          amountRwf: body.refundedRwf,
          payeeName: record.tenant.fullName,
          destinationMasked: destinationMasked ?? 'MoMo',
          idempotencyKey: payoutKey,
          createdByUserId: userId,
          note: body.note ?? null,
        });
        await this.moveOuts.updateDeposit(tx, id, { ...common, refundMethod: 'gateway', refundPayoutId: payoutId, refundReference: null });
        await this.audit.write(tx, {
          actorUserId: userId,
          subjectType: 'deposit',
          subjectId: id,
          eventType: 'deposit.refund_sent',
          diff: { leaseId: deposit.leaseId, payoutId, paidRwf: deposit.paidRwf, keptRwf, refundedRwf: body.refundedRwf, destination: destinationMasked },
          reason: body.note ?? null,
        });
        return payoutId;
      }
      const now = this.now();
      await this.closeCharge(tx, deposit);
      await this.moveOuts.updateDeposit(tx, id, {
        ...common,
        status: 'settled',
        refundMethod: refund.method,
        refundPayoutId: null,
        refundReference: refund.method === 'recorded' ? (refund.reference ?? null) : null,
        settledAt: now,
        settledByUserId: userId,
      });
      await this.writeSettled(tx, deposit, userId, { keptRwf, refundedRwf: body.refundedRwf, method: refund.method, note: body.note ?? null });
      return null;
    });

    if (claimed && payerNetwork && refund.method === 'gateway') {
      try {
        const receipt = await this.port.payVendor({
          kind: 'vendor_payout',
          idempotencyKey: payoutKey,
          amountRwf: body.refundedRwf,
          currency: 'RWF',
          workspaceId: deposit.workspaceId,
          memo: `Deposit refund ${record.lease.reference}`.slice(0, 120),
          instrument: { kind: 'mobile_money', network: payerNetwork === 'mtn' ? 'mtn_momo' : 'airtel_money', msisdn: nationalMsisdn(refund.payerPhone) },
          destination: 'momo',
          destinationRef: refund.tenantPhone,
          subjectRef: id,
        });
        await this.moveOuts.updatePayout(this.db, claimed, { adapterRef: receipt.adapterRef });
        if (receipt.settlement === 'settled') {
          await this.completeRefund(claimed);
        } else {
          await this.queue.settleVendorPayoutLater(claimed, FIRST_LOOK_MS);
          await this.queue.settleVendorPayoutLater(claimed, PROMPT_MS + 2_000);
        }
      } catch (cause) {
        if (cause instanceof PaymentDeclinedError) {
          await this.failRefund(claimed, `The refund was declined: ${cause.reason}. Nothing was taken.`);
        } else if (cause instanceof PaymentUnavailableError) {
          await this.failRefund(claimed, 'The payment service did not answer. Nothing was taken. Try again.');
        } else {
          throw cause;
        }
      }
    } else {
      void this.mailSettled(id);
    }
    return this.view(id);
  }

  /** The tenant does not agree with the settlement. Once. */
  async dispute(tenancy: TenancyRef, body: DisputeDepositRequest): Promise<void> {
    const deposit = await this.moveOuts.depositOfLease(tenancy.leaseId);
    if (!deposit) throw new NotFoundException('There is no deposit on this lease.');
    if (deposit.status !== 'settled') {
      throw new ConflictException({ code: 'deposit_not_settled', message: 'Your deposit is not settled yet.' });
    }
    if (deposit.tenantDisputedAt) {
      throw new ConflictException({ code: 'already_disputed', message: 'You already said you do not agree. Talk it through in Messages.' });
    }
    await this.db.transaction(async (tx) => {
      await this.moveOuts.updateDeposit(tx, deposit.id, { tenantDisputedAt: this.now(), disputeNote: body.note });
      await this.events.write(tx, {
        leaseId: deposit.leaseId,
        workspaceId: deposit.workspaceId,
        kind: 'deposit_disputed',
        actorUserId: tenancy.userId,
        actorRole: 'tenant',
        visibleToTenant: true,
        payload: { depositId: deposit.id },
      });
      await this.audit.write(tx, {
        actorUserId: tenancy.userId,
        subjectType: 'deposit',
        subjectId: deposit.id,
        eventType: 'deposit.disputed',
        diff: { leaseId: deposit.leaseId, keptRwf: deposit.keptRwf, refundedRwf: deposit.refundedRwf },
        reason: body.note,
      });
    });
    const record = await this.leases.find(deposit.leaseId);
    if (record) {
      try {
        const to = await this.landlordAddress(record);
        if (to) {
          await this.mailer.send(
            `deposit ${deposit.id} disputed`,
            to,
            depositDisputedLandlordMail({
              appUrl: this.mailer.appUrl,
              tenantName: record.tenant.fullName,
              reference: record.lease.reference,
              home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
              note: body.note,
            }),
          );
        }
      } catch (cause) {
        this.log.error(`"deposit disputed" email for ${deposit.id} failed: ${String(cause)}`);
      }
    }
  }

  // --- Settling a refund through Injishi (PaymentSettlement) -----------------------------

  /** The minute sweep: every deposit refund still waiting on a phone. */
  async sweep(): Promise<{ paid: number; failed: number; waiting: number }> {
    const out = { paid: 0, failed: 0, waiting: 0 };
    for (const payoutId of await this.moveOuts.waitingRefunds()) {
      const status = await this.resolve(payoutId).catch((cause: unknown) => (this.log.error(`deposit refund ${payoutId}: ${String(cause)}`), 'queued' as const));
      if (status === 'paid') out.paid += 1;
      else if (status === 'failed') out.failed += 1;
      else out.waiting += 1;
    }
    if (out.paid || out.failed) this.log.log(`Deposit refunds: paid ${out.paid}, failed ${out.failed}, waiting ${out.waiting}.`);
    return out;
  }

  /** The delayed look at one refund. Null when the payout is not a deposit refund. */
  async sweepOne(payoutId: string): Promise<string | null> {
    if (!(await this.moveOuts.refundPayout(payoutId))) return null;
    return this.resolve(payoutId);
  }

  /** A provider's callback about a deposit refund. Anything else is not ours. */
  async handleCallback(event: CallbackEvent): Promise<'settled' | 'failed' | 'ignored'> {
    const payoutId = await this.moveOuts.refundByAdapterRef(event.adapterRef);
    if (!payoutId) return 'ignored';
    const row = await this.moveOuts.refundPayout(payoutId);
    if (!row || row.status !== 'queued') return 'ignored';
    if (event.amountRwf !== undefined && event.amountRwf !== row.amountRwf) {
      this.log.error(`callback ${event.provider}/${event.eventId} names ${event.amountRwf} RWF for deposit refund ${payoutId} of ${row.amountRwf} RWF; ignored`);
      return 'ignored';
    }
    if (event.outcome === 'settled') {
      await this.completeRefund(payoutId);
      return 'settled';
    }
    await this.failRefund(payoutId, event.reason ? `The refund did not go through: ${event.reason}. Nothing was taken.` : 'The refund did not go through. Nothing was taken.');
    return 'failed';
  }

  /** Where a waiting refund stands now: ask the provider, settle it, or expire a prompt left too long. */
  private async resolve(payoutId: string): Promise<string> {
    const row = await this.moveOuts.refundPayout(payoutId);
    if (!row) return 'gone';
    if (row.status !== 'queued') return row.status;
    if (row.adapterRef) {
      const receipt = await this.port.fetchTransaction(row.workspaceId, row.adapterRef).catch((cause: unknown) => {
        this.log.warn(`deposit refund ${payoutId}: the provider did not answer: ${String(cause)}`);
        return null;
      });
      if (receipt?.settlement === 'settled') {
        await this.completeRefund(payoutId);
        return 'paid';
      }
    }
    if (this.now().getTime() - row.createdAt.getTime() > PROMPT_MS) {
      await this.failRefund(payoutId, REFUND_EXPIRED_REASON);
      return 'failed';
    }
    return 'queued';
  }

  /** The tenant has the money: the payout is paid and the deposit settled, in one transaction; then the tenant is emailed. */
  async completeRefund(payoutId: string): Promise<boolean> {
    const depositId = await this.db.transaction(async (tx) => {
      const p = await this.moveOuts.refundPayout(payoutId, tx, true);
      if (!p || p.status !== 'queued') return null;
      const deposit = await this.moveOuts.deposit(p.depositId, tx, true);
      if (!deposit) return null;
      await this.moveOuts.updatePayout(tx, payoutId, { status: 'paid', settled: true, failureReason: null });
      await this.closeCharge(tx, deposit);
      await this.moveOuts.updateDeposit(tx, deposit.id, { status: 'settled', settledAt: this.now(), settledByUserId: p.createdByUserId });
      await this.writeSettled(tx, deposit, p.createdByUserId, {
        keptRwf: deposit.keptRwf ?? 0,
        refundedRwf: deposit.refundedRwf ?? p.amountRwf,
        method: 'gateway',
        note: null,
        payoutId,
      });
      return deposit.id;
    });
    if (!depositId) return false;
    void this.mailSettled(depositId);
    return true;
  }

  /** Nothing moved: the payout is closed with the reason, the deposit stays held, and the landlord is told. */
  async failRefund(payoutId: string, reason: string): Promise<boolean> {
    const done = await this.db.transaction(async (tx) => {
      const p = await this.moveOuts.refundPayout(payoutId, tx, true);
      if (!p || p.status !== 'queued') return null;
      await this.moveOuts.updatePayout(tx, payoutId, { status: 'failed', failureReason: reason });
      await this.audit.write(tx, {
        actorUserId: null,
        subjectType: 'deposit',
        subjectId: p.depositId,
        eventType: 'deposit.refund_failed',
        diff: { leaseId: p.leaseId, payoutId, amountRwf: p.amountRwf },
        reason,
      });
      return p;
    });
    if (!done) return false;
    try {
      const record = await this.leases.find(done.leaseId);
      const to = record ? await this.payerAddress(done.createdByUserId, record) : null;
      if (record && to) {
        await this.mailer.send(
          `deposit refund ${payoutId} failed`,
          to,
          depositRefundFailedLandlordMail({
            appUrl: this.mailer.appUrl,
            tenantName: record.tenant.fullName,
            reference: record.lease.reference,
            amountRwf: done.amountRwf,
            reason,
          }),
        );
      }
    } catch (cause) {
      this.log.error(`"deposit refund failed" email for ${payoutId} failed: ${String(cause)}`);
    }
    return true;
  }

  // --- Helpers -----------------------------------------------------------------------

  /** What was not paid on the deposit charge is let go: the settlement splits only what was paid. */
  private async closeCharge(tx: Tx, deposit: DepositRow): Promise<void> {
    if (deposit.chargeStatus !== 'open') return;
    await tx.execute(sql`
      update lease_charges set status = 'waived', waived_reason = ${SETTLED_CHARGE_REASON}, updated_at = now()
       where id = ${deposit.chargeId} and status = 'open'
    `);
  }

  private async writeSettled(
    tx: Tx,
    deposit: DepositRow,
    userId: string | null,
    s: { keptRwf: number; refundedRwf: number; method: 'gateway' | 'recorded' | 'none'; note: string | null; payoutId?: string },
  ): Promise<void> {
    await this.events.write(tx, {
      leaseId: deposit.leaseId,
      workspaceId: deposit.workspaceId,
      kind: 'deposit_settled',
      actorUserId: userId,
      actorRole: userId ? 'landlord' : 'system',
      visibleToTenant: true,
      payload: { depositId: deposit.id, paidRwf: deposit.paidRwf, keptRwf: s.keptRwf, refundedRwf: s.refundedRwf, method: s.method },
    });
    await this.audit.write(tx, {
      actorUserId: userId,
      subjectType: 'deposit',
      subjectId: deposit.id,
      eventType: 'deposit.settled',
      diff: {
        leaseId: deposit.leaseId,
        paidRwf: deposit.paidRwf,
        keptRwf: s.keptRwf,
        refundedRwf: s.refundedRwf,
        method: s.method,
        payoutId: s.payoutId ?? null,
      },
      reason: s.note,
    });
  }

  private async view(id: string): Promise<DepositView> {
    const row = await this.moveOuts.deposit(id);
    if (!row) throw new NotFoundException(DEPOSIT_NOT_FOUND);
    return presentDeposit(row);
  }

  private async owned(ws: ScopedWorkspace, id: string): Promise<{ deposit: DepositRow; record: LeaseRecord }> {
    const r = assertResidence(ws);
    const deposit = await this.moveOuts.deposit(id);
    if (!deposit || deposit.workspaceId !== r.workspaceId) throw new NotFoundException(DEPOSIT_NOT_FOUND);
    const record = await this.leases.find(deposit.leaseId);
    if (!record) throw new NotFoundException(DEPOSIT_NOT_FOUND);
    assertBuildingInScope(ws, record.lease.propertyId, 'Deposit');
    return { deposit, record };
  }

  /** The tenant gets the breakdown. Never throws. */
  private async mailSettled(depositId: string): Promise<void> {
    try {
      const d = await this.moveOuts.deposit(depositId);
      if (!d || d.status !== 'settled') return;
      const record = await this.leases.find(d.leaseId);
      if (!record) return;
      const to = record.tenant.userId ? ((await this.signing.accountEmail(record.tenant.userId)) ?? record.tenant.email) : record.tenant.email;
      if (!to) return;
      const org = await this.context.org(record.lease.orgId);
      await this.mailer.send(
        `deposit ${depositId} settled`,
        to,
        depositSettledTenantMail({
          appUrl: this.mailer.appUrl,
          leaseId: d.leaseId,
          tenantName: record.tenant.fullName,
          landlordName: org.legalName,
          home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
          paidRwf: d.paidRwf,
          deductions: presentDeposit(d).deductions,
          keptRwf: d.keptRwf ?? 0,
          refundedRwf: d.refundedRwf ?? 0,
          refund: { method: d.refundMethod ?? 'none', destination: d.payoutDestination, reference: d.refundReference },
        }),
      );
    } catch (cause) {
      this.log.error(`"deposit settled" email for ${depositId} failed: ${String(cause)}`);
    }
  }

  private async landlordAddress(record: LeaseRecord): Promise<string | null> {
    const profile = await this.context.ensureProfile({ orgId: record.lease.orgId, workspaceId: record.lease.workspaceId });
    if (profile.contactEmail) return profile.contactEmail;
    return (await this.context.ownerContact(record.lease.orgId))?.email ?? null;
  }

  /** The person who sent the refund, else the business's contact address. */
  private async payerAddress(userId: string | null, record: LeaseRecord): Promise<string | null> {
    if (userId) {
      const email = await this.signing.accountEmail(userId);
      if (email) return email;
    }
    return this.landlordAddress(record);
  }
}
