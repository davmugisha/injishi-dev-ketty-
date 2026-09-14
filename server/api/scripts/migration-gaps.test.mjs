import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { skippedMigrations } from './migration-gaps.mjs';

const journal = [
  { tag: '0032_payment_attempts', when: 100 },
  { tag: '0033_waitlist_signups', when: 200 },
  { tag: '0034_training', when: 300 },
  { tag: '0036_outlets', when: 400 },
  { tag: '0037_catalog', when: 500 },
];

test('a fresh database has nothing skipped', () => {
  assert.deepEqual(skippedMigrations(journal, []), []);
});

test('a database behind the journal has nothing skipped, only pending', () => {
  assert.deepEqual(skippedMigrations(journal, [100, '200']), []);
});

test('an entry below the newest applied row that never ran is reported', () => {
  // The ADR-053 renumber: 0036 applied, 0033/0034 recorded under old timestamps.
  assert.deepEqual(
    skippedMigrations(journal, [100, 150, 250, 400]),
    ['0033_waitlist_signups', '0034_training'],
  );
});

test("the repository's own journal is strictly ascending, so a new entry can never land below an applied one", () => {
  const { entries } = JSON.parse(
    readFileSync(new URL('../src/database/drizzle/migrations/meta/_journal.json', import.meta.url), 'utf8'),
  );
  for (let i = 1; i < entries.length; i++) {
    assert.ok(
      entries[i].when > entries[i - 1].when,
      `${entries[i].tag} (${entries[i].when}) is not later than ${entries[i - 1].tag} (${entries[i - 1].when})`,
    );
  }
});
