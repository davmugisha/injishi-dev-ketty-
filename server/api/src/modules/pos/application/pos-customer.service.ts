import {
  CUSTOMER_SEARCH_MIN,
  maskCustomerEmail,
  maskCustomerPhone,
  normaliseGuestPhone,
  type AttachCustomerRequest,
  type CreateCustomerRequest,
  type CustomerExport,
  type CustomerList,
  type CustomerListQuery,
  type CustomerOrderRow,
  type CustomerProfile,
  type CustomerSource,
  type CustomerSummary,
  type EraseCustomerRequest,
  type MergeCustomersRequest,
  type PosOrder,
  type UpdateCustomerRequest,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';

import {
  customers,
  outlets,
  posAuditEvents,
  posOrders,
  restaurantTables,
  tableSessions,
} from '../../../database/drizzle/schema';
import { inBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { presentOrder } from '../infrastructure/pos-present';
import { audit, orderEvent, orderInScope, type Tx } from '../infrastructure/pos-support';

type CustomerRow = typeof customers.$inferSelect;

/** A customer's own orders, newest first, as far as the profile lists them. */
const PROFILE_ORDERS = 50;

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
}

/** Escape the characters LIKE treats as wildcards, so a search for "50%" finds "50%" and not everything. */
function likeEscape(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/**
 * Customers of the bar and restaurant (CRM, phase 1).
 *
 * The rules, so no caller repeats them:
 *  - A customer belongs to the BUSINESS. Every query filters by `workspace_id`, and a customer of another
 *    business is a 404, never a 403 that confirms it exists.
 *  - The PHONE is the key. It arrives normalised to E.164 (the request schema does it) and is unique among a
 *    business's active customers; a second registration of the same number is a 409 that names the customer
 *    already holding it, so the screen can offer "use that one".
 *  - What a reader sees depends on `customer.manage`. Without it the phone and email are masked, the book
 *    cannot be listed (a look-up needs `CUSTOMER_SEARCH_MIN` characters), and the look-up matches a name or a
 *    COMPLETE phone number only: matching on part of a masked number would let a search recover it digit by digit.
 *  - Visits and spend are counted from the customer's completed orders, at the outlets the reader's branch scope
 *    covers. Nothing is stored, so there is no counter to drift.
 *  - Nothing is deleted. A duplicate is MERGED into the right customer (its orders move), and a person's details
 *    are ERASED in place (orders and money stay, anonymised). Both are audited.
 *  - An audit row never holds a name, phone, email or note: it names the fields that changed, so erasing a
 *    customer really does leave nothing personal behind.
 */
@Injectable()
export class PosCustomerService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private has(ws: ScopedWorkspace, permission: string): boolean {
    return (ws.permissions as readonly string[]).includes(permission);
  }

  /** Reading full contact details needs `customer.manage`; everyone else sees them masked. */
  private contactHidden(ws: ScopedWorkspace): boolean {
    return !this.has(ws, 'customer.manage');
  }

  // ── Reading ──────────────────────────────────────────────────────────────────────────────────────

  /** `(select …)` for the three numbers a list row and a profile both carry, counted at the outlets in scope. */
  private stats(ws: ScopedWorkspace): { visits: SQL<number>; spend: SQL<number>; last: SQL<Date | null> } {
    const scope = inBranchScope(sql`o.property_id`, ws.branchScope);
    const from = sql`from pos_orders o where o.customer_id = ${customers.id} and o.workspace_id = ${customers.workspaceId} and o.status = 'completed' and ${scope}`;
    return {
      visits: sql<number>`(select count(*)::int ${from})`,
      spend: sql<number>`(select coalesce(sum(o.total_rwf), 0)::bigint ${from})`,
      last: sql<Date | null>`(select max(o.completed_at) ${from})`,
    };
  }

  private summaryOf(
    ws: ScopedWorkspace,
    row: CustomerRow,
    stats: { visitCount: number; lifetimeSpendRwf: number; lastVisitAt: Date | string | null },
  ): CustomerSummary {
    const hidden = this.contactHidden(ws);
    const last = stats.lastVisitAt ? new Date(stats.lastVisitAt) : null;
    return {
      id: row.id,
      fullName: row.fullName,
      phone: hidden ? maskCustomerPhone(row.phoneE164) : row.phoneE164,
      email: row.email ? (hidden ? maskCustomerEmail(row.email) : row.email) : null,
      contactHidden: hidden,
      marketingConsent: row.marketingConsent,
      source: row.source as CustomerSource,
      visitCount: stats.visitCount,
      lifetimeSpendRwf: stats.lifetimeSpendRwf,
      lastVisitAt: last ? last.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(ws: ScopedWorkspace, query: CustomerListQuery): Promise<CustomerList> {
    const hidden = this.contactHidden(ws);
    const q = (query.q ?? '').trim();
    const empty = (searchRequired: boolean): CustomerList => ({
      customers: [],
      total: 0,
      limit: query.limit,
      offset: query.offset,
      searchRequired,
      contactHidden: hidden,
    });
    // A role that may look customers up but not browse them must type something worth searching for.
    if (hidden && q.length < CUSTOMER_SEARCH_MIN) return empty(true);

    const where: SQL[] = [eq(customers.workspaceId, ws.workspaceId), eq(customers.status, 'active')];
    if (q) {
      const asPhone = normaliseGuestPhone(q);
      const name = ilike(customers.fullName, `%${likeEscape(q)}%`);
      if (asPhone) {
        // A whole, valid number: an exact match, and the same for everybody.
        where.push(eq(customers.phoneE164, asPhone));
      } else if (hidden) {
        // Name only: a partial number or an email fragment would let a masked field be recovered by search.
        where.push(name);
      } else {
        const digits = q.replace(/\D/g, '');
        const parts: SQL[] = [name, ilike(customers.email, `%${likeEscape(q)}%`)];
        if (digits.length >= CUSTOMER_SEARCH_MIN && /^[\d\s\-+().]+$/.test(q)) {
          parts.push(sql`${customers.phoneE164} like ${`%${digits}%`}`);
        }
        where.push(or(...parts) as SQL);
      }
    }

    const st = this.stats(ws);
    const rows = await this.db
      .select({
        row: customers,
        visitCount: st.visits,
        lifetimeSpendRwf: st.spend,
        lastVisitAt: st.last,
      })
      .from(customers)
      .where(and(...where))
      .orderBy(sql`${st.last} desc nulls last`, desc(customers.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    const [{ value: total }] = await this.db.select({ value: count() }).from(customers).where(and(...where));
    return {
      customers: rows.map((r) =>
        this.summaryOf(ws, r.row, {
          visitCount: Number(r.visitCount),
          lifetimeSpendRwf: Number(r.lifetimeSpendRwf),
          lastVisitAt: r.lastVisitAt,
        }),
      ),
      total,
      limit: query.limit,
      offset: query.offset,
      searchRequired: false,
      contactHidden: hidden,
    };
  }

  async get(ws: ScopedWorkspace, id: string): Promise<CustomerProfile> {
    return this.profile(this.db, ws, id);
  }

  private async profile(db: Database | Tx, ws: ScopedWorkspace, id: string): Promise<CustomerProfile> {
    const st = this.stats(ws);
    const [found] = await db
      .select({ row: customers, visitCount: st.visits, lifetimeSpendRwf: st.spend, lastVisitAt: st.last })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.workspaceId, ws.workspaceId), eq(customers.status, 'active')))
      .limit(1);
    if (!found) throw new NotFoundException('That customer was not found.');
    const orders = await db
      .select({
        orderId: posOrders.id,
        orderNumber: posOrders.orderNumber,
        outletName: outlets.name,
        orderType: posOrders.orderType,
        tableLabel: restaurantTables.label,
        status: posOrders.status,
        totalRwf: posOrders.totalRwf,
        createdAt: posOrders.createdAt,
      })
      .from(posOrders)
      .innerJoin(outlets, eq(outlets.id, posOrders.outletId))
      .leftJoin(tableSessions, eq(tableSessions.id, posOrders.tableSessionId))
      .leftJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
      .where(
        and(
          eq(posOrders.customerId, id),
          eq(posOrders.workspaceId, ws.workspaceId),
          ne(posOrders.status, 'draft'),
          inBranchScope(posOrders.propertyId, ws.branchScope),
        ),
      )
      .orderBy(desc(posOrders.createdAt))
      .limit(PROFILE_ORDERS);
    const summary = this.summaryOf(ws, found.row, {
      visitCount: Number(found.visitCount),
      lifetimeSpendRwf: Number(found.lifetimeSpendRwf),
      lastVisitAt: found.lastVisitAt,
    });
    return {
      ...summary,
      notes: found.row.notes,
      consentAt: iso(found.row.consentAt),
      consentSource: found.row.consentSource,
      phoneVerifiedAt: iso(found.row.phoneVerifiedAt),
      status: 'active',
      orders: orders.map(
        (o): CustomerOrderRow => ({
          orderId: o.orderId,
          orderNumber: o.orderNumber,
          outletName: o.outletName,
          orderType: o.orderType,
          tableLabel: o.tableLabel,
          status: o.status,
          totalRwf: o.totalRwf,
          createdAt: o.createdAt.toISOString(),
        }),
      ),
    };
  }

  // ── Writing ──────────────────────────────────────────────────────────────────────────────────────

  /** The 409 for a phone already held: it names who holds it, because the person registering may use that record. */
  private async phoneTaken(ws: ScopedWorkspace, phone: string): Promise<ConflictException> {
    const [existing] = await this.db
      .select({ id: customers.id, fullName: customers.fullName })
      .from(customers)
      .where(and(eq(customers.workspaceId, ws.workspaceId), eq(customers.phoneE164, phone), eq(customers.status, 'active')))
      .limit(1);
    return new ConflictException({
      message: existing
        ? `${existing.fullName} is already registered with this phone number.`
        : 'This phone number is already registered.',
      code: 'CUSTOMER_PHONE_EXISTS',
      customerId: existing?.id ?? null,
    });
  }

  async create(ws: ScopedWorkspace, body: CreateCustomerRequest, userId: string): Promise<CustomerProfile> {
    const now = new Date();
    try {
      const id = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(customers)
          .values({
            workspaceId: ws.workspaceId,
            fullName: body.fullName,
            phoneE164: body.phone,
            email: body.email ?? null,
            marketingConsent: body.marketingConsent,
            consentAt: body.marketingConsent ? now : null,
            consentSource: body.marketingConsent ? 'pos_staff' : null,
            source: 'pos',
            notes: body.notes ?? null,
            createdByUserId: userId,
          })
          .returning({ id: customers.id });
        await audit(tx, {
          workspaceId: ws.workspaceId,
          outletId: null,
          actorUserId: userId,
          action: 'customer.created',
          entityType: 'customer',
          entityId: row.id,
          after: { phone: maskCustomerPhone(body.phone), hasEmail: Boolean(body.email), marketingConsent: body.marketingConsent },
        });
        return row.id;
      });
      return await this.get(ws, id);
    } catch (error) {
      if (isUniqueViolation(error)) throw await this.phoneTaken(ws, body.phone);
      throw error;
    }
  }

  async update(ws: ScopedWorkspace, id: string, body: UpdateCustomerRequest, userId: string): Promise<CustomerProfile> {
    try {
      await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, id), eq(customers.workspaceId, ws.workspaceId), eq(customers.status, 'active')))
          .limit(1)
          .for('update');
        if (!current) throw new NotFoundException('That customer was not found.');
        const patch: Partial<typeof customers.$inferInsert> = {};
        const changed: string[] = [];
        if (body.fullName !== undefined && body.fullName !== current.fullName) {
          patch.fullName = body.fullName;
          changed.push('fullName');
        }
        if (body.phone !== undefined && body.phone !== current.phoneE164) {
          patch.phoneE164 = body.phone;
          // A different number is a number nobody has proved yet.
          patch.phoneVerifiedAt = null;
          changed.push('phone');
        }
        if (body.email !== undefined && body.email !== current.email) {
          patch.email = body.email;
          changed.push('email');
        }
        if (body.notes !== undefined && body.notes !== current.notes) {
          patch.notes = body.notes;
          changed.push('notes');
        }
        if (body.marketingConsent !== undefined && body.marketingConsent !== current.marketingConsent) {
          patch.marketingConsent = body.marketingConsent;
          patch.consentAt = new Date();
          patch.consentSource = 'pos_staff';
          changed.push('marketingConsent');
        }
        if (changed.length === 0) return;
        await tx
          .update(customers)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(customers.id, id), eq(customers.workspaceId, ws.workspaceId)));
        await audit(tx, {
          workspaceId: ws.workspaceId,
          outletId: null,
          actorUserId: userId,
          action: 'customer.updated',
          entityType: 'customer',
          entityId: id,
          after: { fields: changed },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error) && body.phone) throw await this.phoneTaken(ws, body.phone);
      throw error;
    }
    return this.get(ws, id);
  }

  /** Fold the duplicate `id` into `body.intoCustomerId`: its orders move, and it stops being listed. */
  async merge(ws: ScopedWorkspace, id: string, body: MergeCustomersRequest, userId: string): Promise<CustomerProfile> {
    if (id === body.intoCustomerId) throw new ConflictException('A customer cannot be merged into itself.');
    await this.db.transaction(async (tx) => {
      // Both rows are locked in a fixed order, so two people merging the same pair cannot deadlock.
      const locked = await tx
        .select()
        .from(customers)
        .where(
          and(
            inArray(customers.id, [id, body.intoCustomerId]),
            eq(customers.workspaceId, ws.workspaceId),
            eq(customers.status, 'active'),
          ),
        )
        .orderBy(customers.id)
        .for('update');
      const from = locked.find((c) => c.id === id);
      const into = locked.find((c) => c.id === body.intoCustomerId);
      if (!from || !into) throw new NotFoundException('That customer was not found.');
      const moved = await tx
        .update(posOrders)
        .set({ customerId: into.id })
        .where(and(eq(posOrders.customerId, from.id), eq(posOrders.workspaceId, ws.workspaceId)))
        .returning({ id: posOrders.id });
      // The survivor keeps what it has and learns what only the duplicate knew.
      const gain: Partial<typeof customers.$inferInsert> = {};
      if (!into.email && from.email) gain.email = from.email;
      await tx
        .update(customers)
        .set({ status: 'merged', mergedIntoId: into.id, updatedAt: new Date() })
        .where(eq(customers.id, from.id));
      if (Object.keys(gain).length > 0) {
        await tx.update(customers).set({ ...gain, updatedAt: new Date() }).where(eq(customers.id, into.id));
      }
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: null,
        actorUserId: userId,
        action: 'customer.merged',
        entityType: 'customer',
        entityId: into.id,
        after: { mergedFrom: from.id, ordersMoved: moved.length },
        reason: body.reason,
      });
    });
    return this.get(ws, body.intoCustomerId);
  }

  /** Remove a person's details in place. Orders and money stay, and now name an "Erased customer". */
  async erase(ws: ScopedWorkspace, id: string, body: EraseCustomerRequest, userId: string): Promise<{ erased: true }> {
    await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.workspaceId, ws.workspaceId), ne(customers.status, 'erased')))
        .limit(1)
        .for('update');
      if (!current) throw new NotFoundException('That customer was not found.');
      // Duplicates that were folded into this customer hold the same person's details: they go too.
      const group = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.workspaceId, ws.workspaceId),
            ne(customers.status, 'erased'),
            or(eq(customers.id, id), eq(customers.mergedIntoId, id)),
          ),
        );
      const now = new Date();
      for (const member of group) {
        await tx
          .update(customers)
          .set({
            fullName: 'Erased customer',
            phoneE164: `erased:${member.id}`,
            phoneVerifiedAt: null,
            email: null,
            notes: null,
            marketingConsent: false,
            consentAt: null,
            consentSource: null,
            status: 'erased',
            mergedIntoId: null,
            erasedAt: now,
            updatedAt: now,
          })
          .where(eq(customers.id, member.id));
      }
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: null,
        actorUserId: userId,
        action: 'customer.erased',
        entityType: 'customer',
        entityId: id,
        after: { recordsErased: group.length },
        reason: body.reason,
      });
    });
    return { erased: true };
  }

  /** Everything held about one customer, unmasked, for the person who asks to see it. */
  async export(ws: ScopedWorkspace, id: string, userId: string): Promise<CustomerExport> {
    if (this.contactHidden(ws)) throw new ForbiddenException('Exporting a customer needs permission to manage customers.');
    const customer = await this.get(ws, id);
    const trail = await this.db
      .select({ action: posAuditEvents.action, at: posAuditEvents.occurredAt, reason: posAuditEvents.reason })
      .from(posAuditEvents)
      .where(
        and(
          eq(posAuditEvents.workspaceId, ws.workspaceId),
          eq(posAuditEvents.entityType, 'customer'),
          eq(posAuditEvents.entityId, id),
        ),
      )
      .orderBy(desc(posAuditEvents.occurredAt));
    await this.db.transaction((tx) =>
      audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: null,
        actorUserId: userId,
        action: 'customer.exported',
        entityType: 'customer',
        entityId: id,
      }),
    );
    return {
      exportedAt: new Date().toISOString(),
      customer,
      audit: trail.map((t) => ({ action: t.action, at: t.at.toISOString(), reason: t.reason })),
    };
  }

  // ── On a bill ────────────────────────────────────────────────────────────────────────────────────

  /** Put a customer on an order, or take them off it. The order is read through its branch scope. */
  async attach(ws: ScopedWorkspace, orderId: string, body: AttachCustomerRequest, userId: string): Promise<PosOrder> {
    if (!this.has(ws, 'customer.view') && !this.has(ws, 'customer.manage')) {
      throw new ForbiddenException('You need permission to find customers to put one on a bill.');
    }
    await this.db.transaction(async (tx) => {
      const order = await orderInScope(tx, ws, orderId, true);
      if (order.status === 'cancelled') throw new ConflictException('A cancelled order cannot take a customer.');
      if (order.customerId === body.customerId) return;
      if (body.customerId) {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(eq(customers.id, body.customerId), eq(customers.workspaceId, ws.workspaceId), eq(customers.status, 'active')),
          )
          .limit(1);
        if (!customer) throw new NotFoundException('That customer was not found.');
      }
      await tx
        .update(posOrders)
        .set({ customerId: body.customerId, updatedAt: new Date() })
        .where(eq(posOrders.id, order.id));
      await orderEvent(tx, {
        orderId: order.id,
        kind: body.customerId ? 'customer.attached' : 'customer.detached',
        actorUserId: userId,
        data: { customerId: body.customerId ?? order.customerId },
      });
      await audit(tx, {
        workspaceId: ws.workspaceId,
        outletId: order.outletId,
        actorUserId: userId,
        action: body.customerId ? 'customer.attached' : 'customer.detached',
        entityType: 'order',
        entityId: order.id,
        after: { customerId: body.customerId },
      });
    });
    return presentOrder(this.db, await orderInScope(this.db, ws, orderId));
  }
}
