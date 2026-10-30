import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  kigaliToday,
  longDate,
  nextLeaseStatus,
  rentChargesToRaise,
  rentSchedule,
  scheduledLeaseAction,
  type CancelLeaseRequest,
  type LeaseDetail,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { leaseCancelledMail, tenancyStartedMail } from '../domain/rentals-mail';
import { assertBuildingInScope, assertResidence, leaseStateConflict } from '../domain/residence';
import { LeaseChargesRepository, type RaisedCharge } from '../infrastructure/lease-charges.repository';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter, type Tx } from '../infrastructure/rentals-writers';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SigningRepository } from '../infrastructure/signing.repository';
import { LeaseReadsService } from './lease-reads.service';

/** Who started a tenancy: the landlord pressing Start, or the rent cycle on the start date. */
export type StartActor = { role: 'landlord'; userId: string } | { role: 'system' };

/** What one start did. */
export interface StartOutcome {
  /** False when the lease was already active (a repeated press). */
  started: boolean;
  charges: RaisedCharge[];
}

/** Why a lease cancelled before it started no longer asks for its deposit. */
const DEPOSIT_VOID_REASON = 'The lease was cancelled before it started.';

/**
 * A lease's life after signing (blueprint 1.3, WP 1.5b): starting the tenancy,
 * and cancelling a lease that never started.
 *
 * Start (signed → active) is the landlord's press on or after the start date,
 * or the RentCycle job's on the start date when the landlord lets Injishi
 * start leases (`landlord_profiles.auto_start_leases`): `startOnSchedule` is
 * that job's entry, and `leasesDueToStart` the list it walks. Starting raises
 * the rent charges whose raise day has come (contracts `rentChargesToRaise`,
 * from `billing_starts_on`); the deposit was raised when the tenant signed.
 * Raising is safe to repeat, so the job and a press never double charge.
 *
 * Cancel works from draft, out for signature, or signed: the signatures still
 * standing are voided, the invitation and any live signing code withdrawn, an
 * unpaid deposit voided, and a tenant who was sent the lease is told.
 */
@Injectable()
export class LeaseLifecycleService {
  private readonly log = new Logger(LeaseLifecycleService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly signing: SigningRepository,
    private readonly charges: LeaseChargesRepository,
    private readonly context: RentalsContextRepository,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
    private readonly reads: LeaseReadsService,
    private readonly mailer: RentalsMailer,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected today(): string {
    return kigaliToday();
  }

  // --- Start ----------------------------------------------------------------------

  /** The landlord starts a signed tenancy (`POST /ops/leases/:id/start`). A second press answers the lease. */
  async start(ws: ScopedWorkspace, userId: string, leaseId: string): Promise<LeaseDetail> {
    const record = await this.owned(ws, leaseId);
    const outcome = await this.db.transaction((tx) => this.activate(tx, leaseId, { role: 'landlord', userId }, this.today()));
    if (outcome.started) void this.mailStarted(record, true);
    return this.reads.detail(ws, leaseId);
  }

  /**
   * The RentCycle job's start (WP 1.6a): a signed lease whose start date has
   * come, in a business that lets Injishi start leases. Answers whether it
   * started it; anything else is left as it is.
   */
  async startOnSchedule(leaseId: string, today: string = this.today()): Promise<boolean> {
    const record = await this.leases.find(leaseId);
    if (!record) return false;
    const { lease } = record;
    const profile = await this.context.ensureProfile({ orgId: lease.orgId, workspaceId: lease.workspaceId });
    if (scheduledLeaseAction(lease, { today, autoStart: profile.autoStartLeases }) !== 'start') return false;
    const outcome = await this.db.transaction((tx) => this.activate(tx, leaseId, { role: 'system' }, today));
    if (outcome.started) void this.mailStarted(record, false);
    return outcome.started;
  }

  /** Signed leases whose start date has come, in businesses that let Injishi start leases: the job's list. */
  async leasesDueToStart(today: string = this.today()): Promise<string[]> {
    return this.leases.signedDueToStart(today);
  }

  /**
   * signed → active, in the caller's transaction: the lease row locked, its
   * start date reached, the rent due within the raise window charged, and the
   * timeline and audit written with it.
   */
  private async activate(tx: Tx, leaseId: string, actor: StartActor, today: string): Promise<StartOutcome> {
    const row = await this.leases.lock(tx, leaseId);
    if (!row) throw new NotFoundException('Lease not found.');
    if (row.status === 'active') return { started: false, charges: [] };
    const next = nextLeaseStatus(row.status, 'start');
    if (!next) {
      throw leaseStateConflict(
        row.status,
        row.status === 'draft' || row.status === 'pending_signature'
          ? 'Both sides sign before the tenancy can start.'
          : 'It can no longer start.',
      );
    }
    if (row.startDate > today) {
      throw new ConflictException({
        code: 'lease_not_started_yet',
        startsOn: row.startDate,
        message: `This tenancy starts on ${longDate(row.startDate)}. Start it on that day or after.`,
      });
    }

    await this.leases.update(tx, leaseId, { status: next, activatedAt: new Date() });

    const schedule = rentSchedule({
      startDate: row.startDate,
      endDate: row.endDate,
      monthlyRentRwf: row.monthlyRentRwf,
      rentDueDay: row.rentDueDay,
      billingStartsOn: row.billingStartsOn,
    });
    const due = rentChargesToRaise(schedule, today, await this.charges.rentPeriodsRaised(leaseId, tx));
    const raised: RaisedCharge[] = [];
    for (const c of due) {
      const charge = await this.charges.raiseRent(tx, {
        leaseId,
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        dueOn: c.dueOn,
        amountRwf: c.amountRwf,
      });
      if (!charge) continue;
      raised.push(charge);
      await this.events.write(tx, {
        leaseId,
        workspaceId: row.workspaceId,
        kind: 'charge_raised',
        actorUserId: null,
        actorRole: 'system',
        visibleToTenant: true,
        payload: {
          chargeId: charge.id,
          kind: 'rent',
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          dueOn: c.dueOn,
          amountRwf: c.amountRwf,
          prorated: c.prorated,
        },
      });
    }

    await this.events.write(tx, {
      leaseId,
      workspaceId: row.workspaceId,
      kind: 'started',
      actorUserId: actor.role === 'landlord' ? actor.userId : null,
      actorRole: actor.role,
      visibleToTenant: true,
      payload: { chargesRaised: raised.length, startDate: row.startDate },
    });
    await this.audit.write(tx, {
      actorUserId: actor.role === 'landlord' ? actor.userId : null,
      subjectType: 'lease',
      subjectId: leaseId,
      eventType: 'lease.started',
      diff: { from: row.status, to: next, reference: row.reference, by: actor.role, chargeIds: raised.map((c) => c.id) },
    });
    return { started: true, charges: raised };
  }

  // --- Cancel -----------------------------------------------------------------------

  /** Cancel a lease that has not started: a draft, one out for signing, or one signed and not started. */
  async cancel(ws: ScopedWorkspace, userId: string, leaseId: string, body: CancelLeaseRequest): Promise<LeaseDetail> {
    const r = assertResidence(ws);
    const record = await this.owned(ws, leaseId);
    let toldTenant = false;
    await this.db.transaction(async (tx) => {
      const row = await this.leases.lock(tx, leaseId);
      if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
      const next = nextLeaseStatus(row.status, 'cancel');
      if (!next) {
        throw leaseStateConflict(
          row.status,
          row.status === 'active' || row.status === 'ending'
            ? 'A tenancy that has started ends with a move out, not a cancellation.'
            : 'It can no longer be cancelled.',
        );
      }
      await this.leases.update(tx, leaseId, { status: next, cancelledAt: new Date(), cancelReason: body.reason });
      const voided = await this.signing.voidLiveSignatures(tx, leaseId, 'Voided: the lease was cancelled.');
      const invitation = await this.leases.revokeLiveInvitation(tx, leaseId);
      const codes = await this.signing.consumeLiveCodes(tx, leaseId);
      const deposit = await this.charges.voidUnpaidDeposit(tx, leaseId, userId, DEPOSIT_VOID_REASON);
      // The tenant saw it once it was sent; a draft was never theirs to see.
      const sent = row.status !== 'draft';
      toldTenant = sent;
      await this.events.write(tx, {
        leaseId,
        workspaceId: r.workspaceId,
        kind: 'cancelled',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: sent,
        payload: {
          from: row.status,
          invitationRevoked: invitation !== null,
          signaturesVoided: voided.length,
          depositVoided: deposit === 'voided',
        },
      });
      if (deposit === 'voided') {
        await this.events.write(tx, {
          leaseId,
          workspaceId: r.workspaceId,
          kind: 'charge_waived',
          actorUserId: userId,
          actorRole: 'landlord',
          visibleToTenant: sent,
          payload: { kind: 'deposit', reason: DEPOSIT_VOID_REASON },
        });
      }
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: leaseId,
        eventType: 'lease.cancelled',
        diff: {
          from: row.status,
          to: next,
          reference: row.reference,
          signatureIds: voided,
          invitationRevoked: invitation !== null,
          codesWithdrawn: codes,
          deposit,
        },
        reason: body.reason,
      });
    });
    if (toldTenant) void this.mailCancelled(record, body.reason);
    return this.reads.detail(ws, leaseId);
  }

  // --- Helpers -----------------------------------------------------------------------

  private async owned(ws: ScopedWorkspace, leaseId: string): Promise<LeaseRecord> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    return record;
  }

  /** "Your tenancy has started", with what is owed now. Never throws: the tenancy stands either way. */
  private async mailStarted(record: LeaseRecord, byLandlord: boolean): Promise<void> {
    try {
      const to = await this.tenantAddress(record);
      if (!to) return;
      const [org, open] = await Promise.all([this.context.org(record.lease.orgId), this.charges.openCharges(record.lease.id)]);
      await this.mailer.send(
        `lease ${record.lease.id} started`,
        to,
        tenancyStartedMail({
          appUrl: this.mailer.appUrl,
          leaseId: record.lease.id,
          tenantName: record.tenant.fullName,
          landlordName: org.legalName,
          home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
          byLandlord,
          charges: open.map((c) => ({ kind: c.kind, periodStart: c.periodStart, dueOn: c.dueOn, owedRwf: c.amountRwf - c.paidRwf })),
        }),
      );
    } catch (cause) {
      this.log.error(`"tenancy started" email for lease ${record.lease.id} failed: ${String(cause)}`);
    }
  }

  private async mailCancelled(record: LeaseRecord, reason: string): Promise<void> {
    try {
      const to = await this.tenantAddress(record);
      if (!to) return;
      const org = await this.context.org(record.lease.orgId);
      await this.mailer.send(
        `lease ${record.lease.id} cancelled`,
        to,
        leaseCancelledMail({
          appUrl: this.mailer.appUrl,
          leaseId: record.lease.id,
          tenantName: record.tenant.fullName,
          landlordName: org.legalName,
          home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
          reason,
        }),
      );
    } catch (cause) {
      this.log.error(`"lease cancelled" email for lease ${record.lease.id} failed: ${String(cause)}`);
    }
  }

  /** The tenant's account address once they have one, else the address on their record. */
  private async tenantAddress(record: LeaseRecord): Promise<string | null> {
    if (record.tenant.userId) return (await this.signing.accountEmail(record.tenant.userId)) ?? record.tenant.email;
    return record.tenant.email;
  }
}
