import { Injectable, NotFoundException } from '@nestjs/common';
import {
  currentMonthKey,
  daysOverdue,
  endOfMonth,
  isChargeOverdue,
  kigaliToday,
  rentSchedule,
  type LeaseChargeList,
  type LeasePaymentList,
  type LeasePaymentView,
  type LeaseReminderList,
  type RentChargesQuery,
  type RentMonthQuery,
  type RentPaymentsQuery,
  type RentRemindersQuery,
  type RentRoll,
  type RentRollRow,
  type RentRollStatus,
  type RentSummary,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { buildingIdsOf } from '../domain/attention';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import type { ChargeRow } from '../infrastructure/lease-charges.repository';
import { LeasePaymentsRepository } from '../infrastructure/lease-payments.repository';
import { LeaseRemindersRepository } from '../infrastructure/lease-reminders.repository';
import { LeasesRepository } from '../infrastructure/leases.repository';
import { RentRollRepository, type RollLease } from '../infrastructure/rent-roll.repository';
import { RentalsOverviewRepository } from '../infrastructure/rentals-overview.repository';
import { paidOnOf, presentCharge, presentPayment, presentReminder } from './rent-presenters';

/**
 * What the landlord reads about rent (blueprint 3.5 "Rent"; WP 1.6a): the
 * roll of a month, charges and payments by lease or month, reminders, and
 * the month's figures. Everything is scoped to the workspace and the caller's
 * buildings. The month's expected and collected figures are read the way the
 * home's overview reads them (`RentalsOverviewRepository`), so the two never
 * disagree.
 */
@Injectable()
export class RentReadsService {
  constructor(
    private readonly roll: RentRollRepository,
    private readonly paymentRows: LeasePaymentsRepository,
    private readonly reminderRows: LeaseRemindersRepository,
    private readonly leases: LeasesRepository,
    private readonly overview: RentalsOverviewRepository,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected today(): string {
    return kigaliToday();
  }

  async rentRoll(ws: ScopedWorkspace, query: RentMonthQuery): Promise<RentRoll> {
    const r = assertResidence(ws);
    const today = this.today();
    const month = query.month ?? currentMonthKey(today);
    const buildings = buildingIdsOf(ws.branchScope);
    const leases = await this.roll.rollLeases(r.workspaceId, buildings, month);
    const ids = leases.map((l) => l.id);
    const [charges, lastPayments] = await Promise.all([this.roll.monthCharges(ids, month), this.roll.lastPayments(ids)]);
    const lastReminders = await this.reminderRows.lastFor(charges.map((c) => c.id));
    const rows = leases.map((lease) => this.rollRow(lease, charges.find((c) => c.leaseId === lease.id) ?? null, lastPayments.get(lease.id) ?? null, lastReminders, month, today));
    const totals = rows.reduce(
      (t, row) => {
        t.leases += 1;
        t.expectedRwf += row.expectedRwf;
        t.collectedRwf += row.paidRwf;
        t.outstandingRwf += row.outstandingRwf;
        if (row.rollStatus === 'overdue') {
          t.overdueRwf += row.outstandingRwf;
          t.overdueLeases += 1;
        }
        return t;
      },
      { leases: 0, expectedRwf: 0, collectedRwf: 0, outstandingRwf: 0, overdueRwf: 0, overdueLeases: 0 },
    );
    return { month, today, rows, totals };
  }

  private rollRow(
    lease: RollLease,
    charge: ChargeRow | null,
    lastPayment: { id: string; amountRwf: number; receivedOn: string | null; succeededAt: Date | null; channel: 'gateway' | 'recorded' } | null,
    lastReminders: Map<string, { kind: RentRollRow['lastReminder'] extends infer R ? (R extends { kind: infer K } ? K : never) : never; sentAt: Date }>,
    month: string,
    today: string,
  ): RentRollRow {
    const scheduled = charge
      ? charge.amountRwf
      : (rentSchedule({ startDate: lease.startDate, endDate: lease.endDate, monthlyRentRwf: lease.monthlyRentRwf, rentDueDay: lease.rentDueDay, billingStartsOn: lease.billingStartsOn }).find(
          (c) => c.periodStart.slice(0, 7) === month,
        )?.amountRwf ?? 0);
    let rollStatus: RentRollStatus = 'not_raised';
    let outstanding = 0;
    let overdueDays = 0;
    if (charge) {
      outstanding = charge.status === 'open' ? Math.max(0, charge.amountRwf - charge.paidRwf) : 0;
      if (charge.status === 'waived') rollStatus = 'waived';
      else if (charge.status === 'paid') rollStatus = 'paid';
      else if (isChargeOverdue(charge, lease.graceDays, today)) {
        rollStatus = 'overdue';
        overdueDays = daysOverdue(charge, lease.graceDays, today);
      } else rollStatus = charge.paidRwf > 0 ? 'partly_paid' : 'open';
    }
    const reminder = charge ? (lastReminders.get(charge.id) ?? null) : null;
    const paidOn = lastPayment ? paidOnOf(lastPayment) : null;
    return {
      lease: { id: lease.id, reference: lease.reference, status: lease.status, graceDays: lease.graceDays, monthlyRentRwf: lease.monthlyRentRwf },
      tenant: lease.tenant,
      unit: lease.unit,
      charge: charge ? presentCharge(charge, lease.graceDays, today) : null,
      expectedRwf: charge && charge.status === 'waived' ? 0 : scheduled,
      paidRwf: charge?.paidRwf ?? 0,
      outstandingRwf: outstanding,
      rollStatus,
      daysOverdue: overdueDays,
      lastPayment: lastPayment && paidOn ? { id: lastPayment.id, amountRwf: lastPayment.amountRwf, paidOn, channel: lastPayment.channel } : null,
      lastReminder: reminder ? { kind: reminder.kind, sentAt: reminder.sentAt.toISOString() } : null,
    };
  }

  async charges(ws: ScopedWorkspace, query: RentChargesQuery): Promise<LeaseChargeList> {
    const r = assertResidence(ws);
    const today = this.today();
    if (query.leaseId) await this.owned(ws, query.leaseId);
    const rows = await this.roll.charges({
      workspaceId: r.workspaceId,
      buildings: buildingIdsOf(ws.branchScope),
      leaseId: query.leaseId ?? null,
      month: query.leaseId ? (query.month ?? null) : (query.month ?? currentMonthKey(today)),
    });
    const views = rows.map((c) => presentCharge(c, c.graceDays, today));
    const filtered = query.status
      ? views.filter((c) => (query.status === 'overdue' ? c.overdue : c.status === query.status))
      : views;
    return { charges: filtered };
  }

  async payments(ws: ScopedWorkspace, query: RentPaymentsQuery): Promise<LeasePaymentList> {
    const r = assertResidence(ws);
    if (query.leaseId) await this.owned(ws, query.leaseId);
    const rows = await this.roll.payments({
      workspaceId: r.workspaceId,
      buildings: buildingIdsOf(ws.branchScope),
      leaseId: query.leaseId ?? null,
      month: query.leaseId ? (query.month ?? null) : (query.month ?? currentMonthKey(this.today())),
      status: query.status ?? null,
    });
    const [records, names] = await Promise.all([this.paymentRows.records(rows), this.roll.leaseNames([...new Set(rows.map((p) => p.leaseId))])]);
    return {
      payments: records
        .map((record): LeasePaymentView | null => {
          const n = names.get(record.payment.leaseId);
          return n ? presentPayment(record, { leaseReference: n.reference, tenantId: n.tenantId, tenantName: n.tenantName, unitId: n.unitId, unitLabel: n.unitLabel, propertyName: n.propertyName }) : null;
        })
        .filter((p): p is LeasePaymentView => p !== null),
    };
  }

  async payment(ws: ScopedWorkspace, paymentId: string): Promise<LeasePaymentView> {
    const r = assertResidence(ws);
    const record = await this.paymentRows.record(paymentId);
    if (!record || record.payment.workspaceId !== r.workspaceId) throw new NotFoundException('Payment not found.');
    const lease = await this.owned(ws, record.payment.leaseId);
    return presentPayment(record, {
      leaseReference: lease.lease.reference,
      tenantId: lease.tenant.id,
      tenantName: lease.tenant.fullName,
      unitId: lease.lease.unitId,
      unitLabel: lease.unitLabel,
      propertyName: lease.propertyName,
    });
  }

  async reminders(ws: ScopedWorkspace, query: RentRemindersQuery): Promise<LeaseReminderList> {
    const r = assertResidence(ws);
    if (query.leaseId) await this.owned(ws, query.leaseId);
    const rows = await this.reminderRows.list({
      workspaceId: r.workspaceId,
      leaseId: query.leaseId ?? null,
      month: query.leaseId ? (query.month ?? null) : (query.month ?? currentMonthKey(this.today())),
      propertyIds: buildingIdsOf(ws.branchScope),
    });
    return { reminders: rows.map(presentReminder) };
  }

  async summary(ws: ScopedWorkspace, query: RentMonthQuery): Promise<RentSummary> {
    const r = assertResidence(ws);
    const today = this.today();
    const month = query.month ?? currentMonthKey(today);
    const buildings = buildingIdsOf(ws.branchScope);
    const from = `${month}-01`;
    const to = endOfMonth(from);
    const [expected, collected, figures] = await Promise.all([
      this.overview.expectedByMonth(r.workspaceId, buildings, from, to),
      this.overview.collectedByMonth(r.workspaceId, buildings, from, to),
      this.roll.monthFigures(r.workspaceId, buildings, month, today),
    ]);
    return {
      month,
      today,
      expectedRwf: expected.find((m) => m.month === month)?.amountRwf ?? 0,
      collectedRwf: collected.find((m) => m.month === month)?.amountRwf ?? 0,
      ...figures,
    };
  }

  private async owned(ws: ScopedWorkspace, leaseId: string): Promise<Awaited<ReturnType<LeasesRepository['find']>> & object> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    return record;
  }
}
