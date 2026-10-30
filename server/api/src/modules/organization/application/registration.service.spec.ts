import { describe, expect, it, type Mock, vi } from 'vitest';

import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { CreateRegistrationRequest } from '@injishi/contracts';

import type { OrganizationRepository } from '../infrastructure/organization.repository';
import type { RraTinAdapter, TinCheckOutcome } from '../infrastructure/rra-tin.adapter';
import type { IdentityService } from '../../user/application/identity.service';
import type { ProfileService } from '../../user/application/profile.service';
import { RegistrationService } from './registration.service';

/**
 * The TIN pre-check (registration Phase 0): a TIN RRA refuses is found at the
 * Business step and refused at create, before any bill exists. An RRA outage
 * refuses nothing, because the check after payment still covers it.
 */

const TIN = '999031001';

function outcome(result: TinCheckOutcome['result']): TinCheckOutcome {
  const base = { latencyMs: 1, adapterMode: 'mock' as const, raw: null };
  if (result === 'failed') return { result, reason: 'unknown', ...base };
  if (result === 'pending') return { result, reason: 'adapter_unavailable', ...base };
  return { result, ...base, business: null };
}

/** A company the register holds, with two directors, the caller's document among them. */
function withDirectors(): TinCheckOutcome {
  return {
    result: 'verified',
    latencyMs: 1,
    adapterMode: 'mock',
    raw: null,
    business: {
      legalName: 'Kivu Lakeside Lodges Ltd',
      registeredOn: null,
      companyType: 'private_company',
      address: null,
      directors: [
        { name: 'Eric Habimana', documentNumber: '1198580045678923' },
        { name: 'Diane Mukamana', documentNumber: '1199270056789034' },
      ],
      generated: true,
    },
  } as TinCheckOutcome;
}

/** The draft service, standing in: what a check keeps and what a registration marks (ADR-075 D-m). */
type DraftsStandIn = { recordTinCheck: Mock; markRegistered: Mock; clear: Mock };
function draftsStandIn(): DraftsStandIn {
  return {
    recordTinCheck: vi.fn(async () => undefined),
    markRegistered: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
}

function service(opts: {
  taken?: boolean;
  verify?: () => Promise<TinCheckOutcome>;
  document?: { documentType: 'national_id' | 'passport'; documentNumber: string } | null;
}): { svc: RegistrationService; createRegistration: Mock; drafts: DraftsStandIn } {
  const createRegistration = vi.fn();
  const drafts = draftsStandIn();
  const orgs = {
    tinTaken: vi.fn(async () => opts.taken ?? false),
    createRegistration,
  } as unknown as OrganizationRepository;
  const tin = {
    verify: vi.fn(opts.verify ?? (async () => outcome('verified'))),
  } as unknown as RraTinAdapter;
  const profiles = {
    save: vi.fn(),
    isComplete: vi.fn(async () => true),
    documentFor: vi.fn(async () => opts.document ?? null),
  } as unknown as ProfileService;
  const identity = {
    assertMayRegister: vi.fn(async () => undefined),
  } as unknown as IdentityService;
  const svc = new RegistrationService(
    orgs,
    tin,
    profiles,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    // The PSF path's association lookup (audric-main): a hotel is filed under RHA when PSF lists it.
    { associationOffered: vi.fn(async () => false), associationForRegistration: vi.fn() } as never,
    identity,
    drafts as never,
  );
  return { svc, createRegistration, drafts };
}

describe('RegistrationService.checkTin', () => {
  it('says verified when RRA recognises the TIN', async () => {
    const { svc } = service({});
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('verified');
  });

  it('says failed when RRA does not', async () => {
    const { svc } = service({ verify: async () => outcome('failed') });
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('failed');
  });

  it('says taken before asking RRA when another business holds it', async () => {
    const verify = vi.fn(async () => outcome('verified'));
    const { svc } = service({ taken: true, verify });
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('taken');
    expect(verify).not.toHaveBeenCalled();
  });

  it('reads an adapter that throws as pending, never as a refusal', async () => {
    const { svc } = service({
      verify: async () => {
        throw new Error('RRA down');
      },
    });
    expect((await svc.checkTin(TIN, 'user-1')).result).toBe('pending');
  });

  it('names the directors only to the helper; the owner learns listed or not (ADR-075 AC-7)', async () => {
    const { svc } = service({
      verify: async () => withDirectors(),
      document: { documentType: 'national_id', documentNumber: '1199270056789034' },
    });
    const owner = await svc.checkTin(TIN, 'user-1', 'owner');
    expect(owner.business?.directors).toEqual([]);
    expect(owner.registrantIsDirector).toBe(true);
    const unsaid = await svc.checkTin(TIN, 'user-1');
    expect(unsaid.business?.directors).toEqual([]);
    const helper = await svc.checkTin(TIN, 'user-1', 'on_behalf_of');
    expect(helper.business?.directors.map((d) => d.name)).toEqual(['Eric Habimana', 'Diane Mukamana']);
    expect(JSON.stringify(helper)).not.toContain('1198580045678923');
  });

  it("keeps the answer on the caller's draft, with the TIN and the capacity it answered (ADR-075 D-m)", async () => {
    const { svc, drafts } = service({ verify: async () => withDirectors() });
    const helper = await svc.checkTin(TIN, 'user-1', 'on_behalf_of');
    expect(drafts.recordTinCheck).toHaveBeenLastCalledWith('user-1', { tin: TIN, capacity: 'on_behalf_of', answer: helper });
    const unsaid = await svc.checkTin(TIN, 'user-1');
    expect(drafts.recordTinCheck).toHaveBeenLastCalledWith('user-1', { tin: TIN, capacity: null, answer: unsaid });
  });

  it('keeps a refusal too, so a refreshed page shows it rather than asking again', async () => {
    const { svc, drafts } = service({ verify: async () => outcome('failed') });
    const refused = await svc.checkTin(TIN, 'user-1', 'owner');
    expect(drafts.recordTinCheck).toHaveBeenCalledWith('user-1', { tin: TIN, capacity: 'owner', answer: refused });
    expect(refused.result).toBe('failed');
  });

  it('tells an owner whose document is not among them that they are not listed', async () => {
    const { svc } = service({
      verify: async () => withDirectors(),
      document: { documentType: 'national_id', documentNumber: '1199999999999999' },
    });
    expect((await svc.checkTin(TIN, 'user-1', 'owner')).registrantIsDirector).toBe(false);
  });
});

describe('RegistrationService.create, the TIN gate before the bill', () => {
  const request = {
    role: 'host',
    business: { domain: 'hospitality', tin: TIN },
  } as unknown as CreateRegistrationRequest;

  it('refuses a TIN RRA does not recognise, at the TIN field, writing nothing', async () => {
    const { svc, createRegistration } = service({
      verify: async () => outcome('failed'),
    });
    const refusal = await svc.create(request, 'user-1').catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(BadRequestException);
    expect(
      ((refusal as BadRequestException).getResponse() as { issues: { path: unknown[] }[] })
        .issues[0]?.path,
    ).toEqual(['business', 'tin']);
    expect(createRegistration).not.toHaveBeenCalled();
  });
});

describe('RegistrationService.create, the document a kind requires (ADR-075 AC-11)', () => {
  const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201 };
  type Stored = Record<string, { kind: string; uploadedByUserId: string | null }>;

  function harness(stored: Stored): { svc: RegistrationService; createRegistration: Mock; drafts: DraftsStandIn } {
    const drafts = draftsStandIn();
    const createRegistration = vi.fn(async () => ({
      orgId: 'org-1',
      workspaceId: 'ws-1',
      amountDueRwf: 50000,
      invoiceId: 'inv-1',
      obo: null,
      claimInvitation: null,
    }));
    const orgs = {
      tinTaken: vi.fn(async () => false),
      createRegistration,
      districtsForSectors: vi.fn(async () => new Map([[10201, 102]])),
    } as unknown as OrganizationRepository;
    const tin = { verify: vi.fn(async () => outcome('verified')) } as unknown as RraTinAdapter;
    const profiles = {
      save: vi.fn(),
      isComplete: vi.fn(async () => true),
      documentFor: vi.fn(async () => null),
    } as unknown as ProfileService;
    const storage = {
      describe: vi.fn(async (objectKey: string) =>
        stored[objectKey] ? { objectKey, mime: 'application/pdf', sizeBytes: 10, workspaceId: null, ...stored[objectKey] } : null,
      ),
    };
    const identity = { assertMayRegister: vi.fn(async () => undefined) } as unknown as IdentityService;
    const svc = new RegistrationService(
      orgs,
      tin,
      profiles,
      {} as never,
      {} as never,
      { received: vi.fn(async () => undefined) } as never,
      storage as never,
      // The PSF path's association lookup (audric-main): a hotel is filed under RHA when PSF lists it.
      { associationOffered: vi.fn(async () => false), associationForRegistration: vi.fn() } as never,
      identity,
      drafts as never,
    );
    return { svc, createRegistration, drafts };
  }

  const hotel = (certificates: { kind: string; objectKey: string }[]): CreateRegistrationRequest =>
    ({
      role: 'host',
      capacity: 'owner',
      business: {
        domain: 'hospitality',
        legalName: 'Spec Hotel',
        address: ADDRESS,
        businessKind: 'hotel',
        accommodationClass: 'hotel',
        tin: TIN,
        certificates,
        branches: [],
        chamberOfTourismMember: false,
        psfMember: false,
      },
    }) as unknown as CreateRegistrationRequest;

  const issuesOf = (refusal: unknown): { path: unknown[]; message: string }[] =>
    ((refusal as UnprocessableEntityException).getResponse() as { issues: { path: unknown[]; message: string }[] }).issues;

  it('refuses a hotel with no RDB certificate, 422 at the certificates, writing nothing', async () => {
    const { svc, createRegistration } = harness({});
    const refusal = await svc.create(hotel([]), 'user-1').catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(UnprocessableEntityException);
    expect(issuesOf(refusal)).toEqual([
      { code: 'custom', path: ['business', 'certificates'], message: 'Upload the RDB certificate.' },
    ]);
    expect(createRegistration).not.toHaveBeenCalled();
  });

  it('asks a residence for its land title, whatever else it sent', async () => {
    const { svc } = harness({ mine: { kind: 'certificate', uploadedByUserId: 'user-1' } });
    const residence = {
      role: 'landlord',
      capacity: 'owner',
      business: {
        domain: 'residence',
        legalName: 'Spec Flats',
        address: ADDRESS,
        residenceClass: 'residential_landlord',
        upi: '1/03/07/02/1234',
        certificates: [{ kind: 'rdb_certificate', objectKey: 'mine' }],
      },
    } as unknown as CreateRegistrationRequest;
    const refusal = await svc.create(residence, 'user-1').catch((e: unknown) => e);
    expect(issuesOf(refusal).map((i) => i.message)).toEqual(['Upload the land title.']);
  });

  it("refuses someone else's upload and a key that is no stored certificate, each at its own field", async () => {
    const { svc, createRegistration } = harness({
      theirs: { kind: 'certificate', uploadedByUserId: 'user-2' },
      photo: { kind: 'id_photo', uploadedByUserId: 'user-1' },
    });
    const refusal = await svc
      .create(
        hotel([
          { kind: 'rdb_certificate', objectKey: 'theirs' },
          { kind: 'tax_clearance', objectKey: 'photo' },
          { kind: 'fire_safety', objectKey: 'made-up' },
        ]),
        'user-1',
      )
      .catch((e: unknown) => e);
    expect(issuesOf(refusal).map((i) => i.path)).toEqual([
      ['business', 'certificates', 0, 'objectKey'],
      ['business', 'certificates', 1, 'objectKey'],
      ['business', 'certificates', 2, 'objectKey'],
    ]);
    expect(createRegistration).not.toHaveBeenCalled();
  });

  it('lets a hotel carrying its own RDB certificate through to the write', async () => {
    const { svc, createRegistration } = harness({ mine: { kind: 'certificate', uploadedByUserId: 'user-1' } });
    const created = await svc.create(hotel([{ kind: 'rdb_certificate', objectKey: 'mine' }]), 'user-1');
    expect(created.status).toBe('pending_payment');
    expect(createRegistration).toHaveBeenCalledTimes(1);
  });

  it('marks the draft with the registration it became and keeps it, for the fee to clear (ADR-075 D-l, D-m)', async () => {
    const { svc, drafts } = harness({ mine: { kind: 'certificate', uploadedByUserId: 'user-1' } });
    await svc.create(hotel([{ kind: 'rdb_certificate', objectKey: 'mine' }]), 'user-1');
    expect(drafts.markRegistered).toHaveBeenCalledWith('user-1', 'org-1');
    expect(drafts.clear).not.toHaveBeenCalled();
  });

  it('leaves the draft alone when the registration is refused', async () => {
    const { svc, drafts } = harness({});
    await svc.create(hotel([]), 'user-1').catch(() => undefined);
    expect(drafts.markRegistered).not.toHaveBeenCalled();
    expect(drafts.clear).not.toHaveBeenCalled();
  });
});

describe('RegistrationService.create, the franchise answer (ADR-075 AC-8)', () => {
  const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201 };
  function harness(): { svc: RegistrationService; createRegistration: Mock } {
    const createRegistration = vi.fn(async () => ({
      orgId: 'org-1',
      workspaceId: 'ws-1',
      amountDueRwf: 50000,
      invoiceId: 'inv-1',
      obo: null,
      claimInvitation: null,
    }));
    const orgs = {
      tinTaken: vi.fn(async () => false),
      createRegistration,
      districtsForSectors: vi.fn(async () => new Map([[10201, 102]])),
    } as unknown as OrganizationRepository;
    const svc = new RegistrationService(
      orgs,
      { verify: vi.fn(async () => outcome('verified')) } as unknown as RraTinAdapter,
      {
        save: vi.fn(),
        isComplete: vi.fn(async () => true),
        documentFor: vi.fn(async () => null),
      } as unknown as ProfileService,
      {} as never,
      {} as never,
      { received: vi.fn(async () => undefined) } as never,
      {
        describe: vi.fn(async (objectKey: string) => ({
          objectKey,
          kind: 'certificate',
          uploadedByUserId: 'user-1',
          mime: 'application/pdf',
          sizeBytes: 10,
          workspaceId: null,
        })),
      } as never,
      { associationOffered: vi.fn(async () => false), associationForRegistration: vi.fn() } as never,
      { assertMayRegister: vi.fn(async () => undefined) } as unknown as IdentityService,
      draftsStandIn() as never,
    );
    return { svc, createRegistration };
  }
  const request = (business: Record<string, unknown>): CreateRegistrationRequest =>
    ({
      role: 'host',
      capacity: 'owner',
      business: {
        domain: 'hospitality',
        legalName: 'Spec Cafe',
        address: ADDRESS,
        businessKind: 'coffee_shop',
        tin: TIN,
        branches: [],
        chamberOfTourismMember: false,
        psfMember: false,
        ...business,
      },
    }) as unknown as CreateRegistrationRequest;
  const written = (createRegistration: Mock): unknown =>
    (createRegistration.mock.calls[0] as unknown as [{ franchise: unknown }])[0].franchise;

  it("writes a franchisee's answer, with the agreement document it sent", async () => {
    const { svc, createRegistration } = harness();
    await svc.create(
      request({
        certificates: [
          { kind: 'rdb_certificate', objectKey: 'rdb' },
          { kind: 'franchise_agreement', objectKey: 'agreement' },
        ],
        franchise: { role: 'franchisee', brandName: 'Java House', franchisorLegalName: 'Java House Africa Ltd', franchisorCountry: 'KE' },
      }),
      'user-1',
    );
    expect(written(createRegistration)).toEqual({
      role: 'franchisee',
      brandName: 'Java House',
      franchisorLegalName: 'Java House Africa Ltd',
      franchisorCountry: 'KE',
      agreementObjectKey: 'agreement',
    });
  });

  it("writes a franchisor's brand and locations", async () => {
    const { svc, createRegistration } = harness();
    await svc.create(
      request({
        certificates: [{ kind: 'rdb_certificate', objectKey: 'rdb' }],
        franchise: { role: 'franchisor', brandName: 'Kivu Rooms', franchisedLocations: 12 },
      }),
      'user-1',
    );
    expect(written(createRegistration)).toEqual({ role: 'franchisor', brandName: 'Kivu Rooms', franchisedLocations: 12 });
  });

  it('writes nothing for No', async () => {
    const { svc, createRegistration } = harness();
    await svc.create(request({ certificates: [{ kind: 'rdb_certificate', objectKey: 'rdb' }] }), 'user-1');
    expect(written(createRegistration)).toBeNull();
  });
});

describe("RegistrationService.review, a PSF District Manager's one step (0119)", () => {
  const ORG = '11111111-1111-4111-8111-111111111111';
  const MANAGER = '22222222-2222-4222-8222-222222222222';
  const KICUKIRO = 23;
  const grant = (districtId: number) => ({
    assignmentId: '33333333-3333-4333-8333-333333333333',
    oversightRole: 'psf_membership_officer' as const,
    governmentBodyCode: 'PSF',
    governmentTitle: 'District Manager',
    scopeLevel: 'district' as const,
    provinceId: null,
    districtId,
    sectorId: null,
    cellId: null,
    villageId: null,
  });

  function reviewing(opts: { unchecked?: number; awaitingClaim?: boolean } = {}) {
    const recordReviewAndAdvance = vi.fn(async () => true);
    const approved = vi.fn(async () => undefined);
    const orgs = {
      findById: vi.fn(async () => ({ id: ORG, status: 'tin_verified', districtId: KICUKIRO })),
      holdsOrgRole: vi.fn(async () => false),
      districtsByProvince: vi.fn(async () => new Map()),
      documentsForOrg: vi.fn(async () => [
        { checkedAt: new Date() },
        ...Array.from({ length: opts.unchecked ?? 0 }, () => ({ checkedAt: null })),
      ]),
      isAwaitingOwnerClaim: vi.fn(async () => opts.awaitingClaim ?? false),
      recordReviewAndAdvance,
    } as unknown as OrganizationRepository;
    const svc = new RegistrationService(
      orgs,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { approved } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(svc, 'summary').mockResolvedValue({ status: 'active' } as never);
    return { svc, recordReviewAndAdvance, approved };
  }

  it('approves and activates in one decision, recorded at the first gate under the manager', async () => {
    const { svc, recordReviewAndAdvance, approved } = reviewing();
    await svc.review(ORG, MANAGER, [grant(KICUKIRO)], 'Certificate matches RDB.');
    expect(recordReviewAndAdvance).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'tin_verified',
        decision: 'passed',
        to: 'approved',
        thenActivate: true,
        oversightRole: 'psf_membership_officer',
        decidedByUserId: MANAGER,
      }),
    );
    expect(approved).toHaveBeenCalledWith(ORG, false);
  });

  it('holds an on-behalf-of business for its owner rather than activating it', async () => {
    const { svc, recordReviewAndAdvance } = reviewing({ awaitingClaim: true });
    await svc.review(ORG, MANAGER, [grant(KICUKIRO)], null);
    expect(recordReviewAndAdvance).toHaveBeenCalledWith(expect.objectContaining({ thenActivate: false }));
  });

  it('refuses while a document is unread, and decides nothing', async () => {
    const { svc, recordReviewAndAdvance } = reviewing({ unchecked: 2 });
    await expect(svc.review(ORG, MANAGER, [grant(KICUKIRO)], null)).rejects.toThrow(
      '2 documents on this registration have not been checked yet',
    );
    expect(recordReviewAndAdvance).not.toHaveBeenCalled();
  });

  it('refuses a business outside the district the manager covers', async () => {
    const { svc, recordReviewAndAdvance } = reviewing();
    await expect(svc.review(ORG, MANAGER, [grant(KICUKIRO + 1)], null)).rejects.toThrow(
      'outside the region you are assigned to',
    );
    expect(recordReviewAndAdvance).not.toHaveBeenCalled();
  });
});
