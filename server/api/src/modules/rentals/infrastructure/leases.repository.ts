import { Inject, Injectable } from '@nestjs/common';
import type { LeaseStatus } from '@injishi/contracts';
import { aliasedTable, and, asc, count, desc, eq, getTableColumns, ilike, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';

import {
  brokers,
  leaseCharges,
  leaseContractVersions,
  leaseDeposits,
  leaseEvents,
  leaseInvitations,
  leaseSignatures,
  leases,
  properties,
  propertyBlocks,
  rentalUnits,
  storedObjects,
  tenants,
  users,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

export type LeaseRow = typeof leases.$inferSelect;
export type TenantRecord = typeof tenants.$inferSelect;
export type VersionRow = typeof leaseContractVersions.$inferSelect;
export type SignatureRow = typeof leaseSignatures.$inferSelect & { version: number };
export type InvitationRow = typeof leaseInvitations.$inferSelect;

/** A lease with the names it is shown with. */
export interface LeaseRecord {
  lease: LeaseRow;
  tenant: TenantRecord;
  unitLabel: string;
  blockId: string | null;
  blockCode: string | null;
  blockName: string | null;
  propertyName: string;
  brokerName: string | null;
}

/** A live lease on a unit whose days meet the days asked for. */
export interface OverlapRow {
  id: string;
  reference: string;
  status: LeaseStatus;
  tenantName: string;
  startDate: string;
  endsOn: string;
}

/** The statuses that hold a unit (contracts' `LIVE_LEASE_STATUSES`). */
const LIVE: LeaseStatus[] = ['pending_signature', 'signed', 'active', 'ending'];

/**
 * Leases and what hangs off them: contract versions, signatures, the
 * invitation, the charges summary and the timeline (blueprint 1.2).
 */
@Injectable()
export class LeasesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // The joined select every read of a lease record starts from; its type is drizzle's to infer.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private recordQuery(db: DbOrTx) {
    return db
      .select({
        lease: getTableColumns(leases),
        tenant: getTableColumns(tenants),
        unitLabel: rentalUnits.label,
        blockId: rentalUnits.blockId,
        blockCode: propertyBlocks.code,
        blockName: propertyBlocks.name,
        propertyName: properties.name,
        brokerName: brokers.name,
      })
      .from(leases)
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
      .innerJoin(properties, eq(properties.id, leases.propertyId))
      .leftJoin(propertyBlocks, eq(propertyBlocks.id, rentalUnits.blockId))
      .leftJoin(brokers, eq(brokers.id, leases.brokerId));
  }

  async find(id: string, db: DbOrTx = this.db): Promise<LeaseRecord | null> {
    const [row] = await this.recordQuery(db).where(eq(leases.id, id)).limit(1);
    return row ?? null;
  }

  /** The lease row alone, locked for the rest of the transaction. */
  async lock(tx: DbOrTx, id: string): Promise<LeaseRow | null> {
    const [row] = await tx.select().from(leases).where(eq(leases.id, id)).for('update').limit(1);
    return row ?? null;
  }

  async findMany(ids: readonly string[], db: DbOrTx = this.db): Promise<LeaseRecord[]> {
    if (ids.length === 0) return [];
    return this.recordQuery(db).where(inArray(leases.id, [...ids]));
  }

  /** One page of the lease list, the most recently changed first. */
  async page(input: {
    workspaceId: string;
    scope: SQL | null;
    statuses: LeaseStatus[] | null;
    q: string | null;
    limit: number;
    offset: number;
  }): Promise<{ rows: LeaseRecord[]; total: number }> {
    const term = input.q?.trim();
    const like = term ? `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const where = and(
      eq(leases.workspaceId, input.workspaceId),
      input.scope ?? undefined,
      input.statuses ? inArray(leases.status, input.statuses) : undefined,
      like
        ? or(
            ilike(leases.reference, like),
            ilike(tenants.fullName, like),
            ilike(tenants.email, like),
            ilike(tenants.phone, like),
            ilike(rentalUnits.label, like),
          )
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      this.recordQuery(this.db).where(where).orderBy(desc(leases.updatedAt), desc(leases.id)).limit(input.limit).offset(input.offset),
      this.db
        .select({ n: count() })
        .from(leases)
        .innerJoin(tenants, eq(tenants.id, leases.tenantId))
        .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
        .where(where),
    ]);
    return { rows, total: Number(totals[0]?.n ?? 0) };
  }

  /** How many leases hold each status. */
  async statusCounts(workspaceId: string, scope: SQL | null): Promise<Map<LeaseStatus, number>> {
    const rows = await this.db
      .select({ status: leases.status, n: count() })
      .from(leases)
      .where(and(eq(leases.workspaceId, workspaceId), scope ?? undefined))
      .groupBy(leases.status);
    return new Map(rows.map((r) => [r.status, Number(r.n)]));
  }

  /**
   * A live lease on the unit whose days meet `[start, end]`, if any (the same
   * test as the `leases_unit_no_overlap` exclusion, asked first so the refusal
   * can say who holds the unit and until when).
   */
  async liveOverlap(unitId: string, start: string, end: string, exceptLeaseId?: string, db: DbOrTx = this.db): Promise<OverlapRow | null> {
    const [row] = await db
      .select({
        id: leases.id,
        reference: leases.reference,
        status: leases.status,
        tenantName: tenants.fullName,
        startDate: leases.startDate,
        endsOn: sql<string>`coalesce(${leases.endedOn}, ${leases.endDate})::text`,
      })
      .from(leases)
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .where(
        and(
          eq(leases.unitId, unitId),
          inArray(leases.status, LIVE),
          exceptLeaseId ? ne(leases.id, exceptLeaseId) : undefined,
          sql`daterange(${leases.startDate}, coalesce(${leases.endedOn}, ${leases.endDate}), '[]') && daterange(${start}::date, ${end}::date, '[]')`,
        ),
      )
      .orderBy(asc(leases.startDate))
      .limit(1);
    return row ?? null;
  }

  /** The references a workspace has used, for the next number. */
  async references(tx: DbOrTx, workspaceId: string): Promise<string[]> {
    const rows = await tx
      .select({ reference: leases.reference })
      .from(leases)
      .where(and(eq(leases.workspaceId, workspaceId), sql`${leases.reference} ~ '^L-[0-9]+$'`));
    return rows.map((r) => r.reference);
  }

  async insert(tx: DbOrTx, values: typeof leases.$inferInsert): Promise<string> {
    const [row] = await tx.insert(leases).values(values).returning({ id: leases.id });
    if (!row) throw new Error('lease insert returned nothing');
    return row.id;
  }

  /** Change a lease, bumping its version so a stale read can tell. */
  async update(tx: DbOrTx, id: string, values: Partial<typeof leases.$inferInsert>): Promise<void> {
    await tx
      .update(leases)
      .set({ ...values, version: sql`${leases.version} + 1`, updatedAt: new Date() })
      .where(eq(leases.id, id));
  }

  // --- Contract versions -----------------------------------------------------------

  async versions(leaseId: string, db: DbOrTx = this.db): Promise<VersionRow[]> {
    return db
      .select()
      .from(leaseContractVersions)
      .where(eq(leaseContractVersions.leaseId, leaseId))
      .orderBy(desc(leaseContractVersions.version));
  }

  async version(id: string, db: DbOrTx = this.db): Promise<VersionRow | null> {
    const [row] = await db.select().from(leaseContractVersions).where(eq(leaseContractVersions.id, id)).limit(1);
    return row ?? null;
  }

  async insertVersion(tx: DbOrTx, values: typeof leaseContractVersions.$inferInsert): Promise<string> {
    const [row] = await tx.insert(leaseContractVersions).values(values).returning({ id: leaseContractVersions.id });
    if (!row) throw new Error('contract version insert returned nothing');
    return row.id;
  }

  async setVersionPdf(versionId: string, field: 'pdfObjectId' | 'signedPdfObjectId', storedObjectId: string): Promise<void> {
    await this.db
      .update(leaseContractVersions)
      .set({ [field]: storedObjectId })
      .where(eq(leaseContractVersions.id, versionId));
  }

  async storedObjectKey(id: string): Promise<string | null> {
    const [row] = await this.db.select({ key: storedObjects.objectKey }).from(storedObjects).where(eq(storedObjects.id, id)).limit(1);
    return row?.key ?? null;
  }

  async storedObjectIdByKey(key: string): Promise<string | null> {
    const [row] = await this.db.select({ id: storedObjects.id }).from(storedObjects).where(eq(storedObjects.objectKey, key)).limit(1);
    return row?.id ?? null;
  }

  // --- Signatures and the invitation -------------------------------------------------

  /** Every signature on the lease, voided ones too, newest version first. */
  async signatures(leaseId: string, db: DbOrTx = this.db): Promise<SignatureRow[]> {
    return db
      .select({ ...getTableColumns(leaseSignatures), version: leaseContractVersions.version })
      .from(leaseSignatures)
      .innerJoin(leaseContractVersions, eq(leaseContractVersions.id, leaseSignatures.versionId))
      .where(eq(leaseSignatures.leaseId, leaseId))
      .orderBy(desc(leaseContractVersions.version), asc(leaseSignatures.signedAt));
  }

  /** Void every standing landlord signature on the lease. Returns how many it voided. */
  async voidLandlordSignatures(tx: DbOrTx, leaseId: string, note: string): Promise<string[]> {
    const rows = await tx
      .update(leaseSignatures)
      .set({ voidedAt: new Date(), note })
      .where(and(eq(leaseSignatures.leaseId, leaseId), eq(leaseSignatures.signerRole, 'landlord'), isNull(leaseSignatures.voidedAt)))
      .returning({ id: leaseSignatures.id });
    return rows.map((r) => r.id);
  }

  async latestInvitation(leaseId: string, db: DbOrTx = this.db): Promise<InvitationRow | null> {
    const [row] = await db
      .select()
      .from(leaseInvitations)
      .where(eq(leaseInvitations.leaseId, leaseId))
      .orderBy(desc(leaseInvitations.lastSentAt))
      .limit(1);
    return row ?? null;
  }

  /** Revoke the invitation still out, if any. Returns its id. */
  async revokeLiveInvitation(tx: DbOrTx, leaseId: string): Promise<string | null> {
    const now = new Date();
    const [row] = await tx
      .update(leaseInvitations)
      .set({ status: 'revoked', revokedAt: now, updatedAt: now })
      .where(and(eq(leaseInvitations.leaseId, leaseId), eq(leaseInvitations.status, 'sent')))
      .returning({ id: leaseInvitations.id });
    return row?.id ?? null;
  }

  // --- Money summary and timeline --------------------------------------------------------

  /** The lease's charges and deposit, summed (Kigali today for overdue). */
  async chargesSummary(
    leaseId: string,
    graceDays: number,
    today: string,
  ): Promise<{
    rentChargedRwf: number;
    rentPaidRwf: number;
    overdueRwf: number;
    balanceRwf: number;
    nextDueOn: string | null;
    nextDueRwf: number | null;
    depositStatus: (typeof leaseDeposits.$inferSelect)['status'] | null;
  }> {
    const [sums] = await this.db
      .select({
        rentCharged: sql<string>`coalesce(sum(${leaseCharges.amountRwf}) filter (where ${leaseCharges.kind} = 'rent' and ${leaseCharges.status} <> 'waived'), 0)`,
        rentPaid: sql<string>`coalesce(sum(${leaseCharges.paidRwf}) filter (where ${leaseCharges.kind} = 'rent'), 0)`,
        overdue: sql<string>`coalesce(sum(${leaseCharges.amountRwf} - ${leaseCharges.paidRwf}) filter (where ${leaseCharges.kind} = 'rent' and ${leaseCharges.status} = 'open' and ${leaseCharges.dueOn} + ${graceDays}::int < ${today}::date), 0)`,
        balance: sql<string>`coalesce(sum(${leaseCharges.amountRwf} - ${leaseCharges.paidRwf}) filter (where ${leaseCharges.status} = 'open'), 0)`,
      })
      .from(leaseCharges)
      .where(eq(leaseCharges.leaseId, leaseId));
    const [next] = await this.db
      .select({ dueOn: leaseCharges.dueOn, owed: sql<string>`${leaseCharges.amountRwf} - ${leaseCharges.paidRwf}` })
      .from(leaseCharges)
      .where(and(eq(leaseCharges.leaseId, leaseId), eq(leaseCharges.status, 'open')))
      .orderBy(asc(leaseCharges.dueOn))
      .limit(1);
    const [deposit] = await this.db
      .select({ status: leaseDeposits.status })
      .from(leaseDeposits)
      .where(eq(leaseDeposits.leaseId, leaseId))
      .limit(1);
    return {
      rentChargedRwf: Number(sums?.rentCharged ?? 0),
      rentPaidRwf: Number(sums?.rentPaid ?? 0),
      overdueRwf: Number(sums?.overdue ?? 0),
      balanceRwf: Number(sums?.balance ?? 0),
      nextDueOn: next?.dueOn ?? null,
      nextDueRwf: next ? Number(next.owed) : null,
      depositStatus: deposit?.status ?? null,
    };
  }

  async events(leaseId: string): Promise<
    {
      id: string;
      kind: (typeof leaseEvents.$inferSelect)['kind'];
      actorRole: (typeof leaseEvents.$inferSelect)['actorRole'];
      actorName: string | null;
      visibleToTenant: boolean;
      payload: unknown;
      occurredAt: Date;
    }[]
  > {
    const actor = aliasedTable(users, 'actor');
    return this.db
      .select({
        id: leaseEvents.id,
        kind: leaseEvents.kind,
        actorRole: leaseEvents.actorRole,
        actorName: actor.name,
        visibleToTenant: leaseEvents.visibleToTenant,
        payload: leaseEvents.payload,
        occurredAt: leaseEvents.occurredAt,
      })
      .from(leaseEvents)
      .leftJoin(actor, eq(actor.id, leaseEvents.actorUserId))
      .where(eq(leaseEvents.leaseId, leaseId))
      .orderBy(desc(leaseEvents.occurredAt), desc(leaseEvents.id));
  }
}
