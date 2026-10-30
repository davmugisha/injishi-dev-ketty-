import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { kigaliToday, type LeaseChargeView, type WaiveChargeRequest } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import { LeasePaymentsRepository } from '../infrastructure/lease-payments.repository';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { presentCharge } from './rent-presenters';

/**
 * Forgiving a charge (blueprint 1.4; WP 1.6a). Rent is paid only through the
 * payment integration (decision of 2026-10-25): the landlord no longer
 * records rent received outside Injishi, nor reverses or slips one. Payments
 * recorded before that (and migrated from the old rent roll) are still read
 * everywhere as "Recorded"; this service only waives.
 */
@Injectable()
export class RentPaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payments: LeasePaymentsRepository,
    private readonly leases: LeasesRepository,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected today(): string {
    return kigaliToday();
  }

  /** Forgive an open charge, with the reason. What was paid on it stays paid. */
  async waive(ws: ScopedWorkspace, userId: string, chargeId: string, body: WaiveChargeRequest): Promise<LeaseChargeView> {
    const r = assertResidence(ws);
    const charge = await this.payments.charge(chargeId);
    if (!charge) throw new NotFoundException('Charge not found.');
    const record = await this.owned(ws, charge.leaseId);
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await this.leases.lock(tx, charge.leaseId);
      const before = await this.payments.waive(tx, chargeId, body.reason, now);
      if (!before) throw new NotFoundException('Charge not found.');
      if (before.status !== 'open') {
        throw new ConflictException({ code: 'charge_not_open', message: before.status === 'paid' ? 'This charge is already paid.' : 'This charge was already waived.' });
      }
      await this.events.write(tx, {
        leaseId: charge.leaseId,
        workspaceId: r.workspaceId,
        kind: 'charge_waived',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: true,
        payload: { chargeId, kind: charge.kind, periodStart: charge.periodStart, dueOn: charge.dueOn, amountRwf: charge.amountRwf, paidRwf: charge.paidRwf, forgivenRwf: charge.amountRwf - charge.paidRwf, reason: body.reason },
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: charge.leaseId,
        eventType: 'charge.waived',
        diff: { chargeId, kind: charge.kind, amountRwf: charge.amountRwf, paidRwf: charge.paidRwf },
        reason: body.reason,
      });
    });
    const fresh = await this.payments.charge(chargeId);
    if (!fresh) throw new NotFoundException('Charge not found.');
    return presentCharge(fresh, record.lease.graceDays, this.today());
  }

  private async owned(ws: ScopedWorkspace, leaseId: string): Promise<LeaseRecord> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    return record;
  }
}
