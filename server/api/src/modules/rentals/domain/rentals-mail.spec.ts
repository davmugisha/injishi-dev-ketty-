import { describe, expect, it } from 'vitest';

import {
  invitationMail,
  leaseCancelledMail,
  renderRentalsMail,
  signedCopyLandlordMail,
  signedCopyTenantMail,
  signingCodeMail,
  tenancyStartedMail,
  type RentalsMail,
} from './rentals-mail';

/**
 * The rentals emails as a tenant and a landlord read them: plain, short, no
 * dashes for pauses, one link each, to the app's own pages.
 */
const APP = 'http://localhost:3002';
const LEASE = '66666666-6666-4666-8666-666666666666';
const home = { unitLabel: 'A-01', propertyName: 'Amani Residences' };

const all: RentalsMail[] = [
  invitationMail({
    appUrl: APP,
    leaseId: LEASE,
    token: 'tok_abc',
    tenantName: 'Aimée Uwera',
    landlordName: 'Amani Residences',
    home,
    terms: { monthlyRentRwf: 400_000, depositRwf: 800_000, startDate: '2026-11-01', endDate: '2027-10-31' },
    expiresAt: new Date('2026-11-07T10:00:00Z'),
  }),
  signedCopyTenantMail({ appUrl: APP, leaseId: LEASE, reference: 'L-0001', tenantName: 'Aimée Uwera', landlordName: 'Amani Residences', home, startDate: '2026-11-01', depositRwf: 800_000, autoStart: true }),
  signedCopyLandlordMail({ appUrl: APP, leaseId: LEASE, reference: 'L-0001', tenantName: 'Aimée Uwera', landlordName: 'Amani Residences', home, startDate: '2026-11-01', depositRwf: 800_000, autoStart: false }),
  tenancyStartedMail({
    appUrl: APP,
    leaseId: LEASE,
    tenantName: 'Aimée Uwera',
    landlordName: 'Amani Residences',
    home,
    byLandlord: true,
    charges: [
      { kind: 'deposit', periodStart: null, dueOn: '2026-11-01', owedRwf: 800_000 },
      { kind: 'rent', periodStart: '2026-11-01', dueOn: '2026-11-05', owedRwf: 400_000 },
    ],
  }),
  leaseCancelledMail({ appUrl: APP, leaseId: LEASE, tenantName: 'Aimée Uwera', landlordName: 'Amani Residences', home, reason: 'The unit is not ready.' }),
];

describe('rentals emails', () => {
  it('link to the app routes the UI serves', () => {
    expect(all.map((m) => m.action.url)).toEqual([
      `${APP}/invite/lease/tok_abc`,
      `${APP}/home/${LEASE}/lease`,
      `${APP}/leases/${LEASE}`,
      `${APP}/home/${LEASE}/lease`,
      `${APP}/home/${LEASE}/lease`,
    ]);
  });

  it('carry no em or en dashes', () => {
    const code = signingCodeMail({ code: '048213', home: 'unit A-01 at Amani Residences', minutes: 10 });
    for (const text of [...all.map((m) => renderRentalsMail(m).text), ...all.map((m) => renderRentalsMail(m).html), code.text, code.html]) {
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it('say the facts in plain words', () => {
    expect(all[0]!.lines).toEqual([
      'Hello Aimée,',
      'Amani Residences signed a lease for unit A-01 at Amani Residences and is waiting for your signature.',
      'Rent is RWF 400,000 a month, from 1 November 2026 to 31 October 2027.',
      'The deposit is RWF 800,000, due on 1 November 2026.',
      'Open the lease to read it. You sign in with this email address, then you sign.',
      'The link works until 7 November 2026.',
    ]);
    expect(all[3]!.lines).toEqual([
      'Hello Aimée,',
      'Amani Residences started your tenancy for unit A-01 at Amani Residences. Welcome home.',
      'What you owe now:',
      'Deposit: RWF 800,000, due on 1 November 2026.',
      'Rent for November 2026: RWF 400,000, due on 5 November 2026.',
    ]);
    expect(all[2]!.lines).toContain('File a copy with the Rwanda Revenue Authority within 15 days.');
    expect(signingCodeMail({ code: '048213', home: 'unit A-01 at Amani Residences', minutes: 10 }).text).toContain(
      'Your code to sign the lease for unit A-01 at Amani Residences is 048213.',
    );
  });

  it('escape what people typed in the HTML', () => {
    const html = renderRentalsMail(leaseCancelledMail({ appUrl: APP, leaseId: LEASE, tenantName: 'A', landlordName: 'B', home, reason: '<script>x</script>' })).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
