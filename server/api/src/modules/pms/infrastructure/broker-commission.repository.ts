import { BROKER_COMMISSION_INJISHI_SHARE, brokerCommissionSplit } from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import type { Database } from '../../../shared/database/database.module';
import { allocate, kigaliDay, nightsStayed, percentCommission } from '../domain/broker-commission';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** The reason a broker's share waits: the same words a hotel sees without a payout account. */
export const NO_BROKER_PAYOUT_NUMBER = 'No MoMo number to pay you on. Add one under Bookings.';

/** `+250788123456` → `MTN ••• 456`. */
export function maskBrokerMomo(network: string, phone: string): string {
  return `${network === 'airtel' ? 'Airtel' : 'MTN'} ••• ${phone.slice(-3)}`;
}

const num = (v: unknown): number => Number(v ?? 0);

/**
 * A broker's commission, inside the check-out's own transaction (0128). Every function takes the
 * transaction the stay's completion is running, so the commission, the hotel's smaller payout and what it
 * was smaller by are written together or not at all.
 */
export const brokerCommissions = {
  /**
   * Earn what this stay earns its broker. A percent deal: its percent of the room price for the nights
   * actually stayed, on this booking. A bulk deal: its sum, on the group, once this was the group's last
   * room still to check out (the owner's default: the whole sum when at least one room stayed). The booking
   * was already marked completed in this transaction. Keyed by booking (or group), so a second check-out
   * earns nothing more.
   */
  async earn(tx: Tx, bookingId: string, now: Date): Promise<void> {
    const found = await tx.execute<Record<string, unknown>>(sql`
      select b.id, b.broker_id, b.broker_deal_id, b.broker_group_id, b.locked_nightly_rate_rwf,
             b.check_in::text as check_in, b.check_out::text as check_out,
             g.org_id, jsonb_array_length(g.rooms) as group_rooms,
             d.kind::text as kind, d.percent_bp, d.amount_rwf, d.min_rooms
        from bookings b
        join broker_booking_groups g on g.id = b.broker_group_id
        join broker_hotel_deals d on d.id = b.broker_deal_id
       where b.id = ${bookingId} and b.broker_id is not null`);
    const r = found.rows[0];
    if (!r) return;

    if (r.kind === 'percent') {
      const nights = nightsStayed(String(r.check_in), String(r.check_out), kigaliDay(now));
      const base = num(r.locked_nightly_rate_rwf) * nights;
      const commission = percentCommission(base, num(r.percent_bp));
      if (commission <= 0) return;
      const split = brokerCommissionSplit(commission);
      await tx.execute(sql`
        insert into broker_commissions
          (broker_id, deal_id, group_id, booking_id, org_id, kind, base_rwf, nights_stayed,
           commission_rwf, injishi_rwf, broker_rwf, earned_at)
        values (${r.broker_id}, ${r.broker_deal_id}, ${r.broker_group_id}, ${bookingId}, ${r.org_id}, 'percent',
                ${base}, ${nights}, ${commission}, ${split.injishiRwf}, ${split.brokerRwf}, ${now})
        on conflict do nothing`);
      return;
    }

    // Bulk: only once every room of the group is done (completed, or never stayed), and only if the group
    // was big enough for the deal when it was booked.
    if (num(r.group_rooms) < num(r.min_rooms)) return;
    const open = await tx.execute<Record<string, unknown>>(sql`
      select count(*)::int as n from bookings
       where broker_group_id = ${r.broker_group_id} and status = 'confirmed' and completed_at is null`);
    if (num(open.rows[0]?.n) > 0) return;
    const commission = num(r.amount_rwf);
    if (commission <= 0) return;
    const split = brokerCommissionSplit(commission);
    await tx.execute(sql`
      insert into broker_commissions
        (broker_id, deal_id, group_id, booking_id, org_id, kind, commission_rwf, injishi_rwf, broker_rwf, earned_at)
      values (${r.broker_id}, ${r.broker_deal_id}, ${r.broker_group_id}, null, ${r.org_id}, 'bulk_fixed',
              ${commission}, ${split.injishiRwf}, ${split.brokerRwf}, ${now})
      on conflict do nothing`);
  },

  /**
   * The bulk groups that finished without a last check-out to earn them: every room is done (checked out,
   * cancelled or a no-show), at least one stayed, the group was big enough, and no commission exists yet.
   * The hourly pass runs this; a group whose last room checked out was already earned at that check-out.
   */
  async earnFinishedBulk(tx: Tx, now: Date): Promise<number> {
    const done = await tx.execute<Record<string, unknown>>(sql`
      insert into broker_commissions
        (broker_id, deal_id, group_id, booking_id, org_id, kind, commission_rwf, injishi_rwf, broker_rwf, earned_at)
      select g.broker_id, g.deal_id, g.id, null, g.org_id, 'bulk_fixed', d.amount_rwf,
             round(d.amount_rwf * ${BROKER_COMMISSION_INJISHI_SHARE})::int,
             d.amount_rwf - round(d.amount_rwf * ${BROKER_COMMISSION_INJISHI_SHARE})::int, ${now}
        from broker_booking_groups g
        join broker_hotel_deals d on d.id = g.deal_id and d.kind = 'bulk_fixed'
       where g.status = 'booked'
         and jsonb_array_length(g.rooms) >= d.min_rooms
         and not exists (select 1 from broker_commissions c where c.group_id = g.id and c.kind = 'bulk_fixed')
         and not exists (select 1 from bookings b where b.broker_group_id = g.id and b.status = 'confirmed' and b.completed_at is null)
         and exists (select 1 from bookings b where b.broker_group_id = g.id and b.completed_at is not null)
      on conflict do nothing
      returning id`);
    return done.rows.length;
  },

  /**
   * Take what this hotel owes its brokers out of the money a check-out is about to pay it, oldest first.
   * Answers how much of it is left for the hotel, and records each deduction against `bookingId` (the stay
   * that paid it); `attach` then names the payout once it is written.
   */
  async collect(tx: Tx, orgId: string, bookingId: string, payoutRwf: number, now: Date): Promise<{ remainingRwf: number; deductedRwf: number }> {
    const owed = await tx.execute<Record<string, unknown>>(sql`
      select id, commission_rwf - collected_rwf as owed
        from broker_commissions
       where org_id = ${orgId} and status = 'owed'
       order by earned_at, id
       for update`);
    const plan = allocate(
      payoutRwf,
      owed.rows.map((o) => ({ id: String(o.id), owedRwf: num(o.owed) })),
    );
    for (const d of plan.deductions) {
      await tx.execute(sql`
        insert into broker_commission_deductions (commission_id, booking_id, amount_rwf, created_at)
        values (${d.id}, ${bookingId}, ${d.amountRwf}, ${now})`);
      await tx.execute(sql`
        update broker_commissions
           set collected_rwf = collected_rwf + ${d.amountRwf},
               status = case when collected_rwf + ${d.amountRwf} = commission_rwf then 'collected'::broker_commission_status else status end,
               collected_at = case when collected_rwf + ${d.amountRwf} = commission_rwf then ${now} else collected_at end,
               updated_at = ${now}
         where id = ${d.id}`);
    }
    const deductedRwf = plan.deductions.reduce((s, d) => s + d.amountRwf, 0);
    if (deductedRwf > 0) await this.payBrokers(tx, now);
    return { remainingRwf: plan.remainingRwf, deductedRwf };
  },

  /** Name the hotel payout the deductions this stay made came off. */
  async attach(tx: Tx, bookingId: string, payoutId: string): Promise<void> {
    await tx.execute(sql`
      update broker_commission_deductions set payout_id = ${payoutId}
       where booking_id = ${bookingId} and payout_id is null`);
  },

  /**
   * Every fully collected commission without a broker payout gets one: the broker's share, to their MoMo
   * number (`queued`), or `held` until they add one. Keyed by commission, so it is made once.
   */
  async payBrokers(tx: Tx, now: Date): Promise<number> {
    const due = await tx.execute<Record<string, unknown>>(sql`
      select c.id, c.broker_rwf, c.broker_id, b.name as broker_name, w.id as workspace_id,
             a.account_name, a.momo_network::text as momo_network, a.momo_phone,
             g.reference as group_reference
        from broker_commissions c
        join brokers b on b.id = c.broker_id
        join workspaces w on w.user_id = b.user_id and w.kind = 'broker'
        join broker_booking_groups g on g.id = c.group_id
        left join broker_payout_accounts a on a.broker_id = c.broker_id
       where c.status = 'collected' and c.payout_id is null
       for update of c`);
    for (const d of due.rows) {
      const account = d.momo_phone ? { network: String(d.momo_network), phone: String(d.momo_phone) } : null;
      const inserted = await tx.execute<Record<string, unknown>>(sql`
        insert into payouts
          (workspace_id, payee_type, destination, destination_ref, amount_rwf, source, status, scheduled_release_at,
           failure_reason, idempotency_key, payee_name, destination_masked, note)
        values
          (${d.workspace_id}, 'broker', ${account ? 'momo' : null}, ${account?.phone ?? null}, ${num(d.broker_rwf)},
           'broker_commission', ${account ? 'queued' : 'held'}, ${now},
           ${account ? null : NO_BROKER_PAYOUT_NUMBER}, ${`broker-commission:${String(d.id)}`},
           ${(d.account_name as string | null) ?? (d.broker_name as string | null)},
           ${account ? maskBrokerMomo(account.network, account.phone) : null},
           ${`Commission, ${String(d.group_reference)}`})
        on conflict (idempotency_key) do update set updated_at = payouts.updated_at
        returning id`);
      const payoutId = inserted.rows[0]?.id;
      if (payoutId) {
        await tx.execute(sql`update broker_commissions set payout_id = ${payoutId}, updated_at = ${now} where id = ${d.id}`);
      }
    }
    return due.rows.length;
  },
};
