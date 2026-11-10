import { Inject, Injectable } from '@nestjs/common';
import type { ProductId } from '@injishi/contracts';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/database.module';
import { accessRefusal } from '../auth/access-refusal';
import { isOnAt, type OpenEntitlement } from './entitlement-rules';

/**
 * Entitlement where no workspace is named: a guest's order, a public listing,
 * a broker's directory (ADR-074 "Guest and public routes"; ADR-076 G10).
 *
 * These routes carry no `@RequireProduct`, because they have no workspace.
 * Ownership is checked first, as before, so a probe still meets 404; then the
 * owning service resolves the business from the record and asks here. A list
 * leaves out what is off; an act on one record is refused 403 with
 * `layer: "entitlement"`, the same answer the guard gives.
 */

/**
 * The SQL condition "this business has `product` on (at this branch)", for a
 * public read to AND into its WHERE. G5's rule: an open row for the branch or
 * for every branch.
 */
export function productOnSql(orgId: AnyColumn | SQL, product: ProductId, propertyId?: AnyColumn | SQL): SQL {
  const atBranch = propertyId === undefined ? sql`` : sql` AND (e.property_id IS NULL OR e.property_id = ${propertyId})`;
  return sql`EXISTS (
    SELECT 1 FROM org_product_entitlements e
     WHERE e.org_id = ${orgId} AND e.product_id = ${product} AND e.disabled_at IS NULL${atBranch}
  )`;
}

/** A place a record sits: its workspace, and its branch when it has one. */
export interface EntitledPlace {
  readonly workspaceId: string;
  readonly propertyId: string | null;
}

@Injectable()
export class EntitlementCheck {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Whether `product` is on at each place, in the order given, in ONE read. A
   * place with no branch counts as on only where the product is on for every
   * branch.
   */
  async onAt(product: ProductId, places: readonly EntitledPlace[]): Promise<boolean[]> {
    const workspaceIds = [...new Set(places.map((p) => p.workspaceId))];
    if (workspaceIds.length === 0) return [];
    const result = await this.db.execute<{ workspace_id: string; property_id: string | null }>(sql`
      SELECT w.id AS workspace_id, e.property_id
        FROM workspaces w
        JOIN org_product_entitlements e ON e.org_id = w.org_id
       WHERE w.id IN (${sql.join(workspaceIds.map((id) => sql`${id}::uuid`), sql`, `)})
         AND e.product_id = ${product}
         AND e.disabled_at IS NULL
    `);
    const byWorkspace = new Map<string, OpenEntitlement[]>();
    for (const row of result.rows) {
      const list = byWorkspace.get(row.workspace_id) ?? [];
      list.push({ productId: product, propertyId: row.property_id });
      byWorkspace.set(row.workspace_id, list);
    }
    return places.map((place) => {
      const open = byWorkspace.get(place.workspaceId) ?? [];
      return place.propertyId === null
        ? open.some((row) => row.propertyId === null)
        : isOnAt(open, product, place.propertyId);
    });
  }

  /** Refuse one act when its product is off where its record sits. */
  async assertOn(product: ProductId, place: EntitledPlace, message: string): Promise<void> {
    const [on] = await this.onAt(product, [place]);
    if (!on) throw accessRefusal('product_off', message);
  }

  /**
   * Whether `product` is on for this business at this branch, in one read: for
   * a caller that knows the business and branch rather than a workspace, such
   * as a paired kiosk (ADR-076 G9).
   */
  async onForOrgAt(product: ProductId, orgId: string, propertyId: string): Promise<boolean> {
    const result = await this.db.execute<{ on: boolean }>(
      sql`SELECT ${productOnSql(sql`${orgId}::uuid`, product, sql`${propertyId}::uuid`)} AS on`,
    );
    return result.rows[0]?.on === true;
  }
}
