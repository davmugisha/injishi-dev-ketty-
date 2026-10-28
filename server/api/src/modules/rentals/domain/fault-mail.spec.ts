import { renderRentalsMail } from './rentals-mail';
import { faultMovedTenantMail, faultReportedLandlordMail } from './fault-mail';

/**
 * The fault emails (WP 4.1): what the tenant reads when their fault moves,
 * and what the landlord reads when one is reported. Plain words, no dashes,
 * one link to the right page.
 */
const home = { unitLabel: 'A-01', propertyName: 'Amani Residences' };

describe('fault emails', () => {
  it('tells the tenant who is fixing it', () => {
    const mail = faultMovedTenantMail({
      appUrl: 'http://localhost:3002',
      leaseId: 'lease-1',
      tenantName: 'Aline Uwimana',
      landlordName: 'Amani Residences',
      home,
      title: 'Kitchen tap leaking',
      to: 'assigned',
      assigneeName: 'Eric',
    });
    expect(mail.subject).toBe('Your repair: Assigned');
    expect(mail.lines).toEqual(['Hello Aline,', 'Eric is assigned to fix "Kitchen tap leaking" at unit A-01 at Amani Residences.']);
    expect(mail.action.url).toBe('http://localhost:3002/home/lease-1/faults');
  });

  it("gives the reason for won't fix and says it can be reopened", () => {
    const mail = faultMovedTenantMail({
      appUrl: 'http://localhost:3002',
      leaseId: 'lease-1',
      tenantName: 'Aline',
      landlordName: 'Amani Residences',
      home,
      title: 'Paint peeling',
      to: 'wont_fix',
      note: 'Repainting is booked for March.',
    });
    expect(mail.subject).toBe("Your repair: Won't fix");
    expect(mail.lines).toContain('The reason they gave: Repainting is booked for March.');
    expect(mail.lines.at(-1)).toBe('If it is not right, you can reopen it on Injishi within 14 days.');
  });

  it('tells the landlord what was reported, how urgent, and links to the fault', () => {
    const mail = faultReportedLandlordMail({
      appUrl: 'http://localhost:3002',
      ticketId: 'ticket-1',
      tenantName: 'Aline Uwimana',
      home,
      title: 'Kitchen tap leaking',
      urgencyWords: 'urgent',
      description: 'Drips all night.',
      photoCount: 1,
      reportedOn: '2026-10-25',
    });
    expect(mail.subject).toBe('New fault at unit A-01 at Amani Residences: Kitchen tap leaking');
    expect(mail.lines[0]).toBe('Aline Uwimana reported a fault at unit A-01 at Amani Residences on 25 October 2026: "Kitchen tap leaking".');
    expect(mail.action.url).toBe('http://localhost:3002/faults/ticket-1');
    const rendered = renderRentalsMail(mail);
    expect(rendered.text).not.toMatch(/[—–]/);
    expect(rendered.text).toContain('1 photo is attached to the report.');
  });
});
