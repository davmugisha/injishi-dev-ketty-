import { filingReminderMail, taxNudgeMail } from '../domain/taxes-mail';
import { RentalsHousekeepingService } from './rentals-housekeeping.service';

/**
 * The RentalsHousekeeping job's calendar (WP 4.4): a lease copy is reminded
 * five days before its day (day 10 after signing) and the day before (day 14);
 * last year's tax is nudged from 1, 15 and 25 January; and what the mails say.
 * The job against Postgres (claims, once per stage) is in faults.integration.spec.ts.
 */
describe('RentalsHousekeepingService stages', () => {
  it('a new lease signed on 24 October is due 8 November: reminded on 3 November and 7 November', () => {
    const stage = (today: string): number => RentalsHousekeepingService.filingStage(today, '2026-11-08');
    expect(stage('2026-11-02')).toBe(0);
    expect(stage('2026-11-03')).toBe(1);
    expect(stage('2026-11-06')).toBe(1);
    expect(stage('2026-11-07')).toBe(2);
    expect(stage('2026-11-08')).toBe(2);
    expect(stage('2026-11-09')).toBe(0);
  });

  it('nudges from 1, 15 and 25 January, and not after January', () => {
    expect(RentalsHousekeepingService.nudgeStage('2026-12-31')).toBe(0);
    expect(RentalsHousekeepingService.nudgeStage('2027-01-01')).toBe(1);
    expect(RentalsHousekeepingService.nudgeStage('2027-01-14')).toBe(1);
    expect(RentalsHousekeepingService.nudgeStage('2027-01-15')).toBe(2);
    expect(RentalsHousekeepingService.nudgeStage('2027-01-25')).toBe(3);
    expect(RentalsHousekeepingService.nudgeStage('2027-01-31')).toBe(3);
    expect(RentalsHousekeepingService.nudgeStage('2027-02-01')).toBe(0);
  });
});

describe('tax and filing emails', () => {
  it('says which lease copy is due, and when', () => {
    const mail = filingReminderMail({
      appUrl: 'http://localhost:3002',
      leaseId: 'lease-1',
      leaseReference: 'L-0001',
      tenantName: 'Aline Uwimana',
      unitLabel: 'A-01',
      propertyName: 'Amani Residences',
      dueOn: '2026-11-08',
      daysLeft: 5,
    });
    expect(mail.subject).toBe('Give RRA a copy of lease L-0001 by 8 November 2026');
    expect(mail.lines[1]).toBe('The law asks you to give RRA a copy within 15 days of signing. That is due in 5 days, on 8 November 2026.');
    expect(mail.action.url).toBe('http://localhost:3002/leases/lease-1?tab=filing');
  });

  it('gives the estimate in January', () => {
    const mail = taxNudgeMail({ appUrl: 'http://localhost:3002', landlordName: 'Amani Residences', year: 2026, dueOn: '2027-01-31', rentRwf: 4_800_000, taxRwf: 434_000 });
    expect(mail.subject).toBe('Declare your 2026 rental income tax by 31 January 2027');
    expect(mail.lines).toContain('Our estimate of the tax is RWF 434,000, after the 50% for upkeep and any bank loan interest you recorded.');
    expect(mail.action.url).toBe('http://localhost:3002/taxes?year=2026');
  });
});
