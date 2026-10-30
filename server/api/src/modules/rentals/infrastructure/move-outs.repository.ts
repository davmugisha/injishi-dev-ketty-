import { Inject, Injectable } from '@nestjs/common';
import type { DepositRefundMethod, LeaseStatus, MoveOutNoticeChannel, MoveOutReasonCode } from '@injishi/contracts';
import { and, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';

import { leaseDeposits, moveOutNotices } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

export type NoticeRow = typeof moveOutNotices.$inferSelect;
type DepositTable = typeof leaseDeposits.$inferSelect;

/** A deposit with what was paid on its charge and where a refund through Injishi stands. */
export interface DepositRow extends DepositTable {
  paidRwf: number;
  chargeStatus: 'open' | 'paid' | 'waived';
  payoutStatus: 'scheduled' | 'queued' | 'paid' | 'held' | 'failed' | null;
  payoutDestination: string | null;
  payoutFailureReason: string | null;
  payoutAdapterRef: string | null;
  payoutCreatedAt: Date | null;
}

/** One lease on the move-outs page, with its live notice and deposit. */
export interface MoveOutLeaseRow {
  leaseId: string;
  reference: string;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  noticeDays: number;
  endedOn: string | null;
  propertyId: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
}

/** A deposit refund through Injishi waiting on the landlord's phone. */
export interface RefundPayoutRow {
  payoutId: string;
  depositId: string;
  leaseId: string;
  workspaceId: string;
  status: 'scheduled' | 'queued' | 'paid' | 'held' | 'failed';
  amountRwf: number;
  adapterRef: string | null;
  destinationMasked: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

/** A notice waiting for the landlord past the nudge day, with where to tell them. */
export interface StaleNoticeRow {
  noticeId: string;
  leaseId: string;
  workspaceId: string;
  orgId: string;
  reference: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  filedOn: string;
  moveOutOn: string;
}

const DEPOSIT_SELECT = sql`
  select d.*, c.paid_rwf as charge_paid_rwf, c.status as charge_status,
         p.status as payout_status, p.destination_masked as payout_destination, p.failure_reason as payout_failure_reason,
         p.adapter_ref as payout_adapter_ref, p.created_at as payout_created_at
    from lease_deposits d
    join lease_charges c on c.id = d.charge_id
    left join payouts p on p.id = d.refund_payout_id
`;

type RawDeposit = Record<string, unknown>;

function toDeposit(r: RawDeposit): DepositRow {
  const date = (v: unknown): Date | null => (v ? new Date(v as string) : null);
  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    leaseId: r.lease_id as string,
    agreedRwf: Number(r.agreed_rwf),
    chargeId: r.charge_id as string,
    status: r.status as DepositTable['status'],
    keptRwf: num(r.kept_rwf),
    refundedRwf: num(r.refunded_rwf),
    deductions: (r.deductions ?? []) as DepositTable['deductions'],
    refundMethod: (r.refund_method ?? null) as DepositRefundMethod | null,
    refundPayoutId: (r.refund_payout_id ?? null) as string | null,
    refundReference: (r.refund_reference ?? null) as string | null,
    settledAt: date(r.settled_at),
    settledByUserId: (r.settled_by_user_id ?? null) as string | null,
    tenantDisputedAt: date(r.tenant_disputed_at),
    disputeNote: (r.dispute_note ?? null) as string | null,
    idempotencyKey: (r.idempotency_key ?? null) as string | null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    paidRwf: Number(r.charge_paid_rwf ?? 0),
    chargeStatus: r.charge_status as DepositRow['chargeStatus'],
    payoutStatus: (r.payout_status ?? null) as DepositRow['payoutStatus'],
    payoutDestination: (r.payout_destination ?? null) as string | null,
    payoutFailureReason: (r.payout_failure_reason ?? null) as string | null,
    payoutAdapterRef: (r.payout_adapter_ref ?? null) as string | null,
    payoutCreatedAt: date(r.payout_created_at),
  };
}

/**
 * Notices, the moved-out day's side effects, and deposits (WP 1.7): one live
 * notice per lease (the partial unique index), rent after the move out waived,
 * the district told within 30 days (a `termination` filing), and a deposit's
 * settlement with its refund payout (payee tenant, source deposit_refund).
 */
@Injectable()
export class MoveOutsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Notices -----------------------------------------------------------------------

  /** The notice still standing on a lease (submitted or acknowledged). */
  async liveNotice(leaseId: string, db: DbOrTx = this.db, lock = false): Promise<NoticeRow | null> {
    const q = db
      .select()
      .from(moveOutNotices)
      .where(and(eq(moveOutNotices.leaseId, leaseId), ne(moveOutNotices.status, 'withdrawn')))
      .limit(1);
    const [row] = lock ? await q.for('update') : await q;
    return row ?? null;
  }

  /** The live notices of many leases, by lease. */
  async liveNotices(leaseIds: readonly string[]): Promise<Map<string, NoticeRow>> {
    if (leaseIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(moveOutNotices)
      .where(and(inArray(moveOutNotices.leaseId, [...leaseIds]), ne(moveOutNotices.status, 'withdrawn')));
    return new Map(rows.map((r) => [r.leaseId, r]));
  }

  async insertNotice(
    tx: DbOrTx,
    v: {
      leaseId: string;
      filedByRole: 'tenant' | 'landlord';
      filedByUserId: string;
      channel: MoveOutNoticeChannel;
      filedOn: string;
      moveOutOn: string;
      reasonCode: MoveOutReasonCode;
      message: string | null;
      noticeDays: number;
      isShortNotice: boolean;
    },
  ): Promise<NoticeRow> {
    const [row] = await tx.insert(moveOutNotices).values({ ...v, status: 'submitted' }).returning();
    if (!row) throw new Error('notice insert returned nothing');
    return row;
  }

  async acknowledge(tx: DbOrTx, id: string, userId: string): Promise<void> {
    await tx
      .update(moveOutNotices)
      .set({ status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedByUserId: userId })
      .where(eq(moveOutNotices.id, id));
  }

  async withdraw(tx: DbOrTx, id: string): Promise<void> {
    await tx.update(moveOutNotices).set({ status: 'withdrawn', withdrawnAt: new Date() }).where(eq(moveOutNotices.id, id));
  }

  /** Notices still to acknowledge, filed on or before `filedBy`, never nudged about. */
  async staleNotices(filedBy: string, limit = 200): Promise<StaleNoticeRow[]> {
    const found = await this.db.execute<{
      notice_id: string;
      lease_id: string;
      workspace_id: string;
      org_id: string;
      reference: string;
      tenant_name: string;
      unit_label: string;
      property_name: string;
      filed_on: string;
      move_out_on: string;
    }>(sql`
      select n.id as notice_id, l.id as lease_id, l.workspace_id, l.org_id, l.reference, t.full_name as tenant_name,
             u.label as unit_label, p.name as property_name, n.filed_on::text as filed_on, n.move_out_on::text as move_out_on
        from move_out_notices n
        join leases l on l.id = n.lease_id
        join tenants t on t.id = l.tenant_id
        join rental_units u on u.id = l.unit_id
        join properties p on p.id = l.property_id
       where n.status = 'submitted' and n.nudged_at is null and n.filed_on <= ${filedBy}::date
         and l.status in ('active', 'ending')
       order by n.filed_on
       limit ${limit}
    `);
    return found.rows.map((r) => ({
      noticeId: r.notice_id,
      leaseId: r.lease_id,
      workspaceId: r.workspace_id,
      orgId: r.org_id,
      reference: r.reference,
      tenantName: r.tenant_name,
      unitLabel: r.unit_label,
      propertyName: r.property_name,
      filedOn: r.filed_on,
      moveOutOn: r.move_out_on,
    }));
  }

  /** Claim the one nudge about a notice. False when another run already claimed it. */
  async claimNudge(noticeId: string): Promise<boolean> {
    const done = await this.db.execute(sql`
      update move_out_notices set nudged_at = now() where id = ${noticeId} and nudged_at is null and status = 'submitted'
    `);
    return (done.rowCount ?? 0) > 0;
  }

  // --- Moving out --------------------------------------------------------------------

  /**
   * Waive the rent charged for periods that start after the moved-out day
   * and that nothing was paid on. Answers the charges waived.
   */
  async waiveRentAfter(tx: DbOrTx, leaseId: string, movedOutOn: string, reason: string): Promise<{ id: string; periodStart: string; amountRwf: number }[]> {
    const done = await tx.execute<{ id: string; period_start: string; amount_rwf: string | number }>(sql`
      update lease_charges
         set status = 'waived', waived_reason = ${reason}, updated_at = now()
       where lease_id = ${leaseId} and kind = 'rent' and status = 'open' and paid_rwf = 0
         and period_start > ${movedOutOn}::date
      returning id, period_start::text as period_start, amount_rwf
    `);
    return done.rows.map((r) => ({ id: r.id, periodStart: r.period_start, amountRwf: Number(r.amount_rwf) }));
  }

  /** The `termination` filing: the district hears within 30 days. Null when the lease already has one. */
  async openTerminationFiling(tx: DbOrTx, leaseId: string, dueOn: string): Promise<string | null> {
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into lease_filings (lease_id, kind, due_on, status)
      values (${leaseId}, 'termination', ${dueOn}::date, 'pending')
      on conflict do nothing
      returning id
    `);
    return inserted.rows[0]?.id ?? null;
  }

  // --- The list ------------------------------------------------------------------------

  /**
   * The leases the move-outs page can show: ending or ended, or running with
   * a notice still to acknowledge. Newest change first.
   */
  async moveOutLeases(workspaceId: string, scope: SQL | null, q: string | null, limit = 300): Promise<MoveOutLeaseRow[]> {
    const term = q?.trim();
    const like = term ? `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const found = await this.db.execute<{
      lease_id: string;
      reference: string;
      status: LeaseStatus;
      start_date: string;
      end_date: string;
      notice_days: number;
      ended_on: string | null;
      property_id: string;
      tenant_name: string;
      unit_label: string;
      property_name: string;
    }>(sql`
      select l.id as lease_id, l.reference, l.status, l.start_date::text as start_date, l.end_date::text as end_date,
             l.notice_days, l.ended_on::text as ended_on, l.property_id, t.full_name as tenant_name,
             u.label as unit_label, p.name as property_name
        from leases l
        join tenants t on t.id = l.tenant_id
        join rental_units u on u.id = l.unit_id
        join properties p on p.id = l.property_id
       where l.workspace_id = ${workspaceId}
         ${scope ? sql`and ${scope}` : sql``}
         and (l.status in ('ending', 'ended')
              or (l.status = 'active' and exists (
                    select 1 from move_out_notices n where n.lease_id = l.id and n.status = 'submitted')))
         ${like ? sql`and (l.reference ilike ${like} or t.full_name ilike ${like} or u.label ilike ${like})` : sql``}
       order by l.updated_at desc, l.id desc
       limit ${limit}
    `);
    return found.rows.map((r) => ({
      leaseId: r.lease_id,
      reference: r.reference,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      noticeDays: Number(r.notice_days),
      endedOn: r.ended_on,
      propertyId: r.property_id,
      tenantName: r.tenant_name,
      unitLabel: r.unit_label,
      propertyName: r.property_name,
    }));
  }

  // --- Deposits ----------------------------------------------------------------------

  async depositOfLease(leaseId: string, db: DbOrTx = this.db): Promise<DepositRow | null> {
    const found = await db.execute<RawDeposit>(sql`${DEPOSIT_SELECT} where d.lease_id = ${leaseId}`);
    const r = found.rows[0];
    return r ? toDeposit(r) : null;
  }

  async depositsOfLeases(leaseIds: readonly string[]): Promise<Map<string, DepositRow>> {
    if (leaseIds.length === 0) return new Map();
    const found = await this.db.execute<RawDeposit>(
      sql`${DEPOSIT_SELECT} where d.lease_id in (${sql.join(leaseIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
    );
    return new Map(found.rows.map((r) => [r.lease_id as string, toDeposit(r)]));
  }

  async deposit(id: string, db: DbOrTx = this.db, lock = false): Promise<DepositRow | null> {
    const found = await db.execute<RawDeposit>(sql`${DEPOSIT_SELECT} where d.id = ${id} ${lock ? sql`for update of d` : sql``}`);
    const r = found.rows[0];
    return r ? toDeposit(r) : null;
  }

  async depositByKey(key: string): Promise<DepositRow | null> {
    const found = await this.db.execute<RawDeposit>(sql`${DEPOSIT_SELECT} where d.idempotency_key = ${key}`);
    const r = found.rows[0];
    return r ? toDeposit(r) : null;
  }

  /** Every deposit of the business with its lease, newest first. */
  async deposits(workspaceId: string, scope: SQL | null): Promise<{ deposit: DepositRow; lease: MoveOutLeaseRow }[]> {
    const found = await this.db.execute<RawDeposit>(sql`
      select x.*, l.reference, l.status as lease_status, l.start_date::text as start_date, l.end_date::text as end_date,
             l.notice_days, l.ended_on::text as ended_on, l.property_id, t.full_name as tenant_name,
             u.label as unit_label, p.name as property_name
        from (${DEPOSIT_SELECT}) x
        join leases l on l.id = x.lease_id
        join tenants t on t.id = l.tenant_id
        join rental_units u on u.id = l.unit_id
        join properties p on p.id = l.property_id
       where x.workspace_id = ${workspaceId} ${scope ? sql`and ${scope}` : sql``}
       order by x.updated_at desc
       limit 500
    `);
    return found.rows.map((r) => ({
      deposit: toDeposit(r),
      lease: {
        leaseId: r.lease_id as string,
        reference: r.reference as string,
        status: r.lease_status as LeaseStatus,
        startDate: r.start_date as string,
        endDate: r.end_date as string,
        noticeDays: Number(r.notice_days),
        endedOn: (r.ended_on ?? null) as string | null,
        propertyId: r.property_id as string,
        tenantName: r.tenant_name as string,
        unitLabel: r.unit_label as string,
        propertyName: r.property_name as string,
      },
    }));
  }

  /** Write a settlement, or its waiting refund, on the deposit row. */
  async updateDeposit(tx: DbOrTx, id: string, values: Partial<DepositTable>): Promise<void> {
    await tx
      .update(leaseDeposits)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(leaseDeposits.id, id));
  }

  /** A deposit refund through Injishi: a payout to the tenant, queued while the prompt waits on the landlord's phone. */
  async claimRefundPayout(
    tx: DbOrTx,
    v: { workspaceId: string; amountRwf: number; payeeName: string; destinationMasked: string; idempotencyKey: string; createdByUserId: string; note: string | null },
  ): Promise<string> {
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into payouts
        (workspace_id, payee_type, destination, amount_rwf, source, status, scheduled_release_at, idempotency_key,
         payee_name, destination_masked, note, created_by_user_id)
      values (${v.workspaceId}, 'tenant', 'momo', ${v.amountRwf}, 'deposit_refund', 'queued', now(), ${v.idempotencyKey},
              ${v.payeeName}, ${v.destinationMasked}, ${v.note}, ${v.createdByUserId})
      on conflict (idempotency_key) do update set updated_at = payouts.updated_at
      returning id
    `);
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error(`deposit refund ${v.idempotencyKey} vanished`);
    return id;
  }

  async refundPayout(payoutId: string, db: DbOrTx = this.db, lock = false): Promise<RefundPayoutRow | null> {
    const found = await db.execute<{
      payout_id: string;
      deposit_id: string;
      lease_id: string;
      workspace_id: string;
      status: RefundPayoutRow['status'];
      amount_rwf: string | number;
      adapter_ref: string | null;
      destination_masked: string | null;
      created_by_user_id: string | null;
      created_at: Date;
    }>(sql`
      select p.id as payout_id, d.id as deposit_id, d.lease_id, p.workspace_id, p.status, p.amount_rwf, p.adapter_ref,
             p.destination_masked, p.created_by_user_id, p.created_at
        from payouts p
        join lease_deposits d on d.refund_payout_id = p.id
       where p.id = ${payoutId} and p.source = 'deposit_refund'
       ${lock ? sql`for update of p` : sql``}
    `);
    const r = found.rows[0];
    if (!r) return null;
    return {
      payoutId: r.payout_id,
      depositId: r.deposit_id,
      leaseId: r.lease_id,
      workspaceId: r.workspace_id,
      status: r.status,
      amountRwf: Number(r.amount_rwf),
      adapterRef: r.adapter_ref,
      destinationMasked: r.destination_masked,
      createdByUserId: r.created_by_user_id,
      createdAt: new Date(r.created_at),
    };
  }

  /** Deposit refunds still waiting on the landlord's phone. */
  async waitingRefunds(limit = 200): Promise<string[]> {
    const found = await this.db.execute<{ id: string }>(sql`
      select p.id from payouts p join lease_deposits d on d.refund_payout_id = p.id
       where p.source = 'deposit_refund' and p.status = 'queued' order by p.created_at limit ${limit}
    `);
    return found.rows.map((r) => r.id);
  }

  async refundByAdapterRef(adapterRef: string): Promise<string | null> {
    const found = await this.db.execute<{ id: string }>(sql`
      select id from payouts where adapter_ref = ${adapterRef} and source = 'deposit_refund' limit 1
    `);
    return found.rows[0]?.id ?? null;
  }

  async updatePayout(db: DbOrTx, payoutId: string, v: { status?: RefundPayoutRow['status']; adapterRef?: string; failureReason?: string | null; settled?: boolean }): Promise<void> {
    await db.execute(sql`
      update payouts
         set status = coalesce(${v.status ?? null}::payout_status, status),
             adapter_ref = coalesce(${v.adapterRef ?? null}, adapter_ref),
             failure_reason = ${v.failureReason === undefined ? sql`failure_reason` : sql`${v.failureReason}`},
             settled_at = ${v.settled ? sql`now()` : sql`settled_at`},
             updated_at = now()
       where id = ${payoutId}
    `);
  }
}
