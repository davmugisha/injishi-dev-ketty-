import { Inject, Injectable } from '@nestjs/common';
import type { GuestHostKind, IdKind, LeaderRole } from '@injishi/contracts';
import { sql, type SQL } from 'drizzle-orm';

import { auditEvents, guestRegistrationRoutes, guestRegistrations, outboxEvents } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Area, PlannedRoute } from '../domain/guest-routing';

/** The transaction handle Drizzle hands a `db.transaction` callback. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbOrTx = Database | Tx;

/** Where a home is, with every name a mail, a list or an address needs. */
export interface HomeRow extends Area {
  workspaceId: string;
  orgId: string;
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitLabel: string | null;
  addressText: string | null;
  villageName: string | null;
  cellName: string | null;
  sectorName: string | null;
  districtName: string | null;
}

/** A tenant's lease and its home: what filing a tenant's guest needs. */
export interface TenancyHome extends HomeRow {
  leaseId: string;
  status: string;
  tenantId: string;
  tenantUserId: string | null;
  tenantName: string;
  /** The first and last day of the lease (the moved out day once ended). */
  start: string;
  end: string;
}

/** A guest registration with the words every reader needs. */
export interface RegistrationRow extends Area {
  id: string;
  orgId: string;
  workspaceId: string;
  hostKind: GuestHostKind;
  leaseId: string | null;
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitLabel: string | null;
  addressText: string | null;
  villageName: string | null;
  cellName: string | null;
  sectorName: string | null;
  districtName: string | null;
  registeredByUserId: string;
  fullName: string;
  phone: string;
  nationality: string;
  nationalityName: string;
  idKind: IdKind | null;
  idNumber: string | null;
  relationship: string;
  relationshipLabel: string;
  relationshipOther: string | null;
  originCountry: string;
  originCountryName: string;
  originVillageId: number | null;
  originVillageName: string | null;
  originCellName: string | null;
  originSectorName: string | null;
  originDistrictName: string | null;
  arrivalOn: string;
  departureOn: string;
  status: 'submitted' | 'cancelled';
  hostName: string;
  hostPhone: string | null;
  changedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

/** One step of a registration's chain as stored. */
export interface RouteRow extends Area {
  id: string;
  registrationId: string;
  role: LeaderRole;
  step: number;
  assignmentId: string | null;
  deliveredAt: Date | null;
  notifiedAt: Date | null;
  seenAt: Date | null;
  seenByName: string | null;
  flaggedAt: Date | null;
  flagNote: string | null;
  flaggedByName: string | null;
}

/** A person holding a post right now. */
export interface Holder {
  assignmentId: string;
  userId: string;
  email: string;
  name: string | null;
}

/** A building a landlord registers guests at. */
export interface BuildingRow {
  id: string;
  name: string;
  addressText: string | null;
  villageId: number | null;
  villageName: string | null;
  cellName: string | null;
  sectorName: string | null;
  districtName: string | null;
  units: { id: string; label: string }[];
}

/** What a registration stores about the guest. */
export interface GuestValues {
  fullName: string;
  phone: string;
  nationality: string;
  idKind: IdKind | null;
  idNumber: string | null;
  relationship: string;
  relationshipOther: string | null;
  originCountry: string;
  originVillageId: number | null;
  arrivalOn: string;
  departureOn: string;
}

/** A guest as a report counts it, plus where it is. */
export interface ReportRowRaw {
  arrivalOn: string;
  departureOn: string;
  nationality: string;
  nationalityName: string;
  relationship: string;
  relationshipLabel: string;
  sectorId: number | null;
  sectorName: string | null;
  cellId: number | null;
  cellName: string | null;
  villageId: number | null;
  villageName: string | null;
  districtName: string | null;
  propertyId: string;
  unitId: string | null;
  addressText: string | null;
  unitLabel: string | null;
  flagged: boolean;
}

/** One post's figures for a report: see `reportChain`. */
export interface ReportChainRow {
  role: string;
  step: number;
  guests: number;
  delivered: number;
  opened: number;
  flagged: number;
  waiting: number;
}

/** A route on a current guest that no leader has yet, with where its home is now. */
export interface WaitingRouteRow {
  routeId: string;
  registrationId: string;
  role: LeaderRole;
  propertyId: string;
  current: Area;
  stored: Area;
}

const MAX_REPORT_ROWS = 50_000;

function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/** pg hands back timestamptz as Date; be safe with a string too. */
function asDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v : new Date(String(v));
}

/** The place joins every registration read uses. */
const AREA_NAMES = sql`
  left join villages v on v.id = g.village_id
  left join cells ce on ce.id = g.cell_id
  left join sectors s on s.id = g.sector_id
  left join districts d on d.id = g.district_id`;

const REGISTRATION_SELECT = sql`
  select g.id, g.org_id as "orgId", g.workspace_id as "workspaceId", g.host_kind::text as "hostKind",
         g.lease_id as "leaseId", g.property_id as "propertyId", p.name as "propertyName",
         g.unit_id as "unitId", u.label as "unitLabel", p.address_text as "addressText",
         g.village_id as "villageId", g.cell_id as "cellId", g.sector_id as "sectorId", g.district_id as "districtId",
         d.province_id as "provinceId",
         v.name as "villageName", ce.name as "cellName", s.name as "sectorName", d.name as "districtName",
         g.registered_by_user_id as "registeredByUserId",
         g.full_name as "fullName", g.phone, g.nationality, c.name as "nationalityName",
         g.id_kind::text as "idKind", g.id_number as "idNumber",
         coalesce(g.relationship, 'stay_guest') as relationship, coalesce(gr.label, 'Staying guest') as "relationshipLabel", g.relationship_other as "relationshipOther",
         g.origin_country as "originCountry", oc.name as "originCountryName", g.origin_village_id as "originVillageId",
         ov.name as "originVillageName", oce.name as "originCellName", os.name as "originSectorName", od.name as "originDistrictName",
         to_char(g.arrival_on, 'YYYY-MM-DD') as "arrivalOn", to_char(g.departure_on, 'YYYY-MM-DD') as "departureOn",
         g.status::text as status,
         case when g.host_kind = 'tenant' then t.full_name
              when g.host_kind::text = 'hotel' then p.name
              else coalesce(nullif(btrim(lp.signatory_name), ''), o.legal_name) end as "hostName",
         case when g.host_kind = 'tenant' then t.phone
              when g.host_kind::text = 'hotel' then p.contact_phone
              else coalesce(lp.contact_phone, p.contact_phone, ru.phone_number) end as "hostPhone",
         g.changed_at as "changedAt", g.cancelled_at as "cancelledAt", g.created_at as "createdAt"
    from guest_registrations g
    join properties p on p.id = g.property_id
    left join rental_units u on u.id = g.unit_id
    join countries c on c.code = g.nationality
    left join guest_relationships gr on gr.code = g.relationship
    join countries oc on oc.code = g.origin_country
    left join villages ov on ov.id = g.origin_village_id
    left join cells oce on oce.id = ov.cell_id
    left join sectors os on os.id = oce.sector_id
    left join districts od on od.id = os.district_id
    left join leases l on l.id = g.lease_id
    left join tenants t on t.id = l.tenant_id
    left join orgs o on o.id = g.org_id
    left join landlord_profiles lp on lp.org_id = g.org_id
    left join users ru on ru.id = g.registered_by_user_id
    ${AREA_NAMES}`;

function registration(raw: Record<string, unknown>): RegistrationRow {
  return {
    ...(raw as unknown as RegistrationRow),
    changedAt: asDate(raw.changedAt),
    cancelledAt: asDate(raw.cancelledAt),
    createdAt: asDate(raw.createdAt) ?? new Date(0),
  };
}

/** A home from a property (and a unit), its place read from the village up. */
const HOME_SELECT = sql`
  p.workspace_id as "workspaceId", p.org_id as "orgId", p.id as "propertyId", p.name as "propertyName",
  p.address_text as "addressText",
  p.village_id as "villageId", hv.cell_id as "cellId",
  coalesce(hc.sector_id, p.sector_id) as "sectorId",
  coalesce(hs.district_id, p.district_id) as "districtId", hd.province_id as "provinceId",
  hv.name as "villageName", hc.name as "cellName", hs.name as "sectorName", hd.name as "districtName"`;

const HOME_JOINS = sql`
  left join villages hv on hv.id = p.village_id
  left join cells hc on hc.id = hv.cell_id
  left join sectors hs on hs.id = coalesce(hc.sector_id, p.sector_id)
  left join districts hd on hd.id = coalesce(hs.district_id, p.district_id)`;

/** The column a role's post is keyed on; null for DGIE headquarters, which holds every guest. Fixed strings only. */
const POST_COLUMN: Readonly<Record<LeaderRole, string | null>> = {
  village_leader: 'village_id',
  dasso: 'sector_id',
  cell_executive: 'cell_id',
  sector_executive: 'sector_id',
  district_officer: 'district_id',
  district_immigration: 'district_id',
  dgie_province: 'province_id',
  dgie_national: null,
  dgie_village: 'village_id',
  dgie_cell: 'cell_id',
};

/** A post's own place as a predicate on `alias` (assignments `a` or routes `r`). */
function postMatch(alias: 'a' | 'r', role: LeaderRole, key: number): SQL {
  const column = POST_COLUMN[role];
  return column ? sql`${sql.raw(`${alias}.${column}`)} = ${key}` : sql`true`;
}

/**
 * The guest registry's reads and writes (P5): registrations, the routes to
 * the leaders, who holds each post, the leader's lists and reports, and the
 * retention purge. Scope is the caller's: every leader read takes the
 * predicate `scopeSql` built from the leader's own posts.
 */
@Injectable()
export class GuestRegistryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  // --- Homes -------------------------------------------------------------------------

  /** A lease and its home, when the caller is its tenant and it is not a draft. */
  async tenancyHome(userId: string, leaseId: string): Promise<TenancyHome | null> {
    const result = await this.db.execute(sql`
      select l.id as "leaseId", l.status::text as status, l.tenant_id as "tenantId", t.user_id as "tenantUserId",
             t.full_name as "tenantName",
             to_char(l.start_date, 'YYYY-MM-DD') as start,
             to_char(coalesce(l.ended_on, l.end_date), 'YYYY-MM-DD') as "end",
             l.unit_id as "unitId", u.label as "unitLabel",
             ${HOME_SELECT}
        from leases l
        join tenants t on t.id = l.tenant_id
        join properties p on p.id = l.property_id
        left join rental_units u on u.id = l.unit_id
        ${HOME_JOINS}
       where l.id = ${leaseId} and t.user_id = ${userId} and l.status::text <> 'draft'
       limit 1`);
    return rowsOf<TenancyHome>(result)[0] ?? null;
  }

  /** One of the landlord's buildings (and a unit of it), or null. */
  async buildingHome(workspaceId: string, propertyId: string, unitId: string | null): Promise<HomeRow | null> {
    const result = await this.db.execute(sql`
      select ${HOME_SELECT}, u.id as "unitId", u.label as "unitLabel"
        from properties p
        left join rental_units u on u.id = ${unitId} and u.property_id = p.id
        ${HOME_JOINS}
       where p.id = ${propertyId} and p.workspace_id = ${workspaceId} and p.archived_at is null
       limit 1`);
    const row = rowsOf<HomeRow>(result)[0];
    if (!row) return null;
    if (unitId && !row.unitId) return null;
    return row;
  }

  /** Whether a stay already has its registration (check in is retried; the leaders hear once). */
  async stayRegistered(guestStayId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      select 1 from guest_registrations where guest_stay_id = ${guestStayId} limit 1`);
    return rowsOf<{ '?column?': number }>(result).length > 0;
  }

  /** The landlord's buildings, each with where it is and its units. */
  async buildings(workspaceId: string): Promise<BuildingRow[]> {
    const result = await this.db.execute(sql`
      select p.id, p.name, p.address_text as "addressText", p.village_id as "villageId",
             hv.name as "villageName", hc.name as "cellName", hs.name as "sectorName", hd.name as "districtName",
             coalesce((select json_agg(json_build_object('id', ru.id, 'label', ru.label) order by ru.label)
                         from rental_units ru
                        where ru.property_id = p.id and ru.state::text <> 'retired'), '[]'::json) as units
        from properties p
        ${HOME_JOINS}
       where p.workspace_id = ${workspaceId} and p.archived_at is null
       order by p.name`);
    return rowsOf<BuildingRow>(result);
  }

  /** A property's place now, for routing a guest whose home's village was set later. */
  async propertyArea(propertyId: string): Promise<Area | null> {
    const result = await this.db.execute(sql`
      select ${HOME_SELECT} from properties p ${HOME_JOINS} where p.id = ${propertyId} limit 1`);
    const row = rowsOf<HomeRow>(result)[0];
    return row
      ? { villageId: row.villageId, cellId: row.cellId, sectorId: row.sectorId, districtId: row.districtId, provinceId: row.provinceId ?? null }
      : null;
  }

  /** The place names of an area, for a mail or a waiting list. */
  async areaNames(area: Area): Promise<{ villageName: string | null; cellName: string | null; sectorName: string | null; districtName: string | null }> {
    const result = await this.db.execute(sql`
      select (select name from villages where id = ${area.villageId}) as "villageName",
             (select name from cells where id = ${area.cellId}) as "cellName",
             (select name from sectors where id = ${area.sectorId}) as "sectorName",
             (select name from districts where id = ${area.districtId}) as "districtName"`);
    return rowsOf<{ villageName: string | null; cellName: string | null; sectorName: string | null; districtName: string | null }>(result)[0] ?? {
      villageName: null,
      cellName: null,
      sectorName: null,
      districtName: null,
    };
  }

  /** Is this a village in Rwanda? Its path in words when it is. */
  async villagePath(villageId: number): Promise<string | null> {
    const result = await this.db.execute(sql`
      select concat_ws(', ', v.name, c.name, s.name, d.name) as words
        from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id join districts d on d.id = s.district_id
       where v.id = ${villageId}`);
    return rowsOf<{ words: string }>(result)[0]?.words ?? null;
  }

  async countryName(code: string): Promise<string | null> {
    const result = await this.db.execute(sql`select name from countries where code = ${code} and active limit 1`);
    return rowsOf<{ name: string }>(result)[0]?.name ?? null;
  }

  async relationship(code: string): Promise<{ code: string; label: string; needsDetail: boolean } | null> {
    const result = await this.db.execute(sql`
      select code, label, needs_detail as "needsDetail" from guest_relationships where code = ${code} and active limit 1`);
    return rowsOf<{ code: string; label: string; needsDetail: boolean }>(result)[0] ?? null;
  }

  async countries(): Promise<{ code: string; name: string }[]> {
    return rowsOf(await this.db.execute(sql`select code, name from countries where active order by sort_order, name`));
  }

  async relationships(): Promise<{ code: string; label: string; needsDetail: boolean }[]> {
    return rowsOf(
      await this.db.execute(sql`
        select code, label, needs_detail as "needsDetail" from guest_relationships where active order by sort_order, label`),
    );
  }

  // --- Posts --------------------------------------------------------------------------

  /** Everyone holding a post at a place right now, the longest serving first. */
  async holders(role: LeaderRole, key: number | null, db: DbOrTx = this.db): Promise<Holder[]> {
    if (key === null) return [];
    const result = await db.execute(sql`
      select a.id as "assignmentId", a.user_id as "userId", u.email, u.name
        from oversight_assignments a
        join users u on u.id = a.user_id
       where a.revoked_at is null and a.oversight_role::text = ${role}
         and ${postMatch('a', role, key)}
       order by a.granted_at, a.id`);
    return rowsOf<Holder>(result);
  }

  // --- Registrations ------------------------------------------------------------------

  async insertRegistration(
    tx: Tx,
    values: GuestValues & {
      orgId: string;
      workspaceId: string;
      hostKind: GuestHostKind;
      leaseId: string | null;
      propertyId: string;
      unitId: string | null;
      /** A stay business's guest: the stay checked in. */
      guestStayId?: string | null;
      registeredByUserId: string;
      area: Area;
    },
  ): Promise<string> {
    const [row] = await tx
      .insert(guestRegistrations)
      .values({
        orgId: values.orgId,
        workspaceId: values.workspaceId,
        hostKind: values.hostKind,
        leaseId: values.leaseId,
        propertyId: values.propertyId,
        unitId: values.unitId,
        guestStayId: values.guestStayId ?? null,
        registeredByUserId: values.registeredByUserId,
        villageId: values.area.villageId,
        cellId: values.area.cellId,
        sectorId: values.area.sectorId,
        districtId: values.area.districtId,
        fullName: values.fullName,
        phone: values.phone,
        nationality: values.nationality,
        idKind: values.idKind,
        idNumber: values.idNumber,
        relationship: values.relationship,
        relationshipOther: values.relationshipOther,
        originCountry: values.originCountry,
        originVillageId: values.originVillageId,
        arrivalOn: values.arrivalOn,
        departureOn: values.departureOn,
      })
      .returning({ id: guestRegistrations.id });
    if (!row) throw new Error('Guest registration insert returned no row.');
    return row.id;
  }

  /** Write a registration's routes; each with a holder is delivered now. */
  async insertRoutes(tx: Tx, registrationId: string, routes: (PlannedRoute & { assignmentId: string | null })[], now: Date): Promise<string[]> {
    if (routes.length === 0) return [];
    const rows = await tx.insert(guestRegistrationRoutes).values(
      routes.map((r) => ({
        registrationId,
        step: r.step,
        recipientRole: r.role,
        villageId: r.area.villageId,
        cellId: r.area.cellId,
        sectorId: r.area.sectorId,
        districtId: r.area.districtId,
        provinceId: r.area.provinceId ?? null,
        assignmentId: r.assignmentId,
        deliveredAt: r.assignmentId ? now : null,
      })),
    ).returning({ id: guestRegistrationRoutes.id });
    return rows.map((r) => r.id);
  }

  /**
   * Change a guest before arrival. The routes for steps that stay keep what
   * they had, unseen again; a step that changed (Rwandan to abroad switches
   * the district post) is replaced.
   */
  /**
   * Hotel guests whose filed window ends by `today` while they are still in house and planned beyond it:
   * the window moves on to the next stretch (to the planned departure, at most 90 days). Their ids.
   */
  async rollHotelStays(today: string): Promise<string[]> {
    const result = await this.db.execute(sql`
      with due as (
        select g.id, g.departure_on,
               greatest((coalesce(gs.planned_exit_at, now() + interval '1 day') at time zone 'Africa/Kigali')::date,
                        g.departure_on + 1) as leaves
          from guest_registrations g
          join guest_stays gs on gs.id = g.guest_stay_id
         where g.host_kind::text = 'hotel' and g.status = 'submitted' and gs.lifecycle = 'open'
           and g.departure_on <= ${today}::date
           and (gs.planned_exit_at is null
                or (gs.planned_exit_at at time zone 'Africa/Kigali')::date > g.departure_on)
      )
      update guest_registrations g
         set arrival_on = d.departure_on,
             departure_on = least(d.leaves, d.departure_on + 90),
             changed_at = now(), updated_at = now()
        from due d
       where g.id = d.id
      returning g.id`);
    return rowsOf<{ id: string }>(result).map((r) => r.id);
  }

  async updateRegistration(
    tx: Tx,
    registrationId: string,
    values: GuestValues & { propertyId: string; unitId: string | null; area: Area },
    routes: (PlannedRoute & { assignmentId: string | null })[],
    now: Date,
  ): Promise<void> {
    await tx.execute(sql`
      update guest_registrations
         set full_name = ${values.fullName}, phone = ${values.phone}, nationality = ${values.nationality},
             id_kind = ${values.idKind}, id_number = ${values.idNumber},
             relationship = ${values.relationship}, relationship_other = ${values.relationshipOther},
             origin_country = ${values.originCountry}, origin_village_id = ${values.originVillageId},
             arrival_on = ${values.arrivalOn}::date, departure_on = ${values.departureOn}::date,
             property_id = ${values.propertyId}, unit_id = ${values.unitId},
             village_id = ${values.area.villageId}, cell_id = ${values.area.cellId},
             sector_id = ${values.area.sectorId}, district_id = ${values.area.districtId},
             changed_at = ${now}, updated_at = ${now}
       where id = ${registrationId}`);
    const keep = routes.map((r) => r.role);
    await tx.execute(sql`
      delete from guest_registration_routes
       where registration_id = ${registrationId}
         and recipient_role::text not in (${sql.join(keep.map((r) => sql`${r}`), sql`, `)})`);
    for (const r of routes) {
      await tx.execute(sql`
        insert into guest_registration_routes
               (registration_id, step, recipient_role, village_id, cell_id, sector_id, district_id, assignment_id, delivered_at)
        values (${registrationId}, ${r.step}, ${r.role}::oversight_role, ${r.area.villageId}, ${r.area.cellId},
                ${r.area.sectorId}, ${r.area.districtId}, ${r.assignmentId}, ${r.assignmentId ? now : null})
        on conflict (registration_id, recipient_role) do update
           set village_id = excluded.village_id, cell_id = excluded.cell_id, sector_id = excluded.sector_id,
               district_id = excluded.district_id,
               assignment_id = excluded.assignment_id,
               delivered_at = case when excluded.assignment_id is null then null
                                   when excluded.assignment_id = guest_registration_routes.assignment_id
                                     then guest_registration_routes.delivered_at
                                   else excluded.delivered_at end,
               seen_at = null, seen_by_user_id = null, notified_at = null`);
    }
  }

  /** Cancel, once. False when it was cancelled already. */
  async cancel(tx: Tx, registrationId: string, userId: string, now: Date): Promise<boolean> {
    const result = await tx.execute(sql`
      update guest_registrations
         set status = 'cancelled', cancelled_at = ${now}, cancelled_by_user_id = ${userId}, updated_at = ${now}
       where id = ${registrationId} and status = 'submitted'
      returning id`);
    return rowsOf(result).length > 0;
  }

  /** One registration by id with no scope: callers decide who may read it. */
  async find(registrationId: string): Promise<RegistrationRow | null> {
    const result = await this.db.execute(sql`${REGISTRATION_SELECT} where g.id = ${registrationId} limit 1`);
    const raw = rowsOf<Record<string, unknown>>(result)[0];
    return raw ? registration(raw) : null;
  }

  /** A host's guests: one lease's (tenant) or a workspace's own (landlord, never a tenant's). */
  async hostList(where: { leaseId: string } | { workspaceId: string; propertyIds: readonly string[] | null }): Promise<RegistrationRow[]> {
    const filter =
      'leaseId' in where
        ? sql`g.lease_id = ${where.leaseId} and g.host_kind = 'tenant'`
        : sql`g.workspace_id = ${where.workspaceId} and g.host_kind = 'landlord'${
            where.propertyIds === null
              ? sql``
              : where.propertyIds.length
                ? sql` and g.property_id in (${sql.join(where.propertyIds.map((id) => sql`${id}`), sql`, `)})`
                : sql` and false`
          }`;
    const result = await this.db.execute(sql`
      ${REGISTRATION_SELECT}
       where ${filter}
       order by g.arrival_on desc, g.created_at desc
       limit 1000`);
    return rowsOf<Record<string, unknown>>(result).map(registration);
  }

  async routesFor(registrationIds: readonly string[], db: DbOrTx = this.db): Promise<RouteRow[]> {
    if (registrationIds.length === 0) return [];
    const result = await db.execute(sql`
      select r.id, r.registration_id as "registrationId", r.recipient_role::text as role, r.step,
             r.village_id as "villageId", r.cell_id as "cellId", r.sector_id as "sectorId", r.district_id as "districtId",
             r.assignment_id as "assignmentId", r.delivered_at as "deliveredAt", r.notified_at as "notifiedAt",
             r.seen_at as "seenAt", su.name as "seenByName",
             r.flagged_at as "flaggedAt", r.flag_note as "flagNote", fu.name as "flaggedByName"
        from guest_registration_routes r
        left join users su on su.id = r.seen_by_user_id
        left join users fu on fu.id = r.flagged_by_user_id
       where r.registration_id in (${sql.join(registrationIds.map((id) => sql`${id}`), sql`, `)})
       order by r.step, r.recipient_role`);
    return rowsOf<Record<string, unknown>>(result).map((r) => ({
      ...(r as unknown as RouteRow),
      deliveredAt: asDate(r.deliveredAt),
      notifiedAt: asDate(r.notifiedAt),
      seenAt: asDate(r.seenAt),
      flaggedAt: asDate(r.flaggedAt),
    }));
  }

  /** Mark routes emailed. */
  async markNotified(routeIds: readonly string[], now: Date): Promise<void> {
    if (routeIds.length === 0) return;
    await this.db.execute(sql`
      update guest_registration_routes set notified_at = ${now}
       where id in (${sql.join(routeIds.map((id) => sql`${id}`), sql`, `)}) and notified_at is null`);
  }

  // --- The leader's lists ----------------------------------------------------------------

  async leaderList(scope: SQL, filter: SQL, order: SQL, limit: number, offset: number): Promise<RegistrationRow[]> {
    const result = await this.db.execute(sql`
      ${REGISTRATION_SELECT}
       where g.status = 'submitted' and ${scope} and ${filter}
       order by ${order}, g.created_at desc, g.id
       limit ${limit} offset ${offset}`);
    return rowsOf<Record<string, unknown>>(result).map(registration);
  }

  async leaderTotal(scope: SQL, filter: SQL): Promise<number> {
    const result = await this.db.execute(sql`
      select count(*)::int as n from guest_registrations g where g.status = 'submitted' and ${scope} and ${filter}`);
    return rowsOf<{ n: number }>(result)[0]?.n ?? 0;
  }

  /** The tab counts and the unseen count, over one scope. */
  async leaderCounts(scope: SQL, narrow: SQL, unseen: SQL, today: string, soonUntil: string): Promise<{
    arriving: number;
    later: number;
    staying: number;
    left: number;
    flagged: number;
    unseen: number;
    stayingForeign: number;
    current: number;
    arrivingByDay: number[];
    stayingByDay: number[];
  }> {
    const result = await this.db.execute(sql`
      select
        count(*) filter (where g.arrival_on > ${today}::date and g.arrival_on <= ${soonUntil}::date)::int as arriving,
        count(*) filter (where g.arrival_on > ${soonUntil}::date)::int as later,
        count(*) filter (where g.arrival_on <= ${today}::date and g.departure_on >= ${today}::date)::int as staying,
        count(*) filter (where g.departure_on < ${today}::date)::int as "left",
        count(*) filter (where exists (select 1 from guest_registration_routes fr where fr.registration_id = g.id and fr.flagged_at is not null))::int as flagged,
        count(*) filter (where g.departure_on >= ${today}::date and ${unseen})::int as unseen,
        count(*) filter (where g.arrival_on <= ${today}::date and g.departure_on >= ${today}::date and g.nationality <> 'RW')::int as "stayingForeign",
        count(*) filter (where g.departure_on >= ${today}::date)::int as current
        from guest_registrations g
       where g.status = 'submitted' and ${scope} and ${narrow}`);
    const row = rowsOf<Record<string, number>>(result)[0] ?? {};
    // Day by day, for the cards' small charts: arrivals over the next 7 days, guests staying over the last 14.
    const days = await this.db.execute(sql`
      select d::date as day,
             count(g.id) filter (where g.arrival_on = d::date)::int as arriving,
             count(g.id) filter (where g.arrival_on <= d::date and g.departure_on >= d::date)::int as staying
        from generate_series(${today}::date - 13, ${soonUntil}::date, interval '1 day') d
        left join guest_registrations g
          on g.status = 'submitted' and ${scope} and ${narrow}
         and g.arrival_on <= d::date and g.departure_on >= d::date
       group by d order by d`);
    const byDay = rowsOf<{ day: string; arriving: number; staying: number }>(days);
    return {
      arriving: row.arriving ?? 0,
      later: row.later ?? 0,
      staying: row.staying ?? 0,
      left: row.left ?? 0,
      flagged: row.flagged ?? 0,
      unseen: row.unseen ?? 0,
      stayingForeign: row.stayingForeign ?? 0,
      current: row.current ?? 0,
      arrivingByDay: byDay.slice(14).map((d) => d.arriving),
      stayingByDay: byDay.slice(0, 14).map((d) => d.staying),
    };
  }

  /** One registration inside the scope, or null (a 404 to the caller). */
  async leaderFind(scope: SQL, registrationId: string): Promise<RegistrationRow | null> {
    const result = await this.db.execute(sql`
      ${REGISTRATION_SELECT} where g.id = ${registrationId} and g.status = 'submitted' and ${scope} limit 1`);
    const raw = rowsOf<Record<string, unknown>>(result)[0];
    return raw ? registration(raw) : null;
  }

  /** Each named role's route records its first opening. Returns the routes newly seen. */
  async markSeen(registrationId: string, roles: readonly LeaderRole[], userId: string, now: Date): Promise<number> {
    if (roles.length === 0) return 0;
    const result = await this.db.execute(sql`
      update guest_registration_routes
         set seen_at = ${now}, seen_by_user_id = ${userId}
       where registration_id = ${registrationId} and seen_at is null
         and recipient_role::text in (${sql.join(roles.map((r) => sql`${r}`), sql`, `)})
      returning id`);
    return rowsOf(result).length;
  }

  /** Flag on the leader's own route (opening it too); a second flag replaces the note. */
  async flag(tx: Tx, registrationId: string, role: LeaderRole, userId: string, note: string, now: Date): Promise<string | null> {
    const result = await tx.execute(sql`
      update guest_registration_routes
         set flagged_at = ${now}, flagged_by_user_id = ${userId}, flag_note = ${note},
             seen_at = coalesce(seen_at, ${now}), seen_by_user_id = coalesce(seen_by_user_id, ${userId})
       where registration_id = ${registrationId} and recipient_role::text = ${role}
      returning id`);
    return rowsOf<{ id: string }>(result)[0]?.id ?? null;
  }

  // --- Filters and scope words ----------------------------------------------------------

  async sectorsIn(districtIds: readonly number[]): Promise<{ id: number; name: string }[]> {
    if (districtIds.length === 0) return [];
    return rowsOf(
      await this.db.execute(sql`
        select id, name from sectors where district_id in (${sql.join(districtIds.map((id) => sql`${id}`), sql`, `)}) order by name`),
    );
  }

  async cellsIn(sectorIds: readonly number[]): Promise<{ id: number; name: string; sectorId: number }[]> {
    if (sectorIds.length === 0) return [];
    return rowsOf(
      await this.db.execute(sql`
        select id, name, sector_id as "sectorId" from cells
         where sector_id in (${sql.join(sectorIds.map((id) => sql`${id}`), sql`, `)}) order by name`),
    );
  }

  async villagesIn(cellIds: readonly number[]): Promise<{ id: number; name: string; cellId: number }[]> {
    if (cellIds.length === 0) return [];
    return rowsOf(
      await this.db.execute(sql`
        select id, name, cell_id as "cellId" from villages
         where cell_id in (${sql.join(cellIds.map((id) => sql`${id}`), sql`, `)}) order by name`),
    );
  }

  /** The nationalities of the filed guests in scope, most guests first: the list's nationality filter. */
  async nationalitiesIn(scope: SQL, narrow: SQL): Promise<{ code: string; name: string; count: number }[]> {
    return rowsOf(
      await this.db.execute(sql`
        select g.nationality as code, c.name, count(*)::int as count
          from guest_registrations g join countries c on c.code = g.nationality
         where g.status = 'submitted' and ${scope} and ${narrow}
         group by g.nationality, c.name order by count(*) desc, c.name`),
    );
  }

  /** Is the place inside the leader's area? Used to refuse a narrowing outside it. */
  async placeIn(level: 'sector' | 'cell' | 'village', id: number): Promise<Area | null> {
    const result =
      level === 'village'
        ? await this.db.execute(sql`
            select v.id as "villageId", v.cell_id as "cellId", c.sector_id as "sectorId", s.district_id as "districtId"
              from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id where v.id = ${id}`)
        : level === 'cell'
          ? await this.db.execute(sql`
              select null::int as "villageId", c.id as "cellId", c.sector_id as "sectorId", s.district_id as "districtId"
                from cells c join sectors s on s.id = c.sector_id where c.id = ${id}`)
          : await this.db.execute(sql`
              select null::int as "villageId", null::int as "cellId", s.id as "sectorId", s.district_id as "districtId"
                from sectors s where s.id = ${id}`);
    return rowsOf<Area>(result)[0] ?? null;
  }

  async leader(userId: string): Promise<{ name: string | null; email: string }> {
    const result = await this.db.execute(sql`select name, email from users where id = ${userId}`);
    return rowsOf<{ name: string | null; email: string }>(result)[0] ?? { name: null, email: '' };
  }

  // --- Reports -----------------------------------------------------------------------------

  async reportRows(scope: SQL, narrow: SQL, from: string, to: string): Promise<ReportRowRaw[]> {
    const result = await this.db.execute(sql`
      select to_char(g.arrival_on, 'YYYY-MM-DD') as "arrivalOn", to_char(g.departure_on, 'YYYY-MM-DD') as "departureOn",
             g.nationality, c.name as "nationalityName", coalesce(g.relationship, 'stay_guest') as relationship, coalesce(gr.label, 'Staying guest') as "relationshipLabel",
             g.sector_id as "sectorId", s.name as "sectorName", g.cell_id as "cellId", ce.name as "cellName",
             g.village_id as "villageId", v.name as "villageName", d.name as "districtName",
             g.property_id as "propertyId", g.unit_id as "unitId", p.address_text as "addressText", u.label as "unitLabel",
             exists (select 1 from guest_registration_routes fr where fr.registration_id = g.id and fr.flagged_at is not null) as flagged
        from guest_registrations g
        join properties p on p.id = g.property_id
        left join rental_units u on u.id = g.unit_id
        join countries c on c.code = g.nationality
        left join guest_relationships gr on gr.code = g.relationship
        ${AREA_NAMES}
       where g.status = 'submitted' and ${scope} and ${narrow}
         and g.arrival_on between ${from}::date and ${to}::date
       limit ${MAX_REPORT_ROWS}`);
    return rowsOf<ReportRowRaw>(result);
  }

  /** The period's guests along the chain, per post: received, delivered, opened, flagged, waiting. */
  async reportChain(scope: SQL, narrow: SQL, from: string, to: string): Promise<ReportChainRow[]> {
    const result = await this.db.execute(sql`
      select r.recipient_role::text as role, min(r.step)::int as step, count(*)::int as guests,
             count(r.delivered_at)::int as delivered, count(r.seen_at)::int as opened,
             count(r.flagged_at)::int as flagged, (count(*) filter (where r.assignment_id is null))::int as waiting
        from guest_registration_routes r
        join guest_registrations g on g.id = r.registration_id
       where g.status = 'submitted' and ${scope} and ${narrow}
         and g.arrival_on between ${from}::date and ${to}::date
       group by r.recipient_role
       order by min(r.step), r.recipient_role`);
    return rowsOf<ReportChainRow>(result);
  }

  async stayingNow(scope: SQL, narrow: SQL, today: string): Promise<number> {
    const result = await this.db.execute(sql`
      select count(*)::int as n from guest_registrations g
       where g.status = 'submitted' and ${scope} and ${narrow}
         and g.arrival_on <= ${today}::date and g.departure_on >= ${today}::date`);
    return rowsOf<{ n: number }>(result)[0]?.n ?? 0;
  }

  /** The purge's counts for arrival months inside the period, in the leader's area. */
  async purgedCounts(scope: SQL, narrow: SQL, from: string, to: string): Promise<{ registered: number; fromAbroad: number; flagged: number }> {
    const result = await this.db.execute(sql`
      select coalesce(sum(t.registrations), 0)::int as registered,
             coalesce(sum(t.registrations) filter (where t.from_abroad), 0)::int as "fromAbroad",
             coalesce(sum(t.flagged), 0)::int as flagged
        from guest_purge_tallies t
       where ${scope} and ${narrow}
         and t.arrival_month between date_trunc('month', ${from}::date)::date and ${to}::date`);
    return rowsOf<{ registered: number; fromAbroad: number; flagged: number }>(result)[0] ?? { registered: 0, fromAbroad: 0, flagged: 0 };
  }

  // --- Hand-over ---------------------------------------------------------------------------

  /**
   * Hand a newly appointed post what waited for one: current guests (not
   * cancelled, not left) whose route for this role names this place and has
   * nobody yet. Returns the registrations handed over.
   */
  async handOverWaiting(tx: Tx, role: LeaderRole, key: number, assignmentId: string, today: string, now: Date): Promise<string[]> {
    const result = await tx.execute(sql`
      update guest_registration_routes r
         set assignment_id = ${assignmentId}, delivered_at = ${now}
        from guest_registrations g
       where g.id = r.registration_id and r.assignment_id is null
         and r.recipient_role::text = ${role} and ${postMatch('r', role, key)}
         and g.status = 'submitted' and g.departure_on >= ${today}::date
      returning r.registration_id as "registrationId"`);
    return rowsOf<{ registrationId: string }>(result).map((r) => r.registrationId);
  }

  /**
   * Current guests with the routes they already have: the sweep compares them with the chain a guest
   * now goes along and adds the missing posts (a chain that gained a post, or a guest filed before it).
   */
  async currentWithRoles(today: string): Promise<{ id: string; nationality: string; area: Area; roles: string[] }[]> {
    const result = await this.db.execute(sql`
      select g.id, g.nationality, g.village_id as "villageId", g.cell_id as "cellId", g.sector_id as "sectorId",
             g.district_id as "districtId", d.province_id as "provinceId",
             coalesce(array_agg(r.recipient_role::text) filter (where r.id is not null), '{}') as roles
        from guest_registrations g
        left join districts d on d.id = g.district_id
        left join guest_registration_routes r on r.registration_id = g.id
       where g.status = 'submitted' and g.departure_on >= ${today}::date
       group by g.id, d.province_id
       limit 5000`);
    return rowsOf<Record<string, unknown>>(result).map((r) => ({
      id: r.id as string,
      nationality: r.nationality as string,
      area: {
        villageId: r.villageId as number | null,
        cellId: r.cellId as number | null,
        sectorId: r.sectorId as number | null,
        districtId: r.districtId as number | null,
        provinceId: r.provinceId as number | null,
      },
      roles: r.roles as string[],
    }));
  }

  /**
   * Routes of current guests still waiting, with where their home is now: the
   * hourly sweep (and setting a building's village) delivers them once the
   * place is known and someone holds the post.
   */
  async waitingRoutes(today: string, propertyId?: string): Promise<WaitingRouteRow[]> {
    const result = await this.db.execute(sql`
      select r.id as "routeId", r.registration_id as "registrationId", r.recipient_role::text as role, g.property_id as "propertyId",
             p.village_id as "cVillageId", hv.cell_id as "cCellId",
             coalesce(hc.sector_id, p.sector_id) as "cSectorId", coalesce(hs.district_id, p.district_id) as "cDistrictId",
             hd.province_id as "cProvinceId",
             g.village_id as "sVillageId", g.cell_id as "sCellId", g.sector_id as "sSectorId", g.district_id as "sDistrictId"
        from guest_registration_routes r
        join guest_registrations g on g.id = r.registration_id
        join properties p on p.id = g.property_id
        ${HOME_JOINS}
       where r.assignment_id is null and g.status = 'submitted' and g.departure_on >= ${today}::date
         ${propertyId ? sql`and g.property_id = ${propertyId}` : sql``}
       order by g.arrival_on
       limit 5000`);
    return rowsOf<Record<string, number | string | null>>(result).map((r) => ({
      routeId: r.routeId as string,
      registrationId: r.registrationId as string,
      role: r.role as LeaderRole,
      propertyId: r.propertyId as string,
      current: {
        villageId: r.cVillageId as number | null,
        cellId: r.cCellId as number | null,
        sectorId: r.cSectorId as number | null,
        districtId: r.cDistrictId as number | null,
        provinceId: r.cProvinceId as number | null,
      },
      stored: {
        villageId: r.sVillageId as number | null,
        cellId: r.sCellId as number | null,
        sectorId: r.sSectorId as number | null,
        districtId: r.sDistrictId as number | null,
      },
    }));
  }

  /** Move a current registration to where its home is now (its village was set). */
  async relocate(tx: Tx, registrationId: string, area: Area, now: Date): Promise<void> {
    await tx.execute(sql`
      update guest_registrations
         set village_id = ${area.villageId}, cell_id = ${area.cellId}, sector_id = ${area.sectorId},
             district_id = ${area.districtId}, updated_at = ${now}
       where id = ${registrationId}`);
  }

  /** Give a waiting route its area and, when someone holds the post, deliver it. Only a waiting route moves. */
  async deliverWaiting(tx: Tx, routeId: string, area: Area, assignmentId: string | null, now: Date): Promise<boolean> {
    const result = await tx.execute(sql`
      update guest_registration_routes
         set village_id = ${area.villageId}, cell_id = ${area.cellId}, sector_id = ${area.sectorId},
             district_id = ${area.districtId}, province_id = ${area.provinceId ?? null}, assignment_id = ${assignmentId},
             delivered_at = ${assignmentId ? now : null}
       where id = ${routeId} and assignment_id is null
      returning id`);
    return rowsOf(result).length > 0 && assignmentId !== null;
  }

  /**
   * An appointment ended: current guests delivered to it go to the next person
   * holding the same post, or back to waiting. Past guests keep the record of
   * who had them.
   */
  async releaseEnded(tx: Tx, assignmentId: string, role: LeaderRole, key: number | null, today: string, now: Date): Promise<number> {
    const next = (await this.holders(role, key, tx)).find((h) => h.assignmentId !== assignmentId) ?? null;
    const result = await tx.execute(sql`
      update guest_registration_routes r
         set assignment_id = ${next?.assignmentId ?? null},
             delivered_at = ${next ? now : null}
        from guest_registrations g
       where g.id = r.registration_id and r.assignment_id = ${assignmentId}
         and g.status = 'submitted' and g.departure_on >= ${today}::date
      returning r.id`);
    return rowsOf(result).length;
  }

  // --- Retention ----------------------------------------------------------------------------

  /**
   * Purge guests who left before `cutoff` (and cancelled ones that would have
   * arrived before it), keeping monthly counts by place and from-abroad. One
   * transaction: the counts and the delete land together.
   */
  async purge(cutoff: string): Promise<{ purged: number; tallies: number }> {
    return this.db.transaction(async (tx) => {
      const doomed = sql`(
        (g.status = 'submitted' and g.departure_on < ${cutoff}::date)
        or (g.status = 'cancelled' and g.arrival_on < ${cutoff}::date))`;
      const tallies = await tx.execute(sql`
        insert into guest_purge_tallies (arrival_month, village_id, cell_id, sector_id, district_id, from_abroad, registrations, flagged)
        select date_trunc('month', g.arrival_on)::date, g.village_id, g.cell_id, g.sector_id, g.district_id,
               g.nationality <> 'RW',
               count(*)::int,
               count(*) filter (where exists (select 1 from guest_registration_routes fr where fr.registration_id = g.id and fr.flagged_at is not null))::int
          from guest_registrations g
         where g.status = 'submitted' and g.departure_on < ${cutoff}::date
         group by 1, 2, 3, 4, 5, 6
        returning id`);
      const deleted = await tx.execute(sql`delete from guest_registrations g where ${doomed} returning g.id`);
      return { purged: rowsOf(deleted).length, tallies: rowsOf(tallies).length };
    });
  }

  // --- Audit and outbox ---------------------------------------------------------------------

  async audit(
    tx: DbOrTx,
    entry: { actorUserId: string | null; registrationId: string; eventType: string; diff?: Record<string, unknown>; reason?: string | null; districtId?: number | null },
  ): Promise<void> {
    await tx.insert(auditEvents).values({
      actorUserId: entry.actorUserId,
      subjectType: 'guest_registration',
      subjectId: entry.registrationId,
      eventType: entry.eventType,
      payloadDiff: (entry.diff ?? null) as never,
      reason: entry.reason ?? null,
      districtId: entry.districtId ?? null,
    });
  }

  /** One outbox row per change, ids only (blueprint 2.8). A replay writes nothing twice. */
  async outbox(
    tx: DbOrTx,
    event: { eventType: 'guest.registered' | 'guest.flagged'; registrationId: string; workspaceId: string; change: string; payload: Record<string, unknown> },
  ): Promise<void> {
    await tx
      .insert(outboxEvents)
      .values({
        aggregateType: 'guest_registration',
        aggregateId: event.registrationId,
        eventType: event.eventType,
        payload: event.payload,
        workspaceId: event.workspaceId,
        dedupeKey: `${event.eventType}:${event.registrationId}:${event.change}`,
      })
      .onConflictDoNothing({ target: outboxEvents.dedupeKey });
  }
}
