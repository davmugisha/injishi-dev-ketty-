import { describe, expect, it } from 'vitest';

import { NotFoundException } from '@nestjs/common';
import type { LeaseStatus } from '@injishi/contracts';

import type { LeaseDocumentsRepository, SignedCopyRecipient } from '../infrastructure/lease-documents.repository';
import type { LeaseRecord, LeasesRepository } from '../infrastructure/leases.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { RentalsMailer } from '../infrastructure/rentals.mailer';
import type { SigningRepository } from '../infrastructure/signing.repository';
import type { TenanciesRepository } from '../infrastructure/tenancies.repository';
import type { LeaseContractService } from './lease-contract.service';
import { LeaseDocumentsService } from './lease-documents.service';
import { TENANCY_NOT_FOUND, TenanciesService } from './tenancies.service';

/**
 * The tenant's side and the signed copy, with every collaborator doubled.
 *
 * Pinned here: a lease is the caller's only through the tenant record their
 * account is linked to, never while a draft, and anyone else's is the same 404
 * as none; the tenant's timeline shows only what they may see, the landlord
 * named by the business; the signed copy goes to both sides with the PDF
 * attached, once per version, and a run whose email failed sends only the
 * missing ones next time.
 */
const LEASE = '66666666-6666-4666-8666-666666666666';
const ME = '88888888-8888-4888-8888-888888888888';

describe('TenanciesService.resolve (the tenancy guard)', () => {
  const service = (owner: { status: LeaseStatus; tenantUserId: string | null } | null): TenanciesService =>
    new TenanciesService(
      { owner: async () => (owner ? { leaseId: LEASE, tenantId: 'tenant', workspaceId: 'ws', orgId: 'org', ...owner } : null) } as unknown as TenanciesRepository,
      {} as LeasesRepository,
      {} as SigningRepository,
      {} as RentalsContextRepository,
      {} as LeaseContractService,
    );

  it("answers the caller's own lease", async () => {
    await expect(service({ status: 'pending_signature', tenantUserId: ME }).resolve(ME, LEASE)).resolves.toEqual({
      leaseId: LEASE,
      tenantId: 'tenant',
      userId: ME,
      workspaceId: 'ws',
    });
  });

  it("is 404 for another person's lease, a draft, a tenant not linked yet, and no lease, in the same words", async () => {
    for (const s of [
      service({ status: 'active', tenantUserId: 'someone-else' }),
      service({ status: 'draft', tenantUserId: ME }),
      service({ status: 'pending_signature', tenantUserId: null }),
      service(null),
    ]) {
      const err = await s.resolve(ME, LEASE).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(TENANCY_NOT_FOUND);
    }
  });

  it("shows the tenant only their part of the timeline, the landlord named by the business", async () => {
    const record = { lease: { id: LEASE, orgId: 'org', status: 'signed' }, tenant: { id: 'tenant', userId: ME, fullName: 'Aimée Uwera' } } as unknown as LeaseRecord;
    const s = new TenanciesService(
      {} as TenanciesRepository,
      {
        find: async () => record,
        events: async () => [
          { id: '1', kind: 'tenant_signed', actorRole: 'tenant', actorName: 'Aimée', visibleToTenant: true, payload: {}, occurredAt: new Date() },
          { id: '2', kind: 'terms_edited', actorRole: 'landlord', actorName: 'Staff Member', visibleToTenant: false, payload: {}, occurredAt: new Date() },
          { id: '3', kind: 'landlord_signed', actorRole: 'landlord', actorName: 'Staff Member', visibleToTenant: true, payload: {}, occurredAt: new Date() },
        ],
      } as unknown as LeasesRepository,
      {} as SigningRepository,
      { org: async () => ({ legalName: 'Amani Residences' }) } as unknown as RentalsContextRepository,
      {} as LeaseContractService,
    );
    const { events } = await s.events({ leaseId: LEASE, tenantId: 'tenant', userId: ME, workspaceId: 'ws' });
    expect(events.map((e) => [e.kind, e.actorName])).toEqual([
      ['tenant_signed', 'Aimée Uwera'],
      ['landlord_signed', 'Amani Residences'],
    ]);
  });
});

describe('LeaseDocumentsService.deliverSignedCopy', () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function harness(opts: { mailed?: SignedCopyRecipient[]; failFor?: string; signed?: boolean } = {}) {
    const mailed = [...(opts.mailed ?? [])];
    const sent: { to: string; subject: string; attachments: number }[] = [];
    const record = {
      lease: { id: LEASE, orgId: 'org', workspaceId: 'ws', reference: 'L-0001', startDate: '2026-11-01', depositRwf: 800_000 },
      tenant: { fullName: 'Aimée Uwera', email: 'aimee@example.rw' },
      unitLabel: 'A-01',
      propertyName: 'Amani Residences',
    } as unknown as LeaseRecord;
    const service = new LeaseDocumentsService(
      { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) } as never,
      { version: async () => ({ id: 'v1', leaseId: LEASE, version: 2 }), find: async () => record } as unknown as LeasesRepository,
      {
        liveSignatures: async () => [
          { signerRole: 'landlord', signerEmail: 'amani@injishi.test' },
          { signerRole: 'tenant', signerEmail: 'aimee@example.rw' },
        ],
      } as unknown as SigningRepository,
      {
        claim: async () => ({ eventId: 'e1', mailed: [...mailed], created: mailed.length === 0 }),
        markMailed: async (_id: string, who: SignedCopyRecipient) => {
          mailed.push(who);
        },
      } as unknown as LeaseDocumentsRepository,
      {
        ensureProfile: async () => ({ contactEmail: 'office@amani.rw', autoStartLeases: true }),
        org: async () => ({ legalName: 'Amani Residences' }),
      } as unknown as RentalsContextRepository,
      {
        signedCopy: async () => (opts.signed === false ? null : { body: Buffer.from('%PDF-1.7'), filename: 'L-0001-v2-signed.pdf', objectId: 'obj' }),
      } as unknown as LeaseContractService,
      {
        appUrl: 'http://localhost:3002',
        send: async (_ref: string, to: string, mail: { subject: string }, attachments?: unknown[]) => {
          if (to === opts.failFor) return false;
          sent.push({ to, subject: mail.subject, attachments: attachments?.length ?? 0 });
          return true;
        },
      } as unknown as RentalsMailer,
    );
    return { service, sent, mailed };
  }

  it('sends the signed PDF to the tenant, the landlord who signed and the business contact', async () => {
    const h = harness();
    expect(await h.service.deliverSignedCopy('v1')).toBe('sent');
    expect(h.sent).toEqual([
      { to: 'aimee@example.rw', subject: 'Your signed lease for unit A-01 at Amani Residences', attachments: 1 },
      { to: 'amani@injishi.test', subject: 'Aimée Uwera signed the lease for unit A-01 at Amani Residences', attachments: 1 },
      { to: 'office@amani.rw', subject: 'Aimée Uwera signed the lease for unit A-01 at Amani Residences', attachments: 1 },
    ]);
    expect(h.mailed).toEqual(['tenant', 'landlord', 'landlord_contact']);
  });

  it('a second run sends nothing', async () => {
    const h = harness({ mailed: ['tenant', 'landlord', 'landlord_contact'] });
    expect(await h.service.deliverSignedCopy('v1')).toBe('already_sent');
    expect(h.sent).toEqual([]);
  });

  it('a failed email fails the run, and the retry sends only what is missing', async () => {
    const first = harness({ failFor: 'amani@injishi.test' });
    await expect(first.service.deliverSignedCopy('v1')).rejects.toThrow('1 signed copy email(s) for lease L-0001 were not sent');
    expect(first.mailed).toEqual(['tenant', 'landlord_contact']);
    const retry = harness({ mailed: first.mailed });
    await retry.service.deliverSignedCopy('v1');
    expect(retry.sent.map((s) => s.to)).toEqual(['amani@injishi.test']);
  });

  it('a version not signed by both sides makes no copy and sends nothing', async () => {
    const h = harness({ signed: false });
    expect(await h.service.deliverSignedCopy('v1')).toBe('not_signed');
    expect(h.sent).toEqual([]);
  });
});
