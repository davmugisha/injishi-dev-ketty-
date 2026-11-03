import { describe, expect, it } from 'vitest';

import { psfRenewalTerms } from './psf-renewal-rules';

describe('psfRenewalTerms', () => {
  it('is closed until 60 days before the end date', () => {
    const t = psfRenewalTerms({ expiresOn: '2027-11-01', ended: false, today: '2027-09-01' });
    expect(t.open).toBe(false);
    expect(t.opensOn).toBe('2027-09-02');
    expect(t.reason).toContain('2027-09-02');
  });

  it('opens on the 60th day before, and runs on from the old end date', () => {
    const t = psfRenewalTerms({ expiresOn: '2027-11-01', ended: false, today: '2027-09-02' });
    expect(t).toMatchObject({ open: true, reason: null, startsOn: '2027-11-02', expiresOn: '2028-11-01' });
  });

  it('starts a lapsed membership again on the day it is paid', () => {
    const t = psfRenewalTerms({ expiresOn: '2027-11-01', ended: true, today: '2028-01-15' });
    expect(t).toMatchObject({ open: true, startsOn: '2028-01-15', expiresOn: '2029-01-14' });
  });

  it('treats a past end date as lapsed even before the sweep ends it', () => {
    const t = psfRenewalTerms({ expiresOn: '2027-11-01', ended: false, today: '2027-11-02' });
    expect(t).toMatchObject({ open: true, startsOn: '2027-11-02', expiresOn: '2028-11-01' });
  });

  it('can renew on the last valid day without losing it', () => {
    const t = psfRenewalTerms({ expiresOn: '2027-11-01', ended: false, today: '2027-11-01' });
    expect(t).toMatchObject({ open: true, startsOn: '2027-11-02' });
  });
});
