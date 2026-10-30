import assert from 'node:assert/strict';
import { test } from 'node:test';

import { businessKindFor } from './business-kind.mjs';

test('a residence is a residence, whatever else it says', () => {
  assert.equal(businessKindFor({ domain: 'residence', accommodationClass: null }), 'residence');
});

test("a stay's kind is its accommodation class", () => {
  for (const cls of ['hotel', 'motel', 'tented_camp', 'guest_house', 'apartment', 'lodge', 'villa', 'other']) {
    assert.equal(businessKindFor({ domain: 'hospitality', accommodationClass: cls }), cls);
  }
});

test('the retired classes map as migration 0075 mapped them', () => {
  assert.equal(businessKindFor({ domain: 'hospitality', accommodationClass: 'town_hotel' }), 'hotel');
  assert.equal(businessKindFor({ domain: 'hospitality', accommodationClass: 'vacation_hotel_resort' }), 'hotel');
  assert.equal(businessKindFor({ domain: 'hospitality', accommodationClass: 'serviced_apartment' }), 'apartment');
  assert.equal(businessKindFor({ domain: 'hospitality', accommodationClass: 'cottage' }), 'lodge');
});

test('a stay with no class is refused rather than given a kind', () => {
  assert.throws(() => businessKindFor({ domain: 'hospitality', accommodationClass: null }), /accommodation class/);
});
