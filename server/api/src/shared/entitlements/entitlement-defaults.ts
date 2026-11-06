import { Logger } from '@nestjs/common';
import {
  KIND_PRODUCTS,
  businessKindOf,
  type ProductSetKind,
  type ProductId,
} from '@injishi/contracts';
import { eq, sql } from 'drizzle-orm';

import { escalations, orgProductEntitlements, orgs } from '../../database/drizzle/schema';
import type { Database } from '../database/database.module';

/** Anything that can read and write in the caller's transaction. */
type Tx = Pick<Database, 'select' | 'insert'>;

const log = new Logger('EntitlementDefaults');

/**
 * The products a business gets without anyone choosing them (ADR-074 D-k;
 * ADR-076 G2, G4).
 *
 * Two moments, each inside the transaction of the write that causes it, so a
 * business can never exist without `account`, or be `active` without its set:
 *
 * - `writeAccountTx` when the org row is created;
 * - `applyTx` whenever the org moves into `active`, on EVERY path that does it.
 *   A test fails on a write of `registration_status` that can reach `active`
 *   and does not call it.
 *
 * Both insert only what is missing. A product that already has ANY row, open
 * or closed, is left alone, so a reinstatement writes nothing (its rows
 * persisted through the suspension) and a product Injishi staff switched off is
 * never switched back on by an activation.
 */
export const EntitlementDefaults = {
  /** `account`, every branch, in the transaction that creates the org. */
  async writeAccountTx(tx: Tx, orgId: string): Promise<void> {
    await insertMissing(tx, orgId, ['account']);
  },

  /**
   * The rest of the org's kind's set, in the transaction that makes it
   * `active`. An org whose kind cannot be resolved gets `account` only, an
   * escalation row for a person to decide, and an error in the log: nothing is
   * guessed (G4).
   */
  async applyTx(
    tx: Tx,
    orgId: string,
  ): Promise<{ kind: ProductSetKind | null; written: ProductId[] }> {
    const [org] = await tx
      .select({
        // Read as text: a value the database gained before this code mapped it
        // must reach the escalation below, not fail on the way.
        businessKind: sql<string | null>`${orgs.businessKind}::text`,
        // A PSF business is known by its domain alone: it carries no kind (`businessKindOf`).
        domain: sql<string | null>`${orgs.domain}::text`,
        districtId: orgs.districtId,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    if (!org) throw new Error(`EntitlementDefaults: org ${orgId} does not exist.`);

    const kind = businessKindOf(org);
    if (kind === null) {
      const written = await insertMissing(tx, orgId, ['account']);
      await tx.insert(escalations).values({
        subjectType: 'org',
        subjectId: orgId,
        type: 'business_kind_unresolved',
        districtId: org.districtId,
      });
      log.error(
        `Org ${orgId} became active with business kind ${String(org.businessKind)}, which has no product set. It holds account only until a person decides; an escalation is open.`,
      );
      return { kind, written };
    }
    return { kind, written: await insertMissing(tx, orgId, KIND_PRODUCTS[kind]) };
  },
};

/** Insert an every branch row, `source = registration`, for each product the org has no row for at all. */
async function insertMissing(tx: Tx, orgId: string, products: readonly ProductId[]): Promise<ProductId[]> {
  const existing = await tx
    .select({ productId: orgProductEntitlements.productId })
    .from(orgProductEntitlements)
    .where(eq(orgProductEntitlements.orgId, orgId));
  const held = new Set(existing.map((row) => row.productId));
  const missing = products.filter((p) => !held.has(p));
  if (missing.length === 0) return [];
  await tx
    .insert(orgProductEntitlements)
    .values(
      missing.map((productId) => ({
        orgId,
        productId,
        propertyId: null,
        source: 'registration' as const,
      })),
    )
    .onConflictDoNothing();
  return missing;
}
