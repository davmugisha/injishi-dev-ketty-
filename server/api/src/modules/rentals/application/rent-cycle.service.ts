import { Inject, Injectable, Logger } from '@nestjs/common';
import { LEASE_ENDING_WINDOW_DAYS, addDays, kigaliToday, rentChargesToRaise, rentSchedule } from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { LeaseChargesRepository } from '../infrastructure/lease-charges.repository';
import { LeasePaymentsRepository } from '../infrastructure/lease-payments.repository';
import { LeasesRepository } from '../infrastructure/leases.repository';
import { RentCycleRepository, type CycleLease } from '../infrastructure/rent-cycle.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { LeaseLifecycleService } from './lease-lifecycle.service';

/** What one run of the rent cycle did. */
export interface RentCycleOutcome {
  today: string;
  /** Signed leases started on their start date. */
  started: string[];
  /** Rent charges raised, by id. */
  raised: string[];
  /** Francs of tenants' credit applied to the charges raised. */
  creditAppliedRwf: number;
  /** Leases moved to ending. */
  ending: string[];
  /** Leases past their end date and still running: flagged for the landlord, never ended here. */
  pastEnd: { leaseId: string; reference: string; endDate: string; status: string }[];
  errors: { leaseId: string; step: 'start' | 'raise' | 'ending'; message: string }[];
}

/**
 * The RentCycle job (blueprint 2.6; WP 1.6a), hourly, every step idempotent:
 *
 *   1. start signed leases whose start date has come, where the landlord
 *      lets Injishi start leases (`LeaseLifecycleService.startOnSchedule`);
 *   2. raise the rent due within the raise window on every active or ending
 *      lease (contracts `rentChargesToRaise`, from the billing start, catching
 *      up a month a late run missed), and use the tenant's credit on it;
 *   3. move an active lease whose end date is within 30 days to ending;
 *   4. flag leases past their end date still running. Nothing ends a lease
 *      but a recorded move out (WP 1.7).
 *
 * The unique indexes make raising safe to repeat; the lease row is locked for
 * each lease so a landlord's Start and the job never raise twice. `today` is
 * a parameter so a run can be replayed for a day without touching a clock.
 */
@Injectable()
export class RentCycleService {
  private readonly log = new Logger(RentCycleService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly cycle: RentCycleRepository,
    private readonly leases: LeasesRepository,
    private readonly charges: LeaseChargesRepository,
    private readonly payments: LeasePaymentsRepository,
    private readonly lifecycle: LeaseLifecycleService,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
  ) {}

  async run(today: string = kigaliToday()): Promise<RentCycleOutcome> {
    const outcome: RentCycleOutcome = { today, started: [], raised: [], creditAppliedRwf: 0, ending: [], pastEnd: [], errors: [] };

    for (const leaseId of await this.lifecycle.leasesDueToStart(today)) {
      try {
        if (await this.lifecycle.startOnSchedule(leaseId, today)) outcome.started.push(leaseId);
      } catch (cause) {
        outcome.errors.push({ leaseId, step: 'start', message: String(cause) });
        this.log.error(`rent cycle: starting lease ${leaseId} failed: ${String(cause)}`);
      }
    }

    for (const lease of await this.cycle.live()) {
      try {
        const r = await this.raiseFor(lease, today);
        outcome.raised.push(...r.raised);
        outcome.creditAppliedRwf += r.creditAppliedRwf;
      } catch (cause) {
        outcome.errors.push({ leaseId: lease.id, step: 'raise', message: String(cause) });
        this.log.error(`rent cycle: raising rent on lease ${lease.id} failed: ${String(cause)}`);
      }
    }

    for (const lease of await this.cycle.activeEndingBy(addDays(today, LEASE_ENDING_WINDOW_DAYS))) {
      try {
        if (await this.moveToEnding(lease.id, today)) outcome.ending.push(lease.id);
      } catch (cause) {
        outcome.errors.push({ leaseId: lease.id, step: 'ending', message: String(cause) });
        this.log.error(`rent cycle: moving lease ${lease.id} to ending failed: ${String(cause)}`);
      }
    }

    outcome.pastEnd = (await this.cycle.pastEnd(today)).map((l) => ({ leaseId: l.id, reference: l.reference, endDate: l.endDate, status: l.status }));

    if (outcome.started.length || outcome.raised.length || outcome.ending.length || outcome.pastEnd.length || outcome.errors.length) {
      this.log.log(
        `Rent cycle ${today}: started ${outcome.started.length}, raised ${outcome.raised.length} charge(s) (credit ${outcome.creditAppliedRwf} RWF), ` +
          `ending ${outcome.ending.length}, past end ${outcome.pastEnd.length}, errors ${outcome.errors.length}.`,
      );
    }
    return outcome;
  }

  /** Raise what the schedule says is due on one lease, under a lock on its row, and use the tenant's credit on it. */
  async raiseFor(lease: CycleLease, today: string): Promise<{ raised: string[]; creditAppliedRwf: number }> {
    const schedule = rentSchedule({
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRentRwf: lease.monthlyRentRwf,
      rentDueDay: lease.rentDueDay,
      billingStartsOn: lease.billingStartsOn,
    });
    // A cheap look first: most leases have nothing to raise this hour.
    const due = rentChargesToRaise(schedule, today, await this.charges.rentPeriodsRaised(lease.id));
    if (due.length === 0) return { raised: [], creditAppliedRwf: 0 };

    return this.db.transaction(async (tx) => {
      const row = await this.leases.lock(tx, lease.id);
      if (!row || (row.status !== 'active' && row.status !== 'ending')) return { raised: [], creditAppliedRwf: 0 };
      const again = rentChargesToRaise(schedule, today, await this.charges.rentPeriodsRaised(lease.id, tx));
      const raised: string[] = [];
      for (const c of again) {
        const charge = await this.charges.raiseRent(tx, { leaseId: lease.id, periodStart: c.periodStart, periodEnd: c.periodEnd, dueOn: c.dueOn, amountRwf: c.amountRwf });
        if (!charge) continue;
        raised.push(charge.id);
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'charge_raised',
          actorUserId: null,
          actorRole: 'system',
          visibleToTenant: true,
          payload: { chargeId: charge.id, kind: 'rent', periodStart: c.periodStart, periodEnd: c.periodEnd, dueOn: c.dueOn, amountRwf: c.amountRwf, prorated: c.prorated },
        });
      }
      if (raised.length === 0) return { raised, creditAppliedRwf: 0 };
      const now = new Date();
      const credit = await this.payments.applyCredit(tx, { leaseId: lease.id, chargeIds: raised, paidAt: now });
      if (credit.allocatedRwf > 0) {
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'payment_received',
          actorUserId: null,
          actorRole: 'system',
          visibleToTenant: true,
          payload: { fromCredit: true, allocations: credit.allocations, allocatedRwf: credit.allocatedRwf, paidChargeIds: credit.paidChargeIds },
        });
      }
      return { raised, creditAppliedRwf: credit.allocatedRwf };
    });
  }

  /** active → ending when the end date is within the window. Answers whether it moved. */
  async moveToEnding(leaseId: string, today: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const row = await this.leases.lock(tx, leaseId);
      if (!row || row.status !== 'active') return false;
      if (row.endDate > addDays(today, LEASE_ENDING_WINDOW_DAYS)) return false;
      const now = new Date();
      await this.leases.update(tx, leaseId, { status: 'ending', endingSince: now });
      await this.events.write(tx, {
        leaseId,
        workspaceId: row.workspaceId,
        kind: 'ending',
        actorUserId: null,
        actorRole: 'system',
        visibleToTenant: true,
        payload: { reason: 'end_date_near', endDate: row.endDate, windowDays: LEASE_ENDING_WINDOW_DAYS },
      });
      await this.audit.write(tx, {
        actorUserId: null,
        subjectType: 'lease',
        subjectId: leaseId,
        eventType: 'lease.ending',
        diff: { from: 'active', to: 'ending', reference: row.reference, endDate: row.endDate, by: 'rent_cycle' },
      });
      return true;
    });
  }
}
