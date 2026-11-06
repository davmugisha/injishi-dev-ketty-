import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { type PsfCertificateFacts, renderPsfCard, renderPsfCertificate } from './psf-certificate.renderer';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
  'base64',
);

const facts: PsfCertificateFacts = {
  businessName: 'Spec Coffee',
  businessCode: 'NRG-AAAA-AA',
  districtName: 'Nyarugenge',
  sectorName: 'Agriculture & Livestock · Crops and coffee',
  levelName: 'Indatwa',
  membershipNumber: 'PSF/KIC/2026/0007',
  startsOn: '2026-11-05',
  expiresOn: '2027-11-04',
  docId: 'PSF-AAAA-BBBB',
  issuedBy: 'PSF Nyarugenge district office',
  trackUrl: 'https://example.test/psf/card?number=PSF%2FKIC%2F2026%2F0007',
};

const isPdf = (b: Buffer): boolean => b.subarray(0, 4).toString() === '%PDF';

describe('the owner photo on PSF papers (2026-11-05)', () => {
  it.each([
    ['card', renderPsfCard],
    ['certificate', renderPsfCertificate],
  ])('prints the photo on the %s, making it larger than without', async (_name, render) => {
    const without = await render(facts);
    const withPhoto = await render({ ...facts, ownerPhoto: { bytes: PNG, mime: 'image/png' } });
    expect(isPdf(without)).toBe(true);
    expect(isPdf(withPhoto)).toBe(true);
    expect(withPhoto.length).toBeGreaterThan(without.length);
  });

  it.each([
    ['card', renderPsfCard],
    ['certificate', renderPsfCertificate],
  ])('still renders the %s when the stored photo cannot be read', async (_name, render) => {
    const pdf = await render({ ...facts, ownerPhoto: { bytes: Buffer.from('not an image'), mime: 'image/jpeg' } });
    expect(isPdf(pdf)).toBe(true);
  });
});

describe('the card and certificate design (2026-11-06)', () => {
  it('prints the card on two sides, and the certificate on one', async () => {
    expect((await PDFDocument.load(await renderPsfCard(facts))).getPageCount()).toBe(2);
    expect((await PDFDocument.load(await renderPsfCertificate(facts))).getPageCount()).toBe(1);
  });

  it.each(['golden_circle', 'indashyikirwa', 'indatwa', 'a_level_psf_adds_later'])('renders level %s, with a holder, ribbon and long names', async (levelCode) => {
    const long = { ...facts, levelCode, badge: 'Bronze', ownerName: 'Nadine Uwimana Mukamana Sample', businessName: 'A Very Long Business Name Limited Of The Republic Of Rwanda' };
    expect(isPdf(await renderPsfCard(long))).toBe(true);
    expect(isPdf(await renderPsfCertificate(long))).toBe(true);
  });

  it('holds a name no standard font carries', async () => {
    const pdf = await renderPsfCertificate({ ...facts, businessName: 'Ŝpec Ĉoffee', ownerName: 'Ŝpec' });
    expect(isPdf(pdf)).toBe(true);
  });
});
