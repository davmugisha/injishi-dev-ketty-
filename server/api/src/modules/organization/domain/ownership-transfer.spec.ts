import { describe, expect, it } from 'vitest';

import {
  OWNERSHIP_STEP_UP_SECONDS,
  OWNERSHIP_TRANSFER_TTL_DAYS,
  ownershipTransferMail,
  transferExpiresAt,
} from './ownership-transfer';

describe('ownership transfer', () => {
  it('lives 7 days, like every invitation, and asks for a step-up from the last ten minutes', () => {
    const at = new Date('2026-11-13T10:00:00.000Z');
    expect(OWNERSHIP_TRANSFER_TTL_DAYS).toBe(7);
    expect(transferExpiresAt(at).toISOString()).toBe('2026-11-20T10:00:00.000Z');
    expect(OWNERSHIP_STEP_UP_SECONDS).toBe(600);
  });

  it('tells the member what happens, and carries no token, code or link to act from', () => {
    const mail = ownershipTransferMail({
      legalName: 'Ikirezi Bistro Group Ltd',
      toName: 'Patrick Habimana',
      fromName: 'Claudine Uwase',
      previousOwnerRoleLabel: 'Manager',
      appUrl: 'https://app.injishi.com',
      expiresAt: new Date('2026-11-20T10:00:00.000Z'),
    });
    expect(mail.subject).toContain('Claudine Uwase wants to make you the owner of Ikirezi Bistro Group Ltd');
    expect(mail.text).toContain('stays on the team as Manager');
    expect(mail.text).toContain('2026-11-20');
    expect(mail.text).toContain('https://app.injishi.com/sign-in');
    // The only link is the sign-in page: no token, no transfer id, no code.
    const links = mail.html.match(/href="([^"]+)"/g) ?? [];
    expect(links).toEqual(['href="https://app.injishi.com/sign-in"']);
    expect(mail.text).not.toMatch(/token|\b\d{6}\b/);
  });

  it('escapes names in the HTML mail', () => {
    const mail = ownershipTransferMail({
      legalName: '<b>Bar</b>',
      toName: 'A & B',
      fromName: '"C"',
      previousOwnerRoleLabel: 'Manager',
      appUrl: 'https://app.injishi.com',
      expiresAt: new Date('2026-11-20T10:00:00.000Z'),
    });
    expect(mail.html).toContain('&lt;b&gt;Bar&lt;/b&gt;');
    expect(mail.html).toContain('A &amp; B');
    expect(mail.html).not.toContain('<b>Bar</b>');
  });
});
