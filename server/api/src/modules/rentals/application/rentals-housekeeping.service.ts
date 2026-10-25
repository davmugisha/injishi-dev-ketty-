import { computeRentalIncomeTax, daysBetween, deductibleLoanInterestRwf, kigaliToday, rentalTaxDueOn, withinReminderHours } from '@injishi/contracts';
import { Injectable, Logger } from '@nestjs/common';

import { filingReminderMail, taxNudgeMail } from '../domain/taxes-mail';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { TaxesRepository } from '../infrastructure/taxes.repository';

/** Filing reminders: five days before the day (day 10 after signing) and the day before (day 14). */
export const FILING_REMINDER_DAYS_LEFT: readonly number[] = [5, 1];

/** The January days rental income tax is nudged for: 1, 15 and 25 January. */
export const TAX_NUDGE_DAYS: readonly number[] = [1, 15, 25];

export interface HousekeepingOutcome {
  invitationsExpired: number;
  signingCodesRemoved: number;
  filingReminders: number;
  taxNudges: number;
}

/**
 * The RentalsHousekeeping job (blueprint 2.6; WP 4.4), hourly. Expires
 * invitations past their day and removes signing codes nobody used; and,
 * during the day in Kigali (08:00 to 18:00), reminds the landlord of a lease
 * copy owed to RRA five days and one day before its day (days 10 and 14 after
 * signing), and of last year's rental income tax on 1, 15 and 25 January
 * until it is declared. Each reminder is claimed in the database before it is
 * sent, so a job that runs twice sends it once; a missed day sends the stage
 * the landlord is at, never the ones missed.
 */
@Injectable()
export class RentalsHousekeepingService {
  private readonly log = new Logger(RentalsHousekeepingService.name);

  constructor(
    private readonly taxes: TaxesRepository,
    private readonly context: RentalsContextRepository,
    private readonly mailer: RentalsMailer,
  ) {}

  async run(now: Date = new Date()): Promise<HousekeepingOutcome> {
    const invitationsExpired = await this.taxes.expireInvitations(now);
    const signingCodesRemoved = await this.taxes.removeLapsedSigningCodes(now);
    let filingReminders = 0;
    let taxNudges = 0;
    if (withinReminderHours(now)) {
      filingReminders = await this.filingReminders(now);
      taxNudges = await this.taxNudges(now);
    }
    const outcome = { invitationsExpired, signingCodesRemoved, filingReminders, taxNudges };
    if (invitationsExpired || signingCodesRemoved || filingReminders || taxNudges) this.log.log(`Rentals housekeeping: ${JSON.stringify(outcome)}`);
    return outcome;
  }

  /** The stage a filing is at on `today`: 1 from five days before its day, 2 from the day before. */
  static filingStage(today: string, dueOn: string): number {
    const left = daysBetween(today, dueOn);
    if (left < 0) return 0;
    if (left <= (FILING_REMINDER_DAYS_LEFT[1] as number)) return 2;
    if (left <= (FILING_REMINDER_DAYS_LEFT[0] as number)) return 1;
    return 0;
  }

  /** The January stage on `today`, for last year: 1 from 1 January, 2 from the 15th, 3 from the 25th, until the 31st. */
  static nudgeStage(today: string): number {
    if (today.slice(5, 7) !== '01') return 0;
    const day = Number(today.slice(8, 10));
    return TAX_NUDGE_DAYS.filter((d) => day >= d).length;
  }

  private async filingReminders(now: Date): Promise<number> {
    const today = kigaliToday(now);
    let sent = 0;
    for (const f of await this.taxes.filingsDueSoon(today, FILING_REMINDER_DAYS_LEFT[0] as number)) {
      const stage = RentalsHousekeepingService.filingStage(today, f.dueOn);
      if (stage === 0 || f.remindersSent >= stage) continue;
      if (!(await this.taxes.claimFilingReminder(f.id, stage))) continue;
      const to = await this.landlordAddress(f.orgId, f.workspaceId);
      if (!to) continue;
      const ok = await this.mailer.send(
        `filing ${f.id} reminder ${stage}`,
        to,
        filingReminderMail({
          appUrl: this.mailer.appUrl,
          leaseId: f.leaseId,
          leaseReference: f.leaseReference,
          tenantName: f.tenantName,
          unitLabel: f.unitLabel,
          propertyName: f.propertyName,
          dueOn: f.dueOn,
          daysLeft: daysBetween(today, f.dueOn),
        }),
      );
      if (ok) sent += 1;
    }
    return sent;
  }

  private async taxNudges(now: Date): Promise<number> {
    const today = kigaliToday(now);
    const stage = RentalsHousekeepingService.nudgeStage(today);
    if (stage === 0) return 0;
    const year = Number(today.slice(0, 4)) - 1;
    let sent = 0;
    for (const org of await this.taxes.orgsToNudge(year)) {
      if (!(await this.taxes.claimNudge(org.orgId, org.workspaceId, year, stage))) continue;
      const to = await this.landlordAddress(org.orgId, org.workspaceId);
      if (!to) continue;
      const [rent, costs] = await Promise.all([this.taxes.rentReceived(org.workspaceId, year), this.taxes.expenses(org.orgId, year)]);
      const rentRwf = rent.reduce((s, r) => s + r.rentRwf, 0);
      const interest = deductibleLoanInterestRwf(costs.filter((c) => c.category === 'loan_interest').map((c) => ({ amountRwf: c.amountRwf, purpose: c.loanPurpose })));
      const ok = await this.mailer.send(
        `tax nudge ${org.orgId} ${year} stage ${stage}`,
        to,
        taxNudgeMail({
          appUrl: this.mailer.appUrl,
          landlordName: org.legalName,
          year,
          dueOn: rentalTaxDueOn(year),
          rentRwf,
          taxRwf: computeRentalIncomeTax({ grossRentRwf: rentRwf, loanInterestRwf: interest }).taxRwf,
        }),
      );
      if (ok) sent += 1;
    }
    return sent;
  }

  /** The business's contact address, else its owner's. */
  private async landlordAddress(orgId: string, workspaceId: string): Promise<string | null> {
    const profile = await this.context.ensureProfile({ orgId, workspaceId });
    if (profile.contactEmail) return profile.contactEmail;
    return (await this.context.ownerContact(orgId))?.email ?? null;
  }
}
