import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MANUAL_REMINDERS_PER_DAY,
  RENT_REMINDER_DAYS_BEFORE,
  addDays,
  kigaliToday,
  reminderStageFor,
  withinReminderHours,
  type RemindersSent,
  type RemindRentRequest,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { rentReminderMail, renderRentalsMail, type ReminderMailInput } from '../domain/rentals-mail';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import { LeasePaymentsRepository } from '../infrastructure/lease-payments.repository';
import { LeaseRemindersRepository, type RemindableCharge } from '../infrastructure/lease-reminders.repository';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { LeaseEventsWriter } from '../infrastructure/rentals-writers';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SigningRepository } from '../infrastructure/signing.repository';

/** What one run of the reminders job did. */
export interface RemindersOutcome {
  now: string;
  /** Outside 08:00 to 18:00 Kigali: nothing is looked at. */
  skipped: boolean;
  sent: { chargeId: string; kind: string; stage: number; to: string | null }[];
  failed: { chargeId: string; message: string }[];
}

/**
 * Rent reminders (blueprint 2.6; WP 1.6a). The job runs hourly and sends only
 * between 08:00 and 18:00 Kigali: `upcoming` three days before a charge falls
 * due, `due` on the day, `overdue` once it is past the grace days, then 7 and
 * 14 days after. Each is claimed in `lease_reminders` (unique per charge,
 * kind and stage) before the email goes, so two workers or two runs never
 * send it twice; a claim whose email did not go is withdrawn so the next run
 * tries again. The landlord's own reminder (`POST /ops/rent/reminders`) goes
 * at most once per charge per Kigali day.
 */
@Injectable()
export class RentRemindersService {
  private readonly log = new Logger(RentRemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reminders: LeaseRemindersRepository,
    private readonly leases: LeasesRepository,
    private readonly payments: LeasePaymentsRepository,
    private readonly context: RentalsContextRepository,
    private readonly signing: SigningRepository,
    private readonly events: LeaseEventsWriter,
    private readonly mailer: RentalsMailer,
  ) {}

  /** The job's run. `now` is a parameter so a run can be replayed for a moment. */
  async run(now: Date = new Date()): Promise<RemindersOutcome> {
    const outcome: RemindersOutcome = { now: now.toISOString(), skipped: false, sent: [], failed: [] };
    if (!withinReminderHours(now)) return { ...outcome, skipped: true };
    const today = kigaliToday(now);
    const charges = await this.reminders.remindable(addDays(today, RENT_REMINDER_DAYS_BEFORE));
    for (const charge of charges) {
      const stage = reminderStageFor(today, charge.dueOn, charge.graceDays);
      if (!stage) continue;
      try {
        const to = await this.sendAutomatic(charge, stage);
        if (to !== undefined) outcome.sent.push({ chargeId: charge.chargeId, kind: stage.kind, stage: stage.stage, to });
      } catch (cause) {
        outcome.failed.push({ chargeId: charge.chargeId, message: String(cause) });
        this.log.error(`reminder for charge ${charge.chargeId} failed: ${String(cause)}`);
      }
    }
    if (outcome.sent.length || outcome.failed.length) {
      this.log.log(`Rent reminders ${today}: sent ${outcome.sent.length}, failed ${outcome.failed.length}.`);
    }
    return outcome;
  }

  /**
   * One automatic reminder: claim, word, send, record. Answers the address it
   * went to (null when the tenant has none and only the timeline was written),
   * or undefined when it was already claimed.
   */
  private async sendAutomatic(charge: RemindableCharge, stage: { kind: 'upcoming' | 'due' | 'overdue'; stage: number }): Promise<string | null | undefined> {
    const record = await this.leases.find(charge.leaseId);
    if (!record) return undefined;
    const input = await this.mailInput(record, charge, stage.kind, null);
    const mail = rentReminderMail(input);
    const note = renderRentalsMail(mail).text;
    const id = await this.reminders.claim(this.db, {
      workspaceId: charge.workspaceId,
      propertyId: charge.propertyId,
      leaseId: charge.leaseId,
      chargeId: charge.chargeId,
      kind: stage.kind,
      stage: stage.stage,
      channel: 'email',
      note,
    });
    if (!id) return undefined;
    const to = await this.tenantAddress(record);
    if (to) {
      const ok = await this.mailer.send(`reminder ${stage.kind}/${stage.stage} charge ${charge.chargeId}`, to, mail);
      if (!ok) {
        await this.reminders.withdraw(this.db, id);
        throw new Error('the reminder email did not go');
      }
    }
    await this.events.write(this.db, {
      leaseId: charge.leaseId,
      workspaceId: charge.workspaceId,
      kind: 'reminder_sent',
      actorUserId: null,
      actorRole: 'system',
      visibleToTenant: true,
      payload: { reminderId: id, chargeId: charge.chargeId, kind: stage.kind, stage: stage.stage, channel: 'email', owedRwf: input.owedRwf, emailed: to !== null },
    });
    return to;
  }

  /** The landlord's Remind: each open charge named, at most once per charge per Kigali day. */
  async sendManual(ws: ScopedWorkspace, userId: string, body: RemindRentRequest, now: Date = new Date()): Promise<RemindersSent> {
    const r = assertResidence(ws);
    const today = kigaliToday(now);
    const dayStart = new Date(`${today}T00:00:00+02:00`);
    const out: RemindersSent = { sent: [], skipped: [] };
    const charges = await this.payments.charges(body.chargeIds);
    for (const chargeId of body.chargeIds) {
      const charge = charges.find((c) => c.id === chargeId);
      if (!charge) {
        out.skipped.push({ chargeId, reason: 'Charge not found.' });
        continue;
      }
      const record = await this.leases.find(charge.leaseId);
      if (!record || record.lease.workspaceId !== r.workspaceId) {
        out.skipped.push({ chargeId, reason: 'Charge not found.' });
        continue;
      }
      try {
        assertBuildingInScope(ws, record.lease.propertyId, 'Charge');
      } catch {
        out.skipped.push({ chargeId, reason: 'Charge not found.' });
        continue;
      }
      if (charge.status !== 'open' || charge.paidRwf >= charge.amountRwf) {
        out.skipped.push({ chargeId, reason: 'Nothing is owed on this charge.' });
        continue;
      }
      if ((await this.reminders.manualCountSince(chargeId, dayStart)) >= MANUAL_REMINDERS_PER_DAY) {
        out.skipped.push({ chargeId, reason: 'A reminder for this charge already went out today.' });
        continue;
      }
      const input = await this.mailInput(
        record,
        { chargeId: charge.id, kind: charge.kind, periodStart: charge.periodStart, dueOn: charge.dueOn, amountRwf: charge.amountRwf, paidRwf: charge.paidRwf, leaseId: record.lease.id, workspaceId: r.workspaceId, propertyId: record.lease.propertyId, graceDays: record.lease.graceDays },
        'manual',
        body.note ?? null,
      );
      const mail = rentReminderMail(input);
      const to = await this.tenantAddress(record);
      const reminderId = await this.db.transaction(async (tx) => {
        const id = await this.reminders.insertManual(tx, {
          workspaceId: r.workspaceId,
          propertyId: record.lease.propertyId,
          leaseId: record.lease.id,
          chargeId,
          channel: 'email',
          note: renderRentalsMail(mail).text,
          sentByUserId: userId,
        });
        await this.events.write(tx, {
          leaseId: record.lease.id,
          workspaceId: r.workspaceId,
          kind: 'reminder_sent',
          actorUserId: userId,
          actorRole: 'landlord',
          visibleToTenant: true,
          payload: { reminderId: id, chargeId, kind: 'manual', stage: 0, channel: 'email', owedRwf: input.owedRwf, emailed: to !== null },
        });
        return id;
      });
      if (to) void this.mailer.send(`manual reminder charge ${chargeId}`, to, mail);
      out.sent.push({ chargeId, reminderId, emailedTo: to });
    }
    if (out.sent.length === 0 && out.skipped.length > 0) {
      const only = out.skipped.length === 1 ? out.skipped[0] : null;
      if (only?.reason === 'Charge not found.') throw new NotFoundException('Charge not found.');
      if (only) throw new ConflictException({ code: 'reminder_skipped', message: only.reason });
    }
    return out;
  }

  private async mailInput(record: LeaseRecord, charge: RemindableCharge, stage: ReminderMailInput['stage'], note: string | null): Promise<ReminderMailInput> {
    const org = await this.context.org(record.lease.orgId);
    return {
      appUrl: this.mailer.appUrl,
      leaseId: record.lease.id,
      tenantName: record.tenant.fullName,
      landlordName: org.legalName,
      home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
      stage,
      charge: { kind: charge.kind, periodStart: charge.periodStart, dueOn: charge.dueOn },
      owedRwf: Math.max(0, charge.amountRwf - charge.paidRwf),
      graceDays: charge.graceDays,
      note,
    };
  }

  /** The tenant's account address once they have one, else the address on their record. */
  private async tenantAddress(record: LeaseRecord): Promise<string | null> {
    if (record.tenant.userId) return (await this.signing.accountEmail(record.tenant.userId)) ?? record.tenant.email;
    return record.tenant.email;
  }
}
