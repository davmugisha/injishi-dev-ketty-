import {
  momoNetworkOf,
  normalizeRwPhone,
  type BrokerCommission,
  type BrokerCommissionList,
  type BrokerPayoutAccount,
  type BrokerShareStatus,
  type SetBrokerPayoutAccountRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { ForbiddenException, Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  type PaymentPort,
} from '../../pay/domain/payment-port';
import { brokerCommissions, maskBrokerMomo } from '../../pms/infrastructure/broker-commission.repository';
import { BrokerDealsService } from './broker-deals.service';

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const iso = (v: unknown): string | null => (v ? new Date(String(v)).toISOString() : null);

/**
 * A broker's commission, once earned (0128): what each stay earned, what the hotel has paid of it, and the
 * broker's 85% on its way to their MoMo number.
 *
 * The commission is earned and collected at check-out, in the stay's own transaction
 * (`StayCompletionRepository`). Here, the broker's share is SENT: a `broker_commission` payout is queued once
 * its commission is fully collected, and this service pays it with the same transfer a hotel's payout uses.
 * It is not the hotels' payouts pass (`PayoutsService`), because a broker's MoMo number is not a business's
 * payout account. The hourly broker pass (`sweep`) also earns a bulk sum whose group finished without a last
 * check-out, and sends what is queued.
 */
@Injectable()
export class BrokerPayoutsService {
  private readonly log = new Logger(BrokerPayoutsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    private readonly deals: BrokerDealsService,
  ) {}

  // --- The broker's MoMo number -------------------------------------------------

  async account(ws: WorkspaceAccess): Promise<BrokerPayoutAccount | null> {
    const broker = await this.deals.brokerFor(ws);
    const found = await this.db.execute<Record<string, unknown>>(sql`
      select account_name, momo_network::text as momo_network, momo_phone from broker_payout_accounts where broker_id = ${broker.id}`);
    const r = found.rows[0];
    return r
      ? {
          accountName: String(r.account_name),
          network: r.momo_network as BrokerPayoutAccount['network'],
          phoneMasked: maskBrokerMomo(String(r.momo_network), String(r.momo_phone)),
        }
      : null;
  }

  /** Set the number; a share waiting for one (`held`) is sent to it now. */
  async setAccount(ws: WorkspaceAccess, body: SetBrokerPayoutAccountRequest): Promise<BrokerPayoutAccount> {
    const broker = await this.deals.brokerFor(ws);
    const phone = normalizeRwPhone(body.phone);
    const network = phone ? momoNetworkOf(phone) : null;
    if (!phone || !network) {
      throw new UnprocessableEntityException({
        message: 'Give an MTN or Airtel number, like 078 123 4567.',
        issues: [{ code: 'custom', path: ['phone'], message: 'Give an MTN or Airtel number, like 078 123 4567.' }],
      });
    }
    await this.db.execute(sql`
      insert into broker_payout_accounts (broker_id, account_name, momo_network, momo_phone)
      values (${broker.id}, ${body.accountName.trim()}, ${network}::momo_network, ${phone})
      on conflict (broker_id) do update
        set account_name = excluded.account_name, momo_network = excluded.momo_network,
            momo_phone = excluded.momo_phone, updated_at = now()`);
    // Shares that waited for a number, and ones the rail refused, go to the new one.
    await this.db.execute(sql`
      update payouts p
         set status = 'queued', destination = 'momo', destination_ref = ${phone},
             destination_masked = ${maskBrokerMomo(network, phone)}, payee_name = ${body.accountName.trim()},
             failure_reason = null, updated_at = now()
       where p.source = 'broker_commission' and p.status in ('held', 'failed')
         and p.workspace_id = ${ws.workspaceId}`);
    await this.sendQueued(ws.workspaceId);
    const account = await this.account(ws);
    if (!account) throw new Error('The broker payout account was written and could not be read back.');
    return account;
  }

  // --- What the broker earned ------------------------------------------------------

  async brokerCommissions(ws: WorkspaceAccess): Promise<BrokerCommissionList> {
    const broker = await this.deals.brokerFor(ws);
    return this.list(sql`c.broker_id = ${broker.id}`);
  }

  /** The hotel's side: what it owes its brokers and what it has paid (`payout.manage` on the route). */
  async hotelCommissions(ws: WorkspaceAccess): Promise<BrokerCommissionList> {
    if (ws.kind !== 'business' || !ws.orgId) throw new ForbiddenException('This is not a business workspace.');
    return this.list(sql`c.org_id = ${ws.orgId}`);
  }

  private async list(where: ReturnType<typeof sql>): Promise<BrokerCommissionList> {
    const found = await this.db.execute<Record<string, unknown>>(sql`
      select c.id, c.kind::text as kind, c.broker_id, br.name as broker_name, c.org_id,
             coalesce((select p.name from properties p join listings l on l.property_id = p.id and l.status = 'published'
                        where p.org_id = c.org_id order by p.created_at limit 1), o.legal_name) as hotel_name,
             g.reference as group_reference, b.reference as booking_reference, b.guest_name,
             c.base_rwf, c.nights_stayed, c.commission_rwf, c.injishi_rwf, c.broker_rwf, c.collected_rwf,
             c.status::text as status, c.earned_at, c.collected_at,
             po.status::text as payout_status, po.amount_rwf as payout_amount, po.destination_masked,
             po.settled_at, po.failure_reason
        from broker_commissions c
        join brokers br on br.id = c.broker_id
        join orgs o on o.id = c.org_id
        join broker_booking_groups g on g.id = c.group_id
        left join bookings b on b.id = c.booking_id
        left join payouts po on po.id = c.payout_id
       where ${where}
       order by c.earned_at desc
       limit 500`);
    const commissions: BrokerCommission[] = found.rows.map((r) => {
      const share: BrokerShareStatus = !r.payout_status
        ? 'waiting_for_hotel'
        : (String(r.payout_status) as BrokerShareStatus) === 'paid'
          ? 'paid'
          : r.payout_status === 'held'
            ? 'held'
            : r.payout_status === 'failed'
              ? 'failed'
              : 'queued';
      return {
        id: String(r.id),
        kind: r.kind as BrokerCommission['kind'],
        broker: { id: String(r.broker_id), name: str(r.broker_name) },
        hotel: { orgId: String(r.org_id), name: String(r.hotel_name) },
        groupReference: String(r.group_reference),
        bookingReference: str(r.booking_reference),
        guestName: str(r.guest_name),
        baseRwf: r.base_rwf === null ? null : num(r.base_rwf),
        nightsStayed: r.nights_stayed === null ? null : num(r.nights_stayed),
        commissionRwf: num(r.commission_rwf),
        injishiRwf: num(r.injishi_rwf),
        brokerRwf: num(r.broker_rwf),
        collectedRwf: num(r.collected_rwf),
        owedRwf: num(r.commission_rwf) - num(r.collected_rwf),
        status: r.status as BrokerCommission['status'],
        earnedAt: iso(r.earned_at) ?? new Date(0).toISOString(),
        collectedAt: iso(r.collected_at),
        share: {
          status: share,
          amountRwf: num(r.broker_rwf),
          destinationMasked: str(r.destination_masked),
          paidAt: iso(r.settled_at),
          failureReason: str(r.failure_reason),
        },
      };
    });
    return {
      commissions,
      totals: {
        owedRwf: commissions.reduce((s, c) => s + c.owedRwf, 0),
        collectedRwf: commissions.reduce((s, c) => s + c.collectedRwf, 0),
        paidToBrokerRwf: commissions.filter((c) => c.share.status === 'paid').reduce((s, c) => s + c.brokerRwf, 0),
      },
    };
  }

  // --- Sending the broker's share ------------------------------------------------------

  /**
   * The hourly pass: earn the bulk sums whose groups finished without a last check-out, make a payout for
   * every fully collected commission without one, and send what is queued. Idempotent throughout.
   */
  async sweep(now: Date = new Date()): Promise<{ earned: number; sent: number }> {
    const earned = await this.db.transaction(async (tx) => {
      const n = await brokerCommissions.earnFinishedBulk(tx, now);
      await brokerCommissions.payBrokers(tx, now);
      return n;
    });
    const sent = await this.sendQueued(null);
    if (earned || sent) this.log.log(`Broker commissions: earned ${earned} bulk, sent ${sent} share(s).`);
    return { earned, sent };
  }

  /** Send every queued broker share (of one broker workspace, or all). Answers how many were paid. */
  private async sendQueued(workspaceId: string | null): Promise<number> {
    const queued = await this.db.execute<Record<string, unknown>>(sql`
      select id from payouts
       where source = 'broker_commission' and status = 'queued'
         ${workspaceId ? sql`and workspace_id = ${workspaceId}` : sql``}
       order by created_at limit 200`);
    let paid = 0;
    for (const row of queued.rows) {
      try {
        if ((await this.send(String(row.id))) === 'paid') paid += 1;
      } catch (err) {
        // The rail did not answer: it stays queued for the next pass.
        this.log.warn(`broker payout ${String(row.id)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return paid;
  }

  /** One share, by the transfer a hotel's payout uses. A refusal is `failed`; no answer leaves it queued. */
  private async send(payoutId: string): Promise<'paid' | 'queued' | 'failed'> {
    const found = await this.db.execute<Record<string, unknown>>(sql`
      select id, workspace_id, amount_rwf, destination_ref, destination_masked, idempotency_key, note, status::text as status
        from payouts where id = ${payoutId} and source = 'broker_commission'`);
    const p = found.rows[0];
    if (!p || p.status !== 'queued' || !p.destination_ref) return 'queued';
    try {
      const receipt = await this.payments.payLandlord({
        kind: 'landlord_payout',
        idempotencyKey: String(p.idempotency_key ?? `broker-payout:${payoutId}`),
        amountRwf: num(p.amount_rwf),
        currency: 'RWF',
        workspaceId: String(p.workspace_id),
        memo: str(p.note) ?? 'Broker commission',
        destination: 'momo',
        destinationRef: String(p.destination_ref),
      });
      if (receipt.settlement === 'settled') {
        await this.db.execute(sql`
          update payouts set status = 'paid', settled_at = now(), adapter_ref = ${receipt.adapterRef},
                 failure_reason = null, updated_at = now()
           where id = ${payoutId} and status = 'queued'`);
        return 'paid';
      }
      await this.db.execute(sql`update payouts set adapter_ref = ${receipt.adapterRef}, updated_at = now() where id = ${payoutId}`);
      return 'queued';
    } catch (cause) {
      if (cause instanceof PaymentDeclinedError) {
        const reason = `The transfer to ${str(p.destination_masked) ?? 'your MoMo number'} was refused: ${cause.reason}.`;
        await this.db.execute(sql`
          update payouts set status = 'failed', failure_reason = ${reason}, updated_at = now() where id = ${payoutId}`);
        return 'failed';
      }
      if (cause instanceof PaymentUnavailableError) return 'queued';
      throw cause;
    }
  }
}
