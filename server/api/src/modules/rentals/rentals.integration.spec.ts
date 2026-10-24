import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateLeaseRequest, SignatoryRequest, addDays, addMonths, kigaliToday } from '@injishi/contracts';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../shared/auth/branch-scope';
import type { Database } from '../../shared/database/database.module';
import type { StorageService } from '../storage/application/storage.service';
import { LeaseContractService } from './application/lease-contract.service';
import { LeaseDocumentsService } from './application/lease-documents.service';
import { LeaseDraftingService } from './application/lease-drafting.service';
import { LeaseInvitationsService } from './application/lease-invitations.service';
import { LeaseLifecycleService } from './application/lease-lifecycle.service';
import { LeaseReadsService } from './application/lease-reads.service';
import { LeaseSigningService } from './application/lease-signing.service';
import { PayoutAccountsService } from './application/payout-accounts.service';
import { RentalsProfileService } from './application/rentals-profile.service';
import { TenanciesService } from './application/tenancies.service';
import { UnitsService } from './application/units.service';
import type { RentalsMail } from './domain/rentals-mail';
import { LeaseChargesRepository } from './infrastructure/lease-charges.repository';
import type { LeaseDocumentsQueue, SignedCopyJob } from './infrastructure/lease-documents.queue';
import { LeaseDocumentsRepository } from './infrastructure/lease-documents.repository';
import { LeasesRepository } from './infrastructure/leases.repository';
import { resolvePayoutAccountCipher } from './infrastructure/payout-account-cipher';
import { PayoutAccountsRepository } from './infrastructure/payout-accounts.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from './infrastructure/rentals-writers';
import type { RentalsMailer } from './infrastructure/rentals.mailer';
import type { SignerPasswordVerifier } from './infrastructure/signer-password';
import { SigningRepository } from './infrastructure/signing.repository';
import { TenanciesRepository } from './infrastructure/tenancies.repository';
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
  const pdfs = new Map<string, Buffer>();
  /** Every email the services sent, in order. */
  const mails: { to: string; subject: string; text: string; code?: string; attachments: number }[] = [];
  const queued: SignedCopyJob[] = [];

  const services = (): {
    units: UnitsService;
    drafting: LeaseDraftingService;
    reads: LeaseReadsService;
    contracts: LeaseContractService;
    payouts: PayoutAccountsService;
    profile: RentalsProfileService;
    signing: LeaseSigningService;
    invitations: LeaseInvitationsService;
    lifecycle: LeaseLifecycleService;
    tenancies: TenanciesService;
    documents: LeaseDocumentsService;
  } => {
    const context = new RentalsContextRepository(db);
    const leases = new LeasesRepository(db);
    const tenants = new TenantsRepository(db);
    const unitsRepo = new UnitsRepository(db);
    const signingRepo = new SigningRepository(db);
    const charges = new LeaseChargesRepository(db);
    const audit = new RentalsAuditWriter();
    const events = new LeaseEventsWriter();
    const storage = {
      putLeaseContract: async (input: { body: Buffer; keyHint: string; legalHold: boolean }) => {
        const objectKey = `lease_contract/${input.keyHint}.pdf`;
        pdfs.set(objectKey, input.body);
        await db
          .insert(schema.storedObjects)
          .values({ objectKey, kind: 'lease_contract', mime: 'application/pdf', legalHold: input.legalHold })
          .onConflictDoNothing();
        const [row] = await db.select({ id: schema.storedObjects.id }).from(schema.storedObjects).where(eq(schema.storedObjects.objectKey, objectKey));
        return { id: row!.id, objectKey };
      },
      readBytes: async (key: string) => pdfs.get(key) as Buffer,
      describe: async (key: string) => {
        const [row] = await db.select().from(schema.storedObjects).where(eq(schema.storedObjects.objectKey, key));
        return row ? { id: row.id, objectKey: row.objectKey, kind: row.kind, uploadedByUserId: row.uploadedByUserId, legalHold: row.legalHold } : null;
      },
      holdObject: async (id: string) => {
        await db.update(schema.storedObjects).set({ legalHold: true }).where(eq(schema.storedObjects.id, id));
      },
    } as unknown as StorageService;
    const mailer = {
      appUrl: 'http://localhost:3002',
      signingCode: async (to: string, code: string) => {
        mails.push({ to, subject: 'code', text: code, code, attachments: 0 });
        return true;
      },
      send: async (_ref: string, to: string, mail: RentalsMail, attachments?: unknown[]) => {
        mails.push({ to, subject: mail.subject, text: [...mail.lines, mail.action.url].join('\n'), attachments: attachments?.length ?? 0 });
        return true;
      },
    } as unknown as RentalsMailer;
    const contracts = new LeaseContractService(db, leases, context, storage);
    const reads = new LeaseReadsService(leases, tenants, contracts);
    const drafting = new LeaseDraftingService(db, leases, tenants, unitsRepo, context, contracts, events, audit, reads);
    const tenancies = new TenanciesService(new TenanciesRepository(db), leases, signingRepo, context, contracts);
    const invitations = new LeaseInvitationsService(db, leases, signingRepo, context, events, audit, reads, drafting, tenancies, mailer);
    const documentsQueue = { signedCopy: async (job: SignedCopyJob) => (queued.push(job), true) } as unknown as LeaseDocumentsQueue;
    const passwords = { verify: async () => false } as unknown as SignerPasswordVerifier;
    return {
      units: new UnitsService(db, unitsRepo, context, contracts, audit),
      drafting,
      reads,
      contracts,
      profile: new RentalsProfileService(db, context, contracts),
      signing: new LeaseSigningService(
        db,
        leases,
        signingRepo,
        charges,
        contracts,
        events,
        audit,
        reads,
        tenancies,
        invitations,
        storage,
        passwords,
        mailer,
        documentsQueue,
      ),
      invitations,
      lifecycle: new LeaseLifecycleService(db, leases, signingRepo, charges, context, events, audit, reads, mailer),
      tenancies,
      documents: new LeaseDocumentsService(db, leases, signingRepo, new LeaseDocumentsRepository(db), context, contracts, mailer),
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

    const cancelled = await s.lifecycle.cancel(ws, userId, second.id, { reason: 'Drafted twice' });
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelReason: 'Drafted twice' });
  });

  it('signs on both sides, invites and links the tenant, sends the signed copy once, and starts the tenancy', async () => {
    const s = services();
    await s.profile.setSignatory(
      ws,
      userId,
      SignatoryRequest.parse({
        name: 'Jean Mugabo',
        idKind: 'national_id',
        idNumber: '1198780012345678',
        contactPhone: '0788 111 222',
        contactEmail: `owner-${randomUUID().slice(0, 6)}@rentals.test`,
      }),
    );
    const landlord = { id: userId, email: (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0]!.email };
    const unit = await s.units.create(ws, userId, { label: 'S-01', askingRentRwf: 300_000 });
    const start = kigaliToday();
    const tenantEmail = `tenant-${randomUUID().slice(0, 6)}@rentals.test`;
    const lease = await s.drafting.create(
      ws,
      userId,
      CreateLeaseRequest.parse({
        unitId: unit.id,
        tenant: { fullName: 'Aimée Uwera', email: tenantEmail, phone: '0788 333 444', idKind: 'passport', idNumber: 'PC123456', nationality: 'UG' },
        terms: { startDate: start, endDate: addDays(addMonths(start, 12), -1), monthlyRentRwf: 300_000, depositRwf: 600_000, rentDueDay: 5 },
      }),
    );
    expect(lease.contractProblems).toEqual([]);
    const contract = await s.reads.contract(ws, lease.id);
    const hash = contract.version.contentHash;

    // The landlord's code, a wrong try, a wrong name, then the signature.
    const sent = await s.signing.landlordCode(ws, landlord, lease.id);
    expect(sent).toMatchObject({ sent: true, expiresInSeconds: 600, resendInSeconds: 60 });
    expect(await s.signing.landlordCode(ws, landlord, lease.id)).toMatchObject({ sent: false });
    const code = mails.filter((m) => m.code).at(-1)!.code!;
    const wrong = code === '000000' ? '111111' : '000000';
    await expect(s.signing.signAsLandlord(ws, landlord, lease.id, { typedName: 'Jean Mugabo', code: wrong, documentHash: hash }, { ip: null, userAgent: null })).rejects.toThrow(BadRequestException);
    const tries = await pool.query(`select attempts from lease_signing_codes where lease_id = $1 and consumed_at is null`, [lease.id]);
    expect(tries.rows[0].attempts).toBe(1);
    await expect(s.signing.signAsLandlord(ws, landlord, lease.id, { typedName: 'Jean M.', code, documentHash: hash }, { ip: null, userAgent: null })).rejects.toThrow(BadRequestException);
    const out = await s.signing.signAsLandlord(ws, landlord, lease.id, { typedName: ' jean  mugabo ', code, documentHash: hash }, { ip: '127.0.0.1', userAgent: 'jest' });
    expect(out).toMatchObject({ status: 'pending_signature', invitation: { status: 'sent', email: tenantEmail, sendCount: 1 } });
    await new Promise((r) => setTimeout(r, 50));
    const invite = mails.filter((m) => m.to === tenantEmail).at(-1)!;
    const token = /\/invite\/lease\/([A-Za-z0-9_-]+)/.exec(invite.text)![1]!;

    // The preview, and accepting from the wrong account and then the right one.
    expect(await s.invitations.preview(token)).toMatchObject({ state: 'open', unitLabel: 'S-01', monthlyRentRwf: 300_000, invitedEmail: expect.stringContaining('••') });
    const [stranger] = await db.insert(schema.users).values({ email: `other-${randomUUID().slice(0, 6)}@rentals.test` }).returning();
    await expect(s.invitations.accept({ id: stranger!.id, email: stranger!.email }, { token })).rejects.toThrow(ForbiddenException);
    const [tenantUser] = await db.insert(schema.users).values({ email: tenantEmail, name: 'Aimée Uwera' }).returning();
    const tenant = { id: tenantUser!.id, email: tenantEmail.toUpperCase() };
    const accepted = await s.invitations.accept(tenant, { token });
    expect(accepted).toMatchObject({ status: 'pending_signature', needsMySignature: true, landlord: { signatoryName: 'Jean Mugabo' } });
    expect((await s.invitations.accept(tenant, { token })).id).toBe(lease.id);
    await expect(s.tenancies.resolve(stranger!.id, lease.id)).rejects.toThrow(NotFoundException);
    const ref = await s.tenancies.resolve(tenant.id, lease.id);

    // The tenant signs: the lease is signed, the deposit raised, the signed copy queued.
    await s.signing.tenantCode(ref, tenant);
    const tenantCode = mails.filter((m) => m.code).at(-1)!.code!;
    const signed = await s.signing.signAsTenant(ref, tenant, { typedName: 'Aimee Uwera', code: tenantCode, documentHash: hash }, { ip: '127.0.0.2', userAgent: 'jest' });
    expect(signed).toMatchObject({ status: 'signed', needsMySignature: false, charges: { balanceRwf: 600_000, depositStatus: 'awaiting' } });
    expect(queued.at(-1)).toMatchObject({ leaseId: lease.id });

    // The signed copy: made and mailed once to both sides.
    const versionId = queued.at(-1)!.versionId;
    const before = mails.length;
    expect(await s.documents.deliverSignedCopy(versionId)).toBe('sent');
    const copies = mails.slice(before);
    expect(copies.map((m) => m.attachments)).toEqual(copies.map(() => 1));
    expect(copies.map((m) => m.to)).toEqual(expect.arrayContaining([tenantEmail, landlord.email]));
    expect(await s.documents.deliverSignedCopy(versionId)).toBe('already_sent');
    expect(mails.length).toBe(before + copies.length);
    const ready = await pool.query(`select count(*)::int as n from lease_events where lease_id = $1 and kind = 'signed_copy_ready'`, [lease.id]);
    expect(ready.rows[0].n).toBe(1);
    expect((await s.tenancies.detail(ref)).signedCopyReady).toBe(true);

    // Start: active, the rent due within 7 days raised, a repeat raises nothing.
    const started = await s.lifecycle.start(ws, userId, lease.id);
    expect(started.status).toBe('active');
    const rent = await pool.query(`select period_start::text, due_on::text, amount_rwf::int from lease_charges where lease_id = $1 and kind = 'rent'`, [lease.id]);
    expect(rent.rows.length).toBeGreaterThanOrEqual(1);
    expect(rent.rows[0].period_start).toBe(start);
    await s.lifecycle.start(ws, userId, lease.id);
    const again = await pool.query(`select count(*)::int as n from lease_charges where lease_id = $1 and kind = 'rent'`, [lease.id]);
    expect(again.rows[0].n).toBe(rent.rows.length);
    const timeline = await s.tenancies.events(ref);
    expect(timeline.events.map((e) => e.kind)).toEqual(expect.arrayContaining(['landlord_signed', 'invitation_accepted', 'tenant_signed', 'signed_copy_ready', 'started', 'charge_raised']));
    expect(timeline.events.every((e) => e.visibleToTenant)).toBe(true);
  });

  it('an edit after the landlord signed voids the signature and the link; signing again sends a new one', async () => {
    const s = services();
    const landlord = { id: userId, email: (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0]!.email };
    const unit = await s.units.create(ws, userId, { label: 'S-02', askingRentRwf: 250_000 });
    const start = addDays(kigaliToday(), 10);
    const tenantEmail = `t2-${randomUUID().slice(0, 6)}@rentals.test`;
    const lease = await s.drafting.create(
      ws,
      userId,
      CreateLeaseRequest.parse({
        unitId: unit.id,
        tenant: { fullName: 'Eric Nkusi', email: tenantEmail, phone: '0788 555 666', idKind: 'national_id', idNumber: '1199080012345099', nationality: 'RW' },
        terms: { startDate: start, endDate: addDays(addMonths(start, 6), -1), monthlyRentRwf: 250_000, depositRwf: 0 },
      }),
    );
    const signOnce = async (): Promise<string> => {
      const hash = (await s.reads.contract(ws, lease.id)).version.contentHash;
      await pool.query(`update lease_signing_codes set created_at = now() - interval '2 minutes' where lease_id = $1`, [lease.id]);
      await s.signing.landlordCode(ws, landlord, lease.id);
      const code = mails.filter((m) => m.code).at(-1)!.code!;
      await s.signing.signAsLandlord(ws, landlord, lease.id, { typedName: 'Jean Mugabo', code, documentHash: hash }, { ip: null, userAgent: null });
      await new Promise((r) => setTimeout(r, 50));
      return /\/invite\/lease\/([A-Za-z0-9_-]+)/.exec(mails.filter((m) => m.to === tenantEmail).at(-1)!.text)![1]!;
    };
    const firstToken = await signOnce();
    const edited = await s.drafting.edit(ws, userId, lease.id, { terms: { monthlyRentRwf: 260_000 } });
    expect(edited).toMatchObject({ status: 'draft', invitation: { status: 'revoked' } });
    expect(edited.signatures.every((sig) => sig.voidedAt !== null)).toBe(true);
    expect((await s.invitations.preview(firstToken)).state).toBe('revoked');
    const secondToken = await signOnce();
    expect(secondToken).not.toBe(firstToken);
    expect((await s.invitations.preview(secondToken)).state).toBe('open');

    // Cancelling a lease out for signature voids its signature and withdraws the link.
    const cancelled = await s.lifecycle.cancel(ws, userId, lease.id, { reason: 'The tenant found another home' });
    expect(cancelled.signatures.every((sig) => sig.voidedAt !== null)).toBe(true);
    expect((await s.invitations.preview(secondToken)).state).toBe('revoked');
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
