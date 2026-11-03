import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

import {
  PsfPublicBusiness,
  formatPsfMembershipNumber,
  isPsfDocId,
  maskEmail,
  maskPhone,
  median,
  newPsfDocId,
  normalizePsfDocId,
  provinceDisplayName,
  wholeDaysBetween,
} from '../dist/index.js';

test('a new docID is PSF- and two groups of four, from Crockford’s alphabet', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const id = newPsfDocId((n) => randomBytes(n));
    assert.ok(isPsfDocId(id), id);
    assert.doesNotMatch(id.slice(4), /[ILOU]/);
    seen.add(id);
  }
  assert.equal(seen.size, 2000, 'no repeats in two thousand');
});

test('a typed docID is made canonical, folding what Crockford folds', () => {
  assert.equal(normalizePsfDocId('psf-7k3m-q9xd'), 'PSF-7K3M-Q9XD');
  assert.equal(normalizePsfDocId('7K3MQ9XD'), 'PSF-7K3M-Q9XD');
  assert.equal(normalizePsfDocId('PSF 7K3M Q9XD'), 'PSF-7K3M-Q9XD');
  assert.equal(normalizePsfDocId('PSF-DEMO-OOO1'), 'PSF-DEM0-0001', 'O reads as zero');
  assert.equal(normalizePsfDocId('PSF-1LI1-0000'), 'PSF-1111-0000', 'I and L read as one');
  assert.equal(normalizePsfDocId('PSF-7K3M'), null);
  assert.equal(normalizePsfDocId('PSF-7K3M-Q9XU'), null, 'U is not in the alphabet');
});

test('the median, and days between two moments', () => {
  assert.equal(median([]), null);
  assert.equal(median([3]), 3);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(wholeDaysBetween(new Date('2026-10-01T10:00:00Z'), new Date('2026-10-08T09:59:00Z')), 6);
  assert.equal(wholeDaysBetween(new Date('2026-10-08T00:00:00Z'), new Date('2026-10-01T00:00:00Z')), 0);
});

test('membership numbers, provinces and masks read the way PSF writes them', () => {
  assert.equal(formatPsfMembershipNumber('KIC', 2026, 9), 'PSF/KIC/2026/0009');
  assert.equal(provinceDisplayName('KIGALI'), 'Kigali City');
  assert.equal(provinceDisplayName('EAST'), 'Eastern Province');
  assert.equal(maskPhone('+250781464545'), '+250 78• ••• 545');
  assert.equal(maskEmail('diane@example.rw'), 'd••••@example.rw');
});

test('the public form needs a country when trading and the right number for its registration; the street is optional', () => {
  const base = {
    legalName: 'Ubumwe Traders',
    registrationKind: 'none',
    associationCode: 'acgdr',
    subsectorOther: 'Groceries',
    address: { provinceId: 1, districtId: 103, sectorId: 10303, street: 'KK 15 Ave' },
    companyType: 'sole_trader',
    ownership: 'rwandan_100',
    businessActivity: 'Groceries',
    tradeDirection: 'none',
  };
  assert.ok(PsfPublicBusiness.safeParse(base).success);
  // Optional since 2026-11-02: the village places the business, and not every plot has a street.
  assert.ok(PsfPublicBusiness.safeParse({ ...base, address: { ...base.address, street: '' } }).success);
  assert.ok(!PsfPublicBusiness.safeParse({ ...base, tradeDirection: 'export', tradeGoods: 'Coffee' }).success);
  assert.ok(PsfPublicBusiness.safeParse({ ...base, tradeDirection: 'export', tradeGoods: 'Coffee', tradeCountries: ['BE'] }).success);
  assert.ok(!PsfPublicBusiness.safeParse({ ...base, registrationKind: 'rca' }).success);
  assert.ok(!PsfPublicBusiness.safeParse({ ...base, registrationKind: 'tin' }).success);
});

test('the form needs a subtype: picked from the list or typed, never both, never neither', () => {
  const base = {
    legalName: 'Ubumwe Traders', registrationKind: 'none', associationCode: 'acgdr',
    address: { provinceId: 1, districtId: 103, sectorId: 10303, street: 'KK 15 Ave' },
    companyType: 'sole_trader', ownership: 'rwandan_100', businessActivity: 'Groceries', tradeDirection: 'none',
  };
  const id = '00000000-0000-4000-8000-000000000001';
  assert.ok(!PsfPublicBusiness.safeParse(base).success, 'neither');
  assert.ok(PsfPublicBusiness.safeParse({ ...base, subsectorId: id }).success, 'picked');
  assert.ok(PsfPublicBusiness.safeParse({ ...base, subsectorOther: 'Beekeeping' }).success, 'typed');
  assert.ok(!PsfPublicBusiness.safeParse({ ...base, subsectorId: id, subsectorOther: 'Beekeeping' }).success, 'both');
});
