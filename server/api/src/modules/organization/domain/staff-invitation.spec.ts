import { describe, expect, it } from 'vitest';

import {
  staffInvitationExpiresAt,
  staffInvitationLink,
  staffInvitationMail,
} from './staff-invitation';

describe('staff invitation', () => {
  it('links to the web join page with the org and the token', () => {
    const link = staffInvitationLink('http://localhost:3000', 'org-1', 'tok_abc');
    expect(link).toBe('http://localhost:3000/join-team?org=org-1&token=tok_abc');
  });

  it('lives seven days, like every org invitation', () => {
    const issued = new Date('2026-09-13T08:00:00Z');
    expect(staffInvitationExpiresAt(issued).toISOString()).toBe('2026-09-20T08:00:00.000Z');
  });

  it('names the business, the role, the sender and the address that must sign in', () => {
    const mail = staffInvitationMail({
      legalName: 'Umurage Guesthouse',
      orgRole: 'receptionist',
      inviterName: 'Samuel Kayitare',
      email: 'desk@example.test',
      link: 'http://localhost:3000/join-team?org=o&token=t',
      expiresAt: new Date('2026-09-20T08:00:00Z'),
    });
    expect(mail.subject).toBe('Join Umurage Guesthouse on Injishi as Front office / Receptionist');
    expect(mail.text).toContain('Samuel Kayitare invited you');
    expect(mail.text).toContain('sign in with desk@example.test');
    expect(mail.text).toContain('2026-09-20');
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it('escapes names in the HTML part', () => {
    const mail = staffInvitationMail({
      legalName: '<b>Hotel</b>',
      orgRole: 'manager',
      inviterName: null,
      email: 'a@b.test',
      link: 'http://x/join-team',
      expiresAt: new Date(),
    });
    expect(mail.html).not.toContain('<b>Hotel</b>');
    expect(mail.html).toContain('&lt;b&gt;Hotel&lt;/b&gt;');
  });
});
