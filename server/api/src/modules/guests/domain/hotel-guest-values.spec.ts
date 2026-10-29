import { describe, expect, it } from 'vitest';

import type { HotelStayFacts } from '../infrastructure/guest-registry.repository';
import { guestDocument, guestNationality, hotelGuestValues, phoneE164, stayWindow } from './hotel-guest-values';

const facts = (over: Partial<HotelStayFacts> = {}): HotelStayFacts => ({
  stayId: 'stay-1',
  workspaceId: 'ws-1',
  propertyId: 'prop-1',
  arrivalOn: '2026-10-29',
  departureOn: '2026-11-01',
  fullName: 'Aline Uwase',
  phone: '0788123456',
  cardNationality: null,
  cardDocumentType: null,
  cardIdNumber: null,
  accountDocumentType: null,
  accountIdNumber: null,
  accountIssuingCountry: null,
  profileCountry: null,
  profileVillageId: null,
  ...over,
});

describe('hotel guest values (0114)', () => {
  it('reads Rwandan phones in the shapes a desk types them', () => {
    expect(phoneE164('0788 123 456')).toBe('+250788123456');
    expect(phoneE164('788123456')).toBe('+250788123456');
    expect(phoneE164('+250 788 123 456')).toBe('+250788123456');
    expect(phoneE164('+44 20 7946 0958')).toBe('+442079460958');
    expect(phoneE164('call me')).toBeNull();
    expect(phoneE164(null)).toBeNull();
  });

  it('keeps a document only in the shapes the register accepts', () => {
    expect(guestDocument('national_id', '1 1997 8 0012345 6 78')).toEqual({ idKind: 'national_id', idNumber: '1199780012345678' });
    expect(guestDocument('passport', 'pc-123456')).toEqual({ idKind: 'passport', idNumber: 'PC123456' });
    expect(guestDocument('national_id', '123')).toEqual({ idKind: null, idNumber: null });
    expect(guestDocument('other', 'DL-1')).toEqual({ idKind: null, idNumber: null });
  });

  it('takes the desk country first, then the account document, then a National ID as Rwandan', () => {
    expect(guestNationality(facts({ cardNationality: 'ke', accountIssuingCountry: 'UG' }))).toEqual({ code: 'KE', known: true });
    expect(guestNationality(facts({ accountIssuingCountry: 'UG' }))).toEqual({ code: 'UG', known: true });
    expect(guestNationality(facts({ cardDocumentType: 'national_id' }))).toEqual({ code: 'RW', known: true });
    expect(guestNationality(facts())).toEqual({ code: 'RW', known: false });
  });

  it('keeps the dates inside the register: never before arrival, at most 90 nights', () => {
    expect(stayWindow('2026-10-29', null)).toEqual({ arrivalOn: '2026-10-29', departureOn: '2026-10-29' });
    expect(stayWindow('2026-10-29', '2026-10-20')).toEqual({ arrivalOn: '2026-10-29', departureOn: '2026-10-29' });
    expect(stayWindow('2026-10-29', '2027-06-01').departureOn).toBe('2027-01-27');
  });

  it('files a foreign passport holder with no relationship and no home village', () => {
    const out = hotelGuestValues(facts({ cardNationality: 'KE', cardDocumentType: 'passport', cardIdNumber: 'AK1234567', profileVillageId: 7 }));
    expect(out?.values).toMatchObject({
      nationality: 'KE',
      originCountry: 'KE',
      originVillageId: null,
      relationship: null,
      idKind: 'passport',
      phone: '+250788123456',
    });
  });

  it("gives a Rwandan their profile's home village, and refuses a stay with no name", () => {
    expect(hotelGuestValues(facts({ cardDocumentType: 'national_id', profileVillageId: 7 }))?.values.originVillageId).toBe(7);
    expect(hotelGuestValues(facts({ fullName: ' ' }))).toBeNull();
  });
});
