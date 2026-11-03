import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MOVE_OUT_REASON_LABEL,
  MoveOutListTab,
  MoveOutTab,
  RecordedNoticeRequest,
  canTakeNotice,
  daysBetween,
  isShortNotice,
  kigaliToday,
  longDate,
  moveOutStage,
  moveOutTabOf,
  movedOutProblem,
  nextLeaseStatus,
  noticeDateProblem,
  noticeNotNeeded,
  recordedNoticeProblem,
  tenantNoticeWindow,
  terminationFilingDueOn,
  type TenantNoticeRequest,
  type LeaseDetail,
  type MoveOutList,
  type MoveOutListQuery,
  type MoveOutRow,
  type RecordMoveOutRequest,
  type TenancyMoveOut,
} from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  movedOutTenantMail,
  noticeAcknowledgedTenantMail,
  noticeFiledLandlordMail,
  noticeNudgeLandlordMail,
  noticeRecordedTenantMail,
  noticeWithdrawnLandlordMail,
} from '../domain/move-out-mail';
import { assertBuildingInScope, assertResidence, buildingFilter, leaseStateConflict } from '../domain/residence';
import type { RentalsMail } from '../domain/rentals-mail';
import { LeaseChargesRepository } from '../infrastructure/lease-charges.repository';
import { LeasesRepository, type LeaseRecord, type LeaseRow } from '../infrastructure/leases.repository';
import { MoveOutsRepository, type NoticeRow } from '../infrastructure/move-outs.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SigningRepository } from '../infrastructure/signing.repository';
import { LeaseReadsService } from './lease-reads.service';
import { presentDeposit, presentNotice } from './move-outs-presenters';
import type { TenancyRef } from './tenancies.service';

/** Why an unpaid deposit is let go when the tenant moves out. */
const DEPOSIT_UNPAID_REASON = 'The tenant moved out and no deposit was paid.';

function badDay(path: string, message: string): BadRequestException {
  return new BadRequestException({ message, issues: [{ path: [path], message }] });
}

function noticeConflict(): ConflictException {
  return new ConflictException({ code: 'notice_exists', message: 'There is already a notice on this lease.' });
}

function isLiveNoticeClash(cause: unknown): boolean {
  const e = cause as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e.constraint === 'move_out_notices_live_uk';
}

/**
 * Moving out (blueprint 1.3, 2.3, 2.4; WP 1.7).
 *
 * The tenant gives notice on Injishi: a move out day at least the lease's
 * notice days (15 or more) from today in Kigali, never after the lease's last
 * day; a lease ending within its notice period needs none. They may withdraw
 * it until the landlord acknowledges it. The landlord records a notice that
 * came by letter, email or in person (shorter than the lease asks is kept,
 * marked short), acknowledges a notice (active → ending, the tenant is
 * emailed), and records the day the tenant moved out (today or earlier, not
 * before the start): the lease ends, the unit is free, rent for periods after
 * that day is waived with the reason, an unpaid deposit is let go, and the
 * district is owed word within 30 days (a `termination` filing). A notice
 * left unacknowledged for 3 days nudges the landlord once (housekeeping).
 *
 * Every change writes the lease timeline and an audit row in its transaction;
 * mail goes after, and never undoes a change.
 */
@Injectable()
export class MoveOutsService {
  private readonly log = new Logger(MoveOutsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly moveOuts: MoveOutsRepository,
    private readonly charges: LeaseChargesRepository,
    private readonly context: RentalsContextRepository,
    private readonly signing: SigningRepository,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
    private readonly reads: LeaseReadsService,
    private readonly mailer: RentalsMailer,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected today(): string {
    return kigaliToday();
  }

  // --- The tenant's side --------------------------------------------------------------

  /** What the tenant's Moving out page shows. */
  async tenantView(tenancy: TenancyRef): Promise<TenancyMoveOut> {
    const record = await this.leases.find(tenancy.leaseId);
    if (!record) throw new NotFoundException('Lease not found.');
    const { lease } = record;
    const today = this.today();
    const [notice, deposit] = await Promise.all([this.moveOuts.liveNotice(lease.id), this.moveOuts.depositOfLease(lease.id)]);
    const window = notice ? null : tenantNoticeWindow(lease, today);
    const settled = deposit?.status === 'settled';
    return {
      leaseId: lease.id,
      leaseStatus: lease.status,
      startDate: lease.startDate,
      endDate: lease.endDate,
      noticeDays: lease.noticeDays,
      window,
      noticeNotNeeded: !notice && canTakeNotice(lease.status) && noticeNotNeeded(lease, today),
      canGiveNotice: window !== null,
      canWithdraw: notice?.status === 'submitted' && notice.filedByRole === 'tenant' && canTakeNotice(lease.status),
      notice: notice ? presentNotice(notice) : null,
      stage: moveOutStage({ leaseStatus: lease.status, noticeStatus: notice?.status ?? null, depositSettled: settled || !deposit }),
      endedOn: lease.endedOn,
      deposit: deposit ? presentDeposit(deposit) : null,
      canDispute: settled && !deposit?.tenantDisputedAt,
    };
  }

  /** The tenant gives notice on Injishi. */
  async giveNotice(tenancy: TenancyRef, body: TenantNoticeRequest): Promise<TenancyMoveOut> {
    const today = this.today();
    let record: LeaseRecord | null = null;
    await this.db
      .transaction(async (tx) => {
        const lease = await this.leases.lock(tx, tenancy.leaseId);
        if (!lease) throw new NotFoundException('Lease not found.');
        if (!canTakeNotice(lease.status)) {
          throw leaseStateConflict(lease.status, 'Notice can only be given while the tenancy is running.');
        }
        if (await this.moveOuts.liveNotice(lease.id, tx, true)) throw noticeConflict();
        const problem = noticeDateProblem(body.moveOutOn, lease, today);
        if (problem) throw badDay('moveOutOn', problem);
        const notice = await this.moveOuts.insertNotice(tx, {
          leaseId: lease.id,
          filedByRole: 'tenant',
          filedByUserId: tenancy.userId,
          channel: 'app',
          filedOn: today,
          moveOutOn: body.moveOutOn,
          reasonCode: body.reasonCode,
          message: body.message ?? null,
          noticeDays: daysBetween(today, body.moveOutOn),
          isShortNotice: false,
        });
        await this.writeFiled(tx, lease, notice, tenancy.userId, 'tenant');
      })
      .catch((cause: unknown) => {
        throw isLiveNoticeClash(cause) ? noticeConflict() : cause;
      });
    record = await this.leases.find(tenancy.leaseId);
    const notice = await this.moveOuts.liveNotice(tenancy.leaseId);
    if (record && notice) {
      const r = record;
      void this.mailLandlord(r, `notice ${notice.id} filed`, () =>
        noticeFiledLandlordMail({
          appUrl: this.mailer.appUrl,
          tenantName: r.tenant.fullName,
          reference: r.lease.reference,
          home: { unitLabel: r.unitLabel, propertyName: r.propertyName },
          moveOutOn: notice.moveOutOn,
          reason: MOVE_OUT_REASON_LABEL[notice.reasonCode],
          message: notice.message,
        }),
      );
    }
    return this.tenantView(tenancy);
  }

  /** The tenant takes their notice back, until the landlord acknowledges it. */
  async withdrawNotice(tenancy: TenancyRef): Promise<TenancyMoveOut> {
    await this.db.transaction(async (tx) => {
      const lease = await this.leases.lock(tx, tenancy.leaseId);
      if (!lease) throw new NotFoundException('Lease not found.');
      const notice = await this.moveOuts.liveNotice(lease.id, tx, true);
      if (!notice) throw new ConflictException({ code: 'no_notice', message: 'There is no notice to withdraw.' });
      if (notice.status === 'acknowledged') {
        throw new ConflictException({
          code: 'notice_acknowledged',
          message: 'Your landlord already acknowledged this notice. Ask them in Messages to change it.',
        });
      }
      if (notice.filedByRole !== 'tenant') {
        throw new ConflictException({ code: 'notice_from_landlord', message: 'This notice is from your landlord. Ask them in Messages.' });
      }
      await this.moveOuts.withdraw(tx, notice.id);
      await this.events.write(tx, {
        leaseId: lease.id,
        workspaceId: lease.workspaceId,
        kind: 'notice_withdrawn',
        actorUserId: tenancy.userId,
        actorRole: 'tenant',
        visibleToTenant: true,
        payload: { noticeId: notice.id, moveOutOn: notice.moveOutOn },
      });
      await this.audit.write(tx, {
        actorUserId: tenancy.userId,
        subjectType: 'lease',
        subjectId: lease.id,
        eventType: 'lease.notice_withdrawn',
        diff: { noticeId: notice.id, moveOutOn: notice.moveOutOn, reference: lease.reference },
      });
    });
    const r = await this.leases.find(tenancy.leaseId);
    if (r) {
      void this.mailLandlord(r, `lease ${r.lease.id} notice withdrawn`, () =>
        noticeWithdrawnLandlordMail({
          appUrl: this.mailer.appUrl,
          tenantName: r.tenant.fullName,
          reference: r.lease.reference,
          home: { unitLabel: r.unitLabel, propertyName: r.propertyName },
        }),
      );
    }
    return this.tenantView(tenancy);
  }

  // --- The landlord's side -----------------------------------------------------------

  /** A notice that came by letter, email or in person, or one the landlord gives. */
  async recordNotice(ws: ScopedWorkspace, userId: string, leaseId: string, input: RecordedNoticeRequest): Promise<LeaseDetail> {
    const body = RecordedNoticeRequest.parse(input);
    const record = await this.owned(ws, leaseId);
    const today = this.today();
    await this.db
      .transaction(async (tx) => {
        const lease = await this.leases.lock(tx, leaseId);
        if (!lease) throw new NotFoundException('Lease not found.');
        if (!canTakeNotice(lease.status)) {
          throw leaseStateConflict(lease.status, 'A notice can only be recorded while the tenancy is running.');
        }
        if (await this.moveOuts.liveNotice(lease.id, tx, true)) throw noticeConflict();
        const problem = recordedNoticeProblem(body, lease, today);
        if (problem) throw badDay(problem.path, problem.message);
        const notice = await this.moveOuts.insertNotice(tx, {
          leaseId: lease.id,
          filedByRole: body.givenBy,
          filedByUserId: userId,
          channel: body.channel,
          filedOn: body.filedOn,
          moveOutOn: body.moveOutOn,
          reasonCode: body.reasonCode,
          message: body.message ?? null,
          noticeDays: daysBetween(body.filedOn, body.moveOutOn),
          isShortNotice: isShortNotice(body.filedOn, body.moveOutOn, lease),
        });
        await this.writeFiled(tx, lease, notice, userId, 'landlord');
      })
      .catch((cause: unknown) => {
        throw isLiveNoticeClash(cause) ? noticeConflict() : cause;
      });
    void this.mailTenant(record, `lease ${leaseId} notice recorded`, async () =>
      noticeRecordedTenantMail({
        appUrl: this.mailer.appUrl,
        leaseId,
        tenantName: record.tenant.fullName,
        landlordName: (await this.context.org(record.lease.orgId)).legalName,
        home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
        moveOutOn: body.moveOutOn,
        givenBy: body.givenBy,
      }),
    );
    return this.reads.detail(ws, leaseId);
  }

  /** The landlord acknowledges the notice: the lease is ending and the tenant is told. A second press answers the lease. */
  async acknowledge(ws: ScopedWorkspace, userId: string, leaseId: string): Promise<LeaseDetail> {
    const record = await this.owned(ws, leaseId);
    let moveOutOn: string | null = null;
    await this.db.transaction(async (tx) => {
      const lease = await this.leases.lock(tx, leaseId);
      if (!lease) throw new NotFoundException('Lease not found.');
      const notice = await this.moveOuts.liveNotice(lease.id, tx, true);
      if (!notice) throw new ConflictException({ code: 'no_notice', message: 'There is no notice to acknowledge on this lease.' });
      if (notice.status === 'acknowledged') return;
      if (!canTakeNotice(lease.status)) {
        throw leaseStateConflict(lease.status, 'The tenancy is no longer running.');
      }
      await this.moveOuts.acknowledge(tx, notice.id, userId);
      moveOutOn = notice.moveOutOn;
      await this.events.write(tx, {
        leaseId: lease.id,
        workspaceId: lease.workspaceId,
        kind: 'notice_acknowledged',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: true,
        payload: { noticeId: notice.id, moveOutOn: notice.moveOutOn },
      });
      const next = nextLeaseStatus(lease.status, 'acknowledge_notice');
      if (next) {
        await this.leases.update(tx, lease.id, { status: next, endingSince: new Date() });
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'ending',
          actorUserId: userId,
          actorRole: 'landlord',
          visibleToTenant: true,
          payload: { moveOutOn: notice.moveOutOn, by: 'notice' },
        });
      }
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: lease.id,
        eventType: 'lease.notice_acknowledged',
        diff: { noticeId: notice.id, from: lease.status, to: next ?? lease.status, moveOutOn: notice.moveOutOn, reference: lease.reference },
      });
    });
    if (moveOutOn) {
      const day = moveOutOn;
      const deposit = await this.moveOuts.depositOfLease(leaseId);
      void this.mailTenant(record, `lease ${leaseId} notice acknowledged`, async () =>
        noticeAcknowledgedTenantMail({
          appUrl: this.mailer.appUrl,
          leaseId,
          tenantName: record.tenant.fullName,
          landlordName: (await this.context.org(record.lease.orgId)).legalName,
          home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
          moveOutOn: day,
          depositHeldRwf: deposit && deposit.status !== 'settled' ? deposit.paidRwf : 0,
        }),
      );
    }
    return this.reads.detail(ws, leaseId);
  }

  /**
   * The day the tenant moved out: the lease ends, rent for periods after the
   * day is waived, an unpaid deposit is let go, the district is owed word.
   */
  async recordMoveOut(ws: ScopedWorkspace, userId: string, leaseId: string, body: RecordMoveOutRequest): Promise<LeaseDetail> {
    const record = await this.owned(ws, leaseId);
    const today = this.today();
    let waivedRwf = 0;
    await this.db.transaction(async (tx) => {
      const lease = await this.leases.lock(tx, leaseId);
      if (!lease) throw new NotFoundException('Lease not found.');
      const next = nextLeaseStatus(lease.status, 'record_move_out');
      if (!next) {
        throw leaseStateConflict(
          lease.status,
          lease.status === 'active'
            ? 'Acknowledge the notice first, or record one if the tenant told you outside Injishi.'
            : 'There is no running tenancy to end.',
        );
      }
      const problem = movedOutProblem(body.movedOutOn, lease, today);
      if (problem) throw badDay('movedOutOn', problem);
      const notice = await this.moveOuts.liveNotice(lease.id, tx, true);
      const endReason = notice
        ? `Notice: ${MOVE_OUT_REASON_LABEL[notice.reasonCode]}.${body.note ? ` ${body.note}` : ''}`
        : `The lease came to its end.${body.note ? ` ${body.note}` : ''}`;
      await this.leases.update(tx, lease.id, { status: next, endedOn: body.movedOutOn, endReason: endReason.slice(0, 600) });
      const reason = `The tenant moved out on ${longDate(body.movedOutOn)}.`;
      const waived = await this.moveOuts.waiveRentAfter(tx, lease.id, body.movedOutOn, reason);
      waivedRwf = waived.reduce((s, c) => s + c.amountRwf, 0);
      for (const c of waived) {
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'charge_waived',
          actorUserId: userId,
          actorRole: 'landlord',
          visibleToTenant: true,
          payload: { chargeId: c.id, kind: 'rent', periodStart: c.periodStart, amountRwf: c.amountRwf, reason },
        });
      }
      const deposit = await this.charges.voidUnpaidDeposit(tx, lease.id, userId, DEPOSIT_UNPAID_REASON);
      if (deposit === 'voided') {
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'charge_waived',
          actorUserId: userId,
          actorRole: 'landlord',
          visibleToTenant: true,
          payload: { kind: 'deposit', reason: DEPOSIT_UNPAID_REASON },
        });
      }
      await this.events.write(tx, {
        leaseId: lease.id,
        workspaceId: lease.workspaceId,
        kind: 'moved_out',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: true,
        payload: { movedOutOn: body.movedOutOn, noticeId: notice?.id ?? null, chargesWaived: waived.length, waivedRwf },
      });
      const dueOn = terminationFilingDueOn(body.movedOutOn);
      const filingId = await this.moveOuts.openTerminationFiling(tx, lease.id, dueOn);
      if (filingId) {
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'filing_due',
          actorUserId: null,
          actorRole: 'system',
          visibleToTenant: false,
          payload: { filingId, kind: 'termination', dueOn },
        });
      }
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: lease.id,
        eventType: 'lease.ended',
        diff: {
          from: lease.status,
          to: next,
          reference: lease.reference,
          movedOutOn: body.movedOutOn,
          noticeId: notice?.id ?? null,
          waivedChargeIds: waived.map((c) => c.id),
          deposit,
          filingId,
        },
        reason: body.note ?? null,
      });
    });
    const deposit = await this.moveOuts.depositOfLease(leaseId);
    void this.mailTenant(record, `lease ${leaseId} moved out`, async () =>
      movedOutTenantMail({
        appUrl: this.mailer.appUrl,
        leaseId,
        tenantName: record.tenant.fullName,
        landlordName: (await this.context.org(record.lease.orgId)).legalName,
        home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
        movedOutOn: body.movedOutOn,
        waivedRwf,
        depositHeldRwf: deposit && deposit.status !== 'settled' ? deposit.paidRwf : 0,
      }),
    );
    return this.reads.detail(ws, leaseId);
  }

  /** `GET /ops/move-outs?tab&q`: the rows of one tab and how many each tab holds. */
  async list(ws: ScopedWorkspace, query: MoveOutListQuery): Promise<MoveOutList> {
    const r = assertResidence(ws);
    const tab = MoveOutListTab.parse(query.tab ?? 'all');
    const today = this.today();
    const leases = await this.moveOuts.moveOutLeases(r.workspaceId, buildingFilter(sql`l.property_id`, ws.branchScope), query.q ?? null);
    const ids = leases.map((l) => l.leaseId);
    const [notices, deposits] = await Promise.all([this.moveOuts.liveNotices(ids), this.moveOuts.depositsOfLeases(ids)]);
    const counts = Object.fromEntries(MoveOutTab.options.map((t) => [t, 0])) as MoveOutList['counts'];
    const items: MoveOutRow[] = [];
    for (const l of leases) {
      const notice = notices.get(l.leaseId) ?? null;
      const deposit = deposits.get(l.leaseId) ?? null;
      const rowTab = moveOutTabOf({ leaseStatus: l.status, noticeStatus: notice?.status ?? null, depositOpen: !!deposit && deposit.status !== 'settled' });
      if (!rowTab) continue;
      counts[rowTab] = (counts[rowTab] ?? 0) + 1;
      if (tab !== 'all' && rowTab !== tab) continue;
      const movingOutOn = notice?.moveOutOn ?? l.endDate;
      items.push({
        leaseId: l.leaseId,
        reference: l.reference,
        tenantName: l.tenantName,
        unitLabel: l.unitLabel,
        propertyName: l.propertyName,
        leaseStatus: l.status,
        startDate: l.startDate,
        endDate: l.endDate,
        noticeDays: l.noticeDays,
        notice: notice ? presentNotice(notice) : null,
        movingOutOn,
        daysLeft: l.endedOn ? null : daysBetween(today, movingOutOn),
        endedOn: l.endedOn,
        deposit: deposit ? presentDeposit(deposit) : null,
        tab: rowTab,
      });
    }
    // Who is still to move out first, soonest first; then who moved out, latest first.
    items.sort((a, b) =>
      !a.endedOn && !b.endedOn
        ? a.movingOutOn.localeCompare(b.movingOutOn)
        : !a.endedOn
          ? -1
          : !b.endedOn
            ? 1
            : (b.endedOn ?? '').localeCompare(a.endedOn ?? ''),
    );
    return { tab, items, counts };
  }

  // --- Housekeeping ------------------------------------------------------------------

  /** Nudge the landlord once about each notice still waiting after 3 days. Answers how many went out. */
  async nudgeStaleNotices(today: string, afterDays: number): Promise<number> {
    const filedBy = new Date(`${today}T00:00:00Z`);
    filedBy.setUTCDate(filedBy.getUTCDate() - afterDays);
    let sent = 0;
    for (const n of await this.moveOuts.staleNotices(filedBy.toISOString().slice(0, 10))) {
      if (!(await this.moveOuts.claimNudge(n.noticeId))) continue;
      const to = await this.landlordAddress(n.orgId, n.workspaceId);
      if (!to) continue;
      const ok = await this.mailer.send(
        `notice ${n.noticeId} nudge`,
        to,
        noticeNudgeLandlordMail({
          appUrl: this.mailer.appUrl,
          tenantName: n.tenantName,
          reference: n.reference,
          home: { unitLabel: n.unitLabel, propertyName: n.propertyName },
          filedOn: n.filedOn,
          moveOutOn: n.moveOutOn,
        }),
      );
      if (ok) sent += 1;
    }
    return sent;
  }

  // --- Helpers -----------------------------------------------------------------------

  private async writeFiled(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    lease: LeaseRow,
    notice: NoticeRow,
    userId: string,
    by: 'tenant' | 'landlord',
  ): Promise<void> {
    await this.events.write(tx, {
      leaseId: lease.id,
      workspaceId: lease.workspaceId,
      kind: 'notice_filed',
      actorUserId: userId,
      actorRole: by,
      visibleToTenant: true,
      payload: {
        noticeId: notice.id,
        givenBy: notice.filedByRole,
        channel: notice.channel,
        filedOn: notice.filedOn,
        moveOutOn: notice.moveOutOn,
        reasonCode: notice.reasonCode,
        noticeDays: notice.noticeDays,
        isShortNotice: notice.isShortNotice,
      },
    });
    await this.audit.write(tx, {
      actorUserId: userId,
      subjectType: 'lease',
      subjectId: lease.id,
      eventType: by === 'tenant' ? 'lease.notice_filed' : 'lease.notice_recorded',
      diff: {
        noticeId: notice.id,
        givenBy: notice.filedByRole,
        channel: notice.channel,
        filedOn: notice.filedOn,
        moveOutOn: notice.moveOutOn,
        reasonCode: notice.reasonCode,
        isShortNotice: notice.isShortNotice,
        reference: lease.reference,
      },
    });
  }

  private async owned(ws: ScopedWorkspace, leaseId: string): Promise<LeaseRecord> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    return record;
  }

  /** The tenant's account address once they have one, else the address on their record. */
  private async tenantAddress(record: LeaseRecord): Promise<string | null> {
    if (record.tenant.userId) return (await this.signing.accountEmail(record.tenant.userId)) ?? record.tenant.email;
    return record.tenant.email;
  }

  /** The business's contact address, else its owner's. */
  async landlordAddress(orgId: string, workspaceId: string): Promise<string | null> {
    const profile = await this.context.ensureProfile({ orgId, workspaceId });
    if (profile.contactEmail) return profile.contactEmail;
    return (await this.context.ownerContact(orgId))?.email ?? null;
  }

  private async mailTenant(record: LeaseRecord, ref: string, build: () => RentalsMail | Promise<RentalsMail>): Promise<void> {
    try {
      const to = await this.tenantAddress(record);
      if (!to) return;
      await this.mailer.send(ref, to, await build());
    } catch (cause) {
      this.log.error(`"${ref}" email failed: ${String(cause)}`);
    }
  }

  private async mailLandlord(record: LeaseRecord, ref: string, build: () => RentalsMail): Promise<void> {
    try {
      const to = await this.landlordAddress(record.lease.orgId, record.lease.workspaceId);
      if (!to) return;
      await this.mailer.send(ref, to, build());
    } catch (cause) {
      this.log.error(`"${ref}" email failed: ${String(cause)}`);
    }
  }
}
