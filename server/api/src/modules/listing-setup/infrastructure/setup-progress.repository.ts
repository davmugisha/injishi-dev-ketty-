import type { PropertySetupCounts } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface SetupBusinessRow {
  orgId: string;
  legalName: string;
  domain: 'hospitality' | 'residence';
  accommodationClass: string | null;
  accommodationClassOther: string | null;
  entityGroup: string | null;
}

/**
 * The raw numbers behind the setup checklist (setup after approval).
 *
 * Plain SQL with every column spelled out, on purpose. The select-list subquery
 * shape is the one Drizzle renders UNQUALIFIED in a join-free query, which
 * silently compares a table to itself and counts zero (`inventory.repository.ts`
 * carries the whole account). Written by hand, each subquery says exactly which
 * table's `property_id` it means.
 *
 * It only COUNTS. What a count means for a step is `isSetupStepDone` in
 * `@injishi/contracts`, so the API and the app cannot disagree about "done".
 */
@Injectable()
export class SetupProgressRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async business(orgId: string): Promise<SetupBusinessRow | null> {
    const result = await this.db.execute<{
      org_id: string;
      legal_name: string;
      domain: 'hospitality' | 'residence';
      accommodation_class: string | null;
      accommodation_class_other: string | null;
      rdb_entity_group: string | null;
    }>(sql`
      select id as org_id,
             legal_name,
             domain,
             accommodation_class,
             accommodation_class_other,
             rdb_entity_group
        from orgs
       where id = ${orgId}
    `);
    const row = result.rows[0];
    return row
      ? {
          orgId: row.org_id,
          legalName: row.legal_name,
          domain: row.domain,
          accommodationClass: row.accommodation_class,
          accommodationClassOther: row.accommodation_class_other,
          entityGroup: row.rdb_entity_group,
        }
      : null;
  }

  /** The properties on a workspace, oldest first: the first is the one set up first. */
  async propertiesIn(
    workspaceId: string,
  ): Promise<{ id: string; name: string }[]> {
    const result = await this.db.execute<{ id: string; name: string }>(sql`
      select id, name
        from properties
       where workspace_id = ${workspaceId}
       order by created_at, id
    `);
    return result.rows;
  }

  /**
   * Every count for one property, plus the business-wide ones (staff).
   *
   * `propertyId` null is the day a business is approved: nothing exists yet,
   * and every property-scoped count is zero rather than an error.
   */
  async counts(input: {
    orgId: string;
    workspaceId: string;
    propertyId: string | null;
    propertyCount: number;
  }): Promise<PropertySetupCounts> {
    const p = input.propertyId;
    const result = await this.db.execute<Record<keyof PropertySetupCounts, string | number>>(sql`
      select
        (select count(*) from properties pr
          where pr.id = ${p}
            and (pr.contact_phone is not null or pr.contact_email is not null))       as "contactDetails",
        (select count(*) from departments d
          where d.property_id = ${p} and d.status = 'active')                          as "departments",
        (select count(*) from departments d
          where d.property_id = ${p} and d.status = 'active'
            and d.head_name is not null and d.head_name <> '')                         as "departmentHeads",
        (select count(*) from room_types rt
          where rt.property_id = ${p} and rt.status = 'active')                        as "roomTypes",
        (select count(*) from room_types rt
          where rt.property_id = ${p} and rt.status = 'active'
            and exists (select 1 from rate_plans rp
                         where rp.room_type_id = rt.id and rp.is_default
                           and rp.base_price_rwf is not null))                         as "pricedRoomTypes",
        (select count(*) from rooms r
           join room_types rt on rt.id = r.room_type_id
          where r.property_id = ${p} and rt.status = 'active')                         as "rooms",
        (select count(*) from property_photos ph where ph.property_id = ${p})           as "photos",
        (select count(*) from property_amenities pa where pa.property_id = ${p})       as "amenities",
        (select count(*) from outlets o
          where o.property_id = ${p} and o.status = 'active')                          as "outlets",
        (select count(*) from org_memberships m
          where m.org_id = ${input.orgId} and m.org_role <> 'owner'
            and m.status = 'active' and m.removed_at is null)
        + (select count(*) from org_invitations i
          where i.org_id = ${input.orgId} and i.purpose = 'staff'
            and i.status = 'sent' and i.expires_at > now())                            as "staff",
        (select count(*) from listings l
          where l.property_id = ${p} and l.status = 'published')                       as "published"
    `);
    const row = result.rows[0] ?? {};
    const n = (k: keyof PropertySetupCounts): number => Number(row[k] ?? 0);
    return {
      properties: input.propertyCount,
      contactDetails: n('contactDetails'),
      departments: n('departments'),
      departmentHeads: n('departmentHeads'),
      roomTypes: n('roomTypes'),
      pricedRoomTypes: n('pricedRoomTypes'),
      rooms: n('rooms'),
      photos: n('photos'),
      amenities: n('amenities'),
      outlets: n('outlets'),
      staff: n('staff'),
      published: n('published'),
    };
  }
}
