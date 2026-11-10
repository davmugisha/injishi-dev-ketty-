import {
  brokerAreaLabel,
  type AdminBrokerPlanList,
  type AdminBrokerPlanUpdate,
  type AdminBrokerSubscriptionList,
  type BrokerPayMethod,
  type BrokerPlan,
  type BrokerPlanCode,
  type BrokerPlanStatus,
  type AdminBrokerSubscriptionQuery,
} from '@injishi/contracts';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, type SQL, sql } from 'drizzle-orm';

import { brokerPlans } from '../../../database/drizzle/brokers';
import { AuditWriter } from '../../../shared/audit/audit-writer';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

function toPlan(row: typeof brokerPlans.$inferSelect): BrokerPlan {
  return {
    code: row.code as BrokerPlanCode,
    name: row.name,
    priceRwf: row.priceRwf,
    active: row.active,
    sort: row.sort,
  };
}

/**
 * Broker plans in the admin console (2026-10-23, ported 2026-10-25): the three plans with their
 * prices, which finance may change (`admin.fee.edit`), and every broker's
 * subscription, read only (`admin.broker.view`).
 *
 * A new price applies to the next payment anyone makes: a month already paid
 * keeps the price it was paid at, because the payment row holds the amount.
 * District is free by a database check, so it cannot be priced here.
 */
@Injectable()
export class AdminBrokerPlansService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async plans(): Promise<AdminBrokerPlanList> {
    const rows = await this.db.select().from(brokerPlans).orderBy(brokerPlans.sort);
    return { plans: rows.map(toPlan) };
  }

  async setPrice(code: BrokerPlanCode, request: AdminBrokerPlanUpdate, actorUserId: string): Promise<BrokerPlan> {
    if (code === 'district' && request.priceRwf !== 0) {
      throw new BadRequestException('District is the free plan. Its price stays RWF 0.');
    }
    if (code !== 'district' && request.priceRwf < 100) {
      throw new BadRequestException('A paid plan costs at least RWF 100 a month.');
    }
    return this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(brokerPlans).where(eq(brokerPlans.code, code)).limit(1);
      if (!before) throw new NotFoundException('No broker plan has that code.');
      const [row] = await tx
        .update(brokerPlans)
        .set({ priceRwf: request.priceRwf, updatedAt: new Date() })
        .where(eq(brokerPlans.code, code))
        .returning();
      if (!row) throw new Error('Broker plan update returned no row.');
      await AuditWriter.write(tx, {
        actorUserId,
        subjectType: 'config',
        subjectId: null,
        eventType: 'admin.broker_plan.priced',
        payloadDiff: { before: toPlan(before), after: toPlan(row) },
        reason: request.reason,
      });
      return toPlan(row);
    });
  }

  async subscriptions(query: AdminBrokerSubscriptionQuery): Promise<AdminBrokerSubscriptionList> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    // An upgrade that was never paid is noise here; one still waiting today is not.
    const base: SQL[] = [sql`(bs.status <> 'pending_payment' or bs.created_at > now() - interval '1 day')`];
    if (query.q) base.push(sql`(coalesce(b.name, u.name) ilike ${`%${query.q}%`} or u.email ilike ${`%${query.q}%`})`);
    if (query.plan) base.push(sql`bp.code::text = ${query.plan}`);
    if (query.provinceId) base.push(sql`bs.scope_province_id = ${query.provinceId}`);
    if (query.createdFrom) {
      base.push(sql`bs.created_at >= (${query.createdFrom}::date::timestamp at time zone 'Africa/Kigali')`);
    }
    const all = [...base, ...(query.status ? [sql`bs.status::text = ${query.status}`] : [])];
    const from = sql`from broker_subscriptions bs
          join broker_plans bp on bp.id = bs.plan_id
          join brokers b on b.id = bs.broker_id
          join users u on u.id = b.user_id
          left join provinces pr on pr.id = bs.scope_province_id`;
    const [count, byStatus, rows] = await Promise.all([
      this.db.execute<{ n: number }>(sql`select count(*)::int as n ${from} where ${sql.join(all, sql` and `)}`),
      this.db.execute<{ status: BrokerPlanStatus; n: number }>(
        sql`select bs.status::text as status, count(*)::int as n ${from} where ${sql.join(base, sql` and `)} group by 1`,
      ),
      this.db.execute<{
        id: string;
        brokerId: string;
        brokerName: string | null;
        plan: BrokerPlanCode;
        provinceName: string | null;
        status: BrokerPlanStatus;
        periodStart: string;
        periodEnd: string;
        cancelAtPeriodEnd: boolean;
        method: BrokerPayMethod | null;
        paidRwf: number;
        createdAt: string;
      }>(sql`
        select bs.id, bs.broker_id as "brokerId", coalesce(b.name, u.name) as "brokerName", bp.code::text as plan,
               pr.name as "provinceName", bs.status::text as status, bs.current_period_start::text as "periodStart",
               bs.current_period_end::text as "periodEnd", bs.cancel_at_period_end as "cancelAtPeriodEnd",
               bs.pay_method::text as method,
               coalesce((select sum(p.amount_rwf) from broker_subscription_payments p
                          where p.subscription_id = bs.id and p.status = 'paid'), 0)::int as "paidRwf",
               bs.created_at::text as "createdAt"
          ${from}
         where ${sql.join(all, sql` and `)}
         order by bs.created_at desc
         limit ${pageSize} offset ${(page - 1) * pageSize}
      `),
    ]);
    const statusCounts = Object.fromEntries(byStatus.rows.map((r) => [r.status, r.n]));
    return {
      items: rows.rows.map(({ provinceName, createdAt, ...r }) => ({
        ...r,
        area: brokerAreaLabel(r.plan, { province: provinceName }),
        createdAt: new Date(createdAt).toISOString(),
      })),
      meta: { total: count.rows[0]?.n ?? 0, page, pageSize },
      statusCounts,
    };
  }
}
