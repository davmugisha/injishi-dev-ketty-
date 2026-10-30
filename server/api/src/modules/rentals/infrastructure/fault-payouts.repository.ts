import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** A repair payout to a fault's fixer, with the fault it pays for. */
export interface FaultPayoutRow {
  payoutId: string;
  ticketId: string;
  workspaceId: string;
  status: 'scheduled' | 'queued' | 'paid' | 'held' | 'failed';
  amountRwf: number;
  payeeName: string | null;
  destination: 'momo' | 'bank' | 'momo_pay' | null;
  destinationMasked: string | null;
  adapterRef: string | null;
  failureReason: string | null;
  idempotencyKey: string | null;
  note: string | null;
  payerMasked: string;
  payeePhone: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  settledAt: Date | null;
}

type Raw = {
  payout_id: string;
  ticket_id: string;
  workspace_id: string;
  status: FaultPayoutRow['status'];
  amount_rwf: string | number | null;
  payee_name: string | null;
  destination: FaultPayoutRow['destination'];
  destination_masked: string | null;
  adapter_ref: string | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  note: string | null;
  payer_masked: string;
  payee_phone: string | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
  settled_at: Date | null;
};

function toRow(r: Raw): FaultPayoutRow {
  return {
    payoutId: r.payout_id,
    ticketId: r.ticket_id,
    workspaceId: r.workspace_id,
    status: r.status,
    amountRwf: Number(r.amount_rwf ?? 0),
    payeeName: r.payee_name,
    destination: r.destination,
    destinationMasked: r.destination_masked,
    adapterRef: r.adapter_ref,
    failureReason: r.failure_reason,
    idempotencyKey: r.idempotency_key,
    note: r.note,
    payerMasked: r.payer_masked,
    payeePhone: r.payee_phone,
    createdByUserId: r.created_by_user_id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    settledAt: r.settled_at ? new Date(r.settled_at) : null,
  };
}

const SELECT = sql`
  select p.id as payout_id, m.ticket_id, p.workspace_id, p.status, p.amount_rwf, p.payee_name, p.destination,
         p.destination_masked, p.adapter_ref, p.failure_reason, p.idempotency_key, p.note, m.payer_masked,
         m.payee_phone, m.created_by_user_id, p.created_at, p.updated_at, p.settled_at
    from maintenance_payouts m
    join payouts p on p.id = m.payout_id
`;

/**
 * Payments to a fault's fixer through Injishi (WP 4.3): a `payouts` row
 * (payee vendor, source repair) and the `maintenance_payouts` row that says
 * which fault it is for. `queued` while the prompt waits on the landlord's
 * phone, then `paid` (and an expense) or `failed` with the reason.
 */
@Injectable()
export class FaultPayoutsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async byKey(key: string, db: DbOrTx = this.db): Promise<FaultPayoutRow | null> {
    const found = await db.execute<Raw>(sql`${SELECT} where p.idempotency_key = ${key}`);
    const r = found.rows[0];
    return r ? toRow(r) : null;
  }

  async find(payoutId: string, db: DbOrTx = this.db, lock = false): Promise<FaultPayoutRow | null> {
    const found = await db.execute<Raw>(sql`${SELECT} where p.id = ${payoutId} ${lock ? sql`for update of p` : sql``}`);
    const r = found.rows[0];
    return r ? toRow(r) : null;
  }

  async forTicket(ticketId: string): Promise<FaultPayoutRow[]> {
    const found = await this.db.execute<Raw>(sql`${SELECT} where m.ticket_id = ${ticketId} order by p.created_at, p.id`);
    return found.rows.map(toRow);
  }

  /** Repair payouts still waiting on the landlord's phone. */
  async waiting(limit = 200): Promise<FaultPayoutRow[]> {
    const found = await this.db.execute<Raw>(sql`
      ${SELECT} where p.source = 'repair' and p.status = 'queued' order by p.created_at limit ${limit}
    `);
    return found.rows.map(toRow);
  }

  /** One waiting repair payout per fault at a time: the one already on the landlord's phone, if any. */
  async waitingForTicket(ticketId: string, db: DbOrTx = this.db): Promise<FaultPayoutRow | null> {
    const found = await db.execute<Raw>(sql`
      ${SELECT} where m.ticket_id = ${ticketId} and p.status = 'queued' order by p.created_at desc limit 1
    `);
    const r = found.rows[0];
    return r ? toRow(r) : null;
  }

  /**
   * Make the payout and its fault link, once per key. Two presses racing on
   * one key make one row; the second answers it.
   */
  async claim(
    tx: DbOrTx,
    v: {
      workspaceId: string;
      ticketId: string;
      amountRwf: number;
      destination: 'momo' | 'bank';
      destinationMasked: string;
      payeeName: string;
      payerMasked: string;
      payeePhone: string | null;
      note: string | null;
      idempotencyKey: string;
      createdByUserId: string;
    },
  ): Promise<FaultPayoutRow> {
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into payouts
        (workspace_id, payee_type, destination, amount_rwf, source, status, scheduled_release_at, idempotency_key,
         payee_name, destination_masked, note, created_by_user_id)
      values (${v.workspaceId}, 'vendor', ${v.destination}::payout_destination, ${v.amountRwf}, 'repair', 'queued', now(),
              ${v.idempotencyKey}, ${v.payeeName}, ${v.destinationMasked}, ${v.note}, ${v.createdByUserId})
      on conflict (idempotency_key) do nothing
      returning id
    `);
    const id = inserted.rows[0]?.id;
    if (id) {
      await tx.execute(sql`
        insert into maintenance_payouts (workspace_id, ticket_id, payout_id, payer_masked, payee_phone, created_by_user_id)
        values (${v.workspaceId}, ${v.ticketId}, ${id}, ${v.payerMasked}, ${v.payeePhone}, ${v.createdByUserId})
      `);
    }
    const row = await this.byKey(v.idempotencyKey, tx);
    if (!row) throw new Error(`repair payout ${v.idempotencyKey} vanished`);
    return row;
  }

  async update(
    db: DbOrTx,
    payoutId: string,
    v: { status?: FaultPayoutRow['status']; adapterRef?: string; failureReason?: string | null; settled?: boolean },
  ): Promise<void> {
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

  /** The repair payout a provider's reference names, if it is one. */
  async byAdapterRef(adapterRef: string): Promise<FaultPayoutRow | null> {
    const found = await this.db.execute<Raw>(sql`${SELECT} where p.adapter_ref = ${adapterRef} and p.source = 'repair'`);
    const r = found.rows[0];
    return r ? toRow(r) : null;
  }
}
