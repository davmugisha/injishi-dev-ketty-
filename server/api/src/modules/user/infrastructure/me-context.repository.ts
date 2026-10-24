import { Inject, Injectable } from '@nestjs/common';
import { TENANCY_STATUSES, type MeContextTenancy } from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/**
 * The parts of "who am I" (`GET /me/context`) that are not workspace grants:
 * the homes a person rents and their broker record. A tenancy is a lease that
 * names the person through `tenants.user_id` (set when they accept the
 * invitation) and is out of draft and not cancelled.
 */
@Injectable()
export class MeContextRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async tenancies(userId: string): Promise<MeContextTenancy[]> {
    const statuses = sql.join(
      TENANCY_STATUSES.map((s) => sql`${s}`),
      sql`, `,
    );
    const { rows } = await this.db.execute<{
      lease_id: string;
      reference: string;
      status: MeContextTenancy['status'];
      landlord_name: string;
      property_name: string;
      unit_label: string;
      monthly_rent_rwf: string | number;
      start_date: string;
      end_date: string;
    }>(sql`
      select l.id as lease_id, l.reference, l.status::text as status, o.legal_name as landlord_name,
             p.name as property_name, u.label as unit_label, l.monthly_rent_rwf,
             to_char(l.start_date, 'YYYY-MM-DD') as start_date, to_char(l.end_date, 'YYYY-MM-DD') as end_date
        from tenants t
        join leases l on l.tenant_id = t.id
        join orgs o on o.id = l.org_id
        join properties p on p.id = l.property_id
        join rental_units u on u.id = l.unit_id
       where t.user_id = ${userId} and l.status::text in (${statuses})
       order by l.start_date desc, l.created_at desc
    `);
    return rows.map((r) => ({
      leaseId: r.lease_id,
      reference: r.reference,
      status: r.status,
      landlordName: r.landlord_name,
      propertyName: r.property_name,
      unitLabel: r.unit_label,
      monthlyRentRwf: Number(r.monthly_rent_rwf),
      startDate: r.start_date,
      endDate: r.end_date,
    }));
  }

  async broker(userId: string): Promise<{ id: string; name: string | null; status: string } | null> {
    const { rows } = await this.db.execute<{ id: string; name: string | null; status: string }>(sql`
      select b.id, b.name, b.status::text as status from brokers b where b.user_id = ${userId} limit 1
    `);
    return rows[0] ?? null;
  }
}
