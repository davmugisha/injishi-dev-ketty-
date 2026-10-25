import type { BrokerFeeKind, BrokerHomesSort } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { scopeSql, type ListingScope } from '../domain/broker-scope';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbOrTx = Database | Tx;

export interface BrokerSelfRow {
  id: string;
  userId: string;
  name: string | null;
  status: 'active' | 'suspended';
}

/** One opted-in vacant unit, before its photos are signed. */
export interface HomeRow {
  unitId: string;
  unitLabel: string;
  propertyName: string;
  landlordName: string;
  orgId: string;
  workspaceId: string;
  districtId: number | null;
  district: string | null;
  sector: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  kitchen: 'own' | 'shared' | 'none' | null;
  furnished: boolean;
  sizeSqm: number | null;
  rentRwf: number;
  depositRwf: number | null;
  feeKind: BrokerFeeKind;
  feePercent: number | null;
  feeRwf: number | null;
  photoKeys: string[];
  videoKey: string | null;
  videoPosterKey: string | null;
  videoDurationS: number | null;
  availableFrom: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ContactRow {
  orgId: string;
  workspaceId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface RevealRow {
  id: string;
  orgId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  revealedAt: Date;
}

export interface BrokerPlacementRow {
  id: string;
  status: 'initiated' | 'converted' | 'abandoned' | 'unavailable';
  initiatedAt: Date;
  unitId: string | null;
  unitLabel: string | null;
  propertyName: string | null;
  district: string | null;
  landlordName: string | null;
  tenantName: string | null;
  note: string | null;
  feeKind: BrokerFeeKind | null;
  feePercent: number | null;
  feeRwf: number | null;
  leaseId: string | null;
  leaseReference: string | null;
  leaseTenantName: string | null;
  leaseStatus: string | null;
  leaseStartDate: string | null;
  recordKind: BrokerFeeKind | null;
  recordPercent: number | null;
  recordRwf: number | null;
  recordStatus: 'pending' | 'disbursed' | null;
  disbursedAt: Date | null;
}

export interface FeeLineRow {
  leaseId: string;
  reference: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  landlordName: string;
  startDate: string;
  leaseStatus: string;
  kind: BrokerFeeKind | null;
  percent: number | null;
  amountRwf: number;
  status: 'pending' | 'disbursed';
  disbursedAt: Date | null;
}

export interface ReviewRow {
  stars: number;
  comment: string | null;
  from: 'tenant' | 'landlord';
  raterName: string | null;
  propertyName: string | null;
  ratedAt: Date;
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** The leases that hold a unit: a broker cannot offer it while one stands (an ending one says when it frees). */
const HOLDING = sql`('pending_signature', 'signed', 'active')`;

/**
 * The broker's own reads and writes (2026-10-25). Every query begins from a
 * `brokers.id` the service resolved from the workspace, never from an id in a
 * request, and every read of a unit carries the plan's area (`scopeSql`) and
 * the opt-in, so a unit outside either is simply not found.
 */
@Injectable()
export class BrokersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The broker row behind a broker workspace: `workspaces.user_id` → `brokers.user_id`. */
  async brokerForWorkspace(workspaceId: string): Promise<BrokerSelfRow | null> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select b.id, b.user_id, b.name, b.status::text as status
        from workspaces w
        join brokers b on b.user_id = w.user_id
       where w.id = ${workspaceId} and w.kind = 'broker'
    `);
    const r = result.rows[0];
    return r ? { id: r.id as string, userId: r.user_id as string, name: str(r.name), status: r.status as BrokerSelfRow['status'] } : null;
  }

  /**
   * The units a broker may offer, inside the plan's area: switched on by the
   * landlord, active, with an asking rent and a fee, in a running residence
   * business, and not held by a lease (one ending says from when it frees).
   */
  private homeWhere(scope: ListingScope): SQL[] {
    return [
      sql`u.broker_offer`,
      sql`u.state = 'active'`,
      sql`u.asking_rent_rwf is not null`,
      sql`u.broker_fee_kind is not null`,
      sql`o.domain = 'residence'`,
      sql`o.registration_status = 'active'`,
      sql`not exists (select 1 from leases le where le.unit_id = u.id and le.status in ${HOLDING})`,
      scopeSql(scope),
    ];
  }

  private homeSelect(where: SQL[], order: SQL, limit: number, db: DbOrTx = this.db): Promise<{ rows: Record<string, unknown>[] }> {
    return db.execute<Record<string, unknown>>(sql`
      select u.id as unit_id, u.label as unit_label, p.name as property_name, o.legal_name as landlord_name,
             o.id as org_id, u.workspace_id,
             p.district_id, d.name as district, s.name as sector,
             u.bedrooms, u.bathrooms, u.kitchen::text as kitchen, u.furnished, u.size_sqm,
             u.asking_rent_rwf, u.asking_deposit_rwf,
             u.broker_fee_kind::text as fee_kind, u.broker_fee_percent as fee_percent, u.broker_fee_rwf as fee_rwf,
             coalesce((select array_agg(so.object_key order by ph.position)
                         from unit_photos ph join stored_objects so on so.id = ph.stored_object_id
                        where ph.unit_id = u.id), '{}') as photo_keys,
             vo.object_key as video_key, po.object_key as video_poster_key, v.duration_s as video_duration_s,
             coalesce(
               (select (le.end_date + 1)::text from leases le where le.unit_id = u.id and le.status = 'ending' order by le.end_date desc limit 1),
               case when u.available_from > (now() at time zone 'Africa/Kigali')::date then u.available_from::text end
             ) as available_from,
             p.latitude::float8 as latitude, p.longitude::float8 as longitude
        from rental_units u
        join properties p on p.id = u.property_id
        join workspaces w on w.id = u.workspace_id
        join orgs o on o.id = w.org_id
        left join districts d on d.id = p.district_id
        left join sectors s on s.id = p.sector_id
        left join unit_videos v on v.unit_id = u.id
        left join stored_objects vo on vo.id = v.stored_object_id
        left join stored_objects po on po.id = v.poster_object_id
       where ${sql.join(where, sql` and `)}
       order by ${order}
       limit ${limit}
    `);
  }

  async homes(filter: {
    scope: ListingScope;
    districtId: number | null;
    minRent?: number;
    maxRent?: number;
    bedrooms?: number;
    q?: string;
    sort?: BrokerHomesSort;
  }): Promise<HomeRow[]> {
    const fee = sql`(case when u.broker_fee_kind = 'fixed' then u.broker_fee_rwf else floor(u.asking_rent_rwf * u.broker_fee_percent / 100.0) end)`;
    const where = this.homeWhere(filter.scope);
    if (filter.districtId !== null) where.push(sql`p.district_id = ${filter.districtId}`);
    if (filter.minRent !== undefined) where.push(sql`u.asking_rent_rwf >= ${filter.minRent}`);
    if (filter.maxRent !== undefined) where.push(sql`u.asking_rent_rwf <= ${filter.maxRent}`);
    if (filter.bedrooms !== undefined) where.push(sql`coalesce(u.bedrooms, 0) >= ${filter.bedrooms}`);
    if (filter.q) {
      const like = `%${filter.q}%`;
      where.push(sql`(p.name ilike ${like} or u.label ilike ${like} or s.name ilike ${like} or d.name ilike ${like} or o.legal_name ilike ${like})`);
    }
    const order =
      filter.sort === 'price_asc'
        ? sql`u.asking_rent_rwf asc, u.id`
        : filter.sort === 'price_desc'
          ? sql`u.asking_rent_rwf desc, u.id`
          : filter.sort === 'fee_desc'
            ? sql`${fee} desc, u.id`
            : sql`u.updated_at desc, u.id`;
    const result = await this.homeSelect(where, order, 300);
    return result.rows.map(homeOf);
  }

  /** One unit, only when it is on offer and inside the plan's area. */
  async home(unitId: string, scope: ListingScope, db: DbOrTx = this.db): Promise<HomeRow | null> {
    const result = await this.homeSelect([...this.homeWhere(scope), sql`u.id = ${unitId}`], sql`u.id`, 1, db);
    return result.rows[0] ? homeOf(result.rows[0]) : null;
  }

  /** Every district in the plan's area with a unit on offer, and how many. */
  async homeDistricts(scope: ListingScope): Promise<{ id: number; name: string; count: number }[]> {
    const result = await this.db.execute<{ id: number; name: string; count: number }>(sql`
      select d.id, d.name, count(*)::int as count
        from rental_units u
        join properties p on p.id = u.property_id
        join districts d on d.id = p.district_id
        join workspaces w on w.id = u.workspace_id
        join orgs o on o.id = w.org_id
       where ${sql.join(this.homeWhere(scope), sql` and `)}
       group by d.id, d.name
       order by d.name
    `);
    return result.rows;
  }

  /**
   * The landlord's contact as a broker sees it on reveal: the business's
   * signatory and contact from the rentals profile, falling back to its owner.
   */
  async landlordContact(orgId: string, db: DbOrTx = this.db): Promise<ContactRow | null> {
    const result = await db.execute<Record<string, unknown>>(sql`
      select o.id as org_id, w.id as workspace_id,
             coalesce(nullif(lp.signatory_name, ''), owner.name, o.legal_name) as name,
             coalesce(nullif(lp.contact_phone, ''), owner.phone) as phone,
             coalesce(nullif(lp.contact_email, ''), owner.email) as email
        from orgs o
        join workspaces w on w.org_id = o.id and w.kind = 'business'
        left join landlord_profiles lp on lp.org_id = o.id
        left join lateral (
          select u.name, coalesce(u.phone_number, up.phone_e164) as phone, u.email
            from org_memberships m
            join users u on u.id = m.user_id
            left join user_profiles up on up.user_id = u.id
           where m.org_id = o.id and m.org_role = 'owner' and m.status = 'active'
           order by m.created_at asc
           limit 1
        ) owner on true
       where o.id = ${orgId}
       limit 1
    `);
    const r = result.rows[0];
    return r ? { orgId: r.org_id as string, workspaceId: r.workspace_id as string, name: str(r.name), phone: str(r.phone), email: str(r.email) } : null;
  }

  /** Every landlord this broker revealed, by business. */
  async reveals(brokerId: string, db: DbOrTx = this.db): Promise<RevealRow[]> {
    const result = await db.execute<Record<string, unknown>>(sql`
      select id, landlord_org_id, revealed_name, revealed_phone, revealed_email, revealed_at
        from contact_reveals
       where broker_id = ${brokerId} and landlord_org_id is not null
       order by revealed_at asc
    `);
    return result.rows.map((r) => ({
      id: r.id as string,
      orgId: r.landlord_org_id as string,
      name: str(r.revealed_name),
      phone: str(r.revealed_phone),
      email: str(r.revealed_email),
      revealedAt: new Date(r.revealed_at as string),
    }));
  }

  /** Log a reveal: a snapshot of the contact as it stood. One per broker and landlord. */
  async insertReveal(tx: Tx, input: { brokerId: string; unitId: string; contact: ContactRow }): Promise<RevealRow | null> {
    const result = await tx.execute<Record<string, unknown>>(sql`
      insert into contact_reveals (broker_id, landlord_org_id, unit_id, revealed_name, revealed_phone, revealed_email)
      values (${input.brokerId}, ${input.contact.orgId}, ${input.unitId}, ${input.contact.name}, ${input.contact.phone}, ${input.contact.email})
      on conflict (broker_id, landlord_org_id) where landlord_org_id is not null do nothing
      returning id, revealed_at
    `);
    const r = result.rows[0];
    return r
      ? { id: r.id as string, orgId: input.contact.orgId, name: input.contact.name, phone: input.contact.phone, email: input.contact.email, revealedAt: new Date(r.revealed_at as string) }
      : null;
  }

  /** The broker's latest placement on each unit. */
  async unitPlacements(brokerId: string): Promise<Map<string, { id: string; status: BrokerPlacementRow['status'] }>> {
    const result = await this.db.execute<{ id: string; unit_id: string; status: BrokerPlacementRow['status'] }>(sql`
      select distinct on (unit_id) id, unit_id, status::text as status
        from tenant_placements
       where broker_id = ${brokerId} and unit_id is not null
       order by unit_id, initiated_at desc
    `);
    return new Map(result.rows.map((r) => [r.unit_id, { id: r.id, status: r.status }]));
  }

  /** One broker's reveals and placements queue behind each other, so a double press writes once. */
  async withBrokerLock<T>(brokerId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`broker:${brokerId}`}, 0))`);
      return work(tx);
    });
  }

  async openPlacementOn(tx: Tx, brokerId: string, unitId: string): Promise<string | null> {
    const result = await tx.execute<{ id: string }>(sql`
      select id from tenant_placements
       where broker_id = ${brokerId} and unit_id = ${unitId} and status = 'initiated'
       limit 1
    `);
    return result.rows[0]?.id ?? null;
  }

  async insertPlacement(
    tx: Tx,
    input: {
      brokerId: string;
      home: HomeRow;
      tenantName: string | null;
      note: string | null;
    },
  ): Promise<string> {
    const result = await tx.execute<{ id: string }>(sql`
      insert into tenant_placements (broker_id, landlord_org_id, unit_id, workspace_id, status, tenant_name, note, fee_kind, fee_percent, fee_rwf)
      values (${input.brokerId}, ${input.home.orgId}, ${input.home.unitId}, ${input.home.workspaceId}, 'initiated',
              ${input.tenantName}, ${input.note}, ${input.home.feeKind}, ${input.home.feePercent}, ${input.home.feeRwf})
      returning id
    `);
    const row = result.rows[0];
    if (!row) throw new Error('tenant_placements insert returned no row.');
    return row.id;
  }

  async placements(brokerId: string): Promise<BrokerPlacementRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select tp.id, tp.status::text as status, tp.initiated_at, tp.unit_id, u.label as unit_label, p.name as property_name,
             d.name as district, o.legal_name as landlord_name, tp.tenant_name, tp.note,
             tp.fee_kind::text as fee_kind, tp.fee_percent, tp.fee_rwf,
             le.id as lease_id, le.reference as lease_reference, t.full_name as lease_tenant_name,
             le.status::text as lease_status, le.start_date::text as lease_start_date,
             pf.fee_kind::text as record_kind, pf.percent as record_percent, pf.amount_rwf as record_rwf,
             pf.status::text as record_status, pf.disbursed_at
        from tenant_placements tp
        left join rental_units u on u.id = tp.unit_id
        left join properties p on p.id = u.property_id
        left join districts d on d.id = p.district_id
        left join orgs o on o.id = tp.landlord_org_id
        left join leases le on le.id = tp.lease_id
        left join tenants t on t.id = le.tenant_id
        left join placement_fees pf on pf.lease_id = le.id and pf.broker_id = tp.broker_id
       where tp.broker_id = ${brokerId}
       order by tp.initiated_at desc, tp.id
       limit 500
    `);
    return result.rows.map((r) => ({
      id: r.id as string,
      status: r.status as BrokerPlacementRow['status'],
      initiatedAt: new Date(r.initiated_at as string),
      unitId: str(r.unit_id),
      unitLabel: str(r.unit_label),
      propertyName: str(r.property_name),
      district: str(r.district),
      landlordName: str(r.landlord_name),
      tenantName: str(r.tenant_name),
      note: str(r.note),
      feeKind: (r.fee_kind as BrokerFeeKind | null) ?? null,
      feePercent: num(r.fee_percent),
      feeRwf: num(r.fee_rwf),
      leaseId: str(r.lease_id),
      leaseReference: str(r.lease_reference),
      leaseTenantName: str(r.lease_tenant_name),
      leaseStatus: str(r.lease_status),
      leaseStartDate: str(r.lease_start_date),
      recordKind: (r.record_kind as BrokerFeeKind | null) ?? null,
      recordPercent: num(r.record_percent),
      recordRwf: num(r.record_rwf),
      recordStatus: (r.record_status as 'pending' | 'disbursed' | null) ?? null,
      disbursedAt: r.disbursed_at ? new Date(r.disbursed_at as string) : null,
    }));
  }

  /** Every fee a lease records for this broker. */
  async fees(brokerId: string): Promise<FeeLineRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select le.id as lease_id, le.reference, t.full_name as tenant_name, u.label as unit_label, p.name as property_name,
             o.legal_name as landlord_name, le.start_date::text as start_date, le.status::text as lease_status,
             pf.fee_kind::text as kind, pf.percent, pf.amount_rwf, pf.status::text as status, pf.disbursed_at
        from placement_fees pf
        join leases le on le.id = pf.lease_id
        join tenants t on t.id = le.tenant_id
        join rental_units u on u.id = le.unit_id
        join properties p on p.id = le.property_id
        join orgs o on o.id = le.org_id
       where pf.broker_id = ${brokerId} and pf.amount_rwf is not null
       order by le.start_date desc, le.id
       limit 500
    `);
    return result.rows.map((r) => ({
      leaseId: r.lease_id as string,
      reference: r.reference as string,
      tenantName: r.tenant_name as string,
      unitLabel: r.unit_label as string,
      propertyName: r.property_name as string,
      landlordName: r.landlord_name as string,
      startDate: r.start_date as string,
      leaseStatus: r.lease_status as string,
      kind: (r.kind as BrokerFeeKind | null) ?? null,
      percent: num(r.percent),
      amountRwf: Number(r.amount_rwf),
      status: r.status as 'pending' | 'disbursed',
      disbursedAt: r.disbursed_at ? new Date(r.disbursed_at as string) : null,
    }));
  }

  /** What tenants and landlords said, newest first, and how many started leases the broker brought. */
  async reviews(brokerId: string): Promise<{ placedCount: number; reviews: ReviewRow[] }> {
    const [placed, rows] = await Promise.all([
      this.db.execute<{ n: number }>(sql`
        select count(*)::int as n from leases where broker_id = ${brokerId} and status in ('active', 'ending', 'ended')
      `),
      this.db.execute<Record<string, unknown>>(sql`
        select br.stars, br.comment, br.rater_role::text as rater_role,
               case when br.rater_role = 'tenant' then nullif(split_part(trim(t.full_name), ' ', 1), '') else o.legal_name end as rater_name,
               p.name as property_name, br.updated_at
          from broker_ratings br
          join leases le on le.id = br.lease_id
          left join tenants t on t.id = le.tenant_id
          left join orgs o on o.id = le.org_id
          left join properties p on p.id = le.property_id
         where br.broker_id = ${brokerId}
         order by br.updated_at desc
         limit 200
      `),
    ]);
    return {
      placedCount: placed.rows[0]?.n ?? 0,
      reviews: rows.rows.map((r) => ({
        stars: Number(r.stars),
        comment: str(r.comment),
        from: r.rater_role as 'tenant' | 'landlord',
        raterName: str(r.rater_name),
        propertyName: str(r.property_name),
        ratedAt: new Date(r.updated_at as string),
      })),
    };
  }

  /** The figures the broker home opens on. */
  async counts(brokerId: string, scope: ListingScope): Promise<{ homes: number; open: number; ratingAverage: number | null; ratingCount: number }> {
    const [homes, open, rating] = await Promise.all([
      this.db.execute<{ n: number }>(sql`
        select count(*)::int as n from rental_units u
          join properties p on p.id = u.property_id
          join workspaces w on w.id = u.workspace_id
          join orgs o on o.id = w.org_id
         where ${sql.join(this.homeWhere(scope), sql` and `)}
      `),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from tenant_placements where broker_id = ${brokerId} and status = 'initiated'`),
      this.db.execute<{ avg: string | null; n: number }>(sql`
        select round(avg(stars)::numeric, 1)::text as avg, count(*)::int as n from broker_ratings where broker_id = ${brokerId}
      `),
    ]);
    return {
      homes: homes.rows[0]?.n ?? 0,
      open: open.rows[0]?.n ?? 0,
      ratingAverage: rating.rows[0]?.avg ? Number(rating.rows[0].avg) : null,
      ratingCount: rating.rows[0]?.n ?? 0,
    };
  }

  /** Who to tell about a new placement: the landlord business's contact email, and the broker's name and phone. */
  async placementNotice(placementId: string): Promise<{ email: string | null; landlordName: string; unitLabel: string; propertyName: string; brokerName: string | null; brokerPhone: string | null } | null> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select coalesce(nullif(lp.contact_email, ''), owner.email) as email, o.legal_name as landlord_name,
             u.label as unit_label, p.name as property_name, b.name as broker_name, b.phone as broker_phone
        from tenant_placements tp
        join brokers b on b.id = tp.broker_id
        join rental_units u on u.id = tp.unit_id
        join properties p on p.id = u.property_id
        join orgs o on o.id = tp.landlord_org_id
        left join landlord_profiles lp on lp.org_id = o.id
        left join lateral (
          select u2.email from org_memberships m join users u2 on u2.id = m.user_id
           where m.org_id = o.id and m.org_role = 'owner' and m.status = 'active'
           order by m.created_at asc limit 1
        ) owner on true
       where tp.id = ${placementId}
    `);
    const r = result.rows[0];
    return r
      ? {
          email: str(r.email),
          landlordName: r.landlord_name as string,
          unitLabel: r.unit_label as string,
          propertyName: r.property_name as string,
          brokerName: str(r.broker_name),
          brokerPhone: str(r.broker_phone),
        }
      : null;
  }
}

function homeOf(r: Record<string, unknown>): HomeRow {
  return {
    unitId: r.unit_id as string,
    unitLabel: r.unit_label as string,
    propertyName: r.property_name as string,
    landlordName: r.landlord_name as string,
    orgId: r.org_id as string,
    workspaceId: r.workspace_id as string,
    districtId: num(r.district_id),
    district: str(r.district),
    sector: str(r.sector),
    bedrooms: num(r.bedrooms),
    bathrooms: num(r.bathrooms),
    kitchen: (r.kitchen as HomeRow['kitchen']) ?? null,
    furnished: Boolean(r.furnished),
    sizeSqm: num(r.size_sqm),
    rentRwf: Number(r.asking_rent_rwf),
    depositRwf: num(r.asking_deposit_rwf),
    feeKind: r.fee_kind as BrokerFeeKind,
    feePercent: num(r.fee_percent),
    feeRwf: num(r.fee_rwf),
    photoKeys: (r.photo_keys as string[] | null) ?? [],
    videoKey: str(r.video_key),
    videoPosterKey: str(r.video_poster_key),
    videoDurationS: num(r.video_duration_s),
    availableFrom: str(r.available_from),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
  };
}
