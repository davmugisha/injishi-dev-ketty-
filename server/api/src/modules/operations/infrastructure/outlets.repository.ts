import type {
  DepartmentStatus,
  OrderingAccess,
  OutletKind,
  OutletPartyStatus,
  OutletRelationshipType,
  OutletTenancyStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  configEntries,
  departments,
  ebmInvoices,
  folioCharges,
  orgs,
  outletParties,
  outletTenancies,
  outlets,
  properties,
  propertyAmenities,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface PartyRow {
  id: string;
  workspaceId: string;
  orgId: string | null;
  legalName: string;
  tin: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: OutletPartyStatus;
}

export interface OutletRow {
  id: string;
  workspaceId: string;
  name: string;
  outletKind: OutletKind;
  departmentId: string;
  departmentName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  relationshipType: OutletRelationshipType;
  operatorPartyId: string | null;
  operatorLegalName: string | null;
  operatorOrgId: string | null;
  ownerPartyId: string | null;
  ownerLegalName: string | null;
  ownerOrgId: string | null;
  taxEntityOrgId: string;
  orderingAccess: OrderingAccess;
  amenityCode: string | null;
  rraBranchId: string;
  guestVisible: boolean;
  slug: string | null;
  address: unknown;
  hours: unknown;
  sortOrder: number;
  status: DepartmentStatus;
}

export interface TenancyRow {
  id: string;
  outletId: string;
  status: OutletTenancyStatus;
  hostPropertyId: string;
  tenantOrgId: string;
}

/** Every column an outlet write may set. `taxEntityOrgId` is decided by the service. */
export interface OutletValues {
  name: string;
  departmentId: string;
  outletKind: OutletKind;
  propertyId: string | null;
  relationshipType: OutletRelationshipType;
  operatorPartyId: string | null;
  ownerPartyId: string | null;
  taxEntityOrgId: string;
  orderingAccess: OrderingAccess;
  amenityCode: string | null;
  rraBranchId: string;
  guestVisible: boolean;
  slug: string | null;
  address: unknown;
  hours: unknown;
  sortOrder: number;
}

/** A write refused by a unique index, named so the service can word the 409. */
export class OutletUniqueViolation extends Error {
  constructor(readonly constraint: string) {
    super(constraint);
  }
}

function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const inner = err?.code === '23505' ? err : err?.cause?.code === '23505' ? err.cause : null;
  return inner ? (inner.constraint ?? 'unique') : null;
}

const operator = alias(outletParties, 'operator_party');
const owner = alias(outletParties, 'owner_party');

/**
 * The only place that touches Drizzle for outlets and their parties
 * (ADR-050 slice 4).
 *
 * Same split as every operator repository: a LIST filters by workspace in its
 * `where`, a SINGLE ROW is read unscoped so the service hands it to
 * `assertOwned` and answers 404 rather than 403.
 */
@Injectable()
export class OutletsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly outletColumns = {
    id: outlets.id,
    workspaceId: outlets.workspaceId,
    name: outlets.name,
    outletKind: outlets.outletKind,
    departmentId: outlets.departmentId,
    departmentName: departments.name,
    propertyId: outlets.propertyId,
    propertyName: properties.name,
    relationshipType: outlets.relationshipType,
    operatorPartyId: outlets.operatorPartyId,
    operatorLegalName: operator.legalName,
    operatorOrgId: operator.orgId,
    ownerPartyId: outlets.ownerPartyId,
    ownerLegalName: owner.legalName,
    ownerOrgId: owner.orgId,
    taxEntityOrgId: outlets.taxEntityOrgId,
    orderingAccess: outlets.orderingAccess,
    amenityCode: outlets.amenityCode,
    rraBranchId: outlets.rraBranchId,
    guestVisible: outlets.guestVisible,
    slug: outlets.slug,
    address: outlets.address,
    hours: outlets.hours,
    sortOrder: outlets.sortOrder,
    status: outlets.status,
  };

  private selectOutlets() {
    return this.db
      .select(this.outletColumns)
      .from(outlets)
      .leftJoin(departments, eq(departments.id, outlets.departmentId))
      .leftJoin(properties, eq(properties.id, outlets.propertyId))
      .leftJoin(operator, eq(operator.id, outlets.operatorPartyId))
      .leftJoin(owner, eq(owner.id, outlets.ownerPartyId));
  }

  async listOutlets(workspaceId: string): Promise<OutletRow[]> {
    return this.selectOutlets()
      .where(eq(outlets.workspaceId, workspaceId))
      .orderBy(asc(outlets.status), asc(outlets.sortOrder), asc(outlets.name));
  }

  async findOutlet(id: string): Promise<OutletRow | null> {
    const [row] = await this.selectOutlets().where(eq(outlets.id, id)).limit(1);
    return row ?? null;
  }

  /** The newest tenancy of each outlet that has not ended. */
  async openTenancies(outletIds: string[]): Promise<TenancyRow[]> {
    if (outletIds.length === 0) return [];
    return this.db
      .selectDistinctOn([outletTenancies.outletId], {
        id: outletTenancies.id,
        outletId: outletTenancies.outletId,
        status: outletTenancies.status,
        hostPropertyId: outletTenancies.hostPropertyId,
        tenantOrgId: outletTenancies.tenantOrgId,
      })
      .from(outletTenancies)
      .where(
        and(
          inArray(outletTenancies.outletId, outletIds),
          ne(outletTenancies.status, 'ended'),
        ),
      )
      .orderBy(outletTenancies.outletId, desc(outletTenancies.createdAt));
  }

  async hasActiveTenancy(outletId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: outletTenancies.id })
      .from(outletTenancies)
      .where(
        and(
          eq(outletTenancies.outletId, outletId),
          eq(outletTenancies.status, 'active'),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /**
   * Has anything sold here been SIGNED (D-j invariant)?
   *
   * A folio line carrying an invoice id, or any invoice naming the outlet. Once
   * either exists the outlet's taxpayer is on a receipt the Authority holds,
   * and changing it would re attribute that sale.
   */
  async hasSignedSale(outletId: string): Promise<boolean> {
    const [charge] = await this.db
      .select({ id: folioCharges.id })
      .from(folioCharges)
      .where(
        and(
          eq(folioCharges.outletId, outletId),
          isNotNull(folioCharges.ebmInvoiceId),
        ),
      )
      .limit(1);
    if (charge) return true;
    const [invoice] = await this.db
      .select({ id: ebmInvoices.id })
      .from(ebmInvoices)
      .where(eq(ebmInvoices.outletId, outletId))
      .limit(1);
    return Boolean(invoice);
  }

  /**
   * The effective `outlets.allowed_relationships` value, or null.
   *
   * Effective dated like the tax rates: the newest row whose window holds now.
   * Null is read by the service as "only the hotel", never as "anything".
   */
  async relationshipPolicyValue(at: Date): Promise<unknown> {
    const [row] = await this.db
      .select({ value: configEntries.value })
      .from(configEntries)
      .where(
        and(
          eq(configEntries.configType, 'outlets.allowed_relationships'),
          or(
            isNull(configEntries.effectiveFrom),
            sql`${configEntries.effectiveFrom} <= ${at}`,
          ),
          or(
            isNull(configEntries.effectiveTo),
            sql`${configEntries.effectiveTo} > ${at}`,
          ),
        ),
      )
      .orderBy(desc(configEntries.effectiveFrom), desc(configEntries.version))
      .limit(1);
    return row?.value ?? null;
  }

  async findDepartment(id: string): Promise<{
    id: string;
    workspaceId: string;
    orgId: string;
    propertyId: string | null;
    status: DepartmentStatus;
  } | null> {
    const [row] = await this.db
      .select({
        id: departments.id,
        workspaceId: departments.workspaceId,
        orgId: departments.orgId,
        propertyId: departments.propertyId,
        status: departments.status,
      })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    return row ?? null;
  }

  async findProperty(
    id: string,
  ): Promise<{ id: string; workspaceId: string; orgId: string } | null> {
    const [row] = await this.db
      .select({
        id: properties.id,
        workspaceId: properties.workspaceId,
        orgId: properties.orgId,
      })
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    return row ?? null;
  }

  async propertyHasAmenity(propertyId: string, amenityCode: string): Promise<boolean> {
    const [row] = await this.db
      .select({ code: propertyAmenities.amenityCode })
      .from(propertyAmenities)
      .where(
        and(
          eq(propertyAmenities.propertyId, propertyId),
          eq(propertyAmenities.amenityCode, amenityCode),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** Every slug already minted from this base, so the next free suffix is known. */
  async slugsLike(base: string): Promise<Set<string>> {
    const escaped = base.replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await this.db
      .select({ slug: outlets.slug })
      .from(outlets)
      .where(or(eq(outlets.slug, base), like(outlets.slug, `${escaped}-%`)));
    return new Set(rows.map((r) => r.slug).filter((s): s is string => s !== null));
  }

  async insertOutlet(workspaceId: string, values: OutletValues): Promise<string> {
    try {
      const [row] = await this.db
        .insert(outlets)
        .values({ workspaceId, ...values })
        .returning({ id: outlets.id });
      return row.id;
    } catch (e) {
      const constraint = uniqueViolation(e);
      if (constraint) throw new OutletUniqueViolation(constraint);
      throw e;
    }
  }

  async updateOutlet(id: string, values: Partial<OutletValues>): Promise<void> {
    try {
      await this.db
        .update(outlets)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(outlets.id, id));
    } catch (e) {
      const constraint = uniqueViolation(e);
      if (constraint) throw new OutletUniqueViolation(constraint);
      throw e;
    }
  }

  async archiveOutlet(id: string): Promise<void> {
    await this.db
      .update(outlets)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(outlets.id, id));
  }

  // --- Parties ---------------------------------------------------------------

  private readonly partyColumns = {
    id: outletParties.id,
    workspaceId: outletParties.workspaceId,
    orgId: outletParties.orgId,
    legalName: outletParties.legalName,
    tin: outletParties.tin,
    contactName: outletParties.contactName,
    contactPhone: outletParties.contactPhone,
    contactEmail: outletParties.contactEmail,
    status: outletParties.status,
  };

  /** Parties this workspace recorded, plus its own business's row wherever it was recorded. */
  async listParties(workspaceId: string, orgId: string | null): Promise<PartyRow[]> {
    return this.db
      .select(this.partyColumns)
      .from(outletParties)
      .where(
        orgId
          ? or(eq(outletParties.workspaceId, workspaceId), eq(outletParties.orgId, orgId))
          : eq(outletParties.workspaceId, workspaceId),
      )
      .orderBy(asc(outletParties.status), asc(outletParties.legalName));
  }

  async findParty(id: string): Promise<PartyRow | null> {
    const [row] = await this.db
      .select(this.partyColumns)
      .from(outletParties)
      .where(eq(outletParties.id, id))
      .limit(1);
    return row ?? null;
  }

  async findPartyByOrg(orgId: string): Promise<PartyRow | null> {
    const [row] = await this.db
      .select(this.partyColumns)
      .from(outletParties)
      .where(eq(outletParties.orgId, orgId))
      .limit(1);
    return row ?? null;
  }

  async findOrg(id: string): Promise<{ id: string; legalName: string; tin: string | null } | null> {
    const [row] = await this.db
      .select({ id: orgs.id, legalName: orgs.legalName, tin: orgs.tin })
      .from(orgs)
      .where(eq(orgs.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * The business's own party, created the first time anybody needs it (D-h).
   *
   * `ON CONFLICT DO NOTHING` on the per org unique index, then a read, so two
   * requests racing to create it both come back with the one row.
   */
  async ensureOwnParty(input: {
    workspaceId: string;
    orgId: string;
  }): Promise<PartyRow> {
    const existing = await this.findPartyByOrg(input.orgId);
    if (existing) return existing;
    const org = await this.findOrg(input.orgId);
    if (!org) throw new Error(`org ${input.orgId} vanished`);
    await this.db
      .insert(outletParties)
      .values({
        workspaceId: input.workspaceId,
        orgId: org.id,
        legalName: org.legalName,
        tin: org.tin,
      })
      .onConflictDoNothing({
        target: outletParties.orgId,
        where: sql`${outletParties.orgId} IS NOT NULL`,
      });
    const row = await this.findPartyByOrg(input.orgId);
    if (!row) throw new Error(`own party for org ${input.orgId} was not written`);
    return row;
  }

  async insertParty(values: {
    workspaceId: string;
    orgId: string | null;
    legalName: string;
    tin: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  }): Promise<string> {
    try {
      const [row] = await this.db
        .insert(outletParties)
        .values(values)
        .returning({ id: outletParties.id });
      return row.id;
    } catch (e) {
      const constraint = uniqueViolation(e);
      if (constraint) throw new OutletUniqueViolation(constraint);
      throw e;
    }
  }

  async updateParty(
    id: string,
    values: Partial<Omit<PartyRow, 'id' | 'workspaceId'>>,
  ): Promise<void> {
    try {
      await this.db
        .update(outletParties)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(outletParties.id, id));
    } catch (e) {
      const constraint = uniqueViolation(e);
      if (constraint) throw new OutletUniqueViolation(constraint);
      throw e;
    }
  }

  /** Is this party named by an outlet that is still active? */
  async partyInUse(partyId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: outlets.id })
      .from(outlets)
      .where(
        and(
          eq(outlets.status, 'active'),
          or(eq(outlets.operatorPartyId, partyId), eq(outlets.ownerPartyId, partyId)),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
