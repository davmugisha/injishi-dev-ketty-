import { ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { addDays, addMonths, kigaliToday, type LeaseStatus } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { sha256Hex } from '../domain/signing-secrets';
import type { LeaseRecord, LeaseRow, LeasesRepository } from '../infrastructure/leases.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { RentalsMailer } from '../infrastructure/rentals.mailer';
import type { InvitationRow, SigningRepository } from '../infrastructure/signing.repository';
import type { LeaseDraftingService } from './lease-drafting.service';
import { LeaseInvitationsService } from './lease-invitations.service';
import type { LeaseReadsService } from './lease-reads.service';
import type { TenanciesService } from './tenancies.service';

/**
 * The tenant's invitation, with every collaborator doubled.
 *
 * Pinned here: the landlord's signature sends a link whose token is kept only
 * as a hash, or, for a tenant whose account already holds the record, puts
 * the lease straight on their account; the public preview shows the home and
 * hides the address; an expired, withdrawn or replaced link says so in plain
 * words; accepting takes the session's email, never the request's, links the
 * tenant record, and is answered the same the second time; resending waits a
 * minute and issues a fresh link; a new address is an edit of the lease.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const LEASE = '66666666-6666-4666-8666-666666666666';
const LANDLORD = '77777777-7777-4777-8777-777777777777';
const TENANT_USER = '88888888-8888-4888-8888-888888888888';
const INVITATION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOKEN = 'a'.repeat(43);

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['lease.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const start = addDays(kigaliToday(), 7);
const end = addDays(addMonths(start, 12), -1);

const leaseRow = (over: Partial<LeaseRow> = {}): LeaseRow =>
  ({
    id: LEASE,
    orgId: ORG,
    workspaceId: WS,
    reference: 'L-0001',
    propertyId: PROPERTY,
    status: 'pending_signature' as LeaseStatus,
    startDate: start,
    endDate: end,
    monthlyRentRwf: 400_000,
    depositRwf: 800_000,
    ...over,
  }) as LeaseRow;

const invitation = (over: Partial<InvitationRow> = {}): InvitationRow => ({
  id: INVITATION,
  leaseId: LEASE,
  tenantId: 'tenant',
  email: 'aimee@example.rw',
  tokenHash: sha256Hex(TOKEN),
  status: 'sent',
  sentAt: new Date(Date.now() - 3_600_000),
  lastSentAt: new Date(Date.now() - 3_600_000),
  sendCount: 1,
  expiresAt: new Date(Date.now() + 86_400_000),
  acceptedAt: null,
  acceptedByUserId: null,
  revokedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

interface Opts {
  lease?: LeaseRow;
  invitation?: InvitationRow | null;
  tenantUserId?: string | null;
  linked?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const lease = opts.lease ?? leaseRow();
  const inv = opts.invitation === undefined ? invitation() : opts.invitation;
  const leaseRecord: LeaseRecord = {
    lease,
    tenant: {
      id: 'tenant',
      workspaceId: WS,
      orgId: ORG,
      userId: opts.tenantUserId ?? null,
      fullName: 'Aimée Uwera',
      email: 'aimee@example.rw',
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
    find: jest.fn(async () => leaseRecord),
    lock: jest.fn(async () => lease),
  };
  const signing = {
    liveInvitation: jest.fn(async () => (inv?.status === 'sent' ? inv : null)),
    latestInvitation: jest.fn(async () => inv),
    invitationByTokenHash: jest.fn(async (hash: string) => (inv && inv.tokenHash === hash ? inv : null)),
    invitationById: jest.fn(async (id: string) => (inv && inv.id === id ? inv : null)),
    lockInvitation: jest.fn(async () => inv),
    insertInvitation: jest.fn(async (_tx: unknown, values: unknown) => {
      record('insertInvitation')(values);
      return 'inv-new';
    }),
    refreshInvitation: jest.fn(async (_tx: unknown, id: string, values: unknown) => record('refresh')(id, values)),
    revokeInvitation: jest.fn(async (_tx: unknown, id: string) => record('revoke')(id)),
    touchInvitation: jest.fn(async (_tx: unknown, id: string) => record('touch')(id)),
    markAccepted: jest.fn(async (_tx: unknown, id: string, userId: string) => record('accepted')(id, userId)),
    linkTenant: jest.fn(async (_tx: unknown, tenantId: string, userId: string) => (record('link')(tenantId, userId), opts.linked ?? true)),
    accountEmail: jest.fn(async () => 'aimee.account@example.rw'),
  };
  const context = {
    org: jest.fn(async () => ({ legalName: 'Amani Residences' })),
    buildingPlace: jest.fn(async () => ({ district: 'Gasabo' })),
  };
  const events = { write: jest.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: jest.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  const reads = { detail: jest.fn(async () => ({ id: LEASE }) as never) };
  const drafting = { edit: jest.fn(async (...args: unknown[]) => (record('edit')(...args), { id: LEASE, status: 'draft' }) as never) };
  const tenancies = { detail: jest.fn(async () => ({ id: LEASE }) as never) };
  const mailer = {
    appUrl: 'http://localhost:3002',
    send: jest.fn(async (_ref: string, to: string, mail: { subject: string; action: { url: string } }) => (record('mail')(to, mail), true)),
  };
  const service = new LeaseInvitationsService(
    db as never,
    leases as unknown as LeasesRepository,
    signing as unknown as SigningRepository,
    context as unknown as RentalsContextRepository,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
    reads as unknown as LeaseReadsService,
    drafting as unknown as LeaseDraftingService,
    tenancies as unknown as TenanciesService,
    mailer as unknown as RentalsMailer,
  );
  return { service, calls, signing, drafting, tenancies, leaseRecord };
}

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('LeaseInvitationsService.issue', () => {
  it('sends a 14 day link; only the token hash is kept and the token is only in the email', async () => {
    const h = harness({ invitation: null });
    const mail = await h.service.issue({} as never, h.leaseRecord, LANDLORD);
    const [values] = h.calls.insertInvitation![0] as [{ tokenHash: string; status: string; email: string; expiresAt: Date }];
    expect(values).toMatchObject({ status: 'sent', email: 'aimee@example.rw' });
    expect(values.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const days = (values.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(14);
    await mail();
    const [to, sent] = h.calls.mail![0] as [string, { action: { url: string } }];
    expect(to).toBe('aimee@example.rw');
    const token = /\/invite\/lease\/([A-Za-z0-9_-]+)$/.exec(sent.action.url)![1]!;
    expect(sent.action.url.startsWith('http://localhost:3002/invite/lease/')).toBe(true);
    expect(sha256Hex(token)).toBe(values.tokenHash);
    expect(h.calls.event![0]![0]).toMatchObject({ kind: 'invitation_sent', visibleToTenant: true });
  });

  it("puts the lease straight on a returning tenant's account and mails them to it", async () => {
    const h = harness({ invitation: null, tenantUserId: TENANT_USER });
    const mail = await h.service.issue({} as never, h.leaseRecord, LANDLORD);
    expect(h.calls.insertInvitation![0]![0]).toMatchObject({ status: 'accepted', acceptedByUserId: TENANT_USER });
    await mail();
    const [to, sent] = h.calls.mail![0] as [string, { action: { url: string } }];
    expect(to).toBe('aimee.account@example.rw');
    expect(sent.action.url).toBe(`http://localhost:3002/home/${LEASE}/lease`);
  });
});

describe('LeaseInvitationsService.preview', () => {
  it('shows the home and the terms, the address partly hidden', async () => {
    const preview = await harness().service.preview(TOKEN);
    expect(preview).toMatchObject({
      state: 'open',
      message: null,
      invitedEmail: 'ai•••@example.rw',
      landlordName: 'Amani Residences',
      unitLabel: 'A-01',
      district: 'Gasabo',
      monthlyRentRwf: 400_000,
      startDate: start,
    });
  });

  it('says in words when the link expired or was withdrawn', async () => {
    const expired = await harness({ invitation: invitation({ expiresAt: new Date(Date.now() - 1000) }) }).service.preview(TOKEN);
    expect(expired.state).toBe('expired');
    expect(expired.message).toMatch(/^This invitation expired on .+\. Ask Amani Residences to send it again\.$/);
    const revoked = await harness({ invitation: invitation({ status: 'revoked', revokedAt: new Date() }) }).service.preview(TOKEN);
    expect(revoked).toMatchObject({ state: 'revoked', message: 'Amani Residences withdrew this invitation. If they send a new one, use the link in that email.' });
    const cancelled = await harness({ lease: leaseRow({ status: 'cancelled' }) }).service.preview(TOKEN);
    expect(cancelled.state).toBe('revoked');
  });

  it('a replaced or unknown link is 404', async () => {
    await expect(harness().service.preview('b'.repeat(43))).rejects.toThrow(NotFoundException);
  });
});

describe('LeaseInvitationsService.accept', () => {
  const tenant = { id: TENANT_USER, email: 'Aimee@Example.rw' };

  it('accepts as the invited address (any case): links the tenant record and records it', async () => {
    const h = harness();
    await h.service.accept(tenant, { token: TOKEN });
    expect(h.calls.link).toEqual([['tenant', TENANT_USER]]);
    expect(h.calls.accepted).toEqual([[INVITATION, TENANT_USER]]);
    expect(h.calls.event![0]![0]).toMatchObject({ kind: 'invitation_accepted', actorRole: 'tenant', actorUserId: TENANT_USER });
    expect(h.calls.audit![0]![0]).toMatchObject({ subjectType: 'tenant', eventType: 'tenant.account_linked' });
    expect(h.tenancies.detail).toHaveBeenCalledWith({ leaseId: LEASE, tenantId: 'tenant', userId: TENANT_USER, workspaceId: WS });
  });

  it('refuses another email, naming the address partly hidden', async () => {
    const err = await harness()
      .service.accept({ id: 'someone', email: 'other@example.rw' }, { token: TOKEN })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: 'invitation_other_email',
      message: 'This invitation was sent to ai•••@example.rw. Sign in with that email to accept it.',
    });
  });

  it('by id, an invitation to another email is not even confirmed to exist', async () => {
    await expect(harness().service.accept({ id: 'someone', email: 'other@example.rw' }, { invitationId: INVITATION })).rejects.toThrow(NotFoundException);
  });

  it('accepting twice from the same account answers the tenancy; from another account it is refused', async () => {
    const done = invitation({ status: 'accepted', acceptedAt: new Date(), acceptedByUserId: TENANT_USER });
    const h = harness({ invitation: done, tenantUserId: TENANT_USER });
    await h.service.accept(tenant, { token: TOKEN });
    expect(h.calls.link).toBeUndefined();
    expect(h.tenancies.detail).toHaveBeenCalled();
    const other = harness({ invitation: invitation({ status: 'accepted', acceptedAt: new Date(), acceptedByUserId: 'x' }) });
    await expect(other.service.accept(tenant, { token: TOKEN })).rejects.toThrow('This invitation was accepted from another account.');
  });

  it('an expired or withdrawn invitation is refused in plain words', async () => {
    const expired = await harness({ invitation: invitation({ expiresAt: new Date(Date.now() - 1000) }) })
      .service.accept(tenant, { token: TOKEN })
      .catch((e: unknown) => e);
    expect((expired as ConflictException).getResponse()).toMatchObject({ code: 'invitation_expired', message: expect.stringContaining('Ask Amani Residences to send it again.') });
    const revoked = await harness({ invitation: invitation({ status: 'revoked', revokedAt: new Date() }) })
      .service.accept(tenant, { token: TOKEN })
      .catch((e: unknown) => e);
    expect((revoked as ConflictException).getResponse()).toMatchObject({ code: 'invitation_revoked' });
  });

  it('a tenant record linked to another account is refused', async () => {
    await expect(harness({ linked: false }).service.accept(tenant, { token: TOKEN })).rejects.toThrow(ConflictException);
  });
});

describe('LeaseInvitationsService.resend', () => {
  it('sends a fresh link (the old one stops working) and records it', async () => {
    const h = harness();
    await h.service.resend(ws, LANDLORD, LEASE, {});
    const [id, values] = h.calls.refresh![0] as [string, { tokenHash: string }];
    expect(id).toBe(INVITATION);
    expect(values.tokenHash).not.toBe(sha256Hex(TOKEN));
    expect(h.calls.event![0]![0]).toMatchObject({ kind: 'invitation_resent', payload: { sendCount: 2 } });
    expect(h.calls.audit![0]![0]).toMatchObject({ eventType: 'lease.invitation_resent' });
    await flush();
    expect(h.calls.mail).toHaveLength(1);
  });

  it('waits a minute between sends', async () => {
    const h = harness({ invitation: invitation({ lastSentAt: new Date(Date.now() - 10_000) }) });
    const err = await h.service.resend(ws, LANDLORD, LEASE, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect((err as HttpException).getResponse()).toMatchObject({ code: 'invitation_wait' });
  });

  it('an expired link goes again with a fresh 14 days', async () => {
    const h = harness({ invitation: invitation({ expiresAt: new Date(Date.now() - 1000) }) });
    await h.service.resend(ws, LANDLORD, LEASE, {});
    expect(h.calls.refresh).toHaveLength(1);
  });

  it('once accepted, it reminds the tenant to sign at their account address, with no new link', async () => {
    const h = harness({ invitation: invitation({ status: 'accepted', acceptedAt: new Date(), acceptedByUserId: TENANT_USER }), tenantUserId: TENANT_USER });
    await h.service.resend(ws, LANDLORD, LEASE, {});
    expect(h.calls.touch).toEqual([[INVITATION]]);
    await flush();
    const [to, mail] = h.calls.mail![0] as [string, { action: { url: string } }];
    expect(to).toBe('aimee.account@example.rw');
    expect(mail.action.url).toBe(`http://localhost:3002/home/${LEASE}/lease`);
  });

  it('a new address is an edit of the lease: it goes back to draft for the landlord to sign again', async () => {
    const h = harness();
    await h.service.resend(ws, LANDLORD, LEASE, { email: 'aimee.uwera@example.rw' });
    expect(h.calls.edit![0]).toEqual([ws, LANDLORD, LEASE, { tenant: { email: 'aimee.uwera@example.rw' }, confirmEmail: true }]);
    expect(h.calls.refresh).toBeUndefined();
  });

  it('refuses a new address once the tenant accepted, and a lease that is not out for signature', async () => {
    const accepted = harness({ invitation: invitation({ status: 'accepted', acceptedAt: new Date(), acceptedByUserId: TENANT_USER }) });
    await expect(accepted.service.resend(ws, LANDLORD, LEASE, { email: 'new@example.rw' })).rejects.toThrow(
      "Aimée Uwera accepted the invitation already, so it can't go to another address.",
    );
    await expect(harness({ lease: leaseRow({ status: 'draft' }) }).service.resend(ws, LANDLORD, LEASE, {})).rejects.toThrow(
      'This lease is a draft. Sign it first. Signing sends the invitation.',
    );
  });
});
