import { randomUUID } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { CreateLeaseRequest, addDays, addMonths, kigaliToday } from '@injishi/contracts';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../shared/auth/branch-scope';
import type { Database } from '../../shared/database/database.module';
import type { StorageService } from '../storage/application/storage.service';
import { LeaseContractService } from './application/lease-contract.service';
import { LeaseDraftingService } from './application/lease-drafting.service';
import { LeaseReadsService } from './application/lease-reads.service';
import { PayoutAccountsService } from './application/payout-accounts.service';
import { UnitsService } from './application/units.service';
import { LeasesRepository } from './infrastructure/leases.repository';
import { resolvePayoutAccountCipher } from './infrastructure/payout-account-cipher';
import { PayoutAccountsRepository } from './infrastructure/payout-accounts.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from './infrastructure/rentals-writers';
import { TenantsRepository } from './infrastructure/tenants.repository';
import { UnitsRepository } from './infrastructure/units.repository';

/**
 * The rentals services against a real Postgres migrated to the latest schema:
 * the SQL the doubles cannot judge (the overlap test, the reference counter,
 * the charges summary, the version freeze, the unique primary payout account,
 * the residence building made on the first unit).
 *
 * OPT IN: set `RENTALS_IT_DATABASE_URL` to a THROWAWAY database (never the
 * testing database people sign in to): the spec writes its own business,
 * owner and leases there and does not clean up. Skipped otherwise, so the
 * suite needs no database.
 *
 *   RENTALS_IT_DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5434/injishi_migtest \
 *     npx jest src/modules/rentals/rentals.integration.spec.ts
 */
const url = process.env.RENTALS_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('rentals against Postgres (RENTALS_IT_DATABASE_URL)', () => {
  let pool: Pool;
  let db: Database;
  let ws: ScopedWorkspace;
  let userId: string;
  const pdfs: Buffer[] = [];

  const services = (): {
    units: UnitsService;
    drafting: LeaseDraftingService;
    reads: LeaseReadsService;
    contracts: LeaseContractService;
    payouts: PayoutAccountsService;
  } => {
    const context = new RentalsContextRepository(db);
    const leases = new LeasesRepository(db);
    const tenants = new TenantsRepository(db);
    const unitsRepo = new UnitsRepository(db);
    const audit = new RentalsAuditWriter();
    const storage = {
      putLeaseContract: async (input: { body: Buffer }) => {
        pdfs.push(input.body);
        const [row] = await db
          .insert(schema.storedObjects)
          .values({ objectKey: `lease_contract/${randomUUID()}.pdf`, kind: 'lease_contract', mime: 'application/pdf' })
          .returning({ id: schema.storedObjects.id, objectKey: schema.storedObjects.objectKey });
        return { id: row!.id, objectKey: row!.objectKey };
      },
      readBytes: async () => pdfs[pdfs.length - 1] as Buffer,
    } as unknown as StorageService;
    const contracts = new LeaseContractService(db, leases, context, storage);
    const reads = new LeaseReadsService(leases, tenants, contracts);
    return {
      units: new UnitsService(db, unitsRepo, context, contracts, audit),
      drafting: new LeaseDraftingService(db, leases, tenants, unitsRepo, context, contracts, new LeaseEventsWriter(), audit, reads),
      reads,
      contracts,
      payouts: new PayoutAccountsService(
        db,
        new PayoutAccountsRepository(db),
        resolvePayoutAccountCipher({ nodeEnv: 'test', environment: 'production' }),
        audit,
      ),
    };
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    const tag = randomUUID().slice(0, 8);
    const [user] = await db.insert(schema.users).values({ email: `it-${tag}@rentals.test`, name: 'Jean Mugabo' }).returning();
    const { rows: place } = await pool.query(
      `select v.id as village, c.sector_id as sector, s.district_id as district
         from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id limit 1`,
    );
    const [org] = await db
      .insert(schema.orgs)
      .values({
        legalName: `Integration Court ${tag}`,
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
      permissions: [],
      branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    } as unknown as ScopedWorkspace;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('drafts, edits, refuses an overlap with a live lease, prints the PDF and cancels', async () => {
    const s = services();
    const unit = await s.units.create(ws, userId, { label: 'A-01', askingRentRwf: 400_000, askingDepositRwf: 800_000 });
    expect(unit).toMatchObject({ label: 'A-01', propertyName: expect.stringMatching(/^Integration Court/), occupancy: 'vacant' });

    const start = addDays(kigaliToday(), 7);
    const end = addDays(addMonths(start, 12), -1);
    const body = CreateLeaseRequest.parse({
      unitId: unit.id,
      tenant: {
        fullName: 'Aline Uwera',
        email: `aline-${randomUUID().slice(0, 6)}@example.rw`,
        phone: '0788123456',
        idKind: 'national_id',
        idNumber: '1199080012345012',
        nationality: 'RW',
      },
      terms: { startDate: start, endDate: end, monthlyRentRwf: 400_000, depositRwf: 800_000 },
    });
    const first = await s.drafting.create(ws, userId, body);
    expect(first).toMatchObject({ reference: 'L-0001', status: 'draft', tab: 'to_sign', terms: { graceDays: 5, noticeDays: 15 } });
    expect(first.currentVersion?.version).toBe(1);
    expect(first.contractProblems).toContain('Say who signs leases for the business, with their ID number, phone and email.');

    // The same email again links the same tenant.
    const second = await s.drafting.create(ws, userId, { ...body, terms: { ...body.terms } });
    expect(second.reference).toBe('L-0002');
    expect(second.tenant.id).toBe(first.tenant.id);

    // An edit writes version 2; an edit to the same values writes nothing.
    const edited = await s.drafting.edit(ws, userId, first.id, { terms: { monthlyRentRwf: 420_000 } });
    expect(edited.currentVersion?.version).toBe(2);
    const same = await s.drafting.edit(ws, userId, first.id, { terms: { monthlyRentRwf: 420_000 } });
    expect(same.currentVersion?.version).toBe(2);

    // A live lease on the unit (as if signed): a new draft over those days is refused in words.
    await db.update(schema.leases).set({ status: 'pending_signature' }).where(eq(schema.leases.id, first.id));
    const clash = await s.drafting.create(ws, userId, body).catch((e: unknown) => e);
    expect(clash).toBeInstanceOf(ConflictException);
    expect((clash as ConflictException).getResponse()).toMatchObject({ code: 'unit_taken', message: expect.stringContaining('Unit A-01 is let to Aline Uwera') });

    const counts = await s.reads.counts(ws);
    expect(counts.counts).toMatchObject({ to_sign: 1, waiting_for_tenant: 1 });
    const page = await s.reads.list(ws, { tab: 'to_sign', page: 1 });
    expect(page.items.map((i) => i.reference)).toEqual(['L-0002']);
    const detail = await s.reads.detail(ws, first.id);
    expect(detail.charges).toMatchObject({ rentChargedRwf: 0, balanceRwf: 0, nextDue: null, depositAgreedRwf: 800_000 });

    const pdf = await s.contracts.pdf(ws, second.id);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.filename).toBe('L-0002-v1.pdf');

    const events = await s.reads.events(ws, first.id);
    expect(events.events.map((e) => e.kind)).toEqual(['terms_edited', 'created']);

    const cancelled = await s.drafting.cancel(ws, userId, second.id, { reason: 'Drafted twice' });
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelReason: 'Drafted twice' });
  });

  it('keeps one primary payout account per business, numbers sealed', async () => {
    const s = services();
    await s.payouts.create(ws, userId, { kind: 'bank', accountName: 'Integration Court', bankName: 'Bank of Kigali', accountNumber: '000123456789' });
    const { accounts } = await s.payouts.create(ws, userId, { kind: 'momo', accountName: 'Jean Mugabo', momoNetwork: 'mtn', momoPhone: '+250788123456', makePrimary: true });
    expect(accounts.map((a) => [a.kind, a.isPrimary])).toEqual([
      ['momo', true],
      ['bank', false],
    ]);
    const { rows } = await pool.query(`select account_number_ciphertext, account_last4 from payout_accounts where org_id = $1 and kind = 'bank'`, [ws.orgId]);
    expect(rows[0].account_last4).toBe('6789');
    expect(rows[0].account_number_ciphertext).not.toContain('000123456789');
  });
});
