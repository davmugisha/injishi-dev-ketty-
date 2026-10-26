import { Inject, Injectable } from '@nestjs/common';
import {
  LEADER_ROLE_SCOPE,
  LEADER_ROLES,
  type LeaderLevel,
  type LeaderRole,
  type OversightAppointmentQuery,
  type OversightRole,
} from '@injishi/contracts';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';

function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/** An appointment row with the words the admin screen shows. */
export interface AppointmentRow {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: OversightRole;
  bodyCode: string;
  bodyName: string | null;
  title: string | null;
  scopeLevel: string;
  provinceId: number | null;
  districtId: number | null;
  sectorId: number | null;
  cellId: number | null;
  villageId: number | null;
  provinceName: string | null;
  districtName: string | null;
  sectorName: string | null;
  cellName: string | null;
  villageName: string | null;
  grantedAt: Date;
  grantedBy: string | null;
  delivered: number;
  seen: number;
}

/** A place down to the level an appointment names, every level above filled in. */
export interface ResolvedArea {
  provinceId: number | null;
  districtId: number | null;
  sectorId: number | null;
  cellId: number | null;
  villageId: number | null;
}

/** Guests waiting for a post at a place. */
export interface WaitingRow {
  role: LeaderRole;
  provinceId: number | null;
  districtId: number | null;
  sectorId: number | null;
  cellId: number | null;
  villageId: number | null;
  provinceName: string | null;
  districtName: string | null;
  sectorName: string | null;
  cellName: string | null;
  villageName: string | null;
  reports: number;
  oldestArrival: string;
}

/** An area with rented homes and nobody in a post there. */
export interface UncoveredRow extends ResolvedArea {
  role: LeaderRole;
  provinceName: string | null;
  districtName: string | null;
  sectorName: string | null;
  cellName: string | null;
  villageName: string | null;
  homes: number;
  waitingReports: number;
}

/** A leader with guests delivered who never opened one. */
export interface NeverOpenedRow {
  assignmentId: string;
  name: string | null;
  email: string;
  role: LeaderRole;
  districtName: string | null;
  sectorName: string | null;
  cellName: string | null;
  villageName: string | null;
  scopeLevel: string;
  delivered: number;
  firstDeliveredAt: Date;
  grantedAt: Date;
}

const LEADER_LIST = sql.join(LEADER_ROLES.map((r) => sql`${r}`), sql`, `);

const APPOINTMENT_SELECT = sql`
  select a.id, a.user_id as "userId", nullif(btrim(u.name), '') as name, u.email, a.oversight_role::text as role,
         a.government_body_code as "bodyCode", b.name_en as "bodyName", a.government_title as title,
         a.scope_level::text as "scopeLevel",
         a.province_id as "provinceId", a.district_id as "districtId", a.sector_id as "sectorId",
         a.cell_id as "cellId", a.village_id as "villageId",
         p.name as "provinceName", d.name as "districtName", s.name as "sectorName", c.name as "cellName", v.name as "villageName",
         a.granted_at as "grantedAt", nullif(btrim(gu.name), '') as "grantedBy",
         (select count(*)::int from guest_registration_routes r where r.assignment_id = a.id) as delivered,
         (select count(*)::int from guest_registration_routes r where r.assignment_id = a.id and r.seen_at is not null) as seen
    from oversight_assignments a
    join users u on u.id = a.user_id
    left join government_bodies b on b.code = a.government_body_code
    left join provinces p on p.id = coalesce(a.province_id, (select province_id from districts where id = a.district_id))
    left join districts d on d.id = a.district_id
    left join sectors s on s.id = a.sector_id
    left join cells c on c.id = a.cell_id
    left join villages v on v.id = a.village_id
    left join users gu on gu.id = a.assigned_by_user_id`;

/** Where a property is, at every level, read from its village up (as guest routing reads it). */
const HOME_PLACE = sql`
  select p.id as property_id,
         p.village_id, hv.cell_id,
         coalesce(hc.sector_id, p.sector_id) as sector_id,
         coalesce(hs.district_id, p.district_id) as district_id,
         (select hd.province_id from districts hd where hd.id = coalesce(hs.district_id, p.district_id)) as province_id,
         0 as country_id
    from properties p
    join orgs o on o.id = p.org_id and o.domain = 'residence'
    left join villages hv on hv.id = p.village_id
    left join cells hc on hc.id = hv.cell_id
    left join sectors hs on hs.id = coalesce(hc.sector_id, p.sector_id)
   where p.archived_at is null`;

/**
 * Admin reads and writes for oversight appointments (P5): the list of every
 * post with its area and guest counts, the guests waiting for a post, and the
 * coverage report. The appointment and end writes are `LocalLeadersService`'s.
 */
@Injectable()
export class LocalLeadersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(q: OversightAppointmentQuery): Promise<AppointmentRow[]> {
    const where: SQL[] = [sql`a.revoked_at is null`];
    if (q.role) where.push(sql`a.oversight_role::text = ${q.role}`);
    if (q.kind === 'leader') where.push(sql`a.oversight_role::text in (${LEADER_LIST})`);
    if (q.kind === 'reviewer') where.push(sql`a.oversight_role::text in ('business_field_verifier', 'business_approver')`);
    if (q.kind === 'officer') {
      where.push(sql`a.oversight_role::text not in (${LEADER_LIST}) and a.oversight_role::text not in ('business_field_verifier', 'business_approver')`);
    }
    // An area filter keeps the posts inside that place.
    if (q.villageId) where.push(sql`a.village_id = ${q.villageId}`);
    else if (q.cellId) where.push(sql`a.cell_id = ${q.cellId}`);
    else if (q.sectorId) where.push(sql`a.sector_id = ${q.sectorId}`);
    else if (q.districtId) where.push(sql`a.district_id = ${q.districtId}`);
    else if (q.provinceId) {
      where.push(sql`(a.province_id = ${q.provinceId} or a.district_id in (select id from districts where province_id = ${q.provinceId}))`);
    }
    if (q.q) where.push(sql`(u.email ilike ${`%${q.q}%`} or u.name ilike ${`%${q.q}%`} or a.government_title ilike ${`%${q.q}%`})`);
    const result = await this.db.execute(sql`
      ${APPOINTMENT_SELECT}
       where ${sql.join(where, sql` and `)}
       order by d.name nulls first, s.name nulls first, c.name nulls first, v.name nulls first, a.oversight_role, u.email
       limit 1000`);
    return rowsOf<AppointmentRow>(result);
  }

  async one(assignmentId: string, db: Database = this.db): Promise<AppointmentRow | null> {
    const result = await db.execute(sql`${APPOINTMENT_SELECT} where a.id = ${assignmentId} limit 1`);
    return rowsOf<AppointmentRow>(result)[0] ?? null;
  }

  /** Every level above a place, from the place's own row; null when it does not exist. */
  async resolve(level: 'province' | 'district' | 'sector' | 'cell' | 'village', id: number, db: Database = this.db): Promise<ResolvedArea | null> {
    const query =
      level === 'village'
        ? sql`select d.province_id as "provinceId", s.district_id as "districtId", c.sector_id as "sectorId", v.cell_id as "cellId", v.id as "villageId"
                from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id join districts d on d.id = s.district_id
               where v.id = ${id}`
        : level === 'cell'
          ? sql`select d.province_id as "provinceId", s.district_id as "districtId", c.sector_id as "sectorId", c.id as "cellId", null::int as "villageId"
                  from cells c join sectors s on s.id = c.sector_id join districts d on d.id = s.district_id where c.id = ${id}`
          : level === 'sector'
            ? sql`select d.province_id as "provinceId", s.district_id as "districtId", s.id as "sectorId", null::int as "cellId", null::int as "villageId"
                    from sectors s join districts d on d.id = s.district_id where s.id = ${id}`
            : level === 'district'
              ? sql`select d.province_id as "provinceId", d.id as "districtId", null::int as "sectorId", null::int as "cellId", null::int as "villageId"
                      from districts d where d.id = ${id}`
              : sql`select p.id as "provinceId", null::int as "districtId", null::int as "sectorId", null::int as "cellId", null::int as "villageId"
                      from provinces p where p.id = ${id}`;
    return rowsOf<ResolvedArea>(await db.execute(query))[0] ?? null;
  }

  async body(code: string, db: Database = this.db): Promise<{ code: string; active: boolean } | null> {
    const result = await db.execute(sql`select code, active from government_bodies where code = ${code} limit 1`);
    return rowsOf<{ code: string; active: boolean }>(result)[0] ?? null;
  }

  /** Guests waiting because nobody holds a post, grouped by role and place, the most first. */
  async waiting(today: string, q: Pick<OversightAppointmentQuery, 'role' | 'provinceId' | 'districtId' | 'sectorId' | 'cellId' | 'villageId'> = {}): Promise<WaitingRow[]> {
    const where: SQL[] = [sql`r.assignment_id is null`, sql`g.status = 'submitted'`, sql`g.departure_on >= ${today}::date`];
    if (q.role) where.push(sql`r.recipient_role::text = ${q.role}`);
    if (q.villageId) where.push(sql`r.village_id = ${q.villageId}`);
    else if (q.cellId) where.push(sql`r.cell_id = ${q.cellId}`);
    else if (q.sectorId) where.push(sql`r.sector_id = ${q.sectorId}`);
    else if (q.districtId) where.push(sql`r.district_id = ${q.districtId}`);
    else if (q.provinceId) where.push(sql`r.district_id in (select id from districts where province_id = ${q.provinceId})`);
    const result = await this.db.execute(sql`
      select r.recipient_role::text as role, d.province_id as "provinceId", r.district_id as "districtId",
             r.sector_id as "sectorId", r.cell_id as "cellId", r.village_id as "villageId",
             pr.name as "provinceName", d.name as "districtName", s.name as "sectorName", c.name as "cellName", v.name as "villageName",
             count(*)::int as reports, to_char(min(g.arrival_on), 'YYYY-MM-DD') as "oldestArrival"
        from guest_registration_routes r
        join guest_registrations g on g.id = r.registration_id
        left join districts d on d.id = r.district_id
        left join provinces pr on pr.id = d.province_id
        left join sectors s on s.id = r.sector_id
        left join cells c on c.id = r.cell_id
        left join villages v on v.id = r.village_id
       where ${sql.join(where, sql` and `)}
       group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
       order by reports desc, "oldestArrival"
       limit 500`);
    return rowsOf<WaitingRow>(result);
  }

  /** Areas at each leader level: how many in Rwanda, and how many have someone in the post. */
  async nationwide(): Promise<Record<LeaderLevel, { areas: number; covered: Record<string, number> }>> {
    const covered = (role: LeaderRole, column: string): SQL =>
      sql`(select count(distinct ${sql.raw(column)})::int from oversight_assignments where revoked_at is null and oversight_role::text = ${role})`;
    const result = await this.db.execute(sql`
      select
        (select count(*)::int from villages) as villages,
        (select count(*)::int from cells) as cells,
        (select count(*)::int from sectors) as sectors,
        (select count(*)::int from districts) as districts,
        (select count(*)::int from provinces) as provinces,
        ${covered('village_leader', 'village_id')} as village_leader,
        ${covered('cell_executive', 'cell_id')} as cell_executive,
        ${covered('dasso', 'sector_id')} as dasso,
        ${covered('sector_executive', 'sector_id')} as sector_executive,
        ${covered('district_officer', 'district_id')} as district_officer,
        ${covered('district_immigration', 'district_id')} as district_immigration,
        ${covered('dgie_province', 'province_id')} as dgie_province,
        (select least(count(*), 1)::int from oversight_assignments where revoked_at is null and oversight_role::text = 'dgie_national') as dgie_national`);
    const r = rowsOf<Record<string, number>>(result)[0] ?? {};
    return {
      village: { areas: r.villages ?? 0, covered: { village_leader: r.village_leader ?? 0 } },
      cell: { areas: r.cells ?? 0, covered: { cell_executive: r.cell_executive ?? 0 } },
      sector: { areas: r.sectors ?? 0, covered: { dasso: r.dasso ?? 0, sector_executive: r.sector_executive ?? 0 } },
      district: {
        areas: r.districts ?? 0,
        covered: { district_officer: r.district_officer ?? 0, district_immigration: r.district_immigration ?? 0 },
      },
      province: { areas: r.provinces ?? 0, covered: { dgie_province: r.dgie_province ?? 0 } },
      country: { areas: 1, covered: { dgie_national: r.dgie_national ?? 0 } },
    };
  }

  /**
   * For one role: every area of its level holding rented homes, with how many
   * homes, whether someone holds the post, and how many guests wait there.
   */
  async withHomes(role: LeaderRole, today: string): Promise<(UncoveredRow & { covered: boolean })[]> {
    const level = LEADER_ROLE_SCOPE[role];
    const key = sql.raw(`${level}_id`);
    const result = await this.db.execute(sql`
      with homes as (${HOME_PLACE}),
      areas as (
        select h.${key} as id, count(*)::int as homes from homes h where h.${key} is not null group by 1
      )
      select ${role}::text as role, ar.id as "areaId", ar.homes,
             exists (select 1 from oversight_assignments a where a.revoked_at is null and a.oversight_role::text = ${role}
                       and ${level === 'country' ? sql`true` : sql`a.${key} = ar.id`}) as covered,
             (select count(*)::int from guest_registration_routes r join guest_registrations g on g.id = r.registration_id
               where r.assignment_id is null and r.recipient_role::text = ${role}
                 and ${level === 'country' ? sql`true` : sql`r.${key} = ar.id`}
                 and g.status = 'submitted' and g.departure_on >= ${today}::date) as "waitingReports",
             ${placeColumns(level)}
        from areas ar
        ${placeJoins(level)}
        left join provinces pr on pr.id = d.province_id
       order by "waitingReports" desc, ar.homes desc
       limit 2000`);
    return rowsOf<UncoveredRow & { covered: boolean; areaId: number }>(result);
  }

  /** Leaders with guests delivered to their post who have opened none of them. */
  async neverOpened(): Promise<NeverOpenedRow[]> {
    const result = await this.db.execute(sql`
      select a.id as "assignmentId", nullif(btrim(u.name), '') as name, u.email, a.oversight_role::text as role,
             a.scope_level::text as "scopeLevel",
             d.name as "districtName", s.name as "sectorName", c.name as "cellName", v.name as "villageName",
             count(r.id)::int as delivered, min(r.delivered_at) as "firstDeliveredAt", a.granted_at as "grantedAt"
        from oversight_assignments a
        join users u on u.id = a.user_id
        join guest_registration_routes r on r.assignment_id = a.id
        left join districts d on d.id = a.district_id
        left join sectors s on s.id = a.sector_id
        left join cells c on c.id = a.cell_id
        left join villages v on v.id = a.village_id
       where a.revoked_at is null and a.oversight_role::text in (${LEADER_LIST})
       group by a.id, u.name, u.email, d.name, s.name, c.name, v.name
      having count(r.seen_at) = 0
       order by min(r.delivered_at)
       limit 500`);
    return rowsOf<NeverOpenedRow>(result);
  }
}

/** The ids and names of a place and every level above it, for an area at `level`. */
function placeColumns(level: LeaderLevel): SQL {
  switch (level) {
    case 'village':
      return sql`d.province_id as "provinceId", s.district_id as "districtId", c.sector_id as "sectorId", v.cell_id as "cellId", v.id as "villageId",
                 pr.name as "provinceName", d.name as "districtName", s.name as "sectorName", c.name as "cellName", v.name as "villageName"`;
    case 'cell':
      return sql`d.province_id as "provinceId", s.district_id as "districtId", c.sector_id as "sectorId", c.id as "cellId", null::int as "villageId",
                 pr.name as "provinceName", d.name as "districtName", s.name as "sectorName", c.name as "cellName", null::text as "villageName"`;
    case 'sector':
      return sql`d.province_id as "provinceId", s.district_id as "districtId", s.id as "sectorId", null::int as "cellId", null::int as "villageId",
                 pr.name as "provinceName", d.name as "districtName", s.name as "sectorName", null::text as "cellName", null::text as "villageName"`;
    case 'district':
      return sql`d.province_id as "provinceId", d.id as "districtId", null::int as "sectorId", null::int as "cellId", null::int as "villageId",
                 pr.name as "provinceName", d.name as "districtName", null::text as "sectorName", null::text as "cellName", null::text as "villageName"`;
    case 'province':
      return sql`pp.id as "provinceId", null::int as "districtId", null::int as "sectorId", null::int as "cellId", null::int as "villageId",
                 pp.name as "provinceName", null::text as "districtName", null::text as "sectorName", null::text as "cellName", null::text as "villageName"`;
    case 'country':
      return sql`null::int as "provinceId", null::int as "districtId", null::int as "sectorId", null::int as "cellId", null::int as "villageId",
                 'Rwanda'::text as "provinceName", null::text as "districtName", null::text as "sectorName", null::text as "cellName", null::text as "villageName"`;
  }
}

function placeJoins(level: LeaderLevel): SQL {
  switch (level) {
    case 'village':
      return sql`join villages v on v.id = ar.id join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id join districts d on d.id = s.district_id`;
    case 'cell':
      return sql`join cells c on c.id = ar.id join sectors s on s.id = c.sector_id join districts d on d.id = s.district_id`;
    case 'sector':
      return sql`join sectors s on s.id = ar.id join districts d on d.id = s.district_id`;
    case 'district':
      return sql`join districts d on d.id = ar.id`;
    // No district here: the province row stands alone (aliased so the shared province join stays empty).
    case 'province':
      return sql`join provinces pp on pp.id = ar.id left join districts d on false`;
    case 'country':
      return sql`left join districts d on false`;
  }
}
