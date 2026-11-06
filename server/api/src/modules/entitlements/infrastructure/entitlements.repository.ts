import { Inject, Injectable } from '@nestjs/common';
import type { OrgProductEntitlement, ProductId, ProductInUseReason } from '@injishi/contracts';
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import {
  notifications,
  orgMemberships,
  orgProductEntitlements,
  orgs,
  properties,
  userProfiles,
  users,
  workspaces,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { EntitlementPlan, ProductRow } from '../../../shared/entitlements/entitlement-rules';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** One active branch of a business, as a change and its notice name it. */
export interface BranchName {
  readonly id: string;
  readonly name: string;
}

/** Who is told about a change (ADR-076 contract section 9): the business's owner. */
export interface OwnerRecipient {
  readonly userId: string;
  readonly email: string;
  readonly locale: string;
}

/**
 * Reads and writes of `org_product_entitlements` (ADR-076 G5 to G8).
 *
 * The one writer of the table outside `EntitlementDefaults`. Every change runs
 * inside `inOrgTransaction`, which locks the org's row first, so two staff
 * changing the same business's products queue rather than race.
 */
@Injectable()
export class EntitlementsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The business, or null when no org has that id. */
  async org(orgId: string): Promise<{ id: string; legalName: string; workspaceId: string | null } | null> {
    const [row] = await this.db
      .select({ id: orgs.id, legalName: orgs.legalName, workspaceId: workspaces.id })
      .from(orgs)
      .leftJoin(workspaces, and(eq(workspaces.orgId, orgs.id), eq(workspaces.kind, 'business')))
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row ?? null;
  }

  /** Every row the org has held, open and closed, newest first. */
  async rows(orgId: string): Promise<OrgProductEntitlement[]> {
    const rows = await this.db
      .select()
      .from(orgProductEntitlements)
      .where(eq(orgProductEntitlements.orgId, orgId))
      .orderBy(desc(orgProductEntitlements.enabledAt), desc(orgProductEntitlements.id));
    return rows.map((row) => ({
      id: row.id,
      productId: row.productId as ProductId,
      propertyId: row.propertyId,
      source: row.source,
      enabledAt: row.enabledAt.toISOString(),
      disabledAt: row.disabledAt ? row.disabledAt.toISOString() : null,
      setByUserId: row.setByUserId,
      reason: row.reason,
    }));
  }

  /** The business's active branches, head office first, then by name. */
  async activeBranches(orgId: string, tx: Tx | Database = this.db): Promise<BranchName[]> {
    return tx
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(and(eq(properties.orgId, orgId), isNull(properties.archivedAt)))
      .orderBy(desc(properties.isHeadOffice), asc(properties.name));
  }

  /**
   * Run `fn` in a transaction holding the org's row, or answer null when no
   * org has that id.
   */
  async inOrgTransaction<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T | null> {
    return this.db.transaction(async (tx) => {
      const locked = await tx.execute<{ id: string }>(
        sql`SELECT id FROM orgs WHERE id = ${orgId} FOR UPDATE`,
      );
      if (locked.rows.length === 0) return null;
      return fn(tx);
    });
  }

  /** The product's open rows. */
  async openRows(tx: Tx, orgId: string, productId: ProductId): Promise<ProductRow[]> {
    return tx
      .select({ id: orgProductEntitlements.id, propertyId: orgProductEntitlements.propertyId })
      .from(orgProductEntitlements)
      .where(
        and(
          eq(orgProductEntitlements.orgId, orgId),
          eq(orgProductEntitlements.productId, productId),
          isNull(orgProductEntitlements.disabledAt),
        ),
      );
  }

  /** Close and open what the plan says, as staff with a reason. Returns the opened ids. */
  async applyPlan(
    tx: Tx,
    input: { orgId: string; productId: ProductId; plan: EntitlementPlan; actorUserId: string; reason: string },
  ): Promise<string[]> {
    if (input.plan.close.length > 0) {
      await tx
        .update(orgProductEntitlements)
        .set({ disabledAt: new Date() })
        .where(
          and(
            eq(orgProductEntitlements.orgId, input.orgId),
            inArray(orgProductEntitlements.id, [...input.plan.close]),
            isNull(orgProductEntitlements.disabledAt),
          ),
        );
    }
    if (input.plan.open.length === 0) return [];
    const opened = await tx
      .insert(orgProductEntitlements)
      .values(
        input.plan.open.map((propertyId) => ({
          orgId: input.orgId,
          productId: input.productId,
          propertyId,
          source: 'admin' as const,
          setByUserId: input.actorUserId,
          reason: input.reason,
        })),
      )
      .returning({ id: orgProductEntitlements.id });
    return opened.map((row) => row.id);
  }

  /**
   * The open work that keeps a product on (ADR-076 G7), at the named branches,
   * or anywhere in the business with none named. Each reason counts its rows;
   * a product with no definition of open work has none.
   */
  async openWork(
    tx: Tx,
    input: { orgId: string; productId: ProductId; propertyIds: readonly string[] | null },
  ): Promise<ProductInUseReason[]> {
    const named = input.propertyIds;
    const where = (column: SQL): SQL =>
      named === null || named.length === 0
        ? sql`${column} IN (SELECT id FROM properties WHERE org_id = ${input.orgId})`
        : sql`${column} IN (${sql.join(
            named.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`;

    // POS work hangs off an outlet (`ot` in each query), and a standalone outlet
    // has no branch: with none named, every outlet of the business counts,
    // through its workspaces.
    const atOutlet = (): SQL =>
      named === null || named.length === 0
        ? sql`ot.workspace_id IN (SELECT id FROM workspaces WHERE org_id = ${input.orgId})`
        : where(sql`ot.property_id`);

    const counted = async (
      kind: ProductInUseReason['kind'],
      message: string,
      query: SQL,
    ): Promise<ProductInUseReason[]> => {
      const { rows } = await tx.execute<{ property_id: string | null; n: number }>(query);
      return rows
        .filter((row) => Number(row.n) > 0)
        .map((row) => ({ kind, propertyId: row.property_id, count: Number(row.n), message }));
    };

    switch (input.productId) {
      case 'pms':
        return [
          ...(await counted(
            'guest_in_house',
            'A guest is in house.',
            sql`SELECT r.property_id, count(*)::int AS n
                  FROM guest_stays s JOIN rooms r ON r.id = s.room_id
                 WHERE s.lifecycle = 'open' AND ${where(sql`r.property_id`)}
                 GROUP BY r.property_id`,
          )),
          ...(await counted(
            'booking_upcoming',
            'A booking arrives today or later.',
            sql`SELECT rt.property_id, count(*)::int AS n
                  FROM bookings b
                  JOIN room_types rt ON rt.id = b.room_type_id
                  JOIN properties p ON p.id = rt.property_id
                 WHERE b.status IN ('pending_approval', 'confirmed')
                   AND b.check_in >= (now() AT TIME ZONE p.timezone)::date
                   AND ${where(sql`rt.property_id`)}
                 GROUP BY rt.property_id`,
          )),
          ...(await counted(
            'folio_open',
            'A bill is still open.',
            sql`SELECT f.property_id, count(*)::int AS n
                  FROM folios f
                 WHERE f.status <> 'closed' AND ${where(sql`f.property_id`)}
                 GROUP BY f.property_id`,
          )),
        ];
      case 'outlets':
        return this.serviceOrdersOpen(counted, where);
      case 'pos':
        return [
          ...(await this.serviceOrdersOpen(counted, where)),
          ...(await counted(
            'pos_order_open',
            'A till order is not finished.',
            sql`SELECT ot.property_id, count(*)::int AS n
                  FROM pos_orders o JOIN outlets ot ON ot.id = o.outlet_id
                 WHERE o.status NOT IN ('completed', 'cancelled') AND ${atOutlet()}
                 GROUP BY ot.property_id`,
          )),
          ...(await counted(
            'table_session_open',
            'A table is still seated.',
            sql`SELECT ot.property_id, count(*)::int AS n
                  FROM table_sessions ts JOIN outlets ot ON ot.id = ts.outlet_id
                 WHERE ts.status = 'open' AND ${atOutlet()}
                 GROUP BY ot.property_id`,
          )),
          ...(await counted(
            'cashier_shift_open',
            'A cashier shift is still open.',
            sql`SELECT ot.property_id, count(*)::int AS n
                  FROM cashier_shifts cs JOIN outlets ot ON ot.id = cs.outlet_id
                 WHERE cs.status = 'open' AND ${atOutlet()}
                 GROUP BY ot.property_id`,
          )),
        ];
      case 'hr':
        return counted(
          'pay_run_draft',
          'A pay run is still a draft.',
          sql`SELECT NULL::uuid AS property_id, count(*)::int AS n
                FROM pay_runs WHERE org_id = ${input.orgId} AND status = 'draft'`,
        );
      case 'residence':
        // Every status that holds a unit for a tenant: waiting for a signature,
        // signed and not yet started, running, or serving its notice.
        return counted(
          'lease_holds_unit',
          'A lease holds a unit.',
          sql`SELECT l.property_id, count(*)::int AS n
                FROM leases l
               WHERE l.org_id = ${input.orgId}
                 AND l.status IN ('pending_signature', 'signed', 'active', 'ending')
                 AND ${where(sql`l.property_id`)}
               GROUP BY l.property_id`,
        );
      // Pay and Marketplace are business level, so no branch is ever named:
      // the whole business's work counts.
      case 'pay':
        return counted(
          'payout_pending',
          'A payout has not gone out yet.',
          sql`SELECT NULL::uuid AS property_id, count(*)::int AS n
                FROM payouts
               WHERE workspace_id IN (SELECT id FROM workspaces WHERE org_id = ${input.orgId})
                 AND status IN ('scheduled', 'queued')`,
        );
      case 'marketplace':
        // A landlord marks a broker's fee paid on the lease, behind Marketplace,
        // so the product stays on until no fee is owed.
        return [
          ...(await counted(
            'placement_open',
            "A broker's placement is still open.",
            sql`SELECT u.property_id, count(*)::int AS n
                  FROM tenant_placements tp LEFT JOIN rental_units u ON u.id = tp.unit_id
                 WHERE tp.landlord_org_id = ${input.orgId} AND tp.status = 'initiated'
                 GROUP BY u.property_id`,
          )),
          ...(await counted(
            'placement_fee_pending',
            "A broker's fee is still owed.",
            sql`SELECT l.property_id, count(*)::int AS n
                  FROM placement_fees pf JOIN leases l ON l.id = pf.lease_id
                 WHERE l.org_id = ${input.orgId} AND pf.status = 'pending'
                 GROUP BY l.property_id`,
          )),
        ];
      default:
        return [];
    }
  }

  /** A service order not finished, the open work Outlets and POS share. */
  private serviceOrdersOpen(
    counted: (kind: ProductInUseReason['kind'], message: string, query: SQL) => Promise<ProductInUseReason[]>,
    where: (column: SQL) => SQL,
  ): Promise<ProductInUseReason[]> {
    return counted(
      'order_open',
      'A service order is not finished.',
      sql`SELECT coalesce(o.property_id, ot.property_id) AS property_id, count(*)::int AS n
            FROM service_orders o
            LEFT JOIN outlets ot ON ot.id = o.outlet_id
           WHERE o.status NOT IN ('completed', 'cancelled', 'rejected', 'payment_failed')
             AND ${where(sql`coalesce(o.property_id, ot.property_id)`)}
           GROUP BY coalesce(o.property_id, ot.property_id)`,
    );
  }

  /** The business's active owner (one, from slice R on; possibly two before it), with address and language. */
  async owners(tx: Tx, orgId: string): Promise<OwnerRecipient[]> {
    return tx
      .select({
        userId: orgMemberships.userId,
        email: users.email,
        locale: sql<string>`coalesce(${userProfiles.locale}, 'en')`,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .leftJoin(userProfiles, eq(userProfiles.userId, orgMemberships.userId))
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.orgRole, 'owner'),
          eq(orgMemberships.status, 'active'),
        ),
      );
  }

  /** The in app notice, in the transaction of the change it reports. */
  async notify(
    tx: Tx,
    input: { userId: string; workspaceId: string | null; title: string; body: string },
  ): Promise<void> {
    await tx.insert(notifications).values({
      userId: input.userId,
      workspaceId: input.workspaceId,
      category: 'system',
      channel: 'in_app',
      title: input.title,
      body: input.body,
      isTransactional: true,
      deliveryStatus: 'sent',
    });
  }
}
