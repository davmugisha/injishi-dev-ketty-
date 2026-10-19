import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import {
  PaymentUnavailableError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
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
 * PSF membership's rules (ADR-056, widened by the PSF path), against a stand in
 * repository, mailer and payment seam. What the SQL itself does is proved over
 * real HTTP by `scripts/verify-psf-path.mjs`; this pins the decisions the
 * service makes.
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const APP = '22222222-2222-4222-8222-222222222222';
const WS = '33333333-3333-4333-8333-333333333333';

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
    districtId: 102,
    districtName: 'Gasabo',
    businessCode: 'GAS0007',
    registrationKind: null,
    registrationNumber: null,
    ownerGroups: [],
    associationName: 'Rwanda Hospitality Association',
    clusterName: 'Services',
    obo: null,
    ...over,
  };
}

/** A PSF business: a metal workshop in Kicukiro, registered nowhere yet. */
const WORKSHOP = facts({
  domain: 'enterprise',
  legalName: 'Gahaya Metal Works',
  tin: null,
  accommodationClass: null,
  registrationStatus: 'active',
  districtId: 103,
  districtName: 'Kicukiro',
  businessCode: 'KIC0001',
  registrationKind: 'none',
  ownerGroups: ['women'],
  associationName: 'Metal Works Association',
  clusterName: 'Industry',
});

const TIER = {
  code: 'indatwa_100k',
  family: 'indatwa' as const,
  nameEn: 'Indatwa, 100,000 to 199,999',
  nameRw: null,
  priceKind: 'range' as const,
  annualFeeRwf: null,
  annualFeeMinRwf: 100000,
  annualFeeMaxRwf: 199999,
  benefitsEn: [],
  benefitsRw: null,
  sortOrder: 30,
  active: true,
  updatedByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FORM = {
  requestedTierCode: 'indatwa_100k',
  declaredFeeRwf: 150000,
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

const APPROVED = {
  id: APP,
  orgId: ORG,
  status: 'approved',
  requestedTierName: 'Indatwa, 100,000 to 199,999',
  approvedMembershipNumber: 'PSF/GAS/0042',
  approvedFeeRwf: 150000,
  paidAt: null,
};

function setup(env: Record<string, string> = {}): {
  repo: Record<string, jest.Mock>;
  mail: Record<string, jest.Mock>;
  payments: Record<string, jest.Mock>;
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
    applicationById: jest.fn().mockResolvedValue({ id: APP, orgId: ORG, status: 'submitted', requestedTierName: 'Indatwa' }),
    markQueued: jest.fn().mockResolvedValue([]),
    officerApplication: jest.fn().mockResolvedValue({
      id: APP,
      orgId: ORG,
      status: 'submitted',
      officerHasStake: false,
      requestedTierName: 'Indatwa',
      quotedPriceKind: 'range',
      quotedFeeRwf: null,
      declaredFeeRwf: 150000,
    }),
    approve: jest.fn().mockResolvedValue({ orgId: ORG }),
    decline: jest.fn().mockResolvedValue({ orgId: ORG }),
    workspaceIdFor: jest.fn().mockResolvedValue(WS),
    recordPayment: jest.fn().mockResolvedValue({ tierCode: TIER.code, membershipNumber: 'PSF/GAS/0042' }),
    recordRemittance: jest.fn().mockResolvedValue(undefined),
    districtsByProvince: jest.fn().mockResolvedValue(new Map([[1, [101, 102, 103]]])),
    queuePage: jest.fn().mockResolvedValue({ rows: [], more: false }),
    endExpired: jest.fn().mockResolvedValue([]),
    claimExpiryReminders: jest.fn().mockResolvedValue([]),
    unstampedQueuedOrgs: jest.fn().mockResolvedValue([]),
  };
  const mail = {
    received: jest.fn().mockResolvedValue(undefined),
    queueEntered: jest.fn().mockResolvedValue(undefined),
    approved: jest.fn().mockResolvedValue(undefined),
    member: jest.fn().mockResolvedValue(undefined),
    declined: jest.fn().mockResolvedValue(undefined),
    expiring: jest.fn().mockResolvedValue(undefined),
    expired: jest.fn().mockResolvedValue(undefined),
  };
  const receipt = (over = {}) => ({
    adapterRef: 'mock_ref_1',
    mode: 'mock',
    replayed: false,
    amountRwf: 150000,
    currency: 'RWF',
    occurredAt: new Date('2026-10-15T08:00:00Z'),
    settlement: 'settled',
    ...over,
  });
  const payments = {
    chargeOneTimeFee: jest.fn().mockResolvedValue(receipt()),
    payout: jest.fn().mockResolvedValue(receipt({ adapterRef: 'mock_payout_1' })),
  };
  const service = new PsfMembershipService(
    repo as unknown as PsfMembershipRepository,
    mail as unknown as PsfMembershipMailer,
    { documentFor: jest.fn().mockResolvedValue(null) } as unknown as ProfileService,
    payments as unknown as PaymentPort,
    { get: (key: string) => env[key] } as unknown as ConfigService,
  );
  // A decided application is read back for the officer; its detail is not under test here.
  jest
    .spyOn(service as unknown as { decidedView: () => Promise<unknown> }, 'decidedView')
    .mockResolvedValue({});
  jest.spyOn(service, 'officerApplication').mockResolvedValue({} as never);
  return { repo, mail, payments, service };
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

  it('lets the owner of a PSF business in, and shows PSF its code and sector', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(WORKSHOP);
    const overview = await service.overview(ORG, 'u-owner');
    expect(overview.profile).toEqual(
      expect.objectContaining({ businessCode: 'KIC0001', clusterName: 'Industry', ownerGroups: ['women'] }),
    );
    expect(overview.canApply).toBe(true);
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

  it('a PSF business registered nowhere files with no number, and keeps its amount', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(WORKSHOP);
    await service.apply(ORG, 'u-owner', FORM);
    const row = repo.insertApplication.mock.calls[0][0];
    expect(row.registrationType).toBe('none');
    expect(row.registrationNumber).toBeNull();
    expect(row.declaredFeeRwf).toBe(150000);
  });

  it('an amount outside the band is refused at its field, and nothing is filed', async () => {
    const { repo, service } = setup();
    const refusal = await service.apply(ORG, 'u-owner', { ...FORM, declaredFeeRwf: 90000 }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(UnprocessableEntityException);
    expect(JSON.stringify((refusal as UnprocessableEntityException).getResponse())).toContain('declaredFeeRwf');
    expect(repo.insertApplication).not.toHaveBeenCalled();
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

describe('PsfMembershipService · deciding (AC-11 to AC-14, the PSF path)', () => {
  const country = [
    { oversightRole: 'psf_membership_officer' as const, governmentBodyCode: 'PSF', governmentTitle: null, scopeLevel: 'country' as const, provinceId: null, districtId: null },
  ];
  const kicukiro = [{ ...country[0], scopeLevel: 'district' as const, provinceId: 1, districtId: 103 }];

  it('an officer with a stake is refused 403 and nothing is written', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue({ id: APP, orgId: ORG, status: 'submitted', officerHasStake: true });
    await expect(service.approve('u-officer', country, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('a decided application is a 409, not a 404', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue(null);
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'member' });
    await expect(service.approve('u-officer', country, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('an approved application waits on the payment and is not decided again', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue({ id: APP, orgId: ORG, status: 'approved', officerHasStake: false });
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'approved' });
    await expect(service.approve('u-officer', country, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('approving charges what the business declared, and asks it to pay', async () => {
    const { repo, mail, service } = setup();
    await service.approve('u-officer', country, APP, { membershipNumber: 'PSF/GAS/0042' });
    expect(repo.approve.mock.calls[0][0]).toEqual(expect.objectContaining({ bodyCode: 'PSF', feeRwf: 150000, membershipNumber: 'PSF/GAS/0042' }));
    expect(mail.approved).toHaveBeenCalledWith(ORG, expect.objectContaining({ feeRwf: 150000 }));
    expect(mail.member).not.toHaveBeenCalled();
  });

  it('a tier PSF prices itself needs the officer’s amount', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue({
      id: APP, orgId: ORG, status: 'submitted', officerHasStake: false, quotedPriceKind: 'set_by_psf', quotedFeeRwf: null, declaredFeeRwf: null,
    });
    await expect(service.approve('u-officer', country, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    await service.approve('u-officer', country, APP, { membershipNumber: 'PSF/1', feeRwf: 2_000_000 });
    expect(repo.approve.mock.calls[0][0].feeRwf).toBe(2_000_000);
  });

  it('losing the race is a 409, and no mail goes', async () => {
    const { repo, mail, service } = setup();
    repo.approve.mockResolvedValue(null);
    await expect(service.approve('u-officer', country, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ConflictException);
    expect(mail.approved).not.toHaveBeenCalled();
  });

  it('a decline mails the reason and the note', async () => {
    const { mail, service } = setup();
    await service.decline('u-officer', country, APP, { reason: 'other', note: 'Send the certificate.' });
    expect(mail.declined).toHaveBeenCalledWith(ORG, 'other', 'Send the certificate.');
  });

  it('a district officer reads their district only, and a country officer everything', async () => {
    const { repo, service } = setup();
    await service.queue('u-officer', kicukiro, undefined);
    expect(repo.queuePage.mock.calls[0][1]).toEqual([103]);
    await service.queue('u-officer', country, undefined);
    expect(repo.queuePage.mock.calls[1][1]).toBeNull();
  });
});

describe('PsfMembershipService · paying (the PSF path)', () => {
  const PHONE = { phoneE164: '+250788000101' };

  it('charges the approved amount once, keyed on the application, and makes it a member', async () => {
    const { repo, mail, payments, service } = setup();
    repo.applicationById.mockResolvedValue(APPROVED);
    await service.pay(ORG, 'u-owner', APP, PHONE);
    expect(payments.chargeOneTimeFee).toHaveBeenCalledWith(
      expect.objectContaining({ amountRwf: 150000, idempotencyKey: `${WS}:psf-membership:${APP}`, feeCode: 'psf_membership' }),
    );
    expect(repo.recordPayment.mock.calls[0][0]).toEqual(
      expect.objectContaining({ amountRwf: 150000, paymentRef: 'mock_ref_1', startsOn: '2026-10-15', expiresOn: '2027-10-14' }),
    );
    expect(mail.member).toHaveBeenCalledWith(ORG, expect.objectContaining({ paymentReference: 'mock_ref_1' }));
  });

  it('a prompt still on the handset is a 409 payment_pending, and nothing is recorded', async () => {
    const { repo, payments, service } = setup();
    repo.applicationById.mockResolvedValue(APPROVED);
    payments.chargeOneTimeFee.mockResolvedValue({ ...(await payments.chargeOneTimeFee()), settlement: 'pending' });
    const refusal = await service.pay(ORG, 'u-owner', APP, PHONE).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(ConflictException);
    expect(JSON.stringify((refusal as ConflictException).getResponse())).toContain('payment_pending');
    expect(repo.recordPayment).not.toHaveBeenCalled();
  });

  it('an unreachable provider is a 503 that says nothing was taken', async () => {
    const { repo, payments, service } = setup();
    repo.applicationById.mockResolvedValue(APPROVED);
    payments.chargeOneTimeFee.mockRejectedValue(new PaymentUnavailableError('down', 'k'));
    await expect(service.pay(ORG, 'u-owner', APP, PHONE)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('an application not approved is not payable, and a paid one is not charged twice', async () => {
    const { repo, payments, service } = setup();
    repo.applicationById.mockResolvedValue({ ...APPROVED, status: 'submitted' });
    await expect(service.pay(ORG, 'u-owner', APP, PHONE)).rejects.toBeInstanceOf(ConflictException);
    repo.applicationById.mockResolvedValue({ ...APPROVED, status: 'member', paidAt: new Date() });
    await service.pay(ORG, 'u-owner', APP, PHONE);
    expect(payments.chargeOneTimeFee).not.toHaveBeenCalled();
  });

  it('passes the fee on to PSF when its account is configured, and holds it when not', async () => {
    const held = setup();
    held.repo.applicationById.mockResolvedValue(APPROVED);
    await held.service.pay(ORG, 'u-owner', APP, PHONE);
    expect(held.payments.payout).not.toHaveBeenCalled();

    const sent = setup({ PSF_PAYOUT_DESTINATION: 'bank', PSF_PAYOUT_REF: '000400012345' });
    sent.repo.applicationById.mockResolvedValue(APPROVED);
    await sent.service.pay(ORG, 'u-owner', APP, PHONE);
    expect(sent.payments.payout).toHaveBeenCalledWith(expect.objectContaining({ destination: 'bank', amountRwf: 150000 }));
    expect(sent.repo.recordRemittance).toHaveBeenCalledWith(APP, 'mock_payout_1');
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
  it('copies the price shown, files the registration it is given, and keeps the declared amount', () => {
    const row = buildPsfApplicationRow({
      submittedByUserId: 'u-owner',
      capacity: 'owner',
      registrationType: 'tin',
      registrationNumber: '999031001',
      tier: TIER,
      form: FORM,
      consentGivenAt: new Date('2026-09-27T08:00:00Z'),
      consentVersion: '2026-09-27',
    });
    expect(row.quotedFeeMinRwf).toBe(100000);
    expect(row.declaredFeeRwf).toBe(150000);
    expect(row.registrationType).toBe('tin');
    expect(row.registrationNumber).toBe('999031001');
    expect(row.tradeGoods).toBeNull();
    expect(row.tradeCountries).toEqual([]);
  });

  it('files no number for a business registered nowhere, and no amount for a tier PSF prices', () => {
    const row = buildPsfApplicationRow({
      submittedByUserId: 'u-owner',
      capacity: 'owner',
      registrationType: 'none',
      registrationNumber: 'ignored',
      tier: { ...TIER, priceKind: 'set_by_psf', annualFeeMinRwf: null, annualFeeMaxRwf: null },
      form: FORM,
      consentGivenAt: new Date('2026-09-27T08:00:00Z'),
      consentVersion: '2026-09-27',
    });
    expect(row.registrationNumber).toBeNull();
    expect(row.declaredFeeRwf).toBeNull();
  });
});
