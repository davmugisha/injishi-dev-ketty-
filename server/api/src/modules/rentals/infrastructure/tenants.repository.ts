import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';

import { leaseSignatures, leases, rentalUnits, tenants } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

export type TenantRow = typeof tenants.$inferSelect;

export interface TenantLeaseRow {
  tenantId: string;
  id: string;
  reference: string;
  status: (typeof leases.$inferSelect)['status'];
  unitLabel: string;
  startDate: string;
  endDate: string;
}

/** The statuses that mean a contract naming the tenant was signed by both sides. */
const SIGNED_STATUSES = ['signed', 'active', 'ending', 'ended'] as const;

/**
 * Tenants as one landlord business knows them (blueprint 1.2): one record per
 * person per business, found again by email when the same person rents again.
 */
@Injectable()
export class TenantsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(id: string, db: DbOrTx = this.db): Promise<TenantRow | null> {
    const [row] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return row ?? null;
  }

  /** The tenant of this business with this email, compared lower case. */
  async findByEmail(workspaceId: string, email: string, db: DbOrTx = this.db): Promise<TenantRow | null> {
    const [row] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.workspaceId, workspaceId), sql`lower(${tenants.email}) = ${email.trim().toLowerCase()}`))
      .limit(1);
    return row ?? null;
  }

  /** Tenants whose name, email, phone or ID number matches `q`; the newest first. At most `limit`. */
  async search(workspaceId: string, q: string | undefined, limit: number): Promise<TenantRow[]> {
    const term = q?.trim();
    const like = term ? `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    return this.db
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.workspaceId, workspaceId),
          like
            ? or(
                ilike(tenants.fullName, like),
                ilike(tenants.email, like),
                ilike(tenants.phone, like),
                ilike(tenants.idNumber, like),
              )
            : undefined,
        ),
      )
      .orderBy(desc(tenants.updatedAt), asc(tenants.fullName))
      .limit(limit);
  }

  async insert(tx: DbOrTx, values: typeof tenants.$inferInsert): Promise<string> {
    const [row] = await tx.insert(tenants).values(values).returning({ id: tenants.id });
    if (!row) throw new Error('tenant insert returned nothing');
    return row.id;
  }

  async update(tx: DbOrTx, id: string, values: Partial<typeof tenants.$inferInsert>): Promise<void> {
    await tx.update(tenants).set({ ...values, updatedAt: new Date() }).where(eq(tenants.id, id));
  }

  /** Every lease of these tenants, newest first, with the unit's label. */
  async leasesOf(tenantIds: readonly string[]): Promise<TenantLeaseRow[]> {
    if (tenantIds.length === 0) return [];
    return this.db
      .select({
        tenantId: leases.tenantId,
        id: leases.id,
        reference: leases.reference,
        status: leases.status,
        unitLabel: rentalUnits.label,
        startDate: leases.startDate,
        endDate: leases.endDate,
      })
      .from(leases)
      .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
      .where(inArray(leases.tenantId, [...tenantIds]))
      .orderBy(desc(leases.startDate));
  }

  /**
   * Which of these tenants have signed a contract, or have one signed for
   * them: a lease of theirs past signing, or a signature still standing on
   * one (the landlord's on a lease out for signing counts: that contract
   * names the tenant as they are). Their record then stays as it is.
   * `exceptLeaseId` leaves out the lease being edited, whose own landlord
   * signature the edit voids.
   */
  async signedTenantIds(tenantIds: readonly string[], exceptLeaseId?: string, db: DbOrTx = this.db): Promise<Set<string>> {
    if (tenantIds.length === 0) return new Set();
    const rows = await db
      .selectDistinct({ tenantId: leases.tenantId })
      .from(leases)
      .leftJoin(leaseSignatures, and(eq(leaseSignatures.leaseId, leases.id), isNull(leaseSignatures.voidedAt)))
      .where(
        and(
          inArray(leases.tenantId, [...tenantIds]),
          exceptLeaseId ? ne(leases.id, exceptLeaseId) : undefined,
          or(inArray(leases.status, [...SIGNED_STATUSES]), sql`${leaseSignatures.id} IS NOT NULL`),
        ),
      );
    return new Set(rows.map((r) => r.tenantId));
  }

  /** Draft leases of a tenant: their contracts name the tenant, so they are rebuilt when the record changes. */
  async draftLeaseIds(tenantId: string, db: DbOrTx = this.db): Promise<string[]> {
    const rows = await db
      .select({ id: leases.id })
      .from(leases)
      .where(and(eq(leases.tenantId, tenantId), eq(leases.status, 'draft')));
    return rows.map((r) => r.id);
  }
}
