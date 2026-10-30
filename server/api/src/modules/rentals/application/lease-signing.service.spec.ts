import { describe, expect, it, vi } from 'vitest';

import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { addDays, addMonths, buildLeaseContract, contractHash, kigaliDateOf, kigaliToday, type LeaseStatus, type SignLeaseRequest } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { StorageService } from '../../storage/application/storage.service';
import { sha256Hex } from '../domain/signing-secrets';
import type { LeaseChargesRepository } from '../infrastructure/lease-charges.repository';
import type { LeaseDocumentsQueue } from '../infrastructure/lease-documents.queue';
import type { LeaseRecord, LeaseRow, LeasesRepository, VersionRow } from '../infrastructure/leases.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { RentalsMailer } from '../infrastructure/rentals.mailer';
import type { SignerPasswordVerifier } from '../infrastructure/signer-password';
import type { SigningCodeRow, SigningRepository } from '../infrastructure/signing.repository';
import type { LeaseContractService } from './lease-contract.service';
import type { LeaseInvitationsService } from './lease-invitations.service';
import type { LeaseReadsService } from './lease-reads.service';
import { LeaseSigningService } from './lease-signing.service';
import type { TenanciesService, TenancyRef } from './tenancies.service';

/**
 * Signing a lease, both sides, with every collaborator doubled.
 *
 * Pinned here: a code is emailed and a second ask within a minute sends
 * nothing; a code that cannot be mailed is dropped and the signer told; a
 * wrong code counts a try and says how many are left, and the fifth wrong one
 * stops it; an expired code is refused; a contract that changed since it was
 * read is refused (and a stale draft is refreshed so the next read shows it);
 * the typed name must be the one the contract states; a drawing must be the
 * signer's own lease signature, and is put under legal hold; the landlord's
 * signature takes a draft out for signature and sends the invitation after
 * the answer; the tenant's makes the lease signed, raises the deposit due on
 * the start date and queues the signed copy.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const LEASE = '66666666-6666-4666-8666-666666666666';
const LANDLORD = '77777777-7777-4777-8777-777777777777';
const TENANT_USER = '88888888-8888-4888-8888-888888888888';
const VERSION = '99999999-9999-4999-8999-999999999999';
const CODE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['lease.sign'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const start = addDays(kigaliToday(), 7);
const end = addDays(addMonths(start, 12), -1);

const contract = buildLeaseContract(
  {
    landlord: { legalName: 'Amani Residences', signatoryName: 'Emmanuel Mukamana', idNumber: '1197380012345678', phone: '+250788111222', email: 'amani@injishi.test' },
    tenant: { fullName: 'Aimée Uwera', idKind: 'national_id', idNumber: '1199080012345012', nationality: 'RW', phone: '+250788333444', email: 'aimee@example.rw' },
    premises: { property: 'Amani Residences', unit: 'A-01', block: null, street: 'KG 7 Ave', village: 'Urugwiro', cell: 'Kamatamu', sector: 'Kacyiru', district: 'Gasabo', province: 'Kigali City' },
    terms: { startDate: start, endDate: end, billingStartsOn: null, monthlyRentRwf: 400_000, depositRwf: 800_000, rentDueDay: 5, graceDays: 5, noticeDays: 15, occupants: [], otherTerms: null },
  },
  new Date(),
);
const HASH = contractHash(contract);

const leaseRow = (over: Partial<LeaseRow> = {}): LeaseRow =>
  ({
    id: LEASE,
    orgId: ORG,
    workspaceId: WS,
    reference: 'L-0001',
    propertyId: PROPERTY,
    unitId: 'unit',
    tenantId: 'tenant',
    status: 'draft' as LeaseStatus,
    startDate: start,
    endDate: end,
    billingStartsOn: start,
    monthlyRentRwf: 400_000,
    depositRwf: 800_000,
    rentDueDay: 5,
    graceDays: 5,
    noticeDays: 15,
    occupants: [],
    currentVersionId: VERSION,
    ...over,
  }) as LeaseRow;

const versionRow: VersionRow = {
  id: VERSION,
  leaseId: LEASE,
  version: 1,
  templateVersion: 3,
  content: contract,
  contentHash: HASH,
  pdfObjectId: null,
  signedPdfObjectId: null,
  createdByUserId: LANDLORD,
  createdAt: new Date(),
};

const codeRow = (over: Partial<SigningCodeRow> = {}): SigningCodeRow => ({
  id: CODE_ID,
  leaseId: LEASE,
  versionId: VERSION,
  signerRole: 'landlord',
  userId: LANDLORD,
  email: 'amani@injishi.test',
  codeHash: sha256Hex('123456'),
  expiresAt: new Date(Date.now() + 600_000),
  attempts: 0,
  consumedAt: null,
  createdAt: new Date(Date.now() - 120_000),
  ...over,
});

const landlord = { id: LANDLORD, email: 'amani@injishi.test' };
const tenantUser = { id: TENANT_USER, email: 'aimee@example.rw' };
const ref: TenancyRef = { leaseId: LEASE, tenantId: 'tenant', userId: TENANT_USER, workspaceId: WS };
const ctx = { ip: '10.0.0.1', userAgent: 'Mozilla/5.0' };

interface Opts {
  lease?: LeaseRow;
  tenantEmail?: string;
  code?: SigningCodeRow | null;
  problems?: string[];
  builtHash?: string;
  signatures?: { signerRole: 'landlord' | 'tenant'; signerUserId?: string }[];
  drawing?: { id: string; kind: string; uploadedByUserId: string } | null;
  mailOk?: boolean;
}

// The doubles' types are what the test reads back; they are inferred.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const lease = opts.lease ?? leaseRow();
  const leaseRecord: LeaseRecord = {
    lease,
    tenant: {
      id: 'tenant',
      workspaceId: WS,
      orgId: ORG,
      userId: lease.status === 'draft' ? null : TENANT_USER,
      fullName: 'Aimée Uwera',
      email: opts.tenantEmail ?? 'aimee@example.rw',
      phone: '+250788333444',
      idKind: 'national_id',
      idNumber: '1199080012345012',
      nationality: 'RW',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    unitLabel: 'A-01',
    blockId: null,
    blockCode: null,
    blockName: null,
    propertyName: 'Amani Residences',
    brokerName: null,
  };
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) };
  const leases = {
    find: vi.fn(async () => leaseRecord),
    lock: vi.fn(async () => lease),
    version: vi.fn(async () => versionRow),
    update: vi.fn(async (_tx: unknown, id: string, values: unknown) => record('updateLease')(id, values)),
  };
  const signing = {
    liveCode: vi.fn(async () => (opts.code === undefined ? codeRow() : opts.code)),
    replaceCode: vi.fn(async (_tx: unknown, values: unknown) => {
      record('replaceCode')(values);
      return CODE_ID;
    }),
    deleteCode: vi.fn(async (id: string) => record('deleteCode')(id)),
    countWrongTry: vi.fn(async () => (opts.code?.attempts ?? 0) + 1),
    consumeCode: vi.fn(async () => true),
    liveSignatures: vi.fn(async () => opts.signatures ?? []),
    insertSignature: vi.fn(async (_tx: unknown, values: unknown) => {
      record('signature')(values);
      return 'sig-1';
    }),
    passwordHash: vi.fn(async () => null),
    openNewLeaseFiling: vi.fn(async (_tx: unknown, values: unknown) => {
      record('filing')(values);
      return 'filing-1';
    }),
  };
  const charges = {
    raiseDeposit: vi.fn(async (_tx: unknown, input: { dueOn: string; amountRwf: number }) => {
      record('deposit')(input);
      return { id: 'charge-1', kind: 'deposit', periodStart: null, periodEnd: null, ...input };
    }),
  };
  const contracts = {
    build: vi.fn(async () => ({ contract, hash: opts.builtHash ?? HASH, problems: opts.problems ?? [] })),
    freeze: vi.fn(async () => ({ versionId: VERSION, version: 1, hash: opts.builtHash ?? HASH, created: false })),
    refreshDrafts: vi.fn(async () => 1),
  };
  const events = { write: vi.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: vi.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  const reads = { detail: vi.fn(async () => ({ id: LEASE, status: 'pending_signature' }) as never) };
  const tenancies = {
    record: vi.fn(async () => leaseRecord),
    detail: vi.fn(async () => ({ id: LEASE, status: 'signed' }) as never),
  };
  const mail = vi.fn(async () => undefined);
  const invitations = { issue: vi.fn(async () => mail) };
  const storage = {
    describe: vi.fn(async () => (opts.drawing === undefined ? null : opts.drawing)),
    holdObject: vi.fn(async (id: string) => record('hold')(id)),
  };
  const passwords = { verify: vi.fn(async () => false) };
  const mailer = { signingCode: vi.fn(async () => opts.mailOk ?? true) };
  const documents = { signedCopy: vi.fn(async (job: unknown) => (record('queued')(job), true)) };
  const service = new LeaseSigningService(
    db as never,
    leases as unknown as LeasesRepository,
    signing as unknown as SigningRepository,
    charges as unknown as LeaseChargesRepository,
    contracts as unknown as LeaseContractService,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
    reads as unknown as LeaseReadsService,
    tenancies as unknown as TenanciesService,
    invitations as unknown as LeaseInvitationsService,
    storage as unknown as StorageService,
    passwords as unknown as SignerPasswordVerifier,
    mailer as unknown as RentalsMailer,
    documents as unknown as LeaseDocumentsQueue,
  );
  return { service, calls, leases, signing, contracts, invitations, mail, storage, mailer, documents };
}

const sign = (over: Partial<SignLeaseRequest> = {}): SignLeaseRequest => ({ typedName: 'Emmanuel Mukamana', code: '123456', documentHash: HASH, ...over });

async function fieldMessage(promise: Promise<unknown>): Promise<string> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(BadRequestException);
  const body = (err as BadRequestException).getResponse() as { issues: { message: string }[] };
  return body.issues[0]!.message;
}

describe('LeaseSigningService codes', () => {
  it('emails a code for a draft that is ready, keeping only its hash', async () => {
    const h = harness({ code: null });
    const sent = await h.service.landlordCode(ws, landlord, LEASE);
    expect(sent).toEqual({ sentTo: 'am•••@injishi.test', sent: true, expiresInSeconds: 600, resendInSeconds: 60 });
    const [stored] = h.calls.replaceCode![0] as [{ codeHash: string; signerRole: string; email: string }];
    expect(stored).toMatchObject({ signerRole: 'landlord', email: 'amani@injishi.test' });
    const code = (h.mailer.signingCode.mock.calls[0] as unknown[])[1] as string;
    expect(code).toMatch(/^\d{6}$/);
    expect(stored.codeHash).toBe(sha256Hex(code));
  });

  it('a second ask within a minute sends nothing and says when to ask again', async () => {
    const h = harness({ code: codeRow({ createdAt: new Date(Date.now() - 20_000) }) });
    const sent = await h.service.landlordCode(ws, landlord, LEASE);
    expect(sent.sent).toBe(false);
    expect(sent.resendInSeconds).toBeGreaterThanOrEqual(39);
    expect(sent.resendInSeconds).toBeLessThanOrEqual(41);
    expect(h.mailer.signingCode).not.toHaveBeenCalled();
  });

  it('after a minute a new code replaces the old one', async () => {
    const h = harness({ code: codeRow({ createdAt: new Date(Date.now() - 61_000) }) });
    expect((await h.service.landlordCode(ws, landlord, LEASE)).sent).toBe(true);
    expect(h.calls.replaceCode).toHaveLength(1);
  });

  it('a code that could not be mailed is dropped, and the signer told to try again', async () => {
    const h = harness({ code: null, mailOk: false });
    await expect(h.service.landlordCode(ws, landlord, LEASE)).rejects.toThrow(ServiceUnavailableException);
    expect(h.calls.deleteCode).toEqual([[CODE_ID]]);
  });

  it('refuses a code for a lease that is not a draft, or a contract with something missing', async () => {
    await expect(harness({ lease: leaseRow({ status: 'active' }) }).service.landlordCode(ws, landlord, LEASE)).rejects.toThrow(
      'This lease is active. Only a draft waits for your signature.',
    );
    const err = await harness({ problems: ['Add the village the building is in.'] })
      .service.landlordCode(ws, landlord, LEASE)
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'contract_not_ready', problems: ['Add the village the building is in.'] });
  });

  it('a tenant gets a code only once the landlord signed, and only once', async () => {
    const out = harness({ lease: leaseRow({ status: 'pending_signature' }), signatures: [] });
    await expect(out.service.tenantCode(ref, tenantUser)).rejects.toThrow('Your landlord has not signed this version yet.');
    const done = harness({ lease: leaseRow({ status: 'pending_signature' }), signatures: [{ signerRole: 'landlord' }, { signerRole: 'tenant' }] });
    await expect(done.service.tenantCode(ref, tenantUser)).rejects.toThrow('You have signed this lease already.');
    const ok = harness({ lease: leaseRow({ status: 'pending_signature' }), signatures: [{ signerRole: 'landlord' }], code: null });
    expect((await ok.service.tenantCode(ref, tenantUser)).sentTo).toBe('ai•••@example.rw');
  });

  it('answers 404 for a lease of another business', async () => {
    const h = harness({ lease: leaseRow({ workspaceId: 'other' }) });
    await expect(h.service.landlordCode(ws, landlord, LEASE)).rejects.toThrow(NotFoundException);
  });
});

describe('LeaseSigningService.signAsLandlord', () => {
  it('signs a draft: evidence kept, out for signature, invitation issued and mailed after, drawing held', async () => {
    const h = harness({ drawing: { id: 'obj-1', kind: 'lease_signature', uploadedByUserId: LANDLORD } });
    await h.service.signAsLandlord(ws, landlord, LEASE, sign({ typedName: ' emmanuel   MUKAMANA ', signatureObjectKey: 'lease_signature/x.png' }), ctx);
    expect(h.calls.signature![0]![0]).toMatchObject({
      signerRole: 'landlord',
      signerUserId: LANDLORD,
      typedName: 'emmanuel MUKAMANA',
      documentHash: HASH,
      method: 'email_code',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      signatureObjectId: 'obj-1',
      verifiedAt: expect.any(Date),
    });
    expect(h.calls.updateLease![0]).toEqual([LEASE, { status: 'pending_signature', currentVersionId: VERSION }]);
    expect(h.signing.consumeCode).toHaveBeenCalled();
    expect(h.invitations.issue).toHaveBeenCalled();
    expect(h.mail).toHaveBeenCalled();
    expect(h.calls.hold).toEqual([['obj-1']]);
    expect(h.calls.event!.map((e) => (e[0] as { kind: string }).kind)).toEqual(['landlord_signed']);
    expect(h.calls.audit![0]![0]).toMatchObject({ eventType: 'lease.signed', diff: { role: 'landlord', from: 'draft', to: 'pending_signature' } });
  });

  it('refuses a contract that changed since it was read, and brings the draft up to date', async () => {
    const h = harness({ builtHash: 'f'.repeat(64) });
    const err = await h.service.signAsLandlord(ws, landlord, LEASE, sign(), ctx).catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'contract_changed', message: 'The contract changed since you opened it. Read it again, then sign.' });
    expect(h.contracts.refreshDrafts).toHaveBeenCalledWith([LEASE], LANDLORD);
    expect(h.calls.signature).toBeUndefined();
  });

  it('refuses a name that is not the one the contract states', async () => {
    const h = harness();
    expect(await fieldMessage(h.service.signAsLandlord(ws, landlord, LEASE, sign({ typedName: 'Emmanuel M.' }), ctx))).toBe(
      'Type your full name as the contract states it: Emmanuel Mukamana.',
    );
  });

  it('refuses a likely typo in the address the invitation goes to, unless confirmed', async () => {
    const h = harness({ tenantEmail: 'aimee@gmial.com' });
    expect(await fieldMessage(h.service.signAsLandlord(ws, landlord, LEASE, sign(), ctx))).toBe('Check the email. Did you mean aimee@gmail.com?');
    await expect(h.service.signAsLandlord(ws, landlord, LEASE, sign({ confirmEmail: true }), ctx)).resolves.toBeDefined();
  });

  it('counts a wrong code and says how many tries are left', async () => {
    const h = harness({ code: codeRow({ attempts: 1 }) });
    expect(await fieldMessage(h.service.signAsLandlord(ws, landlord, LEASE, sign({ code: '654321' }), ctx))).toBe("That code isn't right. 3 tries left.");
    expect(h.signing.countWrongTry).toHaveBeenCalledWith(CODE_ID);
    expect(h.calls.signature).toBeUndefined();
  });

  it('the fifth wrong code stops it, and a used up code stays refused', async () => {
    expect(await fieldMessage(harness({ code: codeRow({ attempts: 4 }) }).service.signAsLandlord(ws, landlord, LEASE, sign({ code: '654321' }), ctx))).toBe(
      'Too many wrong tries. Send a new code.',
    );
    expect(await fieldMessage(harness({ code: codeRow({ attempts: 5 }) }).service.signAsLandlord(ws, landlord, LEASE, sign(), ctx))).toBe(
      'Too many wrong tries. Send a new code.',
    );
  });

  it('refuses an expired code, and signing with no code asked for', async () => {
    expect(await fieldMessage(harness({ code: codeRow({ expiresAt: new Date(Date.now() - 1) }) }).service.signAsLandlord(ws, landlord, LEASE, sign(), ctx))).toBe(
      'That code has expired. Send a new one.',
    );
    expect(await fieldMessage(harness({ code: null }).service.signAsLandlord(ws, landlord, LEASE, sign(), ctx))).toBe('Ask for a code first. We email it to you.');
  });

  it("refuses a drawing that is not the signer's own signature upload", async () => {
    const other = harness({ drawing: { id: 'obj-2', kind: 'lease_signature', uploadedByUserId: 'someone-else' } });
    expect(await fieldMessage(other.service.signAsLandlord(ws, landlord, LEASE, sign({ signatureObjectKey: 'lease_signature/y.png' }), ctx))).toBe(
      'Draw your signature again, then sign.',
    );
    const photo = harness({ drawing: { id: 'obj-3', kind: 'id_photo', uploadedByUserId: LANDLORD } });
    expect(await fieldMessage(photo.service.signAsLandlord(ws, landlord, LEASE, sign({ signatureObjectKey: 'id_photo/z.png' }), ctx))).toBe(
      'Draw your signature again, then sign.',
    );
  });

  it('a password needs an account that has one', async () => {
    const h = harness();
    expect(await fieldMessage(h.service.signAsLandlord(ws, landlord, LEASE, sign({ code: undefined, password: 'secret' }), ctx))).toBe(
      'Your account has no password. Use the code we email you.',
    );
  });

  it('signing a lease already out is answered with the lease, and nothing is written', async () => {
    const h = harness({ lease: leaseRow({ status: 'pending_signature' }), signatures: [{ signerRole: 'landlord' }] });
    await h.service.signAsLandlord(ws, landlord, LEASE, sign(), ctx);
    expect(h.calls.signature).toBeUndefined();
  });
});

describe('LeaseSigningService.signAsTenant', () => {
  const pending = (): ReturnType<typeof harness> =>
    harness({ lease: leaseRow({ status: 'pending_signature' }), signatures: [{ signerRole: 'landlord' }], code: codeRow({ signerRole: 'tenant', userId: TENANT_USER }) });

  it('signs: the lease is signed, the deposit raised due on the start date, the signed copy queued', async () => {
    const h = pending();
    await h.service.signAsTenant(ref, tenantUser, sign({ typedName: 'Aimee Uwera' }), ctx);
    expect(h.calls.signature![0]![0]).toMatchObject({ signerRole: 'tenant', signerUserId: TENANT_USER, documentHash: HASH, typedName: 'Aimee Uwera' });
    expect(h.calls.updateLease![0]).toEqual([LEASE, { status: 'signed', signedAt: expect.any(Date) }]);
    expect(h.calls.deposit![0]![0]).toMatchObject({ dueOn: start, amountRwf: 800_000 });
    expect(h.calls.event!.map((e) => (e[0] as { kind: string }).kind)).toEqual(['tenant_signed', 'charge_raised', 'filing_due']);
    expect(h.calls.queued).toEqual([[{ leaseId: LEASE, versionId: VERSION }]]);
  });

  it('opens the copy owed to RRA, due 15 days after the Kigali day it was signed (WP 4.4)', async () => {
    const h = pending();
    await h.service.signAsTenant(ref, tenantUser, sign({ typedName: 'Aimee Uwera' }), ctx);
    expect(h.calls.filing).toEqual([[{ leaseId: LEASE, dueOn: addDays(kigaliDateOf(new Date()), 15) }]]);
    const due = h.calls.event!.find((e) => (e[0] as { kind: string }).kind === 'filing_due')![0];
    expect(due).toMatchObject({ actorRole: 'system', visibleToTenant: false, payload: { filingId: 'filing-1', kind: 'new_lease' } });
  });

  it('a lease with no deposit raises none', async () => {
    const h = harness({
      lease: leaseRow({ status: 'pending_signature', depositRwf: 0 }),
      signatures: [{ signerRole: 'landlord' }],
      code: codeRow({ signerRole: 'tenant', userId: TENANT_USER }),
    });
    await h.service.signAsTenant(ref, tenantUser, sign({ typedName: 'Aimée Uwera' }), ctx);
    expect(h.calls.deposit).toBeUndefined();
  });

  it("refuses the landlord's name, and a contract that changed", async () => {
    expect(await fieldMessage(pending().service.signAsTenant(ref, tenantUser, sign(), ctx))).toBe(
      'Type your full name as the contract states it: Aimée Uwera.',
    );
    const err = await pending()
      .service.signAsTenant(ref, tenantUser, sign({ typedName: 'Aimée Uwera', documentHash: 'e'.repeat(64) }), ctx)
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'contract_changed' });
  });

  it('a lease edited back to draft meanwhile cannot be signed', async () => {
    const h = harness({ lease: leaseRow({ status: 'draft' }), code: codeRow({ signerRole: 'tenant' }) });
    await expect(h.service.signAsTenant(ref, tenantUser, sign({ typedName: 'Aimée Uwera' }), ctx)).rejects.toThrow('This lease is a draft.');
  });
});
