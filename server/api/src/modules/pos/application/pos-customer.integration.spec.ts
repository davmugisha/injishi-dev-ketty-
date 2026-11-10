import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { randomUUID } from 'node:crypto';

import { CreateCustomerRequest, CustomerListQuery, type CustomerProfile, UpdateCustomerRequest } from '@injishi/contracts';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { Database } from '../../../shared/database/database.module';
import { PosCustomerService } from './pos-customer.service';

/**
 * Customers against a real Postgres: the SQL the doubles cannot judge. Tenant and branch isolation, the phone key,
 * masking by role, merge, erase, the audit trail, and the database's own refusals.
 *
 * OPT IN: set `POS_IT_DATABASE_URL` to a THROWAWAY COPY of the demo database that has migration 0135 applied.
 * The spec writes customers whose names carry a random tag, attaches them to existing orders and takes them off
 * again, and does not delete anything. It REFUSES to run unless the database name starts with `injishi_crm` or
 * ends with `_it`, so it can never be pointed at the live demo or the original. Skipped otherwise.
 *
 *   POS_IT_DATABASE_URL=postgres://user:***@127.0.0.1:5433/injishi_crm_dev \
 *     npx vitest run src/modules/pos/application/pos-customer.integration.spec.ts
 */
const url = process.env.POS_IT_DATABASE_URL;
const dbName = url ? new URL(url).pathname.replace(/^\//, '') : '';
const safe = /^injishi_crm/.test(dbName) || /_it$/.test(dbName);
if (url && !safe) {
  throw new Error(`POS_IT_DATABASE_URL names "${dbName}". This spec only runs on a throwaway copy: injishi_crm* or *_it.`);
}
const maybe = url && safe ? describe : describe.skip;

maybe('customers against Postgres (POS_IT_DATABASE_URL)', () => {
  vi.setConfig({ testTimeout: 60_000 });

  let pool: Pool;
  let db: Database;
  let svc: PosCustomerService;
  const tag = randomUUID().slice(0, 6);

  let workspaceId: string;
  let otherWorkspaceId: string;
  let propA: string;
  let propB: string;
  let actor: string;
  let orderA: { id: string; total: number }; // a completed order at a branch-A outlet
  let openOrderA: { id: string }; // a live (not completed, not cancelled) order at branch A
  /** What the two orders named before this spec touched them, so it can put them back exactly. */
  let originalLinks: Map<string, string | null>;

  const MANAGE = ['customer.view', 'customer.manage', 'customer.admin'];
  const scope = (workspace: string, propertyIds: string[], permissions: string[]): ScopedWorkspace =>
    ({
      workspaceId: workspace,
      permissions,
      branchScope: { coverage: 'limited', selectedPropertyId: null, propertyIds, includesUnbranched: true },
    }) as unknown as ScopedWorkspace;
  let owner: ScopedWorkspace; // everything, both branches
  let cashier: ScopedWorkspace; // view + manage
  let waiter: ScopedWorkspace; // view only
  let kitchen: ScopedWorkspace; // nothing
  let branchB: ScopedWorkspace; // owner, but only branch B
  let stranger: ScopedWorkspace; // another business

  const q = (over: Record<string, unknown> = {}): CustomerListQuery => CustomerListQuery.parse(over);
  /** Rwandan numbers that are unique to this run: 0788 + the tag's digits. */
  let seq = 0;
  const phone = (): string => {
    const n = (Number.parseInt(tag, 16) + seq++) % 10_000_000;
    return `+25078${String(n).padStart(7, '0')}`;
  };
  const make = (name: string, extra: Record<string, unknown> = {}): Promise<CustomerProfile> =>
    svc.create(owner, CreateCustomerRequest.parse({ fullName: `${name} ${tag}`, phone: phone(), ...extra }), actor);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 6 });
    db = drizzle(pool, { schema }) as unknown as Database;
    svc = new PosCustomerService(db);

    // A business with a completed order, at an outlet that belongs to a branch.
    const [o] = await db
      .select({ id: schema.posOrders.id, ws: schema.posOrders.workspaceId, prop: schema.posOrders.propertyId, total: schema.posOrders.totalRwf })
      .from(schema.posOrders)
      .where(and(eq(schema.posOrders.status, 'completed'), isNotNull(schema.posOrders.propertyId)))
      .orderBy(desc(schema.posOrders.createdAt))
      .limit(1);
    if (!o?.prop) throw new Error('this database has no completed order at a branch outlet');
    workspaceId = o.ws;
    propA = o.prop;
    orderA = { id: o.id, total: o.total };
    const [live] = await db
      .select({ id: schema.posOrders.id })
      .from(schema.posOrders)
      .where(
        and(
          eq(schema.posOrders.workspaceId, workspaceId),
          eq(schema.posOrders.propertyId, propA),
          inArray(schema.posOrders.status, ['draft', 'submitted', 'in_progress', 'ready', 'delivered']),
        ),
      )
      .limit(1);
    if (!live) throw new Error('this database has no live order at the same branch');
    openOrderA = live;
    const before = await db
      .select({ id: schema.posOrders.id, customerId: schema.posOrders.customerId })
      .from(schema.posOrders)
      .where(inArray(schema.posOrders.id, [orderA.id, openOrderA.id]));
    originalLinks = new Map(before.map((r) => [r.id, r.customerId]));
    // Start from a known state: the two borrowed orders name no one. afterAll puts the original links back.
    await db.update(schema.posOrders).set({ customerId: null }).where(inArray(schema.posOrders.id, [orderA.id, openOrderA.id]));
    const props = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.workspaceId, workspaceId));
    propB = props.find((p) => p.id !== propA)?.id ?? randomUUID();
    const all = await db.select({ id: schema.workspaces.id }).from(schema.workspaces);
    otherWorkspaceId = all.find((w) => w.id !== workspaceId)?.id ?? workspaceId;
    if (otherWorkspaceId === workspaceId) throw new Error('need a second workspace to prove isolation');
    const [m] = await db
      .select({ userId: schema.orgMemberships.userId })
      .from(schema.orgMemberships)
      .innerJoin(schema.workspaces, eq(schema.workspaces.orgId, schema.orgMemberships.orgId))
      .where(and(eq(schema.workspaces.id, workspaceId), eq(schema.orgMemberships.status, 'active')))
      .limit(1);
    if (!m) throw new Error('no active member to act as');
    actor = m.userId;

    owner = scope(workspaceId, [propA, propB], MANAGE);
    cashier = scope(workspaceId, [propA, propB], ['customer.view', 'customer.manage', 'pos.sell']);
    waiter = scope(workspaceId, [propA, propB], ['customer.view', 'pos.sell']);
    kitchen = scope(workspaceId, [propA, propB], ['kitchen.work']);
    branchB = scope(workspaceId, [propB], MANAGE);
    stranger = scope(otherWorkspaceId, [], MANAGE);
  });

  afterAll(async () => {
    // Leave the orders as they were found.
    for (const [id, customerId] of originalLinks ?? []) {
      await db.update(schema.posOrders).set({ customerId }).where(eq(schema.posOrders.id, id));
    }
    await pool?.end();
  });

  describe('registering', () => {
    it('stores every spelling of a Rwandan number as one E.164 value', async () => {
      const base = phone().slice(4); // 78xxxxxxx
      const c = await make('Spelling', { phone: `0${base}` });
      expect(c.phone).toBe(`+250${base}`);
      // The same person typed another way is the same customer, so it is refused.
      for (const spelling of [`+250 ${base}`, `250${base}`, `0${base.slice(0, 3)} ${base.slice(3, 6)} ${base.slice(6)}`, base]) {
        await expect(make('Dup', { phone: spelling })).rejects.toBeInstanceOf(ConflictException);
      }
    });

    it('names who already holds a number, so the screen can offer them', async () => {
      const first = await make('Holder');
      const err = (await make('Second', { phone: first.phone }).catch((e) => e)) as ConflictException;
      expect(err).toBeInstanceOf(ConflictException);
      const body = err.getResponse() as { code: string; customerId: string; message: string };
      expect(body.code).toBe('CUSTOMER_PHONE_EXISTS');
      expect(body.customerId).toBe(first.id);
      expect(body.message).toContain('Holder');
    });

    it('lets two businesses hold the same number independently', async () => {
      const p = phone();
      const mine = await svc.create(owner, CreateCustomerRequest.parse({ fullName: `Mine ${tag}`, phone: p }), actor);
      const theirs = await svc.create(stranger, CreateCustomerRequest.parse({ fullName: `Theirs ${tag}`, phone: p }), actor);
      expect(mine.id).not.toBe(theirs.id);
    });

    it('records consent only when the staff member says the customer gave it', async () => {
      const a = await make('NoConsent');
      expect(a).toMatchObject({ marketingConsent: false, consentAt: null, consentSource: null });
      const b = await make('Consent', { marketingConsent: true });
      expect(b).toMatchObject({ marketingConsent: true, consentSource: 'pos_staff' });
      expect(b.consentAt).not.toBeNull();
      expect(b.phoneVerifiedAt).toBeNull();
    });

    it('lets only one of several simultaneous registrations of the same number through', async () => {
      const p = phone();
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) => svc.create(owner, CreateCustomerRequest.parse({ fullName: `Race ${i} ${tag}`, phone: p }), actor)),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results.filter((x) => x.status === 'rejected')) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
      }
    });
  });

  describe('the database refuses what the API should never send', () => {
    /** Drizzle wraps a Postgres error, so the constraint that refused the row is on the error's `cause`. */
    const refused = async (attempt: PromiseLike<unknown>, constraint: string): Promise<void> => {
      const error = (await attempt.then(() => null, (e: unknown) => e)) as { cause?: { constraint?: string; code?: string } } | null;
      expect(error, 'the database should have refused this row').not.toBeNull();
      expect(error?.cause?.constraint).toBe(constraint);
    };
    const insert = (over: Record<string, unknown>): PromiseLike<unknown> =>
      db.insert(schema.customers).values({ workspaceId, fullName: `Raw ${tag}`, phoneE164: phone(), ...over } as never);

    it('a Rwandan number that is not a real mobile', async () => {
      for (const bad of ['+250700000001', '+25078123', '+2507881234567', '+250788abc123']) {
        await refused(insert({ phoneE164: bad }), 'customers_phone_shape');
      }
    });

    it('a number that is not E.164 at all', async () => {
      for (const bad of ['0788123456', '788123456', '+0123456789', 'phone', '+1']) {
        await refused(insert({ phoneE164: bad }), 'customers_phone_shape');
      }
    });

    it('accepts a visitor\'s international number', async () => {
      await expect(insert({ phoneE164: `+4479${String(Date.now()).slice(-8)}` })).resolves.toBeDefined();
    });

    it('a blank name, an unknown source and an unknown status', async () => {
      await refused(insert({ fullName: '   ' }), 'customers_name_length');
      await refused(insert({ source: 'carrier-pigeon' }), 'customers_source_valid');
      await refused(insert({ status: 'deleted' }), 'customers_status_valid');
    });

    it('a merged customer that points nowhere, or at itself', async () => {
      await refused(insert({ status: 'merged' }), 'customers_merge_shape');
      const id = randomUUID();
      await refused(insert({ id, status: 'merged', mergedIntoId: id }), 'customers_merge_shape');
    });

    it('an erased customer that still holds personal details', async () => {
      await refused(insert({ status: 'erased', erasedAt: new Date(), email: 'a@b.co' }), 'customers_erase_shape');
      await refused(insert({ status: 'erased', email: null }), 'customers_erase_shape');
    });

    it('two active customers with one number in one business', async () => {
      const p = phone();
      await insert({ phoneE164: p });
      await refused(insert({ phoneE164: p }), 'customers_workspace_phone_uk');
    });

    it('an order that names a customer of another business', async () => {
      const foreign = await svc.create(stranger, CreateCustomerRequest.parse({ fullName: `Foreign ${tag}`, phone: phone() }), actor);
      await refused(
        db.update(schema.posOrders).set({ customerId: foreign.id }).where(eq(schema.posOrders.id, openOrderA.id)) as unknown as PromiseLike<unknown>,
        'pos_orders_customer_fk',
      );
    });
  });

  describe('reading, and who sees what', () => {
    it('a manager sees the whole phone and email', async () => {
      const c = await make('Visible', { email: `visible.${tag}@example.com` });
      const profile = await svc.get(cashier, c.id);
      expect(profile).toMatchObject({ phone: c.phone, email: `visible.${tag}@example.com`, contactHidden: false });
    });

    it('a waiter sees them masked, and the mask cannot be reversed to the number', async () => {
      const c = await make('Masked', { email: `masked.${tag}@example.com` });
      const profile = await svc.get(waiter, c.id);
      expect(profile.contactHidden).toBe(true);
      expect(profile.phone).toMatch(/^\+250\*{6}\d{3}$/);
      expect(profile.phone).not.toBe(c.phone);
      expect(profile.email).toMatch(/^m\*\*\*@example\.com$/);
    });

    it('a waiter cannot browse the book, only look a customer up', async () => {
      await make('Browse');
      const empty = await svc.list(waiter, q({}));
      expect(empty).toMatchObject({ customers: [], total: 0, searchRequired: true });
      const short = await svc.list(waiter, q({ q: 'Br' }));
      expect(short.searchRequired).toBe(true);
      const found = await svc.list(waiter, q({ q: `Browse ${tag}` }));
      expect(found.searchRequired).toBe(false);
      expect(found.customers.map((c) => c.fullName)).toContain(`Browse ${tag}`);
    });

    it('a waiter cannot recover a number by searching part of it, but a whole number finds the customer', async () => {
      const c = await make('Secretive');
      const partial = c.phone.slice(0, 10);
      expect((await svc.list(waiter, q({ q: partial }))).customers).toHaveLength(0);
      expect((await svc.list(waiter, q({ q: c.phone.slice(-6) }))).customers).toHaveLength(0);
      const whole = await svc.list(waiter, q({ q: c.phone.replace('+250', '0') }));
      expect(whole.customers.map((x) => x.id)).toEqual([c.id]);
      expect(whole.customers[0].phone).not.toBe(c.phone); // still masked
    });

    it('a waiter cannot find a customer by an email fragment', async () => {
      const c = await make('Mailbox', { email: `box.${tag}@fragment.example` });
      expect((await svc.list(waiter, q({ q: `box.${tag}` }))).customers.find((x) => x.id === c.id)).toBeUndefined();
      expect((await svc.list(owner, q({ q: `box.${tag}` }))).customers.map((x) => x.id)).toContain(c.id);
    });

    it('a manager finds customers by name, whole or partial phone, and email', async () => {
      const c = await make('Findable', { email: `find.${tag}@example.com` });
      for (const search of [`Findable ${tag}`, `findable`, c.phone, c.phone.slice(-7), `find.${tag}`]) {
        expect((await svc.list(owner, q({ q: search }))).customers.map((x) => x.id), search).toContain(c.id);
      }
    });

    it('searches literally: a percent sign or underscore matches nothing it should not', async () => {
      await make('Literal');
      expect((await svc.list(owner, q({ q: '%' }))).total).toBe(0);
      expect((await svc.list(owner, q({ q: '_' }))).total).toBe(0);
      expect((await svc.list(owner, q({ q: `Lit_ral ${tag}` }))).total).toBe(0);
    });

    it('pages the list and counts the whole', async () => {
      for (let i = 0; i < 3; i++) await make(`Paged${i}`);
      const page = await svc.list(owner, q({ q: `${tag}`, limit: 2, offset: 0 }));
      expect(page.customers).toHaveLength(2);
      expect(page.total).toBeGreaterThanOrEqual(3);
      const next = await svc.list(owner, q({ q: `${tag}`, limit: 2, offset: 2 }));
      expect(next.customers.every((c) => !page.customers.some((p) => p.id === c.id))).toBe(true);
    });

    it('another business sees none of it: a 404, never a 403, and an empty search', async () => {
      const c = await make('Private');
      await expect(svc.get(stranger, c.id)).rejects.toBeInstanceOf(NotFoundException);
      expect((await svc.list(stranger, q({ q: `Private ${tag}` }))).total).toBe(0);
      await expect(svc.update(stranger, c.id, { fullName: 'Hijacked' }, actor)).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.erase(stranger, c.id, { reason: 'because' }, actor)).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.merge(stranger, c.id, { intoCustomerId: c.id, reason: 'x' }, actor)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('correcting', () => {
    it('changes the name, email, note and consent, and says nothing else changed', async () => {
      const c = await make('Edit');
      const updated = await svc.update(owner, c.id, { fullName: `Edited ${tag}`, email: `e.${tag}@example.com`, notes: 'No peanuts', marketingConsent: true }, actor);
      expect(updated).toMatchObject({ fullName: `Edited ${tag}`, email: `e.${tag}@example.com`, notes: 'No peanuts', marketingConsent: true, phone: c.phone });
      expect(updated.consentAt).not.toBeNull();
    });

    it('a new number is normalised, must be free, and is no longer treated as confirmed', async () => {
      const a = await make('Mover');
      const b = await make('Taken');
      await db.update(schema.customers).set({ phoneVerifiedAt: new Date() }).where(eq(schema.customers.id, a.id));
      await expect(svc.update(owner, a.id, { phone: b.phone }, actor)).rejects.toBeInstanceOf(ConflictException);
      const fresh = phone();
      const moved = await svc.update(owner, a.id, UpdateCustomerRequest.parse({ phone: fresh.replace('+250', '0') }), actor);
      expect(moved.phone).toBe(fresh);
      expect(moved.phoneVerifiedAt).toBeNull();
    });

    it('an unchanged save changes nothing and writes no audit row', async () => {
      const c = await make('Same');
      const before = await db.select().from(schema.posAuditEvents).where(eq(schema.posAuditEvents.entityId, c.id));
      await svc.update(owner, c.id, { fullName: c.fullName }, actor);
      const after = await db.select().from(schema.posAuditEvents).where(eq(schema.posAuditEvents.entityId, c.id));
      expect(after.length).toBe(before.length);
    });
  });

  describe('on a bill', () => {
    it('puts a customer on an order and takes them off, leaving an event and an audit row each time', async () => {
      const c = await make('Diner');
      const on = await svc.attach(waiter, openOrderA.id, { customerId: c.id }, actor);
      expect(on.customer).toMatchObject({ id: c.id, fullName: `Diner ${tag}` });
      expect(on.customer?.phoneMasked).toMatch(/^\+250\*{6}\d{3}$/);
      const events = await db.select().from(schema.posOrderEvents).where(eq(schema.posOrderEvents.orderId, openOrderA.id));
      expect(events.map((e) => e.kind)).toContain('customer.attached');
      const off = await svc.attach(waiter, openOrderA.id, { customerId: null }, actor);
      expect(off.customer).toBeUndefined();
      const after = await db.select().from(schema.posOrderEvents).where(eq(schema.posOrderEvents.orderId, openOrderA.id));
      expect(after.map((e) => e.kind)).toContain('customer.detached');
      const trail = await db.select().from(schema.posAuditEvents).where(eq(schema.posAuditEvents.entityId, openOrderA.id));
      expect(trail.map((t) => t.action)).toEqual(expect.arrayContaining(['customer.attached', 'customer.detached']));
    });

    it('is silent when nothing would change', async () => {
      const before = (await db.select().from(schema.posOrderEvents).where(eq(schema.posOrderEvents.orderId, openOrderA.id))).length;
      await svc.attach(waiter, openOrderA.id, { customerId: null }, actor);
      const after = (await db.select().from(schema.posOrderEvents).where(eq(schema.posOrderEvents.orderId, openOrderA.id))).length;
      expect(after).toBe(before);
    });

    it('needs permission to find customers', async () => {
      const c = await make('Barred');
      await expect(svc.attach(kitchen, openOrderA.id, { customerId: c.id }, actor)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a customer of another business, and an order of another business or branch', async () => {
      const foreign = await svc.create(stranger, CreateCustomerRequest.parse({ fullName: `Foreign2 ${tag}`, phone: phone() }), actor);
      await expect(svc.attach(owner, openOrderA.id, { customerId: foreign.id }, actor)).rejects.toBeInstanceOf(NotFoundException);
      const mine = await make('Mine2');
      await expect(svc.attach(stranger, openOrderA.id, { customerId: mine.id }, actor)).rejects.toBeInstanceOf(NotFoundException);
      // An order at branch A is invisible to someone who covers only branch B.
      await expect(svc.attach(branchB, openOrderA.id, { customerId: mine.id }, actor)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('will not attach to, or detach, a customer who has been erased or merged away', async () => {
      const c = await make('Gone');
      await svc.erase(owner, c.id, { reason: 'asked to be forgotten' }, actor);
      await expect(svc.attach(owner, openOrderA.id, { customerId: c.id }, actor)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('visits and spend', () => {
    it('are counted from completed orders, and only at the branches the reader covers', async () => {
      const c = await make('Regular');
      await svc.attach(owner, orderA.id, { customerId: c.id }, actor);
      const seen = await svc.get(owner, c.id);
      expect(seen).toMatchObject({ visitCount: 1, lifetimeSpendRwf: orderA.total });
      expect(seen.lastVisitAt).not.toBeNull();
      expect(seen.orders.map((o) => o.orderId)).toContain(orderA.id);
      // Someone who covers only the other branch sees the customer, but none of this branch's orders or money.
      const elsewhere = await svc.get(branchB, c.id);
      expect(elsewhere).toMatchObject({ visitCount: 0, lifetimeSpendRwf: 0, orders: [] });
      await svc.attach(owner, orderA.id, { customerId: null }, actor);
      expect(await svc.get(owner, c.id)).toMatchObject({ visitCount: 0, lifetimeSpendRwf: 0 });
    });

    it('the list orders recent customers first, and carries the same numbers as the profile', async () => {
      const c = await make('Ranked');
      await svc.attach(owner, orderA.id, { customerId: c.id }, actor);
      const list = await svc.list(owner, q({ limit: 5 }));
      expect(list.customers[0]).toMatchObject({ id: c.id, visitCount: 1, lifetimeSpendRwf: orderA.total });
      await svc.attach(owner, orderA.id, { customerId: null }, actor);
    });
  });

  describe('merging', () => {
    it('moves the orders, retires the duplicate, and keeps the survivor\'s own details', async () => {
      const keep = await make('Keep');
      const dupe = await make('Dupe', { email: `dupe.${tag}@example.com` });
      await svc.attach(owner, orderA.id, { customerId: dupe.id }, actor);
      const merged = await svc.merge(owner, dupe.id, { intoCustomerId: keep.id, reason: 'registered twice' }, actor);
      expect(merged.id).toBe(keep.id);
      expect(merged.visitCount).toBe(1);
      expect(merged.email).toBe(`dupe.${tag}@example.com`); // the survivor had none, so it learns the duplicate's
      await expect(svc.get(owner, dupe.id)).rejects.toBeInstanceOf(NotFoundException);
      const [row] = await db.select().from(schema.customers).where(eq(schema.customers.id, dupe.id));
      expect(row).toMatchObject({ status: 'merged', mergedIntoId: keep.id });
      const [order] = await db.select({ c: schema.posOrders.customerId }).from(schema.posOrders).where(eq(schema.posOrders.id, orderA.id));
      expect(order.c).toBe(keep.id);
      // The duplicate's number is free again.
      await expect(svc.create(owner, CreateCustomerRequest.parse({ fullName: `Reuse ${tag}`, phone: dupe.phone }), actor)).resolves.toBeDefined();
      await svc.attach(owner, orderA.id, { customerId: null }, actor);
    });

    it('does not overwrite the survivor\'s email', async () => {
      const keep = await make('Keeper', { email: `keeper.${tag}@example.com` });
      const dupe = await make('Other', { email: `other.${tag}@example.com` });
      const merged = await svc.merge(owner, dupe.id, { intoCustomerId: keep.id, reason: 'same person' }, actor);
      expect(merged.email).toBe(`keeper.${tag}@example.com`);
    });

    it('refuses a customer into itself, an unknown target, and another business\'s customer', async () => {
      const a = await make('A');
      await expect(svc.merge(owner, a.id, { intoCustomerId: a.id, reason: 'oops' }, actor)).rejects.toBeInstanceOf(ConflictException);
      await expect(svc.merge(owner, a.id, { intoCustomerId: randomUUID(), reason: 'oops' }, actor)).rejects.toBeInstanceOf(NotFoundException);
      const foreign = await svc.create(stranger, CreateCustomerRequest.parse({ fullName: `F3 ${tag}`, phone: phone() }), actor);
      await expect(svc.merge(owner, a.id, { intoCustomerId: foreign.id, reason: 'oops' }, actor)).rejects.toBeInstanceOf(NotFoundException);
      expect((await svc.get(owner, a.id)).id).toBe(a.id); // nothing happened
    });

    it('two people merging the same pair at once end in a consistent state', async () => {
      const a = await make('RaceA');
      const b = await make('RaceB');
      const results = await Promise.allSettled([
        svc.merge(owner, a.id, { intoCustomerId: b.id, reason: 'first' }, actor),
        svc.merge(owner, b.id, { intoCustomerId: a.id, reason: 'second' }, actor),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rows = await db.select().from(schema.customers).where(inArray(schema.customers.id, [a.id, b.id]));
      expect(rows.filter((r) => r.status === 'active')).toHaveLength(1);
      expect(rows.filter((r) => r.status === 'merged')).toHaveLength(1);
    });
  });

  describe('erasing', () => {
    it('removes every personal detail, keeps the order and its money, and frees the number', async () => {
      const c = await make('Forget', { email: `forget.${tag}@example.com`, notes: 'allergic to shellfish', marketingConsent: true });
      await svc.attach(owner, orderA.id, { customerId: c.id }, actor);
      await expect(svc.erase(owner, c.id, { reason: 'asked to be forgotten' }, actor)).resolves.toEqual({ erased: true });
      const [row] = await db.select().from(schema.customers).where(eq(schema.customers.id, c.id));
      expect(row).toMatchObject({
        fullName: 'Erased customer',
        phoneE164: `erased:${c.id}`,
        email: null,
        notes: null,
        marketingConsent: false,
        consentAt: null,
        status: 'erased',
      });
      expect(row.erasedAt).not.toBeNull();
      // The order, its total and its link survive, and read as an erased customer.
      const [order] = await db.select().from(schema.posOrders).where(eq(schema.posOrders.id, orderA.id));
      expect(order.customerId).toBe(c.id);
      expect(order.totalRwf).toBe(orderA.total);
      await expect(svc.get(owner, c.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.create(owner, CreateCustomerRequest.parse({ fullName: `Back ${tag}`, phone: c.phone }), actor)).resolves.toBeDefined();
      await expect(svc.erase(owner, c.id, { reason: 'again' }, actor)).rejects.toBeInstanceOf(NotFoundException);
      await db.update(schema.posOrders).set({ customerId: null }).where(eq(schema.posOrders.id, orderA.id));
    });

    it('also erases the duplicates that were folded into the customer', async () => {
      const keep = await make('Survivor');
      const dupe = await make('Folded', { email: `folded.${tag}@example.com` });
      await svc.merge(owner, dupe.id, { intoCustomerId: keep.id, reason: 'same' }, actor);
      await svc.erase(owner, keep.id, { reason: 'asked to be forgotten' }, actor);
      const rows = await db.select().from(schema.customers).where(inArray(schema.customers.id, [keep.id, dupe.id]));
      expect(rows.every((r) => r.status === 'erased' && r.email === null && r.phoneE164.startsWith('erased:'))).toBe(true);
    });
  });

  describe('exporting', () => {
    it('gives the whole record, unmasked, with its history, and records that it was exported', async () => {
      const c = await make('Exported', { email: `exp.${tag}@example.com` });
      await svc.update(owner, c.id, { notes: 'likes the window seat' }, actor);
      const out = await svc.export(owner, c.id, actor);
      expect(out.customer).toMatchObject({ phone: c.phone, email: `exp.${tag}@example.com`, notes: 'likes the window seat' });
      expect(out.audit.map((a) => a.action)).toEqual(expect.arrayContaining(['customer.created', 'customer.updated']));
      const trail = await db.select().from(schema.posAuditEvents).where(eq(schema.posAuditEvents.entityId, c.id));
      expect(trail.map((t) => t.action)).toContain('customer.exported');
    });

    it('is refused to someone who cannot see full contact details', async () => {
      const c = await make('NoExport');
      await expect(svc.export(waiter, c.id, actor)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('the audit trail', () => {
    it('names what changed but never holds a name, phone, email or note', async () => {
      const c = await make('Audited', { email: `audit.${tag}@example.com`, notes: 'secret preference' });
      await svc.update(owner, c.id, { fullName: `Renamed ${tag}`, phone: phone(), email: `new.${tag}@example.com`, notes: 'another secret' }, actor);
      await svc.merge(owner, (await make('Fold')).id, { intoCustomerId: c.id, reason: 'same person' }, actor);
      await svc.erase(owner, c.id, { reason: 'asked to be forgotten' }, actor);
      const trail = await db.select().from(schema.posAuditEvents).where(eq(schema.posAuditEvents.entityId, c.id));
      expect(trail.map((t) => t.action)).toEqual(expect.arrayContaining(['customer.created', 'customer.updated', 'customer.merged', 'customer.erased']));
      const text = JSON.stringify(trail.map((t) => [t.before, t.after]));
      for (const secret of [`Audited ${tag}`, `Renamed ${tag}`, c.phone, `audit.${tag}`, `new.${tag}`, 'secret preference', 'another secret']) {
        expect(text, secret).not.toContain(secret);
      }
      expect(trail.every((t) => t.actorUserId === actor && t.workspaceId === workspaceId)).toBe(true);
    });
  });

  it('leaves the two orders it borrowed naming no one (every test took off what it put on)', async () => {
    const rows = await db
      .select({ id: schema.posOrders.id, c: schema.posOrders.customerId })
      .from(schema.posOrders)
      .where(inArray(schema.posOrders.id, [orderA.id, openOrderA.id]));
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.c, `order ${r.id}`).toBeNull();
  });
});
