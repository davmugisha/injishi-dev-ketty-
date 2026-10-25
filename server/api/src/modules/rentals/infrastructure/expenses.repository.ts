import type { ExpenseCategory, ExpenseMethod, ExpenseSource, LoanPurpose } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** One expense, with the names a list row shows. */
export interface ExpenseRow {
  id: string;
  orgId: string;
  workspaceId: string;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitLabel: string | null;
  ticketId: string | null;
  ticketTitle: string | null;
  category: ExpenseCategory;
  amountRwf: number;
  paidOn: string;
  method: ExpenseMethod;
  payeeName: string | null;
  payeePhone: string | null;
  note: string | null;
  receiptObjectId: string | null;
  receiptObjectKey: string | null;
  source: ExpenseSource;
  payoutId: string | null;
  loanPurpose: LoanPurpose | null;
  createdByUserId: string | null;
  createdByName: string | null;
  voidedAt: Date | null;
  voidedByName: string | null;
  voidReason: string | null;
  createdAt: Date;
}

export interface NewExpense {
  orgId: string;
  workspaceId: string;
  propertyId: string | null;
  unitId: string | null;
  ticketId: string | null;
  category: ExpenseCategory;
  amountRwf: number;
  paidOn: string;
  method: ExpenseMethod;
  payeeName: string | null;
  payeePhone: string | null;
  note: string | null;
  receiptObjectId: string | null;
  source: ExpenseSource;
  payoutId: string | null;
  loanPurpose: LoanPurpose | null;
  createdByUserId: string | null;
}

type Raw = {
  id: string;
  org_id: string;
  workspace_id: string;
  property_id: string | null;
  property_name: string | null;
  unit_id: string | null;
  unit_label: string | null;
  ticket_id: string | null;
  ticket_title: string | null;
  category: ExpenseCategory;
  amount_rwf: string | number;
  paid_on: string;
  method: ExpenseMethod;
  payee_name: string | null;
  payee_phone: string | null;
  note: string | null;
  receipt_object_id: string | null;
  receipt_object_key: string | null;
  source: ExpenseSource;
  payout_id: string | null;
  loan_purpose: LoanPurpose | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  voided_at: Date | null;
  voided_by_name: string | null;
  void_reason: string | null;
  created_at: Date;
};

function toRow(r: Raw): ExpenseRow {
  return {
    id: r.id,
    orgId: r.org_id,
    workspaceId: r.workspace_id,
    propertyId: r.property_id,
    propertyName: r.property_name,
    unitId: r.unit_id,
    unitLabel: r.unit_label,
    ticketId: r.ticket_id,
    ticketTitle: r.ticket_title,
    category: r.category,
    amountRwf: Number(r.amount_rwf),
    paidOn: r.paid_on,
    method: r.method,
    payeeName: r.payee_name,
    payeePhone: r.payee_phone,
    note: r.note,
    receiptObjectId: r.receipt_object_id,
    receiptObjectKey: r.receipt_object_key,
    source: r.source,
    payoutId: r.payout_id,
    loanPurpose: r.loan_purpose,
    createdByUserId: r.created_by_user_id,
    createdByName: r.created_by_name,
    voidedAt: r.voided_at ? new Date(r.voided_at) : null,
    voidedByName: r.voided_by_name,
    voidReason: r.void_reason,
    createdAt: new Date(r.created_at),
  };
}

const ids = (list: readonly string[]): SQL => sql.join(list.map((id) => sql`${id}::uuid`), sql`, `);

/** Expenses (WP 4.3): money a landlord spent, recorded or paid through Injishi. */
@Injectable()
export class ExpensesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly select = sql`
      select e.id, e.org_id, e.workspace_id, e.property_id, p.name as property_name, e.unit_id, u.label as unit_label,
             e.ticket_id, t.title as ticket_title, e.category, e.amount_rwf, to_char(e.paid_on, 'YYYY-MM-DD') as paid_on,
             e.method, e.payee_name, e.payee_phone, e.note, e.receipt_object_id, so.object_key as receipt_object_key,
             e.source, e.payout_id, e.loan_purpose, e.created_by_user_id, coalesce(cu.name, cu.email) as created_by_name,
             e.voided_at, coalesce(vu.name, vu.email) as voided_by_name, e.void_reason, e.created_at
        from expenses e
        left join properties p on p.id = e.property_id
        left join rental_units u on u.id = e.unit_id
        left join maintenance_tickets t on t.id = e.ticket_id
        left join stored_objects so on so.id = e.receipt_object_id
        left join users cu on cu.id = e.created_by_user_id
        left join users vu on vu.id = e.voided_by_user_id
  `;

  /**
   * A year of a business's expenses, newest first. `buildings` null is every
   * building and the whole-business rows; a list is those buildings only.
   */
  async list(input: {
    orgId: string;
    year: number;
    propertyId: string | null;
    category: ExpenseCategory | null;
    buildings: readonly string[] | null;
  }): Promise<ExpenseRow[]> {
    const parts: SQL[] = [
      sql`e.org_id = ${input.orgId}`,
      sql`e.paid_on between make_date(${input.year}::int, 1, 1) and make_date(${input.year}::int, 12, 31)`,
    ];
    if (input.propertyId) parts.push(sql`e.property_id = ${input.propertyId}`);
    if (input.category) parts.push(sql`e.category = ${input.category}::expense_category`);
    if (input.buildings !== null) parts.push(input.buildings.length > 0 ? sql`e.property_id in (${ids(input.buildings)})` : sql`false`);
    const found = await this.db.execute<Raw>(sql`
      ${this.select} where ${sql.join(parts, sql` and `)} order by e.paid_on desc, e.created_at desc, e.id
    `);
    return found.rows.map(toRow);
  }

  async find(id: string, db: DbOrTx = this.db): Promise<ExpenseRow | null> {
    const found = await db.execute<Raw>(sql`${this.select} where e.id = ${id}`);
    const r = found.rows[0];
    return r ? toRow(r) : null;
  }

  async forTicket(ticketId: string): Promise<ExpenseRow[]> {
    const found = await this.db.execute<Raw>(sql`${this.select} where e.ticket_id = ${ticketId} order by e.created_at, e.id`);
    return found.rows.map(toRow);
  }

  async byPayout(payoutId: string, db: DbOrTx = this.db): Promise<ExpenseRow | null> {
    const found = await db.execute<Raw>(sql`${this.select} where e.payout_id = ${payoutId}`);
    const r = found.rows[0];
    return r ? toRow(r) : null;
  }

  async insert(tx: DbOrTx, v: NewExpense): Promise<string> {
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into expenses
        (org_id, workspace_id, property_id, unit_id, ticket_id, category, amount_rwf, paid_on, method, payee_name,
         payee_phone, note, receipt_object_id, source, payout_id, loan_purpose, created_by_user_id)
      values (${v.orgId}, ${v.workspaceId}, ${v.propertyId}, ${v.unitId}, ${v.ticketId}, ${v.category}::expense_category,
              ${v.amountRwf}, ${v.paidOn}::date, ${v.method}::expense_method, ${v.payeeName}, ${v.payeePhone}, ${v.note},
              ${v.receiptObjectId}, ${v.source}::expense_source, ${v.payoutId}, ${v.loanPurpose}::loan_purpose,
              ${v.createdByUserId})
      returning id
    `);
    return inserted.rows[0]?.id as string;
  }

  /** Void a recorded expense, once. False when it was voided already or was paid through Injishi. */
  async void(tx: DbOrTx, id: string, userId: string, reason: string): Promise<boolean> {
    const updated = await tx.execute(sql`
      update expenses set voided_at = now(), voided_by_user_id = ${userId}, void_reason = ${reason}, updated_at = now()
       where id = ${id} and voided_at is null and source = 'recorded'
    `);
    return (updated.rowCount ?? 0) > 0;
  }

  async setReceipt(tx: DbOrTx, id: string, storedObjectId: string): Promise<void> {
    await tx.execute(sql`update expenses set receipt_object_id = ${storedObjectId}, updated_at = now() where id = ${id}`);
  }

  /** The business's buildings, oldest first: an expense names the only one when there is one. */
  async buildingsOf(workspaceId: string): Promise<string[]> {
    const found = await this.db.execute<{ id: string }>(sql`
      select id from properties where workspace_id = ${workspaceId} and archived_at is null order by created_at, id
    `);
    return found.rows.map((r) => r.id);
  }

  /** A unit of the workspace and its building. */
  async unit(unitId: string): Promise<{ id: string; workspaceId: string; propertyId: string } | null> {
    const found = await this.db.execute<{ id: string; workspace_id: string; property_id: string }>(sql`
      select id, workspace_id, property_id from rental_units where id = ${unitId}
    `);
    const r = found.rows[0];
    return r ? { id: r.id, workspaceId: r.workspace_id, propertyId: r.property_id } : null;
  }

  async property(propertyId: string): Promise<{ id: string; workspaceId: string } | null> {
    const found = await this.db.execute<{ id: string; workspace_id: string }>(sql`select id, workspace_id from properties where id = ${propertyId}`);
    const r = found.rows[0];
    return r ? { id: r.id, workspaceId: r.workspace_id } : null;
  }
}
