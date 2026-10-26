import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CreateLeaseRequest,
  MoveFaultRequest,
  PayFixerRequest,
  RecordExpenseRequest,
  RecordFaultPaymentRequest,
  ReportFaultRequest,
  addDays,
  addMonths,
  kigaliToday,
} from '@injishi/contracts';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import sharp from 'sharp';

import * as schema from '../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../shared/auth/branch-scope';
import type { Database } from '../../shared/database/database.module';
import { ResidenceService } from '../operations/application/residence.service';
import { TicketLifecycle } from '../operations/application/ticket-lifecycle';
import { WorkOrderTimeService } from '../operations/application/work-order-time.service';
import { WorkOrdersService } from '../operations/application/work-orders.service';
import { ResidenceRepository } from '../operations/infrastructure/residence.repository';
import { StaffPhoneRepository } from '../operations/infrastructure/staff-phone.repository';
import { WorkOrdersRepository } from '../operations/infrastructure/work-orders.repository';
import { MockPaymentAdapter } from '../payments/infrastructure/mock-payment.adapter';
import { RentalsFilesStorage } from '../storage/application/rentals-files-storage';
import type { StorageService } from '../storage/application/storage.service';
import type { StoragePort } from '../storage/domain/storage-port';
import { ExpensesService } from './application/expenses.service';
import { FaultNotices } from './application/fault-notices';
import { FaultPaymentsService } from './application/fault-payments.service';
import { FilingsService } from './application/filings.service';
import { RentalsHousekeepingService } from './application/rentals-housekeeping.service';
import { TaxesService } from './application/taxes.service';
import { FaultsService } from './application/faults.service';
import { LeaseContractService } from './application/lease-contract.service';
import { LeaseDraftingService } from './application/lease-drafting.service';
import { LeaseLifecycleService } from './application/lease-lifecycle.service';
import { LeaseReadsService } from './application/lease-reads.service';
import { TenantFaultsService } from './application/tenant-faults.service';
import type { TenancyRef } from './application/tenancies.service';
import { UnitsService } from './application/units.service';
import type { RentalsMail } from './domain/rentals-mail';
import { ExpensesRepository } from './infrastructure/expenses.repository';
import { FaultPayoutsRepository } from './infrastructure/fault-payouts.repository';
import { FaultsRepository } from './infrastructure/faults.repository';
import { LeaseChargesRepository } from './infrastructure/lease-charges.repository';
import { LeasesRepository } from './infrastructure/leases.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import type { RentalsMoneyQueue } from './infrastructure/rentals-money.queue';
import { LeaseEventsWriter, RentalsAuditWriter } from './infrastructure/rentals-writers';
import type { RentalsMailer } from './infrastructure/rentals.mailer';
import { SigningRepository } from './infrastructure/signing.repository';
import { TaxesRepository } from './infrastructure/taxes.repository';
import { TenantsRepository } from './infrastructure/tenants.repository';
import { UnitsRepository } from './infrastructure/units.repository';

/**
 * Faults and the shared ticket lifecycle against a real Postgres (WP 4.1):
 * the SQL the doubles cannot judge. A tenant's report with a photo, the
 * landlord's chain Seen > Assigned (a contractor with a phone) > In progress >
 * Fixed, the 409 on an illegal move, "won't fix" with its reason, the tenant's
 * reopen inside 14 days and the refusal after, team notes kept off the
 * tenant's timeline, every move audited and mailed; and the hotel's work
 * orders on the same lifecycle (regression).
 *
 * OPT IN, like `rent.integration.spec.ts`: set `RENTALS_IT_DATABASE_URL` to a
 * THROWAWAY database. Skipped otherwise.
 */
const url = process.env.RENTALS_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('faults and the ticket lifecycle against Postgres (RENTALS_IT_DATABASE_URL)', () => {
  let pool: Pool;
  let db: Database;
  let ws: ScopedWorkspace;
  let userId: string;
  let tenancy: TenancyRef;
  let unitId: string;
  const mails: { to: string; subject: string; text: string }[] = [];
  const stored: string[] = [];
  const queued: string[] = [];
  const adapter = new MockPaymentAdapter();
  let photo: Buffer;

  const port: StoragePort = {
    put: async (input) => {
      const objectKey = `${input.kind}/${randomUUID()}.jpg`;
      stored.push(objectKey);
      return { objectKey, sizeBytes: input.body.byteLength } as never;
    },
    putFile: async () => {
      throw new Error('not used');
    },
    signedUrl: async (key) => `https://files.test/${key}`,
    get: async () => Buffer.alloc(0),
    remove: async () => undefined,
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the services are what the tests read
  const services = () => {
    const context = new RentalsContextRepository(db);
    const leases = new LeasesRepository(db);
    const tenants = new TenantsRepository(db);
    const unitsRepo = new UnitsRepository(db);
    const audit = new RentalsAuditWriter();
    const events = new LeaseEventsWriter();
    const storage = {
      putLeaseContract: async (input: { keyHint: string }) => {
        const objectKey = `lease_contract/${input.keyHint}.pdf`;
        await db.insert(schema.storedObjects).values({ objectKey, kind: 'lease_contract', mime: 'application/pdf' }).onConflictDoNothing();
        const [row] = await db.select({ id: schema.storedObjects.id }).from(schema.storedObjects).where(eq(schema.storedObjects.objectKey, objectKey));
        return { id: row!.id, objectKey };
      },
    } as unknown as StorageService;
    const mailer = {
      appUrl: 'http://localhost:3002',
      send: async (_ref: string, to: string, mail: RentalsMail) => {
        mails.push({ to, subject: mail.subject, text: [...mail.lines, mail.action.url].join('\n') });
        return true;
      },
    } as unknown as RentalsMailer;
    const contracts = new LeaseContractService(db, leases, context, storage);
    const reads = new LeaseReadsService(leases, tenants, contracts);
    const ticketLifecycle = new TicketLifecycle();
    const faultsRepo = new FaultsRepository(db);
    const files = new RentalsFilesStorage(port, db);
    const notices = new FaultNotices(faultsRepo, context, mailer);
    const queue = { settleVendorPayoutLater: async (id: string) => (queued.push(id), true) } as unknown as RentalsMoneyQueue;
    const expensesRepo = new ExpensesRepository(db);
    const payments = new FaultPaymentsService(db, faultsRepo, new FaultPayoutsRepository(db), expensesRepo, ticketLifecycle, files, notices, audit, queue, adapter);
    const faults = new FaultsService(db, faultsRepo, ticketLifecycle, files, notices, audit, payments);
    const filings = new FilingsService(db, new TaxesRepository(db), files, events, audit);
    const workOrdersRepo = new WorkOrdersRepository(db);
    const orders = new WorkOrdersService(workOrdersRepo, ticketLifecycle);
    return {
      units: new UnitsService(db, unitsRepo, context, contracts, audit),
      drafting: new LeaseDraftingService(db, leases, tenants, unitsRepo, context, contracts, events, audit, reads),
      leaseLifecycle: new LeaseLifecycleService(db, leases, new SigningRepository(db), new LeaseChargesRepository(db), context, events, audit, reads, mailer),
      faults,
      tenant: new TenantFaultsService(db, faultsRepo, ticketLifecycle, files, notices, audit, faults),
      orders,
      time: new WorkOrderTimeService(workOrdersRepo, new StaffPhoneRepository(db), orders, ticketLifecycle),
      board: new ResidenceService(new ResidenceRepository(db), ticketLifecycle, db),
      payments,
      expenses: new ExpensesService(db, expensesRepo, files, audit),
      taxes: new TaxesService(db, new TaxesRepository(db), context, files, filings, audit),
      filings,
      housekeeping: new RentalsHousekeepingService(new TaxesRepository(db), context, mailer),
      signing: new SigningRepository(db),
    };
  };

  /** The mails go out after the answer; let them land. */
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 60));
  const ticketRow = async (id: string): Promise<Record<string, unknown>> => (await pool.query(`select * from maintenance_tickets where id = $1`, [id])).rows[0];
  const eventRows = async (id: string): Promise<Record<string, unknown>[]> =>
    (await pool.query(`select kind, from_status, to_status, note, author_role, visible_to_tenant from maintenance_events where ticket_id = $1 order by created_at, id`, [id])).rows;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    photo = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#c03030' } }).png().toBuffer();
    const tag = randomUUID().slice(0, 8);
    const [user] = await db.insert(schema.users).values({ email: `it-p4-${tag}@rentals.test`, name: 'Jean Mugabo' }).returning();
    const { rows: place } = await pool.query(
      `select v.id as village, c.sector_id as sector, s.district_id as district
         from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id limit 1`,
    );
    const [org] = await db
      .insert(schema.orgs)
      .values({
        legalName: `Fault Court ${tag}`,
        domain: 'residence',
        residenceClass: 'residential_landlord',
        upi: `1/02/03/04/${Math.floor(1000 + Math.random() * 8999)}`,
        registrationStatus: 'active',
        sectorId: place[0]?.sector,
        districtId: place[0]?.district,
        villageId: place[0]?.village,
        addressText: 'KG 11 Ave',
      })
      .returning();
    const [workspace] = await db.insert(schema.workspaces).values({ kind: 'business', orgId: org!.id }).returning();
    await db.insert(schema.orgMemberships).values({ orgId: org!.id, userId: user!.id, orgRole: 'owner' });
    userId = user!.id;
    ws = {
      workspaceId: workspace!.id,
      kind: 'business',
      orgId: org!.id,
      domain: 'residence',
      orgRole: 'owner',
      registrationStatus: 'active',
      permissions: ['ticket.advance', 'message.send', 'money.view', 'expense.manage', 'tax.manage'],
      branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    } as unknown as ScopedWorkspace;

    const s = services();
    const unit = await s.units.create(ws, userId, { label: 'F-01', askingRentRwf: 300_000 });
    unitId = unit.id;
    const start = kigaliToday();
    const email = `t-${tag}@rentals.test`;
    const lease = await s.drafting.create(
      ws,
      userId,
      CreateLeaseRequest.parse({
        unitId: unit.id,
        tenant: { fullName: 'Aline Uwera', email, phone: '0788 123 456', idKind: 'national_id', idNumber: '1199080012345012', nationality: 'RW' },
        terms: { startDate: start, endDate: addDays(addMonths(start, 12), -1), monthlyRentRwf: 300_000, depositRwf: 0, rentDueDay: 5 },
      }),
    );
    const [tenantUser] = await db.insert(schema.users).values({ email, name: 'Aline Uwera' }).returning();
    await db.update(schema.tenants).set({ userId: tenantUser!.id }).where(eq(schema.tenants.id, lease.tenant.id));
    await db.update(schema.leases).set({ status: 'signed', signedAt: new Date() }).where(eq(schema.leases.id, lease.id));
    await s.leaseLifecycle.start(ws, userId, lease.id);
    tenancy = { leaseId: lease.id, tenantId: lease.tenant.id, userId: tenantUser!.id, workspaceId: ws.workspaceId };
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('a tenant reports a fault with a photo; the landlord walks it to fixed; the tenant reopens it', async () => {
    const s = services();
    mails.length = 0;
    const reported = await s.tenant.report(
      tenancy,
      ReportFaultRequest.parse({ title: 'Kitchen tap leaking', category: 'plumbing', description: 'Drips all night', urgency: 'high', staffMayEnter: 'true' }),
      [{ filename: 'tap.png', body: photo }],
    );
    expect(reported).toMatchObject({ status: 'open', statusWords: 'Reported', photoCount: 1, staffMayEnter: true, canReopen: false });
    expect(reported.reference).toMatch(/^F-\d+$/);
    expect(reported.photos).toHaveLength(1);
    expect(stored.at(-1)).toMatch(/^fault_photo\//);
    const id = reported.id;
    const row = await ticketRow(id);
    expect(row).toMatchObject({ lease_id: tenancy.leaseId, unit_id: unitId, raised_by_role: 'tenant', priority: 'high' });
    await settle();
    expect(mails.find((m) => m.subject.startsWith('New fault at'))).toBeTruthy();

    // The landlord's list, with counts by tab.
    const list = await s.faults.list(ws, { tab: 'open', page: 1 });
    expect(list.items.map((i) => i.id)).toContain(id);
    expect(list.counts.open).toBeGreaterThanOrEqual(1);
    // Each row carries a thumbnail read of its first photo.
    expect(list.items.find((i) => i.id === id)?.thumbUrl).toMatch(/^https:\/\/files\.test\/fault_photo\//);

    // Seen, then an illegal move: Seen cannot go to Closed.
    await s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'acknowledged' }));
    expect((await ticketRow(id)).acknowledged_at).not.toBeNull();
    await expect(s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'closed' }))).rejects.toBeInstanceOf(ConflictException);
    // Assigned needs someone: say who with Assign.
    await expect(s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'assigned' }))).rejects.toBeInstanceOf(ConflictException);

    const assigned = await s.faults.assign(ws, userId, id, { contractorName: 'Eric', contractorPhone: '+250788000111' });
    expect(assigned).toMatchObject({ status: 'assigned', assignee: { kind: 'contractor', name: 'Eric', phone: '+250788000111' } });
    expect(await ticketRow(id)).toMatchObject({ assignee_kind: 'contractor', assigned_contractor: 'Eric', assigned_contractor_phone: '+250788000111' });
    // A team member who does not work faults here is refused.
    await expect(s.faults.assign(ws, userId, id, { memberUserId: randomUUID() })).rejects.toBeInstanceOf(BadRequestException);

    await s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'in_progress' }));
    await s.faults.message(ws, userId, id, { body: 'Eric comes at 10.', visibleToTenant: true });
    await s.faults.message(ws, userId, id, { body: 'Buy a new washer.', visibleToTenant: false });
    await s.faults.addPhotos(ws, userId, id, 'fixed', [{ filename: 'after.png', body: photo }]);
    const fixed = await s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'resolved', note: 'New washer fitted' }));
    expect(fixed).toMatchObject({ status: 'resolved', tab: 'fixed', allowedMoves: ['closed', 'open'] });
    expect(fixed.reopenUntil).toBe(addDays(kigaliToday(), 14));
    expect((await ticketRow(id)).resolved_at).not.toBeNull();
    // Fixed cannot go back to In progress: reopen it instead.
    await expect(s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'in_progress' }))).rejects.toBeInstanceOf(ConflictException);

    // The tenant's view: the moves and the reply in plain words, never the team note.
    const seen = await s.tenant.detail(tenancy, id);
    expect(seen.events.map((e) => e.words)).toEqual([
      'You reported it.',
      'Your landlord has seen the report.',
      'Eric is assigned to fix it.',
      'Work has started.',
      'Your landlord wrote.',
      'Marked fixed.',
    ]);
    expect(seen.events.some((e) => e.note === 'Buy a new washer.')).toBe(false);
    expect(seen).toMatchObject({ canReopen: true, assigneeName: 'Eric' });
    expect(JSON.stringify(seen)).not.toContain('+250788000111');

    // Every move was emailed to the tenant, and audited.
    await settle();
    const subjects = mails.filter((m) => m.subject.startsWith('Your repair:')).map((m) => m.subject);
    expect(subjects).toEqual(['Your repair: Seen', 'Your repair: Assigned', 'Your repair: In progress', 'Your repair: Fixed']);
    expect(mails.some((m) => m.subject === 'A reply about "Kitchen tap leaking"')).toBe(true);
    const audits = await pool.query(`select event_type from audit_events where subject_type = 'maintenance_ticket' and subject_id = $1 order by occurred_at`, [id]);
    expect(audits.rows.map((r) => r.event_type)).toEqual(['fault.reported', 'fault.moved', 'fault.assigned', 'fault.moved', 'fault.moved']);

    // The tenant reopens within 14 days; the count goes up; the landlord is told.
    const reopened = await s.tenant.reopen(tenancy, id, { reason: 'It drips again' });
    expect(reopened).toMatchObject({ status: 'open', canReopen: false });
    expect(await ticketRow(id)).toMatchObject({ reopened_count: 1, resolved_at: null });
    await settle();
    expect(mails.some((m) => m.subject.startsWith('Reopened at'))).toBe(true);

    // Fixed again and closed; then 20 days on, the tenant may not reopen.
    await s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'resolved' }));
    await s.faults.move(ws, userId, id, MoveFaultRequest.parse({ to: 'closed' }));
    await pool.query(`update maintenance_tickets set resolved_at = now() - interval '20 days' where id = $1`, [id]);
    const late = await s.tenant.reopen(tenancy, id, { reason: 'Again' }).catch((e: unknown) => e);
    expect(late).toBeInstanceOf(ConflictException);

    const timeline = await eventRows(id);
    expect(timeline.map((e) => e.kind)).toEqual(['reported', 'acknowledged', 'assigned', 'started', 'note', 'note', 'fixed', 'reopened', 'fixed', 'closed']);
    expect(timeline.find((e) => e.kind === 'reopened')).toMatchObject({ from_status: 'resolved', to_status: 'open', author_role: 'tenant', visible_to_tenant: true });
    expect(timeline.filter((e) => e.kind === 'note').map((e) => e.visible_to_tenant)).toEqual([true, false]);
  });

  it("won't fix needs a reason, which the tenant reads; four photos per phase; a stranger's fault is 404", async () => {
    const s = services();
    const t = await s.tenant.report(tenancy, ReportFaultRequest.parse({ title: 'Paint peeling in the bedroom' }), [
      { filename: 'a.png', body: photo },
      { filename: 'b.png', body: photo },
      { filename: 'c.png', body: photo },
    ]);
    await expect(s.tenant.addPhotos(tenancy, t.id, [{ filename: 'd.png', body: photo }, { filename: 'e.png', body: photo }])).rejects.toBeInstanceOf(BadRequestException);
    await s.tenant.addPhotos(tenancy, t.id, [{ filename: 'd.png', body: photo }]);
    expect((await s.tenant.detail(tenancy, t.id)).photoCount).toBe(4);

    await expect(s.faults.move(ws, userId, t.id, { to: 'wont_fix' } as never)).rejects.toBeInstanceOf(BadRequestException);
    const refused = await s.faults.move(ws, userId, t.id, MoveFaultRequest.parse({ to: 'wont_fix', note: 'Repainting is booked for every unit in March.' }));
    expect(refused).toMatchObject({ status: 'wont_fix', wontFixReason: 'Repainting is booked for every unit in March.', tab: 'closed' });
    const view = await s.tenant.detail(tenancy, t.id);
    expect(view.events.at(-1)).toMatchObject({ words: "Your landlord won't fix this.", note: 'Repainting is booked for every unit in March.' });
    expect(view.canReopen).toBe(true);

    // Another lease's tenant, and another business, see nothing.
    await expect(s.tenant.detail({ ...tenancy, leaseId: randomUUID() }, t.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.faults.detail({ ...ws, workspaceId: randomUUID() } as ScopedWorkspace, t.id)).rejects.toBeInstanceOf(NotFoundException);
    // A reply to the tenant needs message.send.
    await expect(
      s.faults.message({ ...ws, permissions: ['ticket.advance'] } as ScopedWorkspace, userId, t.id, { body: 'Hello', visibleToTenant: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('the landlord raises a fault on an occupied unit; the tenant sees it', async () => {
    const s = services();
    const raised = await s.faults.raise(ws, userId, { unitId, title: 'Gutter loose', category: 'other', urgency: 'low' } as never, []);
    expect(raised).toMatchObject({ reportedBy: 'landlord', leaseId: tenancy.leaseId, status: 'open' });
    expect((await s.tenant.list(tenancy)).items.map((i) => i.id)).toContain(raised.id);
  });

  it('hotel work orders still move on the same lifecycle (regression)', async () => {
    const s = services();
    const tag = randomUUID().slice(0, 6);
    const [org] = await db
      .insert(schema.orgs)
      .values({ legalName: `Lake Hotel ${tag}`, domain: 'hospitality', accommodationClass: 'hotel', tin: String(100_000_000 + Math.floor(Math.random() * 899_999_999)), registrationStatus: 'active' })
      .returning();
    const [workspace] = await db.insert(schema.workspaces).values({ kind: 'business', orgId: org!.id }).returning();
    const [property] = await db.insert(schema.properties).values({ orgId: org!.id, workspaceId: workspace!.id, name: `Lake Hotel ${tag}` }).returning();
    const [type] = await db.insert(schema.roomTypes).values({ propertyId: property!.id, workspaceId: workspace!.id, name: 'Deluxe', domain: 'hospitality' }).returning();
    await db.insert(schema.rooms).values({ roomTypeId: type!.id, propertyId: property!.id, workspaceId: workspace!.id, label: '302' });
    const hotel = {
      workspaceId: workspace!.id,
      kind: 'business',
      orgId: org!.id,
      domain: 'hospitality',
      orgRole: 'owner',
      permissions: ['ticket.advance'],
      branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [property!.id], includesUnbranched: true },
    } as unknown as ScopedWorkspace;
    await db.insert(schema.orgMemberships).values({ orgId: org!.id, userId, orgRole: 'owner' });

    const created = await s.orders.create(hotel, { location: 'Room 302', title: 'AC drips', priority: 'normal', assignee: { userId } } as never, userId);
    expect(created).toMatchObject({ status: 'assigned', assignedToUserId: userId, reference: 'WO-1' });
    expect((await ticketRow(created.id)).assignee_kind).toBe('member');
    await s.orders.assign(hotel, created.id, { contractor: 'CoolFix Ltd' }, userId);
    expect(await ticketRow(created.id)).toMatchObject({ status: 'assigned', assignee_kind: 'contractor', assigned_contractor: 'CoolFix Ltd', assigned_to_user_id: null });
    await s.orders.assign(hotel, created.id, { userId }, userId);
    await s.time.start(hotel, created.id, userId);
    expect((await ticketRow(created.id)).status).toBe('in_progress');
    const done = await s.time.resolve(hotel, created.id, { fix: 'Cleared the drain line', askRelease: false }, userId);
    expect(done.status).toBe('resolved');
    expect(done.resolvedAt).not.toBeNull();
    const kinds = (await eventRows(created.id)).map((e) => [e.kind, e.from_status, e.to_status, e.visible_to_tenant]);
    expect(kinds).toEqual([
      ['reported', null, null, false],
      ['assigned', null, null, false],
      ['assigned', 'assigned', 'assigned', false],
      ['assigned', 'assigned', 'assigned', false],
      ['started', 'assigned', 'in_progress', false],
      ['fixed', 'in_progress', 'resolved', false],
    ]);
    // The old tickets board moves through the same chain: a fixed order cannot go back to in progress.
    await expect(s.board.advanceTicket(hotel, created.id, { to: 'in_progress', note: 'again' }, userId)).rejects.toBeInstanceOf(ConflictException);
    const closed = await s.board.advanceTicket(hotel, created.id, { to: 'closed', note: 'Checked by the manager' }, userId);
    expect(closed.status).toBe('closed');
    // The hotel board lists its order, and no rented unit's fault.
    const board = await s.orders.list(hotel);
    expect(board.workOrders.map((o) => o.id)).toEqual([created.id]);
  });

  it('pays the fixer through the mock gateway: waiting, then settled into a repairs expense; a replay is the same payment', async () => {
    const s = services();
    process.env.MOCK_MOMO_APPROVAL_MS = '0';
    const f = await s.tenant.report(tenancy, ReportFaultRequest.parse({ title: 'Shower head broken' }), []);
    const key = randomUUID();
    const body = PayFixerRequest.parse({ amountRwf: 25_000, payeeName: 'Eric', payee: { kind: 'momo', phone: '0788 000 111' }, payerPhone: '0788 301 122' });
    const sent = await s.payments.pay(ws, userId, f.id, body, key);
    expect(sent).toMatchObject({ status: 'queued', amountRwf: 25_000, payeeName: 'Eric', destinationMasked: 'MTN MoMo 078••••111' });
    expect(queued).toContain(sent.payoutId);

    // PaymentSettlement's sweep finds it approved: paid, an expense, a timeline row, an audit row.
    mails.length = 0;
    expect((await s.payments.sweep()).paid).toBeGreaterThanOrEqual(1);
    // The same key answers the same payment; another amount on it is refused.
    expect(await s.payments.pay(ws, userId, f.id, body, key)).toMatchObject({ payoutId: sent.payoutId, status: 'paid' });
    await expect(s.payments.pay(ws, userId, f.id, { ...body, amountRwf: 30_000 }, key)).rejects.toBeInstanceOf(ConflictException);
    const payout = (await pool.query(`select status, payee_type, source, settled_at from payouts where id = $1`, [sent.payoutId])).rows[0];
    expect(payout).toMatchObject({ status: 'paid', payee_type: 'vendor', source: 'repair' });
    expect(payout.settled_at).not.toBeNull();
    const expense = (await pool.query(`select * from expenses where payout_id = $1`, [sent.payoutId])).rows[0];
    expect(expense).toMatchObject({ category: 'repairs', source: 'gateway', ticket_id: f.id, unit_id: unitId, method: 'momo', payee_name: 'Eric', payee_phone: '+250788000111' });
    expect(Number(expense.amount_rwf)).toBe(25_000);
    expect((await eventRows(f.id)).at(-1)).toMatchObject({ kind: 'paid', visible_to_tenant: false });
    // Settling twice writes it once.
    expect(await s.payments.settle(sent.payoutId)).toBe(false);
    expect((await pool.query(`select count(*)::int as n from expenses where payout_id = $1`, [sent.payoutId])).rows[0].n).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(mails.some((m) => m.subject === 'You paid Eric RWF 25,000 for "Shower head broken"')).toBe(true);

    // The landlord's panel shows it to a reader of money; a housekeeper sees no money at all.
    const detail = await s.faults.detail(ws, f.id);
    expect(detail.payments).toEqual([expect.objectContaining({ source: 'gateway', status: 'paid', amountRwf: 25_000, expenseId: expense.id })]);
    expect(detail.paidRwf).toBe(25_000);
    const housekeeper = await s.faults.detail({ ...ws, permissions: ['ticket.advance'] } as ScopedWorkspace, f.id);
    expect(housekeeper.payments).toBeNull();
    expect(housekeeper.events.some((e) => e.kind === 'paid')).toBe(false);
    // The tenant never sees money.
    expect(JSON.stringify(await s.tenant.detail(tenancy, f.id))).not.toContain('25,000');

    // A paid expense cannot be voided.
    await expect(s.expenses.void(ws, userId, expense.id, { reason: 'Wrong one' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('a declined transfer, a declined prompt and an expired prompt fail with nothing taken; one at a time per fault', async () => {
    const s = services();
    const f = await s.tenant.report(tenancy, ReportFaultRequest.parse({ title: 'Door lock stiff' }), []);
    const pay = (over: Record<string, unknown>): PayFixerRequest =>
      PayFixerRequest.parse({ amountRwf: 5_000, payeeName: 'Eric', payee: { kind: 'momo', phone: '0788 120 000' }, payerPhone: '0788 301 122', ...over });
    const declinedFixer = await s.payments.pay(ws, userId, f.id, pay({}), randomUUID());
    expect(declinedFixer).toMatchObject({ status: 'failed' });
    expect(declinedFixer.failureReason).toMatch(/declined.*Nothing was taken/);
    const declinedPayer = await s.payments.pay(ws, userId, f.id, pay({ payee: { kind: 'momo', phone: '0788 000 111' }, payerPhone: '0788 120 000' }), randomUUID());
    expect(declinedPayer.status).toBe('failed');

    process.env.MOCK_MOMO_APPROVAL_MS = '600000';
    const slow = await s.payments.pay(ws, userId, f.id, pay({ payee: { kind: 'bank', bankName: 'Bank of Kigali', accountNumber: '000400123456' } }), randomUUID());
    expect(slow).toMatchObject({ status: 'queued', destinationMasked: 'Bank of Kigali 000••••••456' });
    await expect(s.payments.pay(ws, userId, f.id, pay({ payee: { kind: 'momo', phone: '0788 000 111' } }), randomUUID())).rejects.toBeInstanceOf(ConflictException);
    // Ten minutes on, the prompt has expired.
    expect(await s.payments.sweepOne(slow.payoutId, new Date(Date.now() + 11 * 60_000))).toBe('failed');
    expect((await pool.query(`select count(*)::int as n from expenses where ticket_id = $1`, [f.id])).rows[0].n).toBe(0);
    process.env.MOCK_MOMO_APPROVAL_MS = '0';
  });

  it('records a payment made outside Injishi, dated from the report day to today, with a receipt', async () => {
    const s = services();
    const f = await s.tenant.report(tenancy, ReportFaultRequest.parse({ title: 'Window latch broken' }), []);
    const today = kigaliToday();
    await expect(s.payments.record(ws, userId, f.id, RecordFaultPaymentRequest.parse({ amountRwf: 5_000, paidOn: addDays(today, -3), method: 'cash', payeeName: 'Eric' }), null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(s.payments.record(ws, userId, f.id, { amountRwf: 5_000, paidOn: addDays(today, 1), method: 'cash', payeeName: 'Eric' }, null)).rejects.toBeInstanceOf(BadRequestException);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const id = await s.payments.record(
      ws,
      userId,
      f.id,
      RecordFaultPaymentRequest.parse({ amountRwf: 5_000, paidOn: today, method: 'cash', payeeName: 'Eric', note: 'Cash at the gate' }),
      { filename: 'receipt.pdf', mime: 'application/pdf', body: pdf },
    );
    const row = (await pool.query(`select e.*, so.kind as receipt_kind from expenses e join stored_objects so on so.id = e.receipt_object_id where e.id = $1`, [id])).rows[0];
    expect(row).toMatchObject({ source: 'recorded', category: 'repairs', ticket_id: f.id, method: 'cash', receipt_kind: 'expense_receipt' });
    const detail = await s.faults.detail(ws, f.id);
    expect(detail.payments).toEqual([expect.objectContaining({ source: 'recorded', status: 'paid', amountRwf: 5_000, receiptUrl: expect.stringMatching(/^https:\/\/files\.test\//) })]);
    expect(detail.events.at(-1)).toMatchObject({ kind: 'paid' });

    // Voided with a reason: it stays listed and stops counting.
    const before = await s.expenses.list(ws, { year: Number(today.slice(0, 4)) });
    const voided = await s.expenses.void(ws, userId, id, { reason: 'Recorded twice' });
    expect(voided).toMatchObject({ canVoid: false, voided: { reason: 'Recorded twice' } });
    await expect(s.expenses.void(ws, userId, id, { reason: 'Again' })).rejects.toBeInstanceOf(ConflictException);
    const after = await s.expenses.list(ws, { year: Number(today.slice(0, 4)) });
    expect(after.totals.totalRwf).toBe(before.totals.totalRwf - 5_000);
    expect(after.items.map((i) => i.id)).toContain(id);
    expect((await s.faults.detail(ws, f.id)).paidRwf).toBe(0);
  });

  it('expenses: loan interest names its purpose; totals by category; dates and buildings are checked', async () => {
    const s = services();
    const today = kigaliToday();
    expect(RecordExpenseRequest.safeParse({ category: 'loan_interest', amountRwf: 500_000, paidOn: today, method: 'bank', payeeName: 'Bank of Kigali' }).success).toBe(false);
    expect(RecordExpenseRequest.safeParse({ category: 'security', amountRwf: 80_000, paidOn: today, method: 'cash', loanPurpose: 'build' }).success).toBe(false);
    expect(RecordExpenseRequest.safeParse({ category: 'security', amountRwf: 80_000, paidOn: '1999-12-31', method: 'cash' }).success).toBe(false);
    expect(RecordExpenseRequest.safeParse({ category: 'security', amountRwf: 80_000, paidOn: addDays(today, 1), method: 'cash' }).success).toBe(false);
    const loan = await s.expenses.record(
      ws,
      userId,
      RecordExpenseRequest.parse({ category: 'loan_interest', amountRwf: 500_000, paidOn: today, method: 'bank', payeeName: 'Bank of Kigali', loanPurpose: 'build' }),
      null,
    );
    expect(loan).toMatchObject({ category: 'loan_interest', loanPurpose: 'build', source: 'recorded', hasReceipt: false, canVoid: true });
    // The business has one building, so the expense is that building's.
    expect(loan.propertyId).not.toBeNull();
    const guard = await s.expenses.record(ws, userId, RecordExpenseRequest.parse({ category: 'security', amountRwf: 80_000, paidOn: today, method: 'cash', unitId }), null);
    expect(guard).toMatchObject({ unitId, unitLabel: 'F-01' });
    const list = await s.expenses.list(ws, { year: Number(today.slice(0, 4)) });
    expect(list.totals.byCategory.find((c) => c.category === 'loan_interest')?.amountRwf).toBe(500_000);
    expect(list.totals.byCategory.find((c) => c.category === 'security')?.amountRwf).toBe(80_000);
    const onlyLoans = await s.expenses.list(ws, { year: Number(today.slice(0, 4)), category: 'loan_interest' });
    expect(onlyLoans.items.every((i) => i.category === 'loan_interest')).toBe(true);
    // A receipt added later (the bank's statement).
    const withProof = await s.expenses.attachReceipt(ws, userId, loan.id, { filename: 'bk.pdf', mime: 'application/pdf', body: Buffer.from('%PDF-1.4\n%%EOF') });
    expect(withProof.hasReceipt).toBe(true);
    // Another business sees nothing.
    await expect(s.expenses.view({ ...ws, orgId: randomUUID(), workspaceId: randomUUID() } as ScopedWorkspace, loan.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rental income tax on real rows: the RRA example owes 434,000; deposits are not rent; late charges until declared', async () => {
    const s = services();
    const lease = (await pool.query(`select property_id, tenant_id from leases where id = $1`, [tenancy.leaseId])).rows[0];
    // 2025: two rent payments recorded before rent went gateway only, and one that paid a deposit.
    const pay = async (amount: number, day: string): Promise<string> =>
      (
        await pool.query(
          `insert into lease_payments (workspace_id, property_id, lease_id, tenant_id, channel, method, amount_rwf, status, received_on, recorded_by_user_id, succeeded_at, idempotency_key)
           values ($1, $2, $3, $4, 'recorded', 'bank_transfer', $5, 'succeeded', $6, $7, $6::date + time '10:00', $8) returning id`,
          [ws.workspaceId, lease.property_id, tenancy.leaseId, lease.tenant_id, amount, day, userId, `${ws.workspaceId}:it-tax:${randomUUID()}`],
        )
      ).rows[0].id;
    await pay(2_400_000, '2025-01-10');
    await pay(2_400_000, '2025-07-10');
    const depositPayment = await pay(300_000, '2025-03-01');
    const charge = (
      await pool.query(`insert into lease_charges (lease_id, kind, due_on, amount_rwf, paid_rwf, status, paid_at) values ($1, 'deposit', '2025-03-01', 300000, 300000, 'paid', now()) returning id`, [tenancy.leaseId])
    ).rows[0].id;
    await pool.query(`insert into lease_payment_allocations (payment_id, charge_id, amount_rwf) values ($1, $2, 300000)`, [depositPayment, charge]);
    await s.expenses.record(ws, userId, RecordExpenseRequest.parse({ category: 'loan_interest', amountRwf: 500_000, paidOn: '2025-06-30', method: 'bank', payeeName: 'Bank of Kigali', loanPurpose: 'build' }), {
      filename: 'bk.pdf',
      mime: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n%%EOF'),
    });
    await s.expenses.record(ws, userId, RecordExpenseRequest.parse({ category: 'loan_interest', amountRwf: 40_000, paidOn: '2025-08-30', method: 'bank', payeeName: 'Bank of Kigali', loanPurpose: 'buy' }), null);
    const voided = await s.expenses.record(ws, userId, RecordExpenseRequest.parse({ category: 'loan_interest', amountRwf: 999_000, paidOn: '2025-09-30', method: 'bank', payeeName: 'Bank of Kigali', loanPurpose: 'build' }), null);
    await s.expenses.void(ws, userId, voided.id, { reason: 'Typed the wrong year' });
    await s.expenses.record(ws, userId, RecordExpenseRequest.parse({ category: 'repairs', amountRwf: 90_000, paidOn: '2025-05-05', method: 'cash', payeeName: 'Fixer' }), null);

    await s.taxes.setTaxpayer(ws, userId, 'individual');
    const y = await s.taxes.year(ws, 2025);
    expect(y.rent).toMatchObject({ totalRwf: 4_800_000, recordedRwf: 4_800_000, gatewayRwf: 0, paymentCount: 2, depositsExcludedRwf: 300_000 });
    expect(y.rent.months[0]).toEqual({ month: '2025-01', amountRwf: 2_400_000 });
    expect(y.rent.months[2]).toEqual({ month: '2025-03', amountRwf: 0 });
    // Interest: 540,000 deductible (the voided one never counts); one entry has no bank proof.
    expect(y.interest.deductibleRwf).toBe(540_000);
    expect(y.interest.needsProofCount).toBe(1);
    expect(y.otherExpenses).toMatchObject({ totalRwf: 90_000, byCategory: [{ category: 'repairs', amountRwf: 90_000 }] });
    expect(y.rentalTax).toMatchObject({ grossRentRwf: 4_800_000, flatDeductionRwf: 2_400_000, interestDeductedRwf: 540_000, taxableIncomeRwf: 1_860_000, taxRwf: 422_000 });
    expect(y).toMatchObject({ dueOn: '2026-01-31', running: false, canDeclare: true, profit: null });
    expect(y.lateCharges).toMatchObject({ monthsLate: 9 });
    expect(y.lateCharges!.totalRwf).toBeGreaterThan(0);

    // The leaflet's example exactly: without the 40,000, 434,000.
    const k = (await pool.query(`select id from expenses where org_id = $1 and amount_rwf = 40000 and category = 'loan_interest'`, [ws.orgId])).rows[0].id;
    await s.expenses.void(ws, userId, k, { reason: 'Not for this building' });
    expect((await s.taxes.year(ws, 2025)).rentalTax).toMatchObject({ taxableIncomeRwf: 1_900_000, taxRwf: 434_000 });

    // January nudge for 2025 (sent once on the 15th), before it is declared.
    mails.length = 0;
    const jan15 = new Date('2026-01-15T10:00:00+02:00');
    expect((await s.housekeeping.run(jan15)).taxNudges).toBeGreaterThanOrEqual(1);
    expect(mails.some((m) => m.subject === 'Declare your 2025 rental income tax by 31 January 2026')).toBe(true);
    const again = await s.housekeeping.run(jan15);
    expect(mails.filter((m) => m.subject.startsWith('Declare your 2025')).length).toBe(1);
    expect(again.taxNudges).toBe(0);
    expect((await s.housekeeping.run(new Date('2026-01-15T20:00:00+02:00'))).taxNudges).toBe(0);

    // Declaring: this year is not over; dates must be after the year and not to come; paid needs paid on after declared.
    const { UpdateTaxDeclarationRequest } = await import('@injishi/contracts');
    await expect(s.taxes.declare(ws, userId, 2026, UpdateTaxDeclarationRequest.parse({ status: 'declared', declaredOn: '2026-10-01' }), null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.taxes.declare(ws, userId, 2025, UpdateTaxDeclarationRequest.parse({ status: 'declared', declaredOn: '2025-12-31' }), null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.taxes.declare(ws, userId, 2025, UpdateTaxDeclarationRequest.parse({ status: 'declared', declaredOn: addDays(kigaliToday(), 1) }), null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      s.taxes.declare(ws, userId, 2025, UpdateTaxDeclarationRequest.parse({ status: 'paid', declaredOn: '2026-01-20', paidOn: '2026-01-19', amountPaidRwf: 434_000 }), null),
    ).rejects.toBeInstanceOf(BadRequestException);
    const declared = await s.taxes.declare(ws, userId, 2025, UpdateTaxDeclarationRequest.parse({ status: 'declared', declaredOn: '2026-01-20' }), null);
    expect(declared).toMatchObject({ declaration: { status: 'declared', declaredOn: '2026-01-20' }, lateCharges: null });
    const paid = await s.taxes.declare(
      ws,
      userId,
      2025,
      UpdateTaxDeclarationRequest.parse({ status: 'paid', declaredOn: '2026-01-20', paidOn: '2026-01-25', amountPaidRwf: 434_000, rraReference: 'RRA-25-1' }),
      { filename: 'rra.pdf', mime: 'application/pdf', body: Buffer.from('%PDF-1.4\n%%EOF') },
    );
    expect(paid.declaration).toMatchObject({ status: 'paid', paidOn: '2026-01-25', amountPaidRwf: 434_000, rraReference: 'RRA-25-1', receiptUrl: expect.stringMatching(/tax_receipt/) });

    // A company sees profit, no bands, and cannot mark a rental tax declaration.
    await s.taxes.setTaxpayer(ws, userId, 'company');
    const co = await s.taxes.year(ws, 2025);
    expect(co.rentalTax).toBeNull();
    expect(co.profit).toMatchObject({ rentRwf: 4_800_000, expensesRwf: 590_000, profitRwf: 4_210_000, corporateTaxRwf: 1_178_800 });
    await expect(s.taxes.declare(ws, userId, 2025, UpdateTaxDeclarationRequest.parse({ status: 'not_started' }), null)).rejects.toBeInstanceOf(ConflictException);
    await s.taxes.setTaxpayer(ws, userId, 'individual');
    await expect(s.taxes.year(ws, 2019)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.taxes.year(ws, 2027)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lease filings: opened once, reminded five days and one day before, marked filed from the signing day to today', async () => {
    const s = services();
    const today = kigaliToday();
    const lease = (await pool.query(`select (signed_at at time zone 'Africa/Kigali')::date::text as signed_on from leases where id = $1`, [tenancy.leaseId])).rows[0];
    const id = await s.signing.openNewLeaseFiling(db, { leaseId: tenancy.leaseId, dueOn: addDays(today, 5) });
    expect(id).not.toBeNull();
    expect(await s.signing.openNewLeaseFiling(db, { leaseId: tenancy.leaseId, dueOn: addDays(today, 5) })).toBeNull();
    const listed = await s.filings.list(ws, {});
    expect(listed.items.find((f) => f.id === id)).toMatchObject({ status: 'pending', late: false, daysLeft: 5, kind: 'new_lease' });

    mails.length = 0;
    const tenAm = new Date(`${today}T10:00:00+02:00`);
    expect((await s.housekeeping.run(tenAm)).filingReminders).toBeGreaterThanOrEqual(1);
    expect(mails.filter((m) => m.subject.startsWith('Give RRA a copy of lease')).length).toBe(1);
    await s.housekeeping.run(tenAm);
    expect(mails.filter((m) => m.subject.startsWith('Give RRA a copy of lease')).length).toBe(1);
    // Four days on (the day before it is due): the second reminder, once.
    await s.housekeeping.run(new Date(`${addDays(today, 4)}T10:00:00+02:00`));
    expect(mails.filter((m) => m.subject.startsWith('Give RRA a copy of lease')).length).toBe(2);
    expect(mails.at(-1)!.text).toContain('That is due tomorrow');

    await expect(s.filings.markFiled(ws, userId, id!, { filedOn: addDays(lease.signed_on, -1) }, null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.filings.markFiled(ws, userId, id!, { filedOn: addDays(today, 1) }, null)).rejects.toBeInstanceOf(BadRequestException);
    const filed = await s.filings.markFiled(ws, userId, id!, { filedOn: today, reference: 'RRA-LEASE-77' }, { filename: 'proof.pdf', mime: 'application/pdf', body: Buffer.from('%PDF-1.4\n%%EOF') });
    expect(filed).toMatchObject({ status: 'filed', filedOn: today, reference: 'RRA-LEASE-77', late: false, daysLeft: null, proofUrl: expect.stringMatching(/filing_proof/) });
    const events = await pool.query(`select kind from lease_events where lease_id = $1 and kind = 'filed'`, [tenancy.leaseId]);
    expect(events.rows).toHaveLength(1);
    await expect(s.filings.markFiled({ ...ws, workspaceId: randomUUID() } as ScopedWorkspace, userId, id!, { filedOn: today }, null)).rejects.toBeInstanceOf(NotFoundException);
    // Housekeeping expires invitations past their day.
    expect(typeof (await s.housekeeping.run(tenAm)).invitationsExpired).toBe('number');
  });
});
