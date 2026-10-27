import type { ExpenseCategory, LeaseFilingKind, LeaseFilingStatus, LoanPurpose, TaxDeclarationStatus, TaxpayerKind } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** Rent received in one month of a year, at one building, on one channel. */
export interface RentReceivedRow {
  month: string;
  propertyId: string;
  propertyName: string;
  channel: 'gateway' | 'recorded';
  rentRwf: number;
  depositRwf: number;
  payments: number;
}

/** One expense of the year that counts (not voided). */
export interface TaxExpenseRow {
  id: string;
  category: ExpenseCategory;
  amountRwf: number;
  paidOn: string;
  payeeName: string | null;
  propertyName: string | null;
  loanPurpose: LoanPurpose | null;
  hasReceipt: boolean;
}

export interface TaxDeclarationRow {
  id: string;
  orgId: string;
  year: number;
  status: TaxDeclarationStatus;
  declaredOn: string | null;
  paidOn: string | null;
  amountPaidRwf: number | null;
  rraReference: string | null;
  receiptObjectId: string | null;
  receiptObjectKey: string | null;
  nudgesSent: number;
  updatedAt: Date;
}

export interface FilingRow {
  id: string;
  leaseId: string;
  workspaceId: string;
  orgId: string;
  propertyId: string;
  leaseReference: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  kind: LeaseFilingKind;
  dueOn: string;
  status: LeaseFilingStatus;
  filedOn: string | null;
  reference: string | null;
  proofObjectKey: string | null;
  signedAt: Date | null;
  remindersSent: number;
  createdAt: Date;
}

type RawFiling = {
  id: string;
  lease_id: string;
  workspace_id: string;
  org_id: string;
  property_id: string;
  lease_reference: string;
  tenant_name: string;
  unit_label: string;
  property_name: string;
  kind: LeaseFilingKind;
  due_on: string;
  status: LeaseFilingStatus;
  filed_on: string | null;
  reference: string | null;
  proof_object_key: string | null;
  signed_at: Date | null;
  reminders_sent: number;
  created_at: Date;
};

function toFiling(r: RawFiling): FilingRow {
  return {
    id: r.id,
    leaseId: r.lease_id,
    workspaceId: r.workspace_id,
    orgId: r.org_id,
    propertyId: r.property_id,
    leaseReference: r.lease_reference,
    tenantName: r.tenant_name,
    unitLabel: r.unit_label,
    propertyName: r.property_name,
    kind: r.kind,
    dueOn: r.due_on,
    status: r.status,
    filedOn: r.filed_on,
    reference: r.reference,
    proofObjectKey: r.proof_object_key,
    signedAt: r.signed_at ? new Date(r.signed_at) : null,
    remindersSent: Number(r.reminders_sent ?? 0),
    createdAt: new Date(r.created_at),
  };
}

const FILING_SELECT = sql`
  select f.id, f.lease_id, l.workspace_id, l.org_id, l.property_id, l.reference as lease_reference,
         tn.full_name as tenant_name, u.label as unit_label, p.name as property_name, f.kind,
         to_char(f.due_on, 'YYYY-MM-DD') as due_on, f.status, to_char(f.filed_on, 'YYYY-MM-DD') as filed_on,
         f.reference, so.object_key as proof_object_key, l.signed_at, f.reminders_sent, f.created_at
    from lease_filings f
    join leases l on l.id = f.lease_id
    join tenants tn on tn.id = l.tenant_id
    join rental_units u on u.id = l.unit_id
    join properties p on p.id = l.property_id
    left join stored_objects so on so.id = f.proof_object_id
`;

const ids = (list: readonly string[]): SQL => sql.join(list.map((id) => sql`${id}::uuid`), sql`, `);

/** The tax page's reads and writes (WP 4.4): rent received, the year's costs, the declaration, lease filings. */
@Injectable()
export class TaxesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  /**
   * Rent received in `year` by month, building and channel: succeeded
   * payments (through Injishi or recorded), on the Kigali day they were
   * received (a recorded payment's own day; a gateway one's settlement), less
   * whatever part of each paid a deposit charge. A reversed payment is not
   * money received.
   */
  async rentReceived(workspaceId: string, year: number): Promise<RentReceivedRow[]> {
    const found = await this.db.execute<{
      month: string;
      property_id: string;
      property_name: string;
      channel: 'gateway' | 'recorded';
      rent_rwf: string | number;
      deposit_rwf: string | number;
      payments: number;
    }>(sql`
      select to_char(x.day, 'YYYY-MM') as month, x.property_id, p.name as property_name, x.channel,
             sum(x.rent)::bigint as rent_rwf, sum(x.deposit)::bigint as deposit_rwf,
             count(*) filter (where x.rent > 0)::int as payments
        from (
          select lp.property_id, lp.channel,
                 case when lp.channel = 'recorded' then lp.received_on
                      else (lp.succeeded_at at time zone 'Africa/Kigali')::date end as day,
                 lp.amount_rwf - coalesce(d.deposit, 0) as rent,
                 coalesce(d.deposit, 0) as deposit
            from lease_payments lp
            left join lateral (
              select sum(a.amount_rwf) as deposit
                from lease_payment_allocations a
                join lease_charges c on c.id = a.charge_id
               where a.payment_id = lp.id and a.released_at is null and c.kind = 'deposit'
            ) d on true
           where lp.workspace_id = ${workspaceId} and lp.status = 'succeeded'
        ) x
        join properties p on p.id = x.property_id
       where x.day between make_date(${year}::int, 1, 1) and make_date(${year}::int, 12, 31)
       group by 1, 2, 3, 4
       order by 1, 3
    `);
    return found.rows.map((r) => ({
      month: r.month,
      propertyId: r.property_id,
      propertyName: r.property_name,
      channel: r.channel,
      rentRwf: Number(r.rent_rwf),
      depositRwf: Number(r.deposit_rwf),
      payments: Number(r.payments),
    }));
  }

  /** The year's expenses that count: not voided, by Kigali day paid. */
  async expenses(orgId: string, year: number): Promise<TaxExpenseRow[]> {
    const found = await this.db.execute<{
      id: string;
      category: ExpenseCategory;
      amount_rwf: string | number;
      paid_on: string;
      payee_name: string | null;
      property_name: string | null;
      loan_purpose: LoanPurpose | null;
      has_receipt: boolean;
    }>(sql`
      select e.id, e.category, e.amount_rwf, to_char(e.paid_on, 'YYYY-MM-DD') as paid_on, e.payee_name,
             p.name as property_name, e.loan_purpose, (e.receipt_object_id is not null) as has_receipt
        from expenses e
        left join properties p on p.id = e.property_id
       where e.org_id = ${orgId} and e.voided_at is null
         and e.paid_on between make_date(${year}::int, 1, 1) and make_date(${year}::int, 12, 31)
       order by e.paid_on, e.created_at, e.id
    `);
    return found.rows.map((r) => ({
      id: r.id,
      category: r.category,
      amountRwf: Number(r.amount_rwf),
      paidOn: r.paid_on,
      payeeName: r.payee_name,
      propertyName: r.property_name,
      loanPurpose: r.loan_purpose,
      hasReceipt: Boolean(r.has_receipt),
    }));
  }

  async taxpayerKind(orgId: string): Promise<TaxpayerKind | null> {
    const found = await this.db.execute<{ taxpayer_kind: TaxpayerKind | null }>(sql`select taxpayer_kind from landlord_profiles where org_id = ${orgId}`);
    return found.rows[0]?.taxpayer_kind ?? null;
  }

  async setTaxpayerKind(tx: DbOrTx, orgId: string, kind: TaxpayerKind): Promise<TaxpayerKind | null> {
    const before = await tx.execute<{ taxpayer_kind: TaxpayerKind | null }>(sql`select taxpayer_kind from landlord_profiles where org_id = ${orgId} for update`);
    await tx.execute(sql`update landlord_profiles set taxpayer_kind = ${kind}::taxpayer_kind, updated_at = now() where org_id = ${orgId}`);
    return before.rows[0]?.taxpayer_kind ?? null;
  }

  async declaration(orgId: string, year: number, db: DbOrTx = this.db): Promise<TaxDeclarationRow | null> {
    const found = await db.execute<{
      id: string;
      org_id: string;
      year: number;
      status: TaxDeclarationStatus;
      declared_on: string | null;
      paid_on: string | null;
      amount_paid_rwf: string | number | null;
      rra_reference: string | null;
      receipt_object_id: string | null;
      receipt_object_key: string | null;
      nudges_sent: number;
      updated_at: Date;
    }>(sql`
      select d.id, d.org_id, d.year, d.status, to_char(d.declared_on, 'YYYY-MM-DD') as declared_on,
             to_char(d.paid_on, 'YYYY-MM-DD') as paid_on, d.amount_paid_rwf, d.rra_reference, d.receipt_object_id,
             so.object_key as receipt_object_key, d.nudges_sent, d.updated_at
        from tax_declarations d
        left join stored_objects so on so.id = d.receipt_object_id
       where d.org_id = ${orgId} and d.year = ${year}
    `);
    const r = found.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      orgId: r.org_id,
      year: Number(r.year),
      status: r.status,
      declaredOn: r.declared_on,
      paidOn: r.paid_on,
      amountPaidRwf: r.amount_paid_rwf === null ? null : Number(r.amount_paid_rwf),
      rraReference: r.rra_reference,
      receiptObjectId: r.receipt_object_id,
      receiptObjectKey: r.receipt_object_key,
      nudgesSent: Number(r.nudges_sent ?? 0),
      updatedAt: new Date(r.updated_at),
    };
  }

  /** Write the year's declaration as the landlord tells it (one row per business and year). */
  async saveDeclaration(
    tx: DbOrTx,
    v: {
      orgId: string;
      workspaceId: string;
      year: number;
      status: TaxDeclarationStatus;
      declaredOn: string | null;
      paidOn: string | null;
      amountPaidRwf: number | null;
      rraReference: string | null;
      receiptObjectId: string | null;
      userId: string;
    },
  ): Promise<string> {
    const saved = await tx.execute<{ id: string }>(sql`
      insert into tax_declarations
        (org_id, workspace_id, year, status, declared_on, paid_on, amount_paid_rwf, rra_reference, receipt_object_id, updated_by_user_id)
      values (${v.orgId}, ${v.workspaceId}, ${v.year}, ${v.status}::tax_declaration_status, ${v.declaredOn}::date, ${v.paidOn}::date,
              ${v.amountPaidRwf}, ${v.rraReference}, ${v.receiptObjectId}, ${v.userId})
      on conflict (org_id, year) do update
        set status = excluded.status, declared_on = excluded.declared_on, paid_on = excluded.paid_on,
            amount_paid_rwf = excluded.amount_paid_rwf, rra_reference = excluded.rra_reference,
            receipt_object_id = excluded.receipt_object_id, updated_by_user_id = excluded.updated_by_user_id,
            updated_at = now()
      returning id
    `);
    return saved.rows[0]?.id as string;
  }

  // --- Lease filings ----------------------------------------------------------------------

  async filings(input: {
    workspaceId: string;
    buildings: readonly string[] | null;
    year: number | null;
    status: LeaseFilingStatus | null;
  }): Promise<FilingRow[]> {
    const parts: SQL[] = [sql`l.workspace_id = ${input.workspaceId}`];
    if (input.buildings !== null) parts.push(input.buildings.length > 0 ? sql`l.property_id in (${ids(input.buildings)})` : sql`false`);
    if (input.year !== null) parts.push(sql`extract(year from f.due_on) = ${input.year}`);
    if (input.status) parts.push(sql`f.status = ${input.status}::filing_status`);
    const found = await this.db.execute<RawFiling>(sql`${FILING_SELECT} where ${sql.join(parts, sql` and `)} order by f.due_on, f.created_at`);
    return found.rows.map(toFiling);
  }

  async filing(id: string, db: DbOrTx = this.db, lock = false): Promise<FilingRow | null> {
    const found = await db.execute<RawFiling>(sql`${FILING_SELECT} where f.id = ${id} ${lock ? sql`for update of f` : sql``}`);
    const r = found.rows[0];
    return r ? toFiling(r) : null;
  }

  async markFiled(tx: DbOrTx, v: { id: string; filedOn: string; reference: string | null; proofObjectId: string | null; userId: string }): Promise<void> {
    await tx.execute(sql`
      update lease_filings
         set status = 'filed', filed_on = ${v.filedOn}::date, reference = ${v.reference},
             proof_object_id = coalesce(${v.proofObjectId}, proof_object_id), filed_by_user_id = ${v.userId}, updated_at = now()
       where id = ${v.id}
    `);
  }

  // --- The housekeeping job ---------------------------------------------------------------------

  /** Filings still due whose day is within `withinDays` of `today`, not past it. */
  async filingsDueSoon(today: string, withinDays: number): Promise<FilingRow[]> {
    const found = await this.db.execute<RawFiling>(sql`
      ${FILING_SELECT}
       where f.status = 'pending' and f.due_on >= ${today}::date and f.due_on <= ${today}::date + ${withinDays}::int
       order by f.due_on
    `);
    return found.rows.map(toFiling);
  }

  /** Claim a filing reminder stage; true once per stage. */
  async claimFilingReminder(id: string, stage: number): Promise<boolean> {
    const updated = await this.db.execute(sql`
      update lease_filings set reminders_sent = ${stage}, updated_at = now()
       where id = ${id} and status = 'pending' and reminders_sent < ${stage}
    `);
    return (updated.rowCount ?? 0) > 0;
  }

  /**
   * The residence businesses that owe a declaration for `year`: not a
   * company, with rent received that year, and not declared yet.
   */
  async orgsToNudge(year: number): Promise<{ orgId: string; workspaceId: string; legalName: string; taxpayerKind: TaxpayerKind | null }[]> {
    const found = await this.db.execute<{ org_id: string; workspace_id: string; legal_name: string; taxpayer_kind: TaxpayerKind | null }>(sql`
      select lp.org_id, lp.workspace_id, o.legal_name, lp.taxpayer_kind
        from landlord_profiles lp
        join orgs o on o.id = lp.org_id
       where (lp.taxpayer_kind is null or lp.taxpayer_kind = 'individual')
         and exists (
           select 1 from lease_payments p
            where p.workspace_id = lp.workspace_id and p.status = 'succeeded'
              and case when p.channel = 'recorded' then p.received_on
                       else (p.succeeded_at at time zone 'Africa/Kigali')::date end
                  between make_date(${year}::int, 1, 1) and make_date(${year}::int, 12, 31))
         and not exists (
           select 1 from tax_declarations d where d.org_id = lp.org_id and d.year = ${year} and d.status <> 'not_started')
    `);
    return found.rows.map((r) => ({ orgId: r.org_id, workspaceId: r.workspace_id, legalName: r.legal_name, taxpayerKind: r.taxpayer_kind }));
  }

  /** Claim a January nudge stage for a business's year; true once per stage, never once declared. */
  async claimNudge(orgId: string, workspaceId: string, year: number, stage: number): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        insert into tax_declarations (org_id, workspace_id, year) values (${orgId}, ${workspaceId}, ${year})
        on conflict (org_id, year) do nothing
      `);
      const updated = await tx.execute(sql`
        update tax_declarations set nudges_sent = ${stage}, updated_at = now()
         where org_id = ${orgId} and year = ${year} and status = 'not_started' and nudges_sent < ${stage}
      `);
      return (updated.rowCount ?? 0) > 0;
    });
  }

  /** Invitations past their day are expired, so a fresh one can be sent in their place. */
  async expireInvitations(now: Date): Promise<number> {
    const updated = await this.db.execute(sql`
      update lease_invitations set status = 'expired', updated_at = now() where status = 'sent' and expires_at < ${now}
    `);
    return updated.rowCount ?? 0;
  }

  /** Signing codes never used and past their day by a day: nothing can sign with them, so they go. */
  async removeLapsedSigningCodes(now: Date): Promise<number> {
    const removed = await this.db.execute(sql`
      delete from lease_signing_codes where consumed_at is null and expires_at < ${now}::timestamptz - interval '1 day'
    `);
    return removed.rowCount ?? 0;
  }
}
