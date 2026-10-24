import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { ProfileService } from '../../user/application/profile.service';
import type { PsfMembershipMailer } from '../infrastructure/psf-membership.mailer';
import {
  OpenPsfApplicationExists,
  type PsfMembershipRepository,
  type PsfOrgFacts,
} from '../infrastructure/psf-membership.repository';
import { buildPsfApplicationRow } from './psf-application-row';
import { PsfMembershipService } from './psf-membership.service';

/**
 * PSF membership's rules (ADR-056), against a stand in repository and mailer.
 * What the SQL itself does is proved over real HTTP by
 * `scripts/verify-adr056-psf.mjs`; this pins the decisions the service makes.
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const APP = '22222222-2222-4222-8222-222222222222';

function facts(over: Partial<PsfOrgFacts> = {}): PsfOrgFacts {
  return {
    id: ORG,
    domain: 'hospitality',
    legalName: 'Umucyo Garden Guest House',
    tin: '999031001',
    addressText: 'KG 192 St',
    accommodationClass: 'guest_house',
    accommodationClassOther: null,
    registrationStatus: 'tin_verified',
    districtName: 'Gasabo',
    obo: null,
    ...over,
  };
}

const TIER = {
  code: 'ordinary_300k',
  family: 'ordinary' as const,
  nameEn: 'Ordinary, 300,000 a year',
  nameRw: null,
  priceKind: 'fixed' as const,
  annualFeeRwf: 300000,
  annualFeeMinRwf: null,
  annualFeeMaxRwf: null,
  benefitsEn: [],
  benefitsRw: null,
  sortOrder: 10,
  active: true,
  updatedByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FORM = {
  requestedTierCode: 'ordinary_300k',
  companyName: 'Umucyo Garden Guest House',
  streetAddress: 'KG 192 St',
  companyType: 'sole_trader' as const,
  ownership: 'rwandan_100' as const,
  businessActivity: 'Accommodation: Guest House',
  tradeDirection: 'none' as const,
  tradeCountries: [],
  contactRole: 'owner' as const,
  firstName: 'Innocent',
  lastName: 'Niyonsaba',
  gender: 'male' as const,
  phoneE164: '+250788000101',
  email: 'innocent@example.rw',
  idDocument: { documentType: 'national_id' as const, documentNumber: '1198480030001001' },
  dateOfBirth: '1984-03-09',
  consent: true as const,
};

function setup(): {
  repo: Record<string, jest.Mock>;
  mail: Record<string, jest.Mock>;
  service: PsfMembershipService;
} {
  const repo = {
    orgFacts: jest.fn().mockResolvedValue(facts()),
    activeRole: jest.fn().mockResolvedValue('owner'),
    tier: jest.fn().mockResolvedValue(TIER),
    tiers: jest.fn().mockResolvedValue([TIER]),
    insertApplication: jest.fn().mockResolvedValue({ id: APP }),
    currentMembership: jest.fn().mockResolvedValue(null),
    applications: jest.fn().mockResolvedValue([]),
    personFacts: jest.fn().mockResolvedValue(null),
    withdraw: jest.fn().mockResolvedValue(true),
    applicationById: jest.fn().mockResolvedValue({ id: APP, orgId: ORG, status: 'submitted', requestedTierName: 'Ordinary' }),
    markQueued: jest.fn().mockResolvedValue([]),
    officerApplication: jest.fn().mockResolvedValue({ id: APP, orgId: ORG, officerHasStake: false }),
    decideMember: jest.fn().mockResolvedValue({ orgId: ORG }),
    decline: jest.fn().mockResolvedValue({ orgId: ORG }),
    endExpired: jest.fn().mockResolvedValue([]),
    claimExpiryReminders: jest.fn().mockResolvedValue([]),
    unstampedQueuedOrgs: jest.fn().mockResolvedValue([]),
  };
  const mail = {
    received: jest.fn().mockResolvedValue(undefined),
    queueEntered: jest.fn().mockResolvedValue(undefined),
    member: jest.fn().mockResolvedValue(undefined),
    declined: jest.fn().mockResolvedValue(undefined),
    expiring: jest.fn().mockResolvedValue(undefined),
    expired: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PsfMembershipService(
    repo as unknown as PsfMembershipRepository,
    mail as unknown as PsfMembershipMailer,
    { documentFor: jest.fn().mockResolvedValue(null) } as unknown as ProfileService,
  );
  // `decidedView` reads back after a decision; its detail is not under test here.
  jest
    .spyOn(service as unknown as { decidedView: () => Promise<unknown> }, 'decidedView')
    .mockResolvedValue({});
  return { repo, mail, service };
}

describe('PsfMembershipService · who may act (AC-15, AC-17, AC-22)', () => {
  it('refuses a receptionist with 403', async () => {
    const { repo, service } = setup();
    repo.activeRole.mockResolvedValue('receptionist');
    await expect(service.overview(ORG, 'u-receptionist')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a residence with 422', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(facts({ domain: 'residence' }));
    await expect(service.overview(ORG, 'u-owner')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuses the on behalf agent once the owner has claimed, though they are still an owner', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(
      facts({ obo: { registrantUserId: 'u-agent', claimStatus: 'owner_claimed', intendedOwnerName: 'Owner', intendedOwnerNationalId: null, intendedOwnerEmail: null } }),
    );
    await expect(service.overview(ORG, 'u-agent')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('answers 404 for no such business', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(null);
    await expect(service.overview(ORG, 'u-owner')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PsfMembershipService · applying (AC-6, AC-8, AC-9, AC-16)', () => {
  it('past the TIN check, it is received AND stamped into the queue', async () => {
    const { repo, mail, service } = setup();
    repo.markQueued.mockResolvedValue([APP]);
    await service.apply(ORG, 'u-owner', FORM);
    expect(mail.received).toHaveBeenCalledWith(ORG, TIER.nameEn, true);
    expect(repo.markQueued).toHaveBeenCalledWith(ORG);
    expect(mail.queueEntered).toHaveBeenCalledTimes(1);
  });

  it('before the TIN check, it is received and NOT stamped', async () => {
    const { repo, mail, service } = setup();
    repo.orgFacts.mockResolvedValue(facts({ registrationStatus: 'submitted' }));
    await service.apply(ORG, 'u-owner', FORM);
    expect(mail.received).toHaveBeenCalledWith(ORG, TIER.nameEn, false);
    expect(repo.markQueued).not.toHaveBeenCalled();
  });

  it('a second open application is a 409', async () => {
    const { repo, service } = setup();
    repo.insertApplication.mockRejectedValue(new OpenPsfApplicationExists());
    await expect(service.apply(ORG, 'u-owner', FORM)).rejects.toBeInstanceOf(ConflictException);
  });

  it('a retired tier is a 422', async () => {
    const { repo, service } = setup();
    repo.tier.mockResolvedValue({ ...TIER, active: false });
    await expect(service.apply(ORG, 'u-owner', FORM)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('the agent applies on behalf while the claim is open', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(
      facts({ obo: { registrantUserId: 'u-agent', claimStatus: 'registrant_held', intendedOwnerName: 'Owner', intendedOwnerNationalId: null, intendedOwnerEmail: null } }),
    );
    await service.apply(ORG, 'u-agent', FORM);
    expect(repo.insertApplication.mock.calls[0][0].submittedCapacity).toBe('on_behalf_of');
  });

  it('withdrawing what is no longer open is a 409, and a stranger’s id a 404', async () => {
    const { repo, service } = setup();
    repo.withdraw.mockResolvedValue(false);
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'declined' });
    await expect(service.withdraw(ORG, 'u-owner', APP)).rejects.toBeInstanceOf(ConflictException);
    repo.applicationById.mockResolvedValue({ id: APP, orgId: 'another-org', status: 'submitted' });
    await expect(service.withdraw(ORG, 'u-owner', APP)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PsfMembershipService · deciding (AC-11 to AC-14)', () => {
  const grants = [
    { assignmentId: '7a1f5b9e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', oversightRole: 'psf_membership_officer' as const, governmentBodyCode: 'PSF', governmentTitle: null, scopeLevel: 'country' as const, provinceId: null, districtId: null, sectorId: null, cellId: null, villageId: null },
  ];
  const body = { tierCode: 'ordinary_300k', membershipNumber: 'PSF/1', annualFeeRwf: 300000, startsOn: '2026-09-27', expiresOn: '2027-09-26' };

  it('an officer with a stake is refused 403 and nothing is written', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue({ id: APP, orgId: ORG, officerHasStake: true });
    await expect(service.member('u-officer', grants, APP, body)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.decideMember).not.toHaveBeenCalled();
  });

  it('a decided application is a 409, not a 404', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue(null);
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'member' });
    await expect(service.member('u-officer', grants, APP, body)).rejects.toBeInstanceOf(ConflictException);
  });

  it('losing the race is a 409, and no mail goes', async () => {
    const { repo, mail, service } = setup();
    repo.decideMember.mockResolvedValue(null);
    await expect(service.member('u-officer', grants, APP, body)).rejects.toBeInstanceOf(ConflictException);
    expect(mail.member).not.toHaveBeenCalled();
  });

  it('the decision carries the officer’s body, and the business is mailed', async () => {
    const { repo, mail, service } = setup();
    await service.member('u-officer', grants, APP, body);
    expect(repo.decideMember.mock.calls[0][0].bodyCode).toBe('PSF');
    expect(mail.member).toHaveBeenCalledWith(ORG, expect.objectContaining({ membershipNumber: 'PSF/1' }));
  });

  it('a decline mails the reason and the note', async () => {
    const { mail, service } = setup();
    await service.decline('u-officer', grants, APP, { reason: 'other', note: 'Send the certificate.' });
    expect(mail.declined).toHaveBeenCalledWith(ORG, 'other', 'Send the certificate.');
  });
});

describe('PsfMembershipService · the daily sweep (AC-18, AC-9)', () => {
  it('mails each ending once, reminds 30 days ahead, and catches up a missed stamp', async () => {
    const { repo, mail, service } = setup();
    repo.endExpired.mockResolvedValue([{ orgId: ORG, membershipNumber: 'PSF/OLD' }]);
    repo.claimExpiryReminders.mockResolvedValue([{ orgId: ORG, membershipNumber: 'PSF/SOON', expiresOn: '2026-10-20' }]);
    repo.unstampedQueuedOrgs.mockResolvedValue([ORG]);
    repo.markQueued.mockResolvedValue([APP]);

    const outcome = await service.sweep('2026-09-27');

    expect(repo.endExpired).toHaveBeenCalledWith('2026-09-27');
    expect(repo.claimExpiryReminders).toHaveBeenCalledWith('2026-09-27', '2026-10-27');
    expect(mail.expired).toHaveBeenCalledWith(ORG, 'PSF/OLD');
    expect(mail.expiring).toHaveBeenCalledWith(ORG, 'PSF/SOON', '2026-10-20');
    expect(mail.queueEntered).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ ended: 1, reminded: 1, stamped: 1 });
  });

  it('crosses a month end and a year end in calendar days', async () => {
    const { repo, service } = setup();
    await service.sweep('2026-12-15');
    expect(repo.claimExpiryReminders).toHaveBeenCalledWith('2026-12-15', '2027-01-14');
  });
});

describe('buildPsfApplicationRow', () => {
  it('copies the price shown and files the TIN, never an input', () => {
    const row = buildPsfApplicationRow({
      submittedByUserId: 'u-owner',
      capacity: 'owner',
      registrationNumber: '999031001',
      tier: TIER,
      form: FORM,
      consentGivenAt: new Date('2026-09-27T08:00:00Z'),
      consentVersion: '2026-09-27',
    });
    expect(row.quotedFeeRwf).toBe(300000);
    expect(row.registrationType).toBe('tin');
    expect(row.registrationNumber).toBe('999031001');
    expect(row.tradeGoods).toBeNull();
    expect(row.tradeCountries).toEqual([]);
  });
});
