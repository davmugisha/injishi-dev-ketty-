import { Inject, Injectable } from '@nestjs/common';
import type { LeaseStatus } from '@injishi/contracts';
import { and, desc, eq, ne } from 'drizzle-orm';

import { leases, orgs, properties, rentalUnits, tenants } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** Whose lease this is, as the tenancy guard needs it. */
export interface TenancyOwnerRow {
  leaseId: string;
  status: LeaseStatus;
  tenantId: string;
  tenantUserId: string | null;
  workspaceId: string;
  orgId: string;
}

/** One of a person's tenancies, as their list shows it. */
export interface TenancyListRow {
  id: string;
  reference: string;
  status: LeaseStatus;
  graceDays: number;
  landlordName: string;
  propertyName: string;
  unitLabel: string;
  monthlyRentRwf: number;
  startDate: string;
  endDate: string;
  currentVersionId: string | null;
}

/**
 * The tenant's side of the leases (blueprint 2.4): which leases a person holds
 * through `tenants.user_id`, the link accepting an invitation makes.
 */
@Injectable()
export class TenanciesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async owner(leaseId: string): Promise<TenancyOwnerRow | null> {
    const [row] = await this.db
      .select({
        leaseId: leases.id,
        status: leases.status,
        tenantId: tenants.id,
        tenantUserId: tenants.userId,
        workspaceId: leases.workspaceId,
        orgId: leases.orgId,
      })
      .from(leases)
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .where(eq(leases.id, leaseId))
      .limit(1);
    return row ?? null;
  }

  /** The person's leases that are not drafts, the newest start first. */
  async listFor(userId: string): Promise<TenancyListRow[]> {
    return this.db
      .select({
        id: leases.id,
        reference: leases.reference,
        status: leases.status,
        graceDays: leases.graceDays,
        landlordName: orgs.legalName,
        propertyName: properties.name,
        unitLabel: rentalUnits.label,
        monthlyRentRwf: leases.monthlyRentRwf,
        startDate: leases.startDate,
        endDate: leases.endDate,
        currentVersionId: leases.currentVersionId,
      })
      .from(leases)
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .innerJoin(orgs, eq(orgs.id, leases.orgId))
      .innerJoin(properties, eq(properties.id, leases.propertyId))
      .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
      .where(and(eq(tenants.userId, userId), ne(leases.status, 'draft')))
      .orderBy(desc(leases.startDate), desc(leases.createdAt));
  }
}
