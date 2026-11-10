/**
 * Give every org the products it can reach (ADR-076 G3, A-13).
 *
 * Migration 0134 switches products on for the orgs that exist when it runs. A
 * sample database is migrated EMPTY and seeded afterwards, and the seeds write
 * their orgs straight into the table, past the code that writes entitlements on
 * creation and on activation. Without this every seeded business would hold no
 * product, and every product route would refuse it. So the migration's rule is
 * applied again to whatever the seeds wrote, word for word:
 *
 * - every org gets `account`;
 * - an org that is `active` or `suspended` also gets what it could reach before
 *   slice G, by domain: hospitality gets marketplace, pms, outlets, pos, hr,
 *   finance and pay; residence gets marketplace, residence, hr, finance and pay.
 *
 * Every row covers every branch and says `source = 'backfill'`. Idempotent: an
 * org that already holds any row for a product, open or closed, is left alone
 * for it, so a rerun changes nothing even after a product was switched off.
 */
export const ENTITLEMENTS_BACKFILL_SQL = `INSERT INTO org_product_entitlements (org_id, product_id, property_id, source)
SELECT o.id, p.product_id, NULL, 'backfill'
FROM orgs o
CROSS JOIN LATERAL unnest(
  CASE
    WHEN o.registration_status IN ('active', 'suspended') AND o.domain = 'hospitality'
      THEN ARRAY['account', 'marketplace', 'pms', 'outlets', 'pos', 'hr', 'finance', 'pay']
    WHEN o.registration_status IN ('active', 'suspended') AND o.domain = 'residence'
      THEN ARRAY['account', 'marketplace', 'residence', 'hr', 'finance', 'pay']
    ELSE ARRAY['account']
  END
) AS p(product_id)
WHERE NOT EXISTS (
  SELECT 1 FROM org_product_entitlements e
  WHERE e.org_id = o.id AND e.product_id = p.product_id
)`;

/** Returns how many rows it wrote. */
export async function backfillEntitlements(client) {
  const { rowCount } = await client.query(ENTITLEMENTS_BACKFILL_SQL);
  return rowCount ?? 0;
}
