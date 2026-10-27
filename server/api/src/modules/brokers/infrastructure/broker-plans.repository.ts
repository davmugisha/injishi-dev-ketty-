import type { BrokerPayMethod, BrokerPlan, BrokerPlanCode, BrokerPlanStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { AdapterMode } from '../../payments/domain/payment-port';

/**
 * Broker plans, subscriptions and their payments (2026-10-23, ported 2026-10-25).
 *
 * Raw SQL like the rest of the broker's reads. Every write that moves a
 * payment is guarded on the payment still being `pending`, so a poll and the
 * sweep that both see it settle apply it once.
 */

export interface PlanRow extends BrokerPlan {
  id: string;
}

export interface BrokerHomeRow {
  districtId: number | null;
  districtName: string | null;
  provinceId: number | null;
  provinceName: string | null;
  changedAt: Date | null;
}

export interface SubscriptionRow {
  id: string;
  brokerId: string;
  planId: string;
  planCode: Exclude<BrokerPlanCode, 'district'>;
  planPriceRwf: number;
  provinceId: number | null;
  provinceName: string | null;
  scopeChangedAt: Date | null;
  status: BrokerPlanStatus;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  nextPlanCode: BrokerPlanCode | null;
  nextProvinceId: number | null;
  payMethod: BrokerPayMethod | null;
  payMsisdn: string | null;
  cardToken: string | null;
  createdAt: Date;
}

export interface PaymentRow {
  id: string;
  subscriptionId: string;
  brokerId: string;
  workspaceId: string | null;
  kind: 'start' | 'renewal';
  planCode: Exclude<BrokerPlanCode, 'district'>;
  periodStart: string;
  periodEnd: string;
  amountRwf: number;
  method: BrokerPayMethod;
  msisdnMasked: string | null;
  gatewayRef: string | null;
  checkoutUrl: string | null;
  status: 'pending' | 'paid' | 'failed';
  failureReason: string | null;
  idempotencyKey: string;
  paidAt: Date | null;
  createdAt: Date;
}

/** A due renewal, with where its broker works from and who to mail. */
export interface RenewalRow extends SubscriptionRow {
  workspaceId: string;
  email: string | null;
  brokerName: string | null;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const SUBSCRIPTION_COLUMNS = sql`
  bs.id, bs.broker_id as "brokerId", bs.plan_id as "planId", bp.code::text as "planCode", bp.price_rwf as "planPriceRwf",
  bs.scope_province_id as "provinceId", pr.name as "provinceName", bs.scope_changed_at as "scopeChangedAt",
  bs.status::text as status, bs.current_period_start::text as "periodStart", bs.current_period_end::text as "periodEnd",
  bs.cancel_at_period_end as "cancelAtPeriodEnd", np.code::text as "nextPlanCode", bs.next_scope_province_id as "nextProvinceId",
  bs.pay_method::text as "payMethod", bs.pay_msisdn as "payMsisdn", bs.card_token as "cardToken", bs.created_at as "createdAt"
`;
const SUBSCRIPTION_FROM = sql`
  broker_subscriptions bs
  join broker_plans bp on bp.id = bs.plan_id
  left join broker_plans np on np.id = bs.next_plan_id
  left join provinces pr on pr.id = bs.scope_province_id
`;

const PAYMENT_COLUMNS = sql`
  p.id, p.subscription_id as "subscriptionId", p.broker_id as "brokerId",
  (select w.id from workspaces w join brokers b on b.user_id = w.user_id where b.id = p.broker_id and w.kind = 'broker' limit 1) as "workspaceId",
  p.kind::text as kind, bp.code::text as "planCode", p.period_start::text as "periodStart", p.period_end::text as "periodEnd",
  p.amount_rwf as "amountRwf", p.method::text as method, p.msisdn_masked as "msisdnMasked", p.gateway_ref as "gatewayRef",
  p.checkout_url as "checkoutUrl", p.status::text as status, p.failure_reason as "failureReason", p.idempotency_key as "idempotencyKey",
  p.paid_at as "paidAt", p.created_at as "createdAt"
`;
const PAYMENT_FROM = sql`
  broker_subscription_payments p
  join broker_plans bp on bp.id = p.plan_id
`;

function dates<T extends { createdAt: Date | string; paidAt?: Date | string | null; scopeChangedAt?: Date | string | null }>(row: T): T {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    ...('paidAt' in row ? { paidAt: row.paidAt ? new Date(row.paidAt) : null } : {}),
    ...('scopeChangedAt' in row ? { scopeChangedAt: row.scopeChangedAt ? new Date(row.scopeChangedAt) : null } : {}),
  };
}

@Injectable()
export class BrokerPlansRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async plans(): Promise<PlanRow[]> {
    const result = await this.db.execute<PlanRow & Record<string, unknown>>(sql`
      select id, code::text as code, name, price_rwf as "priceRwf", active, sort from broker_plans order by sort, code
    `);
    return result.rows;
  }

  async plan(code: BrokerPlanCode): Promise<PlanRow | null> {
    return (await this.plans()).find((p) => p.code === code) ?? null;
  }

  async provinces(): Promise<{ id: number; name: string }[]> {
    const result = await this.db.execute<{ id: number; name: string }>(sql`select id, name from provinces order by id`);
    return result.rows;
  }

  async province(id: number): Promise<{ id: number; name: string } | null> {
    const result = await this.db.execute<{ id: number; name: string }>(sql`select id, name from provinces where id = ${id}`);
    return result.rows[0] ?? null;
  }

  async district(id: number): Promise<{ id: number; name: string; provinceId: number } | null> {
    const result = await this.db.execute<{ id: number; name: string; provinceId: number }>(sql`
      select id, name, province_id as "provinceId" from districts where id = ${id}
    `);
    return result.rows[0] ?? null;
  }

  async home(brokerId: string): Promise<BrokerHomeRow> {
    const result = await this.db.execute<BrokerHomeRow & Record<string, unknown>>(sql`
      select b.home_district_id as "districtId", d.name as "districtName",
             d.province_id as "provinceId", pr.name as "provinceName",
             b.home_district_changed_at as "changedAt"
        from brokers b
        left join districts d on d.id = b.home_district_id
        left join provinces pr on pr.id = d.province_id
       where b.id = ${brokerId}
    `);
    const row = result.rows[0];
    return row
      ? { ...row, changedAt: row.changedAt ? new Date(row.changedAt) : null }
      : { districtId: null, districtName: null, provinceId: null, provinceName: null, changedAt: null };
  }

  /**
   * Move the home district. The first choice (none before) leaves the
   * change clock alone, so a broker asked late is not then locked for a month.
   */
  async setHomeDistrict(brokerId: string, districtId: number, hadOne: boolean): Promise<void> {
    await this.db.execute(sql`
      update brokers
         set home_district_id = ${districtId},
             home_district_changed_at = ${hadOne ? sql`now()` : sql`home_district_changed_at`},
             updated_at = now()
       where id = ${brokerId}
    `);
  }

  /** The paid plan in force or past due, if any. */
  async live(brokerId: string, tx: Tx | Database = this.db): Promise<SubscriptionRow | null> {
    const result = await tx.execute<SubscriptionRow & Record<string, unknown>>(sql`
      select ${SUBSCRIPTION_COLUMNS} from ${SUBSCRIPTION_FROM}
       where bs.broker_id = ${brokerId} and bs.status in ('active', 'past_due')
       limit 1
    `);
    const row = result.rows[0];
    return row ? dates(row) : null;
  }

  async pendingStart(brokerId: string): Promise<SubscriptionRow | null> {
    const result = await this.db.execute<SubscriptionRow & Record<string, unknown>>(sql`
      select ${SUBSCRIPTION_COLUMNS} from ${SUBSCRIPTION_FROM}
       where bs.broker_id = ${brokerId} and bs.status = 'pending_payment'
       limit 1
    `);
    const row = result.rows[0];
    return row ? dates(row) : null;
  }

  async subscription(id: string): Promise<SubscriptionRow | null> {
    const result = await this.db.execute<SubscriptionRow & Record<string, unknown>>(sql`
      select ${SUBSCRIPTION_COLUMNS} from ${SUBSCRIPTION_FROM} where bs.id = ${id}
    `);
    const row = result.rows[0];
    return row ? dates(row) : null;
  }

  /** An upgrade waiting on its first payment. Null when one is already waiting (the unique index said no). */
  async insertPendingStart(input: {
    brokerId: string;
    planId: string;
    provinceId: number | null;
    periodStart: string;
    periodEnd: string;
    method: BrokerPayMethod;
    msisdn: string | null;
  }): Promise<string | null> {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into broker_subscriptions (broker_id, plan_id, scope_province_id, status, current_period_start, current_period_end, pay_method, pay_msisdn)
      values (${input.brokerId}, ${input.planId}, ${input.provinceId}, 'pending_payment', ${input.periodStart}, ${input.periodEnd}, ${input.method}, ${input.msisdn})
      on conflict do nothing
      returning id
    `);
    return result.rows[0]?.id ?? null;
  }

  /** An upgrade whose payment failed or lapsed never starts. */
  async dropPendingStart(subscriptionId: string): Promise<void> {
    await this.db.execute(sql`
      update broker_subscriptions set status = 'cancelled', updated_at = now()
       where id = ${subscriptionId} and status = 'pending_payment'
    `);
  }

  /** How the next renewal is paid: the method the broker last chose. */
  async setPayMethod(subscriptionId: string, method: BrokerPayMethod, msisdn: string | null): Promise<void> {
    await this.db.execute(sql`
      update broker_subscriptions
         set pay_method = ${method}, pay_msisdn = coalesce(${msisdn}, pay_msisdn), updated_at = now()
       where id = ${subscriptionId}
    `);
  }

  async insertPayment(input: {
    subscriptionId: string;
    brokerId: string;
    planId: string;
    kind: 'start' | 'renewal';
    periodStart: string;
    periodEnd: string;
    amountRwf: number;
    method: BrokerPayMethod;
    msisdnMasked: string | null;
    adapterMode: AdapterMode;
    idempotencyKey: string;
  }): Promise<string | null> {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into broker_subscription_payments
        (subscription_id, broker_id, plan_id, kind, period_start, period_end, amount_rwf, method, msisdn_masked, adapter_mode, idempotency_key)
      values (${input.subscriptionId}, ${input.brokerId}, ${input.planId}, ${input.kind}, ${input.periodStart}, ${input.periodEnd},
              ${input.amountRwf}, ${input.method}, ${input.msisdnMasked}, ${input.adapterMode}, ${input.idempotencyKey})
      on conflict (idempotency_key) do nothing
      returning id
    `);
    return result.rows[0]?.id ?? null;
  }

  async payment(id: string): Promise<PaymentRow | null> {
    const result = await this.db.execute<PaymentRow & Record<string, unknown>>(sql`
      select ${PAYMENT_COLUMNS} from ${PAYMENT_FROM} where p.id = ${id}
    `);
    const row = result.rows[0];
    return row ? dates(row) : null;
  }

  async paymentByKey(key: string): Promise<PaymentRow | null> {
    const result = await this.db.execute<PaymentRow & Record<string, unknown>>(sql`
      select ${PAYMENT_COLUMNS} from ${PAYMENT_FROM} where p.idempotency_key = ${key}
    `);
    const row = result.rows[0];
    return row ? dates(row) : null;
  }

  async payments(brokerId: string): Promise<PaymentRow[]> {
    const result = await this.db.execute<PaymentRow & Record<string, unknown>>(sql`
      select ${PAYMENT_COLUMNS} from ${PAYMENT_FROM}
       where p.broker_id = ${brokerId}
       order by p.created_at desc
       limit 50
    `);
    return result.rows.map(dates);
  }

  /** The latest payment on a subscription, to tell a waiting prompt from a lapsed one. */
  async latestPayment(subscriptionId: string): Promise<PaymentRow | null> {
    const result = await this.db.execute<PaymentRow & Record<string, unknown>>(sql`
      select ${PAYMENT_COLUMNS} from ${PAYMENT_FROM}
       where p.subscription_id = ${subscriptionId}
       order by p.created_at desc limit 1
    `);
    const row = result.rows[0];
    return row ? dates(row) : null;
  }

  async pendingPayments(olderThan: Date): Promise<PaymentRow[]> {
    const result = await this.db.execute<PaymentRow & Record<string, unknown>>(sql`
      select ${PAYMENT_COLUMNS} from ${PAYMENT_FROM}
       where p.status = 'pending' and p.created_at < ${olderThan.toISOString()}
       order by p.created_at
       limit 200
    `);
    return result.rows.map(dates);
  }

  async attachRef(paymentId: string, ref: string, checkoutUrl: string | null): Promise<void> {
    await this.db.execute(sql`
      update broker_subscription_payments
         set gateway_ref = ${ref}, checkout_url = ${checkoutUrl}, updated_at = now()
       where id = ${paymentId}
    `);
  }

  /** False when it was no longer pending. */
  async failPayment(paymentId: string, reason: string): Promise<boolean> {
    const result = await this.db.execute<{ id: string }>(sql`
      update broker_subscription_payments
         set status = 'failed', failure_reason = ${reason}, checkout_url = null, updated_at = now()
       where id = ${paymentId} and status = 'pending'
      returning id
    `);
    return result.rows.length > 0;
  }

  /**
   * The money landed. In one transaction: the payment is paid, and its
   * subscription is in force for the month it paid for. An upgrade replaces
   * the plan the broker had. False when another caller applied it first.
   */
  async applyPaid(payment: PaymentRow, cardToken: string | null): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const paid = await tx.execute<{ id: string }>(sql`
        update broker_subscription_payments
           set status = 'paid', paid_at = now(), checkout_url = null, updated_at = now()
         where id = ${payment.id} and status = 'pending'
        returning id
      `);
      if (paid.rows.length === 0) return false;
      if (payment.kind === 'start') {
        await tx.execute(sql`
          update broker_subscriptions set status = 'cancelled', updated_at = now()
           where broker_id = ${payment.brokerId} and status in ('active', 'past_due') and id <> ${payment.subscriptionId}
        `);
      }
      await tx.execute(sql`
        update broker_subscriptions
           set status = 'active',
               current_period_start = ${payment.periodStart},
               current_period_end = ${payment.periodEnd},
               card_token = coalesce(${cardToken}, card_token),
               updated_at = now()
         where id = ${payment.subscriptionId}
           and status in ('pending_payment', 'active', 'past_due')
      `);
      return true;
    });
  }

  /** Mark a receipt sent, once. True for the caller that should send it. */
  async claimReceipt(paymentId: string): Promise<boolean> {
    const result = await this.db.execute<{ id: string }>(sql`
      update broker_subscription_payments set receipt_sent_at = now()
       where id = ${paymentId} and receipt_sent_at is null
      returning id
    `);
    return result.rows.length > 0;
  }

  /** End of the month: drop to District, schedule a cheaper plan, or keep it. */
  async schedule(
    subscriptionId: string,
    change: { cancel: boolean; nextPlanId: string | null; nextProvinceId: number | null },
  ): Promise<void> {
    await this.db.execute(sql`
      update broker_subscriptions
         set cancel_at_period_end = ${change.cancel},
             next_plan_id = ${change.nextPlanId},
             next_scope_province_id = ${change.nextProvinceId},
             updated_at = now()
       where id = ${subscriptionId}
    `);
  }

  async setProvince(subscriptionId: string, provinceId: number): Promise<void> {
    await this.db.execute(sql`
      update broker_subscriptions
         set scope_province_id = ${provinceId}, scope_changed_at = now(), updated_at = now()
       where id = ${subscriptionId}
    `);
  }

  /** Paid plans whose month has ended, with their broker's workspace and email. */
  async due(today: string): Promise<RenewalRow[]> {
    const result = await this.db.execute<RenewalRow & Record<string, unknown>>(sql`
      select ${SUBSCRIPTION_COLUMNS}, w.id as "workspaceId", u.email, coalesce(b.name, u.name) as "brokerName"
        from ${SUBSCRIPTION_FROM}
        join brokers b on b.id = bs.broker_id
        join users u on u.id = b.user_id
        join workspaces w on w.user_id = b.user_id and w.kind = 'broker'
       where bs.status = 'active' and bs.current_period_end <= ${today}
       order by bs.current_period_end
       limit 500
    `);
    return result.rows.map(dates);
  }

  /** Past-due plans whose grace has run out. */
  async lapsed(lastGraceEnd: string): Promise<RenewalRow[]> {
    const result = await this.db.execute<RenewalRow & Record<string, unknown>>(sql`
      select ${SUBSCRIPTION_COLUMNS}, w.id as "workspaceId", u.email, coalesce(b.name, u.name) as "brokerName"
        from ${SUBSCRIPTION_FROM}
        join brokers b on b.id = bs.broker_id
        join users u on u.id = b.user_id
        join workspaces w on w.user_id = b.user_id and w.kind = 'broker'
       where bs.status = 'past_due' and bs.current_period_end <= ${lastGraceEnd}
       limit 500
    `);
    return result.rows.map(dates);
  }

  async setStatus(subscriptionId: string, from: BrokerPlanStatus[], to: BrokerPlanStatus): Promise<boolean> {
    const result = await this.db.execute<{ id: string }>(sql`
      update broker_subscriptions set status = ${to}, updated_at = now()
       where id = ${subscriptionId} and status::text in (${sql.join(from.map((s) => sql`${s}`), sql`, `)})
      returning id
    `);
    return result.rows.length > 0;
  }

  /** A cheaper plan chosen for next month takes over as the month turns. */
  async applyNext(subscriptionId: string): Promise<void> {
    await this.db.execute(sql`
      update broker_subscriptions
         set plan_id = next_plan_id, scope_province_id = next_scope_province_id,
             next_plan_id = null, next_scope_province_id = null, updated_at = now()
       where id = ${subscriptionId} and next_plan_id is not null
    `);
  }

  async contactFor(brokerId: string): Promise<{ email: string | null; name: string | null; workspaceId: string | null }> {
    const result = await this.db.execute<{ email: string | null; name: string | null; workspaceId: string | null }>(sql`
      select u.email, coalesce(b.name, u.name) as name,
             (select w.id from workspaces w where w.user_id = b.user_id and w.kind = 'broker' limit 1) as "workspaceId"
        from brokers b join users u on u.id = b.user_id
       where b.id = ${brokerId}
    `);
    return result.rows[0] ?? { email: null, name: null, workspaceId: null };
  }

  // --- Admin -------------------------------------------------------------------

  /** Change a plan's monthly price. District stays free (the CHECK refuses it). */
  async setPrice(code: BrokerPlanCode, priceRwf: number): Promise<PlanRow | null> {
    const result = await this.db.execute<{ id: string }>(sql`
      update broker_plans set price_rwf = ${priceRwf}, updated_at = now() where code = ${code} returning id
    `);
    return result.rows.length > 0 ? this.plan(code) : null;
  }

  /** Every paid plan ever started, newest first, with what it brought in. */
  async adminSubscriptions(page: number, pageSize: number): Promise<{ total: number; rows: (SubscriptionRow & { brokerName: string | null; districtName: string | null; paidRwf: number })[] }> {
    const [count, result] = await Promise.all([
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from broker_subscriptions where status <> 'pending_payment'`),
      this.db.execute<SubscriptionRow & Record<string, unknown>>(sql`
        select ${SUBSCRIPTION_COLUMNS}, coalesce(b.name, u.name) as "brokerName", d.name as "districtName",
               coalesce((select sum(p.amount_rwf) from broker_subscription_payments p where p.subscription_id = bs.id and p.status = 'paid'), 0)::int as "paidRwf"
          from ${SUBSCRIPTION_FROM}
          join brokers b on b.id = bs.broker_id
          join users u on u.id = b.user_id
          left join districts d on d.id = b.home_district_id
         where bs.status <> 'pending_payment'
         order by bs.created_at desc
         limit ${pageSize} offset ${(page - 1) * pageSize}
      `),
    ]);
    return {
      total: count.rows[0]?.n ?? 0,
      rows: result.rows.map((r) => ({ ...dates(r), brokerName: (r.brokerName as string | null) ?? null, districtName: (r.districtName as string | null) ?? null, paidRwf: Number(r.paidRwf ?? 0) })),
    };
  }
}
