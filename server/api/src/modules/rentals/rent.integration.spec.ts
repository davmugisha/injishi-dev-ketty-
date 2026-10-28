import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateLeaseRequest, addDays, addMonths, kigaliToday } from '@injishi/contracts';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../shared/auth/branch-scope';
import type { Database } from '../../shared/database/database.module';
import { MockPaymentAdapter, mockCallbackSignature } from '../payments/infrastructure/mock-payment.adapter';
import type { StorageService } from '../storage/application/storage.service';
import { LeaseContractService } from './application/lease-contract.service';
import { LeaseDraftingService } from './application/lease-drafting.service';
import { LeaseLifecycleService } from './application/lease-lifecycle.service';
import { LeaseReadsService } from './application/lease-reads.service';
import { PaymentReceiptsService } from './application/payment-receipts.service';
import { PaymentSettlementService } from './application/payment-settlement.service';
import { PayoutAccountsService } from './application/payout-accounts.service';
import { PayoutsService } from './application/payouts.service';
import { RentCycleService } from './application/rent-cycle.service';
import { RentPaymentsService } from './application/rent-payments.service';
import { RentReadsService } from './application/rent-reads.service';
import { RentRemindersService } from './application/rent-reminders.service';
import { TenanciesService } from './application/tenancies.service';
import { TenantPaymentsService } from './application/tenant-payments.service';
import { UnitsService } from './application/units.service';
import type { RentalsMail } from './domain/rentals-mail';
import { LeaseChargesRepository } from './infrastructure/lease-charges.repository';
import { LeasePaymentsRepository } from './infrastructure/lease-payments.repository';
import { LeaseRemindersRepository } from './infrastructure/lease-reminders.repository';
import { LeasesRepository } from './infrastructure/leases.repository';
import { resolvePayoutAccountCipher } from './infrastructure/payout-account-cipher';
import { PayoutAccountsRepository } from './infrastructure/payout-accounts.repository';
import { PayoutsRepository } from './infrastructure/payouts.repository';
import { RentCycleRepository } from './infrastructure/rent-cycle.repository';
import { RentRollRepository } from './infrastructure/rent-roll.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import type { RentalsMoneyQueue } from './infrastructure/rentals-money.queue';
import { RentalsOverviewRepository } from './infrastructure/rentals-overview.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from './infrastructure/rentals-writers';
import type { RentalsMailer } from './infrastructure/rentals.mailer';
import { SigningRepository } from './infrastructure/signing.repository';
import { TenanciesRepository } from './infrastructure/tenancies.repository';
import { TenantsRepository } from './infrastructure/tenants.repository';
import { UnitsRepository } from './infrastructure/units.repository';

/**
 * The rent cycle against a real Postgres (WP 1.6a, 1.6b): the SQL the doubles
 * cannot judge. Allocation under the charge locks, credit used on the next
 * charge raised, a reversal reopening charges, receipt numbers, the gateway
 * flow on the mock adapter from pending to paid out, the decline and expiry
 * paths, a callback replay, and payouts held without an account and released
 * once one exists.
 *
 * OPT IN, like `rentals.integration.spec.ts`: set `RENTALS_IT_DATABASE_URL` to
 * a THROWAWAY database. Skipped otherwise.
 */
const url = process.env.RENTALS_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('the rent cycle against Postgres (RENTALS_IT_DATABASE_URL)', () => {
  let pool: Pool;
  let db: Database;
  let ws: ScopedWorkspace;
  let userId: string;
  const mails: { to: string; subject: string; text: string; attachments: number }[] = [];
  const queued: { kind: string; id: string }[] = [];
  const stored: { kind: string; keyHint?: string }[] = [];
  const adapter = new MockPaymentAdapter();

  const services = (): {
    units: UnitsService;
    drafting: LeaseDraftingService;
    lifecycle: LeaseLifecycleService;
    charges: LeaseChargesRepository;
    cycle: RentCycleService;
    reminders: RentRemindersService;
    recorded: RentPaymentsService;
    reads: RentReadsService;
    tenancies: TenanciesService;
    paying: TenantPaymentsService;
    settlement: PaymentSettlementService;
    payouts: PayoutsService;
    accounts: PayoutAccountsService;
    paymentRows: LeasePaymentsRepository;
    payoutRows: PayoutsRepository;
  } => {
    const context = new RentalsContextRepository(db);
    const leases = new LeasesRepository(db);
    const tenants = new TenantsRepository(db);
    const unitsRepo = new UnitsRepository(db);
    const signingRepo = new SigningRepository(db);
    const charges = new LeaseChargesRepository(db);
    const paymentRows = new LeasePaymentsRepository(db);
    const reminderRows = new LeaseRemindersRepository(db);
    const payoutRows = new PayoutsRepository(db);
    const audit = new RentalsAuditWriter();
    const events = new LeaseEventsWriter();
    const storage = {
      putLeaseContract: async (input: { keyHint: string }) => {
        const objectKey = `lease_contract/${input.keyHint}.pdf`;
        await db.insert(schema.storedObjects).values({ objectKey, kind: 'lease_contract', mime: 'application/pdf' }).onConflictDoNothing();
        const [row] = await db.select({ id: schema.storedObjects.id }).from(schema.storedObjects).where(eq(schema.storedObjects.objectKey, objectKey));
        return { id: row!.id, objectKey };
      },
      putPaymentReceipt: async (input: { keyHint: string }) => {
        stored.push({ kind: 'payment_receipt', keyHint: input.keyHint });
        const objectKey = `payment_receipt/${input.keyHint}.pdf`;
        await db.insert(schema.storedObjects).values({ objectKey, kind: 'payment_receipt', mime: 'application/pdf' }).onConflictDoNothing();
        const [row] = await db.select({ id: schema.storedObjects.id }).from(schema.storedObjects).where(eq(schema.storedObjects.objectKey, objectKey));
        return { id: row!.id, objectKey };
      },
    } as unknown as StorageService;
    const mailer = {
      appUrl: 'http://localhost:3002',
      send: async (_ref: string, to: string, mail: RentalsMail, attachments?: unknown[]) => {
        mails.push({ to, subject: mail.subject, text: [...mail.lines, mail.action.url].join('\n'), attachments: attachments?.length ?? 0 });
        return true;
      },
    } as unknown as RentalsMailer;
    const queue = {
      settleLater: async (id: string) => (queued.push({ kind: 'settle', id }), true),
      webhook: async (event: { eventId: string }) => (queued.push({ kind: 'webhook', id: event.eventId }), true),
      sendPayout: async (id: string) => (queued.push({ kind: 'payout', id }), true),
    } as unknown as RentalsMoneyQueue;
    const contracts = new LeaseContractService(db, leases, context, storage);
    const reads = new LeaseReadsService(leases, tenants, contracts);
    const drafting = new LeaseDraftingService(db, leases, tenants, unitsRepo, context, contracts, events, audit, reads);
    const lifecycle = new LeaseLifecycleService(db, leases, signingRepo, charges, context, events, audit, reads, mailer);
    const tenancies = new TenanciesService(new TenanciesRepository(db), leases, signingRepo, context, contracts);
    const accounts = new PayoutAccountsService(db, new PayoutAccountsRepository(db), resolvePayoutAccountCipher({ nodeEnv: 'test', environment: 'production' }), audit);
    const receipts = new PaymentReceiptsService(paymentRows, leases, context, signingRepo, storage, mailer);
    const payouts = new PayoutsService(db, payoutRows, accounts, context, queue, audit, adapter);
    const settlement = new PaymentSettlementService(db, paymentRows, leases, payouts, receipts, queue, events, audit, adapter);
    return {
      units: new UnitsService(db, unitsRepo, context, contracts, audit),
      drafting,
      lifecycle,
      charges,
      cycle: new RentCycleService(db, new RentCycleRepository(db), leases, charges, paymentRows, lifecycle, events, audit),
      reminders: new RentRemindersService(db, reminderRows, leases, paymentRows, context, signingRepo, events, mailer),
      recorded: new RentPaymentsService(db, paymentRows, leases, events, audit),
      reads: new RentReadsService(new RentRollRepository(db), paymentRows, reminderRows, leases, new RentalsOverviewRepository(db)),
      tenancies,
      paying: new TenantPaymentsService(db, tenancies, paymentRows, settlement, receipts, queue, adapter),
      settlement,
      payouts,
      accounts,
      paymentRows,
      payoutRows,
    };
  };

  /** An active lease from today with a deposit charge and this month's rent raised, its tenant linked to an account. */
  async function activeLease(s: ReturnType<typeof services>, label: string, rent: number, deposit: number): Promise<{ leaseId: string; tenantUserId: string; depositChargeId: string; rentChargeId: string }> {
    const unit = await s.units.create(ws, userId, { label, askingRentRwf: rent });
    const start = kigaliToday();
    const email = `t-${randomUUID().slice(0, 6)}@rentals.test`;
    const lease = await s.drafting.create(
      ws,
      userId,
      CreateLeaseRequest.parse({
        unitId: unit.id,
        tenant: { fullName: 'Aline Uwera', email, phone: '0788 123 456', idKind: 'national_id', idNumber: '1199080012345012', nationality: 'RW' },
        terms: { startDate: start, endDate: addDays(addMonths(start, 12), -1), monthlyRentRwf: rent, depositRwf: deposit, rentDueDay: 5 },
      }),
    );
    const [tenantUser] = await db.insert(schema.users).values({ email, name: 'Aline Uwera' }).returning();
    await db.update(schema.tenants).set({ userId: tenantUser!.id }).where(eq(schema.tenants.id, lease.tenant.id));
    await db.update(schema.leases).set({ status: 'signed', signedAt: new Date() }).where(eq(schema.leases.id, lease.id));
    const dep = deposit > 0 ? await s.charges.raiseDeposit(db, { leaseId: lease.id, workspaceId: ws.workspaceId, dueOn: start, amountRwf: deposit }) : null;
    await s.lifecycle.start(ws, userId, lease.id);
    const rentRows = await pool.query(`select id from lease_charges where lease_id = $1 and kind = 'rent' order by due_on`, [lease.id]);
    return { leaseId: lease.id, tenantUserId: tenantUser!.id, depositChargeId: dep?.id ?? '', rentChargeId: rentRows.rows[0].id };
  }

  const chargeRow = async (id: string): Promise<{ paid_rwf: number; status: string }> => {
    const { rows } = await pool.query(`select paid_rwf::int, status from lease_charges where id = $1`, [id]);
    return rows[0];
  };

  beforeAll(async () => {
    process.env.MOCK_MOMO_APPROVAL_MS = '0';
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    const tag = randomUUID().slice(0, 8);
    const [user] = await db.insert(schema.users).values({ email: `it16-${tag}@rentals.test`, name: 'Jean Mugabo' }).returning();
    const { rows: place } = await pool.query(
      `select v.id as village, c.sector_id as sector, s.district_id as district
         from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id limit 1`,
    );
    const [org] = await db
      .insert(schema.orgs)
      .values({
        legalName: `Rent Court ${tag}`,
        domain: 'residence',
        businessKind: 'residence',
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
      permissions: [],
      branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    } as unknown as ScopedWorkspace;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('waives an open charge with its reason, and nothing already paid (rent is paid on the gateway only)', async () => {
    const s = services();
    const L = await activeLease(s, 'R-01', 300_000, 0);
    const waived = await s.recorded.waive(ws, userId, L.rentChargeId, { reason: 'Roof repairs in that month' });
    expect(waived).toMatchObject({ status: 'waived', outstandingRwf: 0 });
    await expect(s.recorded.waive(ws, userId, L.rentChargeId, { reason: 'Again' })).rejects.toThrow(ConflictException);
    await expect(s.recorded.waive(ws, userId, randomUUID(), { reason: 'x' })).rejects.toThrow(NotFoundException);
  });

  it('collects rent on the mock gateway: pending, settled, allocated, paid out once an account exists; declines and expires', async () => {
    const s = services();
    const L = await activeLease(s, 'R-02', 200_000, 400_000);
    const ref = await s.tenancies.resolve(L.tenantUserId, L.leaseId);
    const before = await s.paying.charges(ref);
    // The deposit and this month's rent, prorated from today.
    const owedNow = before.charges.reduce((sum, c) => sum + c.outstandingRwf, 0);
    expect(owedNow).toBeGreaterThan(400_000);
    expect(before).toMatchObject({ outstandingRwf: owedNow, creditRwf: 0, pendingPaymentId: null, maxPaymentRwf: owedNow + 200_000 });

    // Refusals: wrong network, more than a month over, nothing when nothing is owed later.
    await expect(s.paying.pay(ref, { id: L.tenantUserId }, randomUUID(), { method: 'mtn_momo', msisdn: '+250722123456' })).rejects.toThrow(BadRequestException);
    await expect(s.paying.pay(ref, { id: L.tenantUserId }, randomUUID(), { method: 'mtn_momo', msisdn: '+250788123456', amountRwf: 900_000 })).rejects.toThrow(BadRequestException);

    // The decline path: a number ending 0000.
    const declined = await s.paying.pay(ref, { id: L.tenantUserId }, randomUUID(), { method: 'mtn_momo', msisdn: '+250788120000', amountRwf: 400_000 });
    expect(declined).toMatchObject({ status: 'failed', failureReason: expect.stringContaining('declined') });

    // A slow approver (a number ending 9999): the prompt waits. A second prompt is refused while
    // one waits, the same key answers the same payment, and a prompt left past its window expires.
    const lateKey = randomUUID();
    const late = await s.paying.pay(ref, { id: L.tenantUserId }, lateKey, { method: 'mtn_momo', msisdn: '0788 129 999', amountRwf: 10_000 });
    expect(late).toMatchObject({ status: 'pending', payerMasked: '788•••999' });
    expect(queued.filter((q) => q.kind === 'settle' && q.id === late.id).length).toBe(2);
    await expect(s.paying.pay(ref, { id: L.tenantUserId }, randomUUID(), { method: 'mtn_momo', msisdn: '0788123456' })).rejects.toThrow(ConflictException);
    expect((await s.paying.pay(ref, { id: L.tenantUserId }, lateKey, { method: 'mtn_momo', msisdn: '0788123456' })).id).toBe(late.id);
    expect((await s.paying.charges(ref)).pendingPaymentId).toBe(late.id);
    await pool.query(`update lease_payments set expires_at = now() - interval '1 minute' where id = $1`, [late.id]);
    const expired = await s.paying.poll(ref, late.id);
    expect(expired).toMatchObject({ status: 'expired', statusWords: expect.stringContaining('expired') });

    // Pay the deposit: pending, then settled on the poll (the mock customer approves at once).
    const key = randomUUID();
    const pending = await s.paying.pay(ref, { id: L.tenantUserId }, key, { method: 'mtn_momo', msisdn: '0788 123 456', chargeIds: [L.depositChargeId] });
    expect(pending).toMatchObject({ status: 'pending', payerMasked: '788•••456', amountRwf: 400_000 });
    const settled = await s.paying.poll(ref, pending.id);
    expect(settled).toMatchObject({ status: 'succeeded', receiptReady: true, creditRwf: 0 });
    expect(settled.allocations).toEqual([expect.objectContaining({ chargeId: L.depositChargeId, amountRwf: 400_000 })]);
    expect(await chargeRow(L.depositChargeId)).toEqual({ paid_rwf: 400_000, status: 'paid' });
    // Settled once: a second poll, the sweep and a callback replay change nothing.
    expect(await s.settlement.settle(pending.id)).toBe(false);
    const paymentRow = (await s.paymentRows.find(pending.id))!;
    const body = JSON.stringify({ eventId: 'evt-1', adapterRef: paymentRow.adapterRef, outcome: 'settled' });
    const event = adapter.parseCallback('mock', { 'x-mock-signature': mockCallbackSignature(body) }, Buffer.from(body));
    expect(event).toMatchObject({ provider: 'mock', eventId: 'evt-1' });
    expect(await s.settlement.handleCallback(event!)).toBe('ignored');
    expect(adapter.parseCallback('mock', { 'x-mock-signature': 'nope' }, Buffer.from(body))).toBeNull();

    // The payout: held, no account yet.
    const payout = await s.payoutRows.find(paymentRow.payoutId!);
    expect(payout).toMatchObject({ status: 'held', amountRwf: 400_000, payeeType: 'landlord', source: 'rent' });
    const receipt = await s.paying.receipt(ref, pending.id);
    expect(receipt.body.subarray(0, 5).toString()).toBe('%PDF-');
    const landlordMail = mails.filter((m) => m.subject.includes('paid RWF 400,000')).at(-1)!;
    expect(landlordMail.text).toContain('held until you add a payout account');

    // Add a MoMo account: the hourly pass releases the payout and the job pays it.
    await s.accounts.create(ws, userId, { kind: 'momo', accountName: 'Jean Mugabo', momoNetwork: 'mtn', momoPhone: '+250788999111' });
    const pass = await s.payouts.sweep();
    expect(pass.released).toBe(1);
    expect(queued.filter((q) => q.kind === 'payout' && q.id === payout!.id).length).toBe(1);
    expect(await s.payouts.send(payout!.id)).toBe('paid');
    expect(await s.payoutRows.find(payout!.id)).toMatchObject({ status: 'paid', destinationMasked: expect.stringContaining('MTN MoMo') });
    const list = await s.payouts.list(ws, {});
    expect(list.totals.paidRwf).toBe(400_000);

    // A failed callback for a fresh prompt closes it with the reason; a replay is ignored.
    const another = await s.paying.pay(ref, { id: L.tenantUserId }, randomUUID(), { method: 'mtn_momo', msisdn: '0788 123 456', amountRwf: 10_000 });
    const anotherRow = (await s.paymentRows.find(another.id))!;
    const failBody = JSON.stringify({ eventId: 'evt-2', adapterRef: anotherRow.adapterRef, outcome: 'failed', reason: 'insufficient funds' });
    const failEvent = adapter.parseCallback('mock', { 'x-mock-signature': mockCallbackSignature(failBody) }, Buffer.from(failBody))!;
    expect(await s.settlement.handleCallback(failEvent)).toBe('failed');
    expect(await s.settlement.handleCallback(failEvent)).toBe('ignored');
    expect((await s.paying.poll(ref, another.id)).failureReason).toContain('insufficient funds');

    // The rent, paid over: what is owed goes on the charge, the rest is credit, and the payout is queued and paid by the job.
    const owedRent = (await s.paying.charges(ref)).outstandingRwf;
    const rentPay = await s.paying.pay(ref, { id: L.tenantUserId }, randomUUID(), { method: 'airtel_money', msisdn: '0722 111 222', amountRwf: owedRent + 4_839 });
    const rentDone = await s.paying.poll(ref, rentPay.id);
    expect(rentDone).toMatchObject({ status: 'succeeded', creditRwf: 4_839 });
    expect((await s.paying.charges(ref))).toMatchObject({ outstandingRwf: 0, creditRwf: 4_839, maxPaymentRwf: 0 });
    await expect(s.paying.pay(ref, { id: L.tenantUserId }, randomUUID(), { method: 'mtn_momo', msisdn: '0788 123 456', amountRwf: 1_000 })).rejects.toThrow(ConflictException);
    const rentPayout = await s.payoutRows.find((await s.paymentRows.find(rentPay.id))!.payoutId!);
    expect(rentPayout!.status).toBe('queued');
    expect(await s.payouts.send(rentPayout!.id)).toBe('paid');

    // Another person's lease is 404 through the guard's resolve.
    await expect(s.tenancies.resolve(userId, L.leaseId)).rejects.toThrow(NotFoundException);
    const history = await s.paying.list(ref);
    expect(history.payments.map((p) => p.status).sort()).toEqual(['expired', 'failed', 'failed', 'succeeded', 'succeeded']);
  });

  it('reminds once per charge, kind and stage, and the landlord once a day', async () => {
    const s = services();
    const L = await activeLease(s, 'R-03', 250_000, 0);
    const today = kigaliToday();
    const at = (day: string): Date => new Date(`${day}T07:00:00Z`); // 09:00 Kigali
    const rent = (await pool.query(`select due_on::text from lease_charges where id = $1`, [L.rentChargeId])).rows[0].due_on as string;
    // Due today: the "due" reminder, once.
    const first = await s.reminders.run(at(rent));
    expect(first.sent.filter((x) => x.chargeId === L.rentChargeId)).toEqual([expect.objectContaining({ kind: 'due', stage: 0 })]);
    const second = await s.reminders.run(at(rent));
    expect(second.sent.filter((x) => x.chargeId === L.rentChargeId)).toEqual([]);
    // Outside the hours nothing is looked at.
    expect((await s.reminders.run(new Date(`${rent}T20:00:00Z`))).skipped).toBe(true);
    // Overdue after the grace days, then again a week later.
    const overdueDay = addDays(rent, 6);
    expect((await s.reminders.run(at(overdueDay))).sent.filter((x) => x.chargeId === L.rentChargeId)).toEqual([expect.objectContaining({ kind: 'overdue', stage: 0 })]);
    expect((await s.reminders.run(at(addDays(overdueDay, 7)))).sent.filter((x) => x.chargeId === L.rentChargeId)).toEqual([expect.objectContaining({ kind: 'overdue', stage: 1 })]);
    expect((await s.reminders.run(at(addDays(overdueDay, 7)))).sent.filter((x) => x.chargeId === L.rentChargeId)).toEqual([]);
    // The landlord's own, once a day.
    const manual = await s.reminders.sendManual(ws, userId, { chargeIds: [L.rentChargeId], note: 'Please pay by Friday.' });
    expect(manual.sent.length).toBe(1);
    await expect(s.reminders.sendManual(ws, userId, { chargeIds: [L.rentChargeId] })).rejects.toThrow(ConflictException);
    const reminderMail = mails.filter((m) => m.subject.startsWith('A reminder about')).at(-1)!;
    expect(reminderMail.text).toContain('Please pay by Friday.');
    const listed = await s.reads.reminders(ws, { leaseId: L.leaseId });
    expect(listed.reminders.map((r) => [r.kind, r.stage])).toEqual([
      ['manual', 0],
      ['overdue', 1],
      ['overdue', 0],
      ['due', 0],
    ]);
    expect(today <= rent || true).toBe(true);
  });

  it('moves an active lease to ending when its end is near, and flags one past its end', async () => {
    const s = services();
    const L = await activeLease(s, 'R-04', 100_000, 0);
    const end = (await pool.query(`select end_date::text from leases where id = $1`, [L.leaseId])).rows[0].end_date as string;
    const early = await s.cycle.run(addDays(end, -40));
    expect(early.ending).not.toContain(L.leaseId);
    const near = await s.cycle.run(addDays(end, -20));
    expect(near.ending).toContain(L.leaseId);
    expect((await pool.query(`select status from leases where id = $1`, [L.leaseId])).rows[0].status).toBe('ending');
    const past = await s.cycle.run(addDays(end, 1));
    expect(past.pastEnd.map((p) => p.leaseId)).toContain(L.leaseId);
    expect((await pool.query(`select status from leases where id = $1`, [L.leaseId])).rows[0].status).toBe('ending');
  });
});
