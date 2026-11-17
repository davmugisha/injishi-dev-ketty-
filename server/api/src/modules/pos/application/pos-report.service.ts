import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type {
  PosDashboard,
  PosExpenseRow,
  PosMethodTotal,
  PosPeriodQuery,
  PosReport,
  PosSalesLine,
} from '../domain/pos-ops';
import { addDays, businessDayOf, businessDayWindow, commonBusinessDayStart } from '../domain/business-day';
import { COST_OF_GOODS_RATIO, LOW_STOCK_AT } from '../infrastructure/pos-stock';
import { outletInScope, outletsInScope, type Db, type OutletRow } from '../infrastructure/pos-support';

type Scope = {
  outlets: OutletRow[];
  name: string;
  id: string | null;
  businessDay: { startMinutes: number; mixed: boolean };
};

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** node-postgres answers `{ rows }`; keep the cast in one place. */
function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? (result as T[])) as T[];
}

/** Menu categories that count as drinks for "top selling drinks". */
const DRINK = /beer|wine|spirit|cocktail|soft|juice|water|coffee|tea|drink|whisk|vodka|gin|rum/i;

/**
 * The dashboard and the reports of a bar or restaurant (POS spec sections 4 and 15).
 *
 * One summary function answers both, so the dashboard's "today" can never disagree with the report for
 * the same day. Everything is computed from the POS tables on every request: no stored totals, so the
 * figures move the moment an order is paid. A day is a Kigali calendar day. Sales are orders COMPLETED in
 * the window (settled, so tax and discounts are final); collections are payments settled in the window.
 *
 * Cost of goods and profit are ESTIMATES: no cost price is stored per item yet, so the cost is a fixed
 * share of net sales (`COST_OF_GOODS_RATIO`), and every figure that uses it says so.
 */
@Injectable()
export class PosReportService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async scope(ws: ScopedWorkspace, outletId?: string): Promise<Scope> {
    const outlets = outletId ? [await outletInScope(this.db, ws, outletId)] : await outletsInScope(this.db, ws);
    return {
      outlets,
      name: outletId ? (outlets[0]?.name ?? '') : 'All outlets',
      id: outletId ? (outlets[0]?.id ?? null) : null,
      businessDay: await this.businessDay(outlets),
    };
  }

  /**
   * When the business day of these outlets starts (migration 0154). Read, never written: an outlet with no settings
   * row yet uses the calendar day, which is what its row would say once written.
   */
  private async businessDay(outlets: OutletRow[]): Promise<Scope['businessDay']> {
    if (outlets.length === 0) return { startMinutes: 0, mixed: false };
    const rows = rowsOf<{ outlet_id: string; start: number }>(
      await this.db.execute(sql`select outlet_id, business_day_start_minutes::int as start from pos_outlet_settings
        where outlet_id in (${this.idList(outlets.map((o) => o.id))})`),
    );
    const byOutlet = new Map(rows.map((r) => [r.outlet_id, num(r.start)]));
    return commonBusinessDayStart(outlets.map((o) => byOutlet.get(o.id) ?? 0));
  }

  async dashboard(ws: ScopedWorkspace, outletId?: string): Promise<PosDashboard> {
    const sc = await this.scope(ws, outletId);
    const today = businessDayOf(new Date(), sc.businessDay.startMinutes);
    const ids = sc.outlets.map((o) => o.id);
    // One transaction, so the whole dashboard reads one connection and one snapshot: running two reports
    // and the live counts side by side starved the connection pool on a busy machine.
    return this.db.transaction(async (tx) => {
      const todayReport = await this.summary(tx, ws, sc, today, today);
      const week = await this.summary(tx, ws, sc, addDays(today, -6), today);
      const live = await this.live(tx, ids);
      return { asOf: new Date().toISOString(), outlet: { id: sc.id, name: sc.name }, today: todayReport, week, live };
    });
  }

  async report(ws: ScopedWorkspace, q: PosPeriodQuery): Promise<PosReport> {
    const sc = await this.scope(ws, q.outletId);
    const today = businessDayOf(new Date(), sc.businessDay.startMinutes);
    const to = q.to ?? q.from ?? today;
    const from = q.from ?? to;
    const [a, b] = from <= to ? [from, to] : [to, from];
    return this.db.transaction((tx) => this.summary(tx, ws, sc, a, b));
  }

  private idList(ids: string[]): SQL {
    return ids.length ? sql.join(ids.map((i) => sql`${i}`), sql`, `) : sql`NULL`;
  }

  private async live(db: Db, ids: string[]): Promise<PosDashboard['live']> {
    if (ids.length === 0) {
      return { activeOrders: [], activeOrderCount: 0, tables: [], openShifts: 0, alerts: { low: 0, out: 0 } };
    }
    const list = this.idList(ids);
    const [active, tables, shifts, stock] = await Promise.all([
      db.execute(sql`select status::text as status, count(*)::int as n, coalesce(sum(total_rwf),0) as total
        from pos_orders where outlet_id in (${list}) and status in ('draft','submitted','in_progress','ready','delivered')
        group by 1 order by 1`),
      db.execute(sql`select status::text as status, count(*)::int as n from restaurant_tables
        where outlet_id in (${list}) group by 1 order by 1`),
      db.execute(sql`select count(*)::int as n from cashier_shifts where outlet_id in (${list}) and status = 'open'`),
      db.execute(sql`select
          count(*) filter (where si.stock_qty is not null and si.stock_qty > 0 and si.stock_qty <= ${LOW_STOCK_AT} and si.status <> 'out_of_stock')::int as low,
          count(*) filter (where (si.stock_qty is not null and si.stock_qty <= 0) or si.status = 'out_of_stock')::int as out
        from service_items si left join service_categories sc on sc.id = si.service_category_id
        where coalesce(si.outlet_id, sc.outlet_id) in (${list})`),
    ]);
    const activeRows = rowsOf<{ status: string; n: number; total: string }>(active);
    return {
      activeOrders: activeRows.map((r) => ({ status: r.status, count: num(r.n), totalRwf: num(r.total) })),
      activeOrderCount: activeRows.reduce((t, r) => t + num(r.n), 0),
      tables: rowsOf<{ status: string; n: number }>(tables).map((r) => ({ status: r.status, count: num(r.n) })),
      openShifts: num(rowsOf<{ n: number }>(shifts)[0]?.n),
      alerts: { low: num(rowsOf<{ low: number }>(stock)[0]?.low), out: num(rowsOf<{ out: number }>(stock)[0]?.out) },
    };
  }

  private async summary(
    db: Db,
    ws: ScopedWorkspace,
    sc: Scope,
    from: string,
    to: string,
  ): Promise<PosReport> {
    const ids = sc.outlets.map((o) => o.id);
    // A business day runs from the outlet's start time to the same time the next day; 0 is the calendar day.
    const shift = sc.businessDay.startMinutes;
    const window = businessDayWindow(from, to, shift);
    const start = window.start.toISOString();
    const end = window.end.toISOString();
    const list = this.idList(ids);
    const propertyIds = sc.outlets.map((o) => o.propertyId).filter((p): p is string => !!p);

    const empty = ids.length === 0;
    const run = async <T>(query: SQL): Promise<T[]> => (empty ? [] : rowsOf<T>(await db.execute(query)));

    const [orders, methods, refunds, lines, waiters, daily, tax, shifts, stock, expRows, expRecent] = await Promise.all([
      run<{ orders: number; completed: number; total: string; tax: string; discount: string }>(sql`
        select count(*) filter (where status <> 'cancelled' and created_at >= ${start}::timestamptz and created_at < ${end}::timestamptz)::int as orders,
               count(*) filter (where status = 'completed' and completed_at >= ${start}::timestamptz and completed_at < ${end}::timestamptz)::int as completed,
               coalesce(sum(total_rwf) filter (where status = 'completed' and completed_at >= ${start}::timestamptz and completed_at < ${end}::timestamptz), 0) as total,
               coalesce(sum(tax_rwf) filter (where status = 'completed' and completed_at >= ${start}::timestamptz and completed_at < ${end}::timestamptz), 0) as tax,
               coalesce(sum(discount_rwf) filter (where status = 'completed' and completed_at >= ${start}::timestamptz and completed_at < ${end}::timestamptz), 0) as discount
          from pos_orders
         where outlet_id in (${list}) and created_at < ${end}::timestamptz
           and (created_at >= ${start}::timestamptz or (completed_at >= ${start}::timestamptz and completed_at < ${end}::timestamptz))`),
      run<{ method: string; n: number; amount: string; tips: string }>(sql`
        select p.method::text as method, count(*)::int as n, coalesce(sum(p.amount_rwf),0) as amount, coalesce(sum(p.tip_rwf),0) as tips
          from pos_payments p
         where p.outlet_id in (${list}) and p.status in ('successful','refunded')
           and p.settled_at >= ${start}::timestamptz and p.settled_at < ${end}::timestamptz
         group by 1 order by 3 desc`),
      run<{ total: string }>(sql`
        select coalesce(sum(r.amount_rwf),0) as total from pos_refunds r join pos_payments p on p.id = r.payment_id
         where p.outlet_id in (${list}) and r.created_at >= ${start}::timestamptz and r.created_at < ${end}::timestamptz`),
      run<{ name: string; category: string; qty: number; revenue: string }>(sql`
        select l.name_snapshot as name, coalesce(c.name, 'Other') as category, sum(l.quantity)::int as qty, coalesce(sum(l.total_rwf),0) as revenue
          from pos_order_lines l
          join pos_orders o on o.id = l.order_id
          left join service_items i on i.id = l.service_item_id
          left join service_categories c on c.id = i.service_category_id
         where o.outlet_id in (${list}) and o.status <> 'cancelled' and l.status = 'sent'
           and l.sent_at >= ${start}::timestamptz and l.sent_at < ${end}::timestamptz
         group by 1, 2 order by 3 desc limit 300`),
      run<{ name: string; n: number; total: string }>(sql`
        select coalesce(u.name, u.email, 'Unassigned') as name, count(*)::int as n, coalesce(sum(o.total_rwf),0) as total
          from pos_orders o left join users u on u.id = o.waiter_user_id
         where o.outlet_id in (${list}) and o.status = 'completed'
           and o.completed_at >= ${start}::timestamptz and o.completed_at < ${end}::timestamptz
         group by 1 order by 3 desc limit 12`),
      run<{ day: string; n: number; total: string }>(sql`
        select to_char((o.completed_at - make_interval(mins => ${shift}::int)) at time zone 'Africa/Kigali', 'YYYY-MM-DD') as day, count(*)::int as n, coalesce(sum(o.total_rwf),0) as total
          from pos_orders o
         where o.outlet_id in (${list}) and o.status = 'completed'
           and o.completed_at >= ${start}::timestamptz and o.completed_at < ${end}::timestamptz
         group by 1 order by 1`),
      run<{ code: string; rate: number; total: string; tax: string }>(sql`
        select l.tax_code::text as code, l.tax_rate_bps as rate, coalesce(sum(l.total_rwf),0) as total, coalesce(sum(l.tax_rwf),0) as tax
          from pos_order_lines l join pos_orders o on o.id = l.order_id
         where o.outlet_id in (${list}) and o.status = 'completed' and l.status <> 'voided'
           and o.completed_at >= ${start}::timestamptz and o.completed_at < ${end}::timestamptz
         group by 1, 2 order by 1`),
      run<{ n: number; variance: string }>(sql`
        select count(*)::int as n, coalesce(sum(variance_rwf),0) as variance from cashier_shifts
         where outlet_id in (${list}) and opened_at >= ${start}::timestamptz and opened_at < ${end}::timestamptz`),
      run<{ tracked: number; low: number; out: number; value: string }>(sql`
        select count(*) filter (where si.stock_qty is not null)::int as tracked,
               count(*) filter (where si.stock_qty > 0 and si.stock_qty <= ${LOW_STOCK_AT} and si.status <> 'out_of_stock')::int as low,
               count(*) filter (where (si.stock_qty is not null and si.stock_qty <= 0) or si.status = 'out_of_stock')::int as out,
               coalesce(sum(round(si.price_rwf * ${COST_OF_GOODS_RATIO}::numeric) * greatest(si.stock_qty,0)) filter (where si.stock_qty is not null), 0) as value
          from service_items si left join service_categories sc on sc.id = si.service_category_id
         where coalesce(si.outlet_id, sc.outlet_id) in (${list})`),
      db.execute(sql`
        select category::text as category, coalesce(sum(amount_rwf),0) as total from expenses
         where workspace_id = ${ws.workspaceId} and voided_at is null
           and paid_on >= ${from}::date and paid_on <= ${to}::date
           ${propertyIds.length ? sql`and (property_id is null or property_id in (${this.idList(propertyIds)}))` : sql``}
         group by 1 order by 2 desc`),
      db.execute(sql`
        select id, paid_on::text as paid_on, category::text as category, amount_rwf, method::text as method, payee_name, note from expenses
         where workspace_id = ${ws.workspaceId} and voided_at is null
           and paid_on >= ${from}::date and paid_on <= ${to}::date
           ${propertyIds.length ? sql`and (property_id is null or property_id in (${this.idList(propertyIds)}))` : sql``}
         order by paid_on desc, created_at desc limit 15`),
    ]);

    const o = orders[0] ?? { orders: 0, completed: 0, total: '0', tax: '0', discount: '0' };
    const totalRwf = num(o.total);
    const taxRwf = num(o.tax);
    const netOfTax = totalRwf - taxRwf;
    const completed = num(o.completed);

    const byMethod: PosMethodTotal[] = methods.map((m) => ({
      method: m.method,
      count: num(m.n),
      amountRwf: num(m.amount),
      tipRwf: num(m.tips),
    }));

    const sold: PosSalesLine[] = lines.map((l) => ({
      name: l.name,
      category: l.category,
      quantity: num(l.qty),
      revenueRwf: num(l.revenue),
    }));
    const cats = new Map<string, { quantity: number; revenueRwf: number }>();
    for (const s of sold) {
      const c = cats.get(s.category) ?? { quantity: 0, revenueRwf: 0 };
      cats.set(s.category, { quantity: c.quantity + s.quantity, revenueRwf: c.revenueRwf + s.revenueRwf });
    }

    const expenseRows = rowsOf<{ category: string; total: string }>(expRows);
    const expensesTotal = expenseRows.reduce((t, r) => t + num(r.total), 0);
    const recent: PosExpenseRow[] = rowsOf<{
      id: string;
      paid_on: string;
      category: string;
      amount_rwf: string;
      method: string;
      payee_name: string | null;
      note: string | null;
    }>(expRecent).map((r) => ({
      id: r.id,
      paidOn: r.paid_on,
      category: r.category,
      amountRwf: num(r.amount_rwf),
      method: r.method,
      payeeName: r.payee_name,
      note: r.note,
    }));

    const cogs = Math.round(netOfTax * COST_OF_GOODS_RATIO);
    const st = stock[0] ?? { tracked: 0, low: 0, out: 0, value: '0' };

    return {
      period: { from, to },
      outlet: { id: sc.id, name: sc.name },
      businessDay: sc.businessDay,
      sales: {
        orders: num(o.orders),
        completedOrders: completed,
        totalRwf,
        taxRwf,
        discountRwf: num(o.discount),
        netOfTaxRwf: netOfTax,
        averageOrderRwf: completed ? Math.round(totalRwf / completed) : 0,
      },
      payments: {
        collectedRwf: byMethod.reduce((t, m) => t + m.amountRwf, 0),
        refundsRwf: num(refunds[0]?.total),
        tipsRwf: byMethod.reduce((t, m) => t + m.tipRwf, 0),
        byMethod,
      },
      expenses: {
        totalRwf: expensesTotal,
        byCategory: expenseRows.map((r) => ({ category: r.category, totalRwf: num(r.total) })),
        recent,
      },
      profit: {
        netSalesRwf: netOfTax,
        costOfGoodsRwf: cogs,
        expensesRwf: expensesTotal,
        estimatedProfitRwf: netOfTax - cogs - expensesTotal,
        costRatio: COST_OF_GOODS_RATIO,
        note: `Estimate. No cost price is stored per item yet, so cost of goods is taken as ${Math.round(
          COST_OF_GOODS_RATIO * 100,
        )}% of sales before tax.`,
      },
      bestSellers: sold.slice(0, 10),
      topDrinks: sold.filter((s) => DRINK.test(s.category)).slice(0, 5),
      byCategory: [...cats.entries()]
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.revenueRwf - a.revenueRwf),
      waiters: waiters.map((w) => ({
        name: w.name,
        orders: num(w.n),
        totalRwf: num(w.total),
        averageRwf: num(w.n) ? Math.round(num(w.total) / num(w.n)) : 0,
      })),
      daily: daily.map((d) => ({ day: d.day, orders: num(d.n), totalRwf: num(d.total) })),
      tax: tax.map((t) => ({
        code: t.code,
        ratePercent: num(t.rate) / 100,
        taxableRwf: num(t.total) - num(t.tax),
        taxRwf: num(t.tax),
      })),
      shifts: { count: num(shifts[0]?.n), varianceRwf: num(shifts[0]?.variance) },
      stock: { tracked: num(st.tracked), low: num(st.low), out: num(st.out), valuationRwf: num(st.value) },
    };
  }
}
