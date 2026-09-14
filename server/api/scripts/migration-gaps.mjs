/**
 * Migrations Drizzle will never apply to this database (platform audit
 * 2026-09-14, H3).
 *
 * Drizzle's migrator reads only the NEWEST row of `drizzle.__drizzle_migrations`
 * and applies each journal entry whose `when` is later than that row's
 * `created_at`. It never asks whether an OLDER entry was applied. So a
 * migration inserted or renumbered below one the database already has is
 * skipped forever, and `migrate` reports "up to date" over a schema that lacks
 * its tables. That is what the ADR-053 merge did to 0033 to 0035 on every
 * database migrated before it.
 *
 * Matched on `when` (stored as `created_at`), not on the hash: the hash is the
 * sha256 of the raw file, so a CRLF checkout and the LF image disagree about
 * the same migration, and a hash comparison would cry wolf across platforms.
 *
 * Kept free of any database access so the rule can be tested without one.
 *
 * @param {{ tag: string, when: number }[]} journalEntries
 * @param {Array<number | string | bigint>} appliedCreatedAts
 * @returns {string[]} tags that sit at or below the newest applied migration
 *   and were never applied
 */
export function skippedMigrations(journalEntries, appliedCreatedAts) {
  if (appliedCreatedAts.length === 0) return [];
  const applied = new Set(appliedCreatedAts.map((v) => Number(v)));
  const newest = Math.max(...applied);
  return journalEntries
    .filter((entry) => entry.when <= newest && !applied.has(entry.when))
    .map((entry) => entry.tag);
}
