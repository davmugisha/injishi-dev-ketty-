import {
  brokerFeeAmount,
  brokerFeeFrom,
  type BrokerFeeRecord,
  type BrokerFeeTerms,
  type BrokerPickList,
  type BrokerRatingRequest,
  type LandlordPlacementList,
  type LeaseBrokerView,
  type TenancyBrokerView,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import { LeaseBrokersRepository, type LeaseBrokerRow, type PlacementRow } from '../infrastructure/lease-brokers.repository';
import { LeasesRepository, type LeaseRow } from '../infrastructure/leases.repository';
import { LeaseEventsWriter, RentalsAuditWriter, type DbOrTx } from '../infrastructure/rentals-writers';
import type { TenancyRef } from '../domain/tenancy-ref';

/** A tenancy that started: the broker who brought it may be rated. */
const RATEABLE = new Set(['active', 'ending', 'ended']);

/** What a lease draft says about its broker. */
export interface LeaseBrokerInput {
  brokerId?: string | null;
  placementId?: string | null;
  brokerFee?: BrokerFeeTerms;
}

/** The lease and unit facts a broker record is written from. */
export interface LeaseBrokerContext {
  leaseId: string;
  workspaceId: string;
  unitId: string;
  monthlyRentRwf: number;
  /** The unit's own broker fee, then the landlord's default. */
  unitFee: BrokerFeeTerms | null;
  defaultFee: BrokerFeeTerms | null;
}

/**
 * The broker on a lease (2026-10-25): who brought the tenant, from which
 * placement, the fee agreed (a RECORD: the landlord marks it paid, the money
 * moves outside Injishi), and the ratings by the landlord and the tenant once
 * the tenancy has started.
 */
@Injectable()
export class LeaseBrokersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: LeaseBrokersRepository,
    private readonly leases: LeasesRepository,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** Refuse a broker who is not an active one, on the field the form shows. */
  async assertBroker(brokerId: string, db: DbOrTx = this.db): Promise<void> {
    if (!(await this.repo.activeBroker(brokerId, db))) {
      throw fieldError(['brokerId'], "That broker isn't an active broker on Injishi. Pick one from the list.");
    }
  }

  /**
   * Write the broker record of a new lease, or of a draft whose broker changed:
   * the placement it came from (the one named, else the broker's open one on
   * the unit) turns converted, and the fee is the one sent, else the
   * placement's, else the unit's, else the landlord's default.
   */
  async attach(tx: DbOrTx, ctx: LeaseBrokerContext, input: { brokerId: string; placementId?: string | null; brokerFee?: BrokerFeeTerms }): Promise<{ placementId: string | null }> {
    let placement: PlacementRow | null = null;
    if (input.placementId) {
      placement = await this.repo.placement(input.placementId, tx);
      if (
        !placement ||
        placement.brokerId !== input.brokerId ||
        placement.workspaceId !== ctx.workspaceId ||
        (placement.status !== 'initiated' && placement.leaseId !== ctx.leaseId)
      ) {
        throw fieldError(['placementId'], "That placement isn't this broker's open placement here. Pick it again.");
      }
    } else {
      placement = await this.repo.openPlacement(input.brokerId, ctx.unitId, tx);
    }
    await this.repo.release(tx, ctx.leaseId);
    if (placement) await this.repo.convert(tx, placement.id, ctx.leaseId);
    const terms =
      input.brokerFee ??
      (placement ? brokerFeeFrom(placement.feeKind, placement.feePercent, placement.feeRwf) : null) ??
      ctx.unitFee ??
      ctx.defaultFee;
    if (terms) {
      await this.repo.upsertFee(tx, {
        leaseId: ctx.leaseId,
        brokerId: input.brokerId,
        workspaceId: ctx.workspaceId,
        terms,
        amountRwf: brokerFeeAmount(terms, ctx.monthlyRentRwf),
      });
    } else {
      await this.repo.removeFee(tx, ctx.leaseId);
    }
    return { placementId: placement?.id ?? null };
  }

  /** The broker came off a draft: the placement is open again and an unpaid fee goes. */
  async detach(tx: DbOrTx, leaseId: string): Promise<void> {
    await this.repo.release(tx, leaseId);
    const fee = await this.repo.fee(leaseId, tx);
    if (fee?.status === 'disbursed') {
      throw new ConflictException({ code: 'broker_fee_paid', message: 'The broker fee is marked paid, so the broker stays on this lease. Mark it owed first.' });
    }
    await this.repo.removeFee(tx, leaseId);
  }

  /** The rent changed on a draft: a percent fee follows it, unless it is already paid. */
  async rentChanged(tx: DbOrTx, leaseId: string, brokerId: string, workspaceId: string, monthlyRentRwf: number): Promise<void> {
    const fee = await this.repo.fee(leaseId, tx);
    if (!fee || fee.status !== 'pending' || fee.kind !== 'percent' || fee.percent === null) return;
    const terms: BrokerFeeTerms = { kind: 'percent', percent: fee.percent };
    await this.repo.upsertFee(tx, { leaseId, brokerId, workspaceId, terms, amountRwf: brokerFeeAmount(terms, monthlyRentRwf) });
  }

  // --- Reads -----------------------------------------------------------------------

  async landlordView(leaseId: string): Promise<LeaseBrokerView | null> {
    const row = await this.repo.forLease(leaseId, 'landlord');
    if (!row) return null;
    return {
      id: row.brokerId,
      name: row.name,
      phone: row.phone,
      placementId: row.placementId,
      fee: feeRecord(row),
      rating: ratingOf(row),
      canRate: RATEABLE.has(row.leaseStatus),
    };
  }

  async tenantView(leaseId: string): Promise<TenancyBrokerView | null> {
    const row = await this.repo.forLease(leaseId, 'tenant');
    if (!row) return null;
    return { name: row.name, rating: ratingOf(row), canRate: RATEABLE.has(row.leaseStatus) };
  }

  async placements(ws: ScopedWorkspace): Promise<LandlordPlacementList> {
    const r = assertResidence(ws);
    const [rows, totals] = await Promise.all([this.repo.placements(r.workspaceId), this.repo.feeTotals(r.workspaceId)]);
    return {
      placements: rows.map((p) => {
        const terms = brokerFeeFrom(p.feeKind, p.feePercent, p.feeRwf);
        const recordTerms = brokerFeeFrom(p.feeRecordKind, p.feeRecordPercent, p.feeRecordRwf);
        return {
          id: p.id,
          status: p.status,
          startedAt: p.initiatedAt.toISOString(),
          broker: {
            id: p.brokerId,
            name: p.brokerName,
            phone: p.brokerPhone,
            ratingAverage: p.ratingAverage,
            ratingCount: p.ratingCount,
          },
          unit: p.unitId && p.unitLabel ? { id: p.unitId, label: p.unitLabel, propertyName: p.propertyName ?? '' } : null,
          tenantName: p.tenantName,
          note: p.note,
          terms,
          lease:
            p.leaseId && p.leaseReference && p.leaseStartDate
              ? { id: p.leaseId, reference: p.leaseReference, tenantName: p.leaseTenantName ?? '', status: p.leaseStatus ?? 'draft', startDate: p.leaseStartDate }
              : null,
          fee:
            recordTerms && p.feeRecordRwf !== null && p.feeStatus
              ? {
                  terms: recordTerms,
                  amountRwf: p.feeRecordRwf,
                  status: p.feeStatus === 'disbursed' ? 'paid' : p.leaseStatus === 'cancelled' ? 'void' : 'owed',
                  paidAt: p.disbursedAt?.toISOString() ?? null,
                }
              : null,
          rating: p.stars !== null && p.ratedAt ? { stars: p.stars, comment: p.comment, ratedAt: p.ratedAt.toISOString() } : null,
        };
      }),
      owedRwf: totals.owedRwf,
      paidRwf: totals.paidRwf,
    };
  }

  async pick(ws: ScopedWorkspace, q: string | undefined): Promise<BrokerPickList> {
    const r = assertResidence(ws);
    const rows = await this.repo.pick(r.workspaceId, q?.trim() || null);
    const open = await this.repo.openPlacementsOf(r.workspaceId, rows.map((b) => b.id));
    return {
      brokers: rows.map((b) => ({
        ...b,
        placements: open
          .filter((p) => p.brokerId === b.id)
          .map((p) => ({ id: p.id, unitId: p.unitId, unitLabel: p.unitLabel, tenantName: p.tenantName })),
      })),
    };
  }

  // --- Landlord commands -----------------------------------------------------------

  /** Mark the fee paid (the money moved outside Injishi), or owed again. */
  async setFeePaid(ws: ScopedWorkspace, userId: string, leaseId: string, paid: boolean): Promise<LeaseBrokerView> {
    const r = assertResidence(ws);
    await this.db.transaction(async (tx) => {
      const lease = await this.lockOwned(tx, ws, leaseId);
      if (!lease.brokerId) throw new ConflictException({ code: 'no_broker', message: 'This lease names no broker.' });
      if (paid && lease.status === 'cancelled') {
        throw new ConflictException({ code: 'lease_cancelled', message: 'This lease was cancelled, so there is no fee to pay.' });
      }
      if (!(await this.repo.setPaid(tx, leaseId, paid, userId))) {
        throw new ConflictException({ code: 'no_broker_fee', message: 'This lease records no broker fee. Set one on the lease first.' });
      }
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: leaseId,
        eventType: paid ? 'lease.broker_fee_paid' : 'lease.broker_fee_owed',
        diff: { brokerId: lease.brokerId, workspaceId: r.workspaceId },
      });
    });
    return (await this.landlordView(leaseId)) as LeaseBrokerView;
  }

  /** The landlord rates the broker who brought the tenant, once the tenancy has started. */
  async rateAsLandlord(ws: ScopedWorkspace, userId: string, leaseId: string, body: BrokerRatingRequest): Promise<LeaseBrokerView> {
    await this.db.transaction(async (tx) => {
      const lease = await this.lockOwned(tx, ws, leaseId);
      await this.rate(tx, lease, userId, 'landlord', body);
    });
    return (await this.landlordView(leaseId)) as LeaseBrokerView;
  }

  /** The tenant rates the broker who found them the home, once the tenancy has started. */
  async rateAsTenant(ref: TenancyRef, body: BrokerRatingRequest): Promise<TenancyBrokerView> {
    await this.db.transaction(async (tx) => {
      const lease = await this.leases.lock(tx, ref.leaseId);
      if (!lease || lease.tenantId !== ref.tenantId) throw new NotFoundException('Lease not found.');
      await this.rate(tx, lease, ref.userId, 'tenant', body);
    });
    return (await this.tenantView(ref.leaseId)) as TenancyBrokerView;
  }

  private async rate(
    tx: DbOrTx,
    lease: { id: string; workspaceId: string; brokerId: string | null; status: string },
    userId: string,
    role: 'landlord' | 'tenant',
    body: BrokerRatingRequest,
  ): Promise<void> {
    if (!lease.brokerId) throw new ConflictException({ code: 'no_broker', message: 'This lease names no broker.' });
    if (!RATEABLE.has(lease.status)) {
      throw new ConflictException({ code: 'not_started', message: 'You can rate the broker once the tenancy has started.' });
    }
    await this.repo.rate(tx, {
      brokerId: lease.brokerId,
      leaseId: lease.id,
      userId,
      role,
      stars: body.stars,
      comment: body.comment?.trim() || null,
    });
    await this.events.write(tx, {
      leaseId: lease.id,
      workspaceId: lease.workspaceId,
      kind: 'broker_rated',
      actorUserId: userId,
      actorRole: role,
      visibleToTenant: role === 'tenant',
      payload: { brokerId: lease.brokerId, stars: body.stars },
    });
  }

  private async lockOwned(tx: DbOrTx, ws: ScopedWorkspace, leaseId: string): Promise<LeaseRow> {
    const r = assertResidence(ws);
    const row = await this.leases.lock(tx, leaseId);
    if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, row.propertyId, 'Lease');
    return row;
  }
}

function feeRecord(row: LeaseBrokerRow): BrokerFeeRecord | null {
  const terms = brokerFeeFrom(row.feeKind, row.feePercent, row.feeRwf);
  if (!terms || row.feeRwf === null || !row.feeStatus) return null;
  return {
    terms,
    amountRwf: row.feeRwf,
    status: row.feeStatus === 'disbursed' ? 'paid' : row.leaseStatus === 'cancelled' ? 'void' : 'owed',
    paidAt: row.disbursedAt?.toISOString() ?? null,
  };
}

function ratingOf(row: LeaseBrokerRow): { stars: number; comment: string | null; ratedAt: string } | null {
  return row.stars !== null && row.ratedAt ? { stars: row.stars, comment: row.comment, ratedAt: row.ratedAt.toISOString() } : null;
}

function fieldError(path: (string | number)[], message: string): BadRequestException {
  return new BadRequestException({ message: 'Validation failed', issues: [{ code: 'custom', path, message }] });
}
