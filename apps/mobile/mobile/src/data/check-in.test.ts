/**
 * The check-in draft's validation.
 *
 * `stepBlockedKey` is the only description of what a step needs, and both the
 * disabled button and the sentence beside it read it — so a bug here is a
 * button that refuses without saying why, or one that lets an invalid document
 * through to a 422 the guest cannot act on. It is pure, so it is tested without
 * rendering anything.
 */
import {
  CHECK_IN_STEPS,
  EMPTY_CHECK_IN_DRAFT,
  draftComplete,
  normaliseDocumentNumber,
  stepBlockedKey,
  toContractAddress,
  type CheckInDraft,
} from './check-in';

const PHOTO = { uri: 'file:///doc.jpg', width: 1200, height: 800 };

function draft(overrides: Partial<CheckInDraft> = {}): CheckInDraft {
  return { ...EMPTY_CHECK_IN_DRAFT, ...overrides };
}

describe('normaliseDocumentNumber', () => {
  it('strips the spaces the card is printed in', () => {
    // `RwandanNationalId`'s own rule: the field is displayed grouped, and a
    // person who types what they see must not be told they are wrong.
    expect(normaliseDocumentNumber('1 1990 8 0012345 6 78')).toBe('1199080012345678');
  });
});

describe('the document step', () => {
  it('asks for a number before anything else', () => {
    expect(stepBlockedKey(draft(), 'document')).toBe('checkin.blockedNumberEmpty');
  });

  it('holds a Rwandan national ID to 16 digits, spaces and all', () => {
    expect(stepBlockedKey(draft({ documentNumber: '1199080012345' }), 'document')).toBe(
      'checkin.blockedNidShape',
    );
    expect(stepBlockedKey(draft({ documentNumber: '1 1990 8 0012345 6 78' }), 'document')).toBeNull();
  });

  it('refuses a national ID with letters in it', () => {
    expect(stepBlockedKey(draft({ documentNumber: 'A199080012345678' }), 'document')).toBe(
      'checkin.blockedNidShape',
    );
  });

  it('is deliberately loose on a passport, and strict on its country', () => {
    // `PassportNumber` is loose on purpose: issuing states disagree on length
    // and alphabet, and rejecting a valid foreign passport is worse than
    // accepting a typo the desk will catch against the document itself.
    const passport = (over: Partial<CheckInDraft>) =>
      stepBlockedKey(draft({ documentType: 'passport', ...over }), 'document');

    expect(passport({ documentNumber: 'PC1', issuingCountry: 'KE' })).toBe(
      'checkin.blockedPassportShort',
    );
    expect(passport({ documentNumber: 'PC1234567', issuingCountry: 'ZZ' })).toBe(
      'checkin.blockedCountry',
    );
    expect(passport({ documentNumber: 'PC1234567', issuingCountry: 'KE' })).toBeNull();
  });
});

describe('the photo step', () => {
  it('needs exactly one photograph, and says so', () => {
    expect(stepBlockedKey(draft(), 'photo')).toBe('checkin.blockedPhoto');
    expect(stepBlockedKey(draft({ photos: [PHOTO] }), 'photo')).toBeNull();
  });
});

describe('the address step', () => {
  it('asks Rwanda for a street and a district', () => {
    const rw = (over: Partial<CheckInDraft['address']>) =>
      stepBlockedKey(draft({ address: { ...EMPTY_CHECK_IN_DRAFT.address, ...over } }), 'address');

    expect(rw({})).toBe('checkin.blockedStreet');
    expect(rw({ street: 'KG 11 Ave 24' })).toBe('checkin.blockedDistrict');
    expect(rw({ street: 'KG 11 Ave 24', district: 'Gasabo' })).toBeNull();
  });

  it('asks everywhere else for one block of text, and a country it knows', () => {
    const abroad = (over: Partial<CheckInDraft['address']>) =>
      stepBlockedKey(
        draft({ address: { ...EMPTY_CHECK_IN_DRAFT.address, country: 'KE', ...over } }),
        'address',
      );

    expect(abroad({})).toBe('checkin.blockedAddressText');
    expect(abroad({ addressText: '12 Ngong Rd, Nairobi' })).toBeNull();
    expect(abroad({ country: 'ZZ', addressText: 'somewhere' })).toBe('checkin.blockedCountry');
  });
});

describe('draftComplete', () => {
  it('is every step, not the last one', () => {
    const nearly = draft({
      documentNumber: '1199080012345678',
      address: { country: 'RW', street: 'KG 11 Ave 24', district: 'Gasabo', addressText: '' },
    });
    // The address is answered but the photograph is not: a flow that let this
    // through would commit a check-in with no document image on it.
    expect(stepBlockedKey(nearly, 'address')).toBeNull();
    expect(draftComplete(nearly)).toBe(false);
    expect(draftComplete({ ...nearly, photos: [PHOTO] })).toBe(true);
  });

  it('covers all three steps', () => {
    expect(CHECK_IN_STEPS).toEqual(['document', 'photo', 'address']);
  });
});

describe('toContractAddress', () => {
  it('is `InternationalAddress` verbatim outside Rwanda', () => {
    expect(
      toContractAddress({
        country: 'KE',
        street: '',
        district: '',
        addressText: '  12 Ngong Rd, Nairobi ',
      }),
    ).toEqual({ country: 'KE', addressText: '12 Ngong Rd, Nairobi' });
  });

  it('keeps the district as a NAME in Rwanda, until the geography cascade lands', () => {
    // `RwandanAddress` wants `provinceId`/`districtId`/`sectorId` from
    // `GET /geography/*`, which has no fixture here. Inventing three ids would
    // be inventing rows that will not match the real table.
    expect(
      toContractAddress({
        country: 'RW',
        street: ' KG 11 Ave 24 ',
        district: ' Gasabo ',
        addressText: '',
      }),
    ).toEqual({ country: 'RW', street: 'KG 11 Ave 24', district: 'Gasabo' });
  });
});
