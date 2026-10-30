import {
  EXPENSE_RECEIPT_MAX_BYTES,
  GATEWAY_PROMPT_MINUTES,
  MOMO_NETWORK_LABEL,
  faultPaymentDateProblem,
  kigaliToday,
  maskPayoutRef,
  momoNetworkOf,
  nationalMsisdn,
  nationalPhone,
  type FaultPaymentStatus,
  type FaultPaymentView,
  type PayFixerRequest,
  type RecordFaultPaymentRequest,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { TicketLifecycle } from '../../pms/application/ticket-lifecycle';
import { PAYMENT_PORT, PaymentDeclinedError, PaymentUnavailableError, type CallbackEvent, type PaymentPort } from '../../pay/domain/payment-port';
import { RentalsFilesStorage } from '../../storage/application/rentals-files-storage';
import { fixerPaidLandlordMail, fixerPaymentFailedLandlordMail } from '../domain/fault-mail';
import { ExpensesRepository } from '../infrastructure/expenses.repository';
import { FaultPayoutsRepository, type FaultPayoutRow } from '../infrastructure/fault-payouts.repository';
import { FaultsRepository, type FaultRow } from '../infrastructure/faults.repository';
import { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { FaultNotices } from './fault-notices';
import { assertFaultOwned, paidLine, reportedOn } from './faults-presenters';

/** How long the prompt on the landlord's phone is waited for. */
const PROMPT_MS = GATEWAY_PROMPT_MINUTES * 60_000;
/** The first look after the prompt goes out: the mock customer approves in a few seconds. */
const FIRST_LOOK_MS = 8_000;

export const VENDOR_EXPIRED_REASON = 'The prompt on your phone expired before it was approved. Nothing was taken.';

/** A receipt sent with a recorded payment. */
export interface ReceiptUpload {
  filename: string;
  mime: string;
  body: Buffer;
}

/**
 * Paying a fault's fixer (blueprint 2.3, 2.6, 2.7; WP 4.3).
 *
 * Through Injishi: the gateway sends a prompt to the landlord's own phone
 * (`vendor_payout`, keyed `<workspace>:vendor-payout:<Idempotency-Key>`), and
 * once they approve it the money goes on to the fixer's MoMo, Airtel Money or
 * bank account. The payout is `queued` until then. PaymentSettlement settles
 * it (the minute sweep, a delayed look queued when the prompt went out, or a
 * provider callback): one transaction marks it paid and writes the repairs
 * expense, the fault's timeline row and the audit row; then the landlord is
 * emailed. A refused transfer, a provider that did not answer, or a prompt
 * left for 10 minutes ends it `failed` with the reason, and nothing was taken.
 *
 * Recorded: the landlord paid outside Injishi (cash, a transfer) and writes it
 * down, dated from the day the fault was reported to today, with a receipt if
 * they have one. It becomes a repairs expense at once.
 */
@Injectable()
export class FaultPaymentsService {
  private readonly log = new Logger(FaultPaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly faults: FaultsRepository,
    private readonly payouts: FaultPayoutsRepository,
    private readonly expenses: ExpensesRepository,
    private readonly lifecycle: TicketLifecycle,
    private readonly files: RentalsFilesStorage,
    private readonly notices: FaultNotices,
    private readonly audit: RentalsAuditWriter,
    private readonly queue: RentalsMoneyQueue,
    @Inject(PAYMENT_PORT) private readonly port: PaymentPort,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  /** Pay the fixer through Injishi. A second press with the same key is the same payment. */
  async pay(ws: ScopedWorkspace, userId: string, ticketId: string, body: PayFixerRequest, clientKey: string): Promise<FaultPayoutRow> {
    const fault = assertFaultOwned(ws, await this.faults.find(ticketId));
    const key = `${fault.workspaceId}:vendor-payout:${clientKey}`;
    const replay = await this.payouts.byKey(key);
    if (replay) {
      if (replay.ticketId !== fault.id || replay.amountRwf !== body.amountRwf) {
        throw new ConflictException({ code: 'idempotency_conflict', message: 'That payment key was already used for a different payment. Try again.' });
      }
      return replay.status === 'queued' ? this.resolveRow(replay) : replay;
    }
    if (fault.status === 'cancelled') throw new ConflictException('This fault was cancelled, so there is nothing to pay for.');
    const waiting = await this.payouts.waitingForTicket(fault.id);
    if (waiting) {
      const fresh = await this.resolveRow(waiting);
      if (fresh.status === 'queued') {
        throw new ConflictException({ code: 'payment_pending', payoutId: fresh.payoutId, message: 'A payment is waiting on your phone. Approve or decline it first.' });
      }
    }
    const payerNetwork = momoNetworkOf(body.payerPhone);
    if (!payerNetwork) {
      throw new BadRequestException({ message: 'Enter your MTN or Airtel number, like 0788 123 456.', issues: [{ path: ['payerPhone'], message: 'Enter your MTN or Airtel number, like 0788 123 456.' }] });
    }
    const destination = body.payee.kind === 'momo' ? 'momo' : 'bank';
    const destinationRef = body.payee.kind === 'momo' ? body.payee.phone : body.payee.accountNumber;
    let destinationMasked: string;
    if (body.payee.kind === 'momo') {
      const network = momoNetworkOf(body.payee.phone);
      if (!network) {
        throw new BadRequestException({ message: "Enter the fixer's MTN or Airtel number.", issues: [{ path: ['payee', 'phone'], message: "Enter the fixer's MTN or Airtel number." }] });
      }
      destinationMasked = `${MOMO_NETWORK_LABEL[network]} ${maskPayoutRef(nationalPhone(body.payee.phone))}`;
    } else {
      destinationMasked = `${body.payee.bankName} ${maskPayoutRef(body.payee.accountNumber)}`;
    }

    const claimed = await this.db.transaction(async (tx) => {
      const row = await this.payouts.claim(tx, {
        workspaceId: fault.workspaceId,
        ticketId: fault.id,
        amountRwf: body.amountRwf,
        destination,
        destinationMasked,
        payeeName: body.payeeName,
        payerMasked: maskPayoutRef(nationalPhone(body.payerPhone)),
        payeePhone: body.payee.kind === 'momo' ? body.payee.phone : null,
        note: body.note ?? null,
        idempotencyKey: key,
        createdByUserId: userId,
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'maintenance_ticket',
        subjectId: fault.id,
        eventType: 'fault.payment_sent',
        diff: { payoutId: row.payoutId, amountRwf: body.amountRwf, payee: body.payeeName, destination: destinationMasked },
      });
      return row;
    });
    // Two presses racing: the second found the first's row, already on its way.
    if (claimed.adapterRef || claimed.status !== 'queued') return claimed;

    try {
      const receipt = await this.port.payVendor({
        kind: 'vendor_payout',
        idempotencyKey: key,
        amountRwf: body.amountRwf,
        currency: 'RWF',
        workspaceId: fault.workspaceId,
        memo: `Repair ${fault.reference ?? ''} ${fault.title}`.trim().slice(0, 120),
        instrument: { kind: 'mobile_money', network: payerNetwork === 'mtn' ? 'mtn_momo' : 'airtel_money', msisdn: nationalMsisdn(body.payerPhone) },
        destination,
        destinationRef,
        subjectRef: fault.id,
      });
      await this.payouts.update(this.db, claimed.payoutId, { adapterRef: receipt.adapterRef });
      if (receipt.settlement === 'settled') {
        await this.settle(claimed.payoutId);
      } else {
        await this.queue.settleVendorPayoutLater(claimed.payoutId, FIRST_LOOK_MS);
        await this.queue.settleVendorPayoutLater(claimed.payoutId, PROMPT_MS + 2_000);
      }
    } catch (cause) {
      if (cause instanceof PaymentDeclinedError) {
        await this.fail(claimed.payoutId, `The payment was declined: ${cause.reason}. Nothing was taken.`);
      } else if (cause instanceof PaymentUnavailableError) {
        await this.fail(claimed.payoutId, 'The payment service did not answer. Nothing was taken. Try again.');
      } else {
        throw cause;
      }
    }
    return (await this.payouts.find(claimed.payoutId)) ?? claimed;
  }

  /** Write down a payment made outside Injishi. It is a repairs expense at once. */
  async record(ws: ScopedWorkspace, userId: string, ticketId: string, body: RecordFaultPaymentRequest, receipt: ReceiptUpload | null): Promise<string> {
    const fault = assertFaultOwned(ws, await this.faults.find(ticketId));
    if (fault.status === 'cancelled') throw new ConflictException('This fault was cancelled, so there is nothing to pay for.');
    const problem = faultPaymentDateProblem(body.paidOn, reportedOn(fault), kigaliToday(this.now()));
    if (problem) throw new BadRequestException({ message: problem, issues: [{ path: ['paidOn'], message: problem }] });
    const stored = receipt
      ? await this.files.putDocument({
          kind: 'expense_receipt',
          body: receipt.body,
          mime: receipt.mime,
          filename: receipt.filename,
          maxBytes: EXPENSE_RECEIPT_MAX_BYTES,
          uploadedByUserId: userId,
          workspaceId: fault.workspaceId,
        })
      : null;
    return this.db.transaction(async (tx) => {
      await this.lifecycle.lock(tx, fault.id);
      const expenseId = await this.expenses.insert(tx, {
        orgId: fault.orgId as string,
        workspaceId: fault.workspaceId,
        propertyId: fault.propertyId,
        unitId: fault.unitId,
        ticketId: fault.id,
        category: 'repairs',
        amountRwf: body.amountRwf,
        paidOn: body.paidOn,
        method: body.method,
        payeeName: body.payeeName,
        payeePhone: body.payeePhone ?? null,
        note: body.note ?? null,
        receiptObjectId: stored?.id ?? null,
        source: 'recorded',
        payoutId: null,
        loanPurpose: null,
        createdByUserId: userId,
      });
      await this.lifecycle.event(tx, {
        ticketId: fault.id,
        kind: 'paid',
        note: `${paidLine(body.amountRwf, body.payeeName, body.paidOn)}, recorded.`,
        actorUserId: userId,
        actorRole: 'staff',
        visibleToTenant: false,
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'expense',
        subjectId: expenseId,
        eventType: 'expense.recorded',
        diff: { ticketId: fault.id, category: 'repairs', amountRwf: body.amountRwf, paidOn: body.paidOn, method: body.method, receipt: Boolean(stored) },
      });
      return expenseId;
    });
  }

  /** What was paid for a fault, as the landlord's panel lists it, and the total that counts. */
  async forFault(ticketId: string): Promise<{ payments: FaultPaymentView[]; paidRwf: number }> {
    let gateway = await this.payouts.forTicket(ticketId);
    // A prompt still on the landlord's phone is asked about on each read, so the panel moves on once it is approved.
    if (gateway.some((p) => p.status === 'queued')) {
      for (const p of gateway.filter((g) => g.status === 'queued')) await this.resolveRow(p).catch(() => p);
      gateway = await this.payouts.forTicket(ticketId);
    }
    const expenses = await this.expenses.forTicket(ticketId);
    const byPayout = new Map(expenses.filter((e) => e.payoutId).map((e) => [e.payoutId as string, e]));
    const views: FaultPaymentView[] = gateway.map((p) => {
      const expense = byPayout.get(p.payoutId);
      const status: FaultPaymentStatus = p.status === 'paid' ? 'paid' : p.status === 'failed' ? 'failed' : 'waiting';
      return {
        id: p.payoutId,
        source: 'gateway',
        status,
        amountRwf: p.amountRwf,
        payeeName: p.payeeName,
        destination: p.destinationMasked,
        method: p.destination === 'bank' ? 'bank' : 'momo',
        paidOn: expense?.paidOn ?? null,
        failureReason: p.failureReason,
        expenseId: expense?.id ?? null,
        receiptUrl: null,
        createdAt: p.createdAt.toISOString(),
      };
    });
    for (const e of expenses.filter((x) => x.source === 'recorded')) {
      views.push({
        id: e.id,
        source: 'recorded',
        status: e.voidedAt ? 'voided' : 'paid',
        amountRwf: e.amountRwf,
        payeeName: e.payeeName,
        destination: null,
        method: e.method,
        paidOn: e.paidOn,
        failureReason: e.voidReason,
        expenseId: e.id,
        receiptUrl: e.receiptObjectKey ? await this.files.signedUrl(e.receiptObjectKey) : null,
        createdAt: e.createdAt.toISOString(),
      });
    }
    views.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const paidRwf = views.filter((v) => v.status === 'paid').reduce((s, v) => s + v.amountRwf, 0);
    return { payments: views, paidRwf };
  }

  // --- Settling (PaymentSettlement) -----------------------------------------------------

  /** The minute sweep: every repair payout still waiting on a phone. */
  async sweep(now: Date = this.now()): Promise<{ paid: number; failed: number; waiting: number }> {
    let paid = 0;
    let failed = 0;
    let waiting = 0;
    for (const row of await this.payouts.waiting()) {
      const next = await this.resolveRow(row, now).catch((cause: unknown) => (this.log.error(`repair payout ${row.payoutId}: ${String(cause)}`), row));
      if (next.status === 'paid') paid += 1;
      else if (next.status === 'failed') failed += 1;
      else waiting += 1;
    }
    if (paid || failed) this.log.log(`Repair payouts: paid ${paid}, failed ${failed}, waiting ${waiting}.`);
    return { paid, failed, waiting };
  }

  /** The delayed look at one repair payout queued when its prompt went out. */
  async sweepOne(payoutId: string, now: Date = this.now()): Promise<FaultPayoutRow['status'] | null> {
    const row = await this.payouts.find(payoutId);
    if (!row) return null;
    return (await this.resolveRow(row, now)).status;
  }

  /** A provider's callback about a repair payout. Anything else is not ours. */
  async handleCallback(event: CallbackEvent, now: Date = this.now()): Promise<'settled' | 'failed' | 'ignored'> {
    const row = await this.payouts.byAdapterRef(event.adapterRef);
    if (!row || row.status !== 'queued') return 'ignored';
    if (event.amountRwf !== undefined && event.amountRwf !== row.amountRwf) {
      this.log.error(`callback ${event.provider}/${event.eventId} names ${event.amountRwf} RWF for repair payout ${row.payoutId} of ${row.amountRwf} RWF; ignored`);
      return 'ignored';
    }
    if (event.outcome === 'settled') {
      await this.settle(row.payoutId, now);
      return 'settled';
    }
    await this.fail(row.payoutId, event.reason ? `The payment did not go through: ${event.reason}. Nothing was taken.` : 'The payment did not go through. Nothing was taken.');
    return 'failed';
  }

  /** Where a waiting payout stands now: ask the provider, settle it, expire a prompt left too long. */
  private async resolveRow(row: FaultPayoutRow, now: Date = this.now()): Promise<FaultPayoutRow> {
    if (row.status !== 'queued') return row;
    if (row.adapterRef) {
      const receipt = await this.port.fetchTransaction(row.workspaceId, row.adapterRef).catch((cause: unknown) => {
        this.log.warn(`repair payout ${row.payoutId}: the provider did not answer: ${String(cause)}`);
        return null;
      });
      if (receipt?.settlement === 'settled') {
        await this.settle(row.payoutId, now);
        return (await this.payouts.find(row.payoutId)) ?? row;
      }
    }
    if (now.getTime() - row.createdAt.getTime() > PROMPT_MS) {
      await this.fail(row.payoutId, VENDOR_EXPIRED_REASON);
      return (await this.payouts.find(row.payoutId)) ?? row;
    }
    return row;
  }

  /**
   * The fixer has the money. One transaction marks the payout paid and writes
   * the repairs expense, the fault's timeline row and the audit; then the
   * landlord is emailed. Answers whether this call did the settling.
   */
  async settle(payoutId: string, now: Date = this.now()): Promise<boolean> {
    const done = await this.db.transaction(async (tx) => {
      const p = await this.payouts.find(payoutId, tx, true);
      if (!p || p.status !== 'queued') return null;
      const fault = await this.faults.find(p.ticketId, tx);
      if (!fault?.orgId) throw new NotFoundException(`fault ${p.ticketId} vanished`);
      const paidOn = kigaliToday(now);
      await this.payouts.update(tx, payoutId, { status: 'paid', settled: true, failureReason: null });
      const expenseId = await this.expenses.insert(tx, {
        orgId: fault.orgId,
        workspaceId: fault.workspaceId,
        propertyId: fault.propertyId,
        unitId: fault.unitId,
        ticketId: fault.id,
        category: 'repairs',
        amountRwf: p.amountRwf,
        paidOn,
        method: p.destination === 'bank' ? 'bank' : 'momo',
        payeeName: p.payeeName,
        payeePhone: p.payeePhone,
        note: p.note,
        receiptObjectId: null,
        source: 'gateway',
        payoutId,
        loanPurpose: null,
        createdByUserId: p.createdByUserId,
      });
      await this.lifecycle.event(tx, {
        ticketId: fault.id,
        kind: 'paid',
        note: `${paidLine(p.amountRwf, p.payeeName, paidOn)}, through Injishi.`,
        actorUserId: p.createdByUserId,
        actorRole: 'staff',
        visibleToTenant: false,
      });
      await this.audit.write(tx, {
        actorUserId: p.createdByUserId,
        subjectType: 'expense',
        subjectId: expenseId,
        eventType: 'expense.paid',
        diff: { ticketId: fault.id, payoutId, amountRwf: p.amountRwf, paidOn, destination: p.destinationMasked, source: 'gateway' },
      });
      return { p, fault, paidOn };
    });
    if (!done) return false;
    void this.mailPaid(done.p, done.fault, done.paidOn);
    return true;
  }

  /** Nothing moved: the payout is closed with the reason, and the landlord told. */
  async fail(payoutId: string, reason: string): Promise<boolean> {
    const done = await this.db.transaction(async (tx) => {
      const p = await this.payouts.find(payoutId, tx, true);
      if (!p || p.status !== 'queued') return null;
      await this.payouts.update(tx, payoutId, { status: 'failed', failureReason: reason });
      await this.audit.write(tx, {
        actorUserId: null,
        subjectType: 'maintenance_ticket',
        subjectId: p.ticketId,
        eventType: 'fault.payment_failed',
        diff: { payoutId, amountRwf: p.amountRwf },
        reason,
      });
      return p;
    });
    if (!done) return false;
    const fault = await this.faults.find(done.ticketId);
    if (fault) void this.mailFailed(done, fault, reason);
    return true;
  }

  // --- Mail -------------------------------------------------------------------------------

  /** The person who paid, else the business's contact address. */
  private async payerAddress(p: FaultPayoutRow, fault: FaultRow): Promise<string | null> {
    const found = await this.db.execute<{ email: string }>(sql`select email from users where id = ${p.createdByUserId}`);
    return found.rows[0]?.email ?? (await this.notices.landlordAddress(fault));
  }

  private async mailPaid(p: FaultPayoutRow, fault: FaultRow, paidOn: string): Promise<void> {
    const to = await this.payerAddress(p, fault).catch(() => null);
    if (!to) return;
    await this.notices.send(`repair payout ${p.payoutId} paid`, to, async () =>
      fixerPaidLandlordMail({
        appUrl: this.notices.appUrl,
        ticketId: fault.id,
        title: fault.title,
        home: { unitLabel: fault.unitLabel ?? 'the unit', propertyName: fault.propertyName ?? 'the property' },
        amountRwf: p.amountRwf,
        payeeName: p.payeeName ?? 'the fixer',
        destination: p.destinationMasked,
        paidOn,
      }),
    );
  }

  private async mailFailed(p: FaultPayoutRow, fault: FaultRow, reason: string): Promise<void> {
    const to = await this.payerAddress(p, fault).catch(() => null);
    if (!to) return;
    await this.notices.send(`repair payout ${p.payoutId} failed`, to, async () =>
      fixerPaymentFailedLandlordMail({
        appUrl: this.notices.appUrl,
        ticketId: fault.id,
        title: fault.title,
        amountRwf: p.amountRwf,
        payeeName: p.payeeName ?? 'the fixer',
        reason,
      }),
    );
  }
}
