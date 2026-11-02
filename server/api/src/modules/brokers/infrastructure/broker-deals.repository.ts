import { STAY_KINDS, type BrokerDealStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DealTermColumns } from '../domain/broker-deal-rules';
import { scopeSql, type ListingScope } from '../domain/broker-scope';

/** One hotel a broker may propose to, as the database has it. */
export interface HotelRow {
  orgId: string;
  name: string;
  businessKind: string | null;
  stars: number | null;
  district: string | null;
  sector: string | null;
  roomTypes: number;
  fromRwf: number | null;
}

/** One deal with the two sides' names, as the database has it. */
export interface DealRow extends DealTermColumns {
  id: string;
  brokerId: string;
  orgId: string;
  status: BrokerDealStatus;
  startsOn: string | null;
  endsOn: string | null;
  note: string | null;
  brokerName: string | null;
  brokerPhone: string | null;
  brokerEmail: string | null;
  hotelName: string;
  hotelDistrict: string | null;
  proposedAt: Date;
  decidedAt: Date | null;
  decisionNote: string | null;
  closedAt: Date | null;
  closedBy: 'broker' | 'hotel' | null;
  closeNote: string | null;
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const day = (v: unknown): string | null => (v === null || v === undefined ? null : String(v).slice(0, 10));

const STAYS = sql.raw(`(${STAY_KINDS.map((k) => `'${k}'`).join(', ')})`);

/**
 * A hotel a broker may deal with: a hospitality business that is running and
 * is a stay (a bar or a coffee shop is listed, not booked), with a published
 * listing inside the plan's area. The property is the published one guests see.
 */
function hotelsFrom(scope: ListingScope, extra: SQL = sql`true`): SQL {
  return sql`
    select distinct on (o.id)
           o.id as org_id, coalesce(p.name, o.legal_name) as name, o.business_kind::text as business_kind,
           case when o.star_grade_verified_at is not null then o.eac_star_grade end as stars,
           d.name as district, s.name as sector,
           (select count(*)::int from room_types rt
             where rt.property_id = p.id and rt.status = 'active' and rt.domain = 'hospitality') as room_types,
           (select min(rt.base_price_rwf) from room_types rt
             where rt.property_id = p.id and rt.status = 'active' and rt.domain = 'hospitality') as from_rwf
      from orgs o
      join properties p on p.org_id = o.id
      join listings l on l.property_id = p.id and l.status = 'published'
      left join districts d on d.id = p.district_id
      left join sectors s on s.id = p.sector_id
     where o.domain = 'hospitality'
       and o.registration_status = 'active'
       and o.business_kind::text in ${STAYS}
       and ${scopeSql(scope)}
       and ${extra}
     order by o.id, p.created_at`;
}

const DEAL_SELECT = sql`
  select bd.id, bd.broker_id, bd.org_id, bd.kind::text as kind, bd.percent_bp, bd.amount_rwf, bd.min_rooms,
         bd.starts_on::text as starts_on, bd.ends_on::text as ends_on, bd.note, bd.status::text as status,
         b.name as broker_name, b.phone as broker_phone, b.email as broker_email,
         coalesce((select p.name from properties p join listings l on l.property_id = p.id and l.status = 'published'
                    where p.org_id = o.id order by p.created_at limit 1), o.legal_name) as hotel_name,
         (select d.name from properties p join districts d on d.id = p.district_id
           where p.org_id = o.id order by p.created_at limit 1) as hotel_district,
         bd.created_at as proposed_at, bd.decided_at, bd.decision_note, bd.closed_at, bd.closed_by, bd.close_note
    from broker_hotel_deals bd
    join brokers b on b.id = bd.broker_id
    join orgs o on o.id = bd.org_id`;

function toDeal(r: Record<string, unknown>): DealRow {
  return {
    id: String(r.id),
    brokerId: String(r.broker_id),
    orgId: String(r.org_id),
    kind: r.kind as DealRow['kind'],
    percentBp: num(r.percent_bp),
    amountRwf: num(r.amount_rwf),
    minRooms: num(r.min_rooms),
    startsOn: day(r.starts_on),
    endsOn: day(r.ends_on),
    note: str(r.note),
    status: r.status as BrokerDealStatus,
    brokerName: str(r.broker_name),
    brokerPhone: str(r.broker_phone),
    brokerEmail: str(r.broker_email),
    hotelName: String(r.hotel_name),
    hotelDistrict: str(r.hotel_district),
    proposedAt: new Date(String(r.proposed_at)),
    decidedAt: r.decided_at ? new Date(String(r.decided_at)) : null,
    decisionNote: str(r.decision_note),
    closedAt: r.closed_at ? new Date(String(r.closed_at)) : null,
    closedBy: (str(r.closed_by) as DealRow['closedBy']) ?? null,
    closeNote: str(r.close_note),
  };
}

function toHotel(r: Record<string, unknown>): HotelRow {
  return {
    orgId: String(r.org_id),
    name: String(r.name),
    businessKind: str(r.business_kind),
    stars: num(r.stars),
    district: str(r.district),
    sector: str(r.sector),
    roomTypes: Number(r.room_types ?? 0),
    fromRwf: num(r.from_rwf),
  };
}

/**
 * Broker deals with hotels (0124). Every read starts from an id the service
 * resolved (the broker from the broker workspace, the org from the business
 * workspace), and a hotel is read through the plan's area, so one outside it
 * is not found. Status moves are conditional on the status they leave, so two
 * presses at once move a deal once.
 */
@Injectable()
export class BrokerDealsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async hotels(scope: ListingScope): Promise<HotelRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select * from (${hotelsFrom(scope)}) h order by h.name`);
    return result.rows.map(toHotel);
  }

  async hotel(orgId: string, scope: ListingScope): Promise<HotelRow | null> {
    const result = await this.db.execute<Record<string, unknown>>(hotelsFrom(scope, sql`o.id = ${orgId}`));
    const r = result.rows[0];
    return r ? toHotel(r) : null;
  }

  async forBroker(brokerId: string): Promise<DealRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      ${DEAL_SELECT} where bd.broker_id = ${brokerId} order by bd.created_at desc`);
    return result.rows.map(toDeal);
  }

  async forOrg(orgId: string): Promise<DealRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      ${DEAL_SELECT} where bd.org_id = ${orgId} order by bd.created_at desc`);
    return result.rows.map(toDeal);
  }

  async deal(id: string): Promise<DealRow | null> {
    const result = await this.db.execute<Record<string, unknown>>(sql`${DEAL_SELECT} where bd.id = ${id}`);
    const r = result.rows[0];
    return r ? toDeal(r) : null;
  }

  /** Null when the pair already has a proposed or running deal (the partial unique index). */
  async insert(input: {
    brokerId: string;
    orgId: string;
    terms: DealTermColumns;
    startsOn: string | null;
    endsOn: string | null;
    note: string | null;
    userId: string;
  }): Promise<string | null> {
    const { terms } = input;
    const result = await this.db.execute<Record<string, unknown>>(sql`
      insert into broker_hotel_deals
        (broker_id, org_id, kind, percent_bp, amount_rwf, min_rooms, starts_on, ends_on, note, proposed_by_user_id)
      values
        (${input.brokerId}, ${input.orgId}, ${terms.kind}::broker_deal_kind, ${terms.percentBp}, ${terms.amountRwf},
         ${terms.minRooms}, ${input.startsOn}::date, ${input.endsOn}::date, ${input.note}, ${input.userId})
      on conflict do nothing
      returning id`);
    return str(result.rows[0]?.id);
  }

  /** The hotel's answer. False when the deal was no longer a proposal. */
  async decide(id: string, accept: boolean, note: string | null, userId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      update broker_hotel_deals
         set status = ${accept ? 'active' : 'declined'}::broker_deal_status,
             decided_by_user_id = ${userId}, decided_at = now(), decision_note = ${note}, updated_at = now()
       where id = ${id} and status = 'proposed'
      returning id`);
    return result.rows.length > 0;
  }

  /** A running deal whose end date passed is written down as ended, by neither side, so the pair is free again. */
  async expire(id: string): Promise<void> {
    await this.db.execute(sql`
      update broker_hotel_deals
         set status = 'ended', closed_at = now(), updated_at = now()
       where id = ${id} and status = 'active'`);
  }

  /** Withdrawn (a proposal) or ended (a running deal), by one side. False when it had already moved. */
  async close(
    id: string,
    from: BrokerDealStatus,
    to: 'withdrawn' | 'ended',
    by: 'broker' | 'hotel',
    note: string | null,
    userId: string,
  ): Promise<boolean> {
    const result = await this.db.execute(sql`
      update broker_hotel_deals
         set status = ${to}::broker_deal_status, closed_by = ${by}, closed_by_user_id = ${userId},
             closed_at = now(), close_note = ${note}, updated_at = now()
       where id = ${id} and status = ${from}::broker_deal_status
      returning id`);
    return result.rows.length > 0;
  }
}
