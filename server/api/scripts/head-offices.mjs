/**
 * Give every hospitality org without one a head office (ADR-054, invariant 1).
 *
 * Migration 0042 marks the oldest property of each hospitality org, but only the
 * rows that exist when it runs. A sample database is migrated EMPTY and seeded
 * afterwards, so every property a seed writes arrives with `is_head_office`
 * false. This applies the migration's rule again to whatever the seeds wrote:
 * the oldest active property (`created_at`, then `id`) of each hospitality org
 * that has no active head office.
 *
 * Idempotent. An org that already has a head office, including one a seed set
 * on purpose, is left alone, and the partial unique index would refuse a second
 * anyway. Residence orgs are never touched.
 */
export async function markHeadOffices(client) {
  const { rowCount } = await client.query(
    `UPDATE properties SET is_head_office = true
      WHERE id IN (
        SELECT DISTINCT ON (p.org_id) p.id
          FROM properties p
          JOIN orgs o ON o.id = p.org_id
         WHERE o.domain = 'hospitality'
           AND p.archived_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM properties h
              WHERE h.org_id = p.org_id AND h.is_head_office AND h.archived_at IS NULL
           )
         ORDER BY p.org_id, p.created_at, p.id
      )`,
  );
  return rowCount ?? 0;
}
