import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The broker's own reads and writes (ADR-038 child 6).
 *
 * Every query here begins from a `brokers.id` the SERVICE resolved from the
 * workspace, never from an id in a request. That is the whole of AC-B8: there
 * is no parameter through which one broker could name another.
 *
 * Raw SQL rather than the builder because every read is four or five joins
 * with correlated counts, and the builder version was harder to check against
 * the schema than the query itself.
 */

export interface BrokerSelfRow {
  id: string;
  status: 'active' | 'suspended';
}

export interface DirectoryRow {
  listingId: string;
  propertyName: string;
  landlordName: string;
  district: string | null;
  roomTypeId: string | null;
  unitName: string | null;
  monthlyRentRwf: number | null;
  cautionRwf: number | null;
  vacantUnits: number;
  totalUnits: number;
}

export interface RevealRow {
  id: string;
  listingId: string;
  phone: string | null;
  email: string | null;
  revealedAt: Date;
}

export interface ListingContactRow {
  listingId: string;
  landlordOrgId: string;
  phone: string | null;
  email: string | null;
}

export interface CreditEntryRow {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  propertyName: string | null;
  createdAt: Date;
}

export interface PlacementRow {
  id: string;
  listingId: string | null;
  propertyName: string | null;
  landlordName: string | null;
  status: 'initiated' | 'converted' | 'abandoned' | 'unavailable';
  initiatedAt: Date;
  leaseId: string | null;
  unitLabel: string | null;
  tenantName: string | null;
  leaseStatus: string | null;
  startDate: string | null;
  feeAmountRwf: number | null;
  feeStatus: 'pending' | 'disbursed' | null;
}

export interface FeeRow {
  id: string;
  leaseId: string;
  tenantName: string | null;
  unitLabel: string | null;
  landlordName: string | null;
  amountRwf: number | null;
  status: 'pending' | 'disbursed';
  updatedAt: Date;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** A `numeric`/`bigint` column arrives as a string; an amount is a whole RWF. */
function int(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

@Injectable()
export class BrokerOpsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The broker row behind a broker workspace: `workspaces.user_id` → `brokers.user_id`. */
  async brokerForWorkspace(workspaceId: string): Promise<BrokerSelfRow | null> {
    const result = await this.db.execute<{ id: string; status: 'active' | 'suspended' }>(sql`
      select b.id, b.status
        from workspaces w
        join brokers b on b.user_id = w.user_id
       where w.id = ${workspaceId}
         and w.kind = 'broker'
    `);
    return result.rows[0] ?? null;
  }

  async balance(brokerId: string, tx: Tx | Database = this.db): Promise<number> {
    const result = await tx.execute<{ balance: string }>(sql`
      select coalesce(sum(delta), 0)::text as balance
        from broker_reveal_credits
       where broker_id = ${brokerId}
    `);
    return Number(result.rows[0]?.balance ?? 0);
  }

  /**
   * Every unit type on every published residence listing of an ACTIVE org.
   *
   * An org still in the registration pipeline is not on the directory, for the
   * same reason it holds no permissions: "no listing before approval" (D20).
   *
   * Rent and caution read the default active rate plan and fall back to the
   * room type's own columns, which is the migration's documented read path
   * while the residence seeds carry no rate plan. A listing with no active
   * residence unit type still appears, with no units, so a broker is not told
   * a landlord is absent when they are only unfurnished.
   */
  async directory(): Promise<DirectoryRow[]> {
    const result = await this.db.execute<{
      listing_id: string;
      property_name: string;
      landlord_name: string;
      district: string | null;
      room_type_id: string | null;
      unit_name: string | null;
      monthly_rent_rwf: string | null;
      caution_rwf: string | null;
      vacant_units: number;
      total_units: number;
    }>(sql`
      select l.id as listing_id,
             p.name as property_name,
             o.legal_name as landlord_name,
             d.name as district,
             rt.id as room_type_id,
             rt.name as unit_name,
             coalesce(rp.base_price_rwf, rt.base_price_rwf)::text as monthly_rent_rwf,
             coalesce(rp.caution_rwf, rt.caution_rwf)::text as caution_rwf,
             (select count(*) from rooms r
               where r.room_type_id = rt.id
                 and not exists (select 1 from leases le
                                  where le.room_id = r.id and le.status = 'active'))::int as vacant_units,
             (select count(*) from rooms r where r.room_type_id = rt.id)::int as total_units
        from listings l
        join properties p on p.id = l.property_id
        join workspaces w on w.id = l.workspace_id
        join orgs o on o.id = w.org_id
        left join districts d on d.id = p.district_id
        left join room_types rt
               on rt.property_id = p.id
              and rt.domain = 'residence'
              and rt.status = 'active'
        left join rate_plans rp
               on rp.room_type_id = rt.id
              and rp.is_default
              and rp.status = 'active'
       where l.status = 'published'
         and o.domain = 'residence'
         and o.registration_status = 'active'
       order by p.name, l.id, rt.name
    `);
    return result.rows.map((r) => ({
      listingId: r.listing_id,
      propertyName: r.property_name,
      landlordName: r.landlord_name,
      district: r.district,
      roomTypeId: r.room_type_id,
      unitName: r.unit_name,
      monthlyRentRwf: int(r.monthly_rent_rwf),
      cautionRwf: int(r.caution_rwf),
      vacantUnits: r.vacant_units,
      totalUnits: r.total_units,
    }));
  }

  async reveals(brokerId: string, tx: Tx | Database = this.db): Promise<RevealRow[]> {
    const result = await tx.execute<{
      id: string;
      listing_id: string;
      revealed_phone: string | null;
      revealed_email: string | null;
      revealed_at: Date;
    }>(sql`
      select distinct on (listing_id) id, listing_id, revealed_phone, revealed_email, revealed_at
        from contact_reveals
       where broker_id = ${brokerId}
         and listing_id is not null
       order by listing_id, revealed_at asc
    `);
    return result.rows.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      phone: r.revealed_phone,
      email: r.revealed_email,
      revealedAt: new Date(r.revealed_at),
    }));
  }

  async openPlacements(brokerId: string): Promise<Map<string, string>> {
    const result = await this.db.execute<{ id: string; listing_id: string }>(sql`
      select id, listing_id from tenant_placements
       where broker_id = ${brokerId} and status = 'initiated' and listing_id is not null
    `);
    return new Map(result.rows.map((r) => [r.listing_id, r.id]));
  }

  /**
   * What a reveal would sell, read live: the property's contact card, falling
   * back to the org's owner. Null when the listing is not on the directory, so
   * a broker cannot reveal a draft or a pending org by guessing its id.
   */
  async listingContact(listingId: string, tx: Tx): Promise<ListingContactRow | null> {
    const result = await tx.execute<{
      listing_id: string;
      org_id: string;
      phone: string | null;
      email: string | null;
    }>(sql`
      select l.id as listing_id,
             o.id as org_id,
             coalesce(nullif(p.contact_phone, ''), owner_contact.phone) as phone,
             coalesce(nullif(p.contact_email, ''), owner_contact.email) as email
        from listings l
        join properties p on p.id = l.property_id
        join workspaces w on w.id = l.workspace_id
        join orgs o on o.id = w.org_id
        left join lateral (
          select coalesce(u.phone_number, up.phone_e164) as phone, u.email
            from org_memberships m
            join users u on u.id = m.user_id
            left join user_profiles up on up.user_id = u.id
           where m.org_id = o.id and m.org_role = 'owner' and m.status = 'active'
           order by m.created_at asc
           limit 1
        ) owner_contact on true
       where l.id = ${listingId}
         and l.status = 'published'
         and o.domain = 'residence'
         and o.registration_status = 'active'
    `);
    const row = result.rows[0];
    return row
      ? { listingId: row.listing_id, landlordOrgId: row.org_id, phone: row.phone, email: row.email }
      : null;
  }

  /**
   * Run `work` holding this broker's lock.
   *
   * One broker's reveals and placements queue behind each other. That is what
   * makes "reveal the same listing twice at once" produce one reveal and one
   * charge, and "two reveals with one credit left" produce one: the second
   * waits, then reads the first one's rows. The ledger's unique on `reveal_id`
   * still stops a double charge of one reveal; the lock stops a second reveal.
   */
  async withBrokerLock<T>(brokerId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`broker:${brokerId}`}, 0))`);
      return work(tx);
    });
  }

  async insertReveal(
    tx: Tx,
    input: { brokerId: string; contact: ListingContactRow; cost: number },
  ): Promise<RevealRow> {
    const inserted = await tx.execute<{ id: string; revealed_at: Date }>(sql`
      insert into contact_reveals (broker_id, listing_id, landlord_org_id, revealed_phone, revealed_email)
      values (${input.brokerId}, ${input.contact.listingId}, ${input.contact.landlordOrgId},
              ${input.contact.phone}, ${input.contact.email})
      returning id, revealed_at
    `);
    const row = inserted.rows[0];
    if (!row) throw new Error('contact_reveals insert returned no row.');
    await tx.execute(sql`
      insert into broker_reveal_credits (broker_id, delta, reason, reveal_id)
      values (${input.brokerId}, ${-input.cost}, 'reveal', ${row.id})
    `);
    return {
      id: row.id,
      listingId: input.contact.listingId,
      phone: input.contact.phone,
      email: input.contact.email,
      revealedAt: new Date(row.revealed_at),
    };
  }

  async openPlacementOn(tx: Tx, brokerId: string, listingId: string): Promise<string | null> {
    const result = await tx.execute<{ id: string }>(sql`
      select id from tenant_placements
       where broker_id = ${brokerId} and listing_id = ${listingId} and status = 'initiated'
       order by initiated_at asc
       limit 1
    `);
    return result.rows[0]?.id ?? null;
  }

  async insertPlacement(tx: Tx, brokerId: string, contact: ListingContactRow): Promise<string> {
    const result = await tx.execute<{ id: string }>(sql`
      insert into tenant_placements (broker_id, listing_id, landlord_org_id, status)
      values (${brokerId}, ${contact.listingId}, ${contact.landlordOrgId}, 'initiated')
      returning id
    `);
    const row = result.rows[0];
    if (!row) throw new Error('tenant_placements insert returned no row.');
    return row.id;
  }

  async credits(brokerId: string): Promise<CreditEntryRow[]> {
    const result = await this.db.execute<{
      id: string;
      delta: number;
      reason: string;
      note: string | null;
      property_name: string | null;
      created_at: Date;
    }>(sql`
      select c.id, c.delta, c.reason, c.note, p.name as property_name, c.created_at
        from broker_reveal_credits c
        left join contact_reveals cr on cr.id = c.reveal_id
        left join listings l on l.id = cr.listing_id
        left join properties p on p.id = l.property_id
       where c.broker_id = ${brokerId}
       order by c.created_at desc, c.id
    `);
    return result.rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      note: r.note,
      propertyName: r.property_name,
      createdAt: new Date(r.created_at),
    }));
  }

  async placements(brokerId: string): Promise<PlacementRow[]> {
    const result = await this.db.execute<{
      id: string;
      listing_id: string | null;
      property_name: string | null;
      landlord_name: string | null;
      status: PlacementRow['status'];
      initiated_at: Date;
      lease_id: string | null;
      unit_label: string | null;
      tenant_name: string | null;
      lease_status: string | null;
      start_date: string | null;
      fee_amount_rwf: string | null;
      fee_status: 'pending' | 'disbursed' | null;
    }>(sql`
      select tp.id, tp.listing_id, p.name as property_name, o.legal_name as landlord_name,
             tp.status, tp.initiated_at,
             le.id as lease_id, r.label as unit_label, le.tenant_name, le.status::text as lease_status,
             to_char(le.start_date, 'YYYY-MM-DD') as start_date,
             pf.amount_rwf::text as fee_amount_rwf, pf.status as fee_status
        from tenant_placements tp
        left join listings l on l.id = tp.listing_id
        left join properties p on p.id = l.property_id
        left join orgs o on o.id = tp.landlord_org_id
        left join leases le on le.id = tp.lease_id
        left join rooms r on r.id = le.room_id
        left join placement_fees pf on pf.lease_id = le.id and pf.broker_id = tp.broker_id
       where tp.broker_id = ${brokerId}
       order by tp.initiated_at desc, tp.id
    `);
    return result.rows.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      propertyName: r.property_name,
      landlordName: r.landlord_name,
      status: r.status,
      initiatedAt: new Date(r.initiated_at),
      leaseId: r.lease_id,
      unitLabel: r.unit_label,
      tenantName: r.tenant_name,
      leaseStatus: r.lease_status,
      startDate: r.start_date,
      feeAmountRwf: int(r.fee_amount_rwf),
      feeStatus: r.fee_status,
    }));
  }

  async fees(brokerId: string): Promise<FeeRow[]> {
    const result = await this.db.execute<{
      id: string;
      lease_id: string;
      tenant_name: string | null;
      unit_label: string | null;
      landlord_name: string | null;
      amount_rwf: string | null;
      status: 'pending' | 'disbursed';
      updated_at: Date;
    }>(sql`
      select pf.id, pf.lease_id, le.tenant_name, r.label as unit_label, o.legal_name as landlord_name,
             pf.amount_rwf::text as amount_rwf, pf.status, pf.updated_at
        from placement_fees pf
        join leases le on le.id = pf.lease_id
        left join rooms r on r.id = le.room_id
        left join orgs o on o.id = le.org_id
       where pf.broker_id = ${brokerId}
       order by pf.updated_at desc, pf.id
    `);
    return result.rows.map((r) => ({
      id: r.id,
      leaseId: r.lease_id,
      tenantName: r.tenant_name,
      unitLabel: r.unit_label,
      landlordName: r.landlord_name,
      amountRwf: int(r.amount_rwf),
      status: r.status,
      updatedAt: new Date(r.updated_at),
    }));
  }
}
