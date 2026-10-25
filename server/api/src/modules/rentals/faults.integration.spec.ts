import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateLeaseRequest, MoveFaultRequest, ReportFaultRequest, addDays, addMonths, kigaliToday } from '@injishi/contracts';
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
import { RentalsFilesStorage } from '../storage/application/rentals-files-storage';
import type { StorageService } from '../storage/application/storage.service';
import type { StoragePort } from '../storage/domain/storage-port';
import { FaultNotices } from './application/fault-notices';
import { FaultsService } from './application/faults.service';
import { LeaseContractService } from './application/lease-contract.service';
import { LeaseDraftingService } from './application/lease-drafting.service';
import { LeaseLifecycleService } from './application/lease-lifecycle.service';
import { LeaseReadsService } from './application/lease-reads.service';
import { TenantFaultsService } from './application/tenant-faults.service';
import type { TenancyRef } from './application/tenancies.service';
import { UnitsService } from './application/units.service';
import type { RentalsMail } from './domain/rentals-mail';
import { FaultsRepository } from './infrastructure/faults.repository';
import { LeaseChargesRepository } from './infrastructure/lease-charges.repository';
import { LeasesRepository } from './infrastructure/leases.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from './infrastructure/rentals-writers';
import type { RentalsMailer } from './infrastructure/rentals.mailer';
import { SigningRepository } from './infrastructure/signing.repository';
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
    const faults = new FaultsService(db, faultsRepo, ticketLifecycle, files, notices, audit);
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
});
